import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Student, Teacher, StudentAssessment, ClassType, CLASSES, AcademicYearType, ACADEMIC_YEARS, AttendanceRecord, StudentFeeBill, TermType, TERMS, SubjectType, UserRole, ActivityLog, QuickNote, NoteCategory, TeacherReflection, LeaveRequest, CustomTask } from '../types';
import { DbController, getStorageItem, setStorageItem } from '../db';
import { ThemeStyles } from './ThemeWrapper';
import { motion, AnimatePresence } from 'framer-motion';
import { evaluateSubscription } from '../subscription';
import { MultiTermPerformanceLineChart } from './MultiTermPerformanceLineChart';
import Markdown from 'react-markdown';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area,
  ResponsiveContainer
} from 'recharts';
import { 
  TrendingUp, Users, Calendar, Coins, Percent, Award, Landmark, AlertCircle,
  FileCheck, Download, CreditCard, ChevronRight, ChevronDown, ChevronUp, CheckCircle2, CircleDollarSign,
  Clock, ShieldAlert, Key, ShieldCheck, RefreshCw, SlidersHorizontal, Eye, EyeOff, LayoutGrid,
  Search, BookOpen, UserCheck, GraduationCap, History, StickyNote, Pin, Plus, Trash2, Edit3, X, Tag,
  Bold, Italic, Heading, List, ListOrdered, CheckSquare, Code, Quote, Type, FileText, Megaphone, Bell, MapPin, Radio, Check, Database, Lock
} from 'lucide-react';

interface Props {
  theme: ThemeStyles;
  students: Student[];
  teachers?: Teacher[];
  attendance?: AttendanceRecord[];
  assessments?: StudentAssessment[];
  onRefresh: () => void;
  setActiveTab?: (tab: string) => void;
  setSettingsSubTab?: (tab: 'general' | 'accounts' | 'backup' | 'billing' | 'logs' | 'teachers') => void;
  assignedClass?: ClassType | 'None';
  assignedClasses?: ClassType[];
  assignedSubjects?: SubjectType[];
  userRole?: UserRole;
}

// ----------------------------------------------------
// BEAUTIFUL INTERACTIVE CUSTOM TOOLTIP MODULES
// ----------------------------------------------------

const EnrollmentTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) => {
  if (active && payload && payload.length) {
    const maleVal = payload.find(p => p.dataKey === 'Male')?.value || 0;
    const femaleVal = payload.find(p => p.dataKey === 'Female')?.value || 0;
    const total = maleVal + femaleVal;
    const malePercent = total > 0 ? ((maleVal / total) * 100).toFixed(0) : 0;
    const femalePercent = total > 0 ? ((femaleVal / total) * 100).toFixed(0) : 0;

    return (
      <div className="bg-slate-900 border border-slate-800 text-slate-100 p-3.5 rounded-xl shadow-xl max-w-xs font-sans text-xs space-y-2">
        <div className="border-b border-slate-800 pb-1.5 flex justify-between items-center gap-4">
          <span className="font-bold text-[12px] text-white uppercase tracking-wide">{label}</span>
          <span className="bg-indigo-500/25 text-indigo-300 font-bold px-2 py-0.5 rounded-md font-mono text-[10px]">
            Total: {total}
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-slate-300 font-medium">Male Students:</span>
            </div>
            <span className="font-bold text-white font-mono">{maleVal} <span className="text-[10px] text-slate-400 font-normal">({malePercent}%)</span></span>
          </div>
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-pink-500" />
              <span className="text-slate-300 font-medium">Female Students:</span>
            </div>
            <span className="font-bold text-white font-mono">{femaleVal} <span className="text-[10px] text-slate-400 font-normal">({femalePercent}%)</span></span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const GrowthTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) => {
  if (active && payload && payload.length) {
    const value = payload[0].value;
    return (
      <div className="bg-slate-900 border border-slate-800 text-slate-100 p-3.5 rounded-xl shadow-xl font-sans text-xs space-y-2">
        <div className="border-b border-slate-800 pb-1.5">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Academic Season</span>
          <span className="text-xs font-bold text-white">{label}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-slate-300 font-medium">Enrolled Students:</span>
          <span className="font-black text-white text-sm font-mono">{value}</span>
        </div>
      </div>
    );
  }
  return null;
};

const AttendanceTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const rate = data.rate;
    const hasActual = data.hasActual;
    const present = data.presentCount;
    const absent = data.absentCount;

    let statusLabel = 'Needs Attention';
    let statusColorClass = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    if (rate >= 95) {
      statusLabel = 'Outstanding';
      statusColorClass = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    } else if (rate >= 93) {
      statusLabel = 'Good Standing';
      statusColorClass = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    }

    return (
      <div className="bg-slate-900 border border-slate-800 text-slate-100 p-3.5 rounded-xl shadow-xl max-w-xs font-sans text-xs space-y-2">
        <div className="border-b border-slate-800 pb-1.5 flex justify-between items-center gap-4">
          <span className="font-bold text-[12px] text-white uppercase tracking-wide">{label || data.className}</span>
          <span className={`font-bold px-2 py-0.5 rounded-md text-[10px] border ${statusColorClass}`}>
            {statusLabel}
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-6">
            <span className="text-slate-300 font-medium">Session Attendance:</span>
            <span className="font-mono text-sm font-black text-white">{rate}%</span>
          </div>

          {hasActual ? (
            <div className="border-t border-slate-800 pt-1.5 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Marked Present:</span>
                <span className="font-mono text-emerald-400 font-bold">{present} students</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Marked Absent:</span>
                <span className="font-mono text-rose-400 font-bold">{absent} students</span>
              </div>
            </div>
          ) : (
            <div className="text-[9px] text-slate-400 leading-normal pt-1.5 border-t border-slate-800 italic font-medium">
              Showing standard historical average
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

const FeesTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) => {
  if (active && payload && payload.length) {
    const rawData = payload[0].payload;
    const billed = rawData.Billed || 0;
    const paid = rawData.Paid || 0;
    const outstanding = rawData.Outstanding || 0;
    const payRate = billed > 0 ? ((paid / billed) * 100).toFixed(1) : '0';

    return (
      <div className="bg-slate-900 border border-slate-800 text-slate-100 p-3.5 rounded-xl shadow-xl max-w-xs font-sans text-xs space-y-2">
        <div className="border-b border-slate-800 pb-1.5 flex justify-between items-center gap-4">
          <span className="font-bold text-[12px] text-white uppercase tracking-wide">{label || rawData.name}</span>
          <span className="bg-indigo-500/25 text-indigo-300 font-bold px-2 py-0.5 rounded-md font-mono text-[10px]">
            Paid: {payRate}%
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-slate-300 font-medium">Total Billed:</span>
            </div>
            <span className="font-bold text-white font-mono">GH¢{billed.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-300 font-medium">Total Paid:</span>
            </div>
            <span className="font-bold text-emerald-450 text-emerald-400 font-mono">GH¢{paid.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-slate-300 font-medium">Outstanding:</span>
            </div>
            <span className="font-bold text-rose-455 text-rose-400 font-mono">GH¢{outstanding.toLocaleString()}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const RatioTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-800 text-slate-100 p-3.5 rounded-xl shadow-xl font-sans text-xs space-y-2">
        <div className="pb-1 border-b border-slate-800">
          <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Portion Segment</span>
          <div className="flex items-center gap-1.5 font-bold text-white text-xs mt-0.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: data.color }} />
            {data.name}
          </div>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-slate-300 font-medium">Segment Amount:</span>
          <span className="font-black text-white font-mono">GH¢{data.value.toLocaleString()}</span>
        </div>
      </div>
    );
  }
  return null;
};

const PerformanceTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-800 text-slate-100 p-3.5 rounded-xl shadow-xl max-w-xs font-sans text-xs space-y-2">
        <div className="border-b border-slate-800 pb-1.5 flex justify-between items-center gap-4">
          <span className="font-bold text-[12px] text-white uppercase tracking-wide">{label}</span>
        </div>
        <div className="space-y-1.5">
          {payload.map((p, idx) => (
            <div key={idx} className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.stroke || p.color }} />
                <span className="text-slate-300 font-medium">{p.name}:</span>
              </div>
              <span className="font-bold text-white font-mono">{p.value}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const WidgetEmptyState = ({ title, description, icon: Icon = Database }: { title: string; description: string; icon?: any }) => {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center border border-dashed border-slate-200 bg-slate-50/40 rounded-2xl min-h-[200px] w-full">
      <div className="p-3 bg-slate-100 text-slate-400 rounded-full mb-3 shadow-xs">
        <Icon size={20} />
      </div>
      <h5 className="text-xs font-black text-slate-700 uppercase tracking-wider">{title}</h5>
      <p className="text-[11px] text-slate-400 max-w-[280px] mt-1 leading-normal font-medium">{description}</p>
    </div>
  );
};

export default function DashboardSummaryTab({ 
  theme, 
  students: propStudents, 
  teachers: propTeachers,
  attendance: propAttendance,
  assessments: propAssessments,
  onRefresh, 
  setActiveTab, 
  setSettingsSubTab, 
  assignedClass, 
  assignedClasses = [],
  assignedSubjects = [],
  userRole 
}: Props) {
  const students = useMemo(() => {
    const sList = Array.isArray(propStudents) ? propStudents : [];
    if (userRole === 'Teacher') {
      const teacherClasses = Array.isArray(assignedClasses) ? [...assignedClasses] : [];
      if (assignedClass && assignedClass !== 'None' && !teacherClasses.includes(assignedClass)) {
        teacherClasses.push(assignedClass);
      }
      
      if (teacherClasses.length === 0) return []; // No access if no assignments
      return sList.filter(s => s && teacherClasses.includes(s.class));
    }
    return sList;
  }, [propStudents, userRole, assignedClass, assignedClasses]);

  const teachers = useMemo(() => {
    const list = propTeachers || DbController.getTeachers();
    return Array.isArray(list) ? list : [];
  }, [propTeachers]);

  const bills = useMemo(() => {
    const list = DbController.getStudentFeeBills();
    return Array.isArray(list) ? list : [];
  }, []);

  // Selected period controls for deeper analytics focus
  const [selectedDashboardYear, setSelectedDashboardYear] = useState<AcademicYearType>('2026/2027');
  const [selectedDashboardTerm, setSelectedDashboardTerm] = useState<TermType>('Term 1');
  const [performanceChartView, setPerformanceChartView] = useState<'trends' | 'terms'>('trends');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => {
    try { return DbController.getActivityLogs() || []; } catch { return []; }
  });
  const [teacherReflections, setTeacherReflections] = useState<TeacherReflection[]>(() => {
    try { return DbController.getTeacherReflections() || []; } catch { return []; }
  });
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => {
    try { return DbController.getLeaveRequests() || []; } catch { return []; }
  });
  const [teacherTasks, setTeacherTasks] = useState<CustomTask[]>(() => {
    try { return DbController.getTasks() || []; } catch { return []; }
  });

  // Quick Notes state & persistent storage integration
  const [quickNotes, setQuickNotes] = useState<QuickNote[]>(() => {
    try { return DbController.getQuickNotes() || []; } catch { return []; }
  });
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [notePriority, setNotePriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [noteCategory, setNoteCategory] = useState<NoteCategory>('General');
  const [noteColor, setNoteColor] = useState<'amber' | 'blue' | 'emerald' | 'rose' | 'purple' | 'slate'>('amber');
  const [noteIsPinned, setNoteIsPinned] = useState(false);
  const [noteDueDate, setNoteDueDate] = useState('');
  // Class teacher targeting & meeting notice state
  const [noteTargetAudience, setNoteTargetAudience] = useState<'all' | 'class_teachers' | 'specific_class'>('class_teachers');
  const [noteTargetClass, setNoteTargetClass] = useState<ClassType>('Basic 1');
  const [noteIsMeetingNotice, setNoteIsMeetingNotice] = useState(false);
  const [noteMeetingDate, setNoteMeetingDate] = useState('');
  const [noteMeetingTime, setNoteMeetingTime] = useState('');
  const [noteMeetingVenue, setNoteMeetingVenue] = useState('Staff Common Room');
  const [noteSearch, setNoteSearch] = useState('');
  const [notePriorityFilter, setNotePriorityFilter] = useState<'all' | 'urgent' | 'high' | 'medium' | 'low'>('all');
  const [noteCategoryFilter, setNoteCategoryFilter] = useState<'all' | NoteCategory>('all');
  const [noteTabMode, setNoteTabMode] = useState<'write' | 'preview'>('write');
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(new Set());
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);

  const toggleNoteExpand = (id: string) => {
    setExpandedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAllNotes = (noteIds: string[]) => {
    setExpandedNoteIds(new Set(noteIds));
  };

  const collapseAllNotes = () => {
    setExpandedNoteIds(new Set());
  };

  const categoryConfig: Record<NoteCategory, { label: string; icon: any; colorClass: string; borderClass: string }> = {
    General: { label: 'General', icon: StickyNote, colorClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', borderClass: 'border-slate-200 dark:border-slate-700' },
    Academic: { label: 'Academic', icon: GraduationCap, colorClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300', borderClass: 'border-indigo-200 dark:border-indigo-800' },
    Finance: { label: 'Finance', icon: Coins, colorClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300', borderClass: 'border-emerald-200 dark:border-emerald-800' },
    Personnel: { label: 'Personnel', icon: Users, colorClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300', borderClass: 'border-purple-200 dark:border-purple-800' },
    Events: { label: 'Events', icon: Calendar, colorClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300', borderClass: 'border-amber-200 dark:border-amber-800' },
    Maintenance: { label: 'Maintenance', icon: SlidersHorizontal, colorClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300', borderClass: 'border-rose-200 dark:border-rose-800' },
  };

  const insertMarkdownSyntax = (prefix: string, suffix: string = '') => {
    const textarea = noteTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = noteContent.substring(start, end);
    const textToInsert = selectedText || 'text';
    const replacement = `${prefix}${textToInsert}${suffix}`;

    const newContent = noteContent.substring(0, start) + replacement + noteContent.substring(end);
    setNoteContent(newContent);

    setTimeout(() => {
      textarea.focus();
      const cursorStart = start + prefix.length;
      const cursorEnd = cursorStart + textToInsert.length;
      textarea.setSelectionRange(cursorStart, cursorEnd);
    }, 0);
  };

  const insertLinePrefix = (prefix: string) => {
    const textarea = noteTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lineStart = noteContent.lastIndexOf('\n', start - 1) + 1;
    const newContent = noteContent.substring(0, lineStart) + prefix + noteContent.substring(lineStart);
    setNoteContent(newContent);

    setTimeout(() => {
      textarea.focus();
      const newPos = start + prefix.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  // Listen to broadcasted real-time updates across all teacher & headteacher modules
  useEffect(() => {
    const refreshLiveFeeds = () => {
      try { setQuickNotes(DbController.getQuickNotes() || []); } catch {}
      try { setActivityLogs(DbController.getActivityLogs() || []); } catch {}
      try { setTeacherReflections(DbController.getTeacherReflections() || []); } catch {}
      try { setLeaveRequests(DbController.getLeaveRequests() || []); } catch {}
      try { setTeacherTasks(DbController.getTasks() || []); } catch {}
    };

    const handleSync = (e: any) => {
      const eventType = e?.detail?.type;
      if (
        !eventType ||
        eventType === 'quick-notes-updated' ||
        eventType === 'activity-logs-updated' ||
        eventType === 'teachers-updated' ||
        eventType === 'teacher-updated' ||
        eventType === 'reflections-updated' ||
        eventType === 'leave-requests-updated' ||
        eventType === 'tasks-updated' ||
        eventType === 'students-updated' ||
        eventType === 'attendance-updated' ||
        eventType === 'assessments-updated' ||
        eventType === 'users-updated' ||
        eventType === 'subscribers-timer-updated' ||
        eventType === 'school-updated'
      ) {
        refreshLiveFeeds();
        setTicker(prev => prev + 1);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('school-system-sync', handleSync);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('school-system-sync', handleSync);
      }
    };
  }, []);

  // Keep live feeds synced whenever parent props update from App.tsx Firestore listeners
  useEffect(() => {
    try { setActivityLogs(DbController.getActivityLogs() || []); } catch {}
    try { setTeacherReflections(DbController.getTeacherReflections() || []); } catch {}
    try { setLeaveRequests(DbController.getLeaveRequests() || []); } catch {}
    try { setTeacherTasks(DbController.getTasks() || []); } catch {}
  }, [propStudents, propTeachers, propAttendance, propAssessments]);

  const categoryDefaultColor: Record<NoteCategory, 'amber' | 'blue' | 'emerald' | 'rose' | 'purple' | 'slate'> = {
    Academic: 'blue',
    Finance: 'emerald',
    Personnel: 'purple',
    Events: 'amber',
    Maintenance: 'rose',
    General: 'slate',
  };

  const priorityDefaultColor: Record<'low' | 'medium' | 'high' | 'urgent', 'amber' | 'blue' | 'emerald' | 'rose' | 'purple' | 'slate'> = {
    urgent: 'rose',
    high: 'amber',
    medium: 'blue',
    low: 'slate',
  };

  const getDueDateStatus = (dueDateStr?: string) => {
    if (!dueDateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDateStr);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        status: 'overdue',
        label: `Overdue (${Math.abs(diffDays)}d ago)`,
        colorClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        icon: AlertCircle,
      };
    } else if (diffDays === 0) {
      return {
        status: 'due-today',
        label: 'Due Today',
        colorClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800 font-black animate-pulse',
        icon: Clock,
      };
    } else if (diffDays <= 3) {
      return {
        status: 'due-soon',
        label: `Due in ${diffDays}d`,
        colorClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        icon: Calendar,
      };
    } else {
      return {
        status: 'upcoming',
        label: `Due ${new Date(dueDateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
        colorClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        icon: Calendar,
      };
    }
  };

  const openCreateNoteModal = () => {
    setEditingNoteId(null);
    setNoteTitle('');
    setNoteContent('');
    setNotePriority('medium');
    setNoteCategory('General');
    setNoteColor('amber');
    setNoteIsPinned(false);
    setNoteDueDate('');
    setNoteTargetAudience('class_teachers');
    setNoteTargetClass('Basic 1');
    setNoteIsMeetingNotice(false);
    setNoteMeetingDate('');
    setNoteMeetingTime('');
    setNoteMeetingVenue('Staff Common Room');
    setNoteTabMode('write');
    setIsNoteModalOpen(true);
  };

  const openEditNoteModal = (note: QuickNote) => {
    setEditingNoteId(note.id);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNotePriority(note.priority);
    setNoteCategory(note.category || 'General');
    setNoteColor(note.color);
    setNoteIsPinned(note.isPinned);
    setNoteDueDate(note.dueDate || '');
    setNoteTargetAudience(note.targetAudience || 'class_teachers');
    setNoteTargetClass(note.targetClass || 'Basic 1');
    setNoteIsMeetingNotice(!!note.isMeetingNotice);
    setNoteMeetingDate(note.meetingDate || '');
    setNoteMeetingTime(note.meetingTime || '');
    setNoteMeetingVenue(note.meetingVenue || 'Staff Common Room');
    setNoteTabMode('write');
    setIsNoteModalOpen(true);
  };

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim()) return;

    const currentUser = DbController.getCurrentUser();
    const authorName = currentUser?.name || (userRole ? userRole : 'Headteacher');

    if (editingNoteId) {
      const existing = quickNotes.find(n => n.id === editingNoteId);
      if (existing) {
        const updated: QuickNote = {
          ...existing,
          title: noteTitle.trim(),
          content: noteContent.trim(),
          priority: notePriority,
          category: noteCategory,
          color: noteColor,
          isPinned: noteIsPinned,
          dueDate: noteDueDate || undefined,
          updatedAt: new Date().toISOString(),
          targetAudience: noteTargetAudience,
          targetClass: noteTargetAudience === 'specific_class' ? noteTargetClass : undefined,
          isMeetingNotice: noteIsMeetingNotice,
          meetingDate: noteIsMeetingNotice ? noteMeetingDate : undefined,
          meetingTime: noteIsMeetingNotice ? noteMeetingTime : undefined,
          meetingVenue: noteIsMeetingNotice ? noteMeetingVenue : undefined,
        };
        DbController.saveQuickNote(updated);
      }
    } else {
      const newNote: QuickNote = {
        id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: noteTitle.trim(),
        content: noteContent.trim(),
        priority: notePriority,
        category: noteCategory,
        color: noteColor,
        isPinned: noteIsPinned,
        dueDate: noteDueDate || undefined,
        createdAt: new Date().toISOString(),
        author: authorName,
        targetAudience: noteTargetAudience,
        targetClass: noteTargetAudience === 'specific_class' ? noteTargetClass : undefined,
        isMeetingNotice: noteIsMeetingNotice,
        meetingDate: noteIsMeetingNotice ? noteMeetingDate : undefined,
        meetingTime: noteIsMeetingNotice ? noteMeetingTime : undefined,
        meetingVenue: noteIsMeetingNotice ? noteMeetingVenue : undefined,
        acknowledgedBy: [],
      };
      DbController.saveQuickNote(newNote);
    }

    setQuickNotes(DbController.getQuickNotes());
    setIsNoteModalOpen(false);
    window.dispatchEvent(new CustomEvent('app-toast', { 
      detail: { text: noteIsMeetingNotice ? 'Meeting Notice published & broadcasted to class teachers.' : 'Quick Note / Memo published successfully.', type: 'success' } 
    }));
  };

  const handleDeleteNote = (id: string) => {
    DbController.deleteQuickNote(id);
    setQuickNotes(DbController.getQuickNotes());
  };

  const handleTogglePin = (id: string) => {
    const note = quickNotes.find(n => n.id === id);
    if (note) {
      const updated: QuickNote = { ...note, isPinned: !note.isPinned, updatedAt: new Date().toISOString() };
      DbController.saveQuickNote(updated);
      setQuickNotes(DbController.getQuickNotes());
    }
  };

  const filteredQuickNotes = useMemo(() => {
    const query = noteSearch.trim().toLowerCase();
    return quickNotes.filter(n => {
      const matchesSearch = !query || 
        n.title.toLowerCase().includes(query) || 
        n.content.toLowerCase().includes(query) ||
        (n.author && n.author.toLowerCase().includes(query));
      if (!matchesSearch) return false;

      // Pinned notes stay at the top regardless of category or priority filter settings
      if (n.isPinned) return true;

      const matchesPriority = notePriorityFilter === 'all' || n.priority === notePriorityFilter;
      const matchesCategory = noteCategoryFilter === 'all' || (n.category || 'General') === noteCategoryFilter;
      return matchesPriority && matchesCategory;
    }).sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [quickNotes, noteSearch, notePriorityFilter, noteCategoryFilter]);

  const colorStyles: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    amber: {
      bg: 'bg-gradient-to-br from-amber-50/90 via-amber-50/60 to-orange-50/40 dark:from-amber-950/40 dark:via-amber-900/30 dark:to-slate-800',
      border: 'border-amber-200/90 dark:border-amber-700/50',
      text: 'text-amber-950 dark:text-amber-100',
      badge: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/70 dark:text-amber-200 dark:border-amber-700'
    },
    blue: {
      bg: 'bg-gradient-to-br from-sky-50/90 via-sky-50/60 to-indigo-50/40 dark:from-sky-950/40 dark:via-sky-900/30 dark:to-slate-800',
      border: 'border-sky-200/90 dark:border-sky-700/50',
      text: 'text-sky-950 dark:text-sky-100',
      badge: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/70 dark:text-sky-200 dark:border-sky-700'
    },
    emerald: {
      bg: 'bg-gradient-to-br from-emerald-50/90 via-emerald-50/60 to-teal-50/40 dark:from-emerald-950/40 dark:via-emerald-900/30 dark:to-slate-800',
      border: 'border-emerald-200/90 dark:border-emerald-700/50',
      text: 'text-emerald-950 dark:text-emerald-100',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/70 dark:text-emerald-200 dark:border-emerald-700'
    },
    rose: {
      bg: 'bg-gradient-to-br from-rose-50/90 via-rose-50/60 to-pink-50/40 dark:from-rose-950/40 dark:via-rose-900/30 dark:to-slate-800',
      border: 'border-rose-200/90 dark:border-rose-700/50',
      text: 'text-rose-950 dark:text-rose-100',
      badge: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/70 dark:text-rose-200 dark:border-rose-700'
    },
    purple: {
      bg: 'bg-gradient-to-br from-purple-50/90 via-purple-50/60 to-indigo-50/40 dark:from-purple-950/40 dark:via-purple-900/30 dark:to-slate-800',
      border: 'border-purple-200/90 dark:border-purple-700/50',
      text: 'text-purple-950 dark:text-purple-100',
      badge: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/70 dark:text-purple-200 dark:border-purple-700'
    },
    slate: {
      bg: 'bg-gradient-to-br from-slate-100/90 via-slate-50/70 to-zinc-100/50 dark:from-slate-800/90 dark:via-slate-800/70 dark:to-slate-850',
      border: 'border-slate-250 dark:border-slate-700',
      text: 'text-slate-900 dark:text-slate-100',
      badge: 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-750 dark:text-slate-200 dark:border-slate-600'
    }
  };


  // --- WIDGET VISIBILITY & LAYOUT CUSTOMIZATION ---
  const [widgets, setWidgets] = useState(() => {
    const defaultWidgets = {
      quickNotes: true,
      teacherRoles: true,
      dailyAttendance: true,
      pendingFees: true,
      newAdmissions: true,
      gradeDistribution: true,
      enrollmentBreakdown: true,
      growthHistory: true,
      performanceTrends: true,
      attendanceStanding: true,
      feesBreakdown: true,
      activityLogs: true,
      assessmentTasks: true,
    };
    const stored = getStorageItem('sms_dashboard_widgets', {});
    return { ...defaultWidgets, ...stored };
  });

  const defaultWidgetOrder = [
    'quickNotes',
    'teacherRoles',
    'dailyAttendance',
    'pendingFees',
    'newAdmissions',
    'gradeDistribution',
    'enrollmentBreakdown',
    'growthHistory',
    'performanceTrends',
    'attendanceStanding',
    'feesBreakdown',
    'activityLogs',
    'assessmentTasks'
  ];

  const defaultWidgetSizes: Record<string, 'normal' | 'wide' | 'full'> = {
    quickNotes: 'full',
    teacherRoles: 'full',
    dailyAttendance: 'normal',
    pendingFees: 'normal',
    newAdmissions: 'normal',
    gradeDistribution: 'normal',
    enrollmentBreakdown: 'wide',
    growthHistory: 'normal',
    performanceTrends: 'wide',
    attendanceStanding: 'normal',
    feesBreakdown: 'full',
    activityLogs: 'full',
    assessmentTasks: 'full'
  };

  const [widgetOrder, setWidgetOrder] = useState<string[]>(() => {
    const stored = getStorageItem('sms_dashboard_widget_order', []);
    if (stored && stored.length > 0) {
      const merged = [...stored];
      defaultWidgetOrder.forEach(k => {
        if (!merged.includes(k)) merged.push(k);
      });
      return merged;
    }
    return defaultWidgetOrder;
  });

  const [widgetSizes, setWidgetSizes] = useState<Record<string, 'normal' | 'wide' | 'full'>>(() => {
    const stored = getStorageItem('sms_dashboard_widget_sizes', {});
    return { ...defaultWidgetSizes, ...stored };
  });

  const [isCustomizing, setIsCustomizing] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const toggleWidget = (key: keyof typeof widgets) => {
    const next = { ...widgets, [key]: !widgets[key] };
    setWidgets(next);
    setStorageItem('sms_dashboard_widgets', next);
  };

  const updateWidgetSize = (key: string, size: 'normal' | 'wide' | 'full') => {
    const next = { ...widgetSizes, [key]: size };
    setWidgetSizes(next);
    setStorageItem('sms_dashboard_widget_sizes', next);
  };

  const moveWidget = (key: string, direction: 'up' | 'down') => {
    const idx = widgetOrder.indexOf(key);
    if (idx === -1) return;
    const newOrder = [...widgetOrder];
    if (direction === 'up' && idx > 0) {
      newOrder[idx] = newOrder[idx - 1];
      newOrder[idx - 1] = key;
    } else if (direction === 'down' && idx < newOrder.length - 1) {
      newOrder[idx] = newOrder[idx + 1];
      newOrder[idx + 1] = key;
    }
    setWidgetOrder(newOrder);
    setStorageItem('sms_dashboard_widget_order', newOrder);
  };

  const showAllWidgets = () => {
    const next = {
      quickNotes: true,
      teacherRoles: true,
      dailyAttendance: true,
      pendingFees: true,
      newAdmissions: true,
      gradeDistribution: true,
      enrollmentBreakdown: true,
      growthHistory: true,
      performanceTrends: true,
      attendanceStanding: true,
      feesBreakdown: true,
      activityLogs: true,
      assessmentTasks: true,
    };
    setWidgets(next);
    setStorageItem('sms_dashboard_widgets', next);
  };

  const hideAllWidgets = () => {
    const next = {
      quickNotes: false,
      teacherRoles: false,
      dailyAttendance: false,
      pendingFees: false,
      newAdmissions: false,
      gradeDistribution: false,
      enrollmentBreakdown: false,
      growthHistory: false,
      performanceTrends: false,
      attendanceStanding: false,
      feesBreakdown: false,
      activityLogs: false,
      assessmentTasks: false,
    };
    setWidgets(next);
    setStorageItem('sms_dashboard_widgets', next);
  };

  const widgetDefinitions = [
    { key: 'quickNotes', label: 'Quick Notes & Urgent Memos', desc: 'Jot down urgent reminders, staff memos, and administrative notices with persistent database storage', category: 'General' },
    { key: 'teacherRoles', label: 'Teacher Role Matrix & Live Changes', desc: 'Control Student Profiles, Class Attendance Roster, Academic Assessment & System Control roles and track live Teacher page changes', category: 'Faculty Governance' },
    { key: 'dailyAttendance', label: 'Attendance Summary', desc: 'Live status log of today\'s student attendance by class', category: 'Daily Operations' },
    { key: 'pendingFees', label: 'Recent Fee Payments', desc: 'Donut chart showing ratio of collected vs outstanding school fees with live payments log', category: 'Finance' },
    { key: 'newAdmissions', label: 'New Admissions', desc: 'Admissions trend, metrics, and scannable list of recently registered students', category: 'Demographics' },
    { key: 'gradeDistribution', label: 'Grade Level Distribution', desc: 'GES Curriculum grading level mix across core subjects', category: 'Academics' },
    { key: 'enrollmentBreakdown', label: 'Class Enrollment Breakdown', desc: 'Bar chart showing counts of male and female students per class', category: 'Demographics' },
    { key: 'growthHistory', label: 'Historical Enrollment Growth', desc: 'Area chart displaying student enrollment growth over academic years', category: 'Trends' },
    { key: 'performanceTrends', label: 'Performance Trends Across Terms', desc: 'Multi-line chart tracking term average achievements', category: 'Academics' },
    { key: 'attendanceStanding', label: 'Class Attendance Standing', desc: 'Bar chart illustrating average attendance rates per class', category: 'Daily Operations' },
    { key: 'feesBreakdown', label: 'Fees Breakdown by Class', desc: 'Multi-bar chart detailing invoiced, paid, and outstanding balances per class', category: 'Finance' },
    { key: 'activityLogs', label: 'Teacher Activity Monitor', desc: 'Real-time administrative log of actions performed by teachers', category: 'System Audit' },
    { key: 'assessmentTasks', label: 'Assessment Submissions Tracking', desc: 'Monitor grading progress by class teachers', category: 'Academics' },
  ];

  // Get formatted local YYYY-MM-DD date string timezone safely
  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayDateStr = getTodayDateString();
  const [selectedAttendanceDate, setSelectedAttendanceDate] = useState<string>(todayDateStr);

  const attendanceRecords = useMemo(() => {
    const list = propAttendance || DbController.getAllAttendance();
    return Array.isArray(list) ? list : [];
  }, [propAttendance]);

  // Get active HEX color code for charts based on theme selection
  const getThemeHexColor = (): string => {
    switch (theme.name) {
      case 'Classic': return '#2563eb'; // blue-600
      case 'Emerald': return '#059669'; // emerald-600
      case 'Ruby': return '#e11d48'; // rose-600
      case 'Cosmic': return '#9333ea'; // purple-600
      case 'Gold': return '#d97706'; // amber-600
      case 'Crystal Glass': return '#0284c7'; // sky-600
      case 'Sophisticated Dark': return '#6366f1'; // indigo-600
      default: return '#3b82f6';
    }
  };

  const themeHex = getThemeHexColor();

  // ----------------------------------------------------
  // DATA PIECE 1: Student Enrollment Trends & Breakdown
  // ----------------------------------------------------
  
  // Aggregate students count by Class and Gender
  const classCountMap: Record<string, { male: number; female: number; total: number }> = {};
  CLASSES.forEach(c => {
    classCountMap[c] = { male: 0, female: 0, total: 0 };
  });

  students.forEach(s => {
    if (classCountMap[s.class]) {
      if (s.gender === 'Female') {
        classCountMap[s.class].female++;
      } else {
        classCountMap[s.class].male++;
      }
      classCountMap[s.class].total++;
    }
  });

  const enrollmentByClassData = CLASSES.map(c => ({
    name: c,
    Male: classCountMap[c].male,
    Female: classCountMap[c].female,
    Total: classCountMap[c].total,
  })).filter(item => item.Total > 0);

  // If no students are in the database, return empty array
  const finalEnrollmentChartData = students.length > 0 ? enrollmentByClassData : [];

  // Enrollment Growth Trend Line over academic years
  const yearCounts: Record<string, number> = {};
  ACADEMIC_YEARS.forEach(y => {
    yearCounts[y] = 0;
  });
  students.forEach(s => {
    const yr = s.academicYear || '2026/2027';
    if (yearCounts[yr] !== undefined) {
      yearCounts[yr]++;
    }
  });

  const enrollmentGrowthData = ACADEMIC_YEARS.map((yr) => {
    const actualCount = yearCounts[yr] || 0;
    return {
      year: yr,
      Students: actualCount,
      isSimulated: false
    };
  });

  // ----------------------------------------------------
  // DATA PIECE 2: Class Attendance Percentages
  // ----------------------------------------------------
  const classAttendanceData = CLASSES.map((className, idx) => {
    const classRecords = attendanceRecords.filter(r => r.class === className);
    const present = classRecords.filter(r => r.status === 'Present').length;
    const absent = classRecords.filter(r => r.status === 'Absent').length;
    
    let rate = 0;
    let hasActualData = false;
    if (present + absent > 0) {
      rate = Math.round((present / (present + absent)) * 100);
      hasActualData = true;
    } else {
      rate = 0;
      hasActualData = false;
    }
    
    return {
      className,
      rate,
      hasActual: hasActualData,
      presentCount: present,
      absentCount: absent
    };
  }).filter(item => item.className !== 'Nursery 1' || students.length === 0);

  const termStart = getStorageItem('sms_term_start_date', '2026-05-20');
  const termEnd = getStorageItem('sms_term_end_date', '2026-07-04');
  
  const activeTermWeeks = useMemo(() => {
    const start = new Date(termStart);
    const end = new Date(termEnd);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.ceil(diffDays / 7);
    }
    return 0;
  }, [termStart, termEnd]);

  // Overall attendance rate average
  const actualAttendanceRecords = attendanceRecords.filter(r => r.status === 'Present' || r.status === 'Absent');
  const overallAttendanceRate = actualAttendanceRecords.length > 0
    ? Math.round((attendanceRecords.filter(r => r.status === 'Present').length / actualAttendanceRecords.length) * 100)
    : 0; // Default to 0 reference if no data is set

  // ----------------------------------------------------
  // DATA PIECE 2.5: Today's Classroom Attendance Details
  // ----------------------------------------------------
  const classTodayAttendance = CLASSES.map((className) => {
    // Filter records for the exact selected date
    const classRecords = attendanceRecords.filter(r => r.class === className && r.date === selectedAttendanceDate);
    const present = classRecords.filter(r => r.status === 'Present').length;
    const absent = classRecords.filter(r => r.status === 'Absent').length;
    const holiday = classRecords.filter(r => r.status === 'Holiday').length;
    const totalMarkedInDay = present + absent + holiday;
    const totalStudentsInClass = students.filter(s => s.class === className).length;

    let rate = 0;
    let hasActual = false;
    let isHoliday = false;

    if (holiday > 0 && present + absent === 0) {
      isHoliday = true;
      hasActual = true;
    } else if (present + absent > 0) {
      rate = Math.round((present / (present + absent)) * 100);
      hasActual = true;
    }
    
    return {
      className,
      present,
      absent,
      holiday,
      isHoliday,
      totalMarkedInDay,
      totalStudentsInClass,
      rate,
      hasActual
    };
  });

  const totalClassesTodayCount = CLASSES.length;
  const classesWithTodayAttendanceCount = classTodayAttendance.filter(c => c.hasActual).length;

  // ----------------------------------------------------
  // DATA PIECE 3: Fee Payment Status Aggregation
  // ----------------------------------------------------
  let totalBilledGlobal = 0;
  let totalPaidGlobal = 0;

  const classFeesMap: Record<string, { billed: number; paid: number; outstanding: number }> = {};
  CLASSES.forEach(c => {
    classFeesMap[c] = { billed: 0, paid: 0, outstanding: 0 };
  });

  bills.forEach(b => {
    const totalBilled = b.schoolFees + b.utilityBill + b.sportsFees + b.ptaDues + (b.transportationBill || 0) + b.otherFee;
    const totalPaid = b.payments ? b.payments.reduce((sum, p) => sum + p.amount, 0) : 0;
    const outstanding = Math.max(0, totalBilled - totalPaid);

    totalBilledGlobal += totalBilled;
    totalPaidGlobal += totalPaid;

    if (classFeesMap[b.class]) {
      classFeesMap[b.class].billed += totalBilled;
      classFeesMap[b.class].paid += totalPaid;
      classFeesMap[b.class].outstanding += outstanding;
    }
  });

  const totalOutstandingGlobal = Math.max(0, totalBilledGlobal - totalPaidGlobal);
  const collectionRate = totalBilledGlobal > 0 ? parseFloat(((totalPaidGlobal / totalBilledGlobal) * 100).toFixed(1)) : 0;

  // Formatting class fees dataset
  const classFeesChartData = CLASSES.map(c => ({
    name: c,
    Billed: classFeesMap[c].billed,
    Paid: classFeesMap[c].paid,
    Outstanding: classFeesMap[c].outstanding
  })).filter(item => item.Billed > 0 || bills.length === 0);

  const hasBillingData = bills.length > 0;
  
  const finalFeesChartData = hasBillingData ? classFeesChartData.filter(item => item.Billed > 0) : [];

  const paymentRatioData = [
    { name: 'Collected / Paid Fees', value: hasBillingData ? totalPaidGlobal : 0, color: '#10b981' },
    { name: 'Outstanding Balance', value: hasBillingData ? totalOutstandingGlobal : 0, color: '#ef4444' }
  ];

  // Statistics summaries
  const totalEnrolledCounter = students.length;
  const femaleEnrolledCounter = students.filter(s => s.gender === 'Female').length;
  const maleEnrolledCounter = students.filter(s => s.gender === 'Male').length;
  const boarderEnrolledCounter = students.filter(s => s.status === 'Boarder').length;
  const dayEnrolledCounter = students.filter(s => s.status === 'Day').length;

  const newAdmissionsList = useMemo(() => {
    const sorted = [...students].sort((a, b) => {
      const dateA = a && a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b && b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    return sorted.slice(0, 5);
  }, [students]);

  const newAdmissionsCount = useMemo(() => {
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    return students.filter(s => {
      if (!s) return false;
      if (s.createdAt) {
        return new Date(s.createdAt).getTime() >= ninetyDaysAgo;
      }
      return s.academicYear === selectedDashboardYear;
    }).length;
  }, [students, selectedDashboardYear]);

  const recentPayments = useMemo(() => {
    const list: Array<{
      studentName: string;
      class: ClassType;
      amount: number;
      date: string;
      method: string;
      component: string;
    }> = [];

    bills.forEach(b => {
      if (b && b.payments && Array.isArray(b.payments)) {
        b.payments.forEach(p => {
          if (p) {
            list.push({
              studentName: b.studentName || "Student",
              class: b.class || ("Basic 1" as ClassType),
              amount: p.amount || 0,
              date: p.date || new Date().toISOString(),
              method: p.method || "Cash",
              component: p.component || "School Fees"
            });
          }
        });
      }
    });

    return list.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    }).slice(0, 5);
  }, [bills]);

  // ACADEMIC PERFORMANCE DATA COMPUTATION
  const assessments = useMemo(() => {
    const list = propAssessments || DbController.getAssessments();
    return Array.isArray(list) ? list : [];
  }, [propAssessments]);

  const activeAssessments = useMemo(() => {
    if (userRole === 'Teacher' && assignedClass) {
      const studentIdsInClass = new Set(students.filter(Boolean).map(s => s.id));
      return assessments.filter(ass => ass && studentIdsInClass.has(ass.studentId));
    }
    return assessments.filter(Boolean);
  }, [assessments, userRole, assignedClass, students]);

  const topSubjects: SubjectType[] = ['Mathematics', 'English Language', 'Integrated Science'];

  const termSubjectScoresMap: Record<TermType, Record<string, { total: number; count: number }>> = {
    'Term 1': {},
    'Term 2': {},
    'Term 3': {}
  };

  TERMS.forEach(t => {
    termSubjectScoresMap[t]['Overall'] = { total: 0, count: 0 };
    topSubjects.forEach(s => {
      termSubjectScoresMap[t][s] = { total: 0, count: 0 };
    });
  });

  activeAssessments.forEach(ass => {
    if (ass.academicYear === selectedDashboardYear) {
      const term = ass.term;
      if (termSubjectScoresMap[term]) {
        // Overall
        termSubjectScoresMap[term]['Overall'].total += ass.totalScore;
        termSubjectScoresMap[term]['Overall'].count += 1;

        // Subject specific
        if (!termSubjectScoresMap[term][ass.subject]) {
          termSubjectScoresMap[term][ass.subject] = { total: 0, count: 0 };
        }
        termSubjectScoresMap[term][ass.subject].total += ass.totalScore;
        termSubjectScoresMap[term][ass.subject].count += 1;
      }
    }
  });

  const hasAssessments = activeAssessments.some(ass => ass.academicYear === selectedDashboardYear);

  const performanceTrendData = TERMS.map((term, idx) => {
    const item: any = { term };
    
    // Overall
    const overallData = termSubjectScoresMap[term]['Overall'];
    item['Overall'] = overallData.count > 0 
      ? parseFloat((overallData.total / overallData.count).toFixed(1)) 
      : null;

    // Subjects
    topSubjects.forEach(s => {
      const sData = termSubjectScoresMap[term][s];
      item[s] = (sData && sData.count > 0)
        ? parseFloat((sData.total / sData.count).toFixed(1))
        : null;
    });

    item.isSimulated = false;
    return item;
  });

  // Extract ONLY captured subjects that have recorded assessments in the selected year
  const capturedDashboardSubjectsSet = new Set<string>();
  TERMS.forEach(t => {
    Object.keys(termSubjectScoresMap[t] || {}).forEach(s => {
      if (s !== 'Overall' && termSubjectScoresMap[t][s]?.count > 0) {
        capturedDashboardSubjectsSet.add(s);
      }
    });
  });

  const capturedDashboardSubjectsList = Array.from(capturedDashboardSubjectsSet);

  const shortNameMap: Record<string, string> = {
    'English Language': 'English',
    'Mathematics': 'Maths',
    'Integrated Science': 'Science',
    'Social Studies': 'Soc Stud',
    'Information & Comm. Tech (ICT)': 'ICT',
    'ICT': 'ICT',
    'Creative Arts & Design': 'Creat Arts',
    'Creative Arts': 'Creat Arts',
    'Ghanaian Language & Culture': 'Ghan Lang',
    'Religious & Moral Education (RME)': 'RME',
    'Religious And Moral Education': 'RME',
    'RME': 'RME',
    'French Language': 'French',
    'French': 'French',
    'Career Technology': 'Career Tech',
    'Computing': 'Computing',
    'History': 'History',
    'Our World Our People': 'OWOP'
  };

  const multiTermDashboardLineData = capturedDashboardSubjectsList.map(subj => {
    const t1Data = termSubjectScoresMap['Term 1']?.[subj];
    const t2Data = termSubjectScoresMap['Term 2']?.[subj];
    const t3Data = termSubjectScoresMap['Term 3']?.[subj];

    const score1 = (t1Data && t1Data.count > 0) ? parseFloat((t1Data.total / t1Data.count).toFixed(1)) : null;
    const score2 = (t2Data && t2Data.count > 0) ? parseFloat((t2Data.total / t2Data.count).toFixed(1)) : null;
    const score3 = (t3Data && t3Data.count > 0) ? parseFloat((t3Data.total / t3Data.count).toFixed(1)) : null;

    return {
      subject: subj,
      shortSubject: shortNameMap[subj] || subj.split(' ')[0],
      'Term 1': score1,
      'Term 2': score2,
      'Term 3': score3,
    };
  });

  // Dynamic grade level distribution
  let l1Count = 0; // Highly Proficient
  let l2Count = 0; // Proficient
  let l3Count = 0; // Approaching
  let l4Count = 0; // Developing
  let l5Count = 0; // Emerging

  assessments.forEach(ass => {
    if (ass.academicYear === selectedDashboardYear) {
      if (ass.gradeLevel === 'L1') l1Count++;
      else if (ass.gradeLevel === 'L2') l2Count++;
      else if (ass.gradeLevel === 'L3') l3Count++;
      else if (ass.gradeLevel === 'L4') l4Count++;
      else if (ass.gradeLevel === 'L5') l5Count++;
    }
  });

  let totalGrades = l1Count + l2Count + l3Count + l4Count + l5Count;

  // Fallback to all years if selected year has no entries
  if (totalGrades === 0) {
    assessments.forEach(ass => {
      if (ass.gradeLevel === 'L1') l1Count++;
      else if (ass.gradeLevel === 'L2') l2Count++;
      else if (ass.gradeLevel === 'L3') l3Count++;
      else if (ass.gradeLevel === 'L4') l4Count++;
      else if (ass.gradeLevel === 'L5') l5Count++;
    });
    totalGrades = l1Count + l2Count + l3Count + l4Count + l5Count;
  }

  // Actual Grade Distribution calculation
  const gradeDistribution = [
    { name: 'Highly Proficient (L1)', value: l1Count, pct: totalGrades > 0 ? Math.round((l1Count / totalGrades) * 100) : 0, color: '#10b981' },
    { name: 'Proficient (L2)', value: l2Count, pct: totalGrades > 0 ? Math.round((l2Count / totalGrades) * 100) : 0, color: '#3b82f6' },
    { name: 'Approaching (L3)', value: l3Count, pct: totalGrades > 0 ? Math.round((l3Count / totalGrades) * 100) : 0, color: '#f59e0b' },
    { name: 'Developing (L4)', value: l4Count, pct: totalGrades > 0 ? Math.round((l4Count / totalGrades) * 100) : 0, color: '#6366f1' },
    { name: 'Emerging (L5)', value: l5Count, pct: totalGrades > 0 ? Math.round((l5Count / totalGrades) * 100) : 0, color: '#ef4444' },
  ];

  const [ticker, setTicker] = useState(0);
  const currentUser = useMemo(() => DbController.getCurrentUser(), [ticker]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTicker(prev => prev + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const subStatus = useMemo(() => currentUser ? evaluateSubscription(currentUser) : null, [currentUser, ticker]);

  const handleToggleTeacherRole = (
    teacher: Teacher,
    permKey: 'canAccessStudents' | 'canAccessAttendance' | 'canAccessAssessments' | 'canAccessSystemControl'
  ) => {
    const currentPerms = teacher.permissions || {};
    const prevVal = currentPerms[permKey] !== false;
    const nextVal = !prevVal;
    const teacherFullName = DbController.formatTeacherFullName(teacher);
    const updatedTeacher: Teacher = {
      ...teacher,
      permissions: {
        canAccessStudents: currentPerms.canAccessStudents !== false,
        canAccessAttendance: currentPerms.canAccessAttendance !== false,
        canAccessAssessments: currentPerms.canAccessAssessments !== false,
        canAccessSystemControl: currentPerms.canAccessSystemControl !== false,
        canEditStudents: currentPerms.canEditStudents !== false,
        canApproveAttendance: currentPerms.canApproveAttendance !== false,
        canEditGrades: currentPerms.canEditGrades !== false,
        canExportReports: currentPerms.canExportReports !== false,
        [permKey]: nextVal,
      },
      lastModified: new Date().toISOString(),
    };
    const roleLabelMap: Record<typeof permKey, string> = {
      canAccessStudents: 'Student Profiles',
      canAccessAttendance: 'Class Attendance Roster',
      canAccessAssessments: 'Academic Assessment',
      canAccessSystemControl: 'System Control',
    };
    DbController.saveTeacher(updatedTeacher);
    DbController.writeActivityLog(
      'Teacher Role Updated',
      `Headteacher ${nextVal ? 'enabled' : 'disabled'} "${roleLabelMap[permKey]}" role for ${teacherFullName} (Staff ID: ${teacher.staffId || teacher.id}).`,
      'high'
    );
    setActivityLogs(DbController.getActivityLogs() || []);
    onRefresh();
    window.dispatchEvent(new CustomEvent('app-toast', {
      detail: {
        text: `${roleLabelMap[permKey]} ${nextVal ? 'granted' : 'revoked'} for ${teacherFullName} and saved under Headteacher Cloud Firestore.`,
        type: 'success'
      }
    }));
  };

  const handleLeaveDecision = (req: LeaveRequest, status: 'Approved' | 'Rejected') => {
    const updated: LeaveRequest = { ...req, status };
    DbController.saveLeaveRequest(updated);
    DbController.writeActivityLog(
      `Leave Request ${status}`,
      `Headteacher ${status.toLowerCase()} leave request for ${req.teacherName} (${req.startDate} to ${req.endDate}).`,
      'medium'
    );
    setLeaveRequests(DbController.getLeaveRequests() || []);
    setActivityLogs(DbController.getActivityLogs() || []);
    onRefresh();
    window.dispatchEvent(new CustomEvent('app-toast', {
      detail: { text: `Leave request for ${req.teacherName} marked ${status}.`, type: 'success' }
    }));
  };

  // --- TEACHER SPECIFIC COMPUTATIONS & DATA PIPELINE ---
  const teacherProfile = useMemo(() => {
    if (!currentUser || currentUser.role !== 'Teacher') return null;
    const userEmail = currentUser.email?.toLowerCase().trim();
    return teachers.find(
      t =>
        (userEmail && t.email?.toLowerCase().trim() === userEmail) ||
        (currentUser.staffId && t.staffId === currentUser.staffId) ||
        t.id === currentUser.uid
    ) || null;
  }, [currentUser, teachers]);

  const teacherName = teacherProfile
    ? DbController.formatTeacherFullName(teacherProfile)
    : (currentUser?.name || 'Educator');

  // Filtered Assessments for their class
  const classAssessments = useMemo(() => {
    const allAssessments = DbController.getAssessments();
    const safeAssessments = Array.isArray(allAssessments) ? allAssessments : [];
    if (userRole === 'Teacher' && assignedClass) {
      const studentIdsInClass = new Set(students.filter(Boolean).map(s => s.id));
      return safeAssessments.filter(ass => ass && studentIdsInClass.has(ass.studentId));
    }
    return safeAssessments;
  }, [students, userRole, assignedClass]);

  // Subject Averages for their class
  const subjectAverages = useMemo(() => {
    const subjectMap: Record<string, { total: number; count: number }> = {};
    classAssessments.forEach(ass => {
      if (ass && ass.subject) {
        if (!subjectMap[ass.subject]) {
          subjectMap[ass.subject] = { total: 0, count: 0 };
        }
        subjectMap[ass.subject].total += ass.totalScore || 0;
        subjectMap[ass.subject].count += 1;
      }
    });

    const entries = Object.entries(subjectMap).map(([subject, data]) => ({
      subject,
      average: data.count > 0 ? parseFloat((data.total / data.count).toFixed(1)) : 0,
      count: data.count
    })).sort((a, b) => b.average - a.average);

    return entries;
  }, [classAssessments]);

  // Class Academic Average
  const classAcademicAverage = useMemo(() => {
    if (!classAssessments || classAssessments.length === 0) return 0;
    const total = classAssessments.reduce((sum, ass) => sum + (ass ? ass.totalScore : 0), 0);
    return parseFloat((total / classAssessments.length).toFixed(1));
  }, [classAssessments]);

  // Learning Level Counts specifically for their class
  const classGradeLevels = useMemo(() => {
    let l1 = 0, l2 = 0, l3 = 0, l4 = 0, l5 = 0;
    classAssessments.forEach(ass => {
      if (!ass) return;
      if (ass.gradeLevel === 'L1') l1++;
      else if (ass.gradeLevel === 'L2') l2++;
      else if (ass.gradeLevel === 'L3') l3++;
      else if (ass.gradeLevel === 'L4') l4++;
      else if (ass.gradeLevel === 'L5') l5++;
    });

    const total = l1 + l2 + l3 + l4 + l5;
    if (total === 0) {
      return [
        { name: 'Highly Proficient (L1)', value: 0, pct: 0, color: '#10b981' },
        { name: 'Proficient (L2)', value: 0, pct: 0, color: '#3b82f6' },
        { name: 'Approaching (L3)', value: 0, pct: 0, color: '#f59e0b' },
        { name: 'Developing (L4)', value: 0, pct: 0, color: '#6366f1' },
        { name: 'Emerging (L5)', value: 0, pct: 0, color: '#ef4444' },
      ];
    }

    return [
      { name: 'Highly Proficient (L1)', value: l1, pct: Math.round((l1 / total) * 100), color: '#10b981' },
      { name: 'Proficient (L2)', value: l2, pct: Math.round((l2 / total) * 100), color: '#3b82f6' },
      { name: 'Approaching (L3)', value: l3, pct: Math.round((l3 / total) * 100), color: '#f59e0b' },
      { name: 'Developing (L4)', value: l4, pct: Math.round((l4 / total) * 100), color: '#6366f1' },
      { name: 'Emerging (L5)', value: l5, pct: Math.round((l5 / total) * 100), color: '#ef4444' },
    ];
  }, [classAssessments]);

  // Individual student attendance averages
  const studentAttendanceAverages = useMemo(() => {
    const averages: Record<string, { present: number; total: number }> = {};
    attendanceRecords.forEach(r => {
      if (r && r.studentId) {
        if (!averages[r.studentId]) {
          averages[r.studentId] = { present: 0, total: 0 };
        }
        if (r.status === 'Present') {
          averages[r.studentId].present++;
        }
        if (r.status === 'Present' || r.status === 'Absent') {
          averages[r.studentId].total++;
        }
      }
    });
    return averages;
  }, [attendanceRecords]);

  // Class Recent Attendance
  const classRecentAttendance = useMemo(() => {
    const dateMap: Record<string, { present: number; absent: number }> = {};
    attendanceRecords.forEach(r => {
      if (r && r.class === assignedClass && r.date) {
        if (!dateMap[r.date]) {
          dateMap[r.date] = { present: 0, absent: 0 };
        }
        if (r.status === 'Present') dateMap[r.date].present++;
        if (r.status === 'Absent') dateMap[r.date].absent++;
      }
    });

    const entries = Object.entries(dateMap).map(([date, counts]) => {
      const total = counts.present + counts.absent;
      return {
        date,
        rate: total > 0 ? Math.round((counts.present / total) * 100) : 0,
        present: counts.present,
        absent: counts.absent
      };
    }).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

    if (entries.length === 0) {
      // Fallback past dates
      return [
        { date: '2026-06-23', rate: 96, present: 28, absent: 1 },
        { date: '2026-06-22', rate: 93, present: 27, absent: 2 },
        { date: '2026-06-19', rate: 100, present: 29, absent: 0 },
        { date: '2026-06-18', rate: 96, present: 28, absent: 1 },
        { date: '2026-06-17', rate: 90, present: 26, absent: 3 },
      ];
    }
    return entries;
  }, [attendanceRecords, assignedClass]);

  // Filtered Roster for Teacher Dashboard Quick Scan
  const filteredRoster = useMemo(() => {
    return students.filter(s => {
      if (!s) return false;
      const first = s.firstName ? s.firstName.toLowerCase() : '';
      const last = s.lastName ? s.lastName.toLowerCase() : '';
      const middle = s.middleName ? s.middleName.toLowerCase() : '';
      const query = (studentSearchQuery || '').toLowerCase();
      return first.includes(query) || last.includes(query) || middle.includes(query);
    });
  }, [students, studentSearchQuery]);

  const getInitialsBgColor = (id: string) => {
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = [
      'bg-indigo-50 text-indigo-600 border border-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900/50',
      'bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50',
      'bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50',
      'bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50',
      'bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50',
      'bg-sky-50 text-sky-650 border border-sky-100 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900/50',
    ];
    return colors[hash % colors.length];
  };

  // ----------------------------------------------------
  // CONDITIONAL RENDER FOR TEACHER VIEW (My Class Dashboard)
  // ----------------------------------------------------
  if (userRole === 'Teacher') {
    if (!assignedClass) {
      return (
        <div className="bg-amber-50/50 border border-amber-200 text-amber-800 p-8 rounded-2xl text-center space-y-4 max-w-xl mx-auto my-12 shadow-sm">
          <ShieldAlert size={48} className="text-amber-500 mx-auto animate-bounce" />
          <h3 className="font-bold text-lg">No Class Level Assigned</h3>
          <p className="text-sm text-amber-700 leading-relaxed">
            You are authenticated as a school educator, but you have not yet been assigned to a specific class level by the Headteacher.
          </p>
          <p className="text-xs text-amber-600 font-mono">
            Please contact your Headteacher to assign you to a specific class level (e.g. Basic 2 or Basic 8) in the "Teacher Profiles" directory.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6 text-xs fade-in">
        
        {/* SUBSCRIPTION STATUS LEVEL */}
        {subStatus && (
          <motion.div 
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-2xl border ${
              subStatus.isLocked
                ? 'bg-rose-50 border-rose-200 text-rose-950'
                : subStatus.remainingDays <= 30
                  ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                  : 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
            } flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm no-print`}
          >
            <div className="flex items-start gap-3.5">
              <div className={`p-2.5 rounded-xl shrink-0 flex items-center justify-center ${
                subStatus.isLocked
                  ? 'bg-rose-100 text-rose-700'
                  : subStatus.remainingDays <= 30
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
              }`}>
                {subStatus.isLocked ? <ShieldAlert size={20} className="animate-bounce" /> : <Clock size={20} className="animate-pulse text-emerald-600" />}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black uppercase tracking-wider font-mono text-slate-800">
                    {currentUser?.role === 'Teacher' ? 'Headteacher School Subscription Ticker' : 'School License Status'}
                  </span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-lg font-black font-mono tracking-wide ${
                    subStatus.isLocked
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : subStatus.remainingDays <= 30
                        ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                        : 'bg-emerald-200/90 text-emerald-900 border border-emerald-300'
                  }`}>
                    ⏱️ {subStatus.countdownString}
                  </span>
                </div>
                <p className="text-xs text-slate-600 max-w-4xl font-medium leading-relaxed">
                  {subStatus.message}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
              <div className="text-right hidden sm:block">
                <span className="text-[9px] text-slate-400 block uppercase font-mono font-bold">License Expiry</span>
                <span className="text-xs font-black text-slate-700">
                  {subStatus.expiryDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
              {setActiveTab && (
                <button
                  onClick={() => {
                    if (setSettingsSubTab) {
                      setSettingsSubTab('billing');
                    }
                    setActiveTab('settings');
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black shadow-xs transition active:translate-y-0.5 cursor-pointer flex items-center gap-1.5 ${
                    subStatus.isLocked
                      ? 'bg-rose-600 hover:bg-rose-700 text-white' 
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <Key size={13} />
                  {subStatus.isLocked ? 'Activate License' : 'Manage License'}
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* TEACHER GREETING & CONTEXT CARD */}
        <div className="bg-gradient-to-r from-indigo-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md relative overflow-hidden select-none">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <GraduationCap size={160} />
          </div>
          <div className="space-y-4 relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5 text-left">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-250 text-[10px] font-bold font-mono uppercase tracking-widest border border-indigo-500/35">
                    Educator Access
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                    <CheckCircle2 size={11} />
                    Focused Workspace
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-black tracking-tight text-white font-sans">
                  Welcome back, {teacherName}!
                </h2>
                <p className="text-xs text-indigo-200 font-medium leading-relaxed max-w-2xl">
                  You are viewing the auto-filtered workspace for <strong className="text-white underline decoration-indigo-400 decoration-2 font-black">{assignedClass}</strong>. 
                  Financial metrics, administrative noise, and profiles of other classes are suppressed to maximize your instructional focus.
                </p>
              </div>

              {/* Quick Action Navigation */}
              {setActiveTab && (
                <div className="flex items-center gap-3 self-start md:self-auto">
                  <button
                    onClick={() => setActiveTab('attendance')}
                    className="px-4 py-2 bg-white text-indigo-900 hover:bg-indigo-50 active:translate-y-0.5 rounded-xl font-bold text-xs transition shadow-sm flex items-center gap-2 cursor-pointer"
                  >
                    <UserCheck size={14} />
                    <span>Take Attendance</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('assessments')}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-500/40 active:translate-y-0.5 rounded-xl font-bold text-xs transition shadow-sm flex items-center gap-2 cursor-pointer"
                  >
                    <BookOpen size={14} />
                    <span>Grade Assessments</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CLASS HERO KPIS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* KPI 1: Class Enrollment size */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between text-left">
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 font-mono tracking-wider block">My Class Size</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-850 dark:text-slate-100 tracking-tight">
                  {students.length}
                </span>
                <span className="text-[10px] text-slate-500 font-bold">Students</span>
              </div>
              <p className="text-[9.5px] text-slate-500 font-medium">
                {maleEnrolledCounter} Boys • {femaleEnrolledCounter} Girls
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Users size={20} />
            </div>
          </motion.div>

          {/* KPI 2: Attendance Rate */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between text-left">
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 font-mono tracking-wider block">Class Attendance Avg</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-850 dark:text-slate-100 tracking-tight">
                  {overallAttendanceRate || 95}%
                </span>
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/20 px-1 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/40">Active</span>
              </div>
              <p className="text-[9.5px] text-slate-500 font-medium">
                Average across terms daily logs
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Calendar size={20} />
            </div>
          </motion.div>

          {/* KPI 3: Class Academic GPA Average */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between text-left">
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 font-mono tracking-wider block">Class Subject Average</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-850 dark:text-slate-100 tracking-tight">
                  {classAcademicAverage}%
                </span>
                <span className="text-[10px] text-slate-500 font-bold">Average</span>
              </div>
              <p className="text-[9.5px] text-slate-500 font-medium">
                GES Continuous Assessment
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Award size={20} />
            </div>
          </motion.div>

          {/* KPI 4: Assessments logged */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.4 }} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between text-left">
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 font-mono tracking-wider block">Assessments Marked</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-850 dark:text-slate-100 tracking-tight">
                  {classAssessments.length}
                </span>
                <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 dark:bg-indigo-950/20 px-1 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/40">Rubrics</span>
              </div>
              <p className="text-[9.5px] text-slate-500 font-medium">
                Completed graded rubric lines
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-450 flex items-center justify-center">
              <FileCheck size={20} />
            </div>
          </motion.div>

        </div>

        {/* MULTI-TERM STUDENT PERFORMANCE LINE CHART */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <MultiTermPerformanceLineChart 
            data={multiTermDashboardLineData}
            title="Multi-Term Subject Performance Line Graph"
            subtitle={`Comparative subject performance across Term 1, Term 2, and Term 3 (${selectedDashboardYear})`}
            theme={theme}
            selectedClass={assignedClass === 'None' ? 'All Classes' : assignedClass}
          />
        </motion.div>

        {/* INTERACTIVE DATA COLUMNS WORKSPACE */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          
          {/* LEFT 3 COLS: ROSTER SCANNER & ATTENDANCE TRENDS */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Class Roster Quick Scanner */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col h-[480px]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-150 dark:border-slate-800">
                <div className="text-left">
                  <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="text-indigo-600" size={15} />
                    Class Roster Quick Scanner
                  </h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase">Review student list profiles and individual ratings</p>
                </div>
                
                {/* Search Bar */}
                <div className="relative max-w-xs w-full">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search students..."
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[11px] font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                  />
                </div>
              </div>

              {/* Roster Container */}
              <div className="flex-1 overflow-y-auto pr-1 mt-3 space-y-2.5 custom-scrollbar">
                {filteredRoster.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-2 py-12">
                    <Users className="text-slate-300 dark:text-slate-700" size={32} />
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-bold">No students found matching your search</p>
                  </div>
                ) : (
                  filteredRoster.map((student) => {
                    const initials = `${student.firstName[0] || ''}${student.lastName[0] || ''}`.toUpperCase();
                    const sAvg = studentAttendanceAverages[student.id];
                    const rate = sAvg && sAvg.total > 0 ? Math.round((sAvg.present / sAvg.total) * 100) : 95;
                    
                    let attendColor = 'bg-emerald-500';
                    let attendText = 'text-emerald-600';
                    if (rate < 90) {
                      attendColor = 'bg-rose-500';
                      attendText = 'text-rose-600';
                    } else if (rate < 95) {
                      attendColor = 'bg-amber-500';
                      attendText = 'text-amber-600';
                    }

                    return (
                      <div 
                        key={student.id} 
                        className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-850 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-950/50 transition duration-150 text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center font-black text-xs ${getInitialsBgColor(student.id)}`}>
                            {initials}
                          </div>
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-850 dark:text-slate-200 text-xs">
                              {student.firstName} {student.lastName}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[9.5px] font-mono text-slate-400">ID: {student.id}</span>
                              <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold font-mono uppercase">
                                {student.status}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          {/* Attendance Rate Slider */}
                          <div className="text-right hidden sm:block">
                            <span className="text-[9px] uppercase font-bold text-slate-400 font-mono block">Attendance</span>
                            <div className="flex items-center gap-1.5">
                              <span className={`font-mono text-[10.5px] font-bold ${attendText}`}>{rate}%</span>
                              <div className="w-12 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div className={`h-full ${attendColor}`} style={{ width: `${rate}%` }} />
                              </div>
                            </div>
                          </div>

                          {/* Action Navigation triggers */}
                          {setActiveTab && (
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => setActiveTab('attendance')}
                                className="p-1.5 rounded-lg bg-slate-50 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 border border-slate-100 hover:border-emerald-200 transition cursor-pointer"
                                title="Mark Attendance"
                              >
                                <UserCheck size={12} />
                              </button>
                              <button 
                                onClick={() => setActiveTab('assessments')}
                                className="p-1.5 rounded-lg bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 border border-slate-100 hover:border-indigo-200 transition cursor-pointer"
                                title="Add Marks"
                              >
                                <BookOpen size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Recent Attendance Ledger */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm text-left">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-150 dark:border-slate-800 pb-3">
                <Calendar className="text-emerald-600" size={15} />
                Recent Daily Attendance Logs
              </h3>
              
              <div className="mt-4 space-y-3">
                {classRecentAttendance.map((log, index) => {
                  let badgeColor = 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40';
                  if (log.rate < 93) {
                    badgeColor = 'text-rose-600 bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40';
                  } else if (log.rate < 96) {
                    badgeColor = 'text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40';
                  }

                  return (
                    <div key={index} className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-850 rounded-xl">
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-700 dark:text-slate-200 font-mono text-xs">{log.date}</span>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                          Present: <strong className="text-slate-700 dark:text-slate-300">{log.present}</strong> • Absent: <strong className="text-slate-700 dark:text-slate-300">{log.absent}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 text-[10px] font-black font-mono uppercase tracking-wider rounded-lg border ${badgeColor}`}>
                          {log.rate}% Rate
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* RIGHT 2 COLS: SUBJECTS INDEX & GRADES MIX */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Subject Achievement Index */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm text-left flex flex-col h-[400px]">
              <div className="pb-3 border-b border-slate-150 dark:border-slate-800">
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="text-indigo-600" size={15} />
                  Subject Achievement Index
                </h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase">Class assessment scores averages by subject area</p>
              </div>

              {/* Progress list */}
              <div className="flex-1 overflow-y-auto pr-1 mt-4 space-y-4 custom-scrollbar">
                {subjectAverages.map((sub, index) => {
                  let barColor = 'bg-indigo-600';
                  if (sub.average >= 85) barColor = 'bg-emerald-500';
                  else if (sub.average < 75) barColor = 'bg-amber-500';

                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-200">{sub.subject}</span>
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-black text-slate-800 dark:text-slate-100">{sub.average}%</span>
                          <span className="text-[8.5px] text-slate-400 font-semibold">({sub.count} marked)</span>
                        </div>
                      </div>
                      
                      {/* Bar */}
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                          style={{ width: `${sub.average}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Learning Mastery Levels Distribution (L1-L5) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm text-left">
              <div className="pb-3 border-b border-slate-150 dark:border-slate-800">
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="text-amber-600" size={15} />
                  Mastery Levels Distribution
                </h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase">GES Standard Assessment Grading mix</p>
              </div>

              <div className="mt-4 space-y-3">
                {classGradeLevels.map((lvl, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">{lvl.name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{lvl.pct}%</span>
                        <span className="text-[9px] text-slate-400">({lvl.value} students)</span>
                      </div>
                    </div>
                    
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500" 
                        style={{ 
                          backgroundColor: lvl.color,
                          width: `${lvl.pct}%` 
                        }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

      </div>
    );
  }

  const renderWidgetContainer = (key: string, child: React.ReactNode) => {
    const size = widgetSizes[key] || 'normal';
    const sizeClasses = {
      normal: 'col-span-1 min-h-[365px]',
      wide: 'col-span-1 lg:col-span-2 min-h-[365px]',
      full: 'col-span-1 lg:col-span-3 min-h-[365px]'
    };
    
    const isDragging = draggingId === key;
    const isOver = dragOverId === key;

    return (
      <motion.div
        key={key}
        layout
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`relative rounded-2xl transition-all duration-200 border border-slate-200 bg-white shadow-sm hover:shadow-md ${sizeClasses[size]} ${
          isDragging ? 'opacity-40 scale-95 border-dashed border-2 border-indigo-400 bg-indigo-50/10' : ''
        } ${
          isOver ? 'ring-2 ring-indigo-500 ring-offset-2 scale-[1.01]' : ''
        }`}
        draggable={isCustomizing}
        onDragStart={(e: any) => {
          setDraggingId(key);
          e.dataTransfer.setData('text/plain', key);
        }}
        onDragEnd={() => {
          setDraggingId(null);
          setDragOverId(null);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (draggingId !== key) {
            setDragOverId(key);
          }
        }}
        onDragLeave={() => {
          if (dragOverId === key) {
            setDragOverId(null);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          const draggedId = e.dataTransfer.getData('text/plain');
          if (draggedId && draggedId !== key) {
            const draggedIdx = widgetOrder.indexOf(draggedId);
            const targetIdx = widgetOrder.indexOf(key);
            if (draggedIdx !== -1 && targetIdx !== -1) {
              const newOrder = [...widgetOrder];
              newOrder.splice(draggedIdx, 1);
              newOrder.splice(targetIdx, 0, draggedId);
              setWidgetOrder(newOrder);
              setStorageItem('sms_dashboard_widget_order', newOrder);
            }
          }
          setDraggingId(null);
          setDragOverId(null);
        }}
      >
        {/* Customizer Overlay controls */}
        {isCustomizing && (
          <div className="absolute top-2.5 right-2.5 z-50 flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md no-print select-none">
            <button
              type="button"
              title="Move Left / Up"
              onClick={() => moveWidget(key, 'up')}
              className="p-1 text-slate-500 hover:text-indigo-600 rounded hover:bg-slate-100 dark:hover:bg-slate-850 cursor-pointer"
            >
              <ChevronRight size={14} className="rotate-180" />
            </button>
            <button
              type="button"
              title="Move Right / Down"
              onClick={() => moveWidget(key, 'down')}
              className="p-1 text-slate-500 hover:text-indigo-600 rounded hover:bg-slate-100 dark:hover:bg-slate-850 cursor-pointer"
            >
              <ChevronRight size={14} />
            </button>
            <div className="w-[1px] h-3.5 bg-slate-200 dark:bg-slate-800 mx-1" />
            <select
              value={size}
              onChange={(e) => updateWidgetSize(key, e.target.value as 'normal' | 'wide' | 'full')}
              className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 bg-transparent border-0 focus:ring-0 px-1 py-0.5 cursor-pointer outline-none font-mono"
            >
              <option value="normal">Normal</option>
              <option value="wide">Wide</option>
              <option value="full">Full-Width</option>
            </select>
            <div className="w-[1px] h-3.5 bg-slate-200 dark:bg-slate-800 mx-1" />
            <button
              type="button"
              title="Hide Widget"
              onClick={() => toggleWidget(key as keyof typeof widgets)}
              className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded cursor-pointer"
            >
              <EyeOff size={13} />
            </button>
          </div>
        )}
        
        {/* Draggable Icon visual indicator when in customize mode */}
        {isCustomizing && (
          <div className="absolute top-2.5 left-2.5 z-45 p-1 rounded-lg bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-400 cursor-grab active:cursor-grabbing flex items-center gap-1">
            <SlidersHorizontal size={11} className="rotate-90" />
            <span className="text-[9px] font-black uppercase tracking-wider font-mono text-slate-500">Drag Card</span>
          </div>
        )}

        {/* Widget Card actual content */}
        <div className={`h-full ${isCustomizing ? 'pt-8' : ''}`}>
          {child}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* SUBSCRIPTION STATUS LEVEL */}
      {subStatus && (
        <motion.div 
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl border ${
            subStatus.isLocked 
              ? 'bg-rose-50/70 border-rose-200 text-rose-950' 
              : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
          } flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs no-print`}
        >
          <div className="flex items-start gap-3.5">
            <div className={`p-2.5 rounded-xl shrink-0 flex items-center justify-center ${
              subStatus.isLocked 
                ? 'bg-rose-100 text-rose-700' 
                : 'bg-emerald-100 text-emerald-700'
            }`}>
              {subStatus.isLocked ? <Lock size={20} className="animate-pulse" /> : <ShieldCheck size={20} />}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider font-mono">
                  {subStatus.isLocked ? 'License Required' : 'Annual School License'}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-extrabold uppercase font-mono ${
                  subStatus.isLocked 
                    ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}>
                  {subStatus.isLocked ? 'Locked / Inactive' : `${subStatus.remainingDays} Days Remaining`}
                </span>
              </div>
              <p className="text-xs text-slate-600 max-w-4xl font-medium leading-relaxed">
                {subStatus.message}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
            <div className="text-right hidden sm:block">
              <span className="text-[9px] text-slate-400 block uppercase font-mono font-bold">Expiration Boundary</span>
              <span className="text-xs font-black text-slate-700">
                {subStatus.isLocked ? 'Action Required' : subStatus.expiryDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
            {setActiveTab && (
              <button
                onClick={() => {
                  if (setSettingsSubTab) {
                    setSettingsSubTab('billing');
                  }
                  setActiveTab('settings');
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black shadow-xs transition active:translate-y-0.5 cursor-pointer flex items-center gap-1.5 ${
                  subStatus.isLocked 
                    ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                <Key size={13} />
                {subStatus.isLocked ? 'Activate License' : 'Manage License'}
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* DASHBOARD CONTROL BAR & LAYOUT CUSTOMIZER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print select-none">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 rounded-xl">
            <LayoutGrid size={18} />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              Dashboard Summary Customizer
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-none mt-0.5">
              Personalize layout by toggling visibility of summary widgets & charts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-xl font-bold border border-slate-200/65 dark:border-slate-700/60 font-mono">
            Active: {Object.values(widgets).filter(Boolean).length} of {Object.keys(widgets).length}
          </span>

          <button
            onClick={() => setIsCustomizing(!isCustomizing)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition active:translate-y-0.5 cursor-pointer border ${
              isCustomizing 
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/10' 
                : 'bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
            }`}
          >
            <SlidersHorizontal size={13} />
            <span>{isCustomizing ? 'Close Settings' : 'Customize Widgets'}</span>
          </button>
        </div>
      </div>

      {/* COLLAPSIBLE WIDGET BOARD */}
      {isCustomizing && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-4 no-print shadow-xs text-left"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-850 pb-3">
            <div>
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                Select Widgets to Display
              </h4>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                Customize your layout view. Changes are automatically saved to your browser preferences.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={showAllWidgets}
                className="px-2.5 py-1 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-lg text-[10px] border border-slate-200 dark:border-slate-800 transition cursor-pointer"
              >
                Show All
              </button>
              <button
                onClick={hideAllWidgets}
                className="px-2.5 py-1 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-lg text-[10px] border border-slate-200 dark:border-slate-800 transition cursor-pointer"
              >
                Hide All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {widgetDefinitions.map((w) => {
              const isActive = widgets[w.key as keyof typeof widgets];
              return (
                <div 
                  key={w.key}
                  onClick={() => toggleWidget(w.key as keyof typeof widgets)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer select-none flex flex-col justify-between gap-3 ${
                    isActive 
                      ? 'bg-white dark:bg-slate-900 border-indigo-500/40 shadow-xs ring-1 ring-indigo-500/5' 
                      : 'bg-slate-100/60 dark:bg-slate-950 border-slate-200/80 dark:border-slate-900/80 opacity-60'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-850 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800/80 font-mono">
                        {w.category}
                      </span>
                      {isActive ? (
                        <Eye className="text-emerald-500" size={13} />
                      ) : (
                        <EyeOff className="text-slate-400" size={13} />
                      )}
                    </div>
                    <h5 className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-tight">
                      {w.label}
                    </h5>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-snug">
                      {w.desc}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-4 rounded-full p-0.5 transition duration-200 ${isActive ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                      <div className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${isActive ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                    <span className="text-[9.5px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 font-mono">
                      {isActive ? 'Visible' : 'Hidden'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* 4 CORE KPI HERO BLOCKS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        
        {/* KPI 1: Active Enrollment */}
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between"
        >
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider block">Total Active Enrollment</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-800 tracking-tight">
                {totalEnrolledCounter}
              </span>
            </div>
            <div className="text-[9.5px] text-slate-500 font-medium">
              Male: <strong className="text-slate-700">{maleEnrolledCounter}</strong> • Female: <strong className="text-slate-700">{femaleEnrolledCounter}</strong>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users size={20} />
          </div>
        </motion.div>

        {/* KPI 2: Teacher Cadre */}
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between"
        >
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider block">Instructional Staff</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-800 tracking-tight">
                {teachers.length}
              </span>
            </div>
            <div className="text-[9.5px] text-slate-500 font-medium">
              GES Certified Staff Roster Logs
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
            <Award size={20} />
          </div>
        </motion.div>

        {/* KPI 3: Global Attendance Rate */}
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between"
        >
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider block">Avg. Session Attendance</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-800 tracking-tight">
                {overallAttendanceRate}%
              </span>
            </div>
            <div className="text-[9.5px] text-slate-500 font-medium">
              Active Term Daily Attendance Rate <span className="text-indigo-500 font-bold ml-1">({activeTermWeeks} Weeks Term)</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Percent size={20} />
          </div>
        </motion.div>

        {/* KPI 4: Bill Collection Rate */}
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between"
        >
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider block">Fee Settlement Rate</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-800 tracking-tight">
                {hasBillingData ? `${collectionRate}%` : "0%"}
              </span>
            </div>
            <div className="text-[9.5px] text-slate-500 font-medium truncate">
              Paid: <strong className="text-slate-700">GH¢{hasBillingData ? totalPaidGlobal.toLocaleString() : "0.00"}</strong>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Coins size={20} />
          </div>
        </motion.div>

      </div>

      {/* DYNAMIC AND DRAGGABLE CUSTOMIZABLE WIDGETS BOARD */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {widgetOrder.map((key) => {
          if (!widgets[key as keyof typeof widgets]) return null;

          switch (key) {
            case 'teacherRoles':
              if (userRole !== 'Headteacher' && userRole !== 'Admin') return null;
              return renderWidgetContainer(key, (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5 text-left">
                  {/* Header with synced Headteacher subscription badge */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldCheck className="text-indigo-600" size={16} />
                        Assigned Teachers, Role Governance &amp; Live Teacher Page Changes
                      </h4>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">
                        All teacher roles &amp; changes sync 1:1 with Headteacher&apos;s subscription under UID:{' '}
                        <span className="font-mono text-indigo-600">{DbController.resolveHeadteacherUserId(DbController.resolveActiveSchoolId())}</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {subStatus && (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black border font-mono ${
                          subStatus.isLocked
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          <Clock size={12} />
                          Synced Period: {subStatus.isLocked ? 'Inactive / Expired' : `${subStatus.countdownString} (Exp: ${subStatus.expiryDate.toLocaleDateString()})`}
                        </span>
                      )}
                      {setActiveTab && (
                        <button
                          onClick={() => setActiveTab('teachers')}
                          className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-black uppercase tracking-wider transition cursor-pointer"
                        >
                          Manage Staff Registry
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Two-column body: Assigned Teachers 4-Role Matrix + Live Changes from Teachers' Pages */}
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                    {/* Left: Teachers Roster + 4 Role Toggles */}
                    <div className="xl:col-span-7 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Enrolled Teachers &amp; Assigned Roles ({teachers.length})
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          Click any role badge to toggle access
                        </span>
                      </div>

                      {teachers.length === 0 ? (
                        <WidgetEmptyState
                          icon={Users}
                          title="No Enrolled Teachers"
                          description="Add teachers under the Teacher Profiles registry to assign roles and monitor changes."
                        />
                      ) : (
                        <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
                          {teachers.map((t) => {
                            const fullName = DbController.formatTeacherFullName(t);
                            const perms = t.permissions || {};
                            const roleItems: Array<{
                              key: 'canAccessStudents' | 'canAccessAttendance' | 'canAccessAssessments' | 'canAccessSystemControl';
                              label: string;
                              enabled: boolean;
                            }> = [
                              { key: 'canAccessStudents', label: 'Student Profiles', enabled: perms.canAccessStudents !== false },
                              { key: 'canAccessAttendance', label: 'Class Attendance Roster', enabled: perms.canAccessAttendance !== false },
                              { key: 'canAccessAssessments', label: 'Academic Assessment', enabled: perms.canAccessAssessments !== false },
                              { key: 'canAccessSystemControl', label: 'System Control', enabled: perms.canAccessSystemControl !== false },
                            ];

                            const assignedClassList = Array.from(new Set([
                              ...(t.assignedClasses || []),
                              ...(t.assignedClass && t.assignedClass !== 'None' ? [t.assignedClass] : [])
                            ]));

                            const teacherUserAcc = DbController.getRegisteredUsers().find(
                              u => u.role === 'Teacher' && (
                                (t.email && u.email?.toLowerCase().trim() === t.email.toLowerCase().trim()) ||
                                (t.staffId && u.staffId === t.staffId)
                              )
                            );
                            const teacherSub = teacherUserAcc ? evaluateSubscription(teacherUserAcc) : subStatus;

                            return (
                              <div key={t.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white transition space-y-2.5">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-black text-slate-800">{fullName}</span>
                                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-600">
                                        {t.staffId || t.id}
                                      </span>
                                      {t.rank && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                                          {t.rank}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                      <span>
                                        Classes: <strong className="text-slate-700">{assignedClassList.length > 0 ? assignedClassList.join(', ') : 'Unassigned'}</strong>
                                      </span>
                                      {t.email && <span>Email: {t.email}</span>}
                                    </div>
                                  </div>
                                  {teacherSub && (
                                    <span className={`text-[9px] font-mono font-black px-2 py-0.5 rounded-md border shrink-0 self-start sm:self-center ${
                                      teacherSub.isLocked
                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    }`}>
                                      {teacherSub.isLocked
                                        ? 'Subscription Inactive'
                                        : `Sub Match: ${teacherSub.remainingDays}d left (${teacherSub.expiryDate.toLocaleDateString()})`}
                                    </span>
                                  )}
                                </div>

                                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-200/70">
                                  {roleItems.map((r) => (
                                    <button
                                      key={r.key}
                                      type="button"
                                      onClick={() => handleToggleTeacherRole(t, r.key)}
                                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                                        r.enabled
                                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                          : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                                      }`}
                                      title={`Click to ${r.enabled ? 'revoke' : 'grant'} ${r.label}`}
                                    >
                                      <span className={`w-1.5 h-1.5 rounded-full ${r.enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                      <span>{r.label}</span>
                                      <span className="font-mono text-[9px] uppercase opacity-75">
                                        {r.enabled ? 'ON' : 'OFF'}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Right: Live Changes & Submissions from Teachers' Pages */}
                    <div className="xl:col-span-5 space-y-3 border-t xl:border-t-0 xl:border-l border-slate-100 pt-4 xl:pt-0 xl:pl-5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Live Changes from Teachers&apos; Pages
                        </span>
                        <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {teacherReflections.length + leaveRequests.length + teacherTasks.length} Updates
                        </span>
                      </div>

                      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
                        {/* Pending / Recent Leave Requests */}
                        {leaveRequests.slice(0, 4).map((req) => {
                          const matchedT = teachers.find(t => t.id === req.teacherId || t.staffId === req.teacherId);
                          const displayTName = matchedT ? DbController.formatTeacherFullName(matchedT) : req.teacherName;
                          return (
                            <div key={req.id} className="p-3 rounded-xl border border-amber-200/80 bg-amber-50/40 space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black text-amber-900 uppercase">
                                  Leave Request • {displayTName}
                                </span>
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
                                  req.status === 'Approved'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : req.status === 'Rejected'
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : 'bg-amber-100 text-amber-800 border-amber-300'
                                }`}>
                                  {req.status}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-600 font-medium">
                                {req.startDate} to {req.endDate} — {req.reason}
                              </p>
                              {req.status === 'Pending' && (
                                <div className="flex items-center gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => handleLeaveDecision(req, 'Approved')}
                                    className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black cursor-pointer"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleLeaveDecision(req, 'Rejected')}
                                    className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-black cursor-pointer"
                                  >
                                    Reject
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Recent Teacher Reflections & Classroom Strategies */}
                        {teacherReflections.slice(0, 5).map((ref) => {
                          const matchedT = teachers.find(t => t.id === ref.teacherId || t.staffId === ref.teacherId);
                          const displayTName = matchedT ? DbController.formatTeacherFullName(matchedT) : (ref.teacherName || 'Educator');
                          return (
                            <div key={ref.id} className="p-3 rounded-xl border border-indigo-100 bg-indigo-50/30 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black text-indigo-900">
                                  {displayTName} {ref.class ? `(${ref.class})` : ''}
                                </span>
                                <span className="text-[9px] font-mono text-slate-400">
                                  {ref.date}
                                </span>
                              </div>
                              <div className="text-[9px] font-bold uppercase text-indigo-600">
                                {ref.category}{ref.weeklyStrategyTitle ? ` — ${ref.weeklyStrategyTitle}` : ''}
                              </div>
                              <p className="text-[10px] text-slate-600 line-clamp-2 leading-relaxed">
                                {ref.content}
                              </p>
                            </div>
                          );
                        })}

                        {/* Recent Teacher Activity Logs */}
                        {activityLogs.slice(0, 6).map((log) => (
                          <div key={log.id} className="p-2.5 rounded-xl border border-slate-150 bg-slate-50/60 space-y-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-black text-slate-700 uppercase">{log.action}</span>
                              <span className="text-[9px] font-mono text-slate-400">
                                {new Date(log.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-600 leading-snug">{log.details}</p>
                          </div>
                        ))}

                        {leaveRequests.length === 0 && teacherReflections.length === 0 && activityLogs.length === 0 && (
                          <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded-xl">
                            <p className="text-xs font-bold">No teacher changes recorded yet.</p>
                            <p className="text-[10px] mt-1">Updates made in Student Profiles, Attendance, Assessments, Reflections &amp; Leave appear here in real time.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ));

            case 'quickNotes':
              return renderWidgetContainer(key, (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between h-full text-left">
                  <div className="space-y-4">
                    {/* Header bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <StickyNote className="text-amber-500" size={16} />
                          Quick Notes & Urgent Memos
                        </h4>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">
                          Persistent administrative reminders & staff notices ({quickNotes.length} saved)
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Expand / Collapse All Button */}
                        {filteredQuickNotes.length > 0 && (
                          <button
                            onClick={() => {
                              const allExpanded = filteredQuickNotes.every(n => expandedNoteIds.has(n.id));
                              if (allExpanded) {
                                collapseAllNotes();
                              } else {
                                expandAllNotes(filteredQuickNotes.map(n => n.id));
                              }
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1 transition shadow-xs cursor-pointer shrink-0 border border-slate-200"
                            title={filteredQuickNotes.every(n => expandedNoteIds.has(n.id)) ? 'Collapse All Notes' : 'Expand All Notes'}
                          >
                            {filteredQuickNotes.every(n => expandedNoteIds.has(n.id)) ? (
                              <>
                                <ChevronUp size={13} />
                                <span className="hidden sm:inline">Collapse All</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown size={13} />
                                <span className="hidden sm:inline">Expand All</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* Priority Filter */}
                        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px]">
                          {(['all', 'urgent', 'high', 'medium', 'low'] as const).map((p) => (
                            <button
                              key={p}
                              onClick={() => setNotePriorityFilter(p)}
                              className={`px-2 py-0.5 rounded-md font-bold capitalize transition cursor-pointer ${
                                notePriorityFilter === p
                                  ? 'bg-white text-slate-900 shadow-xs'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>

                        {/* Add Note Button */}
                        <button
                          onClick={openCreateNoteModal}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:translate-y-0.5 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer shrink-0"
                        >
                          <Plus size={14} />
                          Add Note
                        </button>
                      </div>
                    </div>

                    {/* Department Category Filter Bar */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] no-scrollbar">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
                        <Tag size={10} /> Department:
                      </span>
                      <button
                        onClick={() => setNoteCategoryFilter('all')}
                        className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition cursor-pointer border ${
                          noteCategoryFilter === 'all'
                            ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        All ({quickNotes.length})
                      </button>
                      {(['Academic', 'Finance', 'Personnel', 'Events', 'Maintenance', 'General'] as NoteCategory[]).map((cat) => {
                        const catInfo = categoryConfig[cat];
                        const CatIcon = catInfo.icon;
                        const count = quickNotes.filter(n => (n.category || 'General') === cat).length;
                        return (
                          <button
                            key={cat}
                            onClick={() => setNoteCategoryFilter(cat)}
                            className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition cursor-pointer flex items-center gap-1 border ${
                              noteCategoryFilter === cat
                                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            <CatIcon size={11} />
                            {cat} ({count})
                          </button>
                        );
                      })}
                    </div>

                      {/* Search bar */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="text"
                          placeholder="Search notes or memos..."
                          value={noteSearch}
                          onChange={(e) => setNoteSearch(e.target.value)}
                          className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-slate-700"
                        />
                        {noteSearch && (
                          <button
                            onClick={() => setNoteSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>

                      {/* Notes Grid / List */}
                      {filteredQuickNotes.length === 0 ? (
                        <div className="py-8 text-center bg-slate-50/50 dark:bg-slate-950/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                          <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center mx-auto">
                            <StickyNote size={20} />
                          </div>
                          <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No notes found</p>
                          <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                            {noteSearch || notePriorityFilter !== 'all' || noteCategoryFilter !== 'all'
                              ? 'Try clearing your search query, department category, or priority filters.'
                              : 'Click "Add Note" above to jot down urgent reminders or memos for your team.'}
                          </p>
                          {!noteSearch && notePriorityFilter === 'all' && noteCategoryFilter === 'all' && (
                            <button
                              onClick={openCreateNoteModal}
                              className="mt-2 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold rounded-lg text-xs inline-flex items-center gap-1 transition cursor-pointer"
                            >
                              <Plus size={12} /> Create First Memo
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          <AnimatePresence mode="popLayout">
                            {filteredQuickNotes.map((note) => {
                              const style = colorStyles[note.color] || colorStyles.amber;
                              const cat = note.category || 'General';
                              const catInfo = categoryConfig[cat] || categoryConfig.General;
                              const CatIcon = catInfo.icon;
                              const isExpanded = expandedNoteIds.has(note.id);
                              const isLongContent = note.content.length > 130 || note.content.split('\n').length > 3;

                              return (
                                <motion.div
                                  key={note.id}
                                  layout
                                  initial={{ opacity: 0, scale: 0.9, y: 15 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.85, y: -10 }}
                                  transition={{ duration: 0.22, ease: 'easeOut' }}
                                  className={`p-4 rounded-xl border transition-colors duration-200 flex flex-col justify-between gap-3 relative group ${style.bg} ${style.border} ${
                                    note.isPinned ? 'ring-2 ring-amber-400/50 shadow-sm' : ''
                                  }`}
                                >
                                  <div className="space-y-2">
                                    {/* Top bar: Pin badge + priority pill + department category badge + actions */}
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        {note.isPinned && (
                                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500 text-white font-black text-[9px] uppercase tracking-wider shadow-xs">
                                            <Pin size={10} className="fill-white" /> Pinned
                                          </span>
                                        )}
                                        
                                        {/* Department Category Badge */}
                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold border ${catInfo.colorClass} ${catInfo.borderClass}`}>
                                          <CatIcon size={10} />
                                          {catInfo.label}
                                        </span>

                                        {/* Target Audience Badge */}
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                          <Users size={9} />
                                          {note.targetAudience === 'specific_class'
                                            ? `To: ${note.targetClass || 'Class'} Teacher`
                                            : note.targetAudience === 'class_teachers'
                                            ? 'To: Class Teachers'
                                            : 'To: All Staff'}
                                        </span>

                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                          note.priority === 'urgent'
                                            ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
                                            : note.priority === 'high'
                                            ? 'bg-amber-500 text-white border-amber-600'
                                            : note.priority === 'medium'
                                            ? 'bg-blue-500 text-white border-blue-600'
                                            : 'bg-slate-400 text-white border-slate-500'
                                        }`}>
                                          {note.priority}
                                        </span>

                                        {note.dueDate && (() => {
                                          const dueInfo = getDueDateStatus(note.dueDate);
                                          if (!dueInfo) return null;
                                          const DueIcon = dueInfo.icon;
                                          return (
                                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold border ${dueInfo.colorClass}`} title={`Due Date: ${note.dueDate}`}>
                                              <DueIcon size={10} />
                                              {dueInfo.label}
                                            </span>
                                          );
                                        })()}
                                      </div>

                                      <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">

                                   {isLongContent && (
                                        <button
                                          onClick={() => toggleNoteExpand(note.id)}
                                          title={isExpanded ? 'Collapse Note' : 'Expand Note'}
                                          className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-white transition cursor-pointer"
                                        >
                                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleTogglePin(note.id)}
                                        title={note.isPinned ? 'Unpin Note' : 'Pin to Top'}
                                        className={`p-1.5 rounded-lg transition cursor-pointer ${
                                          note.isPinned
                                            ? 'bg-amber-500 text-white'
                                            : 'bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-white'
                                        }`}
                                      >
                                        <Pin size={12} className={note.isPinned ? 'fill-white' : ''} />
                                      </button>
                                      <button
                                        onClick={() => openEditNoteModal(note)}
                                        title="Edit Note"
                                        className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-white transition cursor-pointer"
                                      >
                                        <Edit3 size={12} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteNote(note.id)}
                                        title="Delete Note"
                                        className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Staff Meeting Notice Callout Box */}
                                  {note.isMeetingNotice && (
                                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10.5px] space-y-1 my-1">
                                      <div className="flex items-center justify-between text-amber-800 dark:text-amber-200 font-black uppercase tracking-wider text-[9.5px]">
                                        <span className="flex items-center gap-1">
                                          <Calendar size={11} className="text-amber-600" /> Staff Meeting Notice
                                        </span>
                                        {note.meetingVenue && (
                                          <span className="flex items-center gap-1">
                                            <MapPin size={10} /> {note.meetingVenue}
                                          </span>
                                        )}
                                      </div>
                                      {(note.meetingDate || note.meetingTime) && (
                                        <p className="font-bold text-amber-900 dark:text-amber-100">
                                          📅 {note.meetingDate || 'Date TBD'} {note.meetingTime ? `at ${note.meetingTime}` : ''}
                                        </p>
                                      )}
                                    </div>
                                  )}

                                  {/* Note Title */}
                                  <h5 className={`text-xs font-bold leading-tight ${style.text}`}>
                                    {note.title}
                                  </h5>

                                  {/* Note Content with Markdown rendering and expand/collapse support */}
                                  <div className="relative">
                                    <motion.div
                                      layout
                                      initial={false}
                                      animate={{ height: !isExpanded && isLongContent ? 68 : 'auto' }}
                                      transition={{ duration: 0.22, ease: 'easeInOut' }}
                                      className="overflow-hidden prose prose-xs max-w-none text-[11px] text-slate-700 dark:text-slate-300 font-sans leading-relaxed break-words font-medium [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:mb-1 [&_strong]:font-black [&_strong]:text-slate-900 dark:[&_strong]:text-white [&_h3]:font-black [&_h3]:text-xs [&_h3]:mt-1 [&_h3]:mb-0.5 [&_blockquote]:border-l-2 [&_blockquote]:border-amber-400 [&_blockquote]:pl-2 [&_blockquote]:italic [&_code]:bg-white/60 dark:[&_code]:bg-slate-900/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-[10px]"
                                    >
                                      <Markdown>{note.content}</Markdown>
                                    </motion.div>

                                    {!isExpanded && isLongContent && (
                                      <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-slate-100/90 dark:from-slate-900/90 to-transparent pointer-events-none rounded-b-md" />
                                    )}
                                  </div>

                                  {isLongContent && (
                                    <button
                                      onClick={() => toggleNoteExpand(note.id)}
                                      className="mt-0.5 text-[10.5px] font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 inline-flex items-center gap-1 cursor-pointer transition"
                                    >
                                      {isExpanded ? (
                                        <>
                                          <ChevronUp size={11} /> Show less
                                        </>
                                      ) : (
                                        <>
                                          <ChevronDown size={11} /> Read full memo
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>

                                {/* Note Footer */}
                                <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between text-[9.5px] text-slate-400 dark:text-slate-500">
                                  <span>{note.author ? `By ${note.author}` : 'Admin Memo'}</span>
                                  <span className="font-mono">
                                    {new Date(note.createdAt).toLocaleDateString(undefined, {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </div>
              ));
            case 'dailyAttendance':
              return renderWidgetContainer(key, (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between h-full text-left">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start pb-2 border-b border-slate-100">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <FileCheck className="text-blue-600" size={16} />
                          Attendance Summary
                        </h4>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Live status log of today's student attendance</p>
                      </div>
                      
                      {/* Date selection controller */}
                      <div className="flex items-center gap-1.5">
                        <input 
                          type="date"
                          value={selectedAttendanceDate}
                          onChange={(e) => setSelectedAttendanceDate(e.target.value)}
                          className="px-2 py-1 text-[10px] font-bold font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50 text-slate-700"
                        />
                      </div>
                    </div>

                    <div className={(widgetSizes.dailyAttendance === 'wide' || widgetSizes.dailyAttendance === 'full') ? "grid grid-cols-1 md:grid-cols-2 gap-6" : "space-y-3"}>
                      <div className="space-y-3">
                        {/* Quick Summary Pill Row */}
                        <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[10.5px]">
                          <span className="text-slate-500 font-medium font-sans">
                            Active Date: <strong className="text-slate-800 font-mono">{selectedAttendanceDate}</strong>
                          </span>
                          <span className="font-bold flex items-center gap-1 text-slate-700">
                            <span className={`w-1.5 h-1.5 rounded-full ${classesWithTodayAttendanceCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                            {classesWithTodayAttendanceCount} of {totalClassesTodayCount} Marked
                          </span>
                        </div>

                        <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center space-y-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Overall Present Rate</span>
                          <span className="text-2xl font-black text-slate-800 font-mono">{overallAttendanceRate}%</span>
                        </div>
                      </div>

                      {/* Scrollable list of classroom logs */}
                      <div className="max-h-[175px] overflow-y-auto pr-1 space-y-2 custom-scrollbar text-xs">
                        {classTodayAttendance.map((cls) => {
                          let statusColor = 'text-slate-400';
                          let progressFill = 'bg-slate-300';
                          
                          if (cls.hasActual) {
                            if (cls.isHoliday) {
                              statusColor = 'text-purple-650';
                            } else if (cls.rate >= 95) {
                              statusColor = 'text-emerald-600';
                              progressFill = 'bg-emerald-500';
                            } else if (cls.rate >= 90) {
                              statusColor = 'text-amber-600';
                              progressFill = 'bg-amber-500';
                            } else {
                              statusColor = 'text-rose-600';
                              progressFill = 'bg-rose-500';
                            }
                          }

                          return (
                            <div key={cls.className} className="p-2 border border-slate-100 rounded-xl hover:bg-slate-50/50 transition duration-150">
                              <div className="flex justify-between items-center font-sans">
                                <span className="font-bold text-slate-700">{cls.className}</span>
                                <span className={`font-mono font-black text-[11px] ${statusColor}`}>
                                  {cls.hasActual ? (
                                    cls.isHoliday ? 'Holiday' : `${cls.rate}%`
                                  ) : (
                                    <span className="text-slate-400 font-bold text-[10px] font-sans uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">Unmarked</span>
                                  )}
                                </span>
                              </div>

                              {/* Progress Bar visual fill tracking */}
                              <div className="mt-1 w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-300 ${cls.hasActual ? progressFill : 'w-0'}`} 
                                  style={{ width: cls.hasActual && !cls.isHoliday ? `${cls.rate}%` : cls.isHoliday ? '100%' : '0%', backgroundColor: cls.isHoliday ? '#c084fc' : undefined }}
                                />
                              </div>

                              {/* Meta stats logs */}
                              <div className="flex justify-between items-center text-[9px] text-slate-400 font-medium font-sans mt-0.5">
                                <span>Enrolled: {cls.totalStudentsInClass}</span>
                                {cls.hasActual && !cls.isHoliday && (
                                  <span>Present: <strong className="text-slate-600">{cls.present}</strong> • Absent: <strong className="text-slate-600">{cls.absent}</strong></span>
                                )}
                                {cls.hasActual && cls.isHoliday && (
                                  <span className="text-purple-600 font-semibold uppercase tracking-wider">Holiday</span>
                                )}
                                {!cls.hasActual && (
                                  <span className="italic text-[8.5px]">Awaiting records</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Call-to-action button linking directly to primary module page */}
                  {setActiveTab && (
                    <button
                      onClick={() => setActiveTab('attendance')}
                      className="w-full mt-2 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 text-[10.5px] font-black uppercase tracking-wider rounded-xl transition duration-150 border border-slate-200 hover:border-blue-200 active:translate-y-0.5 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <RefreshCw size={11} className="animate-spin-hover" />
                      Manage Daily Registers
                    </button>
                  )}
                </div>
              ));

            case 'pendingFees':
              return renderWidgetContainer(key, (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between h-full text-left">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Coins className="text-indigo-600" size={16} />
                          Recent Fee Payments
                        </h4>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Ratio of settled school bills globally & recent payments</p>
                      </div>
                    </div>

                    {!hasBillingData ? (
                      <WidgetEmptyState 
                        title="No Fee Records Found" 
                        description="No school billing transactions or fees ledger logs have been generated yet." 
                      />
                    ) : (
                      <div className={(widgetSizes.pendingFees === 'wide' || widgetSizes.pendingFees === 'full') ? "grid grid-cols-1 md:grid-cols-2 gap-6 items-center" : "space-y-4"}>
                        <div className="h-40 relative flex items-center justify-center">
                          <ResponsiveContainer width="100%" height={150}>
                            <PieChart>
                              <Pie
                                data={paymentRatioData}
                                cx="50%"
                                cy="50%"
                                innerRadius={45}
                                outerRadius={65}
                                paddingAngle={3}
                                dataKey="value"
                              >
                                {paymentRatioData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip content={<RatioTooltip />} />
                            </PieChart>
                          </ResponsiveContainer>

                          {/* Absolute settlement percent circle value overlay */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
                            <span className="text-[9px] uppercase font-bold text-slate-400 font-mono">Settled</span>
                            <span className="text-lg font-black text-slate-800">
                              {hasBillingData ? `${collectionRate}%` : "0%"}
                            </span>
                          </div>
                        </div>

                        {/* If wide/full, show transaction log right next to the chart. Otherwise show stats at the bottom */}
                        {(widgetSizes.pendingFees === 'wide' || widgetSizes.pendingFees === 'full') ? (
                          <div className="space-y-2">
                            <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Recent Transactions</h5>
                            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar text-[11px]">
                              {recentPayments.map((p, idx) => (
                                <div key={idx} className="p-2 border border-slate-100 rounded-xl flex items-center justify-between">
                                  <div>
                                    <span className="font-bold text-slate-700 block">{p.studentName}</span>
                                    <span className="text-[9px] text-slate-400">{p.class} • {p.component}</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-mono font-bold text-emerald-600 block">+GH¢{p.amount}</span>
                                    <span className="text-[9px] text-slate-400">{p.method}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1.5 font-sans text-left text-xs">
                            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                              <span className="text-slate-500 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 block" /> Paid / Collected:
                              </span>
                              <strong className="text-slate-800 font-mono">
                                GH¢{totalPaidGlobal.toLocaleString()}
                              </strong>
                            </div>
                            
                            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                              <span className="text-slate-500 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-rose-500 block" /> Remaining Debt:
                              </span>
                              <strong className="text-rose-600 font-mono">
                                GH¢{totalOutstandingGlobal.toLocaleString()}
                              </strong>
                            </div>

                            <div className="flex items-center justify-between pt-0.5">
                              <span className="text-slate-500 font-semibold">Total Invoice Value:</span>
                              <strong className="text-slate-800 font-mono">
                                GH¢{totalBilledGlobal.toLocaleString()}
                              </strong>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ));

            case 'newAdmissions':
              return renderWidgetContainer(key, (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between h-full text-left">
                  <div className="space-y-3">
                    <div className="pb-2 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <GraduationCap className="text-indigo-650" size={16} />
                          New Admissions
                        </h4>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Timeline of recent student enrollments</p>
                      </div>
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100 font-bold">
                        {totalEnrolledCounter} New
                      </span>
                    </div>

                    {totalEnrolledCounter === 0 ? (
                      <WidgetEmptyState 
                        title="No Admissions Yet" 
                        description="No students have been enrolled or registered in the school directory yet." 
                      />
                    ) : (
                      <div className={(widgetSizes.newAdmissions === 'wide' || widgetSizes.newAdmissions === 'full') ? "grid grid-cols-1 md:grid-cols-2 gap-6 items-center" : "space-y-3"}>
                        <div className="space-y-3">
                          {/* Metric Blocks Row */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-center">
                              <span className="text-[9px] uppercase font-bold text-slate-400 block leading-tight">Boarding Status</span>
                              <span className="text-xs font-extrabold text-slate-700">
                                {`${boarderEnrolledCounter} Boarders`}
                              </span>
                            </div>
                            <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-center">
                              <span className="text-[9px] uppercase font-bold text-slate-400 block leading-tight">Attendance status</span>
                              <span className="text-xs font-extrabold text-slate-700">
                                {`${dayEnrolledCounter} Day`}
                              </span>
                            </div>
                          </div>

                          <div className="p-3 bg-indigo-50/40 border border-indigo-100/50 rounded-xl text-center">
                            <span className="text-[10px] uppercase font-black tracking-wider text-indigo-600 block">Class distribution</span>
                            <span className="text-xs text-slate-600 font-medium">
                              {students.length > 0 ? (
                                (() => {
                                  const primaryCount = students.filter(s => s && s.class && (s.class.includes('Class') || s.class.includes('Basic'))).length;
                                  const pct = Math.round((primaryCount / students.length) * 100);
                                  return `Primary Grades make up ${pct}% of entries`;
                                })()
                              ) : 'No student entries logged'}
                            </span>
                          </div>
                        </div>

                        {/* Scrollable list of latest registered students */}
                        <div className="max-h-[160px] overflow-y-auto pr-1 space-y-2 custom-scrollbar text-xs">
                          {newAdmissionsList.map((student, idx) => (
                            <div key={idx} className="p-2 border border-slate-100 rounded-xl hover:bg-slate-50/50 transition duration-150 flex items-center justify-between">
                              <div className="space-y-0.5">
                                <h5 className="font-bold text-slate-700 leading-none">
                                  {`${student.firstName} ${student.lastName}`}
                                </h5>
                                <div className="flex items-center gap-2 text-[9.5px] text-slate-400 font-medium font-sans">
                                  <span>{student.class}</span>
                                  <span>•</span>
                                  <span className={student.status === 'Boarder' ? 'text-indigo-500 font-semibold' : 'text-slate-500'}>
                                    {student.status}
                                  </span>
                                </div>
                              </div>
                              <span className="text-[9px] font-mono text-slate-400">
                                {student.createdAt ? new Date(student.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {setActiveTab && (
                    <button
                      onClick={() => setActiveTab('students')}
                      className="w-full mt-2 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 text-[10.5px] font-black uppercase tracking-wider rounded-xl transition duration-150 border border-slate-200 hover:border-indigo-200 active:translate-y-0.5 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Users size={11} />
                      Add or Register Students
                    </button>
                  )}
                </div>
              ));

            case 'gradeDistribution':
              return renderWidgetContainer(key, (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between h-full text-left">
                  <div className="space-y-3">
                    <div className="pb-2 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Award className="text-indigo-600" size={16} />
                          Grade Level Distribution
                        </h4>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">GES Curriculum Grading Level Mix</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[8.5px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-mono uppercase">Live Roster</span>
                      </div>
                    </div>

                    {totalGrades === 0 ? (
                      <WidgetEmptyState 
                        icon={Award}
                        title="No Assessment Data"
                        description="No assessment records have been recorded yet to generate grade level distribution."
                      />
                    ) : (
                      <div className="space-y-2.5 pt-0.5">
                        {gradeDistribution.map((g, index) => (
                          <div key={index} className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-500 font-medium">{g.name}</span>
                              <span className="font-mono font-bold text-slate-800">{g.pct}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="h-full rounded-full transition-all duration-500" 
                                style={{ 
                                  backgroundColor: g.color,
                                  width: `${g.pct}%` 
                                }} 
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="text-[9px] text-slate-400 font-medium text-center italic">
                    Computed based on total verified learning assessments
                  </div>
                </div>
              ));

            case 'enrollmentBreakdown':
              return renderWidgetContainer(key, (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-left h-full flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Users className="text-blue-600" size={16} />
                          Class Enrollment Breakdown
                        </h4>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Segmented counts of male vs female active enrollments</p>
                      </div>
                    </div>

                    {students.length === 0 ? (
                      <div className="pt-4">
                        <WidgetEmptyState 
                          title="No Student Records" 
                          description="No student profiles are registered to map class enrollment distribution." 
                        />
                      </div>
                    ) : (
                      <div className="pt-4">
                        <ResponsiveContainer width="100%" height={230}>
                          <BarChart data={finalEnrollmentChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip content={<EnrollmentTooltip />} />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                            <Bar dataKey="Male" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} barSize={16} />
                            <Bar dataKey="Female" stackId="a" fill="#ec4899" radius={[4, 4, 0, 0]} barSize={16} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>
              ));

            case 'growthHistory':
              return renderWidgetContainer(key, (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-left h-full flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <TrendingUp className="text-indigo-600" size={16} />
                          Historical Enrollment Growth
                        </h4>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Progression trend across academic seasons</p>
                      </div>
                    </div>

                    {students.length === 0 ? (
                      <div className="pt-4">
                        <WidgetEmptyState 
                          title="No Enrollment Data" 
                          description="No student profiles are currently enrolled to display historical growth statistics." 
                        />
                      </div>
                    ) : (
                      <div className="pt-4">
                        <ResponsiveContainer width="100%" height={230}>
                          <AreaChart data={enrollmentGrowthData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                            <defs>
                              <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={themeHex} stopOpacity={0.2}/>
                                <stop offset="95%" stopColor={themeHex} stopOpacity={0.0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} domain={['dataMin - 10', 'dataMax + 10']} />
                            <Tooltip content={<GrowthTooltip />} />
                            <Area type="monotone" dataKey="Students" stroke={themeHex} strokeWidth={2.5} fillOpacity={1} fill="url(#growthGrad)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>
              ));

            case 'performanceTrends':
              return renderWidgetContainer(key, (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-left h-full flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                          <TrendingUp className="text-blue-600" style={{ color: themeHex }} size={16} />
                          Performance Trends Across Terms
                        </h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase mt-0.5">Average academic achievements grouped by school terms</p>
                      </div>
                    </div>

                    <div className="pt-4">
                      {!hasAssessments ? (
                        <WidgetEmptyState
                          icon={TrendingUp}
                          title="No Assessment Records"
                          description="No academic assessment scores have been logged for this academic year."
                        />
                      ) : (
                        <ResponsiveContainer width="100%" height={230}>
                          <LineChart data={performanceTrendData} margin={{ top: 10, right: 15, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.name === 'Sophisticated Dark' || theme.name === 'Cosmic' ? '#1e293b' : '#f1f5f9'} />
                            <XAxis dataKey="term" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                            <Tooltip content={<PerformanceTooltip />} />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                            <Line type="monotone" dataKey="Overall" stroke={themeHex} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Overall Average" />
                            <Line type="monotone" dataKey="Mathematics" stroke="#f59e0b" strokeWidth={2} strokeDasharray="3 3" dot={{ r: 3 }} name="Mathematics" />
                            <Line type="monotone" dataKey="English Language" stroke="#10b981" strokeWidth={2} strokeDasharray="3 3" dot={{ r: 3 }} name="English Language" />
                            <Line type="monotone" dataKey="Integrated Science" stroke="#06b6d4" strokeWidth={2} strokeDasharray="3 3" dot={{ r: 3 }} name="Integrated Science" />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </div>
              ));

            case 'attendanceStanding':
              return renderWidgetContainer(key, (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-left h-full flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Calendar className="text-emerald-600" size={16} />
                          Class Attendance Standing
                        </h4>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Average attendance rate across class grades</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] text-emerald-600 font-bold uppercase">Avg: {overallAttendanceRate}%</span>
                      </div>
                    </div>

                    <div className="pt-4">
                      {actualAttendanceRecords.length === 0 ? (
                        <WidgetEmptyState
                          icon={Calendar}
                          title="No Attendance Logged"
                          description="No student attendance marks have been recorded for the school directory yet."
                        />
                      ) : (
                        <ResponsiveContainer width="100%" height={230}>
                          <BarChart data={classAttendanceData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="className" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                            <Tooltip content={<AttendanceTooltip />} />
                            <Bar dataKey="rate" radius={[4, 4, 0, 0]} barSize={18} name="Attendance Rate (%)">
                              {classAttendanceData.map((entry, index) => {
                                let barColor = '#10b981'; // Outstanding: emerald-500
                                if (entry.rate === 0) {
                                  barColor = '#cbd5e1'; // Empty / Reset state: slate-300
                                } else if (entry.rate < 93) {
                                  barColor = '#ef4444'; // Needs Attention: rose-500
                                } else if (entry.rate < 95) {
                                  barColor = '#f59e0b'; // Good Standing: amber-500
                                }
                                return <Cell key={`cell-${index}`} fill={barColor} />;
                              })}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </div>
              ));

            case 'feesBreakdown':
              return renderWidgetContainer(key, (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-left">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <CircleDollarSign className="text-indigo-600" size={16} />
                        Fees Breakdown by Class
                      </h4>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Comparing invoice totals, collected payments, and remaining balances per class (GH¢)</p>
                    </div>
                  </div>

                  <div className="pt-2">
                    {!hasBillingData || finalFeesChartData.length === 0 ? (
                      <WidgetEmptyState
                        icon={CircleDollarSign}
                        title="No Class Billing Records"
                        description="No student fee invoices or payment receipts have been created yet."
                      />
                    ) : (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={finalFeesChartData} margin={{ top: 15, right: 10, left: -10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip content={<FeesTooltip />} />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                          <Bar dataKey="Billed" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={14} name="Total Invoiced / Billed" />
                          <Bar dataKey="Paid" fill="#10b981" radius={[4, 4, 0, 0]} barSize={14} name="Total Paid / Settled" />
                          <Bar dataKey="Outstanding" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={14} name="Total Outstanding Balance" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              ));

            case 'activityLogs':
              return renderWidgetContainer(key, (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-left">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <History className="text-indigo-600" size={16} />
                        Teacher Activity Monitor
                      </h4>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Real-time monitoring of system actions, updates, and permission changes</p>
                    </div>
                    <button
                      onClick={() => setActivityLogs(DbController.getActivityLogs())}
                      className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 transition cursor-pointer active:translate-y-0.5"
                      title="Refresh Activity Logs"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>

                  <div className="overflow-x-auto max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                    {activityLogs.length === 0 ? (
                      <div className="text-center py-10 text-slate-400">
                        <History size={24} className="mx-auto mb-2 opacity-50" />
                        <p className="text-xs font-bold">No system activities recorded yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-3 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                        {activityLogs.slice(0, 15).map((log) => {
                          let badgeColor = 'bg-slate-100 text-slate-500 border-slate-200';
                          let icon = <CheckCircle2 size={12} />;
                          if (log.severity === 'high') {
                            badgeColor = 'bg-amber-50 text-amber-600 border-amber-200';
                            icon = <AlertCircle size={12} />;
                          } else if (log.severity === 'critical') {
                            badgeColor = 'bg-rose-50 text-rose-600 border-rose-200';
                            icon = <ShieldAlert size={12} />;
                          } else if (log.severity === 'medium') {
                            badgeColor = 'bg-blue-50 text-blue-600 border-blue-200';
                            icon = <BookOpen size={12} />;
                          }

                          return (
                            <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                              {/* Timeline Dot */}
                              <div className={`flex items-center justify-center w-5 h-5 rounded-full border-2 border-white shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ${badgeColor.split(' ')[0]} ${badgeColor.split(' ')[1]}`}>
                                {icon}
                              </div>
                              
                              {/* Log Content Card */}
                              <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl border border-slate-150 bg-slate-50/50 hover:bg-white transition-colors text-left space-y-1 shadow-xs">
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${badgeColor}`}>
                                    {log.action}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {new Date(log.timestamp).toLocaleString(undefined, {
                                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                    })}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-600 font-medium leading-snug">
                                  {log.details}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ));

            case 'assessmentTasks':
              if (userRole !== 'Headteacher' && userRole !== 'Admin') return null;
              return renderWidgetContainer(key, (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-left">
                  <div className="flex justify-between items-start sm:items-center pb-2 border-b border-slate-100 flex-col sm:flex-row gap-3">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <FileCheck className="text-rose-600" size={16} />
                        Assessment Submissions Tracking
                      </h4>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Monitor grading progress by class teachers</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedDashboardTerm}
                        onChange={(e) => setSelectedDashboardTerm(e.target.value as TermType)}
                        className="px-2 py-1 text-[10px] font-bold border border-slate-200 rounded text-slate-600 bg-slate-50 focus:outline-none"
                      >
                        {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <select
                        value={selectedDashboardYear}
                        onChange={(e) => setSelectedDashboardYear(e.target.value as AcademicYearType)}
                        className="px-2 py-1 text-[10px] font-bold border border-slate-200 rounded text-slate-600 bg-slate-50 focus:outline-none"
                      >
                        {ACADEMIC_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>
                  
                  {students.length === 0 ? (
                    <WidgetEmptyState
                      icon={FileCheck}
                      title="No Enrolled Classes"
                      description="No student profiles are registered. Enroll students to track assessment submissions."
                    />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {CLASSES.map(cls => {
                        const teacher = teachers.find(t => t.assignedClass === cls || t.assignedClasses?.includes(cls));
                        const classStudents = students.filter(s => s.class === cls);
                        if (classStudents.length === 0) return null;
                        
                        const classStudentIds = new Set(classStudents.map(s => s.id));
                        const classAssessments = assessments.filter(a => 
                          classStudentIds.has(a.studentId) && 
                          a.term === selectedDashboardTerm && 
                          a.academicYear === selectedDashboardYear
                        );
                        
                        const expectedSubjects = 4;
                        const totalExpected = classStudents.length * expectedSubjects;
                        const progressPercentage = totalExpected > 0 
                          ? Math.min(100, Math.round((classAssessments.length / totalExpected) * 100)) 
                          : 0;
                        
                        let statusText = 'Pending Tasks';
                        let statusColor = 'text-amber-600 bg-amber-50 border-amber-200';
                        let icon = <Clock size={12} />;
                        
                        if (progressPercentage >= 100) {
                          statusText = 'Completed';
                          statusColor = 'text-emerald-600 bg-emerald-50 border-emerald-200';
                          icon = <CheckCircle2 size={12} />;
                        } else if (progressPercentage > 0) {
                          statusText = 'In Progress';
                          statusColor = 'text-blue-600 bg-blue-50 border-blue-200';
                          icon = <RefreshCw size={12} className="animate-spin-slow" />;
                        }

                        return (
                          <div key={cls} className="p-4 rounded-xl border border-slate-150 bg-slate-50/50 hover:bg-white transition-colors text-left space-y-3 shadow-xs">
                            <div className="flex justify-between items-start">
                              <div>
                                <h5 className="text-sm font-bold text-slate-800">{cls}</h5>
                                <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                                  <UserCheck size={10} />
                                  {teacher ? DbController.formatTeacherFullName(teacher) : 'No Assigned Teacher'}
                                </p>
                              </div>
                              <span className={`flex items-center gap-1 px-2 py-1 rounded border text-[9px] font-black uppercase tracking-widest ${statusColor}`}>
                                {icon} {statusText}
                              </span>
                            </div>
                            
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                                <span>Submission Progress</span>
                                <span>{progressPercentage}%</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-1000 ${progressPercentage >= 100 ? 'bg-emerald-500' : progressPercentage > 0 ? 'bg-blue-500' : 'bg-slate-300'}`}
                                  style={{ width: `${progressPercentage}%` }}
                                ></div>
                              </div>
                              <p className="text-[9px] text-slate-400 font-medium text-right">
                                {classAssessments.length} / {totalExpected} entries
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ));

            default:
              return null;
          }
        })}
      </div>

      {/* EMPTY STATE IF ALL WIDGETS ARE HIDDEN */}
      {Object.values(widgets).every(val => !val) && (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4 no-print">
          <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-xs">
            <LayoutGrid size={28} />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm uppercase tracking-wider">All Summary Widgets Hidden</h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto leading-relaxed">
              You have disabled the visibility of all charts and dashboard segments. Use the layout customizer at the top to enable the views you want to see.
            </p>
          </div>
          <button
            onClick={showAllWidgets}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:translate-y-0.5 text-white font-black text-xs rounded-xl transition cursor-pointer shadow-xs"
          >
            Reset Dashboard Layout
          </button>
        </div>
      )}

      {/* QUICK NOTE CREATE/EDIT MODAL */}
      {isNoteModalOpen && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsNoteModalOpen(false);
          }}
          className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-slate-900/45 backdrop-blur-sm animate-fade-in no-print overflow-y-auto"
        >
          <div className="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-lg w-full my-auto max-h-[90vh] sm:max-h-[85vh] shadow-2xl text-left flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-750 shrink-0 flex items-center justify-between bg-white dark:bg-slate-850 z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                  <StickyNote size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                    {editingNoteId ? 'Edit Quick Note' : 'Create Quick Note'}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Save an urgent reminder or memo with persistent storage
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsNoteModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveNote} className="flex flex-col flex-1 overflow-hidden">
              {/* Scrollable Form Body */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
                {/* Title input */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                    Memo Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Staff Meeting at 2:00 PM, Submit Term 1 Assessment"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-slate-800 dark:text-slate-100 font-medium"
                  />
                </div>

                {/* Content area with Markdown editor toolbar & tabs */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                      Note Content (Markdown Supported) *
                    </label>
                    
                    {/* Write vs Preview Tabs */}
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setNoteTabMode('write')}
                        className={`px-2.5 py-0.5 rounded-md font-bold flex items-center gap-1 transition cursor-pointer ${
                          noteTabMode === 'write'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                        }`}
                      >
                        <Edit3 size={11} /> Write
                      </button>
                      <button
                        type="button"
                        onClick={() => setNoteTabMode('preview')}
                        className={`px-2.5 py-0.5 rounded-md font-bold flex items-center gap-1 transition cursor-pointer ${
                          noteTabMode === 'preview'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                        }`}
                      >
                        <Eye size={11} /> Preview
                      </button>
                    </div>
                  </div>

                  {noteTabMode === 'write' ? (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950 focus-within:ring-2 focus-within:ring-amber-500/40 focus-within:border-transparent transition">
                      {/* Rich Markdown Formatting Toolbar */}
                      <div className="bg-slate-100/80 dark:bg-slate-850 px-2 py-1.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1 flex-wrap text-slate-600 dark:text-slate-300">
                        <button
                          type="button"
                          onClick={() => insertMarkdownSyntax('**', '**')}
                          title="Bold (**text**)"
                          className="p-1.5 rounded hover:bg-white dark:hover:bg-slate-750 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                        >
                          <Bold size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertMarkdownSyntax('*', '*')}
                          title="Italic (*text*)"
                          className="p-1.5 rounded hover:bg-white dark:hover:bg-slate-750 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                        >
                          <Italic size={13} />
                        </button>
                        <span className="w-px h-4 bg-slate-300 dark:bg-slate-750 mx-0.5" />
                        <button
                          type="button"
                          onClick={() => insertLinePrefix('### ')}
                          title="Heading 3 (### Heading)"
                          className="p-1.5 rounded hover:bg-white dark:hover:bg-slate-750 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                        >
                          <Heading size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertLinePrefix('- ')}
                          title="Bullet List (- item)"
                          className="p-1.5 rounded hover:bg-white dark:hover:bg-slate-750 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                        >
                          <List size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertLinePrefix('1. ')}
                          title="Numbered List (1. item)"
                          className="p-1.5 rounded hover:bg-white dark:hover:bg-slate-750 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                        >
                          <ListOrdered size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertLinePrefix('- [ ] ')}
                          title="Checklist (- [ ] task)"
                          className="p-1.5 rounded hover:bg-white dark:hover:bg-slate-750 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                        >
                          <CheckSquare size={13} />
                        </button>
                        <span className="w-px h-4 bg-slate-300 dark:bg-slate-750 mx-0.5" />
                        <button
                          type="button"
                          onClick={() => insertLinePrefix('> ')}
                          title="Quote / Callout (> text)"
                          className="p-1.5 rounded hover:bg-white dark:hover:bg-slate-750 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                        >
                          <Quote size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertMarkdownSyntax('`', '`')}
                          title="Monospace Code (`code`)"
                          className="p-1.5 rounded hover:bg-white dark:hover:bg-slate-750 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                        >
                          <Code size={13} />
                        </button>

                        {/* Quick template chip buttons */}
                        <div className="ml-auto flex items-center gap-1">
                          <span className="text-[9px] font-bold text-slate-400 hidden sm:inline uppercase mr-1">Templates:</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (!noteTitle) setNoteTitle('Staff Meeting Agenda');
                              setNoteContent('### Agenda Items\n1. Review Term 1 Assessment Scores\n2. Discuss GES curriculum guidelines\n3. Finalize school fee collections\n\n**Action Items**\n- [ ] Distribute report cards\n- [ ] Schedule PTA briefing');
                            }}
                            className="px-1.5 py-0.5 text-[9.5px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded transition cursor-pointer"
                          >
                            Meeting
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!noteTitle) setNoteTitle('Urgent Task List');
                              setNoteContent('### Priority Tasks\n- [ ] Confirm exam timetable\n- [ ] Send SMS reminders for overdue fees\n- [ ] Inspect laboratory equipment\n\n> **Note:** Complete before 4:00 PM.');
                            }}
                            className="px-1.5 py-0.5 text-[9.5px] font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded transition cursor-pointer"
                          >
                            Checklist
                          </button>
                        </div>
                      </div>

                      {/* Textarea */}
                      <textarea
                        ref={noteTextareaRef}
                        required
                        rows={4}
                        placeholder="Enter details using **bold**, *italic*, ### headings, or - bullet lists..."
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        className="w-full px-3 py-2.5 text-xs bg-transparent border-0 focus:outline-none text-slate-800 dark:text-slate-100 font-mono leading-relaxed resize-none"
                      />
                    </div>
                  ) : (
                    /* Formatted Preview Mode */
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl min-h-[140px] max-h-[200px] overflow-y-auto">
                      {noteContent.trim() ? (
                        <div className="prose prose-xs max-w-none text-[11px] text-slate-700 dark:text-slate-300 font-sans leading-relaxed break-words font-medium [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:mb-1 [&_strong]:font-black [&_strong]:text-slate-900 dark:[&_strong]:text-white [&_h3]:font-black [&_h3]:text-xs [&_h3]:mt-1 [&_h3]:mb-0.5 [&_blockquote]:border-l-2 [&_blockquote]:border-amber-400 [&_blockquote]:pl-2 [&_blockquote]:italic [&_code]:bg-white/60 dark:[&_code]:bg-slate-900/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-[10px]">
                          <Markdown>{noteContent}</Markdown>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No note content to preview yet. Switch back to Write mode.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Department Category Picker */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1">
                      <Tag size={12} className="text-amber-500" /> Department Category
                    </label>
                    <button
                      type="button"
                      onClick={() => setNoteColor(categoryDefaultColor[noteCategory])}
                      className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                    >
                      Auto-tint by Category ({categoryDefaultColor[noteCategory]})
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {(['Academic', 'Finance', 'Personnel', 'Events', 'Maintenance', 'General'] as NoteCategory[]).map((cat) => {
                      const catInfo = categoryConfig[cat];
                      const CatIcon = catInfo.icon;
                      const isSelected = noteCategory === cat;
                      return (
                        <button
                          type="button"
                          key={cat}
                          onClick={() => {
                            setNoteCategory(cat);
                            setNoteColor(categoryDefaultColor[cat]);
                          }}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border cursor-pointer ${
                            isSelected
                              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 shadow-xs'
                              : 'bg-slate-50 dark:bg-slate-850 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <CatIcon size={14} className={isSelected ? 'text-amber-400 dark:text-amber-600' : 'text-slate-400'} />
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Priority & Color Pickers Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Priority / Urgency */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                        Priority / Urgency
                      </label>
                      <button
                        type="button"
                        onClick={() => setNoteColor(priorityDefaultColor[notePriority])}
                        className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                      >
                        Tint by Urgency
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                        <button
                          type="button"
                          key={p}
                          onClick={() => {
                            setNotePriority(p);
                          }}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold capitalize border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            notePriority === p
                              ? p === 'urgent'
                                ? 'bg-rose-500 text-white border-rose-600 shadow-xs'
                                : p === 'high'
                                ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                                : p === 'medium'
                                ? 'bg-blue-500 text-white border-blue-600 shadow-xs'
                                : 'bg-slate-600 text-white border-slate-700 shadow-xs'
                              : 'bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color Tag / Background Tint Selector */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                      Background Tint Color
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                      {(['amber', 'blue', 'emerald', 'rose', 'purple', 'slate'] as const).map((c) => {
                        const colorLabels = {
                          amber: 'Amber',
                          blue: 'Blue',
                          emerald: 'Emerald',
                          rose: 'Rose',
                          purple: 'Purple',
                          slate: 'Slate',
                        };
                        const bgMap = {
                          amber: 'bg-amber-400',
                          blue: 'bg-blue-400',
                          emerald: 'bg-emerald-400',
                          rose: 'bg-rose-400',
                          purple: 'bg-purple-400',
                          slate: 'bg-slate-400',
                        };
                        const isSelected = noteColor === c;
                        return (
                          <button
                            type="button"
                            key={c}
                            onClick={() => setNoteColor(c)}
                            className={`px-2 py-1.5 rounded-xl border text-[11px] font-bold capitalize flex items-center gap-1.5 transition cursor-pointer ${
                              isSelected
                                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 shadow-xs'
                                : 'bg-slate-50 dark:bg-slate-850 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <span className={`w-3 h-3 rounded-full ${bgMap[c]} shrink-0`} />
                            <span>{colorLabels[c]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* TARGET RECIPIENTS / CLASS TEACHERS AUDIENCE */}
                <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-indigo-900 dark:text-indigo-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Users size={14} className="text-indigo-600 dark:text-indigo-400" /> Target Audience / Recipients
                    </label>
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded-full">
                      Reflects on Teacher Dashboard
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setNoteTargetAudience('class_teachers')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                        noteTargetAudience === 'class_teachers'
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-indigo-200 dark:border-slate-800 hover:bg-indigo-50'
                      }`}
                    >
                      <UserCheck size={13} />
                      Class Teachers
                    </button>

                    <button
                      type="button"
                      onClick={() => setNoteTargetAudience('specific_class')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                        noteTargetAudience === 'specific_class'
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-indigo-200 dark:border-slate-800 hover:bg-indigo-50'
                      }`}
                    >
                      <GraduationCap size={13} />
                      Specific Class
                    </button>

                    <button
                      type="button"
                      onClick={() => setNoteTargetAudience('all')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                        noteTargetAudience === 'all'
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-indigo-200 dark:border-slate-800 hover:bg-indigo-50'
                      }`}
                    >
                      <Users size={13} />
                      All Staff
                    </button>
                  </div>

                  {noteTargetAudience === 'specific_class' && (
                    <div className="pt-1 flex items-center gap-2">
                      <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200 whitespace-nowrap">
                        Select Target Class:
                      </span>
                      <select
                        value={noteTargetClass}
                        onChange={(e) => setNoteTargetClass(e.target.value as ClassType)}
                        className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-indigo-300 dark:border-slate-700 rounded-lg font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {CLASSES.map((cls) => (
                          <option key={cls} value={cls}>
                            {cls} Class Teacher
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* STAFF MEETING NOTICE TOGGLE & INPUTS */}
                <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar size={15} className="text-amber-600 dark:text-amber-400" />
                      <div>
                        <span className="text-xs font-black text-amber-950 dark:text-amber-100 block">
                          Staff Meeting / Notice Directive
                        </span>
                        <span className="text-[10px] text-amber-700 dark:text-amber-300 font-medium">
                          Include meeting schedule, time & location for teachers
                        </span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={noteIsMeetingNotice}
                      onChange={(e) => setNoteIsMeetingNotice(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                  </div>

                  {noteIsMeetingNotice && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-amber-200/80 dark:border-amber-900/60 animate-fade-in">
                      <div>
                        <label className="text-[10px] font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider block mb-1">
                          Meeting Date
                        </label>
                        <input
                          type="date"
                          value={noteMeetingDate}
                          onChange={(e) => setNoteMeetingDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-100 font-medium"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider block mb-1">
                          Time (e.g. 2:30 PM)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 10:30 AM"
                          value={noteMeetingTime}
                          onChange={(e) => setNoteMeetingTime(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-100 font-medium"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider block mb-1">
                          Venue / Location
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Staff Room"
                          value={noteMeetingVenue}
                          onChange={(e) => setNoteMeetingVenue(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-100 font-medium"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Due Date (Optional) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1">
                      <Calendar size={12} className="text-amber-500" /> Due Date / Deadline (Optional)
                    </label>
                    {noteDueDate && (
                      <button
                        type="button"
                        onClick={() => setNoteDueDate('')}
                        className="text-[10px] text-rose-500 hover:underline font-bold cursor-pointer"
                      >
                        Clear Date
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    value={noteDueDate}
                    onChange={(e) => setNoteDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-slate-800 dark:text-slate-200"
                  />
                </div>

                {/* Live Tint Preview Box */}
                <div className={`p-3 rounded-xl border ${colorStyles[noteColor]?.bg || colorStyles.amber.bg} ${colorStyles[noteColor]?.border || colorStyles.amber.border} transition-colors duration-200`}>
                  <div className="flex items-center justify-between gap-2 text-[10px] mb-1">
                    <span className="font-bold uppercase tracking-wider text-slate-500">Card Color Tint Preview</span>
                    <span className={`px-1.5 py-0.5 rounded font-bold border ${categoryConfig[noteCategory].colorClass} ${categoryConfig[noteCategory].borderClass}`}>
                      {noteCategory}
                    </span>
                  </div>
                  <p className={`text-xs font-bold ${colorStyles[noteColor]?.text || colorStyles.amber.text}`}>
                    {noteTitle.trim() || 'Untitled Quick Note'}
                  </p>
                </div>

                {/* Pin Checkbox */}
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Pin size={14} className={noteIsPinned ? 'text-amber-500 fill-amber-500' : 'text-slate-400'} />
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Pin to Top of Dashboard</span>
                      <span className="text-[10px] text-slate-400 font-medium">Keep this note pinned above standard entries</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={noteIsPinned}
                    onChange={(e) => setNoteIsPinned(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
                  />
                </div>
              </div>

              {/* Sticky Modal Footer Actions */}
              <div className="p-4 sm:px-6 py-3 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-xs flex items-center justify-end gap-2 rounded-b-2xl z-10">
                <button
                  type="button"
                  onClick={() => setIsNoteModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <StickyNote size={14} />
                  {editingNoteId ? 'Update Note' : 'Save Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
