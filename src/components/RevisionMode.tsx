import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  BookOpen,
  Play,
  Brain,
  Target,
  CheckCircle,
  Clock,
  Flame,
  Upload,
  FileText,
  Loader2,
  Sparkles,
  RotateCcw,
  Trash2,
  AlertCircle,
  Calendar,
  TrendingUp,
  Award
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { generateFlashcards, extractKeyConcepts, generateQuizFromContent, generateRevisionSummary } from '../services/geminiService';
import { Quiz, RevisionSchedule, StoredContent } from '../types';
import { 
  saveQuiz, 
  getDueRevisions, 
  getStoredContents, 
  updateRevisionAfterReview
} from '../services/firebaseService';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Set up PDF.js worker for v5
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface FlashCard {
  id: string;
  front: string;
  back: string;
  topic: string;
}

interface WeakTopic {
  name: string;
  score: number;
  questionsWrong: number;
  totalQuestions: number;
}

interface UploadedContent {
  name: string;
  content: string;
  concepts: string[];
}

const RevisionMode: React.FC = () => {
  const { learningProgress, quizzes, user, setQuizzes, setActiveTab } = useApp();
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [flashcards, setFlashcards] = useState<FlashCard[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadedContent, setUploadedContent] = useState<UploadedContent | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [numCards, setNumCards] = useState(10);
  
  // Mock test state
  const [isGeneratingMockTest, setIsGeneratingMockTest] = useState(false);
  const [mockTestGenerated, setMockTestGenerated] = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]); // Content IDs
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]); // Topic names
  const [mockTestQuestions, setMockTestQuestions] = useState(20);
  
  // Revision schedule state
  const [activeRevisionTab, setActiveRevisionTab] = useState<'flashcards' | 'schedule' | 'mocktest'>('flashcards');
  const [dueRevisions, setDueRevisions] = useState<RevisionSchedule[]>([]);
  const [storedContents, setStoredContents] = useState<StoredContent[]>([]);
  const [revisionSummary, setRevisionSummary] = useState<{
    summary: string;
    focusTopics: string[];
    suggestedActions: string[];
  } | null>(null);
  const [isLoadingRevisions, setIsLoadingRevisions] = useState(false);
  const [currentRevisionIndex, setCurrentRevisionIndex] = useState(0);
  const [isDoingRevision, setIsDoingRevision] = useState(false);

  // Load due revisions
  useEffect(() => {
    if (user) {
      loadDueRevisions();
      loadStoredContents();
    }
  }, [user]);

  const loadDueRevisions = async () => {
    if (!user) return;
    setIsLoadingRevisions(true);
    try {
      const revisions = await getDueRevisions(user.id);
      setDueRevisions(revisions);
      
      // Generate revision summary if there are due topics
      if (revisions.length > 0) {
        const topics = revisions.map(r => ({
          name: r.topicName,
          masteryLevel: r.masteryLevel,
          content: ''
        }));
        const summary = await generateRevisionSummary('daily', topics);
        setRevisionSummary(summary);
      }
    } catch (error) {
      console.error('Error loading due revisions:', error);
    } finally {
      setIsLoadingRevisions(false);
    }
  };

  const loadStoredContents = async () => {
    if (!user) return;
    try {
      const contents = await getStoredContents(user.id);
      setStoredContents(contents);
    } catch (error) {
      console.error('Error loading stored contents:', error);
    }
  };

  const handleCompleteRevision = async (scheduleId: string, quality: number) => {
    try {
      await updateRevisionAfterReview(scheduleId, quality);
      // Move to next revision
      if (currentRevisionIndex < dueRevisions.length - 1) {
        setCurrentRevisionIndex(prev => prev + 1);
      } else {
        setIsDoingRevision(false);
        setCurrentRevisionIndex(0);
        loadDueRevisions(); // Refresh the list
      }
    } catch (error) {
      console.error('Error completing revision:', error);
    }
  };

  const startRevisionSession = () => {
    if (dueRevisions.length > 0) {
      setIsDoingRevision(true);
      setCurrentRevisionIndex(0);
    }
  };

  // Calculate weak topics from quiz history
  const calculateWeakTopics = (): WeakTopic[] => {
    const topicStats: Record<string, { wrong: number; total: number }> = {};
    
    quizzes.forEach(quiz => {
      quiz.questions.forEach(q => {
        if (!topicStats[q.topic]) {
          topicStats[q.topic] = { wrong: 0, total: 0 };
        }
        topicStats[q.topic].total++;
      });
    });

    return Object.entries(topicStats)
      .map(([name, stats]) => ({
        name,
        score: Math.round(((stats.total - stats.wrong) / stats.total) * 100),
        questionsWrong: stats.wrong,
        totalQuestions: stats.total
      }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 5);
  };

  const weakTopics = calculateWeakTopics();

  // File upload handling
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const content = await readFileContent(file);
      const concepts = await extractKeyConcepts(content);
      
      setUploadedContent({
        name: file.name,
        content,
        concepts
      });
    } catch (err) {
      setError('Failed to process file. Please try again.');
      console.error('Error processing file:', err);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'text/markdown': ['.md'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1
  });

  const readFileContent = async (file: File): Promise<string> => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    // Handle PDF files
    if (extension === 'pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }
      
      return fullText.trim();
    }
    
    // Handle DOC/DOCX files
    if (extension === 'doc' || extension === 'docx') {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    }
    
    // Handle text files (.txt, .md)
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        resolve(content);
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  // Generate flashcards from uploaded content
  const handleGenerateFlashcards = async () => {
    if (!uploadedContent) return;

    setIsGenerating(true);
    setError(null);

    try {
      const cards = await generateFlashcards(uploadedContent.content, numCards);
      
      const flashcardsWithIds: FlashCard[] = cards.map((card, index) => ({
        id: `card-${index}`,
        front: card.front,
        back: card.back,
        topic: uploadedContent.concepts[index % uploadedContent.concepts.length] || 'General'
      }));

      setFlashcards(flashcardsWithIds);
      setCurrentCardIndex(0);
      setIsFlipped(false);
    } catch (err) {
      setError('Failed to generate flashcards. Please try again.');
      console.error('Error generating flashcards:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate mock test from stored content
  const handleGenerateMockTest = async () => {
    if (!user) {
      setError('Please log in to generate a mock test.');
      return;
    }

    // Get content to use for mock test
    let contentToUse: StoredContent[] = [];
    
    if (selectedMaterials.length > 0) {
      // Use selected materials
      contentToUse = storedContents.filter(c => selectedMaterials.includes(c.id));
    } else if (storedContents.length > 0) {
      // Use all stored contents if none selected
      contentToUse = storedContents;
    } else if (uploadedContent) {
      // Fallback to uploaded content if no stored contents
      setError('Please select study materials for the mock test.');
      return;
    } else {
      setError('Please upload study materials first.');
      return;
    }

    setIsGeneratingMockTest(true);
    setError(null);

    try {
      // Combine content from all selected materials
      let combinedContent = '';
      let allTopics: string[] = [];
      
      contentToUse.forEach(content => {
        // If specific topics are selected, filter content
        if (selectedTopics.length > 0) {
          const relevantTopics = content.topics.filter(t => selectedTopics.includes(t.name));
          if (relevantTopics.length > 0) {
            combinedContent += relevantTopics.map(t => t.content).join('\n\n');
            allTopics.push(...relevantTopics.map(t => t.name));
          }
        } else {
          // Use all content from the material
          combinedContent += content.content.substring(0, 5000) + '\n\n';
          allTopics.push(...content.topics.map(t => t.name));
        }
      });

      if (!combinedContent.trim()) {
        setError('No content found for selected topics. Please select different materials.');
        setIsGeneratingMockTest(false);
        return;
      }

      const subject = allTopics.length > 0 ? allTopics.slice(0, 3).join(', ') : 'General';
      
      const questions = await generateQuizFromContent(
        combinedContent,
        mockTestQuestions,
        'medium',
        subject
      );

      const quiz: Quiz = {
        id: '',
        userId: user.id,
        title: `Mock Test: ${contentToUse.map(c => c.title).join(', ').substring(0, 50)}`,
        subject: subject,
        questions,
        createdAt: new Date(),
        sourceContent: contentToUse.map(c => c.fileName).join(', '),
        difficulty: 'medium'
      };

      const quizId = await saveQuiz(quiz);
      const savedQuiz = { ...quiz, id: quizId };

      setQuizzes(prev => [savedQuiz, ...prev]);
      setMockTestGenerated(true);
      
      // Reset selections
      setSelectedMaterials([]);
      setSelectedTopics([]);
      
      setTimeout(() => setMockTestGenerated(false), 3000);
    } catch (err) {
      setError('Failed to generate mock test. Please try again.');
      console.error('Error generating mock test:', err);
    } finally {
      setIsGeneratingMockTest(false);
    }
  };

  const toggleMaterialSelection = (contentId: string) => {
    setSelectedMaterials(prev => 
      prev.includes(contentId) 
        ? prev.filter(id => id !== contentId)
        : [...prev, contentId]
    );
  };

  const toggleTopicSelection = (topicName: string) => {
    setSelectedTopics(prev => 
      prev.includes(topicName) 
        ? prev.filter(t => t !== topicName)
        : [...prev, topicName]
    );
  };

  const selectAllMaterials = () => {
    setSelectedMaterials(storedContents.map(c => c.id));
  };

  const clearSelections = () => {
    setSelectedMaterials([]);
    setSelectedTopics([]);
  };

  const handleReset = () => {
    setFlashcards([]);
    setUploadedContent(null);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setError(null);
  };

  const handleNextCard = () => {
    if (flashcards.length === 0) return;
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentCardIndex((prev) => (prev + 1) % flashcards.length);
    }, 150);
  };

  const handlePrevCard = () => {
    if (flashcards.length === 0) return;
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentCardIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
    }, 150);
  };

  const currentCard = flashcards[currentCardIndex];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-800">AI-Powered Revision Assistant</h2>
                <p className="text-xs text-gray-500">Generate flashcards and scheduled revision</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {dueRevisions.length > 0 && (
                <div className="px-3 py-1.5 bg-orange-50 rounded-lg flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-orange-600" />
                  <span className="text-xs font-medium text-orange-700">{dueRevisions.length} Due Today</span>
                </div>
              )}
              <div className="px-3 py-1.5 bg-green-50 rounded-lg flex items-center gap-1.5">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-green-700">Gemini AI</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveRevisionTab('flashcards')}
            className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeRevisionTab === 'flashcards'
                ? 'text-orange-600 border-b-2 border-orange-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Brain className="w-4 h-4" />
            Flashcards
          </button>
          <button
            onClick={() => setActiveRevisionTab('schedule')}
            className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeRevisionTab === 'schedule'
                ? 'text-orange-600 border-b-2 border-orange-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Daily Schedule
            {dueRevisions.length > 0 && (
              <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs">
                {dueRevisions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveRevisionTab('mocktest')}
            className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeRevisionTab === 'mocktest'
                ? 'text-orange-600 border-b-2 border-orange-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Target className="w-4 h-4" />
            Mock Test
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button 
            onClick={() => setError(null)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      {/* Schedule Tab Content */}
      {activeRevisionTab === 'schedule' && (
        <div className="space-y-6">
          {/* Revision Summary */}
          {revisionSummary && (
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-6 text-white">
              <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                <Flame className="w-5 h-5" />
                Today's Revision Focus
              </h3>
              <p className="text-white/90 text-sm mb-4">{revisionSummary.summary}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/20 rounded-xl p-4">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                    <Target className="w-4 h-4" />
                    Focus Topics
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {revisionSummary.focusTopics.map((topic, i) => (
                      <span key={i} className="px-2 py-1 bg-white/30 rounded text-xs">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="bg-white/20 rounded-xl p-4">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    Suggested Actions
                  </h4>
                  <ul className="space-y-1">
                    {revisionSummary.suggestedActions.slice(0, 3).map((action, i) => (
                      <li key={i} className="text-xs flex items-start gap-1">
                        <span className="text-white/70">•</span>
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              
              {dueRevisions.length > 0 && !isDoingRevision && (
                <button
                  onClick={startRevisionSession}
                  className="mt-4 w-full py-3 bg-white text-orange-600 rounded-xl font-medium hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  Start Revision Session ({dueRevisions.length} topics)
                </button>
              )}
            </div>
          )}

          {/* Active Revision Session */}
          {isDoingRevision && dueRevisions.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">
                  Revision {currentRevisionIndex + 1} of {dueRevisions.length}
                </h3>
                <button
                  onClick={() => setIsDoingRevision(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Exit Session
                </button>
              </div>
              
              <div className="mb-6">
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div 
                    className="bg-orange-500 h-2 rounded-full transition-all"
                    style={{ width: `${((currentRevisionIndex + 1) / dueRevisions.length) * 100}%` }}
                  />
                </div>
              </div>
              
              <div className="text-center py-8 bg-gray-50 rounded-xl mb-6">
                <p className="text-sm text-gray-500 mb-2">Topic to Review</p>
                <h4 className="text-2xl font-bold text-gray-800 mb-2">
                  {dueRevisions[currentRevisionIndex]?.topicName}
                </h4>
                <p className="text-sm text-gray-500">
                  Current Mastery: {dueRevisions[currentRevisionIndex]?.masteryLevel}%
                </p>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm text-gray-600 text-center mb-4">How well did you recall this topic?</p>
                <div className="grid grid-cols-6 gap-2">
                  {[0, 1, 2, 3, 4, 5].map((quality) => (
                    <button
                      key={quality}
                      onClick={() => handleCompleteRevision(dueRevisions[currentRevisionIndex].id, quality)}
                      className={`py-3 rounded-lg text-sm font-medium transition-colors ${
                        quality < 2 ? 'bg-red-100 text-red-700 hover:bg-red-200' :
                        quality < 4 ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' :
                        'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {quality === 0 ? '😞' : quality === 1 ? '😕' : quality === 2 ? '🤔' : 
                       quality === 3 ? '😊' : quality === 4 ? '😄' : '🎉'}
                      <br />
                      <span className="text-xs">{quality}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 text-center mt-2">
                  0 = Complete blackout, 5 = Perfect recall
                </p>
              </div>
            </div>
          )}

          {/* Due Revisions List */}
          {!isDoingRevision && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-orange-600" />
                Scheduled Revisions
              </h3>
              
              {isLoadingRevisions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                </div>
              ) : dueRevisions.length > 0 ? (
                <div className="space-y-3">
                  {dueRevisions.map((revision, index) => (
                    <div 
                      key={revision.id || index}
                      className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-orange-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            revision.masteryLevel >= 70 ? 'bg-green-100' :
                            revision.masteryLevel >= 40 ? 'bg-yellow-100' : 'bg-red-100'
                          }`}>
                            <Brain className={`w-5 h-5 ${
                              revision.masteryLevel >= 70 ? 'text-green-600' :
                              revision.masteryLevel >= 40 ? 'text-yellow-600' : 'text-red-600'
                            }`} />
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{revision.topicName}</p>
                            <p className="text-xs text-gray-500">
                              Review #{revision.reviewCount + 1} · Interval: {revision.interval} days
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                            revision.masteryLevel >= 70 ? 'bg-green-100 text-green-700' :
                            revision.masteryLevel >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {revision.masteryLevel}% Mastery
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Award className="w-8 h-8 text-green-600" />
                  </div>
                  <p className="text-gray-600 font-medium">All caught up!</p>
                  <p className="text-sm text-gray-500 mt-1">No revisions due. Upload materials to create a schedule.</p>
                </div>
              )}
            </div>
          )}

          {/* Stored Materials Overview */}
          {storedContents.length > 0 && !isDoingRevision && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                Your Study Materials ({storedContents.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {storedContents.slice(0, 4).map((content) => (
                  <div 
                    key={content.id}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <p className="font-medium text-sm text-gray-800 truncate">{content.title}</p>
                    </div>
                    <p className="text-xs text-gray-500">
                      {content.topics.length} topics · {new Date(content.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Flashcards Tab Content */}
      {activeRevisionTab === 'flashcards' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Upload & Flashcards */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upload Section */}
          {flashcards.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Upload Study Material</h3>
              
              {!uploadedContent ? (
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    isDragActive 
                      ? 'border-orange-500 bg-orange-50' 
                      : 'border-gray-200 hover:border-orange-400 hover:bg-orange-50/50'
                  }`}
                >
                  <input {...getInputProps()} />
                  {isProcessing ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
                      <p className="text-sm text-gray-600">Processing your file...</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 mb-1">
                        {isDragActive ? 'Drop your file here' : 'Drag & drop your study material'}
                      </p>
                      <p className="text-sm text-gray-400">or click to browse (TXT, PDF, MD, DOC)</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Uploaded file info */}
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{uploadedContent.name}</p>
                      <p className="text-xs text-gray-500">{uploadedContent.concepts.length} concepts detected</p>
                    </div>
                    <button
                      onClick={handleReset}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Detected concepts */}
                  {uploadedContent.concepts.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Key Concepts Detected:</p>
                      <div className="flex flex-wrap gap-2">
                        {uploadedContent.concepts.slice(0, 8).map((concept, index) => (
                          <span 
                            key={index}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
                          >
                            {concept}
                          </span>
                        ))}
                        {uploadedContent.concepts.length > 8 && (
                          <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                            +{uploadedContent.concepts.length - 8} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Number of cards selector */}
                  <div className="flex items-center gap-4">
                    <label className="text-sm text-gray-600">Number of flashcards:</label>
                    <select
                      value={numCards}
                      onChange={(e) => setNumCards(parseInt(e.target.value))}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value={5}>5 cards</option>
                      <option value={10}>10 cards</option>
                      <option value={15}>15 cards</option>
                      <option value={20}>20 cards</option>
                    </select>
                  </div>

                  {/* Generate button */}
                  <button
                    onClick={handleGenerateFlashcards}
                    disabled={isGenerating}
                    className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating Flashcards...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Generate AI Flashcards
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Flashcards Section */}
          {flashcards.length > 0 && currentCard && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-gray-800">Flashcards</h3>
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                    AI Generated
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">{currentCardIndex + 1} / {flashcards.length}</span>
                  <button
                    onClick={handleReset}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Generate new flashcards"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Flashcard */}
              <div 
                className="relative h-56 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 cursor-pointer mb-4 shadow-lg shadow-blue-500/30 overflow-hidden transform transition-transform hover:scale-[1.02]"
                onClick={() => setIsFlipped(!isFlipped)}
              >
                {/* Decorative elements */}
                <div className="absolute top-4 right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
                <div className="absolute bottom-4 left-4 w-16 h-16 bg-white/10 rounded-full blur-xl"></div>
                
                <div className="relative z-10 h-full flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-1 bg-white/20 rounded-lg text-xs text-white font-medium">
                      {currentCard.topic}
                    </span>
                    <span className="text-white/60 text-xs">Click to flip</span>
                  </div>
                  <div className="flex-1 flex items-center justify-center px-4">
                    <p className="text-white text-center font-medium text-lg leading-relaxed">
                      {isFlipped ? currentCard.back : currentCard.front}
                    </p>
                  </div>
                  <div className="flex justify-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      isFlipped 
                        ? 'bg-green-400/30 text-green-100' 
                        : 'bg-white/20 text-white/80'
                    }`}>
                      {isFlipped ? '✓ Answer' : '? Question'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={handlePrevCard}
                  disabled={flashcards.length <= 1}
                  className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Previous
                </button>
                <div className="flex gap-1 max-w-xs overflow-hidden">
                  {flashcards.slice(0, 15).map((_, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setIsFlipped(false);
                        setCurrentCardIndex(index);
                      }}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        index === currentCardIndex ? 'bg-blue-600' : 'bg-gray-200 hover:bg-gray-300'
                      }`}
                    />
                  ))}
                  {flashcards.length > 15 && (
                    <span className="text-xs text-gray-400 ml-1">...</span>
                  )}
                </div>
                <button
                  onClick={handleNextCard}
                  disabled={flashcards.length <= 1}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Weak Topics from Quiz History */}
          {weakTopics.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-red-500" />
                <h3 className="font-semibold text-gray-800">Topics to Review</h3>
                <span className="text-xs text-gray-500">(from quiz history)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {weakTopics.map((topic, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        topic.score < 50 ? 'bg-red-500' : 
                        topic.score < 70 ? 'bg-orange-500' : 'bg-yellow-500'
                      }`}></div>
                      <span className="text-sm font-medium text-gray-700">{topic.name}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      topic.score < 50 ? 'bg-red-100 text-red-700' : 
                      topic.score < 70 ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {topic.score}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Mock Test & Stats */}
        <div className="space-y-6">
          {/* Mock Test */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Generate Mock Test</h3>
                <p className="text-xs text-gray-500">20 AI-generated questions</p>
              </div>
            </div>
            
            {mockTestGenerated ? (
              <div className="w-full py-3 bg-green-100 text-green-700 rounded-xl font-medium flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Mock Test Created! Check Quiz Generator.
              </div>
            ) : (
              <button 
                onClick={handleGenerateMockTest}
                disabled={!uploadedContent || isGeneratingMockTest}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingMockTest ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Generate Mock Test
                  </>
                )}
              </button>
            )}
            
            {!uploadedContent && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                Upload study material first
              </p>
            )}
          </div>

          {/* Recent Quizzes */}
          {quizzes.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Recent Quizzes</h3>
              <p className="text-xs text-gray-500 mb-3">Click to take a quiz</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {quizzes.slice(0, 5).map((quiz, index) => (
                  <div 
                    key={quiz.id || index} 
                    onClick={() => setActiveTab('quiz')}
                    className="flex items-center gap-3 p-2 hover:bg-purple-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-purple-200"
                  >
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Brain className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{quiz.title}</p>
                      <p className="text-xs text-gray-500">{quiz.questions.length} questions</p>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white rounded-lg text-xs font-medium">
                      <Play className="w-3 h-3" />
                      Take
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Session Stats */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Session Stats</h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="text-sm text-gray-600">Cards Reviewed</span>
                </div>
                <span className="font-bold text-gray-800">
                  {flashcards.length > 0 ? currentCardIndex + 1 : 0}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Brain className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="text-sm text-gray-600">Total Flashcards</span>
                </div>
                <span className="font-bold text-gray-800">{flashcards.length}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Flame className="w-4 h-4 text-orange-600" />
                  </div>
                  <span className="text-sm text-gray-600">Study Streak</span>
                </div>
                <span className="font-bold text-gray-800">{learningProgress?.streakDays || 0} days</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-sm text-gray-600">Quizzes Taken</span>
                </div>
                <span className="font-bold text-gray-800">{quizzes.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Mock Test Tab Content */}
      {activeRevisionTab === 'mocktest' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Material Selection */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-600" />
                  Select Study Materials
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={selectAllMaterials}
                    className="text-xs px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    onClick={clearSelections}
                    className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {storedContents.length > 0 ? (
                <div className="space-y-3">
                  {storedContents.map((content) => (
                    <div
                      key={content.id}
                      onClick={() => toggleMaterialSelection(content.id)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedMaterials.includes(content.id)
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          selectedMaterials.includes(content.id)
                            ? 'bg-purple-600 border-purple-600'
                            : 'border-gray-300'
                        }`}>
                          {selectedMaterials.includes(content.id) && (
                            <CheckCircle className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-800">{content.title}</p>
                          <p className="text-xs text-gray-500">{content.fileName} · {content.topics.length} topics</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {content.topics.slice(0, 4).map((topic, i) => (
                              <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                {topic.name}
                              </span>
                            ))}
                            {content.topics.length > 4 && (
                              <span className="text-xs text-gray-400">+{content.topics.length - 4} more</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No study materials uploaded yet</p>
                  <button
                    onClick={() => setActiveTab('quiz')}
                    className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
                  >
                    Upload Materials
                  </button>
                </div>
              )}
            </div>

            {/* Topic Selection (if materials selected) */}
            {selectedMaterials.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Brain className="w-5 h-5 text-blue-600" />
                  Select Specific Topics (Optional)
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Leave empty to include all topics, or select specific topics to focus on.
                </p>
                <div className="flex flex-wrap gap-2">
                  {storedContents
                    .filter(c => selectedMaterials.includes(c.id))
                    .flatMap(c => c.topics)
                    .map((topic, i) => (
                      <button
                        key={i}
                        onClick={() => toggleTopicSelection(topic.name)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          selectedTopics.includes(topic.name)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {topic.name}
                      </button>
                    ))}
                </div>
                {selectedTopics.length > 0 && (
                  <p className="text-sm text-blue-600 mt-3">
                    {selectedTopics.length} topic{selectedTopics.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
            )}

            {/* Generate Button */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 text-lg">Generate Mock Test</h3>
                  <p className="text-sm text-gray-500">
                    {selectedMaterials.length > 0 
                      ? `${selectedMaterials.length} material(s) selected`
                      : 'Select materials above to generate a test'}
                  </p>
                </div>
              </div>

              {/* Question Count Selector */}
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Number of Questions</label>
                <div className="flex gap-2">
                  {[10, 15, 20, 30].map(num => (
                    <button
                      key={num}
                      onClick={() => setMockTestQuestions(num)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        mockTestQuestions === num
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {mockTestGenerated ? (
                <div className="w-full py-4 bg-green-100 text-green-700 rounded-xl font-medium flex items-center justify-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Mock Test Created! Check Quiz Generator.
                </div>
              ) : (
                <button 
                  onClick={handleGenerateMockTest}
                  disabled={isGeneratingMockTest || selectedMaterials.length === 0}
                  className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingMockTest ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating {mockTestQuestions} Questions...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate Mock Test ({mockTestQuestions} Questions)
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Mock Test Info */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h4 className="font-semibold text-gray-800 mb-4">Mock Test Features</h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Target className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800 text-sm">Custom Question Count</p>
                    <p className="text-xs text-gray-500">10, 15, 20, or 30 questions</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800 text-sm">Select Materials</p>
                    <p className="text-xs text-gray-500">Choose specific PDFs or all</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Brain className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800 text-sm">Topic Filtering</p>
                    <p className="text-xs text-gray-500">Focus on specific topics</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800 text-sm">Track Progress</p>
                    <p className="text-xs text-gray-500">Results saved to analytics</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Selection Summary */}
            {selectedMaterials.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Selection Summary
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Materials:</span>
                    <span className="font-medium text-gray-800">{selectedMaterials.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Topics:</span>
                    <span className="font-medium text-gray-800">
                      {selectedTopics.length > 0 
                        ? selectedTopics.length
                        : storedContents.filter(c => selectedMaterials.includes(c.id)).flatMap(c => c.topics).length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Questions:</span>
                    <span className="font-medium text-gray-800">{mockTestQuestions}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Weekly/Monthly Schedule */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-orange-600" />
                Revision Schedule
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <span className="text-sm text-gray-700">Daily Review</span>
                  <span className="text-xs font-medium text-orange-600">
                    {dueRevisions.filter(r => r.interval <= 1).length} topics
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <span className="text-sm text-gray-700">Weekly Review</span>
                  <span className="text-xs font-medium text-blue-600">
                    {dueRevisions.filter(r => r.interval <= 7 && r.interval > 1).length} topics
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <span className="text-sm text-gray-700">Monthly Review</span>
                  <span className="text-xs font-medium text-purple-600">
                    {dueRevisions.filter(r => r.interval > 7).length} topics
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RevisionMode;
