import { GoogleGenerativeAI } from '@google/generative-ai';
import { geminiConfig } from '../config/firebase';
import { QuizQuestion, StudyRecommendation, TopicProgress, ExtractedTopic } from '../types';

// Initialize the Gemini AI client
const genAI = new GoogleGenerativeAI(geminiConfig.apiKey);
const model = genAI.getGenerativeModel({ model: geminiConfig.model });

// Chat with the AI Study Buddy
export async function chatWithStudyBuddy(
  message: string,
  context?: string,
  chatHistory?: { role: 'user' | 'model'; parts: { text: string }[] }[]
): Promise<string> {
  try {
    const systemPrompt = `You are an AI Study Buddy - a friendly, knowledgeable, and encouraging educational assistant. Your role is to:

1. Help students understand complex concepts by breaking them down into simpler parts
2. Answer questions about any academic subject with clear explanations
3. Provide examples and analogies to make learning easier
4. Encourage students and celebrate their progress
5. Suggest study techniques and tips when appropriate
6. If the student seems confused, try explaining in a different way

Guidelines:
- Be patient and supportive
- Use clear, simple language
- Provide step-by-step explanations when needed
- Include relevant examples
- Ask clarifying questions if the query is unclear
- Format responses with markdown for better readability
- If you don't know something, admit it honestly

${context ? `\nContext from study materials:\n${context}` : ''}`;

    const chat = model.startChat({
      history: chatHistory || [],
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
      },
    });

    const prompt = chatHistory && chatHistory.length > 0 
      ? message 
      : `${systemPrompt}\n\nStudent's question: ${message}`;

    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error chatting with Study Buddy:', error);
    throw new Error('Failed to get response from AI. Please try again.');
  }
}

// Generate a quiz from study content
export async function generateQuizFromContent(
  content: string,
  numQuestions: number = 5,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  subject?: string
): Promise<QuizQuestion[]> {
  try {
    const prompt = `You are an expert quiz generator for educational purposes. Based on the following study content, generate ${numQuestions} multiple-choice questions at ${difficulty} difficulty level.

Study Content:
${content}

${subject ? `Subject: ${subject}` : ''}

Generate questions that test understanding, not just memorization. Include a mix of:
- Conceptual questions
- Application questions
- Analysis questions

Return ONLY a valid JSON array with this exact structure (no markdown, no code blocks, just the JSON):
[
  {
    "id": "q1",
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Detailed explanation of why this answer is correct",
    "topic": "Specific topic this question covers"
  }
]

Make sure:
- Each question has exactly 4 options
- correctAnswer is the index (0-3) of the correct option
- Explanations are educational and helpful
- Topics are specific and relevant`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Parse the JSON response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Invalid response format from AI');
    }
    
    const questions: QuizQuestion[] = JSON.parse(jsonMatch[0]);
    return questions;
  } catch (error) {
    console.error('Error generating quiz:', error);
    throw new Error('Failed to generate quiz. Please try again.');
  }
}

// Extract key concepts from study material
export async function extractKeyConcepts(content: string): Promise<string[]> {
  try {
    const prompt = `Analyze the following study material and extract the key concepts and topics covered.

Study Material:
${content}

Return ONLY a valid JSON array of strings representing the key concepts (no markdown, no code blocks):
["concept1", "concept2", "concept3", ...]

Focus on:
- Main topics and subtopics
- Important terms and definitions
- Key theories or principles
- Notable facts or formulas`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Error extracting concepts:', error);
    return [];
  }
}

// Generate study recommendations based on progress
export async function generateStudyRecommendations(
  progress: TopicProgress[],
  weakTopics: string[],
  recentTopics: string[]
): Promise<StudyRecommendation[]> {
  try {
    const prompt = `You are a personalized learning advisor. Based on the student's learning progress, generate study recommendations.

Current Progress:
${JSON.stringify(progress, null, 2)}

Weak Topics (need more practice):
${weakTopics.join(', ')}

Recently Studied Topics:
${recentTopics.join(', ')}

Generate 3-5 personalized study recommendations. Return ONLY a valid JSON array (no markdown):
[
  {
    "topic": "Topic name",
    "subject": "Subject area",
    "reason": "Why this is recommended",
    "priority": "high|medium|low",
    "suggestedResources": ["Resource 1", "Resource 2"],
    "estimatedTime": 30
  }
]

Prioritize:
1. Topics where the student is struggling
2. Topics that haven't been studied recently
3. Topics that build on what the student has already learned
4. Balance between strengthening weak areas and advancing knowledge`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return [];
  }
}

