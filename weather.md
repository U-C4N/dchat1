# Weather Tool Implementasyonu

Bu dokümanda, chat uygulamasına hava durumu aracının nasıl entegre edildiğini teknik olarak açıklıyoruz ve sıfırdan nasıl yapabileceğinizi anlatıyoruz.

## Genel Bakış

Weather tool implementasyonu iki ana bileşenden oluşur:

1. **Backend Tool API** (`lib/ai/tools/get-weather.ts`): Vercel AI SDK'sı kullanılarak tanımlanan ve açık hava durumu API'sine bağlanan bir araç.
2. **Frontend Component** (`components/weather.tsx`): Hava durumu verilerini görselleştiren bir React bileşeni.

## 1. Backend Tool API Implementasyonu

Backend tarafında, Vercel AI SDK'sının `tool` fonksiyonu kullanılarak hava durumu aracı şu şekilde tanımlanır:

```typescript
// lib/ai/tools/get-weather.ts
import { tool } from 'ai';
import { z } from 'zod';

export const getWeather = tool({
  description: 'Get the current weather at a location',
  parameters: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  execute: async ({ latitude, longitude }) => {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`,
    );

    const weatherData = await response.json();
    return weatherData;
  },
});
```

Bu kodda:
- `tool` fonksiyonu, AI chat modeline bir araç oluşturur
- `z` (Zod kütüphanesi) ile parametreler doğrulanır
- `execute` fonksiyonu, Open-Meteo API'sine istek atarak hava durumu verilerini alır

## 2. Frontend Component Implementasyonu

Frontend tarafında, hava durumu verilerini görselleştirmek için bir React bileşeni oluşturulur:

```typescript
// components/weather.tsx (özet)
'use client';

import cx from 'classnames';
import { format, isWithinInterval } from 'date-fns';
import { useEffect, useState } from 'react';

// Weather verileri için type tanımı
interface WeatherAtLocation {
  // Hava durumu API'sinden gelen veri yapısı
  latitude: number;
  longitude: number;
  timezone: string;
  current: {
    time: string;
    interval: number;
    temperature_2m: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
  };
  daily: {
    time: string[];
    sunrise: string[];
    sunset: string[];
  };
  // ... diğer veri alanları
}

// Weather bileşeni
export function Weather({
  weatherAtLocation,
}: {
  weatherAtLocation?: WeatherAtLocation;
}) {
  // Bileşen, API'den gelen hava durumu verilerini
  // kullanıcı dostu bir arayüzle gösterir
  return (
    <div className="...">
      {/* Sıcaklık, gün doğumu/batımı bilgileri, saat bazlı veriler vb. */}
    </div>
  );
}
```

## 3. Chat API ile Entegrasyon

Bu bileşenleri chat uygulamasına entegre etmek için:

1. **AI Modelinin Araçları Kullanabilmesi:**

```typescript
// app/api/chat/route.ts
import { getWeather } from '@/lib/ai/tools/get-weather';
import { StreamingTextResponse, Message } from 'ai';
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages,
    temperature: 0.7,
    stream: true,
    tools: [getWeather], // Weather aracını ekleyerek AI'ın bunu kullanmasını sağlamak
  });

  // Yanıtı stream olarak döndür
  return new StreamingTextResponse(response.body);
}
```

2. **Tool Çağrı Yanıtlarını İşleme:**

```typescript
// components/chat.tsx
import { useChat } from 'ai/react';
import { Weather } from './weather';

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();

  return (
    <div>
      {messages.map(message => {
        // Tool yanıtlarını işle
        if (message.role === 'assistant' && message.content.includes('weather_data')) {
          const weatherData = JSON.parse(message.content).weather_data;
          return <Weather weatherAtLocation={weatherData} />;
        }
        
        return <div>{message.content}</div>;
      })}
      
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Hava durumunu sormak için mesaj yazın..."
        />
        <button type="submit">Gönder</button>
      </form>
    </div>
  );
}
```

## Sıfırdan İmplementasyon Adımları

Hava durumu aracını sıfırdan implementasyon için şu adımları izleyebilirsiniz:

### 1. Gerekli Paketleri Yükleme

```bash
npm install ai openai zod date-fns
# veya
yarn add ai openai zod date-fns
```

### 2. Backend Tool Tanımı

1. `lib/ai/tools` dizinini oluşturun
2. `get-weather.ts` dosyasını oluşturun ve getWeather aracını tanımlayın:

```typescript
import { tool } from 'ai';
import { z } from 'zod';

