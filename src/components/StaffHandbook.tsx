import React, { useState, useMemo, useEffect } from 'react';
import { StaffHandbookDocument, AttachedGoogleFile } from '../types';
import { DbController } from '../db';
import { ThemeStyles } from './ThemeWrapper';
import { 
  Plus, Trash2, FileText, BookOpen, Clock, AlertCircle, ChevronLeft, ChevronRight, Edit2, ShieldCheck, Download,
  CloudLightning, ExternalLink, Link2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerToast } from '../utils';
import { initGoogleAuth, googleSignIn, showGooglePicker, isGoogleAuthenticated } from '../googleDriveService';
import SmartTextarea from './SmartTextarea';

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
    category: 'Policy',
    attachedFiles: []
  });

  const [isGoogleAuth, setIsGoogleAuth] = useState(isGoogleAuthenticated());

  useEffect(() => {
    const unsub = initGoogleAuth((user, token) => {
      setIsGoogleAuth(!!token);
    });
    return () => unsub();
  }, []);

  const handleAttachGoogleFile = async () => {
    try {
      await showGooglePicker((file) => {
        const currentAttached = formState.attachedFiles || [];
        if (currentAttached.some(f => f.id === file.id)) {
          triggerToast('File is already attached.', 'info');
          return;
        }
        const newAttached: AttachedGoogleFile[] = [
          ...currentAttached,
          {
            id: file.id,
            name: file.name,
            url: file.url,
            mimeType: file.mimeType
          }
        ];
        setFormState({
          ...formState,
          attachedFiles: newAttached
        });
        triggerToast(`Attached "${file.name}"`, 'success');
      });
    } catch (err: any) {
      console.error(err);
      triggerToast(err.message || 'Failed to open Google Picker.', 'error');
    }
  };

  const currentUserEmail = DbController.getCurrentUser()?.email?.toLowerCase().trim();
  const isAdminOrHead = userRole === 'Admin' || userRole === 'Headteacher' || currentUserEmail === 'pegyirenyi@gmail.com';

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
      updatedBy: DbController.getCurrentUser()?.name || 'Admin',
      attachedFiles: formState.attachedFiles || []
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

    setFormState({ title: '', content: '', category: 'Policy', attachedFiles: [] });
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
      setFormState({
        ...doc,
        attachedFiles: doc.attachedFiles || []
      });
    } else {
      setFormState({ title: '', content: '', category: 'Policy', attachedFiles: [] });
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
              <SmartTextarea
                required
                value={formState.content}
                onChange={(e: any) => setFormState({...formState, content: e.target.value})}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition min-h-[300px] font-sans"
                placeholder="Enter document content here... (Line breaks will be preserved)"
              />
            </div>

            {/* Google Picker attachments integration */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <CloudLightning size={14} className="text-indigo-500" /> Attached Google Drive Resources
                  </h4>
                  <p className="text-[10px] text-slate-400">Attach handbooks, references, or curriculum outlines from Google Drive using Google Picker</p>
                </div>
                {isGoogleAuth ? (
                  <button
                    type="button"
                    onClick={handleAttachGoogleFile}
                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-lg transition cursor-pointer self-start"
                  >
                    <Plus size={14} /> Choose from Drive
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await googleSignIn();
                      } catch (err) {
                        triggerToast('Authentication failed. Try opening the app in a new tab if inside an iframe.', 'error');
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold rounded-lg transition cursor-pointer shadow-2xs self-start"
                  >
                    {/* Material Google icon */}
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-3.5 h-3.5 flex-shrink-0">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    </svg>
                    <span>Connect Google Drive</span>
                  </button>
                )}
              </div>
              
              {formState.attachedFiles && formState.attachedFiles.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {formState.attachedFiles.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText size={15} className="text-slate-400 flex-shrink-0" />
                        <div className="truncate text-xs">
                          <p className="font-bold text-slate-700 truncate leading-snug">{file.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono truncate">{file.mimeType.split('/').pop() || 'file'}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFormState({
                            ...formState,
                            attachedFiles: (formState.attachedFiles || []).filter(f => f.id !== file.id)
                          });
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition flex-shrink-0 cursor-pointer"
                        title="Remove attachment"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-[11px] text-slate-400 italic">No Google Drive files attached to this document yet.</p>
                </div>
              )}
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
                
                <div className="p-8 flex-1 overflow-y-auto prose prose-slate max-w-none prose-sm sm:prose-base custom-scrollbar space-y-6">
                  <div className="whitespace-pre-wrap text-slate-700 leading-relaxed font-serif">
                    {selectedDocument.content}
                  </div>

                  {selectedDocument.attachedFiles && selectedDocument.attachedFiles.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-slate-100 space-y-3 font-sans">
                      <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <CloudLightning size={14} className="text-indigo-500" /> Linked Google Drive Resources
                      </h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedDocument.attachedFiles.map((file) => (
                          <a
                            key={file.id}
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/80 hover:border-indigo-300 hover:bg-indigo-50/20 hover:shadow-2xs rounded-xl transition group text-left cursor-pointer"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <FileText size={18} className="text-indigo-500 flex-shrink-0" />
                              <div className="truncate">
                                <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-950 truncate leading-tight">{file.name}</p>
                                <p className="text-[9px] text-slate-400 font-mono uppercase tracking-wider truncate mt-0.5">{file.mimeType.split('/').pop() || 'resource'}</p>
                              </div>
                            </div>
                            <ExternalLink size={14} className="text-slate-400 group-hover:text-indigo-600 transition flex-shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
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
