import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as cors from 'cors';

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Initialize CORS
const corsHandler = cors({ origin: true });

// Initialize Gemini AI (API key from Firebase config)
const getGeminiClient = () => {
  const apiKey = functions.config().gemini?.apikey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }
  return new GoogleGenerativeAI(apiKey);
};

// ============ Chat Functions ============

/**
 * Cloud Function to handle chat with AI Study Buddy
 * Provides context-aware responses for educational questions
 */
export const chatWithStudyBuddy = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      const { message, context, userId } = req.body;
      
      if (!message) {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const systemPrompt = `You are an AI Study Buddy - a friendly, knowledgeable, and encouraging educational assistant. Your role is to help students understand complex concepts by breaking them down into simpler parts.

Guidelines:
- Be patient and supportive
- Use clear, simple language
- Provide step-by-step explanations
- Include relevant examples
- Format responses with markdown

${context ? `\nContext from study materials:\n${context}` : ''}

Student's question: ${message}`;

      const result = await model.generateContent(systemPrompt);
      const response = result.response.text();

      // Log interaction for analytics (optional)
      if (userId) {
        await db.collection('chatLogs').add({
          userId,
          message,
          response,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      res.json({ response });
    } catch (error) {
      console.error('Error in chatWithStudyBuddy:', error);
      res.status(500).json({ error: 'Failed to process chat request' });
    }
  });
});

// ============ Quiz Generation Functions ============

/**
 * Cloud Function to generate quiz questions from content
 */
export const generateQuiz = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      const { content, numQuestions = 5, difficulty = 'medium', subject } = req.body;
      
      if (!content) {
        res.status(400).json({ error: 'Content is required' });
        return;
      }

      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `You are an expert quiz generator. Based on the following study content, generate ${numQuestions} multiple-choice questions at ${difficulty} difficulty level.

Study Content:
${content}

${subject ? `Subject: ${subject}` : ''}

Return ONLY a valid JSON array (no markdown):
[
  {
    "id": "q1",
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Explanation of why this answer is correct",
    "topic": "Specific topic"
  }
]`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        res.status(500).json({ error: 'Failed to parse quiz response' });
        return;
      }
      
      const questions = JSON.parse(jsonMatch[0]);
      res.json({ questions });
    } catch (error) {
      console.error('Error in generateQuiz:', error);
      res.status(500).json({ error: 'Failed to generate quiz' });
    }
  });
});

// ============ Study Recommendations ============

/**
 * Cloud Function to generate personalized study recommendations
 */
export const getStudyRecommendations = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      // Fetch user's learning progress
      const progressDoc = await db.collection('learningProgress').doc(userId).get();
      const progress = progressDoc.data();

      if (!progress) {
        res.json({ recommendations: [] });
        return;
      }

      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `You are a personalized learning advisor. Based on the student's learning progress, generate study recommendations.

Current Progress:
${JSON.stringify(progress, null, 2)}

Generate 3-5 personalized study recommendations. Return ONLY a valid JSON array:
[
  {
    "topic": "Topic name",
    "subject": "Subject area",
    "reason": "Why this is recommended",
    "priority": "high|medium|low",
    "suggestedResources": ["Resource 1", "Resource 2"],
    "estimatedTime": 30
  }
]`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const recommendations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      
      res.json({ recommendations });
    } catch (error) {
      console.error('Error in getStudyRecommendations:', error);
      res.status(500).json({ error: 'Failed to get recommendations' });
    }
  });
});

// ============ Content Processing ============

/**
 * Cloud Function to extract key concepts from study material
 */
export const extractConcepts = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      const { content } = req.body;
      
      if (!content) {
        res.status(400).json({ error: 'Content is required' });
        return;
      }

      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `Analyze the following study material and extract key concepts.

Study Material:
${content}

Return ONLY a valid JSON array of strings representing key concepts:
["concept1", "concept2", "concept3", ...]`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const concepts = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      
      res.json({ concepts });
    } catch (error) {
      console.error('Error in extractConcepts:', error);
      res.status(500).json({ error: 'Failed to extract concepts' });
    }
  });
});

/**
 * Cloud Function to summarize study content
 */
