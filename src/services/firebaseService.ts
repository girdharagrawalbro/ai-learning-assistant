import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  addDoc
} from 'firebase/firestore';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { firebaseConfig } from '../config/firebase';
import {
  User,
  StudyMaterial,
  ChatSession,
  Quiz,
  QuizAttempt,
  LearningProgress,
  DailyGoal,
  StoredContent,
  ExtractedTopic,
  RevisionSchedule,
  MockTest
} from '../types';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// ============ Authentication ============

export const signInWithGoogle = async (): Promise<User | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Create or update user in Firestore
    const userData: User = {
      id: user.uid,
      email: user.email || '',
      displayName: user.displayName || 'Student',
      photoURL: user.photoURL || undefined,
      createdAt: new Date(),
      lastLoginAt: new Date()
    };
    
    await setDoc(doc(db, 'users', user.uid), userData, { merge: true });
    return userData;
  } catch (error) {
    console.error('Error signing in:', error);
    return null;
  }
};

export const signOutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
  }
};

export const onAuthChange = (callback: (user: FirebaseUser | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export const getCurrentUser = (): FirebaseUser | null => {
  return auth.currentUser;
};

// ============ Study Materials ============

export const saveStudyMaterial = async (material: Omit<StudyMaterial, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'studyMaterials'), {
      ...material,
      uploadedAt: Timestamp.fromDate(material.uploadedAt)
    });
    return docRef.id;
  } catch (error) {
    console.error('Error saving study material:', error);
    throw error;
  }
};

export const getStudyMaterials = async (userId: string): Promise<StudyMaterial[]> => {
  try {
    const q = query(
      collection(db, 'studyMaterials'),
      where('userId', '==', userId),
      orderBy('uploadedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      uploadedAt: doc.data().uploadedAt.toDate()
    })) as StudyMaterial[];
  } catch (error) {
    console.error('Error getting study materials:', error);
    return [];
  }
};

export const deleteStudyMaterial = async (materialId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'studyMaterials', materialId));
  } catch (error) {
    console.error('Error deleting study material:', error);
    throw error;
  }
};

// ============ Chat Sessions ============

// Helper function to remove undefined values from an object
const removeUndefined = (obj: Record<string, any>): Record<string, any> => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined)
  );
};

export const saveChatSession = async (session: Omit<ChatSession, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'chatSessions'), {
      userId: session.userId,
      title: session.title,
      subject: session.subject || null,
      createdAt: Timestamp.fromDate(session.createdAt),
      updatedAt: Timestamp.fromDate(session.updatedAt),
      messages: session.messages.map(msg => removeUndefined({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: Timestamp.fromDate(msg.timestamp),
        context: msg.context || null
      }))
    });
    return docRef.id;
  } catch (error) {
    console.error('Error saving chat session:', error);
    throw error;
  }
};

export const updateChatSession = async (sessionId: string, session: Partial<ChatSession>): Promise<void> => {
  try {
    const updateData: Record<string, any> = {
      updatedAt: Timestamp.fromDate(new Date())
    };

    if (session.title !== undefined) {
      updateData.title = session.title;
    }
    
    if (session.subject !== undefined) {
      updateData.subject = session.subject || null;
    }
    
    if (session.messages) {
      updateData.messages = session.messages.map(msg => removeUndefined({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: Timestamp.fromDate(msg.timestamp),
        context: msg.context || null
      }));
    }
    
    await updateDoc(doc(db, 'chatSessions', sessionId), updateData);
  } catch (error) {
    console.error('Error updating chat session:', error);
    throw error;
  }
};

export const getChatSessions = async (userId: string): Promise<ChatSession[]> => {
  try {
    const q = query(
      collection(db, 'chatSessions'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc'),
      limit(20)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
        messages: data.messages.map((msg: any) => ({
          ...msg,
          timestamp: msg.timestamp.toDate()
        }))
      };
    }) as ChatSession[];
  } catch (error) {
    console.error('Error getting chat sessions:', error);
    return [];
  }
};

export const deleteChatSession = async (sessionId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'chatSessions', sessionId));
  } catch (error) {
    console.error('Error deleting chat session:', error);
    throw error;
  }
};

