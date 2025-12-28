import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { onAuthChange, signInWithGoogle, signOutUser, getChatSessions, saveChatSession, updateChatSession, deleteChatSession } from '../services/firebaseService';
import { User, LearningProgress, StudyMaterial, ChatSession, Quiz, ChatMessage } from '../types';

interface AppContextType {
  // Auth
  user: User | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  
  // Study Materials
  studyMaterials: StudyMaterial[];
  setStudyMaterials: React.Dispatch<React.SetStateAction<StudyMaterial[]>>;
  
  // Chat - Enhanced
  chatSessions: ChatSession[];
  setChatSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  currentChatSession: ChatSession | null;
  setCurrentChatSession: React.Dispatch<React.SetStateAction<ChatSession | null>>;
  chatMessages: ChatMessage[];
  chatHistory: { role: 'user' | 'model'; parts: { text: string }[] }[];
  isLoadingChat: boolean;
  
  // Chat Actions
  sendMessage: (content: string, context?: string) => Promise<void>;
  createNewChat: (title?: string) => Promise<void>;
  loadChatSession: (session: ChatSession) => void;
  deleteChat: (sessionId: string) => Promise<void>;
  clearCurrentChat: () => void;
  loadUserChatSessions: () => Promise<void>;
  
  // Quizzes
  quizzes: Quiz[];
  setQuizzes: React.Dispatch<React.SetStateAction<Quiz[]>>;
  
  // Learning Progress
  learningProgress: LearningProgress | null;
  setLearningProgress: React.Dispatch<React.SetStateAction<LearningProgress | null>>;
  
  // UI State
  activeTab: string;
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Pending message for chat navigation
  pendingChatMessage: string;
  setPendingChatMessage: React.Dispatch<React.SetStateAction<string>>;
  navigateToChatWithMessage: (message: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [studyMaterials, setStudyMaterials] = useState<StudyMaterial[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentChatSession, setCurrentChatSession] = useState<ChatSession | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model'; parts: { text: string }[] }[]>([]);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [learningProgress, setLearningProgress] = useState<LearningProgress | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pendingChatMessage, setPendingChatMessage] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthChange((fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        setUser({
          id: fbUser.uid,
          email: fbUser.email || '',
          displayName: fbUser.displayName || 'Student',
          photoURL: fbUser.photoURL || undefined,
          createdAt: new Date(),
          lastLoginAt: new Date()
        });
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Load chat sessions when user logs in
  const loadUserChatSessions = useCallback(async () => {
    if (!user) return;
    try {
      const sessions = await getChatSessions(user.id);
      setChatSessions(sessions);
    } catch (error) {
      console.error('Error loading chat sessions:', error);
    }
  }, [user]);

  // Send a message in the current chat
  const sendMessage = useCallback(async (content: string, context?: string) => {
    if (!user || !content.trim()) return;
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
      context
    };

    // Add user message to state immediately
    setChatMessages(prev => [...prev, userMessage]);
    setIsLoadingChat(true);

    try {
      // Import geminiService dynamically to avoid circular deps
      const { chatWithStudyBuddy } = await import('../services/geminiService');
      
      const response = await chatWithStudyBuddy(
        userMessage.content,
        context,
        chatHistory
      );

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };

      const updatedMessages = [...chatMessages, userMessage, assistantMessage];
      setChatMessages(updatedMessages);
      
      // Update chat history for Gemini context
      setChatHistory(prev => [
        ...prev,
        { role: 'user', parts: [{ text: userMessage.content }] },
        { role: 'model', parts: [{ text: response }] }
      ]);

      // Save/update session in Firestore
      if (currentChatSession) {
        // Update existing session
        await updateChatSession(currentChatSession.id, {
          messages: updatedMessages,
          updatedAt: new Date()
        });
        setCurrentChatSession(prev => prev ? { ...prev, messages: updatedMessages, updatedAt: new Date() } : null);
      } else {
        // Create new session
        const title = userMessage.content.slice(0, 50) + (userMessage.content.length > 50 ? '...' : '');
        const newSession: Omit<ChatSession, 'id'> = {
          userId: user.id,
          title,
          messages: updatedMessages,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        const sessionId = await saveChatSession(newSession);
        const savedSession: ChatSession = { ...newSession, id: sessionId };
        setCurrentChatSession(savedSession);
        setChatSessions(prev => [savedSession, ...prev]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm sorry, I encountered an error. Please try again.",
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoadingChat(false);
    }
  }, [user, chatHistory, chatMessages, currentChatSession]);

  // Create a new chat session
  const createNewChat = useCallback(async (_title?: string) => {
    setChatMessages([]);
    setChatHistory([]);
    setCurrentChatSession(null);
  }, []);

  // Load an existing chat session
  const loadChatSession = useCallback((session: ChatSession) => {
    setCurrentChatSession(session);
    setChatMessages(session.messages);
    // Rebuild chat history from messages
    const history = session.messages.map(msg => ({
      role: (msg.role === 'user' ? 'user' : 'model') as 'user' | 'model',
      parts: [{ text: msg.content }]
    }));
    setChatHistory(history);
  }, []);

  // Delete a chat session
  const deleteChat = useCallback(async (sessionId: string) => {
    try {
      await deleteChatSession(sessionId);
      setChatSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentChatSession?.id === sessionId) {
        setChatMessages([]);
        setChatHistory([]);
        setCurrentChatSession(null);
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  }, [currentChatSession]);

  // Clear current chat without deleting from Firestore
  const clearCurrentChat = useCallback(() => {
    setChatMessages([]);
    setChatHistory([]);
    setCurrentChatSession(null);
  }, []);

  const signIn = async () => {
    setIsLoading(true);
    try {
      const userData = await signInWithGoogle();
      if (userData) {
        setUser(userData);
      }
    } catch (error) {
      console.error('Sign in error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    await signOutUser();
    setUser(null);
    setStudyMaterials([]);
    setChatSessions([]);
    setCurrentChatSession(null);
    setChatMessages([]);
    setChatHistory([]);
    setQuizzes([]);
    setLearningProgress(null);
  };

  // Navigate to chat with a pre-filled message
  const navigateToChatWithMessage = useCallback((message: string) => {
    setPendingChatMessage(message);
    setActiveTab('chat');
  }, []);

  const value: AppContextType = {
    user,
    firebaseUser,
    isLoading,
    signIn,
    signOut,
    studyMaterials,
    setStudyMaterials,
    chatSessions,
    setChatSessions,
    currentChatSession,
    setCurrentChatSession,
    chatMessages,
    chatHistory,
    isLoadingChat,
    sendMessage,
    createNewChat,
    loadChatSession,
    deleteChat,
    clearCurrentChat,
    loadUserChatSessions,
    quizzes,
    setQuizzes,
    learningProgress,
    setLearningProgress,
    activeTab,
    setActiveTab,
    sidebarOpen,
    setSidebarOpen,
    pendingChatMessage,
    setPendingChatMessage,
    navigateToChatWithMessage
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