// Summarize study content
export async function summarizeContent(content: string, length: 'short' | 'medium' | 'long' = 'medium'): Promise<string> {
  try {
    const wordCounts = { short: 100, medium: 250, long: 500 };
    
    const prompt = `Summarize the following study material in approximately ${wordCounts[length]} words. 

Study Material:
${content}

Create a clear, well-organized summary that:
- Highlights the main points
- Preserves key facts and definitions
- Uses bullet points for easy reading
- Maintains the logical flow of ideas`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error summarizing content:', error);
    throw new Error('Failed to summarize content. Please try again.');
  }
}

// Explain a concept in simple terms
export async function explainConcept(concept: string, context?: string): Promise<string> {
  try {
    const prompt = `Explain the concept of "${concept}" in simple, easy-to-understand terms.

${context ? `Context: ${context}` : ''}

Your explanation should:
1. Start with a simple definition
2. Use an everyday analogy or example
3. Break down any complex parts
4. Provide a practical application
5. Include a "Key Takeaway" at the end

Format the response with clear headings and bullet points for readability.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error explaining concept:', error);
    throw new Error('Failed to explain concept. Please try again.');
  }
}

// Generate flashcards from content
export async function generateFlashcards(
  content: string,
  numCards: number = 10
): Promise<{ front: string; back: string }[]> {
  try {
    const prompt = `Create ${numCards} flashcards from the following study material.

Study Material:
${content}

Return ONLY a valid JSON array (no markdown, no code blocks):
[
  {
    "front": "Question or term",
    "back": "Answer or definition"
  }
]

Create flashcards that:
- Cover key terms and definitions
- Include important facts and concepts
- Test understanding, not just memorization
- Are concise but complete`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Error generating flashcards:', error);
    return [];
  }
}

// Generate targeted quiz for weak topics
export async function generateWeakTopicQuiz(
  weakTopics: string[],
  numQuestions: number = 10,
  existingContent?: string
): Promise<QuizQuestion[]> {
  try {
    const prompt = `You are an expert educational quiz generator. The student is struggling with the following topics and needs practice questions to improve:

Weak Topics:
${weakTopics.map((t, i) => `${i + 1}. ${t}`).join('\n')}

${existingContent ? `\nReference Content:\n${existingContent}` : ''}

Generate ${numQuestions} multiple-choice questions that specifically target these weak areas. Focus on:
1. Building foundational understanding
2. Common misconceptions in these topics
3. Practical application of concepts
4. Progressive difficulty (start easier, get harder)

Return ONLY a valid JSON array (no markdown, no code blocks):
[
  {
    "id": "q1",
    "question": "Clear, focused question text?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Detailed explanation that teaches the concept",
    "topic": "Exact topic from the weak topics list"
  }
]

Ensure each question:
- Directly addresses one of the weak topics
- Has exactly 4 plausible options
- Includes educational explanations
- Helps the student understand WHY the answer is correct`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Invalid response format');
    }
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Error generating weak topic quiz:', error);
    throw new Error('Failed to generate quiz for weak topics. Please try again.');
  }
}

// Generate personalized learning path
export async function generateLearningPath(
  weakTopics: string[],
  strongTopics: string[],
  studyMaterials: string[],
  averageScore: number
): Promise<{ 
  steps: { title: string; description: string; estimatedTime: number; type: 'review' | 'practice' | 'quiz' }[];
  weeklyGoals: string[];
  focusAreas: string[];
}> {
  try {
    const prompt = `You are an AI learning path generator. Based on the student's performance data, create a personalized 1-week learning path.

Student Profile:
- Average Score: ${averageScore}%
- Weak Topics: ${weakTopics.join(', ') || 'None identified yet'}
- Strong Topics: ${strongTopics.join(', ') || 'None identified yet'}
- Available Study Materials: ${studyMaterials.join(', ') || 'General materials'}

Create a structured learning path that:
1. Prioritizes weak topics while maintaining strong areas
2. Balances review, practice, and assessment
3. Sets achievable daily goals
4. Progresses from fundamentals to advanced concepts

Return ONLY valid JSON (no markdown):
{
  "steps": [
    {
      "title": "Step title",
      "description": "What to do in this step",
      "estimatedTime": 30,
      "type": "review|practice|quiz"
    }
  ],
  "weeklyGoals": ["Goal 1", "Goal 2", "Goal 3"],
  "focusAreas": ["Area 1", "Area 2"]
}

Create 5-7 learning steps for the week.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format');
    }
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Error generating learning path:', error);
    return {
      steps: [
        { title: 'Review weak topics', description: 'Go through your weak areas', estimatedTime: 30, type: 'review' },
        { title: 'Take practice quiz', description: 'Test your understanding', estimatedTime: 20, type: 'quiz' }
      ],
      weeklyGoals: ['Complete 3 quizzes', 'Review all weak topics', 'Maintain study streak'],
      focusAreas: weakTopics.slice(0, 3)
    };
  }
}