export const getChatSessionById = async (sessionId: string): Promise<ChatSession | null> => {
  try {
    const docSnap = await getDoc(doc(db, 'chatSessions', sessionId));
    if (!docSnap.exists()) return null;
    
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
      messages: data.messages.map((msg: any) => ({
        ...msg,
        timestamp: msg.timestamp.toDate()
      }))
    } as ChatSession;
  } catch (error) {
    console.error('Error getting chat session:', error);
    return null;
  }
};

// ============ Quizzes ============

export const saveQuiz = async (quiz: Omit<Quiz, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'quizzes'), {
      ...quiz,
      createdAt: Timestamp.fromDate(quiz.createdAt)
    });
    return docRef.id;
  } catch (error) {
    console.error('Error saving quiz:', error);
    throw error;
  }
};

export const getQuizzes = async (userId: string): Promise<Quiz[]> => {
  try {
    const q = query(
      collection(db, 'quizzes'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt.toDate()
    })) as Quiz[];
  } catch (error) {
    console.error('Error getting quizzes:', error);
    return [];
  }
};

export const getQuiz = async (quizId: string): Promise<Quiz | null> => {
  try {
    const docSnap = await getDoc(doc(db, 'quizzes', quizId));
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt.toDate()
      } as Quiz;
    }
    return null;
  } catch (error) {
    console.error('Error getting quiz:', error);
    return null;
  }
};

export const deleteQuiz = async (quizId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'quizzes', quizId));
  } catch (error) {
    console.error('Error deleting quiz:', error);
    throw error;
  }
};

// ============ Quiz Attempts ============

export const saveQuizAttempt = async (attempt: Omit<QuizAttempt, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'quizAttempts'), {
      ...attempt,
      completedAt: Timestamp.fromDate(attempt.completedAt)
    });
    
    // Update learning progress
    await updateLearningProgressAfterQuiz(attempt);
    
    return docRef.id;
  } catch (error) {
    console.error('Error saving quiz attempt:', error);
    throw error;
  }
};

export const getQuizAttempts = async (userId: string, quizId?: string): Promise<QuizAttempt[]> => {
  try {
    let q;
    if (quizId) {
      q = query(
        collection(db, 'quizAttempts'),
        where('userId', '==', userId),
        where('quizId', '==', quizId),
        orderBy('completedAt', 'desc')
      );
    } else {
      q = query(
        collection(db, 'quizAttempts'),
        where('userId', '==', userId),
        orderBy('completedAt', 'desc'),
        limit(50)
      );
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      completedAt: doc.data().completedAt.toDate()
    })) as QuizAttempt[];
  } catch (error) {
    console.error('Error getting quiz attempts:', error);
    return [];
  }
};

// ============ Learning Progress ============

export const getLearningProgress = async (userId: string): Promise<LearningProgress | null> => {
  try {
    const docSnap = await getDoc(doc(db, 'learningProgress', userId));
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        ...data,
        lastStudyDate: data.lastStudyDate?.toDate() || new Date(),
        topics: data.topics?.map((t: any) => ({
          ...t,
          lastStudied: t.lastStudied?.toDate() || new Date()
        })) || []
      } as LearningProgress;
    }
    
    // Create initial progress if doesn't exist
    const initialProgress: LearningProgress = {
      userId,
      topics: [],
      totalQuizzesTaken: 0,
      averageScore: 0,
      streakDays: 0,
      lastStudyDate: new Date(),
      studyTimeTotal: 0,
      weakTopics: [],
      strongTopics: []
    };
    
    await setDoc(doc(db, 'learningProgress', userId), {
      ...initialProgress,
      lastStudyDate: Timestamp.fromDate(initialProgress.lastStudyDate)
    });
    
    return initialProgress;
  } catch (error) {
    console.error('Error getting learning progress:', error);
    return null;
  }
};

export const updateLearningProgress = async (userId: string, updates: Partial<LearningProgress>): Promise<void> => {
  try {
    const updateData: any = { ...updates };
    
    if (updates.lastStudyDate) {
      updateData.lastStudyDate = Timestamp.fromDate(updates.lastStudyDate);
    }
    
    if (updates.topics) {
      updateData.topics = updates.topics.map(t => ({
        ...t,
        lastStudied: Timestamp.fromDate(t.lastStudied)
      }));
    }
    
    await updateDoc(doc(db, 'learningProgress', userId), updateData);
  } catch (error) {
    console.error('Error updating learning progress:', error);
    throw error;
  }
};

