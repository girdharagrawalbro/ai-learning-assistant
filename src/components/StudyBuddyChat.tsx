import React, { useRef, useEffect, useState } from 'react';
import { Send, Bot, User, Sparkles, Loader2, BookOpen, Lightbulb, HelpCircle, ThumbsUp, ThumbsDown, Copy, RotateCcw, Plus, MessageSquare, Trash2, Clock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useApp } from '../context/AppContext';

const StudyBuddyChat: React.FC = () => {
  const { 
    user, 
    studyMaterials, 
    chatMessages, 
    isLoadingChat, 
    sendMessage,
    chatSessions,
    currentChatSession,
    createNewChat,
    loadChatSession,
    deleteChat,
    clearCurrentChat,
    loadUserChatSessions,
    pendingChatMessage,
    setPendingChatMessage
  } = useApp();
  const [inputMessage, setInputMessage] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load chat sessions when component mounts
  useEffect(() => {
    if (user) {
      loadUserChatSessions();
    }
  }, [user, loadUserChatSessions]);

  // Handle pending chat message from navigation
  useEffect(() => {
    if (pendingChatMessage) {
      setInputMessage(pendingChatMessage);
      setPendingChatMessage('');
      // Focus the input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [pendingChatMessage, setPendingChatMessage]);

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

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleNewChat = async () => {
    await createNewChat();
    setShowHistory(false);
  };

  const handleLoadSession = (session: typeof chatSessions[0]) => {
    loadChatSession(session);
    setShowHistory(false);
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteChat(sessionId);
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const quickPrompts = [
    { icon: <Lightbulb className="w-4 h-4" />, text: "Explain this concept simply", color: "bg-yellow-50 text-yellow-700 hover:bg-yellow-100" },
    { icon: <BookOpen className="w-4 h-4" />, text: "Help me understand my notes", color: "bg-blue-50 text-blue-700 hover:bg-blue-100" },
    { icon: <Sparkles className="w-4 h-4" />, text: "Give me study tips", color: "bg-purple-50 text-purple-700 hover:bg-purple-100" }
  ];

  return (
    <div className="flex h-full gap-4">
      {/* Chat History Sidebar */}
      {showHistory && (
        <div className="w-72 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Chat History</h3>
            <button
              onClick={handleNewChat}
              className="p-2 bg-purple-100 text-purple-600 hover:bg-purple-200 rounded-lg transition-colors"
              title="New Chat"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {chatSessions.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No chat history yet</p>
              </div>
            ) : (
              chatSessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => handleLoadSession(session)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors group ${
                    currentChatSession?.id === session.id
                      ? 'bg-purple-50 border border-purple-200'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {session.title}
                      </p>
                      <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(session.updatedAt)}</span>
                        <span>•</span>
                        <span>{session.messages.length} messages</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete chat"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                <HelpCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Ask Doubt</h2>
                <p className="text-xs text-gray-500">
                  {currentChatSession ? currentChatSession.title : 'New conversation'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`p-2 rounded-lg transition-colors ${
                  showHistory ? 'bg-purple-100 text-purple-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
                title="Chat history"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
              <div className="px-3 py-1.5 bg-green-50 rounded-lg flex items-center gap-1.5">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-green-700">Gemini AI</span>
              </div>
              <button
                onClick={handleNewChat}
                className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                title="New chat"
              >
                <Plus className="w-4 h-4" />
              </button>
              {chatMessages.length > 0 && (
                <button
                  onClick={clearCurrentChat}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Clear chat"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {chatMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-purple-500/30">
                <Bot className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                Hi{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}! 👋
              </h3>
              <p className="text-gray-600 mb-6 max-w-md text-sm">
                I'm your AI Study Assistant. Ask me anything about your courses, and I'll help you understand concepts, solve problems, and learn more effectively.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {quickPrompts.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => setInputMessage(prompt.text)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${prompt.color}`}
                  >
                    {prompt.icon}
                    {prompt.text}
                  </button>
                ))}
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
                      : 'bg-gradient-to-br from-purple-500 to-purple-600 text-white'
                  }`}
                >
                  {message.role === 'user' ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>
                <div className="max-w-[75%]">
                  <div
                    className={`rounded-2xl px-4 py-3 ${
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
                  {/* Message Actions */}
                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-1 mt-1 ml-1">
                      <button 
                        onClick={() => handleCopy(message.content)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Copy"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Good response">
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Bad response">
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          
          {isLoadingChat && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
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

        {/* Input Area */}
        <div className="border-t border-gray-100 p-4 bg-white">
          <div className="flex gap-3">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type your question here..."
              className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              rows={1}
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoadingChat}
              className="w-11 h-11 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white rounded-xl flex items-center justify-center transition-colors"
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
    </div>
  );
};

export default StudyBuddyChat;
