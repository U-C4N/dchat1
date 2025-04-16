import { generateText, Message, CoreMessage, ToolCallPart, ToolResultPart } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';
import { getWeather, getEarthquake, getExchangeRate, getCoin, getStock } from '@/lib/ai/tools';
import { supabase } from '@/lib/supabase/client';
import { z } from 'zod';

// OpenWeather API anahtarı
const OPENWEATHER_API_KEY = "5998e8bdad7b9d919e410d4b60771131";

// Hava durumu fonksiyonunu OpenWeather API ile manuel olarak çağırmak için yardımcı fonksiyon
async function fetchWeatherData(latitude: number, longitude: number) {
  try {
    console.log(`[API] Fetching weather data for coordinates: ${latitude}, ${longitude}`);
    // Open-Meteo API'ye doğrudan istek at
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API] Open-Meteo API error: Status ${response.status}, Response: ${errorText}`);
      throw new Error(`Hava durumu API'sine erişim hatası: ${response.statusText}`);
    }

    const weatherData = await response.json();
    console.log(`[API] Successfully retrieved weather data from Open-Meteo`, JSON.stringify(weatherData).slice(0, 200) + '...');
    return weatherData;
  } catch (error) {
    console.error('[API] Error fetching weather data:', error instanceof Error ? error.message : JSON.stringify(error));
    console.error('[API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    throw error;
  }
}

// Ayrıca şehir ismi ile hava durumu almak için ek bir fonksiyon
async function fetchWeatherByCity(cityName: string) {
  try {
    console.log(`[API] Fetching weather data for city: ${cityName}`);
    // OpenWeather API'ye şehir ismi ile istek at
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityName)}&units=metric&appid=${OPENWEATHER_API_KEY}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API] OpenWeather API error: Status ${response.status}, Response: ${errorText}`);
      throw new Error(`OpenWeather API'sine erişim hatası: ${response.statusText}`);
    }

    const weatherData = await response.json();
    console.log(`[API] Successfully retrieved weather data from OpenWeather for ${cityName}`, JSON.stringify(weatherData).slice(0, 200) + '...');
    
    // OpenWeather'dan gelen veriyi daha kullanışlı bir formata dönüştür
    const formattedWeatherData = {
      current: {
        temperature: weatherData.main.temp,
        temperature_feel: weatherData.main.feels_like,
        humidity: weatherData.main.humidity,
        weather_code: weatherData.weather[0].id,
        weather_description: weatherData.weather[0].description,
        weather_main: weatherData.weather[0].main,
        wind_speed: weatherData.wind.speed,
        city_name: weatherData.name,
        country: weatherData.sys.country
      },
      forecast: {
        // Tek günlük veride tahmin yok, sadece mevcut bilgileri gönderiyoruz
        max_temp: weatherData.main.temp_max,
        min_temp: weatherData.main.temp_min,
        sunrise: new Date(weatherData.sys.sunrise * 1000).toISOString(),
        sunset: new Date(weatherData.sys.sunset * 1000).toISOString()
      }
    };
    
    return formattedWeatherData;
  } catch (error) {
    console.error(`[API] Error fetching weather data for ${cityName}:`, error instanceof Error ? error.message : JSON.stringify(error));
    console.error('[API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    throw error;
  }
}