// Update topic performance after quiz completion
export const updateTopicPerformance = async (
  userId: string, 
  topicResults: { topic: string; correct: number; total: number }[]
): Promise<void> => {
  try {
    const progress = await getLearningProgress(userId);
    if (!progress) return;

    const updatedTopics = [...progress.topics];
    const weakTopics: string[] = [];
    const strongTopics: string[] = [];

    topicResults.forEach(result => {
      const percentage = (result.correct / result.total) * 100;
      const existingIndex = updatedTopics.findIndex(t => t.topic === result.topic);

      if (existingIndex >= 0) {
        // Update existing topic
        const existing = updatedTopics[existingIndex];
        const newQuizCount = existing.quizzesTaken + 1;
        const newAvgScore = ((existing.averageScore * existing.quizzesTaken) + percentage) / newQuizCount;
        
        updatedTopics[existingIndex] = {
          ...existing,
          quizzesTaken: newQuizCount,
          averageScore: Math.round(newAvgScore),
          masteryLevel: Math.round(newAvgScore),
          lastStudied: new Date()
        };
      } else {
        // Add new topic
        updatedTopics.push({
          topic: result.topic,
          subject: 'General',
          masteryLevel: Math.round(percentage),
          quizzesTaken: 1,
          averageScore: Math.round(percentage),
          lastStudied: new Date(),
          conceptsCovered: []
        });
      }
    });

    // Categorize topics as weak or strong
    updatedTopics.forEach(topic => {
      if (topic.masteryLevel < 60) {
        if (!weakTopics.includes(topic.topic)) {
          weakTopics.push(topic.topic);
        }
      } else if (topic.masteryLevel >= 70) {
        if (!strongTopics.includes(topic.topic)) {
          strongTopics.push(topic.topic);
        }
      }
    });

    await updateLearningProgress(userId, {
      topics: updatedTopics,
      weakTopics,
      strongTopics
    });
  } catch (error) {
    console.error('Error updating topic performance:', error);
  }
};

const updateLearningProgressAfterQuiz = async (attempt: Omit<QuizAttempt, 'id'>): Promise<void> => {
  try {
    const progress = await getLearningProgress(attempt.userId);
    if (!progress) return;
    
    const scorePercent = (attempt.score / attempt.totalQuestions) * 100;
    
    // Update totals
    const newTotalQuizzes = progress.totalQuizzesTaken + 1;
    const newAverageScore = (
      (progress.averageScore * progress.totalQuizzesTaken + scorePercent) / newTotalQuizzes
    );
    
    // Update streak
    const today = new Date();
    const lastStudy = new Date(progress.lastStudyDate);
    const daysDiff = Math.floor((today.getTime() - lastStudy.getTime()) / (1000 * 60 * 60 * 24));
    
    let newStreak = progress.streakDays;
    if (daysDiff === 0) {
      // Same day, keep streak
    } else if (daysDiff === 1) {
      // Next day, increment streak
      newStreak += 1;
    } else {
      // Streak broken
      newStreak = 1;
    }
    
    await updateLearningProgress(attempt.userId, {
      totalQuizzesTaken: newTotalQuizzes,
      averageScore: Math.round(newAverageScore),
      streakDays: newStreak,
      lastStudyDate: today,
      studyTimeTotal: progress.studyTimeTotal + Math.round(attempt.timeSpent / 60)
    });
  } catch (error) {
    console.error('Error updating progress after quiz:', error);
  }
};

// ============ Daily Goals ============

export const getDailyGoal = async (userId: string, date: Date): Promise<DailyGoal | null> => {
  try {
    const dateStr = date.toISOString().split('T')[0];
    const docSnap = await getDoc(doc(db, 'dailyGoals', `${userId}_${dateStr}`));
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        ...data,
        date: data.date.toDate()
      } as DailyGoal;
    }
    return null;
  } catch (error) {
    console.error('Error getting daily goal:', error);
    return null;
  }
};

export const saveDailyGoal = async (goal: DailyGoal): Promise<void> => {
  try {
    const dateStr = goal.date.toISOString().split('T')[0];
    await setDoc(doc(db, 'dailyGoals', `${goal.userId}_${dateStr}`), {
      ...goal,
      date: Timestamp.fromDate(goal.date)
    });
  } catch (error) {
    console.error('Error saving daily goal:', error);
    throw error;
  }
};

