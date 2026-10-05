import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  Cell,
  ResponsiveContainer
} from 'recharts';
import { 
  Users, 
  Calendar, 
  CheckCircle, 
  Clock, 
  BookOpen, 
  ArrowRight,
  TrendingUp,
  AlertCircle,
  GraduationCap,
  CalendarDays,
  Target,
  Sparkles,
  Zap,
  Plus,
  Send,
  MessageSquare,
  X,
  ShieldCheck,
  User,
  Archive,
  Cake,
  Save,
  FileDown,
  Check,
  BarChart2,
  Layers,
  Award,
  Landmark,
  StickyNote,
  Pin,
  ChevronDown,
  ChevronUp,
  Search,
  Tag,
  Filter,
  Trash2,
  Edit3,
  Coins,
  SlidersHorizontal,
  Megaphone,
  Bell,
  MapPin,
  CheckSquare,
  BellRing
} from 'lucide-react';
import Markdown from 'react-markdown';
import { Teacher, Student, AttendanceRecord, AcademicCalendarConfig, ClassType, SubjectType, StudentAssessment, TeacherReflection, SchoolInfo, CustomTask, QuickNote, NoteCategory } from '../types';
import TeacherReflections from './TeacherReflections';
import AverageImprovementChart from './AverageImprovementChart';
import { DbController } from '../db';
import { formatIdentifiableFilename } from '../utils';
import { evaluateSubscription } from '../subscription';
import SmartTextarea from './SmartTextarea';

interface TeacherDashboardTabProps {
  teacherProfile: Teacher;
  students: Student[];
  attendance: AttendanceRecord[];
  calendar: AcademicCalendarConfig;
  assessments: StudentAssessment[];
  reflections: TeacherReflection[];
  schoolInfo: SchoolInfo;
  themeStyles: any;
  onNavigate: (tabId: string, params?: any) => void;
  onRefresh: () => void;
  onSaveAll?: () => Promise<void>;
  isManualSaving?: boolean;
}