export async function POST(req: Request) {
  const { messages, sessionId } = await req.json();

  try {
    // Log the initial request messages
    console.log('[CHAT API] Processing chat request with', messages.length, 'messages');
    console.log('[CHAT API] Request for session:', sessionId);
    console.log('[CHAT API] Last message content:', messages[messages.length - 1]?.content);
    
    // Check if DEEPSEEK_API_KEY exists
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.error('[CHAT API] Missing DEEPSEEK_API_KEY in environment variables');
      return new Response(
        JSON.stringify({ error: 'Missing API configuration' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    console.log('[CHAT API] DeepSeek API key found:', apiKey ? `${apiKey.substring(0, 5)}...` : 'Not found');
    
    // Formatlı mesajları oluştur
    const formattedMessages = messages.map((message: any) => ({
      role: message.role,
      content: message.content,
    }));
    
    // System mesajı ekle
    formattedMessages.unshift({
      role: "system",
      content: `Sen bir yapay zeka asistanısın. Kullanıcının sorularına kısa ve net cevaplar ver. 

Kullanıcı basit bir selamlaşma mesajı gönderdiğinde (örn. 'merhaba', 'selam', 'hello' vb.) sadece nazik bir karşılama mesajı ile yanıt ver, ek bilgi veya özellik tanıtımı yapma.

Depremlerle ilgili sorularda, kullanıcının mesajından lokasyon bilgisini tespit etmelisin:
1. Kullanıcı belirli bir yer (ülke, şehir, bölge) belirtmişse o lokasyon için veri getir.
2. Kullanıcı global veya dünya geneli için bilgi istiyorsa, "Turkey" lokasyonunu kullan ama yarıçapı 1000 km olarak ayarla.
3. Kullanıcı hiçbir yer belirtmemişse, "Turkey" lokasyonunu kullan ve normal yarıçapı (300 km) uygula.

Global, dünya, dünya geneli, tüm dünya gibi ifadeler gördüğünde, getEarthquake fonksiyonunda varsayılan olarak search_type=location, location="Turkey" ve radius=1000 parametrelerini kullan.

Kullanıcı özellikle sorduğunda hava durumu, deprem bilgisi, döviz kuru, kripto para ve hisse senedi bilgilerini sağlayabilirsin.

Kripto paralar için getCoin, hisse senetleri için getStock aracını kullanabilirsin.`
    });
    
    try {
      // Log available tools
      console.log('[CHAT API] Available tools:', {
        weather: getWeather ? 'Available' : 'Not found',
        earthquake: getEarthquake ? 'Available' : 'Not found',
        exchangeRate: getExchangeRate ? 'Available' : 'Not found',
        coin: getCoin ? 'Available' : 'Not found',
        stock: getStock ? 'Available' : 'Not found'
      });
      
      // DeepSeek model
      const deepseekModel = deepseek('deepseek-chat');
      console.log('[CHAT API] DeepSeek model initialized');
      
      console.log('[CHAT API] Using generateText to determine tool calls, then streamText for final response');
      
      // First call: Use generateText to potentially execute tools
      const initialResult = await generateText({
        model: deepseekModel,
        messages: formattedMessages as CoreMessage[],
        temperature: 0.7,
        tools: { getWeather, getEarthquake, getExchangeRate, getCoin, getStock },
      });
      
      // Check if the initial result included tool calls AND results
      if (initialResult.toolCalls.length > 0 && initialResult.toolResults.length > 0) {
        console.log('[CHAT API] Tools were called. Generating final response based on tool results.');
        
        // Construct the message history including tool interactions
        const messagesForFinalStream: CoreMessage[] = [
          ...formattedMessages as CoreMessage[],
          // Assistant message reporting the tool calls it decided to make
          {
            role: 'assistant',
            content: initialResult.toolCalls.map(toolCall => ({
              type: 'tool-call',
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              args: toolCall.args,
            })),
          },
          // Tool messages reporting the results of the tool calls
          ...initialResult.toolResults.map(toolResult => ({
            role: 'tool' as const,
            content: [
              {
                type: 'tool-result' as const,
                toolCallId: toolResult.toolCallId,
                toolName: toolResult.toolName,
                result: toolResult.result
              }
            ]
          })),
        ];

        // Log the tool results for debugging
        console.log('[CHAT API] Tool results:', initialResult.toolResults.map(tr => ({
          toolName: tr.toolName,
          resultSummary: tr.result ? typeof tr.result : 'null'
        })));
        
        // İkinci çağrı: streamsiz, düz JSON yanıt oluştur
        console.log('[CHAT API] Generating final NON-STREAMING response based on tool results');
        const finalResult = await generateText({
          model: deepseekModel,
          messages: messagesForFinalStream,
          temperature: 0.7,
        });
        
        console.log('[CHAT API] Final response generated, returning JSON response');
        
        // Format response to include tool results for UI components
        const response: any = { text: finalResult.text };
        
        // Check tool results and attach the appropriate data for UI components
        for (const toolResult of initialResult.toolResults) {
          if (toolResult.toolName === 'getWeather') {
            response.weather_data = toolResult.result;
          } else if (toolResult.toolName === 'getEarthquake') {
            response.earthquake_data = toolResult.result;
          } else if (toolResult.toolName === 'getExchangeRate') {
            // Process exchange rate data to ensure it's in the correct format
            const exchangeData = toolResult.result;
            
            // For conversion mode, format data specifically for the UI component
            if (exchangeData && exchangeData.mode === 'convert') {
              response.exchange_rate_data = {
                mode: 'convert',
                conversion: {
                  from: {
                    currency: exchangeData.conversion?.from?.currency || '',
                    amount: exchangeData.conversion?.from?.amount || 0
                  },
                  to: exchangeData.conversion?.to || {}
                },
                date: exchangeData.date || new Date().toISOString().split('T')[0]
              };
              
              // For conversion, preserve the original text to trigger simpleFormat
              let detectedFromAmount = 0;
              let detectedFromCurrency = '';
              let detectedToCurrency = '';
              
              // Try to extract conversion info from the text
              const text = finalResult.text || '';
              const matches = text.match(/(\d+(?:[,.]\d+)?)\s*([A-Z]{3})\s*(?:to|=|in)\s*([A-Z]{3})/i);
              
              if (matches && matches.length >= 4) {
                detectedFromAmount = parseFloat(matches[1].replace(',', '.'));
                detectedFromCurrency = matches[2].toUpperCase();
                detectedToCurrency = matches[3].toUpperCase();
                
                // Keep the text to ensure simpleFormat triggers
                response.text = finalResult.text;
              } else {
                response.text = "İşte döviz kuru bilgisi:";
              }
            }
            // Handle other exchange rate modes
            else if (exchangeData && exchangeData.rates) {
              response.exchange_rate_data = {
                base: exchangeData.base,
                date: exchangeData.date,
                rates: exchangeData.rates
              };
              response.text = "İşte döviz kuru bilgisi:";
            } 
            else if (exchangeData && exchangeData.data) {
              // Historical data format
              response.exchange_rate_data = exchangeData;
              response.text = "İşte tarihsel döviz kuru verileri:";
            }
            else if (typeof exchangeData === 'object') {
              // If none of the above, just pass through the raw data
              response.exchange_rate_data = exchangeData;
              response.text = "İşte döviz kuru bilgisi:";
            }
          } else if (toolResult.toolName === 'getCoin') {
            // Kripto para verilerini işle
            console.log('[CHAT API] Received coin data:', JSON.stringify(toolResult.result).substring(0, 200) + '...');
            response.coin_data = toolResult.result;
            response.text = "İşte kripto para bilgisi:";
          } else if (toolResult.toolName === 'getStock') {
            // Hisse senedi verilerini işle
            console.log('[CHAT API] Received stock data:', JSON.stringify(toolResult.result).substring(0, 200) + '...');
            response.stock_data = toolResult.result;
            response.text = "İşte hisse senedi bilgisi:";
          }
        }
        
        // Set simpler prompt text for non-exchange rate tools
        if (response.weather_data) {
          response.text = "İşte hava durumu bilgisi:";
        } else if (response.earthquake_data) {
          response.text = "İşte deprem bilgisi:";
        }
        
        // Log the final response structure
        console.log('[CHAT API] Response structure:', Object.keys(response));
        console.log('[CHAT API] Has coin data:', !!response.coin_data);
        console.log('[CHAT API] Has stock data:', !!response.stock_data);
        
        // ÖNEMLİ: Front-end için tüm yanıtı mesaj içeriği olarak JSON formatında gönder
        const finalResponseForClient = {
          text: response.text,
          content: JSON.stringify(response)
        };
        
        console.log('[CHAT API] Sending final JSON response to client');
        
        return new Response(
          JSON.stringify(finalResponseForClient), 
          { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      } else {
        console.log('[CHAT API] No tools called or issue with results. Returning raw text as JSON.');
        
        // Stream yerine düz JSON yanıt döndür
        const textToReturn = initialResult.text || "An unexpected error occurred.";
        return new Response(
          JSON.stringify({ text: textToReturn }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      
    } catch (error: any) {
      console.error('[CHAT API] Error with AI SDK:', error instanceof Error ? error.message : JSON.stringify(error));
      console.error('[CHAT API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      return new Response(
        JSON.stringify({ error: 'AI SDK error: ' + (error instanceof Error ? error.message : JSON.stringify(error)) }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  } catch (error) {
    console.error('[CHAT API] Error in chat API route:', error instanceof Error ? error.message : JSON.stringify(error));
    console.error('[CHAT API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return new Response(
      JSON.stringify({ error: 'Internal server error: ' + (error instanceof Error ? error.message : JSON.stringify(error)) }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}
