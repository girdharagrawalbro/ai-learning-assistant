import React, { useRef, useEffect, useState } from 'react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Loader2,
  BookOpen,
  Flame,
  ClipboardList,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useApp } from '../context/AppContext';

const Dashboard: React.FC = () => {
  const { 
    user, 
    studyMaterials, 
    learningProgress, 
    setActiveTab,
    chatMessages,
    isLoadingChat,
    sendMessage
  } = useApp();
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoadingChat) return;

    const context = studyMaterials.length > 0
      ? studyMaterials.slice(0, 3).map(m => m.content).join('\n\n')
      : undefined;

    const message = inputMessage.trim();
    setInputMessage('');
    await sendMessage(message, context);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Stats from learning progress
  const stats = {
    streak: learningProgress?.streakDays || 0,
    quizzesCompleted: learningProgress?.totalQuizzesTaken || 0
  };

  // Generate suggested topics from study materials or defaults
  const suggestedTopics = studyMaterials.length > 0
    ? studyMaterials.slice(0, 3).map((m, i) => ({
        name: m.subject || m.title,
        color: ['bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700', 'bg-green-100 text-green-700'][i]
      }))
    : [
        { name: 'Upload your first study material', color: 'bg-blue-100 text-blue-700' },
        { name: 'Ask me anything', color: 'bg-purple-100 text-purple-700' },
        { name: 'Take a quiz', color: 'bg-green-100 text-green-700' }
      ];

  return (
    <div className="h-full flex gap-6">
      {/* Main Chat Section */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-800">
                Hello, {user?.displayName?.split(' ')[0] || 'Student'}!
              </h1>
              <p className="text-gray-500 text-sm">What do you want to learn today?</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 rounded-lg">
                <Flame className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-medium text-orange-600">30%</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-500" />
                <span className="text-sm text-gray-600">Starlance AI</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {chatMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Ask me anything about your studies!
              </h3>
              <p className="text-gray-500 text-sm max-w-md mb-6">
                I can help you understand concepts, solve problems, and create study materials.
              </p>
              
              {/* Example question */}
              <div className="bg-gray-50 rounded-xl p-4 max-w-lg w-full text-left">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-xs">?</span>
                  </div>
                  <span className="text-sm text-gray-600">Try asking:</span>
                </div>
                <p 
                  className="text-gray-800 cursor-pointer hover:text-blue-600 transition-colors"
                  onClick={() => setInputMessage("What is Newton's second law of motion?")}
                >
                  "What is Newton's second law of motion?"
                </p>
              </div>
            </div>
          ) : (
            chatMessages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 message-enter ${
                  message.role === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                  }`}
                >
                  {message.role === 'user' ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <div className="markdown-content prose prose-sm max-w-none">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                  )}
                </div>
              </div>
            ))
          )}
          
          {isLoadingChat && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-gray-100 rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot"></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Action Tags */}
        {chatMessages.length > 0 && (
          <div className="px-6 py-2 flex gap-2 flex-wrap">
            <button 
              onClick={() => setInputMessage("Explain common misconceptions about Newton's Laws")}
              className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-100 transition-colors flex items-center gap-1"
            >
              <AlertCircle className="w-3 h-3" />
              Proactive mistake-caught above
            </button>
            <button 
              onClick={() => setInputMessage("Give me examples of Newton's second law")}
              className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-xs font-medium hover:bg-orange-100 transition-colors"
            >
              Explore examples
            </button>
            <button 
              onClick={() => setInputMessage("Understand common misconceptions about Newton's Laws")}
              className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
            >
              Understand misconceptions
            </button>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-gray-100 p-4 bg-white">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask me anything..."
                className="w-full resize-none border border-gray-200 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                rows={1}
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoadingChat}
              className="w-11 h-11 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
            >
              {isLoadingChat ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Stats */}
      <div className="w-72 space-y-4 hidden xl:block">
        {/* Learning Overview Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-medium text-gray-600 mb-4">Your Learning Overview</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Flame className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{stats.streak}</p>
                  <p className="text-xs text-gray-500">days</p>
                </div>
              </div>
              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">streak</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{stats.quizzesCompleted}</p>
                  <p className="text-xs text-gray-500">quizzes</p>
                </div>
              </div>
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">completed</span>
            </div>
          </div>
        </div>

        {/* Suggested Topics */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-medium text-gray-600 mb-3">Suggested Topics</h3>
          <div className="space-y-2">
            {suggestedTopics.map((topic, index) => (
              <button
                key={index}
                onClick={() => setInputMessage(`Explain ${topic.name} to me`)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-80 ${topic.color}`}
              >
                {topic.name}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-medium text-gray-600 mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <button 
              onClick={() => setActiveTab('quiz')}
              className="w-full flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
            >
              <ClipboardList className="w-4 h-4" />
              Take a Quiz
            </button>
            <button 
              onClick={() => setActiveTab('revision')}
              className="w-full flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              Revision Mode
            </button>
            <button 
              onClick={() => setActiveTab('analytics')}
              className="w-full flex items-center gap-2 px-3 py-2 bg-cyan-50 text-cyan-700 rounded-lg text-sm font-medium hover:bg-cyan-100 transition-colors"
            >
              <TrendingUp className="w-4 h-4" />
              View Analytics
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