export default function TeacherDashboardTab({
  teacherProfile,
  students,
  attendance,
  calendar: calendarProp,
  assessments,
  reflections,
  schoolInfo,
  themeStyles,
  onNavigate,
  onRefresh,
  onSaveAll,
  isManualSaving
}: TeacherDashboardTabProps) {
  
  const calendar = useMemo(() => {
    if (calendarProp && calendarProp.activeAcademicYear && calendarProp.years) {
      return calendarProp;
    }
    return DbController.getAcademicCalendar();
  }, [calendarProp]);

  const currentUser = useMemo(() => DbController.getCurrentUser(), []);
  const [ticker, setTicker] = useState(0);

  // Headteacher & Staff Quick Notes State
  const [quickNotes, setQuickNotes] = useState<QuickNote[]>(() => DbController.getQuickNotes());
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(new Set());
  const [noteSearch, setNoteSearch] = useState('');
  const [notePriorityFilter, setNotePriorityFilter] = useState<'all' | 'urgent' | 'high' | 'medium' | 'low'>('all');
  const [noteCategoryFilter, setNoteCategoryFilter] = useState<'all' | NoteCategory>('all');

  // Listen for real-time quick notes updates from Headteacher / Admin
  useEffect(() => {
    const handleSync = (e: any) => {
      if (e.detail?.type === 'quick-notes-updated') {
        setQuickNotes(DbController.getQuickNotes());
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

  const toggleNoteExpand = (id: string) => {
    setExpandedNoteIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAcknowledgeNote = (noteId: string) => {
    const note = quickNotes.find(n => n.id === noteId);
    if (!note) return;
    const currentUser = DbController.getCurrentUser();
    const teacherKey = teacherProfile.staffId || teacherProfile.id || currentUser?.uid || 'teacher';
    const teacherName = `${teacherProfile.firstName || ''} ${teacherProfile.lastName || ''}`.trim() || currentUser?.name || 'Class Teacher';
    
    const existingAcks = note.acknowledgedBy || [];
    if (!existingAcks.some(a => a.teacherId === teacherKey)) {
      const updatedNote: QuickNote = {
        ...note,
        acknowledgedBy: [
          ...existingAcks,
          {
            teacherId: teacherKey,
            teacherName,
            acknowledgedAt: new Date().toISOString()
          }
        ]
      };
      DbController.saveQuickNote(updatedNote);
      setQuickNotes(DbController.getQuickNotes());
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { text: 'Memo / Notice confirmed & acknowledged.', type: 'success' } }));
    }
  };

  const assignedClasses = useMemo(() => {
    const classesList: ClassType[] = [];
    if (teacherProfile.assignedClasses) {
      classesList.push(...teacherProfile.assignedClasses);
    }
    if (teacherProfile.assignedClass && teacherProfile.assignedClass !== 'None' && !classesList.includes(teacherProfile.assignedClass)) {
      classesList.push(teacherProfile.assignedClass);
    }
    return classesList;
  }, [teacherProfile]);

  const missingAttendanceClasses = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const attList = Array.isArray(attendance) ? attendance : [];
    const todayAtt = attList.filter(a => a.date === todayStr);
    return assignedClasses.filter(cls => {
      return !todayAtt.some(a => a.class === cls);
    });
  }, [attendance, assignedClasses]);

  const isPastCutoff = useMemo(() => {
    const now = new Date();
    return now.getHours() >= 10;
  }, []);

  const isWeekday = useMemo(() => {
    const today = new Date();
    return today.getDay() !== 0 && today.getDay() !== 6;
  }, []);

  const filteredQuickNotes = useMemo(() => {
    const query = noteSearch.trim().toLowerCase();
    return quickNotes.filter(n => {
      // Check target audience match for assigned Class Teacher
      if (n.targetAudience === 'specific_class') {
        if (!n.targetClass || !assignedClasses.includes(n.targetClass)) {
          return false;
        }
      }

      const matchesSearch = !query || 
        n.title.toLowerCase().includes(query) || 
        n.content.toLowerCase().includes(query) ||
        (n.author && n.author.toLowerCase().includes(query)) ||
        (n.meetingVenue && n.meetingVenue.toLowerCase().includes(query));
      if (!matchesSearch) return false;

      if (n.isPinned) return true;

      const matchesPriority = notePriorityFilter === 'all' || n.priority === notePriorityFilter;
      const matchesCategory = noteCategoryFilter === 'all' || (n.category || 'General') === noteCategoryFilter;
      return matchesPriority && matchesCategory;
    }).sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [quickNotes, noteSearch, notePriorityFilter, noteCategoryFilter, assignedClasses]);

  const urgentNoticeMemos = useMemo(() => {
    const currentUser = DbController.getCurrentUser();
    const teacherKey = teacherProfile.staffId || teacherProfile.id || currentUser?.uid || 'teacher';
    return filteredQuickNotes.filter(n => {
      const isUrgentOrMeeting = n.priority === 'urgent' || n.isMeetingNotice || n.priority === 'high';
      const isAcknowledged = n.acknowledgedBy?.some(ack => ack.teacherId === teacherKey);
      return isUrgentOrMeeting && !isAcknowledged;
    });
  }, [filteredQuickNotes, teacherProfile]);

  const teacherNoteColorStyles: Record<string, { bg: string; border: string; text: string; badge: string }> = {
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

  const getTeacherDueDateStatus = (dueDateStr?: string) => {
    if (!dueDateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDateStr);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

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
        colorClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800 font-bold',
        icon: Clock,
      };
    } else if (diffDays <= 3) {
      return {
        status: 'approaching',
        label: `Due in ${diffDays}d`,
        colorClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        icon: Calendar,
      };
    } else {
      return {
        status: 'upcoming',
        label: `Due ${due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
        colorClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
        icon: Calendar,
      };
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setTicker(prev => prev + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const subStatus = useMemo(() => currentUser ? evaluateSubscription(currentUser) : null, [currentUser, ticker]);

  const assignedSubjects = teacherProfile.assignedSubjects || [];

  // Filter students belonging to assigned classes
  const myStudents = useMemo(() => {
    const sList = Array.isArray(students) ? students : [];
    return sList.filter(s => s && assignedClasses.includes(s.class));
  }, [students, assignedClasses]);

  // Success feedback states
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showJsonSuccess, setShowJsonSuccess] = useState(false);
  const prevIsSaving = useRef(isManualSaving);

  // Monitor save progress for success feedback
  useEffect(() => {
    if (prevIsSaving.current && !isManualSaving) {
      // Transitioned from saving to idle
      setShowSaveSuccess(true);
      const timer = setTimeout(() => setShowSaveSuccess(false), 2500);
      return () => clearTimeout(timer);
    }
    prevIsSaving.current = isManualSaving;
  }, [isManualSaving]);

  // Export database handler
  const handleExportJSON = () => {
    try {
      const dataStr = DbController.exportAllData();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const formatedDate = new Date().toISOString().split('T')[0];
      const exportFileDefaultName = formatIdentifiableFilename({
        docType: 'School System Backup',
        date: formatedDate,
        extension: 'json'
      });
      
      const linkElement = document.createElement('a');
      linkElement.href = url;
      linkElement.download = exportFileDefaultName;
      document.body.appendChild(linkElement);
      linkElement.click();
      document.body.removeChild(linkElement);
      URL.revokeObjectURL(url);
      
      setShowJsonSuccess(true);
      setTimeout(() => setShowJsonSuccess(false), 2500);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { text: 'Full database JSON snapshot exported successfully.', type: 'success' } }));
    } catch (e: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { text: 'Failed to export JSON: ' + e.message, type: 'error' } }));
    }
  };

  // Student birthdays calculations
  const birthdayStudents = useMemo(() => {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    
    return myStudents.filter(s => {
      if (!s.dateOfBirth) return false;
      const dobParts = s.dateOfBirth.split('-');
      if (dobParts.length !== 3) return false;
      const dobMonth = parseInt(dobParts[1], 10);
      const dobDay = parseInt(dobParts[2], 10);
      return dobMonth === month && dobDay === day;
    }).map(s => {
      const dobParts = s.dateOfBirth.split('-');
      const birthYear = parseInt(dobParts[0], 10);
      const birthMonth = parseInt(dobParts[1], 10);
      const birthDay = parseInt(dobParts[2], 10);
      
      let age = today.getFullYear() - birthYear;
      const m = (today.getMonth() + 1) - birthMonth;
      if (m < 0 || (m === 0 && today.getDate() < birthDay)) {
        age--;
      }
      return {
        ...s,
        age
      };
    });
  }, [myStudents]);

  // Calculate students per class
  const studentsPerClass = useMemo(() => {
    const counts: Record<string, number> = {};
    const sList = Array.isArray(students) ? students : [];
    assignedClasses.forEach(c => {
      counts[c] = sList.filter(s => s && s.class === c).length;
    });
    return counts;
  }, [assignedClasses, students]);

  // Attendance rate for assigned classes (last 30 days or current month)
  const attendanceRate = useMemo(() => {
    const attList = Array.isArray(attendance) ? attendance : [];
    const relevantAttendance = attList.filter(a => a && assignedClasses.includes(a.class));
    if (relevantAttendance.length === 0) return 0;
    const presents = relevantAttendance.filter(a => a && a.status === 'Present').length;
    return Math.round((presents / relevantAttendance.length) * 100);
  }, [attendance, assignedClasses]);

  // Pending grading tasks (heuristic: count students in assigned classes/subjects who don't have an assessment for the active term/year)
  const pendingGradingCount = useMemo(() => {
    let count = 0;
    const sList = Array.isArray(students) ? students : [];
    const assList = Array.isArray(assessments) ? assessments : [];
    const activeYear = calendar?.activeAcademicYear;
    const activeTerm = calendar?.activeTerm;

    assignedClasses.forEach(cls => {
      const classStudents = sList.filter(s => s && s.class === cls);
      assignedSubjects.forEach(sub => {
        classStudents.forEach(stu => {
          const hasRecord = assList.some(a => 
            a &&
            a.studentId === stu.id && 
            a.subject === sub && 
            a.academicYear === activeYear && 
            a.term === activeTerm
          );
          if (!hasRecord) count++;
        });
      });
    });
    return count;
  }, [assignedClasses, assignedSubjects, students, assessments, calendar]);

  // Chart View Toggle State for Recharts Bar Chart
  const [chartView, setChartView] = useState<'bands' | 'average'>('bands');

  // Performance distribution computation across assigned classes
  const performanceChartData = useMemo(() => {
    const sList = Array.isArray(students) ? students : [];
    const assList = Array.isArray(assessments) ? assessments : [];
    const activeYear = calendar?.activeAcademicYear;
    const activeTerm = calendar?.activeTerm;

    return assignedClasses.map(cls => {
      const classStudents = sList.filter(s => s && s.class === cls);
      if (classStudents.length === 0) {
        return {
          class: cls,
          average: 0,
          excellent: 0,
          proficient: 0,
          developing: 0,
          needsSupport: 0,
          totalStudents: 0,
          assessedStudents: 0
        };
      }

      let totalScoreSum = 0;
      let assessedCount = 0;
      let excellentCount = 0; // 80-100%
      let proficientCount = 0; // 60-79%
      let developingCount = 0; // 40-59%
      let needsSupportCount = 0; // <40%

      classStudents.forEach(stu => {
        let stuAssessments = assList.filter(a => 
          a &&
          a.studentId === stu.id && 
          a.academicYear === activeYear && 
          a.term === activeTerm
        );
        if (stuAssessments.length === 0) {
          stuAssessments = assList.filter(a => a && a.studentId === stu.id);
        }

        if (stuAssessments.length > 0) {
          const avgScore = stuAssessments.reduce((sum, a) => sum + (a ? (a.totalScore || 0) : 0), 0) / stuAssessments.length;
          totalScoreSum += avgScore;
          assessedCount++;

          if (avgScore >= 80) excellentCount++;
          else if (avgScore >= 60) proficientCount++;
          else if (avgScore >= 40) developingCount++;
          else needsSupportCount++;
        }
      });

      const classAverage = assessedCount > 0 ? Math.round(totalScoreSum / assessedCount) : 0;

      return {
        class: cls,
        average: classAverage,
        excellent: excellentCount,
        proficient: proficientCount,
        developing: developingCount,
        needsSupport: needsSupportCount,
        totalStudents: classStudents.length,
        assessedStudents: assessedCount
      };
    });
  }, [assignedClasses, students, assessments, calendar]);

  // Upcoming Tasks list
  const upcomingTasks = useMemo(() => {
    const tasks = [];
    
    // Task: Mark attendance (if today is a weekday and we are in term time)
    const today = new Date();
    const isWeekday = today.getDay() !== 0 && today.getDay() !== 6;
    if (isWeekday) {
      tasks.push({
        id: 'mark_attendance',
        title: 'Mark Today Attendance',
        description: `Ensure attendance for your ${assignedClasses.length} assigned classes is recorded.`,
        icon: CalendarCheck,
        priority: 'high',
        action: () => onNavigate('attendance')
      });
    }

    // Task: Grading
    if (pendingGradingCount > 0) {
      tasks.push({
        id: 'grading',
        title: 'Pending Student Assessments',
        description: `You have ${pendingGradingCount} records to complete for the current term.`,
        icon: GraduationCap,
        priority: 'medium',
        action: () => onNavigate('assessments')
      });
    }

    // Term Closure Task
    const activeYearCfg = calendar.years[calendar.activeAcademicYear];
    if (activeYearCfg) {
      const termCfg = activeYearCfg.terms[calendar.activeTerm];
      if (termCfg) {
        const endDate = new Date(termCfg.endDate);
        const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 0 && diffDays <= 14) {
          tasks.push({
            id: 'term_closure',
            title: `${calendar.activeTerm} Closure Approaching`,
            description: `Only ${diffDays} days left until the end of the term. Prepare final reports.`,
            icon: Clock,
            priority: 'critical',
            action: () => {}
          });
        }
      }
    }

    return tasks;
  }, [assignedClasses, calendar, pendingGradingCount, onNavigate]);

  const [customTasks, setCustomTasks] = useState(() => DbController.getTasks().filter(t => !t.isArchived));
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');

  const allTasks = useMemo(() => {
    const combined = [...upcomingTasks];
    customTasks.forEach(ct => {
      combined.push({
        id: ct.id,
        title: ct.title,
        description: ct.description,
        icon: CheckCircle,
        priority: ct.priority,
        action: () => {},
        isCustom: true
      });
    });
    // Sort by priority (critical > high > medium > low)
    const pMap: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    combined.sort((a, b) => pMap[b.priority] - pMap[a.priority]);
    return combined;
  }, [upcomingTasks, customTasks]);

  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [quickActionModal, setQuickActionModal] = useState<'behavior' | 'grade' | 'attendance' | null>(null);
  
  // Quick Action form states
  const [qaStudentId, setQaStudentId] = useState('');
  const [qaBehaviorContent, setQaBehaviorContent] = useState('');
  const [qaSubject, setQaSubject] = useState(assignedSubjects[0] || '');
  const [qaAssessmentType, setQaAssessmentType] = useState('exercise1'); 
  const [qaScore, setQaScore] = useState('');
  const [qaAttendanceStatus, setQaAttendanceStatus] = useState<'Present' | 'Absent' | 'On Leave'>('Present');

  const handleQuickActionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaStudentId) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { text: 'Please select a student', type: 'error' } }));
      return;
    }

    const student = students.find(s => s.id === qaStudentId);
    if (!student) return;

    if (quickActionModal === 'behavior') {
      const newReflection: TeacherReflection = {
        id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        teacherId: teacherProfile.id,
        teacherName: `${teacherProfile.firstName} ${teacherProfile.lastName}`,
        date: new Date().toISOString().split('T')[0],
        content: `Student: ${student.firstName} ${student.lastName} (${student.class}) - ${qaBehaviorContent}`,
        category: 'Behavior',
        class: student.class,
        academicYear: calendar.activeAcademicYear,
        term: calendar.activeTerm,
        createdAt: new Date().toISOString()
      };
      DbController.saveTeacherReflection(newReflection);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { text: 'Behavioral note logged successfully.', type: 'success' } }));
      setQaBehaviorContent('');
    } 
    else if (quickActionModal === 'attendance') {
      const todayDate = new Date().toISOString().split('T')[0];
      const record: AttendanceRecord = {
        id: `${todayDate}_${student.id}`,
        date: todayDate,
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        class: student.class,
        status: qaAttendanceStatus as any
      };
      DbController.saveAttendanceBatch([record]);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { text: `Attendance for ${student.firstName} flagged as ${qaAttendanceStatus}.`, type: 'success' } }));
    }
    else if (quickActionModal === 'grade') {
      // Find existing assessment or create a new one
      const term = calendar.activeTerm;
      const year = calendar.activeAcademicYear;
      const allAssessments = DbController.getAssessments();
      const existingIdx = allAssessments.findIndex(a => a.studentId === student.id && a.subject === qaSubject && a.term === term && a.academicYear === year);
      
      let assessmentToUpdate: StudentAssessment;
      if (existingIdx >= 0) {
        assessmentToUpdate = { ...allAssessments[existingIdx] };
      } else {
        assessmentToUpdate = {
          id: `ass_${student.id}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          studentId: student.id,
          studentName: `${student.firstName} ${student.lastName}`,
          class: student.class,
          academicYear: year,
          term: term,
          subject: qaSubject as SubjectType,
          exercises: [0, 0, 0, 0],
          tests: [0, 0],
          projectWork: 0,
          groupWork: 0,
          classScoreTotal: 0,
          classScore50: 0,
          examScore100: 0,
          examScore50: 0,
          totalScore: 0,
          gradeLevel: 'L5',
          remarks: 'Emerging'
        };
        allAssessments.push(assessmentToUpdate);
      }

      const scoreValue = parseFloat(qaScore);
      if (isNaN(scoreValue)) return;

      if (qaAssessmentType.startsWith('exercise')) {
        const idx = parseInt(qaAssessmentType.replace('exercise', '')) - 1;
        assessmentToUpdate.exercises[idx] = scoreValue;
      } else if (qaAssessmentType.startsWith('test')) {
        const idx = parseInt(qaAssessmentType.replace('test', '')) - 1;
        assessmentToUpdate.tests[idx] = scoreValue;
      } else if (qaAssessmentType === 'project') {
        assessmentToUpdate.projectWork = scoreValue;
      } else if (qaAssessmentType === 'group') {
        assessmentToUpdate.groupWork = scoreValue;
      } else if (qaAssessmentType === 'exam') {
        assessmentToUpdate.examScore100 = scoreValue;
      }

      const recalced = DbController.calculateScoreDetails(assessmentToUpdate);
      if (existingIdx >= 0) {
        allAssessments[existingIdx] = recalced;
      } else {
        allAssessments[allAssessments.length - 1] = recalced;
      }
      
      DbController.saveAllAssessments(allAssessments);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { text: `Grade saved for ${student.firstName} (${qaSubject}).`, type: 'success' } }));
      setQaScore('');
    }
    
    setQuickActionModal(null);
    onRefresh();
  };

  return (
    <div className="relative">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
      {/* Headteacher Real-Time Subscription Countdown Banner */}
      {subStatus && (
        <div className={`p-5 rounded-3xl border-2 ${
          subStatus.isLocked 
            ? 'bg-rose-50 border-rose-300 text-rose-950'
            : subStatus.remainingDays <= 30
              ? 'bg-amber-50/90 border-amber-300 text-amber-950'
              : 'bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100/80 border-emerald-300 text-emerald-950'
        } flex flex-col md:flex-row items-center justify-between gap-4 shadow-md no-print`}>
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-2xl shrink-0 ${
              subStatus.isLocked ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'
            }`}>
              <Clock size={24} className="animate-pulse text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider font-mono text-slate-800">
                  Headteacher School Subscription Live Countdown
                </span>
                <span className={`text-xs px-3 py-1 rounded-xl font-black font-mono tracking-wider shadow-2xs ${
                  subStatus.isLocked
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : 'bg-emerald-200/90 text-emerald-900 border border-emerald-300'
                }`}>
                  ⏱️ {subStatus.countdownString}
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">
                {subStatus.message}
              </p>
            </div>
          </div>
          <div className="text-right text-xs font-mono font-bold text-slate-600 shrink-0 self-end md:self-auto bg-white/70 px-3.5 py-2 rounded-xl border border-slate-200/60">
            <span className="text-[9px] uppercase font-bold text-slate-400 block font-sans">School Expiry Date</span>
            <span className="text-slate-900 font-black">{subStatus.expiryDate.toLocaleDateString()}</span>
          </div>
        </div>
      )}

      {/* DAILY ATTENDANCE CUTOFF ALERT BANNER */}
      {isWeekday && missingAttendanceClasses.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-5 rounded-3xl border-2 shadow-lg ${
            isPastCutoff 
              ? 'bg-rose-50 border-rose-300 text-rose-950 animate-pulse' 
              : 'bg-amber-50 border-amber-300 text-amber-950'
          } flex flex-col md:flex-row items-center justify-between gap-4 no-print`}
        >
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-2xl shrink-0 ${
              isPastCutoff ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
            }`}>
              <AlertCircle size={24} className={isPastCutoff ? 'animate-bounce text-rose-700' : 'text-amber-700'} />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider font-mono text-slate-800">
                  {isPastCutoff ? '⚠️ Attendance Compliance Cutoff Breach' : '⏰ Attendance Reminder'}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black tracking-wide uppercase ${
                  isPastCutoff ? 'bg-rose-200 text-rose-900' : 'bg-amber-200 text-amber-900'
                }`}>
                  {isPastCutoff ? 'Overdue' : 'Due by 10:00 AM'}
                </span>
              </div>
              <p className="text-xs text-slate-700 font-medium mt-1 leading-relaxed">
                Daily student attendance registers for class <strong>{missingAttendanceClasses.join(', ')}</strong> have not been logged. Please complete the register immediately to ensure compliance and administrative accuracy.
              </p>
            </div>
          </div>
          
          <button
            onClick={() => onNavigate('attendance')}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shrink-0 ${
              isPastCutoff 
                ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse' 
                : 'bg-amber-500 hover:bg-amber-600 text-slate-900 font-extrabold'
            }`}
          >
            Record Register Now <ArrowRight size={13} />
          </button>
        </motion.div>
      )}

      {/* HEADTEACHER URGENT MEMO & STAFF MEETING ALERT BANNER */}
      {urgentNoticeMemos.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 p-1 rounded-3xl shadow-xl no-print"
        >
          <div className="bg-white dark:bg-slate-900 rounded-[22px] p-5 md:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-rose-500 text-white animate-bounce shadow-md">
                  <Megaphone size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    Headteacher Urgent Directives & Meeting Notices
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black uppercase tracking-wider">
                      {urgentNoticeMemos.length} Urgent / Action Required
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Official announcements broadcasted directly to assigned class teachers.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {urgentNoticeMemos.map((memo) => (
                <div 
                  key={memo.id}
                  className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/90 to-rose-50/70 dark:from-amber-950/40 dark:to-rose-950/30 border border-amber-200 dark:border-amber-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-rose-500 text-white text-[9px] font-black uppercase tracking-wider">
                        {memo.priority}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 text-[9.5px] font-bold border border-indigo-200 dark:border-indigo-800">
                        {memo.targetAudience === 'specific_class'
                          ? `To: ${memo.targetClass || 'Class'} Teacher`
                          : memo.targetAudience === 'class_teachers'
                          ? 'To: All Class Teachers'
                          : 'To: All Staff'}
                      </span>
                      {memo.isMeetingNotice && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500 text-white text-[9.5px] font-bold flex items-center gap-1">
                          <Calendar size={11} /> Staff Meeting Directive
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-black text-slate-900 dark:text-white">
                      {memo.title}
                    </h4>

                    {memo.isMeetingNotice && (memo.meetingDate || memo.meetingTime || memo.meetingVenue) && (
                      <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-amber-200/80 dark:border-amber-800/80 text-xs text-slate-800 dark:text-slate-200 flex items-center gap-4 flex-wrap font-bold">
                        {memo.meetingDate && <span>📅 Date: {memo.meetingDate}</span>}
                        {memo.meetingTime && <span>⏰ Time: {memo.meetingTime}</span>}
                        {memo.meetingVenue && <span>📍 Venue: {memo.meetingVenue}</span>}
                      </div>
                    )}

                    <div className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed prose prose-xs max-w-none">
                      <Markdown>{memo.content}</Markdown>
                    </div>
                  </div>

                  <div className="shrink-0 self-end md:self-center">
                    <button
                      onClick={() => handleAcknowledgeNote(memo.id)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                    >
                      <Check size={14} /> Confirm Receipt & Acknowledge
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}


      {/* Official School Institutional Branding & Teacher Faculty Notice Board */}
      <div className="bg-white border-2 border-indigo-600/30 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-xl space-y-6">
        {/* Top Institutional Header Banner */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-slate-100 relative z-10">
          <div className="flex items-center gap-4">
            {/* School Crest / Logo */}
            <div className="flex items-center gap-2">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border-2 border-indigo-200/80 flex items-center justify-center text-indigo-600 overflow-hidden shadow-sm shrink-0">
                {(schoolInfo.logoUrl || schoolInfo.crestUrl) ? (
                  <img 
                    src={schoolInfo.logoUrl || schoolInfo.crestUrl} 
                    alt="School Logo" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <GraduationCap size={32} className="text-indigo-600" />
                )}
              </div>
              {schoolInfo.crestUrl && schoolInfo.logoUrl && schoolInfo.crestUrl !== schoolInfo.logoUrl && (
                <div className="w-14 h-14 rounded-2xl bg-amber-50 border-2 border-amber-200/80 hidden sm:flex items-center justify-center text-amber-600 overflow-hidden shadow-sm shrink-0">
                  <img 
                    src={schoolInfo.crestUrl} 
                    alt="School Crest" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            {/* School Name, Motto & Regional Identifiers */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black font-display tracking-tight text-slate-900 uppercase">
                  {schoolInfo.name || 'Ghana Education Service School'}
                </h1>
                <span className="bg-indigo-600 text-white px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm">
                  {schoolInfo.schoolType || 'Public'} School
                </span>
                {schoolInfo.emisCode && (
                  <span className="bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-md text-[10px] font-bold font-mono">
                    EMIS: {schoolInfo.emisCode}
                  </span>
                )}
              </div>
              
              {schoolInfo.motto && (
                <p className="text-xs font-serif italic text-indigo-700 font-semibold">
                  Motto: "{schoolInfo.motto}"
                </p>
              )}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 font-medium pt-0.5">
                {schoolInfo.circuit && <span>Circuit: <strong className="text-slate-700">{schoolInfo.circuit}</strong></span>}
                {schoolInfo.district && <span>• District: <strong className="text-slate-700">{schoolInfo.district}</strong></span>}
                {schoolInfo.schoolNumber && <span>• Reg: <strong className="text-slate-700">{schoolInfo.schoolNumber}</strong></span>}
                <span>• Session: <strong className="text-indigo-600">{calendar.activeAcademicYear} ({calendar.activeTerm})</strong></span>
              </div>
            </div>
          </div>

          <div className="shrink-0 self-start md:self-center">
            <div className="bg-indigo-600 text-white px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-md flex items-center gap-2">
              <ShieldCheck size={14} /> Teacher Portal
            </div>
          </div>
        </div>

        {/* Teacher Faculty Profile & Today's Schedule */}
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center font-bold text-lg shadow-md shrink-0 overflow-hidden">
                {teacherProfile.photoUrl ? (
                  <img 
                    src={teacherProfile.photoUrl} 
                    alt={teacherProfile.firstName} 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <span>{teacherProfile.firstName?.[0] || 'T'}{teacherProfile.lastName?.[0] || ''}</span>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-black font-display tracking-tight text-slate-900 leading-none">
                    Welcome, <span className="text-indigo-600">{teacherProfile.firstName} {teacherProfile.lastName}</span>
                  </h2>
                  {teacherProfile.staffId && (
                    <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                      ID: {teacherProfile.staffId}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <div className="flex items-center gap-1.5 text-slate-500 font-bold text-[11px] uppercase tracking-tight">
                    <GraduationCap size={14} className="text-amber-500" />
                    Classes: <span className="text-slate-900 font-black">{assignedClasses.length > 0 ? assignedClasses.join(', ') : 'None'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 font-bold text-[11px] uppercase tracking-tight">
                    <BookOpen size={14} className="text-indigo-500" />
                    Subjects: <span className="text-slate-900 font-black">{assignedSubjects.length > 0 ? assignedSubjects.join(', ') : 'None'}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <p className="text-slate-500 text-xs font-sans max-w-xl leading-relaxed">
              We're glad to have you back! Your dedication to shaping young minds at <span className="text-indigo-600 font-bold">{schoolInfo.name || 'our school'}</span> drives educational excellence. Use the tools below to manage classroom attendance, student assessments, and term reports.
            </p>
          </div>

          {/* Quick Notice Widgets */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 min-w-[280px]">
            {/* Birthday Alert */}
            {(() => {
              const today = new Date();
              const month = today.getMonth() + 1;
              const day = today.getDate();
              const birthdayStudents = myStudents.filter(s => {
                if (!s.dateOfBirth) return false;
                const dob = new Date(s.dateOfBirth);
                return (dob.getMonth() + 1) === month && dob.getDate() === day;
              });

              if (birthdayStudents.length > 0) {
                return (
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl flex items-center gap-3 animate-bounce-subtle">
                    <div className="p-2 bg-amber-400 text-white rounded-xl shadow-sm">
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Birthday Alert!</p>
                      <p className="text-xs font-bold text-amber-900">{birthdayStudents.length} student{birthdayStudents.length > 1 ? 's' : ''} celebrating today!</p>
                    </div>
                  </div>
                );
              }
              return (
                <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-2xl flex items-center gap-3">
                  <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-sm">
                    <CalendarDays size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Today's Schedule</p>
                    <p className="text-xs font-bold text-indigo-900">Normal School Hours</p>
                  </div>
                </div>
              );
            })()}

            {/* Performance Snapshot */}
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl flex items-center gap-3">
              <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-sm">
                <TrendingUp size={16} />
              </div>
              <div>
                <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Class Performance</p>
                <p className="text-xs font-bold text-emerald-900">{attendanceRate}% Attendance Rate</p>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Main Action & Birthday Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
        {/* Birthday Panel (Col span 2) */}
        <div className="lg:col-span-2 bg-gradient-to-r from-amber-500/10 to-orange-500/5 border border-amber-200/60 rounded-3xl p-6 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Cake size={120} className="text-amber-600" />
          </div>
          <div className="flex gap-4 items-center">
            <div className="p-3 bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-2xl shadow-md shrink-0">
              <Cake size={24} className="animate-bounce-subtle" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                Birthday Celebrations Corner
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-800 animate-pulse">
                  TODAY
                </span>
              </h4>
              <p className="text-xs text-amber-850/90 mt-1 max-w-md font-sans">
                Recognize and celebrate our students who are marking another year of growth and learning today.
              </p>
            </div>
          </div>

          <div className="w-full md:w-auto shrink-0">
            {birthdayStudents.length > 0 ? (
              <div className="flex flex-col gap-2 max-w-sm">
                {birthdayStudents.map(student => (
                  <div key={student.id} className="bg-white/95 backdrop-blur-xs border border-amber-100 rounded-xl p-3 flex items-center gap-3 shadow-xs">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-800 font-extrabold text-xs shrink-0">
                      {student.firstName[0]}
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-slate-800 font-sans">
                        {student.firstName} {student.middleName ? student.middleName + ' ' : ''}{student.lastName}
                      </p>
                      <p className="text-[10px] text-amber-800 font-bold font-sans">
                        Age: <span className="font-extrabold">{student.age} years old</span> | Class: <span className="font-extrabold">{student.class}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white/40 border border-amber-100/40 rounded-xl p-3 text-center md:text-left">
                <p className="text-xs font-bold text-amber-800 font-sans">No student birthdays today.</p>
                <p className="text-[10px] text-amber-700/70 mt-0.5 font-sans">We'll show today's celebrants here when their birthday arrives!</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions Panel (Col span 1) */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 flex flex-col justify-between shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Save size={100} className="text-indigo-600" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-500" />
              Quick Actions Center
            </h4>
            <p className="text-xs text-slate-500 mt-1 font-sans">
              Save active adjustments or backup the complete school database.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 mt-4">
            {onSaveAll && (
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={onSaveAll}
                disabled={isManualSaving}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer border select-none shadow-xs ${
                  isManualSaving
                    ? 'bg-amber-400 text-slate-950 border-amber-300 animate-pulse'
                    : showSaveSuccess 
                      ? 'bg-emerald-500 text-white border-emerald-400'
                      : 'bg-indigo-600 hover:bg-indigo-750 text-white border-indigo-550 active:bg-indigo-850'
                }`}
              >
                {isManualSaving ? (
                  <div className="w-3.5 h-3.5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                ) : showSaveSuccess ? (
                  <Check size={14} />
                ) : (
                  <Save size={14} />
                )}
                <span>
                  {isManualSaving 
                    ? "Saving Records..." 
                    : showSaveSuccess 
                      ? "Personnel Records Saved!" 
                      : "Save Personnel Changes"}
                </span>
              </motion.button>
            )}

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleExportJSON}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border transition text-xs font-bold rounded-xl cursor-pointer shadow-xs ${
                showJsonSuccess 
                  ? 'bg-emerald-500 text-white border-emerald-400'
                  : 'bg-slate-800 border-slate-900 text-white hover:bg-slate-900'
              }`}
              title="Download a full JSON data snapshot of all school records"
            >
              {showJsonSuccess ? <Check size={14} /> : <FileDown size={14} />}
              <span>{showJsonSuccess ? "Data Backup Created!" : "Save All Data (.json)"}</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
        <StatCard 
          icon={Users} 
          label="Total Students" 
          value={myStudents.length.toString()} 
          subtext={`${assignedClasses.length} Classes Assigned`}
          color="indigo"
        />
        <StatCard 
          icon={Calendar} 
          label="Attendance Rate" 
          value={`${attendanceRate}%`} 
          subtext="Current Term Average"
          color="emerald"
        />
        <StatCard 
          icon={GraduationCap} 
          label="Pending Grades" 
          value={pendingGradingCount.toString()} 
          subtext="Missing Assessment Entries"
          color="amber"
        />
        <StatCard 
          icon={Clock} 
          label="Term Progress" 
          value={(() => {
            const activeYearCfg = calendar.years[calendar.activeAcademicYear];
            if (!activeYearCfg) return '0%';
            const termCfg = activeYearCfg.terms[calendar.activeTerm];
            if (!termCfg) return '0%';
            const start = new Date(termCfg.startDate).getTime();
            const end = new Date(termCfg.endDate).getTime();
            const now = new Date().getTime();
            if (now < start) return '0%';
            if (now > end) return '100%';
            return `${Math.round(((now - start) / (end - start)) * 100)}%`;
          })()} 
          subtext={calendar.activeTerm}
          color="rose"
        />
      </div>

      {/* HEADTEACHER & ADMINISTRATIVE QUICK NOTES / STAFF MEMOS */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <StickyNote size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                  Headteacher & Administrative Memos
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200 font-mono">
                  {quickNotes.length} Active
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                Important announcements, policy updates, and staff directives posted by Headteacher & Management
              </p>
            </div>
          </div>

          {/* Search bar & Filters */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="relative min-w-[180px] sm:min-w-[220px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search memos & directives..."
                value={noteSearch}
                onChange={(e) => setNoteSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-slate-800 font-medium placeholder:text-slate-400"
              />
              {noteSearch && (
                <button
                  onClick={() => setNoteSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[10px]"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Priority filter selector */}
            <select
              value={notePriorityFilter}
              onChange={(e) => setNotePriorityFilter(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">🔴 Urgent</option>
              <option value="high">🟠 High</option>
              <option value="medium">🔵 Medium</option>
              <option value="low">⚪ Low</option>
            </select>

            {/* Category filter selector */}
            <select
              value={noteCategoryFilter}
              onChange={(e) => setNoteCategoryFilter(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="Academic">Academic</option>
              <option value="Finance">Finance</option>
              <option value="Personnel">Personnel</option>
              <option value="Events">Events</option>
              <option value="Maintenance">Maintenance</option>
              <option value="General">General</option>
            </select>
          </div>
        </div>

        {/* Note cards grid */}
        {filteredQuickNotes.length === 0 ? (
          <div className="p-8 text-center bg-slate-50/70 border border-dashed border-slate-200 rounded-2xl space-y-2">
            <StickyNote size={28} className="mx-auto text-slate-300" />
            <p className="text-xs font-bold text-slate-500">No administrative memos match your current filters.</p>
            {(noteSearch || notePriorityFilter !== 'all' || noteCategoryFilter !== 'all') && (
              <button
                onClick={() => {
                  setNoteSearch('');
                  setNotePriorityFilter('all');
                  setNoteCategoryFilter('all');
                }}
                className="text-[11px] font-bold text-amber-600 hover:underline cursor-pointer"
              >
                Clear note filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredQuickNotes.map((note) => {
              const style = teacherNoteColorStyles[note.color] || teacherNoteColorStyles.amber;
              const isExpanded = expandedNoteIds.has(note.id);
              const isLongContent = note.content.length > 150 || note.content.includes('\n');
              const dueDateObj = getTeacherDueDateStatus(note.dueDate);
              const DueIcon = dueDateObj?.icon;
              const currentUser = DbController.getCurrentUser();
              const teacherKey = teacherProfile.staffId || teacherProfile.id || currentUser?.uid || 'teacher';
              const isAcked = note.acknowledgedBy?.some(a => a.teacherId === teacherKey);

              return (
                <motion.div
                  key={note.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.18 }}
                  className={`relative p-4 rounded-2xl border shadow-xs flex flex-col justify-between space-y-3 ${style.bg} ${style.border} transition-all duration-200`}
                >
                  <div className="space-y-2">
                    {/* Header line: Badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {note.isPinned && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white font-black text-[9px] uppercase tracking-wider flex items-center gap-1 shadow-xs">
                            <Pin size={10} className="fill-current" /> Pinned
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[9.5px] border capitalize ${style.badge}`}>
                          {note.category || 'General'}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded-md font-extrabold text-[9px] uppercase tracking-wider ${
                            note.priority === 'urgent'
                              ? 'bg-rose-500 text-white'
                              : note.priority === 'high'
                              ? 'bg-amber-500 text-white'
                              : note.priority === 'medium'
                              ? 'bg-blue-500 text-white'
                              : 'bg-slate-400 text-white'
                          }`}
                        >
                          {note.priority}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-bold text-[9px] border border-indigo-200 dark:border-indigo-800">
                          {note.targetAudience === 'specific_class'
                            ? `To: ${note.targetClass || 'Class'}`
                            : note.targetAudience === 'class_teachers'
                            ? 'To: Class Teachers'
                            : 'To: All Staff'}
                        </span>
                      </div>

                      {dueDateObj && DueIcon && (
                        <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold border flex items-center gap-1 ${dueDateObj.colorClass}`}>
                          <DueIcon size={11} />
                          {dueDateObj.label}
                        </span>
                      )}
                    </div>

                    {/* Staff Meeting Notice Callout Box */}
                    {note.isMeetingNotice && (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[10.5px] space-y-1">
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
                    <h5 className={`text-sm font-black leading-tight ${style.text}`}>
                      {note.title}
                    </h5>

                    {/* Note Content with Markdown */}
                    <div className="relative">
                      <motion.div
                        layout
                        initial={false}
                        animate={{ height: !isExpanded && isLongContent ? 68 : 'auto' }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden prose prose-xs max-w-none text-xs text-slate-700 dark:text-slate-300 font-sans leading-relaxed break-words font-medium [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:mb-1 [&_strong]:font-black [&_strong]:text-slate-900 dark:[&_strong]:text-white [&_h3]:font-black [&_h3]:text-xs [&_h3]:mt-1 [&_h3]:mb-0.5 [&_blockquote]:border-l-2 [&_blockquote]:border-amber-400 [&_blockquote]:pl-2 [&_blockquote]:italic [&_code]:bg-white/60 dark:[&_code]:bg-slate-900/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-[10px]"
                      >
                        <Markdown>{note.content}</Markdown>
                      </motion.div>

                      {!isExpanded && isLongContent && (
                        <div className="absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-amber-50/90 dark:from-slate-850/90 to-transparent pointer-events-none rounded-b-md" />
                      )}
                    </div>

                    {isLongContent && (
                      <button
                        onClick={() => toggleNoteExpand(note.id)}
                        className="mt-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 inline-flex items-center gap-1 cursor-pointer transition"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp size={12} /> Show less
                          </>
                        ) : (
                          <>
                            <ChevronDown size={12} /> Read full memo
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Note Footer */}
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      <span>{note.author ? `Posted by ${note.author}` : 'Headteacher Directive'}</span>
                      <span className="font-mono text-[9.5px]">
                        {new Date(note.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>

                    {/* Acknowledgment Action / Status */}
                    <div className="pt-1 flex items-center justify-between">
                      {isAcked ? (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-black text-[10px] border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1.5 shadow-2xs">
                          <Check size={12} className="text-emerald-600 dark:text-emerald-400" /> Confirmed & Acknowledged
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAcknowledgeNote(note.id)}
                          className="w-full py-1.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-[10.5px] shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95"
                        >
                          <CheckSquare size={13} /> Confirm & Acknowledge Memo
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Assigned Classes & Students */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Target size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Assigned Classes</h3>
                  <p className="text-xs text-slate-500 font-sans">Breakdown of students under your care</p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assignedClasses.map(cls => (
                  <motion.div 
                    key={cls}
                    whileHover={{ scale: 1.02 }}
                    className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-indigo-100 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest font-mono">Section: Default</span>
                        <h4 className="text-xl font-black text-slate-900 font-display">{cls}</h4>
                      </div>
                      <div className="p-2 rounded-lg bg-white shadow-sm text-indigo-600 border border-slate-100">
                        <Users size={18} />
                      </div>
                    </div>
                    
                    <div className="mt-6 flex items-end justify-between">
                      <div>
                        <span className="block text-2xl font-black text-indigo-600 leading-none">{studentsPerClass[cls] || 0}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase font-sans mt-1 block">Total Students</span>
                      </div>
                      
                      <div className="flex gap-2">
                        <button 
                          onClick={() => onNavigate('attendance')}
                          className="p-2 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-colors"
                          title="Attendance"
                        >
                          <CalendarCheck size={16} />
                        </button>
                        <button 
                          onClick={() => onNavigate('assessments')}
                          className="p-2 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-colors"
                          title="Assessments"
                        >
                          <ClipboardCheck size={16} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {assignedClasses.length === 0 && (
                  <div className="col-span-full py-12 flex flex-col items-center justify-center text-center space-y-3 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    <div className="p-3 rounded-full bg-slate-100 text-slate-400">
                      <AlertCircle size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">No Classes Assigned</p>
                      <p className="text-xs text-slate-500">Contact your administrator to assign classes to your profile.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recharts Bar Chart: Student Performance Distribution Across Assigned Classes */}
          <div id="teacher-performance-distribution-chart" className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <BarChart2 size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Student Performance Distribution</h3>
                  <p className="text-xs text-slate-500 font-sans">Academic standing breakdown across assigned classes ({calendar.activeAcademicYear} • {calendar.activeTerm})</p>
                </div>
              </div>

              {/* Chart View Toggle Controls */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setChartView('bands')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    chartView === 'bands'
                      ? 'bg-white text-indigo-600 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers size={13} /> Performance Tiers
                </button>
                <button
                  type="button"
                  onClick={() => setChartView('average')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    chartView === 'average'
                      ? 'bg-white text-indigo-600 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Award size={13} /> Class Averages
                </button>
              </div>
            </div>

            <div className="p-6">
              {assignedClasses.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <AlertCircle size={28} className="mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">No Assigned Classes Found</p>
                  <p className="text-[11px]">Performance distribution charts will render here once classes are assigned.</p>
                </div>
              ) : performanceChartData.every(d => d.assessedStudents === 0) ? (
                <div className="py-12 text-center text-slate-400 space-y-2 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <GraduationCap size={28} className="mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-slate-700">No Assessment Data Logged Yet</p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto font-sans">
                    Grade assessments under the <button onClick={() => onNavigate('assessments')} className="text-indigo-600 underline font-bold cursor-pointer">Marks Input Sheet</button> to generate live performance distributions.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={performanceChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="class" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                        <YAxis 
                          tick={{ fill: '#64748b', fontSize: 11 }} 
                          axisLine={false} 
                          tickLine={false}
                          domain={chartView === 'average' ? [0, 100] : ['auto', 'auto']}
                          unit={chartView === 'average' ? '%' : ''}
                        />
                        <Tooltip 
                          content={({ active, payload, label }: any) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-slate-900/95 text-white p-3 rounded-xl shadow-xl border border-slate-700/80 text-xs backdrop-blur-md space-y-1.5 min-w-[170px]">
                                  <p className="font-extrabold text-amber-400 uppercase tracking-wider font-mono text-[11px] pb-1 border-b border-slate-800">
                                    Class: {label}
                                  </p>
                                  {payload.map((entry: any, index: number) => (
                                    <div key={`item-${index}`} className="flex items-center justify-between gap-4 font-sans text-[11px]">
                                      <span className="flex items-center gap-1.5 font-medium" style={{ color: entry.color || entry.fill }}>
                                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color || entry.fill }} />
                                        {entry.name}:
                                      </span>
                                      <span className="font-black font-mono">{entry.value}{entry.name === 'Class Average' ? '%' : ' Students'}</span>
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend 
                          wrapperStyle={{ paddingTop: '15px', fontSize: '11px', fontWeight: 600 }} 
                          iconType="circle"
                        />
                        {chartView === 'bands' ? (
                          <>
                            <Bar dataKey="excellent" name="Excellent (80-100%)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={36} />
                            <Bar dataKey="proficient" name="Proficient (60-79%)" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={36} />
                            <Bar dataKey="developing" name="Developing (40-59%)" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={36} />
                            <Bar dataKey="needsSupport" name="Needs Support (<40%)" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={36} />
                          </>
                        ) : (
                          <Bar dataKey="average" name="Class Average" radius={[6, 6, 0, 0]} maxBarSize={48}>
                            {performanceChartData.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={
                                  entry.average >= 75 ? '#10b981' :
                                  entry.average >= 60 ? '#6366f1' :
                                  entry.average >= 40 ? '#f59e0b' : '#f43f5e'
                                } 
                              />
                            ))}
                          </Bar>
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Summary Breakdown Pills */}
                  <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block font-sans">Total Assessed</span>
                      <span className="text-sm font-black text-slate-800">
                        {performanceChartData.reduce((acc, curr) => acc + curr.assessedStudents, 0)} Students
                      </span>
                    </div>
                    <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase block font-sans">Excellent Tiers</span>
                      <span className="text-sm font-black text-emerald-800">
                        {performanceChartData.reduce((acc, curr) => acc + curr.excellent, 0)}
                      </span>
                    </div>
                    <div className="bg-indigo-50 p-2.5 rounded-xl border border-indigo-100">
                      <span className="text-[10px] font-bold text-indigo-700 uppercase block font-sans">Proficient Tiers</span>
                      <span className="text-sm font-black text-indigo-800">
                        {performanceChartData.reduce((acc, curr) => acc + curr.proficient, 0)}
                      </span>
                    </div>
                    <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                      <span className="text-[10px] font-bold text-rose-700 uppercase block font-sans">Needs Support</span>
                      <span className="text-sm font-black text-rose-800">
                        {performanceChartData.reduce((acc, curr) => acc + curr.needsSupport, 0)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <AverageImprovementChart 
            assessments={assessments} 
            calendar={calendar} 
            assignedClasses={assignedClasses} 
          />

          {/* Recently Recorded Attendance Summary */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Assigned Subjects</h3>
                  <p className="text-xs text-slate-500 font-sans">Subjects you are authorized to grade</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="flex flex-wrap gap-2">
                {assignedSubjects.map(sub => (
                  <span key={sub} className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 flex items-center gap-2">
                    <BookOpen size={14} className="text-indigo-500" />
                    {sub}
                  </span>
                ))}
                {assignedSubjects.length === 0 && (
                  <p className="text-xs text-slate-400 italic">No subjects assigned yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Teacher Reflections Module */}
          <TeacherReflections 
            teacher={teacherProfile} 
            reflections={reflections} 
            schoolInfo={schoolInfo}
            onRefresh={onRefresh} 
          />
        </div>

        {/* Right Column: Upcoming Tasks & Calendar */}
        <div className="space-y-6">
          <div className="bg-slate-900 text-white rounded-2xl overflow-hidden shadow-xl border border-slate-800">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-800/30">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Clock size={14} className="text-amber-400" /> Upcoming Tasks
              </h3>
              <button
                onClick={() => {
                  setNewTaskTitle('');
                  setNewTaskDescription('');
                  setShowAddTaskModal(true);
                }}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition cursor-pointer"
                title="Add custom task"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="divide-y divide-slate-800">
              {allTasks.map((task, idx) => (
                <div 
                  key={task.id} 
                  className="p-5 hover:bg-slate-800/50 transition-colors cursor-pointer group flex items-center"
                  onClick={task.action}
                >
                  <div className="flex gap-4 flex-1">
                    <div className={`mt-1 p-2 rounded-lg shrink-0 ${
                      task.priority === 'critical' ? 'bg-rose-500/20 text-rose-400' :
                      task.priority === 'high' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-indigo-500/20 text-indigo-400'
                    }`}>
                      <task.icon size={18} />
                    </div>
                    <div className="space-y-1 pr-4">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-100 group-hover:text-amber-400 transition-colors">{task.title}</h4>
                        {task.priority === 'critical' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed font-sans">{task.description}</p>
                    </div>
                  </div>
                  {task.isCustom ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm("Archive this task?")) {
                          const existingTask = DbController.getTasks().find(t => t.id === task.id);
                          if (existingTask) {
                            existingTask.isArchived = true;
                            existingTask.archivedAt = new Date().toISOString();
                            DbController.saveTask(existingTask);
                            setCustomTasks(DbController.getTasks().filter(t => !t.isArchived));
                            window.dispatchEvent(new CustomEvent('app-toast', { detail: { text: 'Task archived successfully.', type: 'success' } }));
                          }
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:bg-slate-700 hover:text-white rounded-lg transition-all"
                      title="Archive task"
                    >
                      <Archive size={14} />
                    </button>
                  ) : (
                    <ArrowRight size={14} className="text-slate-700 group-hover:text-white group-hover:translate-x-1 transition-all" />
                  )}
                </div>
              ))}
              {allTasks.length === 0 && (
                <div className="p-10 text-center space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-600">
                    <CheckCircle size={24} />
                  </div>
                  <p className="text-xs text-slate-500 font-medium">All caught up! No pending tasks.</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Calendar Snapshot */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 border-b border-slate-100 pb-3">
              <CalendarDays size={14} className="text-indigo-500" /> Academic Context
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Current Term</span>
                <span className="text-xs font-black text-slate-900">{calendar.activeTerm}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Academic Year</span>
                <span className="text-xs font-black text-slate-900">{calendar.activeAcademicYear}</span>
              </div>
              <hr className="border-slate-50" />
              {(() => {
                const activeYearCfg = calendar.years[calendar.activeAcademicYear];
                if (!activeYearCfg) return null;
                const termCfg = activeYearCfg.terms[calendar.activeTerm];
                if (!termCfg) return null;
                return (
                  <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                    <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase font-mono">
                      <span>Term Start</span>
                      <span>Term End</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <span>{new Date(termCfg.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                      <span>{new Date(termCfg.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: (() => {
                          const start = new Date(termCfg.startDate).getTime();
                          const end = new Date(termCfg.endDate).getTime();
                          const now = new Date().getTime();
                          if (now < start) return '0%';
                          if (now > end) return '100%';
                          return `${Math.round(((now - start) / (end - start)) * 100)}%`;
                        })() }}
                        className="bg-indigo-500 h-full rounded-full"
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </motion.div>

    {/* Floating Quick Actions */}
    <div className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-50">
        <AnimatePresence>
          {isQuickActionsOpen && (
            <div className="absolute bottom-20 right-0 space-y-3 flex flex-col items-end">
              {[
                { label: 'Set Attendance Flag', icon: CalendarCheck, color: 'bg-emerald-600', actionId: 'attendance' },
                { label: 'Add Quick Grade', icon: GraduationCap, color: 'bg-amber-600', actionId: 'grade' },
                { label: 'Behavioral Note', icon: MessageSquare, color: 'bg-indigo-600', actionId: 'behavior' }
              ].map((action, idx) => (
                <motion.button
                  key={action.actionId}
                  initial={{ opacity: 0, scale: 0.8, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8, x: 20 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => {
                    setQuickActionModal(action.actionId as any);
                    setIsQuickActionsOpen(false);
                  }}
                  className="flex items-center gap-3 group"
                >
                  <span className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-xl whitespace-nowrap">
                    {action.label}
                  </span>
                  <div className={`p-4 rounded-2xl ${action.color} text-white shadow-2xl hover:scale-110 transition-transform`}>
                    <action.icon size={20} />
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsQuickActionsOpen(!isQuickActionsOpen)}
          className={`p-5 rounded-3xl shadow-2xl transition-all duration-300 flex items-center justify-center ${
            isQuickActionsOpen 
              ? 'bg-slate-900 text-white rotate-90' 
              : 'bg-amber-400 text-slate-900'
          }`}
        >
          {isQuickActionsOpen ? <X size={28} /> : <Zap size={28} fill="currentColor" />}
          
          {!isQuickActionsOpen && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 border-2 border-white"></span>
            </span>
          )}
        </motion.button>
      </div>

      {/* Close backdrop when menu is open */}
      {isQuickActionsOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/5 backdrop-blur-[2px]"
          onClick={() => setIsQuickActionsOpen(false)}
        />
      )}

      {/* Quick Action Modal */}
      <AnimatePresence>
        {quickActionModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100"
            >
              <div className={`p-4 border-b flex justify-between items-center ${
                quickActionModal === 'attendance' ? 'bg-emerald-50 border-emerald-100 text-emerald-900' :
                quickActionModal === 'grade' ? 'bg-amber-50 border-amber-100 text-amber-900' :
                'bg-indigo-50 border-indigo-100 text-indigo-900'
              }`}>
                <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
                  {quickActionModal === 'attendance' && <><CalendarCheck size={16} className="text-emerald-600" /> Quick Attendance</>}
                  {quickActionModal === 'grade' && <><GraduationCap size={16} className="text-amber-600" /> Quick Grade</>}
                  {quickActionModal === 'behavior' && <><MessageSquare size={16} className="text-indigo-600" /> Behavioral Note</>}
                </h3>
                <button onClick={() => setQuickActionModal(null)} className="p-1 hover:bg-black/5 rounded-lg transition">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleQuickActionSubmit} className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Student</label>
                  <select
                    required
                    value={qaStudentId}
                    onChange={(e) => setQaStudentId(e.target.value)}
                    className="w-full text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  >
                    <option value="">-- Choose a student --</option>
                    {myStudents.map(s => (
                      <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.class})</option>
                    ))}
                  </select>
                </div>

                {quickActionModal === 'attendance' && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</label>
                    <div className="flex gap-2">
                      {['Present', 'Absent', 'On Leave'].map((status) => (
                        <label key={status} className={`flex-1 flex items-center justify-center p-2 rounded-xl border text-xs font-bold cursor-pointer transition ${qaAttendanceStatus === status ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                          <input type="radio" name="status" value={status} checked={qaAttendanceStatus === status} onChange={() => setQaAttendanceStatus(status as any)} className="hidden" />
                          {status}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {quickActionModal === 'grade' && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subject</label>
                      <select required value={qaSubject} onChange={e => setQaSubject(e.target.value)} className="w-full text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                        {assignedSubjects.map(sub => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assessment</label>
                        <select required value={qaAssessmentType} onChange={e => setQaAssessmentType(e.target.value)} className="w-full text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                          <option value="exercise1">Exercise 1</option>
                          <option value="exercise2">Exercise 2</option>
                          <option value="test1">Test 1</option>
                          <option value="test2">Test 2</option>
                          <option value="project">Project Work</option>
                          <option value="group">Group Work</option>
                          <option value="exam">Exam</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Score</label>
                        <input type="number" required min="0" step="0.5" value={qaScore} onChange={e => setQaScore(e.target.value)} className="w-full text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-2.5" placeholder="e.g. 8.5" />
                      </div>
                    </div>
                  </>
                )}

                {quickActionModal === 'behavior' && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Note Details</label>
                    <SmartTextarea 
                      required 
                      value={qaBehaviorContent} 
                      onChange={e => setQaBehaviorContent(e.target.value)}
                      placeholder="Describe the incident or progress..."
                      className="w-full h-24 resize-none text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                )}

                <div className="pt-2 flex gap-3">
                  <button type="button" onClick={() => setQuickActionModal(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition">
                    Cancel
                  </button>
                  <button type="submit" className={`flex-1 py-2.5 text-white rounded-xl text-xs font-bold transition ${
                    quickActionModal === 'attendance' ? 'bg-emerald-600 hover:bg-emerald-700' :
                    quickActionModal === 'grade' ? 'bg-amber-600 hover:bg-amber-700' :
                    'bg-indigo-600 hover:bg-indigo-700'
                  }`}>
                    Save Record
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddTaskModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100"
            >
              <div className="p-4 border-b bg-indigo-50 border-indigo-100 text-indigo-900 flex justify-between items-center">
                <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
                  <Plus size={16} className="text-indigo-600" /> Add Custom Task
                </h3>
                <button onClick={() => setShowAddTaskModal(false)} className="p-1 hover:bg-black/5 rounded-lg transition">
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Task Title</label>
                  <input
                    type="text"
                    required
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    className="w-full text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="e.g. Check class project submissions"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Task Description</label>
                  <SmartTextarea
                    required
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    className="w-full h-24 resize-none text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="Provide detailed notes about the task..."
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button type="button" onClick={() => setShowAddTaskModal(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!newTaskTitle || !newTaskDescription) {
                        alert('Please fill out both title and description.');
                        return;
                      }
                      const newTask: CustomTask = {
                        id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                        title: newTaskTitle,
                        description: newTaskDescription,
                        priority: 'medium',
                        isCompleted: false,
                        isArchived: false,
                        createdAt: new Date().toISOString(),
                        createdBy: teacherProfile.id
                      };
                      DbController.saveTask(newTask);
                      setCustomTasks(DbController.getTasks().filter(t => !t.isArchived));
                      setShowAddTaskModal(false);
                    }}
                    className="flex-1 py-2.5 text-white rounded-xl text-xs font-bold transition bg-indigo-600 hover:bg-indigo-700 cursor-pointer"
                  >
                    Add Task
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, subtext, color }: { 
  icon: any, 
  label: string, 
  value: string, 
  subtext: string,
  color: 'indigo' | 'emerald' | 'amber' | 'rose'
}) {
  const colorMap = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100'
  };

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${colorMap[color]}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">{label}</p>
        <h4 className="text-2xl font-black text-slate-900 mt-0.5">{value}</h4>
        <p className="text-[10px] font-medium text-slate-500 mt-1 uppercase font-sans tracking-tight">{subtext}</p>
      </div>
    </motion.div>
  );
}

const CalendarCheck = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>
);

const ClipboardCheck = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></svg>
);