// Extract topics from PDF/document content for storage and revision
export async function extractTopicsFromContent(
  content: string,
  fileName: string
): Promise<ExtractedTopic[]> {
  try {
    const prompt = `Analyze the following study content and extract the main topics for a revision schedule.

Content from "${fileName}":
${content.substring(0, 15000)}

Extract 5-15 distinct topics from this content. For each topic, provide:
1. A clear topic name
2. Key content/summary about the topic (3-5 sentences)
3. Important key terms (3-7 terms)
4. Estimated difficulty level

Return a JSON array in this exact format:
[
  {
    "id": "topic_1",
    "name": "Topic Name",
    "content": "Key points and summary about this topic...",
    "keyTerms": ["term1", "term2", "term3"],
    "difficulty": "easy|medium|hard"
  }
]

Focus on the most important concepts that would be useful for quizzes and revision.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Invalid response format');
    }
    
    const topics = JSON.parse(jsonMatch[0]);
    return topics.map((topic: ExtractedTopic, index: number) => ({
      id: `topic_${Date.now()}_${index}`,
      name: topic.name,
      content: topic.content,
      keyTerms: topic.keyTerms || [],
      difficulty: topic.difficulty || 'medium',
      masteryLevel: 0,
      quizCount: 0
    }));
  } catch (error) {
    console.error('Error extracting topics:', error);
    return [];
  }
}

// Generate a summary of the content
export async function generateContentSummary(content: string): Promise<string> {
  try {
    const prompt = `Summarize the following study content in 3-5 paragraphs. Focus on the main concepts, key points, and important details that would be useful for revision.

Content:
${content.substring(0, 12000)}

Provide a clear, well-structured summary:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating summary:', error);
    return '';
  }
}

// Generate revision quiz for specific topics
export async function generateRevisionQuiz(
  topics: { name: string; content: string; keyTerms: string[] }[],
  numQuestions: number = 5
): Promise<QuizQuestion[]> {
  try {
    const topicsContext = topics.map(t => 
      `Topic: ${t.name}\nContent: ${t.content}\nKey Terms: ${t.keyTerms.join(', ')}`
    ).join('\n\n');

    const prompt = `Create a revision quiz based on these topics:

${topicsContext}

Generate ${numQuestions} questions that test understanding and recall of these topics.
Mix question types: definitions, concepts, applications, and term recognition.

Return a JSON array:
[
  {
    "id": "q1",
    "question": "Question text?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Why this answer is correct",
    "topic": "Topic Name"
  }
]`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Invalid response format');
    }
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Error generating revision quiz:', error);
    return [];
  }
}

// Generate daily/weekly/monthly revision summary
export async function generateRevisionSummary(
  scheduleType: 'daily' | 'weekly' | 'monthly',
  topics: { name: string; masteryLevel: number; content: string }[]
): Promise<{ summary: string; focusTopics: string[]; suggestedActions: string[] }> {
  try {
    const topicList = topics.map(t => 
      `- ${t.name} (Mastery: ${t.masteryLevel}%): ${t.content.substring(0, 200)}`
    ).join('\n');

    const prompt = `Create a ${scheduleType} revision summary for a student with these topics due for review:

${topicList}

Provide:
1. A motivational summary paragraph about what to focus on
2. Top 3-5 topics that need the most attention (low mastery first)
3. 3-5 suggested study actions for this ${scheduleType} review session

Return as JSON:
{
  "summary": "Motivational summary text...",
  "focusTopics": ["Topic 1", "Topic 2", "Topic 3"],
  "suggestedActions": ["Action 1", "Action 2", "Action 3"]
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format');
    }
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Error generating revision summary:', error);
    return {
      summary: `Time for your ${scheduleType} revision! Focus on the topics you find challenging.`,
      focusTopics: topics.slice(0, 3).map(t => t.name),
      suggestedActions: ['Review key concepts', 'Take a practice quiz', 'Summarize what you learned']
    };
  }
}
