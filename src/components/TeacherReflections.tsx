import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, 
  Plus, 
  Save, 
  Trash2, 
  Calendar, 
  ChevronRight, 
  ChevronDown, 
  MessageSquare,
  TrendingUp,
  ShieldAlert,
  Clock,
  History,
  PenLine,
  FileDown,
  Printer
} from 'lucide-react';
import { TeacherReflection, ClassType, Teacher, SchoolInfo, Student, StudentAssessment } from '../types';
import { DbController } from '../db';
import { generatePdfFromHtml, downloadBlobLocally } from '../pdfHelper';
import { getWatermarkHtml, formatIdentifiableFilename } from '../utils';
import SmartTextarea from './SmartTextarea';
function RichTextEditor({ value, onChange, placeholder }: { value: string; onChange: (val: string) => void; placeholder?: string }) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [spellCheckResults, setSpellCheckResults] = useState<{
    errors: Array<{ word: string; suggestions: string[] }>;
    correctedText: string;
  } | null>(null);
  const [hasChecked, setHasChecked] = useState(false);
  const [autoCheck, setAutoCheck] = useState(true);

  const insertTag = (openTag: string, closeTag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    
    const selectedText = text.substring(start, end);
    const replacement = openTag + selectedText + closeTag;
    
    const newValue = text.substring(0, start) + replacement + text.substring(end);
    onChange(newValue);
    
    // Reset focus and selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + openTag.length, start + openTag.length + selectedText.length);
    }, 0);
  };

  const handleSpellCheck = async () => {
    if (!value.trim()) {
      setSpellCheckResults(null);
      setHasChecked(false);
      return;
    }
    setIsChecking(true);
    try {
      const res = await fetch('/api/spellcheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: value })
      });
      if (res.ok) {
        const data = await res.json();
        setSpellCheckResults(data);
        setHasChecked(true);
      } else {
        console.error("Failed to fetch spelling check");
      }
    } catch (e) {
      console.error("Spelling check error", e);
    } finally {
      setIsChecking(false);
    }
  };

  const applyCorrection = (word: string, replacement: string) => {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    const newValue = value.replace(regex, replacement);
    onChange(newValue);
    
    if (spellCheckResults) {
      setSpellCheckResults({
        ...spellCheckResults,
        errors: spellCheckResults.errors.filter(err => err.word !== word)
      });
    }
  };

  const applyAllCorrections = () => {
    if (spellCheckResults?.correctedText) {
      onChange(spellCheckResults.correctedText);
      setSpellCheckResults({
        errors: [],
        correctedText: spellCheckResults.correctedText
      });
    }
  };

  React.useEffect(() => {
    if (!autoCheck) {
      setSpellCheckResults(null);
      setHasChecked(false);
      return;
    }
    
    if (!value.trim()) {
      setSpellCheckResults(null);
      setHasChecked(false);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      handleSpellCheck();
    }, 1200);

    return () => clearTimeout(delayDebounceFn);
  }, [value, autoCheck]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all font-sans">
      <div className="bg-slate-50 border-b border-slate-200 p-2 flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-1.5 items-center">
          <button
            type="button"
            onClick={() => insertTag('<b>', '</b>')}
            className="p-1 px-2.5 rounded text-xs font-bold text-slate-700 hover:bg-slate-200 transition-all cursor-pointer"
            title="Bold (<b>)"
          >
            B
          </button>
          <button
            type="button"
            onClick={() => insertTag('<i>', '</i>')}
            className="p-1 px-2.5 rounded text-xs italic text-slate-700 hover:bg-slate-200 transition-all cursor-pointer"
            title="Italic (<i>)"
          >
            I
          </button>
          <button
            type="button"
            onClick={() => insertTag('<u>', '</u>')}
            className="p-1 px-2.5 rounded text-xs underline text-slate-700 hover:bg-slate-200 transition-all cursor-pointer"
            title="Underline (<u>)"
          >
            U
          </button>
          <div className="h-4 w-px bg-slate-300 mx-1" />
          <button
            type="button"
            onClick={() => insertTag('<h3>', '</h3>')}
            className="p-1 px-1.5 rounded text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-200 transition-all cursor-pointer"
            title="Header (<h3>)"
          >
            H3
          </button>
          <button
            type="button"
            onClick={() => insertTag('<ul>\n  <li>', '</li>\n</ul>')}
            className="p-1 px-1.5 rounded text-xs text-slate-700 hover:bg-slate-200 transition-all cursor-pointer"
            title="Bullet List (<ul><li>)"
          >
            • List
          </button>
          <button
            type="button"
            onClick={() => insertTag('<blockquote>', '</blockquote>')}
            className="p-1 px-1.5 rounded text-xs text-slate-700 hover:bg-slate-200 transition-all cursor-pointer"
            title="Blockquote (<blockquote>)"
          >
            " Quote
          </button>
          <button
            type="button"
            onClick={() => insertTag('<br />', '')}
            className="p-1 px-1.5 rounded text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-200 transition-all cursor-pointer"
            title="Line Break (<br />)"
          >
            Line Break
          </button>
        </div>

        {/* Spelling Controls */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoCheck}
              onChange={(e) => setAutoCheck(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span className="text-[10px] font-bold text-slate-650 tracking-tight">Auto Spellcheck</span>
          </label>

          <button
            type="button"
            onClick={handleSpellCheck}
            disabled={isChecking}
            className="text-[10px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-800 transition disabled:opacity-50 flex items-center gap-1 cursor-pointer"
          >
            {isChecking ? (
              <>
                <svg className="animate-spin h-3 w-3 text-indigo-650" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Checking...
              </>
            ) : (
              "Check Now"
            )}
          </button>
          <div className="h-4 w-px bg-slate-300 mx-1" />
          <span className="text-[9px] font-mono text-slate-400 select-none pr-1">HTML Enabled</span>
        </div>
      </div>
      
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck="true"
        className="w-full h-40 p-4 text-xs font-mono bg-white outline-none border-none resize-y leading-relaxed text-slate-800"
      />

      {/* Spelling feedback panel */}
      {(isChecking || (hasChecked && spellCheckResults)) && (
        <div className="bg-slate-50 border-t border-slate-150 p-3 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              Spelling Assistant Feedback
            </span>
            {spellCheckResults && spellCheckResults.errors && spellCheckResults.errors.length > 0 && (
              <button
                type="button"
                onClick={applyAllCorrections}
                className="text-[9px] bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded-md font-bold transition flex items-center gap-1"
              >
                ✨ Apply All Auto-Corrections
              </button>
            )}
          </div>

          {isChecking && !spellCheckResults && (
            <div className="text-slate-500 italic text-[11px] animate-pulse flex items-center gap-1.5 py-1">
              Analyzing text spelling and grammar patterns...
            </div>
          )}

          {spellCheckResults && (
            <div>
              {spellCheckResults.errors && spellCheckResults.errors.length > 0 ? (
                <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                  {spellCheckResults.errors.map((err, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-700 bg-white p-1.5 rounded border border-slate-150 shadow-3xs">
                      <span className="text-red-500 font-bold line-through px-1 bg-red-50 rounded">{err.word}</span>
                      <span className="text-slate-400">→</span>
                      <div className="flex flex-wrap gap-1">
                        {err.suggestions.map((sug, sIdx) => (
                          <button
                            key={sIdx}
                            type="button"
                            onClick={() => applyCorrection(err.word, sug)}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer"
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-emerald-650 font-semibold text-[11px] flex items-center gap-1 py-1">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  Excellent! No spelling mistakes detected.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TeacherReflectionsProps {
  teacher: Teacher;
  reflections: TeacherReflection[];
  schoolInfo: SchoolInfo;
  onRefresh: () => void;
}

export default function TeacherReflections({ teacher, reflections, schoolInfo, onRefresh }: TeacherReflectionsProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<TeacherReflection['category']>('General');
  const [strategyTitle, setStrategyTitle] = useState('');
  const [selectedClass, setSelectedClass] = useState<ClassType | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Performance Linking State
  const [showLinkPerformance, setShowLinkPerformance] = useState(false);
  const [linkedStudentIds, setLinkedStudentIds] = useState<string[]>([]);
  const [linkedAssessmentIds, setLinkedAssessmentIds] = useState<string[]>([]);
  const [performanceSummary, setPerformanceSummary] = useState('');

  // Data fetching for linking
  const students = useMemo(() => DbController.getStudents(), []);
  const assessments = useMemo(() => DbController.getAssessments(), []);
  const calendar = useMemo(() => DbController.getAcademicCalendar(), []);

  const classStudents = useMemo(() => {
    if (!selectedClass) return [];
    return students.filter(s => s.class === selectedClass);
  }, [selectedClass, students]);

  const classAssessments = useMemo(() => {
    if (!selectedClass) return [];
    return assessments.filter(a => 
      a.class === selectedClass && 
      a.academicYear === calendar.activeAcademicYear && 
      a.term === calendar.activeTerm
    );
  }, [selectedClass, assessments, calendar]);

  // Period filtering
  const [period, setPeriod] = useState<'all' | 'month' | 'week'>('all');

  const filteredReflections = useMemo(() => {
    let list = reflections.filter(r => r.teacherId === teacher.id);
    
    if (period === 'month') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      list = list.filter(r => new Date(r.createdAt) >= thirtyDaysAgo);
    } else if (period === 'week') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      list = list.filter(r => new Date(r.createdAt) >= sevenDaysAgo);
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [reflections, teacher.id, period]);

  const teacherReflections = filteredReflections;

  const handleSave = () => {
    if (!content.trim() || (category === 'Weekly Strategy' && !strategyTitle.trim())) {
      alert(category === 'Weekly Strategy' ? 'Please provide a title for your strategy.' : 'Please provide content for your reflection.');
      return;
    }
    
    setIsSubmitting(true);
    const newReflection: TeacherReflection = {
      id: `refl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      teacherId: teacher.id,
      teacherName: DbController.formatTeacherFullName(teacher),
      date: new Date().toISOString().split('T')[0],
      content: content.trim(),
      category,
      weeklyStrategyTitle: category === 'Weekly Strategy' ? strategyTitle : undefined,
      linkedStudentIds: linkedStudentIds.length > 0 ? linkedStudentIds : undefined,
      linkedAssessmentIds: linkedAssessmentIds.length > 0 ? linkedAssessmentIds : undefined,
      performanceSummary: performanceSummary.trim() || undefined,
      class: selectedClass || undefined,
      academicYear: calendar.activeAcademicYear,
      term: calendar.activeTerm,
      createdAt: new Date().toISOString()
    };

    DbController.saveTeacherReflection(newReflection);
    
    // Reset states
    setTimeout(() => {
      setContent('');
      setStrategyTitle('');
      setLinkedStudentIds([]);
      setLinkedAssessmentIds([]);
      setPerformanceSummary('');
      setShowLinkPerformance(false);
      setIsAdding(false);
      setIsSubmitting(false);
      onRefresh();
    }, 500);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this reflection?')) {
      DbController.deleteTeacherReflection(id);
      onRefresh();
    }
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const filename = formatIdentifiableFilename({
        docType: 'Teacher Reflections Report',
        studentName: `${teacher.firstName || ''} ${teacher.lastName}`,
        date: new Date().toISOString().split('T')[0],
        extension: 'pdf'
      });
      const result = await generatePdfFromHtml('reflections-print-area', filename);
      downloadBlobLocally(result.blob, result.filename);
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
            <BookOpen size={20} />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Teacher Reflections</h3>
            <p className="text-xs text-slate-500 font-sans">Document class progress and behavior notes</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            {(['all', 'month', 'week'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  period === p 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {p === 'all' ? 'All' : p === 'month' ? '30D' : '7D'}
              </button>
            ))}
          </div>

          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf || teacherReflections.length === 0}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-100 transition-all disabled:opacity-50"
            title="Download PDF Report"
          >
            {isGeneratingPdf ? (
              <div className="w-4 h-4 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
            ) : (
              <FileDown size={18} />
            )}
          </button>

          <button
            onClick={() => setIsAdding(!isAdding)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              isAdding 
                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                : 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700'
            }`}
          >
            {isAdding ? (
              <>Cancel</>
            ) : (
              <><Plus size={14} /> New Entry</>
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            className="overflow-hidden"
          >
            <div className="bg-white border border-indigo-100 rounded-2xl p-6 shadow-xl shadow-indigo-50/50 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest font-mono">Category</label>
                  <div className="flex flex-wrap gap-2">
                    {(['Behavior', 'Learning Progress', 'General', 'Other', 'Weekly Strategy'] as const).map(cat => (
                      <button
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                          category === cat 
                            ? 'bg-indigo-600 border-indigo-600 text-white' 
                            : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest font-mono">Assigned Class (Required for strategies/linking)</label>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value as ClassType)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  >
                    <option value="">Select a class...</option>
                    {teacher.assignedClasses?.map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>
              </div>

              {category === 'Weekly Strategy' && (
                <motion.div 
                  initial={{ opacity: 0, y: -5 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-1"
                >
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest font-mono">Strategy Title</label>
                  <input
                    type="text"
                    value={strategyTitle}
                    onChange={(e) => setStrategyTitle(e.target.value)}
                    placeholder="e.g. Differentiated Math Instruction Week 4"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </motion.div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest font-mono">Journal Entry / Strategy Details</label>
                <RichTextEditor 
                  value={content}
                  onChange={setContent}
                  placeholder="Describe class behavior, learning breakthroughs, or detailed teaching strategies..."
                />
              </div>

              {selectedClass && (
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowLinkPerformance(!showLinkPerformance)}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 transition-all"
                  >
                    {showLinkPerformance ? <ChevronDown size={14} /> : <TrendingUp size={14} />}
                    {showLinkPerformance ? 'Hide Performance Linking' : 'Link Student Performance Data'}
                  </button>

                  <AnimatePresence>
                    {showLinkPerformance && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mt-3 space-y-4"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500">Target Students</label>
                            <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                              {classStudents.map(student => (
                                <label key={student.id} className="flex items-center gap-2 text-xs p-1 hover:bg-slate-50 rounded cursor-pointer">
                                  <input 
                                    type="checkbox"
                                    checked={linkedStudentIds.includes(student.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setLinkedStudentIds([...linkedStudentIds, student.id]);
                                      } else {
                                        setLinkedStudentIds(linkedStudentIds.filter(id => id !== student.id));
                                      }
                                    }}
                                    className="rounded border-slate-300 text-indigo-600"
                                  />
                                  <span>{student.firstName} {student.lastName}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500">Related Assessments</label>
                            <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                              {classAssessments.map(ass => (
                                <label key={ass.id} className="flex items-center gap-2 text-xs p-1 hover:bg-slate-50 rounded cursor-pointer">
                                  <input 
                                    type="checkbox"
                                    checked={linkedAssessmentIds.includes(ass.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setLinkedAssessmentIds([...linkedAssessmentIds, ass.id]);
                                      } else {
                                        setLinkedAssessmentIds(linkedAssessmentIds.filter(id => id !== ass.id));
                                      }
                                    }}
                                    className="rounded border-slate-300 text-indigo-600"
                                  />
                                  <span className="truncate">{ass.subject} - {ass.studentName} ({ass.totalScore}%)</span>
                                </label>
                              ))}
                              {classAssessments.length === 0 && (
                                <p className="text-[10px] text-slate-400 p-2 italic">No assessments found for current term.</p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest font-mono">Performance Impact Summary</label>
                          <SmartTextarea
                            value={performanceSummary}
                            onChange={(e: any) => setPerformanceSummary(e.target.value)}
                            placeholder="Briefly summarize how this reflection/strategy links to the data above..."
                            className="w-full h-20 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={isSubmitting || !content.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <><Save size={14} /> Save Reflection</>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Log */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2">
          <History size={14} className="text-slate-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">Recent Reflections</span>
        </div>
        
        <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
          {teacherReflections.map((refl) => (
            <div key={refl.id} className="p-4 hover:bg-slate-50/30 transition-colors group">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 cursor-pointer flex-1" onClick={() => setExpandedId(expandedId === refl.id ? null : refl.id)}>
                  <div className={`mt-1 p-1.5 rounded-lg shrink-0 ${
                    refl.category === 'Behavior' ? 'bg-rose-50 text-rose-500' :
                    refl.category === 'Learning Progress' ? 'bg-emerald-50 text-emerald-500' :
                    refl.category === 'Weekly Strategy' ? 'bg-indigo-50 text-indigo-500' :
                    'bg-slate-50 text-slate-500'
                  }`}>
                    {refl.category === 'Behavior' ? <TrendingUp size={14} /> :
                     refl.category === 'Learning Progress' ? <ShieldAlert size={14} /> :
                     refl.category === 'Weekly Strategy' ? <PenLine size={14} /> :
                     <MessageSquare size={14} />}
                  </div>
                  
                  <div className="space-y-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {refl.weeklyStrategyTitle || refl.category} 
                        {refl.class && <span className="text-indigo-500 ml-1">({refl.class})</span>}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                        <Clock size={10} /> {new Date(refl.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    
                    <div 
                      className={`text-xs text-slate-600 leading-relaxed font-sans prose prose-slate prose-xs max-w-none ${expandedId === refl.id ? '' : 'line-clamp-2'}`}
                      dangerouslySetInnerHTML={{ __html: refl.content }}
                    />

                    {expandedId === refl.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="pt-3 mt-3 border-t border-slate-100 space-y-3"
                      >
                        {refl.performanceSummary && (
                          <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-100/50">
                            <h5 className="text-[10px] font-bold text-amber-800 uppercase tracking-tight flex items-center gap-1.5 mb-1">
                              <TrendingUp size={12} /> Performance Link
                            </h5>
                            <p className="text-[11px] text-amber-900/80 italic">{refl.performanceSummary}</p>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          {refl.linkedStudentIds?.map(sid => {
                            const student = students.find(s => s.id === sid);
                            return student ? (
                              <span key={sid} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold">
                                {student.firstName} {student.lastName}
                              </span>
                            ) : null;
                          })}
                          {refl.linkedAssessmentIds?.map(aid => {
                            const ass = assessments.find(a => a.id === aid);
                            return ass ? (
                              <span key={aid} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-bold">
                                {ass.subject} ({ass.totalScore}%)
                              </span>
                            ) : null;
                          })}
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleDelete(refl.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    onClick={() => setExpandedId(expandedId === refl.id ? null : refl.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                  >
                    {expandedId === refl.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
          
          {teacherReflections.length === 0 && (
            <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-200 border border-slate-100">
                <PenLine size={32} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">No Journal Entries Yet</p>
                <p className="text-xs text-slate-400 max-w-[240px]">Start documenting your daily observations to track class growth over time.</p>
              </div>
              <button
                onClick={() => setIsAdding(true)}
                className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 hover:underline"
              >
                Create your first entry
              </button>
            </div>
          )}
        </div>
      </div>

      {/* PRINT-ONLY AREA */}
      <div id="reflections-print-area" className="hidden print:block fixed left-0 top-0 -z-[999999] opacity-0 pointer-events-none w-[210mm] bg-white text-black p-12 font-serif">
        <div className="absolute inset-0 z-0 pointer-events-none opacity-5" dangerouslySetInnerHTML={{ __html: getWatermarkHtml(schoolInfo?.logoUrl) }} />
        
        <div className="relative z-10">
          <div className="text-center border-b-2 border-slate-800 pb-4 mb-8">
            <h1 className="text-2xl font-bold uppercase tracking-tight">{schoolInfo.name}</h1>
            <p className="text-xs italic mt-1">{schoolInfo.motto}</p>
            <p className="text-[10px] font-mono mt-2">
              EMIS: {schoolInfo.emisCode} | {schoolInfo.gpsAddress}
            </p>
          </div>

          <div className="flex justify-between items-end mb-8 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Teacher Reflections Report</h2>
              <p className="text-sm text-slate-500 mt-1">Prepared by: <strong>{teacher.firstName} {teacher.lastName}</strong> ({teacher.staffId})</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Report Generated</p>
              <p className="text-xs font-bold">{new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
            </div>
          </div>

          <div className="space-y-8">
            {teacherReflections.map((refl, idx) => (
              <div key={refl.id} className="page-break-inside-avoid">
                <div className="flex items-center justify-between border-l-4 border-indigo-600 pl-4 mb-2">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 block">
                      {refl.category === 'Weekly Strategy' ? 'Teaching Strategy' : refl.category}
                    </span>
                    <h4 className="text-sm font-bold">
                      {refl.weeklyStrategyTitle || (refl.class ? `Class Note: ${refl.class}` : 'General Observation')}
                    </h4>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-slate-500">
                      {new Date(refl.createdAt).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-4">
                  <div 
                    className="text-sm leading-relaxed text-slate-800 prose prose-slate prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: refl.content }}
                  />
                  
                  {(refl.performanceSummary || (refl.linkedStudentIds && refl.linkedStudentIds.length > 0)) && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Performance Linking & Impact</h5>
                      {refl.performanceSummary && (
                        <p className="text-xs text-slate-700 italic mb-3">"{refl.performanceSummary}"</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {refl.linkedStudentIds?.map(sid => {
                          const student = students.find(s => s.id === sid);
                          return student ? (
                            <span key={sid} className="px-2 py-1 bg-white border border-slate-200 text-slate-600 rounded text-[9px] font-bold">
                              {student.firstName} {student.lastName}
                            </span>
                          ) : null;
                        })}
                        {refl.linkedAssessmentIds?.map(aid => {
                          const ass = assessments.find(a => a.id === aid);
                          return ass ? (
                            <span key={aid} className="px-2 py-1 bg-white border border-indigo-200 text-indigo-600 rounded text-[9px] font-bold">
                              {ass.subject} ({ass.totalScore}%)
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-20 pt-8 border-t border-slate-200 grid grid-cols-2 gap-12">
            <div className="text-center">
              <div className="h-12 border-b border-slate-300 mb-2"></div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Teacher Signature</p>
            </div>
            <div className="text-center">
              <div className="h-12 border-b border-slate-300 mb-2"></div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Head of Department / Principal</p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <p className="text-[9px] font-mono text-slate-400 italic">
              This report is a confidential professional document intended for academic review and student progress tracking.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
