import React, { useEffect, useState, useMemo } from 'react';
import {
  BarChart3,
  Clock,
  Target,
  Award,
  ChevronRight,
  Flame,
  BookOpen,
  Brain,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Zap
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line
} from 'recharts';
import { useApp } from '../context/AppContext';
import { getQuizAttempts, getQuizzes, getLearningProgress } from '../services/firebaseService';
import { QuizAttempt, Quiz } from '../types';
import { generateStudyRecommendations } from '../services/geminiService';

interface TopicPerformance {
  name: string;
  correct: number;
  total: number;
  percentage: number;
}

const Analytics: React.FC = () => {
  const { user, learningProgress, quizzes: contextQuizzes, setLearningProgress, navigateToChatWithMessage } = useApp();
  const [quizHistory, setQuizHistory] = useState<QuizAttempt[]>([]);
  const [allQuizzes, setAllQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<{ topic: string; action: string; icon: typeof BookOpen }[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'weakpoints' | 'reports'>('overview');

  useEffect(() => {
    if (user) {
      loadAnalyticsData();
    }
  }, [user]);

  const loadAnalyticsData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [attempts, quizzes, progress] = await Promise.all([
        getQuizAttempts(user.id),
        getQuizzes(user.id),
        getLearningProgress(user.id)
      ]);
      setQuizHistory(attempts);
      setAllQuizzes(quizzes.length > 0 ? quizzes : contextQuizzes);
      
      if (progress) {
        setLearningProgress(progress);
      }

      // Generate AI recommendations if we have progress data
      const progressData = progress || learningProgress;
      if (progressData && progressData.topics.length > 0) {
        const recs = await generateStudyRecommendations(
          progressData.topics,
          progressData.weakTopics,
          progressData.topics.slice(0, 5).map(t => t.topic)
        );
        setRecommendations(recs.slice(0, 3).map(r => ({
          topic: r.topic,
          action: r.reason,
          icon: r.priority === 'high' ? Target : r.priority === 'medium' ? Brain : BookOpen
        })));
      }
    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate real stats from data
  const stats = useMemo(() => {
    const studyTimeMinutes = learningProgress?.studyTimeTotal || 0;
    const hours = Math.floor(studyTimeMinutes / 60);
    const minutes = studyTimeMinutes % 60;
    
    return {
      studyTime: studyTimeMinutes > 0 ? `${hours}h ${minutes}m` : '0h 0m',
      quizzesTaken: learningProgress?.totalQuizzesTaken || quizHistory.length,
      avgScore: learningProgress?.averageScore || 0,
      streak: learningProgress?.streakDays || 0,
      totalQuestions: quizHistory.reduce((sum, a) => sum + a.totalQuestions, 0),
      correctAnswers: quizHistory.reduce((sum, a) => sum + a.score, 0)
    };
  }, [learningProgress, quizHistory]);

  // Calculate quizzes per day for the last 7 days
  const quizActivityData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const last7Days: { name: string; quizzes: number; date: Date }[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      last7Days.push({
        name: days[date.getDay()],
        quizzes: 0,
        date: date
      });
    }

    quizHistory.forEach(attempt => {
      const attemptDate = new Date(attempt.completedAt);
      last7Days.forEach(day => {
        if (
          attemptDate.getFullYear() === day.date.getFullYear() &&
          attemptDate.getMonth() === day.date.getMonth() &&
          attemptDate.getDate() === day.date.getDate()
        ) {
          day.quizzes++;
        }
      });
    });

    return last7Days.map(d => ({ name: d.name, quizzes: d.quizzes }));
  }, [quizHistory]);

  // Calculate topic performance from quiz data
  const topicPerformance = useMemo((): TopicPerformance[] => {
    const topicStats: Record<string, { correct: number; total: number }> = {};
    
    // Get all questions from quizzes and calculate performance
    const quizzesToAnalyze = allQuizzes.length > 0 ? allQuizzes : contextQuizzes;
    
    quizzesToAnalyze.forEach(quiz => {
      quiz.questions.forEach(q => {
        if (!topicStats[q.topic]) {
          topicStats[q.topic] = { correct: 0, total: 0 };
        }
        topicStats[q.topic].total++;
      });
    });

    // If we have learning progress topics, use their mastery levels
    if (learningProgress?.topics) {
      learningProgress.topics.forEach(t => {
        if (topicStats[t.topic]) {
          topicStats[t.topic].correct = Math.round((t.masteryLevel / 100) * topicStats[t.topic].total);
        }
      });
    }

    return Object.entries(topicStats)
      .map(([name, stats]) => ({
        name: name.length > 20 ? name.substring(0, 20) + '...' : name,
        correct: stats.correct,
        total: stats.total,
        percentage: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [allQuizzes, contextQuizzes, learningProgress]);

  // Performance pie chart data
  const performanceData = useMemo(() => {
    const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];
    
    if (topicPerformance.length === 0) {
      return [{ name: 'No data yet', value: 100, color: '#e5e7eb' }];
    }

    const total = topicPerformance.reduce((sum, t) => sum + t.total, 0);
    return topicPerformance.map((topic, index) => ({
      name: topic.name,
      value: total > 0 ? Math.round((topic.total / total) * 100) : 0,
      color: colors[index % colors.length]
    }));
  }, [topicPerformance]);

  // Key topics with trends
  const keyTopics = useMemo(() => {
    if (learningProgress?.topics && learningProgress.topics.length > 0) {
      return learningProgress.topics.slice(0, 5).map(t => ({
        name: t.topic.length > 20 ? t.topic.substring(0, 20) + '...' : t.topic,
        fullName: t.topic,
        progress: t.masteryLevel,
        trend: t.masteryLevel >= 50 ? 'up' : 'down' as 'up' | 'down',
        quizzesTaken: t.quizzesTaken
      }));
    }

    // Fallback to topic performance if no learning progress
    return topicPerformance.slice(0, 3).map(t => ({
      name: t.name,
      fullName: t.name,
      progress: t.percentage,
      trend: t.percentage >= 50 ? 'up' : 'down' as 'up' | 'down',
      quizzesTaken: 0
    }));
  }, [learningProgress, topicPerformance]);

  // Detailed weak topics analysis
  const weakTopicsAnalysis = useMemo(() => {
    if (!learningProgress?.topics) return [];
    
    return learningProgress.topics
      .filter(t => t.masteryLevel < 60)
      .sort((a, b) => a.masteryLevel - b.masteryLevel)
      .map(t => ({
        topic: t.topic,
        mastery: t.masteryLevel,
        quizzesTaken: t.quizzesTaken,
        lastStudied: t.lastStudied,
        improvement: t.quizzesTaken > 1 ? 'needs_practice' : 'new_topic'
      }));
  }, [learningProgress]);

  // Strong topics
  const strongTopicsAnalysis = useMemo(() => {
    if (!learningProgress?.topics) return [];
    
    return learningProgress.topics
      .filter(t => t.masteryLevel >= 70)
      .sort((a, b) => b.masteryLevel - a.masteryLevel)
      .slice(0, 5);
  }, [learningProgress]);

  // Daily performance data (last 7 days)
  const dailyPerformance = useMemo(() => {
    const days: { date: string; score: number; quizzes: number }[] = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toLocaleDateString('en-US', { weekday: 'short' });
      
      const dayAttempts = quizHistory.filter(a => {
        const attemptDate = new Date(a.completedAt);
        return attemptDate.toDateString() === date.toDateString();
      });
      
      const avgScore = dayAttempts.length > 0
        ? Math.round(dayAttempts.reduce((sum, a) => sum + (a.score / a.totalQuestions) * 100, 0) / dayAttempts.length)
        : 0;
      
      days.push({
        date: dateStr,
        score: avgScore,
        quizzes: dayAttempts.length
      });
    }
    
    return days;
  }, [quizHistory]);

  // Monthly performance data (last 30 days by week)
  const monthlyPerformance = useMemo(() => {
    const weeks: { week: string; score: number; quizzes: number }[] = [];
    const today = new Date();
    
    for (let w = 3; w >= 0; w--) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (w * 7) - 6);
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() - (w * 7));
      
      const weekAttempts = quizHistory.filter(a => {
        const attemptDate = new Date(a.completedAt);
        return attemptDate >= weekStart && attemptDate <= weekEnd;
      });
      
      const avgScore = weekAttempts.length > 0
        ? Math.round(weekAttempts.reduce((sum, a) => sum + (a.score / a.totalQuestions) * 100, 0) / weekAttempts.length)
        : 0;
      
      weeks.push({
        week: `Week ${4 - w}`,
        score: avgScore,
        quizzes: weekAttempts.length
      });
    }
    
    return weeks;
  }, [quizHistory]);

  // Suggested next steps from AI or fallback
  const suggestedNextSteps = useMemo(() => {
    if (recommendations.length > 0) {
      return recommendations;
    }

    // Fallback based on weak topics
    if (learningProgress?.weakTopics && learningProgress.weakTopics.length > 0) {
      return learningProgress.weakTopics.slice(0, 3).map(topic => ({
        topic,
        action: 'Needs more practice',
        icon: Target
      }));
    }

    // Default suggestions
    return [
      { topic: 'Upload study materials', action: 'Get started with learning', icon: BookOpen },
      { topic: 'Take a quiz', action: 'Test your knowledge', icon: Brain },
      { topic: 'Set daily goals', action: 'Stay consistent', icon: Target }
    ];
  }, [recommendations, learningProgress]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-cyan-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading your analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/30">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Your Learning Analytics</h2>
                <p className="text-xs text-gray-500">Track your progress and performance</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors">
                All time ▼
              </button>
              <div className="px-3 py-1.5 bg-green-50 rounded-lg flex items-center gap-1.5">
                <Target className="w-3 h-3 text-green-600" />
                <span className="text-xs font-medium text-green-700">Study Goal: 90%</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'overview'
                ? 'text-cyan-600 border-b-2 border-cyan-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('weakpoints')}
            className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'weakpoints'
                ? 'text-cyan-600 border-b-2 border-cyan-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Weak Points ({weakTopicsAnalysis.length})
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'reports'
                ? 'text-cyan-600 border-b-2 border-cyan-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Reports
          </button>
        </div>
      </div>

      {/* Stats Grid - Always visible */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats.studyTime}</p>
              <p className="text-xs text-gray-500">Study Time</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats.quizzesTaken}</p>
              <p className="text-xs text-gray-500">Quizzes Taken</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <Target className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats.avgScore}%</p>
              <p className="text-xs text-gray-500">Avg Score</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <Flame className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats.streak}</p>
              <p className="text-xs text-gray-500">Day Streak</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quiz Activity Chart */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Quiz Activity</h3>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                <span className="text-xs text-gray-500">Last 7 days</span>
              </div>
            </div>
            {quizActivityData.some(d => d.quizzes > 0) ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={quizActivityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#9ca3af" axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'white', 
                      border: '1px solid #e5e7eb', 
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value: number) => [`${value} quiz${value !== 1 ? 'zes' : ''}`, 'Quizzes']}
                  />
                  <Bar dataKey="quizzes" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">No quiz activity this week</p>
                  <p className="text-xs text-gray-400">Take some quizzes to see your activity</p>
                </div>
              </div>
            )}
          </div>

          {/* Key Topics */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Topic Mastery</h3>
            {keyTopics.length > 0 ? (
              <div className="space-y-4">
                {keyTopics.map((topic, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-2 h-2 rounded-full ${
                        topic.progress >= 70 ? 'bg-green-500' : topic.progress >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}></div>
                      <span className="text-sm text-gray-700 min-w-[120px]">{topic.name}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            topic.progress >= 70 ? 'bg-green-500' : topic.progress >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${topic.progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <span className="text-sm font-medium text-gray-800">{topic.progress}%</span>
                      {topic.trend === 'up' ? (
                        <ArrowUpRight className="w-4 h-4 text-green-500" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Brain className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No topics studied yet</p>
                <p className="text-xs text-gray-400">Take quizzes to track your topic mastery</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Performance Overview */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Topic Distribution</h3>
            <div className="relative">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={performanceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {performanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                <p className="text-2xl font-bold text-gray-800">{stats.avgScore}%</p>
                <p className="text-xs text-gray-500">Avg Score</p>
              </div>
            </div>
            
            {/* Legend */}
            <div className="mt-4 space-y-2">
              {performanceData.map((item, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-gray-600 text-xs">{item.name}</span>
                  </div>
                  <span className="font-medium text-gray-800">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Suggested Next Steps */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Suggested Next Steps</h3>
            <p className="text-xs text-gray-500 mb-3">Click any topic to learn more with AI</p>
            <div className="space-y-3">
              {suggestedNextSteps.map((step, index) => {
                const IconComponent = step.icon;
                return (
                  <div 
                    key={index} 
                    onClick={() => navigateToChatWithMessage(`I want to learn about ${step.topic}. ${step.action}. Please explain this topic in detail with examples.`)}
                    className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors cursor-pointer group"
                  >
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                      <IconComponent className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{step.topic}</p>
                      <p className="text-xs text-gray-500">{step.action}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Achievements Badge */}
          {stats.streak >= 7 && (
            <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl p-6 text-white">
              <div className="flex items-center gap-3 mb-3">
                <Award className="w-8 h-8" />
                <div>
                  <h3 className="font-semibold">Achievement Unlocked!</h3>
                  <p className="text-sm text-white/80">Week Warrior</p>
                </div>
              </div>
              <p className="text-sm text-white/80">
                You've studied for {stats.streak} days in a row! Keep up the great work.
              </p>
            </div>
          )}

          {stats.streak > 0 && stats.streak < 7 && (
            <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl p-6 text-white">
              <div className="flex items-center gap-3 mb-3">
                <Flame className="w-8 h-8" />
                <div>
                  <h3 className="font-semibold">{stats.streak} Day Streak!</h3>
                  <p className="text-sm text-white/80">{7 - stats.streak} more days to Week Warrior</p>
                </div>
              </div>
              <div className="h-2 bg-white/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white rounded-full transition-all"
                  style={{ width: `${(stats.streak / 7) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Weak Points Tab */}
      {activeTab === 'weakpoints' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Weak Topics List */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Topics Needing Improvement</h3>
                <p className="text-xs text-gray-500">Focus on these areas to improve your scores</p>
              </div>
            </div>
            
            {weakTopicsAnalysis.length > 0 ? (
              <div className="space-y-3">
                {weakTopicsAnalysis.map((topic, index) => (
                  <div key={index} className="p-4 bg-red-50 rounded-xl border border-red-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-800">{topic.topic}</span>
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                        topic.mastery < 30 ? 'bg-red-200 text-red-700' : 
                        topic.mastery < 50 ? 'bg-orange-200 text-orange-700' : 'bg-yellow-200 text-yellow-700'
                      }`}>
                        {topic.mastery}% mastery
                      </span>
                    </div>
                    <div className="h-2 bg-red-100 rounded-full overflow-hidden mb-2">
                      <div 
                        className="h-full bg-red-500 rounded-full transition-all"
                        style={{ width: `${topic.mastery}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{topic.quizzesTaken} quiz{topic.quizzesTaken !== 1 ? 'zes' : ''} taken</span>
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-orange-500" />
                        Needs practice
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Award className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-gray-600 font-medium">Great job!</p>
                <p className="text-sm text-gray-500">No weak topics detected. Keep up the good work!</p>
              </div>
            )}
          </div>

          {/* Strong Topics */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Your Strong Topics</h3>
                <p className="text-xs text-gray-500">Topics you've mastered</p>
              </div>
            </div>
            
            {strongTopicsAnalysis.length > 0 ? (
              <div className="space-y-3">
                {strongTopicsAnalysis.map((topic, index) => (
                  <div key={index} className="p-4 bg-green-50 rounded-xl border border-green-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-800">{topic.topic}</span>
                      <span className="px-2 py-1 bg-green-200 text-green-700 rounded-lg text-xs font-bold">
                        {topic.masteryLevel}% mastery
                      </span>
                    </div>
                    <div className="h-2 bg-green-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${topic.masteryLevel}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Brain className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 text-sm">Take more quizzes to identify your strong topics</p>
              </div>
            )}
          </div>

          {/* Improvement Suggestions */}
          <div className="lg:col-span-2 bg-gradient-to-r from-purple-600 to-purple-700 rounded-2xl p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <Brain className="w-8 h-8" />
              <div>
                <h3 className="font-semibold text-lg">AI Learning Recommendations</h3>
                <p className="text-sm text-purple-200">Based on your weak areas • Click to learn with AI</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {weakTopicsAnalysis.length > 0 ? (
                weakTopicsAnalysis.slice(0, 3).map((topic, index) => (
                  <div 
                    key={index} 
                    onClick={() => navigateToChatWithMessage(`I'm struggling with "${topic.topic}" and have ${topic.mastery}% mastery. Please help me understand this topic better with clear explanations, examples, and practice tips.`)}
                    className="bg-white/10 rounded-xl p-4 backdrop-blur-sm hover:bg-white/20 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium">{topic.topic}</p>
                      <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-sm text-purple-200">
                      {topic.mastery < 30 
                        ? 'Start with basic concepts and take practice quizzes'
                        : topic.mastery < 50 
                          ? 'Review key concepts and attempt more quizzes'
                          : 'Almost there! A few more practice sessions will help'}
                    </p>
                  </div>
                ))
              ) : (
                <div className="col-span-3 text-center py-4">
                  <p className="text-purple-200">Complete more quizzes to get personalized recommendations</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Daily Performance */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">Daily Performance Report</h3>
                  <p className="text-xs text-gray-500">Your scores over the last 7 days</p>
                </div>
              </div>
            </div>
            
            {dailyPerformance.some(d => d.quizzes > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={dailyPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'white', 
                      border: '1px solid #e5e7eb', 
                      borderRadius: '8px' 
                    }}
                    formatter={(value: number, name: string) => [
                      name === 'score' ? `${value}%` : value,
                      name === 'score' ? 'Avg Score' : 'Quizzes'
                    ]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">No quiz data for the last 7 days</p>
                </div>
              </div>
            )}
          </div>

          {/* Weekly/Monthly Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Weekly Breakdown</h3>
              <div className="space-y-4">
                {monthlyPerformance.map((week, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <span className="text-sm text-gray-500 w-16">{week.week}</span>
                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          week.score >= 70 ? 'bg-green-500' : 
                          week.score >= 50 ? 'bg-yellow-500' : 
                          week.score > 0 ? 'bg-red-500' : 'bg-gray-200'
                        }`}
                        style={{ width: `${week.score}%` }}
                      />
                    </div>
                    <div className="text-right w-24">
                      <span className="font-bold text-gray-800">{week.score}%</span>
                      <span className="text-xs text-gray-500 ml-1">({week.quizzes} quiz{week.quizzes !== 1 ? 'zes' : ''})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly Summary */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Monthly Summary</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-blue-600">
                    {monthlyPerformance.reduce((sum, w) => sum + w.quizzes, 0)}
                  </p>
                  <p className="text-xs text-gray-500">Quizzes This Month</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-green-600">
                    {monthlyPerformance.filter(w => w.quizzes > 0).length > 0 
                      ? Math.round(monthlyPerformance.filter(w => w.quizzes > 0).reduce((sum, w) => sum + w.score, 0) / monthlyPerformance.filter(w => w.quizzes > 0).length)
                      : 0}%
                  </p>
                  <p className="text-xs text-gray-500">Avg Monthly Score</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-purple-600">
                    {strongTopicsAnalysis.length}
                  </p>
                  <p className="text-xs text-gray-500">Topics Mastered</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-orange-600">
                    {weakTopicsAnalysis.length}
                  </p>
                  <p className="text-xs text-gray-500">Topics to Improve</p>
                </div>
              </div>
              
              {/* Study Time This Month */}
              <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-gray-500" />
                    <span className="text-sm text-gray-600">Total Study Time</span>
                  </div>
                  <span className="font-bold text-gray-800">{stats.studyTime}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