// ============ Stored Content (PDF/Doc Storage) ============

export const saveStoredContent = async (content: Omit<StoredContent, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'storedContent'), {
      ...content,
      createdAt: Timestamp.fromDate(content.createdAt),
      lastRevisedAt: content.lastRevisedAt ? Timestamp.fromDate(content.lastRevisedAt) : null
    });
    return docRef.id;
  } catch (error) {
    console.error('Error saving stored content:', error);
    throw error;
  }
};

export const getStoredContents = async (userId: string): Promise<StoredContent[]> => {
  try {
    const q = query(
      collection(db, 'storedContent'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt.toDate(),
      lastRevisedAt: doc.data().lastRevisedAt?.toDate()
    })) as StoredContent[];
  } catch (error) {
    console.error('Error getting stored contents:', error);
    return [];
  }
};

export const getStoredContent = async (contentId: string): Promise<StoredContent | null> => {
  try {
    const docSnap = await getDoc(doc(db, 'storedContent', contentId));
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt.toDate(),
        lastRevisedAt: data.lastRevisedAt?.toDate()
      } as StoredContent;
    }
    return null;
  } catch (error) {
    console.error('Error getting stored content:', error);
    return null;
  }
};

export const updateStoredContent = async (contentId: string, updates: Partial<StoredContent>): Promise<void> => {
  try {
    const updateData: Record<string, unknown> = { ...updates };
    if (updates.lastRevisedAt) {
      updateData.lastRevisedAt = Timestamp.fromDate(updates.lastRevisedAt);
    }
    await updateDoc(doc(db, 'storedContent', contentId), updateData);
  } catch (error) {
    console.error('Error updating stored content:', error);
    throw error;
  }
};

export const deleteStoredContent = async (contentId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'storedContent', contentId));
    // Also delete related revision schedules
    const schedules = await getRevisionSchedules(contentId);
    for (const schedule of schedules) {
      await deleteDoc(doc(db, 'revisionSchedules', schedule.id));
    }
  } catch (error) {
    console.error('Error deleting stored content:', error);
    throw error;
  }
};

// ============ Revision Schedules (Spaced Repetition) ============

export const saveRevisionSchedule = async (schedule: Omit<RevisionSchedule, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'revisionSchedules'), {
      ...schedule,
      nextReviewDate: Timestamp.fromDate(schedule.nextReviewDate),
      lastReviewDate: schedule.lastReviewDate ? Timestamp.fromDate(schedule.lastReviewDate) : null
    });
    return docRef.id;
  } catch (error) {
    console.error('Error saving revision schedule:', error);
    throw error;
  }
};

export const getRevisionSchedules = async (userId: string): Promise<RevisionSchedule[]> => {
  try {
    const q = query(
      collection(db, 'revisionSchedules'),
      where('userId', '==', userId),
      orderBy('nextReviewDate', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      nextReviewDate: doc.data().nextReviewDate.toDate(),
      lastReviewDate: doc.data().lastReviewDate?.toDate()
    })) as RevisionSchedule[];
  } catch (error) {
    console.error('Error getting revision schedules:', error);
    return [];
  }
};

export const getDueRevisions = async (userId: string): Promise<RevisionSchedule[]> => {
  try {
    const now = new Date();
    const q = query(
      collection(db, 'revisionSchedules'),
      where('userId', '==', userId),
      where('nextReviewDate', '<=', Timestamp.fromDate(now)),
      orderBy('nextReviewDate', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      nextReviewDate: doc.data().nextReviewDate.toDate(),
      lastReviewDate: doc.data().lastReviewDate?.toDate()
    })) as RevisionSchedule[];
  } catch (error) {
    console.error('Error getting due revisions:', error);
    return [];
  }
};

