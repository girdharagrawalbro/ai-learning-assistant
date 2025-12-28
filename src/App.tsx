import React, { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import LandingPage from './components/LandingPage';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import StudyBuddyChat from './components/StudyBuddyChat';
import QuizGenerator from './components/QuizGenerator';
import RevisionMode from './components/RevisionMode';
import Analytics from './components/Analytics';
import { getStudyMaterials, getQuizzes, getLearningProgress, getChatSessions } from './services/firebaseService';
import { Loader2, Bot } from 'lucide-react';

const MainApp: React.FC = () => {
  const { 
    user, 
    activeTab, 
    setActiveTab,
    setStudyMaterials,
    setQuizzes,
    setLearningProgress,
    setChatSessions
  } = useApp();

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;
    
    try {
      const [materials, quizzes, progress, chatSessionsData] = await Promise.all([
        getStudyMaterials(user.id),
        getQuizzes(user.id),
        getLearningProgress(user.id),
        getChatSessions(user.id)
      ]);

      setStudyMaterials(materials);
      setQuizzes(quizzes);
      setChatSessions(chatSessionsData);
      if (progress) {
        setLearningProgress(progress);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'chat':
        return <StudyBuddyChat />;
      case 'quiz':
        return <QuizGenerator />;
      case 'revision':
        return <RevisionMode />;
      case 'analytics':
        return <Analytics />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar onNavigate={setActiveTab} />
      <main className="flex-1 overflow-auto">
        <div className="p-6 h-full">
          <div className="max-w-7xl mx-auto h-full">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { user, isLoading } = useApp();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800">
        <div className="text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <Loader2 className="w-8 h-8 text-white animate-spin mx-auto mb-4" />
          <p className="text-white/80">Loading your learning space...</p>
        </div>
      </div>
    );
  }

  return user ? <MainApp /> : <LandingPage />;
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
