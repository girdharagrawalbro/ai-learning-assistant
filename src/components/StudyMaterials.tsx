import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  FileText, 
  Folder,
  Trash2,
  Search,
  Loader2,
  Tag,
  Calendar,
  Eye,
  X,
  Plus
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { saveStudyMaterial, deleteStudyMaterial } from '../services/firebaseService';
import { extractKeyConcepts, summarizeContent } from '../services/geminiService';
import { StudyMaterial } from '../types';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Set up PDF.js worker for v5
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const StudyMaterials: React.FC = () => {
  const { user, studyMaterials, setStudyMaterials } = useApp();
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [viewingMaterial, setViewingMaterial] = useState<StudyMaterial | null>(null);
  const [materialSummary, setMaterialSummary] = useState<string>('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  
  // Upload form state
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadData, setUploadData] = useState({
    title: '',
    subject: '',
    type: 'notes' as 'notes' | 'textbook' | 'lecture' | 'article',
    content: '',
    tags: [] as string[],
    tagInput: ''
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

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    try {
      const content = await readFileContent(file);
      setUploadData(prev => ({
        ...prev,
        title: file.name.replace(/\.[^/.]+$/, ''),
        content
      }));
      setShowUploadForm(true);
    } catch (error) {
      console.error('Error reading file:', error);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1
  });

  const handleSaveMaterial = async () => {
    if (!user || !uploadData.title || !uploadData.content) return;
    
    setIsUploading(true);
    try {
      const concepts = await extractKeyConcepts(uploadData.content);
      
      const material: Omit<StudyMaterial, 'id'> = {
        userId: user.id,
        title: uploadData.title,
        content: uploadData.content,
        subject: uploadData.subject || 'General',
        uploadedAt: new Date(),
        type: uploadData.type,
        tags: [...uploadData.tags, ...concepts.slice(0, 5)]
      };

      const materialId = await saveStudyMaterial(material);
      
      setStudyMaterials(prev => [{ ...material, id: materialId }, ...prev]);
      setShowUploadForm(false);
      setUploadData({
        title: '',
        subject: '',
        type: 'notes',
        content: '',
        tags: [],
        tagInput: ''
      });
    } catch (error) {
      console.error('Error saving material:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    try {
      await deleteStudyMaterial(materialId);
      setStudyMaterials(prev => prev.filter(m => m.id !== materialId));
    } catch (error) {
      console.error('Error deleting material:', error);
    }
  };

  const handleViewMaterial = async (material: StudyMaterial) => {
    setViewingMaterial(material);
    setMaterialSummary('');
    
    // Generate summary
    setIsSummarizing(true);
    try {
      const summary = await summarizeContent(material.content, 'medium');
      setMaterialSummary(summary);
    } catch (error) {
      console.error('Error generating summary:', error);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleAddTag = () => {
    if (uploadData.tagInput.trim() && !uploadData.tags.includes(uploadData.tagInput.trim())) {
      setUploadData(prev => ({
        ...prev,
        tags: [...prev.tags, prev.tagInput.trim()],
        tagInput: ''
      }));
    }
  };

  const handleRemoveTag = (tag: string) => {
    setUploadData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };

  // Filter materials
  const filteredMaterials = studyMaterials.filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          m.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSubject = selectedSubject === 'all' || m.subject === selectedSubject;
    return matchesSearch && matchesSubject;
  });

  const subjects = ['all', ...new Set(studyMaterials.map(m => m.subject))];

  const typeIcons = {
    notes: '📝',
    textbook: '📚',
    lecture: '🎓',
    article: '📰'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                <Folder className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Study Materials</h2>
                <p className="text-blue-100">Upload and organize your learning resources</p>
              </div>
            </div>
            <button
              onClick={() => setShowUploadForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Material
            </button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search materials..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {subjects.map(subject => (
                <option key={subject} value={subject}>
                  {subject === 'all' ? 'All Subjects' : subject}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Upload Form Modal */}
      {showUploadForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-800">Add Study Material</h3>
              <button
                onClick={() => setShowUploadForm(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Drop Zone */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-300 hover:border-primary-400'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">Drag & drop a file or click to browse</p>
                <p className="text-sm text-gray-400 mt-1">Supports TXT, MD files</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={uploadData.title}
                    onChange={(e) => setUploadData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Material title"
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <input
                    type="text"
                    value={uploadData.subject}
                    onChange={(e) => setUploadData(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder="e.g., Biology, Math"
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <div className="flex gap-2">
                  {(['notes', 'textbook', 'lecture', 'article'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setUploadData(prev => ({ ...prev, type }))}
                      className={`flex-1 py-2 px-3 rounded-xl border text-sm font-medium transition-colors ${
                        uploadData.type === type
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-300 hover:border-primary-300'
                      }`}
                    >
                      {typeIcons[type]} {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                <textarea
                  value={uploadData.content}
                  onChange={(e) => setUploadData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Paste your study material here..."
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {uploadData.tags.map(tag => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm"
                    >
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)}>
                        <X className="w-3 h-3 text-gray-500" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={uploadData.tagInput}
                    onChange={(e) => setUploadData(prev => ({ ...prev, tagInput: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    placeholder="Add a tag"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowUploadForm(false)}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMaterial}
                disabled={isUploading || !uploadData.title || !uploadData.content}
                className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Material'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Material Modal */}
      {viewingMaterial && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-800">{viewingMaterial.title}</h3>
                <p className="text-sm text-gray-500">{viewingMaterial.subject}</p>
              </div>
              <button
                onClick={() => setViewingMaterial(null)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h4 className="font-medium text-blue-800 mb-2">AI Summary</h4>
                {isSummarizing ? (
                  <div className="flex items-center gap-2 text-blue-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating summary...
                  </div>
                ) : (
                  <p className="text-blue-700 text-sm whitespace-pre-wrap">{materialSummary}</p>
                )}
              </div>

              {/* Tags */}
              {viewingMaterial.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {viewingMaterial.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-600">
                      <Tag className="w-3 h-3 inline mr-1" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Content */}
              <div className="prose max-w-none">
                <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded-xl">
                  {viewingMaterial.content}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Materials Grid */}
      {filteredMaterials.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMaterials.map(material => (
            <div
              key={material.id}
              className="bg-white rounded-xl shadow p-5 card-hover group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{typeIcons[material.type]}</span>
                  <div>
                    <h4 className="font-semibold text-gray-800 line-clamp-1">{material.title}</h4>
                    <p className="text-sm text-gray-500">{material.subject}</p>
                  </div>
                </div>
              </div>

              <p className="text-gray-600 text-sm line-clamp-2 mb-3">
                {material.content.substring(0, 150)}...
              </p>

              <div className="flex flex-wrap gap-1 mb-4">
                {material.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {tag}
                  </span>
                ))}
                {material.tags.length > 3 && (
                  <span className="text-xs text-gray-400">+{material.tags.length - 3}</span>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Calendar className="w-3 h-3" />
                  {material.uploadedAt.toLocaleDateString()}
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleViewMaterial(material)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="View"
                  >
                    <Eye className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => handleDeleteMaterial(material.id)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow p-12 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No materials yet</h3>
          <p className="text-gray-500 mb-6">
            Upload your first study material to get started
          </p>
          <button
            onClick={() => setShowUploadForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-colors"
          >
            <Upload className="w-5 h-5" />
            Upload Material
          </button>
        </div>
      )}
    </div>
  );
};

export default StudyMaterials;