export const summarizeContent = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      const { content, length = 'medium' } = req.body;
      
      if (!content) {
        res.status(400).json({ error: 'Content is required' });
        return;
      }

      const wordCounts: Record<string, number> = { short: 100, medium: 250, long: 500 };

      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `Summarize the following study material in approximately ${wordCounts[length] || 250} words.

Study Material:
${content}

Create a clear, well-organized summary with bullet points for easy reading.`;

      const result = await model.generateContent(prompt);
      const summary = result.response.text();
      
      res.json({ summary });
    } catch (error) {
      console.error('Error in summarizeContent:', error);
      res.status(500).json({ error: 'Failed to summarize content' });
    }
  });
});

// ============ Scheduled Functions ============

/**
 * Scheduled function to update learning streaks daily
 */
export const updateLearningStreaks = functions.pubsub
  .schedule('0 0 * * *') // Run at midnight daily
  .timeZone('America/New_York')
  .onRun(async () => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const progressSnapshot = await db.collection('learningProgress').get();
      
      const batch = db.batch();
      
      progressSnapshot.docs.forEach((doc) => {
        const progress = doc.data();
        const lastStudy = progress.lastStudyDate?.toDate();
        
        if (lastStudy) {
          const daysDiff = Math.floor(
            (yesterday.getTime() - lastStudy.getTime()) / (1000 * 60 * 60 * 24)
          );
          
          // Reset streak if user hasn't studied in more than 1 day
          if (daysDiff > 1) {
            batch.update(doc.ref, { streakDays: 0 });
          }
        }
      });
      
      await batch.commit();
      console.log('Learning streaks updated successfully');
    } catch (error) {
      console.error('Error updating streaks:', error);
    }
  });

// ============ Firestore Triggers ============

/**
 * Trigger when a quiz attempt is saved to update learning progress
 */
export const onQuizAttemptCreated = functions.firestore
  .document('quizAttempts/{attemptId}')
  .onCreate(async (snapshot, context) => {
    try {
      const attempt = snapshot.data();
      const { userId, quizId, score, totalQuestions } = attempt;
      
      // Get the quiz to find topics
      const quizDoc = await db.collection('quizzes').doc(quizId).get();
      const quiz = quizDoc.data();
      
      if (!quiz) return;
      
      // Update user's learning progress
      const progressRef = db.collection('learningProgress').doc(userId);
      const progressDoc = await progressRef.get();
      
      const scorePercent = (score / totalQuestions) * 100;
      
      if (progressDoc.exists) {
        const progress = progressDoc.data()!;
        const newTotalQuizzes = (progress.totalQuizzesTaken || 0) + 1;
        const newAverage = (
          ((progress.averageScore || 0) * (progress.totalQuizzesTaken || 0) + scorePercent) / 
          newTotalQuizzes
        );
        
        // Update weak/strong topics
        const weakTopics = [...(progress.weakTopics || [])];
        const strongTopics = [...(progress.strongTopics || [])];
        
        if (scorePercent < 60 && quiz.subject && !weakTopics.includes(quiz.subject)) {
          weakTopics.push(quiz.subject);
        } else if (scorePercent >= 80 && quiz.subject && !strongTopics.includes(quiz.subject)) {
          strongTopics.push(quiz.subject);
        }
        
        await progressRef.update({
          totalQuizzesTaken: newTotalQuizzes,
          averageScore: Math.round(newAverage),
          lastStudyDate: admin.firestore.FieldValue.serverTimestamp(),
          weakTopics,
          strongTopics
        });
      }
      
      console.log(`Updated progress for user ${userId} after quiz attempt`);
    } catch (error) {
      console.error('Error in onQuizAttemptCreated:', error);
    }
  });

/**
 * Cleanup function to delete old chat logs (older than 30 days)
 */
export const cleanupOldChatLogs = functions.pubsub
  .schedule('0 2 * * 0') // Run at 2 AM every Sunday
  .timeZone('America/New_York')
  .onRun(async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const oldLogsSnapshot = await db.collection('chatLogs')
        .where('timestamp', '<', thirtyDaysAgo)
        .limit(500)
        .get();
      
      const batch = db.batch();
      oldLogsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log(`Deleted ${oldLogsSnapshot.size} old chat logs`);
    } catch (error) {
      console.error('Error cleaning up chat logs:', error);
    }
  });
