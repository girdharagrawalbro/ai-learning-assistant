// Type definitions for the AI Learning Assistant

export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: Date;
  lastLoginAt: Date;
}

export interface StudyMaterial {
  id: string;
  userId: string;
  title: string;
  content: string;
  subject: string;
  uploadedAt: Date;
  type: 'notes' | 'textbook' | 'lecture' | 'article';
  tags: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  context?: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  subject?: string;
}

export interface Quiz {
  id: string;
  userId: string;
  title: string;
  subject: string;
  questions: QuizQuestion[];
  createdAt: Date;
  sourceContent?: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  topic: string;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  answers: number[];
  score: number;
  totalQuestions: number;
  completedAt: Date;
  timeSpent: number; // in seconds
}

export interface LearningProgress {
  userId: string;
  topics: TopicProgress[];
  totalQuizzesTaken: number;
  averageScore: number;
  streakDays: number;
  lastStudyDate: Date;
  studyTimeTotal: number; // in minutes
  weakTopics: string[];
  strongTopics: string[];
}

export interface TopicProgress {
  topic: string;
  subject: string;
  masteryLevel: number; // 0-100
  quizzesTaken: number;
  averageScore: number;
  lastStudied: Date;
  conceptsCovered: string[];
}

export interface StudyRecommendation {
  topic: string;
  subject: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  suggestedResources: string[];
  estimatedTime: number; // in minutes
}

export interface DailyGoal {
  id: string;
  userId: string;
  date: Date;
  targetStudyTime: number; // in minutes
  actualStudyTime: number;
  targetQuizzes: number;
  completedQuizzes: number;
  topics: string[];
  completed: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: Date;
  progress?: number;
  requirement: number;
}
  
// PDF Content Storage for quiz generation and revision
export interface StoredContent {
  id: string;
  userId: string;
  title: string;
  fileName: string;
  content: string; // Full extracted text from PDF
  summary?: string; // AI-generated summary
  topics: ExtractedTopic[];
  createdAt: Date;
  lastRevisedAt?: Date;
  fileType: 'pdf' | 'doc' | 'docx' | 'txt';
}

export interface ExtractedTopic {
  id: string;
  name: string;
  content: string; // Key points about this topic
  keyTerms: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  masteryLevel: number; // 0-100 based on quiz performance
  quizCount: number;
  lastQuizScore?: number;
}

// Revision Schedule
export interface RevisionSchedule {
  id: string;
  userId: string;
  contentId: string;
  topicId: string;
  topicName: string;
  scheduleType: 'daily' | 'weekly' | 'monthly';
  nextReviewDate: Date;
  lastReviewDate?: Date;
  reviewCount: number;
  masteryLevel: number;
  interval: number; // days until next review (spaced repetition)
  easeFactor: number; // SM-2 algorithm ease factor
}

// Mock Test for comprehensive testing
export interface MockTest {
  id: string;
  userId: string;
  title: string;
  topics: string[];
  sourceContents: string[]; // content IDs used
  questions: QuizQuestion[];
  duration: number; // in minutes
  createdAt: Date;
  scheduledFor?: Date;
  completedAt?: Date;
  score?: number;
}
