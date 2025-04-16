import React, { useState, useRef, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, ArrowRight, Search, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

type ChatInputProps = {
  sessionId: string;
  onSend: (content: string) => void;
  isLoading: boolean;
};

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const [agiBetaActive, setAgiBetaActive] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!message.trim() || isLoading) return;
    
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
  
  const toggleDeepSearch = () => {
    setSearchActive(!searchActive);
    
    // Focus the textarea after toggling
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };
  
  const toggleAgiBeta = () => {
    setAgiBetaActive(!agiBetaActive);
    
    // Focus the textarea after toggling
    if (textareaRef.current) {
      textareaRef.current.focus();
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
          
          <div className="relative w-full">
            <textarea
              ref={textareaRef}
              placeholder={
                agiBetaActive 
                  ? "AGI Beta ile konuşun..." 
                  : searchActive 
                    ? "Derin araştırma yapın..." 
                    : "Mesaj gönder..."
              }
              value={message}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              className={cn(
                "flex min-h-[105px] max-h-[105px] w-full rounded-md border-2 bg-transparent px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-2 focus-visible:transition-colors focus-visible:duration-300 disabled:cursor-not-allowed disabled:opacity-50",
                "pl-12 pr-12 pb-14 overflow-hidden resize-none",
                agiBetaActive
                  ? "border-blue-400 focus-visible:border-blue-600 bg-blue-50/30"
                  : searchActive 
                    ? "border-amber-300 focus-visible:border-amber-500 bg-amber-50/30" 
                    : "border-blue-200 focus-visible:border-black"
              )}
              disabled={isLoading}
            />
            
            {/* Search Button Inside Textarea - Positioned to the right of paperclip */}
            <div className="absolute bottom-2 left-14 flex gap-2 z-10">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "rounded-full border flex items-center gap-1 px-4 py-1.5 transition-all shadow-sm",
                  searchActive 
                    ? "bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-800 ring-2 ring-amber-300 ring-opacity-50" 
                    : "bg-white hover:bg-gray-100 border-gray-200 text-gray-700 hover:border-gray-300"
                )}
                onClick={toggleDeepSearch}
              >
                <Search size={16} className={searchActive ? "text-amber-600 mr-1" : "text-gray-500 mr-1"} />
                <span className={cn(
                  "font-medium",
                  searchActive ? "text-amber-800" : "text-gray-700"
                )}>
                  Derin araştırma
                </span>
              </Button>
              
              {/* AGI Beta Button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "rounded-full border flex items-center gap-1 px-4 py-1.5 transition-all shadow-sm",
                  agiBetaActive 
                    ? "bg-blue-100 hover:bg-blue-200 border-blue-400 text-blue-700 ring-2 ring-blue-400 ring-opacity-50" 
                    : "bg-white hover:bg-gray-100 border-gray-200 text-gray-700 hover:border-gray-300"
                )}
                onClick={toggleAgiBeta}
              >
                <Sparkles size={16} className={agiBetaActive ? "text-blue-500 mr-1" : "text-gray-500 mr-1"} />
                <span className={cn(
                  "font-medium",
                  agiBetaActive ? "text-blue-700" : "text-gray-700"
                )}>
                  AGI Beta
                </span>
              </Button>
            </div>
          </div>
          
          <Button 
            type="submit"
            size="icon"
            disabled={isLoading || !message.trim()}
            className={cn(
              "absolute right-3 h-10 w-10 rounded-full z-10 flex items-center justify-center transition-colors",
              agiBetaActive
                ? "bg-blue-600 hover:bg-blue-700"
                : searchActive 
                  ? "bg-amber-500 hover:bg-amber-600"
                  : "bg-black hover:bg-gray-800"
            )}
          >
            <ArrowRight size={18} className="text-white" />
          </Button>
        </div>
      </form>
    </div>
  );
}