export const updateRevisionAfterReview = async (
  scheduleId: string, 
  quality: number // 0-5, where 5 is perfect recall
): Promise<void> => {
  try {
    const docSnap = await getDoc(doc(db, 'revisionSchedules', scheduleId));
    if (!docSnap.exists()) return;
    
    const schedule = docSnap.data() as RevisionSchedule;
    
    // SM-2 Algorithm for spaced repetition
    let newEaseFactor = schedule.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    newEaseFactor = Math.max(1.3, newEaseFactor);
    
    let newInterval: number;
    if (quality < 3) {
      // Failed review - reset interval
      newInterval = 1;
    } else {
      if (schedule.reviewCount === 0) {
        newInterval = 1;
      } else if (schedule.reviewCount === 1) {
        newInterval = 6;
      } else {
        newInterval = Math.round(schedule.interval * newEaseFactor);
      }
    }
    
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);
    
    await updateDoc(doc(db, 'revisionSchedules', scheduleId), {
      interval: newInterval,
      easeFactor: newEaseFactor,
      reviewCount: schedule.reviewCount + 1,
      lastReviewDate: Timestamp.fromDate(new Date()),
      nextReviewDate: Timestamp.fromDate(nextReviewDate),
      masteryLevel: Math.min(100, Math.max(0, schedule.masteryLevel + (quality - 2.5) * 10))
    });
  } catch (error) {
    console.error('Error updating revision schedule:', error);
    throw error;
  }
};

export const createRevisionSchedulesForContent = async (
  userId: string,
  contentId: string,
  topics: ExtractedTopic[]
): Promise<void> => {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    for (const topic of topics) {
      await saveRevisionSchedule({
        userId,
        contentId,
        topicId: topic.id,
        topicName: topic.name,
        scheduleType: 'daily',
        nextReviewDate: tomorrow,
        reviewCount: 0,
        masteryLevel: 0,
        interval: 1,
        easeFactor: 2.5 // Initial ease factor for SM-2
      });
    }
  } catch (error) {
    console.error('Error creating revision schedules:', error);
  }
};

// ============ Mock Tests ============

export const saveMockTest = async (mockTest: Omit<MockTest, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'mockTests'), {
      ...mockTest,
      createdAt: Timestamp.fromDate(mockTest.createdAt),
      scheduledFor: mockTest.scheduledFor ? Timestamp.fromDate(mockTest.scheduledFor) : null,
      completedAt: mockTest.completedAt ? Timestamp.fromDate(mockTest.completedAt) : null
    });
    return docRef.id;
  } catch (error) {
    console.error('Error saving mock test:', error);
    throw error;
  }
};

export const getMockTests = async (userId: string): Promise<MockTest[]> => {
  try {
    const q = query(
      collection(db, 'mockTests'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt.toDate(),
      scheduledFor: doc.data().scheduledFor?.toDate(),
      completedAt: doc.data().completedAt?.toDate()
    })) as MockTest[];
  } catch (error) {
    console.error('Error getting mock tests:', error);
    return [];
  }
};

export const updateMockTest = async (testId: string, updates: Partial<MockTest>): Promise<void> => {
  try {
    const updateData: Record<string, unknown> = { ...updates };
    if (updates.completedAt) {
      updateData.completedAt = Timestamp.fromDate(updates.completedAt);
    }
    await updateDoc(doc(db, 'mockTests', testId), updateData);
  } catch (error) {
    console.error('Error updating mock test:', error);
    throw error;
  }
};

// ============ Topic Extraction Helper ============

export const getTopicsForRevision = async (
  userId: string,
  scheduleType: 'daily' | 'weekly' | 'monthly'
): Promise<{ topic: ExtractedTopic; schedule: RevisionSchedule; content: StoredContent }[]> => {
  try {
    const now = new Date();
    let dateLimit = new Date();
    
    switch (scheduleType) {
      case 'daily':
        dateLimit.setDate(now.getDate() + 1);
        break;
      case 'weekly':
        dateLimit.setDate(now.getDate() + 7);
        break;
      case 'monthly':
        dateLimit.setMonth(now.getMonth() + 1);
        break;
    }
    
    const schedules = await getRevisionSchedules(userId);
    const dueSchedules = schedules.filter(s => s.nextReviewDate <= dateLimit);
    
    const results: { topic: ExtractedTopic; schedule: RevisionSchedule; content: StoredContent }[] = [];
    
    for (const schedule of dueSchedules) {
      const content = await getStoredContent(schedule.contentId);
      if (content) {
        const topic = content.topics.find(t => t.id === schedule.topicId);
        if (topic) {
          results.push({ topic, schedule, content });
        }
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error getting topics for revision:', error);
    return [];
  }
};

export { db, auth };
