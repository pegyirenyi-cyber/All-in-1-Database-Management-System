import React, { useState, useMemo, useEffect } from 'react';
import { StaffHandbookDocument } from '../types';
import { DbController } from '../db';
import { ThemeStyles } from './ThemeWrapper';
import { 
  Plus, Trash2, FileText, BookOpen, Clock, AlertCircle, ChevronLeft, ChevronRight, Edit2, ShieldCheck, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { triggerToast } from '../utils';

interface Props {
  theme: ThemeStyles;
  userRole?: string;
  onReadUpdate?: () => void;
}

export default function StaffHandbook({ theme, userRole, onReadUpdate }: Props) {
  const [documents, setDocuments] = useState<StaffHandbookDocument[]>(() => DbController.getStaffHandbook());
  const [isEditing, setIsEditing] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  
  const [readStatus, setReadStatus] = useState<Record<string, string>>(() => {
    const user = DbController.getCurrentUser();
    const userId = user?.uid || user?.email || 'anonymous';
    try {
      const data = localStorage.getItem(`sms_handbook_read_${userId}`);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  });

  const [formState, setFormState] = useState<Partial<StaffHandbookDocument>>({
    title: '',
    content: '',
    category: 'Policy'
  });

  const isAdminOrHead = userRole === 'Admin' || userRole === 'Headteacher';

  const categories = ['Policy', 'Mission Statement', 'Pedagogical Guideline', 'Other'];

  const selectedDocument = useMemo(() => {
    return documents.find(d => d.id === selectedDocId) || null;
  }, [documents, selectedDocId]);

  useEffect(() => {
    if (selectedDocId) {
      const doc = documents.find(d => d.id === selectedDocId);
      if (doc) {
        const user = DbController.getCurrentUser();
        const userId = user?.uid || user?.email || 'anonymous';
        if (readStatus[selectedDocId] !== doc.lastUpdated) {
          const updated = { ...readStatus, [selectedDocId]: doc.lastUpdated };
          setReadStatus(updated);
          try {
            localStorage.setItem(`sms_handbook_read_${userId}`, JSON.stringify(updated));
          } catch (e) {
            console.error(e);
          }
          if (onReadUpdate) {
            onReadUpdate();
          }
        }
      }
    }
  }, [selectedDocId, documents, readStatus, onReadUpdate]);

  const handleSaveDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.title || !formState.content || !formState.category) {
      triggerToast('Please fill in all required fields.', 'error');
      return;
    }

    const doc: StaffHandbookDocument = {
      id: formState.id || `doc_${Date.now()}`,
      title: formState.title,
      content: formState.content,
      category: formState.category as any,
      lastUpdated: new Date().toISOString(),
      updatedBy: DbController.getCurrentUser()?.name || 'Admin'
    };

    DbController.saveStaffHandbookDocument(doc);
    setDocuments(DbController.getStaffHandbook());
    setIsEditing(false);
    setSelectedDocId(doc.id);
    
    // Auto-mark as read for creator
    const user = DbController.getCurrentUser();
    const userId = user?.uid || user?.email || 'anonymous';
    const updated = { ...readStatus, [doc.id]: doc.lastUpdated };
    setReadStatus(updated);
    try {
      localStorage.setItem(`sms_handbook_read_${userId}`, JSON.stringify(updated));
    } catch (e) {}
    if (onReadUpdate) {
      onReadUpdate();
    }

    setFormState({ title: '', content: '', category: 'Policy' });
    triggerToast('Document saved successfully.', 'success');
  };

  const handleDeleteDocument = (id: string) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      DbController.deleteStaffHandbookDocument(id);
      setDocuments(DbController.getStaffHandbook());
      if (selectedDocId === id) setSelectedDocId(null);
      if (onReadUpdate) {
        onReadUpdate();
      }
      triggerToast('Document deleted.', 'success');
    }
  };

  const openEditor = (doc?: StaffHandbookDocument) => {
    if (doc) {
      setFormState(doc);
    } else {
      setFormState({ title: '', content: '', category: 'Policy' });
    }
    setIsEditing(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${theme.badgeBg} ${theme.badgeText} shadow-sm`}>
            <BookOpen size={24} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Staff Handbook</h2>
            <p className="text-xs text-slate-500 font-medium">School policies, guidelines, and reference materials</p>
          </div>
        </div>
        
        {isAdminOrHead && !isEditing && (
          <button
            onClick={() => openEditor()}
            className={`flex items-center gap-2 px-4 py-2 ${theme.btnColors} rounded-xl text-xs font-bold shadow-sm transition hover:scale-[1.02] active:scale-95`}
          >
            <Plus size={16} /> New Document
          </button>
        )}
      </div>

      {isEditing ? (
        <motion.div 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
        >
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">{formState.id ? 'Edit Document' : 'Create New Document'}</h3>
            <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600 transition">
              <ChevronLeft size={20} />
            </button>
          </div>
          
          <form onSubmit={handleSaveDocument} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Document Title <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formState.title}
                  onChange={e => setFormState({...formState, title: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
                  placeholder="e.g. Code of Conduct"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Category <span className="text-rose-500">*</span></label>
                <select
                  required
                  value={formState.category}
                  onChange={e => setFormState({...formState, category: e.target.value as any})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition appearance-none"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Document Content <span className="text-rose-500">*</span></label>
              <textarea
                required
                value={formState.content}
                onChange={e => setFormState({...formState, content: e.target.value})}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition min-h-[300px] font-sans"
                placeholder="Enter document content here... (Line breaks will be preserved)"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`px-6 py-2 ${theme.btnColors} rounded-xl text-xs font-bold shadow-sm transition`}
              >
                Save Document
              </button>
            </div>
          </form>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Document List Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[250px] lg:h-[600px]">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Directory</h4>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {documents.length > 0 ? (
                  documents.map(doc => {
                    const unread = !readStatus[doc.id] || new Date(doc.lastUpdated).getTime() > new Date(readStatus[doc.id]).getTime();
                    return (
                      <div 
                        key={doc.id}
                        onClick={() => setSelectedDocId(doc.id)}
                        className={`p-4 rounded-xl border cursor-pointer transition ${selectedDocId === doc.id ? 'border-indigo-500 bg-indigo-50/50 shadow-sm' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                      >
                        <div className="flex items-start gap-3">
                          <FileText size={16} className={selectedDocId === doc.id ? 'text-indigo-600 mt-0.5' : 'text-slate-400 mt-0.5'} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className={`text-sm font-bold truncate ${selectedDocId === doc.id ? 'text-indigo-900' : 'text-slate-800'}`}>{doc.title}</p>
                              {unread && (
                                <span className="flex-shrink-0 w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="New or updated document" />
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-1">
                              <p className="text-[10px] font-bold text-slate-500 uppercase">{doc.category}</p>
                              {unread && (
                                <span className="text-[8px] font-extrabold text-rose-600 bg-rose-50 px-1 rounded-sm uppercase tracking-wider scale-95">NEW</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 text-slate-400 flex flex-col items-center">
                    <BookOpen size={32} className="mb-3 opacity-20" />
                    <p className="text-sm font-medium">No documents found.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Document Viewer */}
          <div className="lg:col-span-2">
            {selectedDocument ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px] lg:min-h-[600px]">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-black text-slate-900">{selectedDocument.title}</h3>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="inline-block px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 uppercase">
                        {selectedDocument.category}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock size={12} /> Last updated: {new Date(selectedDocument.lastUpdated).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  
                  {isAdminOrHead && (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => openEditor(selectedDocument)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                        title="Edit Document"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteDocument(selectedDocument.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Delete Document"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="p-8 flex-1 overflow-y-auto prose prose-slate max-w-none prose-sm sm:prose-base custom-scrollbar">
                  <div className="whitespace-pre-wrap text-slate-700 leading-relaxed font-serif">
                    {selectedDocument.content}
                  </div>
                </div>
                
                <div className="p-4 border-t border-slate-100 bg-slate-50 text-xs text-slate-500 flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-500" /> Official School Document</span>
                  <span>Updated by: {selectedDocument.updatedBy}</span>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm h-[300px] lg:h-[600px] flex flex-col items-center justify-center text-slate-400">
                <FileText size={48} className="mb-4 opacity-20" />
                <p className="text-sm font-medium">Select a document from the directory to view.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
