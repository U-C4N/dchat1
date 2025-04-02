import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { Session, Message, supabase } from './supabase/client';

interface ChatState {
  sessions: Session[];
  currentSessionId: string | null;
  messages: Record<string, Message[]>;
  isLoading: boolean;
  
  // Session actions
  setSessions: (sessions: Session[]) => void;
  createSession: () => Promise<string>;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, title: string) => Promise<void>;
  setCurrentSessionId: (id: string | null) => void;
  
  // Message actions
  addMessage: (
    sessionId: string, 
    content: string, 
    role: 'user' | 'assistant', 
    messageId?: string
  ) => Promise<void>;
  updateMessageContent: (sessionId: string, messageId: string, content: string) => Promise<void>;
  updateMessageResponseTime: (sessionId: string, messageId: string, responseTime: number) => Promise<void>;
  getMessages: (sessionId: string) => Promise<void>;
  setIsLoading: (loading: boolean) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: {},
  isLoading: false,
  
  setSessions: (sessions) => set({ sessions }),
  
  createSession: async () => {
    const newSession = {
      id: uuidv4(),
      title: 'New Chat',
      created_at: new Date().toISOString(),
    };
    
    const { error } = await supabase
      .from('sessions')
      .insert(newSession);
      
    if (error) {
      console.error('Error creating session:', error);
      throw error;
    }
    
    set((state) => ({
      sessions: [newSession, ...state.sessions],
      currentSessionId: newSession.id,
      messages: { ...state.messages, [newSession.id]: [] }
    }));
    
    return newSession.id;
  },
  
  deleteSession: async (id) => {
    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', id);
      
    if (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
    
    set((state) => {
      const newMessages = { ...state.messages };
      delete newMessages[id];
      
      const newSessions = state.sessions.filter((session) => session.id !== id);
      const newCurrentSessionId = 
        state.currentSessionId === id 
          ? (newSessions.length > 0 ? newSessions[0].id : null) 
          : state.currentSessionId;
          
      return {
        sessions: newSessions,
        currentSessionId: newCurrentSessionId,
        messages: newMessages,
      };
    });
  },
  
  renameSession: async (id, title) => {
    const { error } = await supabase
      .from('sessions')
      .update({ title })
      .eq('id', id);
      
    if (error) {
      console.error('Error renaming session:', error);
      throw error;
    }
    
    set((state) => ({
      sessions: state.sessions.map((session) => 
        session.id === id ? { ...session, title } : session
      ),
    }));
  },
  
  setCurrentSessionId: (id) => set({ currentSessionId: id }),
  
  addMessage: async (sessionId, content, role, messageId) => {
    const newMessage = {
      id: messageId || uuidv4(),
      session_id: sessionId,
      role,
      content,
      created_at: new Date().toISOString(),
      response_time: undefined
    };
    
    console.log(`Adding message to session ${sessionId}, id: ${newMessage.id}, role: ${role}`, newMessage);
    
    try {
      // Check if session exists before adding the message
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('id')
        .eq('id', sessionId)
        .single();
        
      if (sessionError) {
        console.error('Error checking session:', sessionError);
        throw new Error(`Session ${sessionId} does not exist or cannot be accessed`);
      }
      
      if (!sessionData) {
        console.error(`Session ${sessionId} not found in database`);
        throw new Error(`Session ${sessionId} not found in database`);
      }
      
      const { error, data } = await supabase
        .from('messages')
        .insert(newMessage)
        .select();
        
      if (error) {
        console.error('Error adding message:', error, JSON.stringify(error));
        throw error;
      }
      
      console.log('Message added successfully:', data);
      
      set((state) => {
        const sessionMessages = state.messages[sessionId] || [];
        return {
          messages: {
            ...state.messages,
            [sessionId]: [...sessionMessages, newMessage],
          },
        };
      });
    } catch (error) {
      console.error('Exception adding message:', error, JSON.stringify(error));
      throw error;
    }
  },
  
  updateMessageContent: async (sessionId, messageId, content) => {
    // First update UI state immediately for responsiveness
    set((state) => {
      const sessionMessages = state.messages[sessionId] || [];
      const updatedMessages = sessionMessages.map(msg => 
        msg.id === messageId ? { ...msg, content } : msg
      );
      
      return {
        messages: {
          ...state.messages,
          [sessionId]: updatedMessages,
        },
      };
    });
    
    // Then update database
    const { error } = await supabase
      .from('messages')
      .update({ content })
      .match({ id: messageId, session_id: sessionId });
      
    if (error) {
      console.error('Error updating message:', error);
    }
  },
  
  updateMessageResponseTime: async (sessionId, messageId, responseTime) => {
    console.log(`Updating response time for message ${messageId} to ${responseTime.toFixed(2)}s`);
    
    // First update UI state immediately for responsiveness
    set((state) => {
      const sessionMessages = state.messages[sessionId] || [];
      const updatedMessages = sessionMessages.map(msg => 
        msg.id === messageId ? { ...msg, response_time: responseTime } : msg
      );
      
      return {
        messages: {
          ...state.messages,
          [sessionId]: updatedMessages,
        },
      };
    });
    
    // Log the updated state to verify
    const updatedMsg = get().messages[sessionId]?.find(m => m.id === messageId);
    console.log(`After state update, message ${messageId} response_time:`, updatedMsg?.response_time);
    
    // Backend update is handled by separate direct call in Chat.tsx
  },
  
  getMessages: async (sessionId) => {
    console.log(`Fetching messages for session: ${sessionId}`);
    
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
      
    if (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
    
    set((state) => ({
      messages: {
        ...state.messages,
        [sessionId]: data || [],
      },
    }));
  },
  
  setIsLoading: (loading) => set({ isLoading: loading }),
}));