import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useChatStore } from '@/lib/store';
import { Message, supabase } from '@/lib/supabase/client';
import { PanelLeftClose, PanelLeft, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ChatProps = {
  sessionId: string | null;
};

// Example queries for the buttons
const EXAMPLE_QUERIES = [
  {
    title: "What is the weather",
    subtitle: "in San Francisco?"
  },
  {
    title: "Show me earthquake data",
    subtitle: "for the last 24 hours"
  },
  {
    title: "Convert currency",
    subtitle: "100 USD to EUR"
  },
  {
    title: "Bitcoin price",
    subtitle: "and market information"
  },
  {
    title: "Show me stock data",
    subtitle: "for Tesla (TSLA)"
  }
];

export function Chat({ sessionId }: ChatProps) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { 
    messages,
    addMessage,
    getMessages,
    createSession,
    setCurrentSessionId,
    isLoading,
    setIsLoading,
    updateMessageContent,
    updateMessageResponseTime,
    renameSession
  } = useChatStore();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showExamples, setShowExamples] = useState(true);

  useEffect(() => {
    const initializeChat = async () => {
      if (!sessionId) {
        // If no sessionId is provided, create a new session and redirect
        const newSessionId = await createSession();
        router.push(`/${newSessionId}`);
        return;
      }
      
      // Set current session ID and fetch messages
      setCurrentSessionId(sessionId);
      await getMessages(sessionId);
    };
    
    initializeChat();
  }, [sessionId, createSession, setCurrentSessionId, getMessages, router]);

  useEffect(() => {
    // Scroll to bottom whenever messages change
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Hide examples when there are messages
    if (messages[sessionId || '']?.length > 0) {
      setShowExamples(false);
    } else {
      setShowExamples(true);
    }
  }, [messages, sessionId]);

  const handleSendMessage = async (content: string) => {
    if (!sessionId) return;
    
    // Check if this is the first message in the chat
    const isFirstMessage = !messages[sessionId] || messages[sessionId].length === 0;
    
    // Add user message to UI
    await addMessage(sessionId, content, 'user');
    
    // If this is the first message, update the chat title
    if (isFirstMessage) {
      // Use the first few words of the message as the title (max 25 chars)
      let title = content.trim().split(/\s+/).slice(0, 5).join(' ');
      if (title.length > 25) {
        title = title.substring(0, 22) + '...';
      }
      
      try {
        await renameSession(sessionId, title);
      } catch (e) {
        console.error('Failed to rename session:', e);
      }
    }
    
    // Set loading state
    setIsLoading(true);
    
    // Start timing the response
    const startTime = performance.now();
    let responseTime = 0;
    
    try {
      // Generate a temporary ID for the assistant's response
      const tempMessageId = crypto.randomUUID();
      
      // Add placeholder message for assistant's response
      await addMessage(sessionId, '', 'assistant', tempMessageId);
      
      // Prepare the API request body
      const requestBody = JSON.stringify({
        messages: [
          ...(messages[sessionId] || []).map((msg: Message) => ({
            role: msg.role,
            content: msg.content
          })),
          { 
            role: 'user', 
            content
          }
        ],
        sessionId
      });
      
      // Make the API request
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody,
      });
      
      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}`);
      }
      
      // Process the response as regular JSON (not streaming)
      const data = await response.json();
      
      // Calculate response time
      const endTime = performance.now();
      responseTime = (endTime - startTime) / 1000; // ms to seconds
      
      console.log(`Response time: ${responseTime.toFixed(2)}s`);
      console.log('Response data:', data);
      
      // Yeni API yanıt formatını kontrol et (content içeren veya içermeyen)
      let messageContent = '';
      if (data.content) {
        // Tam JSON yanıtı içerik olarak kullan 
        messageContent = data.content;
        console.log('Using full JSON content for message');
      } else if (data.weather_data || data.earthquake_data || data.exchange_rate_data || data.coin_data || data.stock_data) {
        // Uyumluluk için eski format - tüm JSON yanıtı al
        messageContent = JSON.stringify(data);
        console.log('Using legacy format JSON for message');
      } else {
        // Sadece metin yanıtı
        messageContent = data.text || '';
        console.log('Using text-only response');
      }
      
      // Update message with the response text
      await updateMessageContent(sessionId, tempMessageId, messageContent);
      
      // Update message with response time
      await updateMessageResponseTime(sessionId, tempMessageId, responseTime);
      
      // Update Supabase
      try {
        const { error } = await supabase
          .from('messages')
          .update({ 
            content: messageContent,
            response_time: responseTime 
          })
          .match({ id: tempMessageId, session_id: sessionId });
        
        if (error) {
          console.error('Supabase response update error:', error);
        } else {
          console.log('Response saved to database successfully');
        }
      } catch (e) {
        console.error('Failed to update response in database:', e);
      }
      
      // Scroll to the latest message
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (error) {
      console.error('Error in handleSendMessage:', error);
      
      // Add error message if one doesn't already exist
      const currentSessionMessages = messages[sessionId] || [];
      const hasErrorMessage = currentSessionMessages.some(msg => 
        msg.role === 'assistant' && msg.content.includes('Sorry, there was an error')
      );
      
      if (!hasErrorMessage) {
        await addMessage(
          sessionId,
          'Sorry, there was an error processing your request. Please try again.',
          'assistant'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleClick = (example: typeof EXAMPLE_QUERIES[0]) => {
    handleSendMessage(`${example.title} ${example.subtitle}`);
    setShowExamples(false);
  };

  // If no sessionId yet, show a loading state
  if (!sessionId) {
    return (
      <div className="flex items-center justify-center h-screen bg-foreground/5">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-gray-200 mb-3"></div>
          <div className="h-4 w-24 bg-gray-200 rounded-md"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-foreground/5 overflow-hidden">
      {/* Sidebar with proper toggle behavior */}
      {sidebarOpen && (
        <div className="h-full w-72 min-w-[250px] bg-foreground/5 border-r border-gray-100 shadow-sm transition-all duration-300 z-30 absolute md:relative">
          <Sidebar sessionId={sessionId} />
        </div>
      )}
      
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
        {/* Chat Header */}
        <div className="flex items-center px-5 py-4 bg-foreground/5 sticky top-0 z-20">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="mr-3 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
          </Button>
          <div className="flex items-center">
            <select className="rounded-md border bg-white hover:bg-gray-100 border-gray-200 text-gray-700 hover:border-gray-300 flex items-center px-4 py-1.5 transition-all shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50">
              <option value="gemini">Gemini 2.5 PRO</option>
              <option value="deepseek">Deepseek R1</option>
              <option value="starter">Starter (5 PDF + 10 YouTube + 5 Arvix)</option>
            </select>
          </div>
        </div>
        
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-6 bg-foreground/5">
          {showExamples && messages[sessionId]?.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full max-w-3xl mx-auto -mt-20">
              <div className="mb-8 flex items-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-full bg-black text-white">
                  <MessageSquare size={22} />
                </div>
              </div>
              
              <div className="w-full mb-10 px-4">
                <h2 className="text-center text-2xl font-medium text-black mb-3">
                  Welcome to Deuz AI
                </h2>
                <p className="text-center mb-6 text-gray-600 text-base leading-relaxed">
                  A multi-agent system with <span className="font-medium text-black">weather</span>, 
                  <span className="font-medium text-black"> earthquake</span>, and 
                  <span className="font-medium text-black"> currency</span> data capabilities
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full px-4">
                {EXAMPLE_QUERIES.map((example, index) => (
                  <button
                    key={index}
                    className="text-left p-5 bg-foreground/5 border border-gray-200 rounded-xl hover:border-black hover:shadow-sm transition-all duration-200"
                    onClick={() => handleExampleClick(example)}
                  >
                    <p className="font-medium text-black mb-1">{example.title}</p>
                    <p className="text-gray-500 text-sm">{example.subtitle}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {messages[sessionId]?.map((message: Message, index: number) => (
            <ChatMessage 
              key={message.id} 
              message={message} 
              isLoading={isLoading && index === messages[sessionId].length - 1 && message.role === 'assistant'}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input Area */}
        <div className="bg-foreground/5 sticky bottom-0 z-10 w-full p-4 md:p-5 border-l border-r border-gray-100">
          <ChatInput 
            sessionId={sessionId} 
            onSend={handleSendMessage} 
            isLoading={isLoading} 
          />
        </div>
      </div>
    </div>
  );
}