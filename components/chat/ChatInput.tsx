import React, { useState, useRef, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, ArrowRight, Search, Sparkles, X, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { validateImageFile, createFilePreview } from '@/lib/supabase/storage';

type ChatInputProps = {
  sessionId: string;
  onSend: (content: string, attachments?: File[]) => void;
  isLoading: boolean;
};

interface ImagePreview {
  file: File;
  url: string;
  id: string;
}

export function ChatInput({ sessionId, onSend, isLoading }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const [agiBetaActive, setAgiBetaActive] = useState(false);
  const [imageAttachments, setImageAttachments] = useState<ImagePreview[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if ((!message.trim() && imageAttachments.length === 0) || isLoading) return;
    
    // Extract files from attachments
    const files = imageAttachments.map(att => att.file);
    
    onSend(message, files);
    
    // Clear the input and attachments
    setMessage('');
    setImageAttachments([]);
    setUploadError(null);
    
    // Focus the textarea for the next message
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && (message.trim() || imageAttachments.length > 0)) {
        const files = imageAttachments.map(att => att.file);
        onSend(message, files);
        setMessage('');
        setImageAttachments([]);
        setUploadError(null);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadError(null);

    // Check total file limit (3 max)
    if (imageAttachments.length + files.length > 3) {
      setUploadError('En fazla 3 resim yükleyebilirsiniz');
      return;
    }

    const validFiles: ImagePreview[] = [];

    for (const file of files) {
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setUploadError(validation.error || 'Geçersiz dosya');
        continue;
      }

      const preview: ImagePreview = {
        file,
        url: createFilePreview(file),
        id: Math.random().toString(36).substring(2)
      };
      validFiles.push(preview);
    }

    if (validFiles.length > 0) {
      setImageAttachments(prev => [...prev, ...validFiles]);
    }

    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setImageAttachments(prev => {
      const updated = prev.filter(att => att.id !== id);
      // Revoke object URL to prevent memory leaks
      const removed = prev.find(att => att.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.url);
      }
      return updated;
    });
    setUploadError(null);
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };
  
  const toggleDeepSearch = () => {
    const newSearchState = !searchActive;
    setSearchActive(newSearchState);
    
    // Eğer deep search açılıyorsa AGI'yi kapat
    if (newSearchState && agiBetaActive) {
      setAgiBetaActive(false);
    }
    
    // Focus the textarea after toggling
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };
  
  const toggleAgiBeta = () => {
    const newAgiState = !agiBetaActive;
    setAgiBetaActive(newAgiState);
    
    // Eğer AGI açılıyorsa deep search'i kapat
    if (newAgiState && searchActive) {
      setSearchActive(false);
    }
    
    // Focus the textarea after toggling
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Calculate dynamic textarea height based on content
  const hasAttachments = imageAttachments.length > 0;
  const textareaMinHeight = hasAttachments ? "60px" : "105px";
  const textareaMaxHeight = hasAttachments ? "60px" : "105px";

  return (
    <div className="p-0">
      <form onSubmit={handleSend} className="max-w-3xl mx-auto">
        <div className="relative flex flex-col backdrop-blur-xl bg-white rounded-md transition-colors">
          
          {/* Image Attachments Preview */}
          {imageAttachments.length > 0 && (
            <div className="p-3 border-b border-gray-200">
              <div className="flex gap-2 flex-wrap">
                {imageAttachments.map((attachment) => (
                  <div key={attachment.id} className="relative group">
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 border-2 border-gray-200">
                      <img
                        src={attachment.url}
                        alt={attachment.file.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment.id)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-1 rounded-b-lg truncate">
                      {attachment.file.name}
                    </div>
                  </div>
                ))}
                {imageAttachments.length < 3 && (
                  <button
                    type="button"
                    onClick={handleAttachClick}
                    className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <ImageIcon size={20} />
                  </button>
                )}
              </div>
              {uploadError && (
                <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                  {uploadError}
                </div>
              )}
            </div>
          )}

          {/* Input Area */}
          <div className="relative flex items-center">
            <Button 
              type="button" 
              variant="ghost" 
              size="icon"
              onClick={handleAttachClick}
              className="absolute left-3 h-10 w-10 z-10 text-gray-400 hover:text-gray-600 rounded-full"
            >
              <Paperclip className="h-5 w-5" />
            </Button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <div className="relative w-full">
              <textarea
                ref={textareaRef}
                placeholder={
                  agiBetaActive 
                    ? "Chat with AGI Beta..." 
                    : searchActive 
                      ? "Search with deep research..." 
                      : "Type a message..."
                }
                value={message}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                  minHeight: textareaMinHeight,
                  maxHeight: textareaMaxHeight,
                }}
                className={cn(
                  "flex w-full rounded-md border-2 bg-transparent px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-2 focus-visible:transition-colors focus-visible:duration-300 disabled:cursor-not-allowed disabled:opacity-50",
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
                    Deep Search
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
              disabled={isLoading || (!message.trim() && imageAttachments.length === 0)}
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
        </div>
      </form>
    </div>
  );
}