export const getWeather = tool({
  description: 'Get the current weather at a location',
  parameters: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  execute: async ({ latitude, longitude }) => {
    // Ücretsiz Open-Meteo API'si kullanılıyor, API key gerektirmiyor
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`,
    );

    const weatherData = await response.json();
    return weatherData;
  },
});
```

### 3. Frontend Weather Bileşeni

1. `components` dizininde `weather.tsx` dosyasını oluşturun:

```typescript
'use client';

import { format } from 'date-fns';
import { useState } from 'react';

// Hava durumu veri tipi tanımlaması
interface WeatherAtLocation {
  // Temel veri alanları
  latitude: number;
  longitude: number;
  timezone: string;
  current: {
    time: string;
    temperature_2m: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
  };
  daily: {
    time: string[];
    sunrise: string[];
    sunset: string[];
  };
}

export function Weather({ weatherAtLocation }: { weatherAtLocation?: WeatherAtLocation }) {
  if (!weatherAtLocation) return null;

  // Şu anki sıcaklık
  const currentTemp = weatherAtLocation.current.temperature_2m;
  // Günlük veriler
  const today = new Date().toISOString().split('T')[0];
  const todayIndex = weatherAtLocation.daily.time.findIndex(d => d === today);
  
  // Gün doğumu/batımı
  const sunrise = todayIndex >= 0 ? weatherAtLocation.daily.sunrise[todayIndex] : '';
  const sunset = todayIndex >= 0 ? weatherAtLocation.daily.sunset[todayIndex] : '';

  return (
    <div className="bg-white rounded-lg p-4 shadow-md max-w-md">
      <h2 className="text-xl font-semibold mb-2">Hava Durumu</h2>
      <p className="text-gray-600">
        Konum: {weatherAtLocation.latitude.toFixed(2)}, {weatherAtLocation.longitude.toFixed(2)}
      </p>
      <p className="text-3xl font-bold my-4">{currentTemp}°C</p>
      
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-blue-50 p-2 rounded">
          <div className="text-sm text-gray-500">Gün Doğumu</div>
          <div>{sunrise ? format(new Date(sunrise), 'HH:mm') : '-'}</div>
        </div>
        <div className="bg-orange-50 p-2 rounded">
          <div className="text-sm text-gray-500">Gün Batımı</div>
          <div>{sunset ? format(new Date(sunset), 'HH:mm') : '-'}</div>
        </div>
      </div>
      
      {/* Saatlik sıcaklık grafiği/listesi burada eklenebilir */}
    </div>
  );
}
```

### 4. Chat API'ye Tool Entegrasyonu

1. `app/api/chat/route.ts` (Next.js API route) dosyasını oluşturun:

```typescript
import { getWeather } from '@/lib/ai/tools/get-weather';
import { OpenAIStream, StreamingTextResponse } from 'ai';
import { Configuration, OpenAIApi } from 'openai-edge';

// OpenAI konfigürasyonu
const config = new Configuration({
  apiKey: process.env.OPENAI_API_KEY!
});
const openai = new OpenAIApi(config);

export async function POST(req: Request) {
  const { messages } = await req.json();

  // OpenAI API çağrısı
  const response = await openai.createChatCompletion({
    model: 'gpt-4-turbo',
    messages,
    temperature: 0.7,
    stream: true,
    tools: [
      {
        type: 'function',
        function: {
          name: 'getWeather',
          description: 'Get current weather at a location',
          parameters: {
            type: 'object',
            properties: {
              latitude: { type: 'number' },
              longitude: { type: 'number' }
            },
            required: ['latitude', 'longitude']
          }
        }
      }
    ],
    tool_choice: 'auto'
  });

  // AI'dan gelen stream'i işle
  const stream = OpenAIStream(response, {
    async onToolCall(tool) {
      // getWeather aracı çağrıldığında
      if (tool.name === 'getWeather') {
        const { latitude, longitude } = tool.arguments;
        // Weather aracını çağır ve verileri al
        return getWeather.execute({ latitude, longitude });
      }
    }
  });

  return new StreamingTextResponse(stream);
}
```

### 5. Chat Bileşenini Güncelleme

Chat bileşenini, hava durumu aracı yanıtlarını gösterecek şekilde güncelleyin:

```typescript
'use client';

import { useChat } from 'ai/react';
import { Weather } from './weather';
import { useState } from 'react';

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();
  const [weatherData, setWeatherData] = useState(null);

  // Tool çağrılarından gelen verileri işle
  const processMessages = () => {
    for (const message of messages) {
      if (message.role === 'assistant' && message.tool_calls) {
        // Tool çağrılarını bul
        for (const toolCall of message.tool_calls) {
          if (toolCall.function.name === 'getWeather') {
            // getWeather dönüş verileri varsa bunları kaydet
            if (toolCall.function.response) {
              setWeatherData(JSON.parse(toolCall.function.response));
            }
          }
        }
      }
    }
  };

  // Mesajlar değiştiğinde çağrıları işle
  useEffect(() => {
    processMessages();
  }, [messages]);

  return (
    <div className="flex flex-col h-full max-w-xl mx-auto">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message, i) => (
          <div key={i} className={`mb-4 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
            <div className={`inline-block p-2 rounded-lg ${
              message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}>
              {message.content}
            </div>
          </div>
        ))}
        
        {/* Hava durumu verileri varsa göster */}
        {weatherData && <Weather weatherAtLocation={weatherData} />}
      </div>
      
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex">
          <input
            className="flex-1 border rounded-l-lg px-3 py-2"
            value={input}
            onChange={handleInputChange}
            placeholder="Hava durumunu sormak için mesaj yazın..."
          />
          <button 
            type="submit"
            className="bg-blue-500 text-white rounded-r-lg px-4 py-2"
          >
            Gönder
          </button>
        </form>
      </div>
    </div>
  );
}
```

## Özet

Hava durumu aracı, Vercel AI SDK'sının sağladığı tool desteği kullanılarak chat uygulamanıza kolayca entegre edilebilir. Bu entegrasyonun temel bileşenleri:

1. Backend tarafında `tool` fonksiyonu ile tanımlanan ve Open-Meteo API'sine bağlanan bir araç
2. Frontend tarafında hava durumu verilerini görselleştiren bir React bileşeni
3. Chat API'si ile aracın entegrasyonu ve tool çağrılarını işlemek için gerekli yapılandırma

Bu yaklaşım, diğer API'lere dayalı araçlar için de bir şablon olarak kullanılabilir.
