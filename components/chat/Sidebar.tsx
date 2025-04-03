import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useChatStore } from '@/lib/store';
import { Session } from '@/lib/supabase/client';
import { Edit2, Plus, Trash2, Check, X, MessageSquare } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

// Helper function to group sessions by date
const groupSessionsByDate = (sessions: Session[]) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);
  last7Days.setHours(0, 0, 0, 0);
  
  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);
  last30Days.setHours(0, 0, 0, 0);
  
  const todaySessions = sessions.filter(session => 
    new Date(session.created_at) >= today
  );
  
  const recent = sessions.filter(session => 
    new Date(session.created_at) >= last7Days && 
    new Date(session.created_at) < today
  );
  
  const older = sessions.filter(session => 
    new Date(session.created_at) < last7Days && 
    new Date(session.created_at) >= last30Days
  );
  
  return { todaySessions, recent, older };
};

interface SidebarProps {
  sessionId: string;
}

export function Sidebar({ sessionId }: SidebarProps) {
  const router = useRouter();
  const { sessions, createSession, deleteSession, renameSession } = useChatStore();
  
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { todaySessions, recent, older } = groupSessionsByDate(sessions);

  useEffect(() => {
    // Focus the input when editing starts
    if (editingSessionId && inputRef.current) {
      inputRef.current.focus();
      // Select all text
      inputRef.current.select();
    }
  }, [editingSessionId]);

  const handleCreateSession = async () => {
    const newSessionId = await createSession();
    router.push(`/${newSessionId}`);
  };

  const handleSelectSession = (selectedSessionId: string) => {
    // Don't navigate if we're currently editing
    if (editingSessionId) return;
    router.push(`/${selectedSessionId}`);
  };

  const handleDeleteSession = async (e: React.MouseEvent, selectedSessionId: string) => {
    e.stopPropagation();
    await deleteSession(selectedSessionId);
    
    // If we're deleting the current session, create a new one instead of just going to homepage
    if (selectedSessionId === sessionId) {
      const newSessionId = await createSession();
      router.push(`/${newSessionId}`);
    }
  };

  const handleStartRenaming = (e: React.MouseEvent, selectedSessionId: string) => {
    e.stopPropagation();
    setEditingSessionId(selectedSessionId);
    
    // We'll set the default value in the JSX for the input now
    // No state for tracking the text changes during typing
  };

  const handleSaveRename = async () => {
    if (editingSessionId && inputRef.current) {
      const newTitle = inputRef.current.value.trim();
      if (newTitle) {
        await renameSession(editingSessionId, newTitle);
      }
      setEditingSessionId(null);
    }
  };

  const handleCancelRename = () => {
    setEditingSessionId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveRename();
    } else if (e.key === 'Escape') {
      handleCancelRename();
    }
  };

  // Helper function to filter sessions that have messages
  const filterSessionsWithMessages = (sessions: Session[]) => {
    // Return all sessions without filtering - they all exist in the database
    return sessions;
    
    // Original filtering logic commented out:
    // const { messages } = useChatStore.getState();
    // 
    // return sessions.filter(session => {
    //   // Include the current active session always
    //   if (session.id === sessionId) return true;
    //   
    //   // Check if the session has any messages
    //   const sessionMessages = messages[session.id] || [];
    //   return sessionMessages.length > 0;
    // });
  };

  // Chat item component to avoid repetition
  const ChatItem = ({ session }: { session: Session }) => {
    const isEditing = session.id === editingSessionId;
    const isActive = session.id === sessionId && !isEditing;
    
    return (
      <div
        key={session.id}
        className={`py-2.5 px-3 rounded-lg cursor-pointer mb-1.5 group flex items-center justify-between transition-colors ${
          isActive 
            ? 'bg-black/90 text-white' 
            : 'hover:bg-white/60 text-gray-700'
        }`}
        onClick={() => handleSelectSession(session.id)}
      >
        <div className="flex items-center space-x-2.5 flex-1 min-w-0">
          <MessageSquare size={14} className={isActive ? 'text-white' : 'text-gray-400'} />
          
          {isEditing ? (
            <div className="flex-1 flex items-center space-x-1.5 min-w-0" onClick={(e) => e.stopPropagation()}>
              <input
                ref={inputRef}
                type="text"
                defaultValue={session.title}
                onKeyDown={handleKeyDown}
                className="flex-1 text-sm bg-white border border-gray-200 rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-black text-black min-w-0"
              />
              <div className="flex space-x-1 flex-shrink-0">
                <Button 
                  onClick={handleSaveRename} 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 hover:bg-gray-100 rounded-full"
                >
                  <Check size={14} className="text-green-500" />
                </Button>
                <Button 
                  onClick={handleCancelRename} 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 hover:bg-gray-100 rounded-full"
                >
                  <X size={14} className="text-gray-400" />
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium truncate flex-1 min-w-0">{session.title}</p>
              <div className={`flex space-x-1 ${isActive ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity flex-shrink-0`}>
                <Button 
                  onClick={(e) => handleStartRenaming(e, session.id)} 
                  variant="ghost" 
                  size="icon" 
                  className={`h-6 w-6 rounded-full ${isActive ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
                >
                  <Edit2 size={13} className={isActive ? 'text-white' : 'text-gray-500'} />
                </Button>
                <Button 
                  onClick={(e) => handleDeleteSession(e, session.id)} 
                  variant="ghost" 
                  size="icon" 
                  className={`h-6 w-6 rounded-full ${isActive ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
                >
                  <Trash2 size={13} className={isActive ? 'text-white' : 'text-gray-500'} />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-72 min-w-[250px] border-r border-gray-200 h-full flex flex-col bg-white/50 backdrop-blur-md text-gray-800">
      <div className="px-4 py-4 flex items-center justify-between border-b border-gray-200">
        <div className="flex items-center">
          <div className="flex items-center justify-center h-7 w-7 rounded-full bg-black text-white mr-2">
            <MessageSquare size={14} />
          </div>
          <h1 className="text-base font-medium text-gray-800">Chats</h1>
        </div>
        <Button 
          onClick={handleCreateSession} 
          variant="outline"
          size="sm"
          className="h-8 px-2 text-xs rounded-lg border-gray-200 hover:bg-gray-100 hover:border-gray-300 text-gray-800 bg-white/80"
        >
          <Plus size={14} className="mr-1" />
          New Chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto py-3 px-3 max-h-[calc(100vh-80px)]" data-component-name="Sidebar">
        {todaySessions.length > 0 && (
          <div className="mb-4">
            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium mb-2 px-2">Today</p>
            <div className="space-y-0.5">
              {filterSessionsWithMessages(todaySessions).map((session: Session) => (
                <ChatItem key={session.id} session={session} />
              ))}
            </div>
          </div>
        )}

        {recent.length > 0 && (
          <div className="mb-4">
            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium mb-2 px-2">LAST 7 DAYS</p>
            <div className="space-y-0.5">
              {filterSessionsWithMessages(recent).map((session: Session) => (
                <ChatItem key={session.id} session={session} />
              ))}
            </div>
          </div>
        )}

        {older.length > 0 && (
          <div className="mb-4">
            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium mb-2 px-2">Older</p>
            <div className="space-y-0.5">
              {filterSessionsWithMessages(older).map((session: Session) => (
                <ChatItem key={session.id} session={session} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}