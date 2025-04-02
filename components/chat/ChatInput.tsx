import { useState, useRef, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, ArrowRight } from 'lucide-react';
import { useChatStore } from '@/lib/store';
import { cn } from '@/lib/utils';

type ChatInputProps = {
  sessionId: string;
  onSend: (content: string) => void;
  isLoading: boolean;
};

export function ChatInput({ sessionId, onSend, isLoading }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!message.trim() || isLoading) return;
    
    // Send the message
    onSend(message);
    
    // Clear the input
    setMessage('');
    
    // Focus the textarea for the next message
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && message.trim()) {
        onSend(message);
        setMessage('');
      }
    }
  };

  return (
    <div className="p-0">
      <form onSubmit={handleSend} className="max-w-3xl mx-auto">
        <div className="relative flex items-center backdrop-blur-xl bg-white rounded-md transition-colors">
          <Button 
            type="button" 
            variant="ghost" 
            size="icon"
            className="absolute left-3 h-10 w-10 z-10 text-gray-400 hover:text-gray-600 rounded-full"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          
          <textarea
            ref={textareaRef}
            placeholder="Send a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              "flex min-h-[105px] max-h-[105px] w-full rounded-md border-2 border-blue-200 bg-transparent px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-2 focus-visible:border-black focus-visible:transition-colors focus-visible:duration-300 disabled:cursor-not-allowed disabled:opacity-50",
              "pl-12 pr-12 overflow-hidden resize-none"
            )}
            disabled={isLoading}
          />
          
          <Button 
            type="submit"
            size="icon"
            disabled={isLoading || !message.trim()}
            className="absolute right-3 h-10 w-10 rounded-full bg-black hover:bg-gray-800 z-10 flex items-center justify-center transition-colors"
          >
            <ArrowRight size={18} className="text-white" />
          </Button>
        </div>
      </form>
    </div>
  );
}