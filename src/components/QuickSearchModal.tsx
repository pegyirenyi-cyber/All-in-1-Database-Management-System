import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, X, User, UserCheck, Coins, FileSpreadsheet, 
  Navigation, CornerDownLeft, FileText, CheckCircle, XCircle, 
  AlertCircle, Calendar, ArrowRight, Info, ShieldAlert, BookOpen,
  ChevronDown, ChevronRight, ChevronsUpDown, Filter, GraduationCap,
  Layers, School, Check, Users
} from 'lucide-react';
import { Student, Teacher, StudentFeeBill, StudentAssessment, CLASSES, ClassType } from '../types';
import { DbController } from '../db';

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  teachers: Teacher[];
  theme: any;
  userRole?: string;
  onNavigate: (tabId: string) => void;
}

export type SearchCategoryType = 'students' | 'teachers' | 'classes' | 'bills' | 'assessments' | 'nav';

export interface ClassItemData {
  className: ClassType;
  studentCount: number;
  maleCount: number;
  femaleCount: number;
  classTeacher?: Teacher;
}

export type SearchResult = 
  | { type: 'student'; category: 'students'; id: string; title: string; subtitle: string; item: Student }
  | { type: 'teacher'; category: 'teachers'; id: string; title: string; subtitle: string; item: Teacher }
  | { type: 'class'; category: 'classes'; id: string; title: string; subtitle: string; item: ClassItemData }
  | { type: 'bill'; category: 'bills'; id: string; title: string; subtitle: string; item: StudentFeeBill }
  | { type: 'assessment'; category: 'assessments'; id: string; title: string; subtitle: string; item: StudentAssessment }
  | { type: 'nav'; category: 'nav'; id: string; title: string; subtitle: string; tabId: string };

const getStudentFullName = (s: Student) => {
  return `${s.firstName} ${s.middleName ? s.middleName + ' ' : ''}${s.lastName}`.trim();
};

const getTeacherFullName = (t: Teacher) => {
  return `${t.firstName} ${t.middleName ? t.middleName + ' ' : ''}${t.lastName}`.trim();
};

// --- Category definitions for grouped display ---
interface CategoryMeta {
  key: SearchCategoryType;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  activeColor: string;
  badgeBg: string;
  badgeText: string;
  headerBg: string;
  borderAccent: string;
}

const CATEGORIES: CategoryMeta[] = [
  {
    key: 'students',
    label: 'Students',
    shortLabel: 'Students',
    icon: <User size={14} className="text-emerald-600" />,
    activeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    badgeBg: 'bg-emerald-50 border-emerald-100',
    badgeText: 'text-emerald-700',
    headerBg: 'bg-emerald-50/40 hover:bg-emerald-50/70',
    borderAccent: 'border-emerald-200/60'
  },
  {
    key: 'teachers',
    label: 'Teachers & Staff',
    shortLabel: 'Teachers',
    icon: <UserCheck size={14} className="text-amber-600" />,
    activeColor: 'text-amber-700 bg-amber-50 border-amber-200',
    badgeBg: 'bg-amber-50 border-amber-100',
    badgeText: 'text-amber-700',
    headerBg: 'bg-amber-50/40 hover:bg-amber-50/70',
    borderAccent: 'border-amber-200/60'
  },
  {
    key: 'classes',
    label: 'Classes & Sections',
    shortLabel: 'Classes',
    icon: <GraduationCap size={14} className="text-blue-600" />,
    activeColor: 'text-blue-700 bg-blue-50 border-blue-200',
    badgeBg: 'bg-blue-50 border-blue-100',
    badgeText: 'text-blue-700',
    headerBg: 'bg-blue-50/40 hover:bg-blue-50/70',
    borderAccent: 'border-blue-200/60'
  },
  {
    key: 'bills',
    label: 'Fee Bills & Invoices',
    shortLabel: 'Fees',
    icon: <Coins size={14} className="text-indigo-600" />,
    activeColor: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    badgeBg: 'bg-indigo-50 border-indigo-100',
    badgeText: 'text-indigo-700',
    headerBg: 'bg-indigo-50/40 hover:bg-indigo-50/70',
    borderAccent: 'border-indigo-200/60'
  },
  {
    key: 'assessments',
    label: 'Academic Assessments',
    shortLabel: 'Assessments',
    icon: <FileSpreadsheet size={14} className="text-sky-600" />,
    activeColor: 'text-sky-700 bg-sky-50 border-sky-200',
    badgeBg: 'bg-sky-50 border-sky-100',
    badgeText: 'text-sky-700',
    headerBg: 'bg-sky-50/40 hover:bg-sky-50/70',
    borderAccent: 'border-sky-200/60'
  },
  {
    key: 'nav',
    label: 'Navigation & Tools',
    shortLabel: 'Tools',
    icon: <Navigation size={14} className="text-purple-600" />,
    activeColor: 'text-purple-700 bg-purple-50 border-purple-200',
    badgeBg: 'bg-purple-50 border-purple-100',
    badgeText: 'text-purple-700',
    headerBg: 'bg-purple-50/40 hover:bg-purple-50/70',
    borderAccent: 'border-purple-200/60'
  }
];

// --- Sub-components for detail views ---
const StudentDetailView = ({ 
  s, 
  allBills, 
  allAssessments, 
  onAction 
}: { 
  s: Student, 
  allBills: StudentFeeBill[], 
  allAssessments: StudentAssessment[],
  onAction: () => void
}) => {
  const studentBills = allBills.filter(b => b.studentId === s.id).slice(0, 3);
  const studentGrades = allAssessments.filter(a => a.studentId === s.id).slice(0, 3);
  const fullName = `${s.firstName} ${s.middleName ? s.middleName + ' ' : ''}${s.lastName}`.trim();

  return (
    <div className="space-y-4 text-slate-700">
      <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
        <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 text-lg font-bold">
          {fullName.charAt(0)}
        </div>
        <div className="min-w-0 text-left">
          <h4 className="text-sm font-bold text-slate-800 truncate">{fullName}</h4>
          <span className="text-[10px] bg-slate-100 border border-slate-200/60 px-2 py-0.5 rounded-md font-mono text-slate-500 block w-fit mt-0.5">
            ID: {s.id}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 text-[11px] text-left">
        <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg">
          <span className="text-[9px] text-slate-400 block font-mono">CLASS / SECTION</span>
          <span className="font-bold text-slate-700 truncate block">{s.class} ({s.section})</span>
        </div>
        <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg">
          <span className="text-[9px] text-slate-400 block font-mono">STATUS</span>
          <span className={`font-bold uppercase ${s.status === 'Boarder' ? 'text-indigo-600' : 'text-emerald-600'}`}>
            {s.status}
          </span>
        </div>
        <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg">
          <span className="text-[9px] text-slate-400 block font-mono">GUARDIAN</span>
          <span className="font-bold text-slate-700 truncate block">{s.guardianName || 'N/A'}</span>
        </div>
        <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg">
          <span className="text-[9px] text-slate-400 block font-mono">CONTACT PHONE</span>
          <span className="font-bold text-slate-700 truncate block">{s.guardianTelephone || 'N/A'}</span>
        </div>
      </div>

      {studentBills.length > 0 && (
        <div className="space-y-1.5 pt-1 text-left">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Latest Invoices</span>
          <div className="border border-slate-200/60 rounded-lg overflow-hidden divide-y divide-slate-100 bg-white">
            {studentBills.map(b => {
              const amountDue = (b.schoolFees || 0) + (b.utilityBill || 0) + (b.sportsFees || 0) + (b.ptaDues || 0) + (b.transportationBill || 0) + (b.otherFee || 0);
              const amountPaid = b.payments ? b.payments.reduce((sum, p) => sum + p.amount, 0) : 0;
              const status = amountPaid >= amountDue ? 'Fully Paid' : amountPaid > 0 ? 'Partially Paid' : 'Unpaid';
              
              return (
                <div key={b.id} className="p-2 flex items-center justify-between text-[10px]">
                  <span className="font-bold text-slate-700 truncate max-w-[120px]">{b.academicYear} ({b.term})</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-slate-500">GHS {amountDue}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                      status === 'Fully Paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                      status === 'Partially Paid' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                      'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}>
                      {status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {studentGrades.length > 0 && (
        <div className="space-y-1.5 pt-1 text-left">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Academic Achievements</span>
          <div className="border border-slate-200/60 rounded-lg overflow-hidden divide-y divide-slate-100 bg-white">
            {studentGrades.map(g => (
              <div key={g.id} className="p-2 flex items-center justify-between text-[10px]">
                <span className="font-bold text-slate-700 truncate max-w-[120px]">{g.subject}</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">{(g as any).examType || 'Exam'}</span>
                  <span className="font-mono font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                    {g.gradeLevel} ({g.totalScore}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        id="quick-search-open-student-file-btn"
        onClick={onAction}
        className="w-full mt-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
      >
        <span>Open Full Student File</span>
        <ArrowRight size={12} />
      </button>
    </div>
  );
};

const TeacherDetailView = ({ t, onAction }: { t: Teacher, onAction: () => void }) => {
  const fullName = `${t.firstName} ${t.middleName ? t.middleName + ' ' : ''}${t.lastName}`.trim();
  return (
    <div className="space-y-4 text-slate-700 text-left">
      <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
        <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 text-lg font-bold">
          {fullName.charAt(0)}
        </div>
        <div className="min-w-0 text-left">
          <h4 className="text-sm font-bold text-slate-800 truncate">{fullName}</h4>
          <span className="text-[10px] bg-slate-100 border border-slate-200/60 px-2 py-0.5 rounded-md font-mono text-slate-500 block w-fit mt-0.5">
            Staff ID: {t.id}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 text-[11px]">
        <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg">
          <span className="text-[9px] text-slate-400 block font-mono">ASSIGNED CLASS</span>
          <span className="font-bold text-slate-700 truncate block">{t.assignedClass || 'None'}</span>
        </div>
        <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg">
          <span className="text-[9px] text-slate-400 block font-mono">STAFF RANK</span>
          <span className="font-bold text-indigo-600 truncate block">{t.rank}</span>
        </div>
        <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg col-span-2">
          <span className="text-[9px] text-slate-400 block font-mono">EMAIL ADDRESS</span>
          <span className="font-bold text-slate-700 truncate block">{t.email || 'N/A'}</span>
        </div>
      </div>

      {t.highestAcademicQualifications && (
        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-[11px]">
          <span className="text-[9px] text-slate-400 block font-mono">HIGHEST ACADEMIC QUALIFICATION</span>
          <p className="font-semibold text-slate-600 mt-0.5 leading-normal">{t.highestAcademicQualifications}</p>
        </div>
      )}

      <button
        id="quick-search-open-teacher-profile-btn"
        onClick={onAction}
        className="w-full mt-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
      >
        <span>Open Staff Profile</span>
        <ArrowRight size={12} />
      </button>
    </div>
  );
};

const ClassDetailView = ({ 
  item, 
  onAction 
}: { 
  item: ClassItemData; 
  onAction: () => void 
}) => {
  return (
    <div className="space-y-4 text-slate-700 text-left">
      <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
        <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 text-lg font-bold">
          <GraduationCap size={22} />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-slate-800 truncate">{item.className}</h4>
          <span className="text-[10px] bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded-md font-mono text-blue-600 block w-fit mt-0.5 font-bold">
            Academic Class Tier
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 text-[11px]">
        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
          <span className="text-[9px] text-slate-400 block font-mono">TOTAL STUDENTS</span>
          <span className="font-bold text-slate-800 text-sm">{item.studentCount}</span>
        </div>
        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
          <span className="text-[9px] text-slate-400 block font-mono">CLASS TEACHER</span>
          <span className="font-bold text-indigo-600 truncate block text-[11px]">
            {item.classTeacher ? `${item.classTeacher.firstName} ${item.classTeacher.lastName}` : 'Unassigned'}
          </span>
        </div>
        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
          <span className="text-[9px] text-slate-400 block font-mono">BOYS</span>
          <span className="font-bold text-slate-700">{item.maleCount}</span>
        </div>
        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
          <span className="text-[9px] text-slate-400 block font-mono">GIRLS</span>
          <span className="font-bold text-slate-700">{item.femaleCount}</span>
        </div>
      </div>

      <div className="p-2.5 bg-blue-50/50 border border-blue-100 rounded-lg text-[10px] text-blue-700 leading-relaxed">
        <p>Access student roll, attendance marksheets, or term report broadsheets for <strong>{item.className}</strong>.</p>
      </div>

      <button
        id="quick-search-open-class-roster-btn"
        onClick={onAction}
        className="w-full mt-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
      >
        <span>View Class Roster</span>
        <ArrowRight size={12} />
      </button>
    </div>
  );
};

const BillDetailView = ({ b, studentName, onAction }: { b: StudentFeeBill, studentName: string, onAction: () => void }) => {
  const amountDue = (b.schoolFees || 0) + (b.utilityBill || 0) + (b.sportsFees || 0) + (b.ptaDues || 0) + (b.transportationBill || 0) + (b.otherFee || 0);
  const amountPaid = b.payments ? b.payments.reduce((sum, p) => sum + p.amount, 0) : 0;
  const status = amountPaid >= amountDue ? 'Fully Paid' : amountPaid > 0 ? 'Partially Paid' : 'Unpaid';

  return (
    <div className="space-y-4 text-slate-700 text-left">
      <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
        <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
          <Coins size={18} />
        </div>
        <div className="min-w-0">
          <h4 className="text-xs font-mono font-black text-slate-800 truncate">BILL ID: {b.id.substring(0, 12)}</h4>
          <span className="text-[10px] text-slate-400 block truncate">
            Issued for: <strong>{studentName}</strong>
          </span>
        </div>
      </div>

      <div className="space-y-2 text-[11px]">
        <div className="flex justify-between py-1.5 border-b border-slate-100">
          <span className="text-slate-400">Student Profile</span>
          <span className="font-bold text-slate-700 truncate block max-w-[180px]">{studentName}</span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-slate-100">
          <span className="text-slate-400">Academic Year / Term</span>
          <span className="font-semibold text-slate-700">{b.academicYear} — {b.term}</span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-slate-100">
          <span className="text-slate-400">Amount Due</span>
          <span className="font-mono font-bold text-slate-700">GHS {amountDue}</span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-slate-100">
          <span className="text-slate-400">Amount Paid</span>
          <span className="font-mono font-bold text-emerald-600">GHS {amountPaid}</span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-slate-100">
          <span className="text-slate-400">Remaining Balance</span>
          <span className="font-mono font-bold text-rose-600">GHS {amountDue - amountPaid}</span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-slate-100">
          <span className="text-slate-400">Payment Status</span>
          <span className={`font-bold uppercase ${
            status === 'Fully Paid' ? 'text-emerald-600' :
            status === 'Partially Paid' ? 'text-amber-600' : 'text-rose-600'
          }`}>
            {status}
          </span>
        </div>
      </div>

      <button
        id="quick-search-open-fee-ledger-btn"
        onClick={onAction}
        className="w-full mt-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
      >
        <span>Open Financial Ledger</span>
        <ArrowRight size={12} />
      </button>
    </div>
  );
};

const AssessmentDetailView = ({ a, studentName, onAction }: { a: StudentAssessment, studentName: string, onAction: () => void }) => (
  <div className="space-y-4 text-slate-700 text-left">
    <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
      <div className="w-10 h-10 rounded-full bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
        <FileSpreadsheet size={18} />
      </div>
      <div className="min-w-0">
        <h4 className="text-sm font-bold text-slate-800 truncate">{a.subject}</h4>
        <span className="text-[10px] text-slate-400 block truncate">
          Student: <strong>{studentName}</strong>
        </span>
      </div>
    </div>

    <div className="space-y-2 text-[11px]">
      <div className="flex justify-between py-1.5 border-b border-slate-100">
        <span className="text-slate-400">Subject</span>
        <span className="font-bold text-slate-700">{a.subject}</span>
      </div>
      <div className="flex justify-between py-1.5 border-b border-slate-100">
        <span className="text-slate-400">Exam Type / Weight</span>
        <span className="font-semibold text-slate-700">{(a as any).examType || 'Exam'}</span>
      </div>
      <div className="flex justify-between py-1.5 border-b border-slate-100">
        <span className="text-slate-400">Total Score</span>
        <span className="font-mono font-bold text-slate-700">{a.totalScore}%</span>
      </div>
      <div className="flex justify-between py-1.5 border-b border-slate-100">
        <span className="text-slate-400">Grade Evaluation</span>
        <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{a.gradeLevel}</span>
      </div>
      <div className="flex justify-between py-1.5 border-b border-slate-100">
        <span className="text-slate-400">Period</span>
        <span className="font-semibold text-slate-600">{a.academicYear} ({a.term})</span>
      </div>
      {a.remarks && (
        <div className="py-1.5">
          <span className="text-slate-400 block mb-1">Teacher Remarks</span>
          <p className="p-2 bg-slate-50 border border-slate-100 rounded-lg italic text-slate-600 leading-normal">{a.remarks}</p>
        </div>
      )}
    </div>

    <button
      id="quick-search-open-broadsheet-btn"
      onClick={onAction}
      className="w-full mt-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
    >
      <span>Open Academic Broadsheet</span>
      <ArrowRight size={12} />
    </button>
  </div>
);

export default function QuickSearchModal({
  isOpen,
  onClose,
  students,
  teachers,
  theme,
  userRole,
  onNavigate
}: QuickSearchModalProps) {
  const isTeacher = userRole === 'Teacher';
  const activeCategories = useMemo(() => CATEGORIES.filter(c => isTeacher ? c.key !== 'bills' : true), [isTeacher]);
  const [query, setQuery] = useState('');
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'all' | SearchCategoryType>('all');
  
  // Track collapsed status for each category (default: all expanded)
  const [collapsedCategories, setCollapsedCategories] = useState<Record<SearchCategoryType, boolean>>({
    students: false,
    teachers: false,
    classes: false,
    bills: false,
    assessments: false,
    nav: false
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Toggle category collapse
  const toggleCategoryCollapse = (categoryKey: SearchCategoryType) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [categoryKey]: !prev[categoryKey]
    }));
  };

  // Expand / Collapse all
  const areAllCollapsed = useMemo(() => {
    return Object.values(collapsedCategories).every(v => v);
  }, [collapsedCategories]);

  const toggleCollapseAll = () => {
    const nextState = !areAllCollapsed;
    setCollapsedCategories({
      students: nextState,
      teachers: nextState,
      classes: nextState,
      bills: nextState,
      assessments: nextState,
      nav: nextState
    });
  };

  // Load fee bills and assessments dynamically for searching
  const allBills = useMemo(() => {
    if (!isOpen || isTeacher) return [];
    try {
      return DbController.getStudentFeeBills();
    } catch {
      return [];
    }
  }, [isOpen, isTeacher]);

  const allAssessments = useMemo(() => {
    if (!isOpen) return [];
    try {
      return DbController.getAssessments();
    } catch {
      return [];
    }
  }, [isOpen]);

  // Map student names for easy O(1) display in fee bills & assessments
  const studentMap = useMemo(() => {
    const map = new Map<string, Student>();
    students.forEach(s => map.set(s.id, s));
    return map;
  }, [students]);

  // Tab navigation definitions for Quick Nav
  const NAV_ITEMS = [
    { label: 'Dashboard Summary', id: 'dashboard', subtitle: 'Analytics and overview widgets' },
    { label: 'Admin Panel', id: 'admin_dashboard', subtitle: 'Manage system users and logs' },
    { label: 'School Profile', id: 'school_profile', subtitle: 'EMIS code, logo, motto and address' },
    { label: 'Academic Calendar', id: 'calendar', subtitle: 'Configure holidays, terms and events' },
    { label: 'Student Profiles', id: 'students', subtitle: 'Student directory, roster and forms' },
    { label: 'Teacher Profiles', id: 'teachers', subtitle: 'Staff profiles, ranks and classes' },
    { label: 'Class Attendance Roster', id: 'attendance', subtitle: 'Daily roll-call registry' },
    { label: 'Academic Assessments', id: 'assessments', subtitle: 'Marksheets, broadsheets and reports' },
    ...(isTeacher ? [] : [{ label: 'School Fees Ledger', id: 'fees', subtitle: 'Invoices, fee collections and status' }]),
    ...(isTeacher ? [] : [{ label: 'Paystack Ledger', id: 'paystack', subtitle: 'Online card payment gateway logs' }]),
    { label: 'Parent Messages', id: 'communications', subtitle: 'SMS broadcast alerts' },
    { label: 'GES EMIS Census', id: 'emis', subtitle: 'Annual structural education report' },
    { label: 'System Controls', id: 'settings', subtitle: 'Backups, database resets and themes' }
  ];

  // Global escape and open key listeners
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 80);
      setQuery('');
      setSelectedResult(null);
      setActiveResultIndex(0);
      setActiveCategoryFilter('all');
    }
  }, [isOpen]);

  // Compute search results across categories
  const allResults = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return [];

    const normalizedQuery = query.toLowerCase().trim();
    const matches: SearchResult[] = [];

    // 1. Search Students
    const studentMatches = students.filter(s => {
      if (!s) return false;
      const fullName = (getStudentFullName(s) || '').toLowerCase();
      return (
        fullName.includes(normalizedQuery) ||
        (s.id?.toLowerCase() || '').includes(normalizedQuery) ||
        (s.class?.toLowerCase() || '').includes(normalizedQuery) ||
        (s.guardianName?.toLowerCase() || '').includes(normalizedQuery)
      );
    }).slice(0, 6);

    studentMatches.forEach(st => {
      matches.push({
        type: 'student',
        category: 'students',
        id: `student_${st.id}`,
        title: getStudentFullName(st),
        subtitle: `Student • ID: ${st.id} • Class: ${st.class} (${st.section})`,
        item: st
      });
    });

    // 2. Search Teachers
    const teacherMatches = teachers.filter(t => {
      if (!t) return false;
      const fullName = (getTeacherFullName(t) || '').toLowerCase();
      return (
        fullName.includes(normalizedQuery) ||
        (t.email?.toLowerCase() || '').includes(normalizedQuery) ||
        (t.id?.toLowerCase() || '').includes(normalizedQuery) ||
        (t.assignedClass?.toLowerCase() || '').includes(normalizedQuery) ||
        (t.rank?.toLowerCase() || '').includes(normalizedQuery)
      );
    }).slice(0, 5);

    teacherMatches.forEach(tc => {
      matches.push({
        type: 'teacher',
        category: 'teachers',
        id: `teacher_${tc.id}`,
        title: getTeacherFullName(tc),
        subtitle: `Teacher • ID: ${tc.id} • Assigned: ${tc.assignedClass || 'None'} • Rank: ${tc.rank}`,
        item: tc
      });
    });

    // 3. Search Classes & Sections
    const classMatches = CLASSES.filter(cls => {
      const clsName = cls.toLowerCase();
      const normCls = clsName.replace(/\./g, '');
      const cleanQ = normalizedQuery.replace(/\./g, '');
      return clsName.includes(normalizedQuery) || normCls.includes(cleanQ) || normalizedQuery.includes(normCls);
    });

    classMatches.forEach(cls => {
      const enrolled = students.filter(s => s.class === cls);
      const boys = enrolled.filter(s => s.gender === 'Male').length;
      const girls = enrolled.filter(s => s.gender === 'Female').length;
      const teacher = teachers.find(t => t.assignedClass === cls);

      matches.push({
        type: 'class',
        category: 'classes',
        id: `class_${cls}`,
        title: cls,
        subtitle: `Class • ${enrolled.length} Students (${boys} Boys, ${girls} Girls)${teacher ? ` • Teacher: ${teacher.firstName} ${teacher.lastName}` : ''}`,
        item: {
          className: cls,
          studentCount: enrolled.length,
          maleCount: boys,
          femaleCount: girls,
          classTeacher: teacher
        }
      });
    });

    // 4. Search Fees / Bills (Restricted for Teachers)
    if (!isTeacher) {
      const billMatches = allBills.filter(b => {
        if (!b) return false;
        const student = studentMap.get(b.studentId);
        const studentName = student ? (getStudentFullName(student) || '').toLowerCase() : '';
        const amountDue = (b.schoolFees || 0) + (b.utilityBill || 0) + (b.sportsFees || 0) + (b.ptaDues || 0) + (b.transportationBill || 0) + (b.otherFee || 0);
        const amountPaid = b.payments ? b.payments.reduce((sum, p) => sum + p.amount, 0) : 0;
        const status = amountPaid >= amountDue ? 'fully paid' : amountPaid > 0 ? 'partially paid' : 'unpaid';
        return (
          (b.id?.toLowerCase() || '').includes(normalizedQuery) ||
          (b.studentId?.toLowerCase() || '').includes(normalizedQuery) ||
          status.includes(normalizedQuery) ||
          studentName.includes(normalizedQuery)
        );
      }).slice(0, 5);

      billMatches.forEach(bl => {
        const student = studentMap.get(bl.studentId);
        const name = student ? getStudentFullName(student) : bl.studentId;
        const amountDue = (bl.schoolFees || 0) + (bl.utilityBill || 0) + (bl.sportsFees || 0) + (bl.ptaDues || 0) + (bl.transportationBill || 0) + (bl.otherFee || 0);
        const amountPaid = bl.payments ? bl.payments.reduce((sum, p) => sum + p.amount, 0) : 0;
        const status = amountPaid >= amountDue ? 'Fully Paid' : amountPaid > 0 ? 'Partially Paid' : 'Unpaid';

        matches.push({
          type: 'bill',
          category: 'bills',
          id: `bill_${bl.id}`,
          title: `Bill #${bl.id.substring(0, 8)} - GHS ${amountDue.toFixed(2)}`,
          subtitle: `Fee Bill • Student: ${name} • Status: ${status}`,
          item: bl
        });
      });
    }

    // 5. Search Assessments
    const assessmentMatches = allAssessments.filter(a => {
      const student = studentMap.get(a.studentId);
      const studentName = student ? getStudentFullName(student).toLowerCase() : '';
      return (
        (a.subject?.toLowerCase() || '').includes(normalizedQuery) ||
        (a.gradeLevel?.toLowerCase() || '').includes(normalizedQuery) ||
        studentName.includes(normalizedQuery) ||
        (a.academicYear && a.academicYear.includes(normalizedQuery)) ||
        (a.term && a.term.toLowerCase().includes(normalizedQuery))
      );
    }).slice(0, 5);

    assessmentMatches.forEach(as => {
      const student = studentMap.get(as.studentId);
      const name = student ? getStudentFullName(student) : as.studentId;
      matches.push({
        type: 'assessment',
        category: 'assessments',
        id: `assessment_${as.id}`,
        title: `${as.subject} Grade: ${as.gradeLevel || 'N/A'}`,
        subtitle: `Assessment • Student: ${name} • Score: ${as.totalScore}% • ${as.academicYear} ${as.term}`,
        item: as
      });
    });

    // 6. Search Quick Nav
    const navMatches = NAV_ITEMS.filter(n => 
      n.label.toLowerCase().includes(normalizedQuery) ||
      n.subtitle.toLowerCase().includes(normalizedQuery)
    ).slice(0, 4);

    navMatches.forEach(nv => {
      matches.push({
        type: 'nav',
        category: 'nav',
        id: `nav_${nv.id}`,
        title: nv.label,
        subtitle: `Navigation Action • ${nv.subtitle}`,
        tabId: nv.id
      });
    });

    return matches;
  }, [query, students, teachers, allBills, allAssessments, studentMap]);

  // Filtered results according to category filter
  const filteredResults = useMemo(() => {
    if (activeCategoryFilter === 'all') return allResults;
    return allResults.filter(r => r.category === activeCategoryFilter);
  }, [allResults, activeCategoryFilter]);

  // Group items by category
  const groupedResults = useMemo(() => {
    const groups: { meta: CategoryMeta; items: SearchResult[] }[] = [];
    
    activeCategories.forEach(cat => {
      if (activeCategoryFilter !== 'all' && activeCategoryFilter !== cat.key) {
        return;
      }
      const items = allResults.filter(r => r.category === cat.key);
      if (items.length > 0) {
        groups.push({ meta: cat, items });
      }
    });

    return groups;
  }, [allResults, activeCategoryFilter]);

  // Flatten currently visible items (excluding collapsed categories) for seamless keyboard navigation
  const visibleNavigableResults = useMemo(() => {
    const list: SearchResult[] = [];
    groupedResults.forEach(group => {
      if (!collapsedCategories[group.meta.key]) {
        list.push(...group.items);
      }
    });
    return list;
  }, [groupedResults, collapsedCategories]);

  // Handle arrow key and enter key navigation
  useEffect(() => {
    setActiveResultIndex(0);
    if (visibleNavigableResults.length > 0) {
      setSelectedResult(visibleNavigableResults[0]);
    } else if (allResults.length > 0) {
      setSelectedResult(allResults[0]);
    } else {
      setSelectedResult(null);
    }
  }, [visibleNavigableResults, allResults]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (visibleNavigableResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveResultIndex(prev => {
        const next = prev + 1 >= visibleNavigableResults.length ? 0 : prev + 1;
        setSelectedResult(visibleNavigableResults[next] || null);
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveResultIndex(prev => {
        const next = prev - 1 < 0 ? visibleNavigableResults.length - 1 : prev - 1;
        setSelectedResult(visibleNavigableResults[next] || null);
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedResult) {
        handleTriggerResultAction(selectedResult);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const handleTriggerResultAction = (res: SearchResult) => {
    if (res.type === 'nav') {
      onNavigate(res.tabId);
      onClose();
    } else if (res.type === 'student') {
      onNavigate('students');
      onClose();
    } else if (res.type === 'teacher') {
      onNavigate('teachers');
      onClose();
    } else if (res.type === 'class') {
      onNavigate('students');
      onClose();
    } else if (res.type === 'bill') {
      if (!isTeacher) {
        onNavigate('fees');
      }
      onClose();
    } else if (res.type === 'assessment') {
      onNavigate('assessments');
      onClose();
    }
  };

  // Get matching badge/icon for categories
  const getIcon = (type: string) => {
    switch (type) {
      case 'student': return <User size={14} className="text-emerald-500" />;
      case 'teacher': return <UserCheck size={14} className="text-amber-500" />;
      case 'class': return <GraduationCap size={14} className="text-blue-500" />;
      case 'bill': return <Coins size={14} className="text-indigo-500" />;
      case 'assessment': return <FileSpreadsheet size={14} className="text-sky-500" />;
      default: return <Navigation size={14} className="text-purple-500" />;
    }
  };

  return (
    <div id="quick-search-modal-root" className="fixed inset-0 z-[100] overflow-y-auto no-print">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/45 backdrop-blur-md transition-opacity"
      />

      {/* Modal Box */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 12 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col h-[560px]"
        >
          {/* Header Input bar */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 bg-slate-50/50">
            <Search size={18} className="text-slate-400 shrink-0" />
            <input
              id="quick-search-input"
              ref={inputRef}
              type="text"
              placeholder="Search students, teachers, classes, grades, fee bills, or system tools..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 text-xs py-1 leading-normal"
            />
            
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono font-bold text-slate-400 bg-white border border-slate-200 rounded-md shrink-0">
              ESC
            </kbd>
            <button 
              id="quick-search-close-btn"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded-xl border border-rose-200/50 hover:border-rose-300/60 shadow-xs transition cursor-pointer text-xs font-bold font-sans select-none shrink-0"
            >
              <X size={13} className="stroke-[2.5]" />
              <span>Close</span>
            </button>
          </div>

          {/* Category Filter Pills Bar (when query is entered) */}
          {query.trim() !== '' && allResults.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2 bg-slate-50/90 border-b border-slate-100 text-[10px] overflow-x-auto gap-2">
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  id="quick-search-filter-all"
                  onClick={() => setActiveCategoryFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer flex items-center gap-1 ${
                    activeCategoryFilter === 'all'
                      ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>All Results</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${
                    activeCategoryFilter === 'all' ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {allResults.length}
                  </span>
                </button>

                {activeCategories.map(cat => {
                  const count = allResults.filter(r => r.category === cat.key).length;
                  if (count === 0) return null;
                  const isActive = activeCategoryFilter === cat.key;
                  return (
                    <button
                      key={cat.key}
                      id={`quick-search-filter-${cat.key}`}
                      onClick={() => setActiveCategoryFilter(cat.key)}
                      className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                        isActive
                          ? cat.activeColor + ' shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {cat.icon}
                      <span>{cat.shortLabel}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${
                        isActive ? 'bg-white/80 font-black' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {groupedResults.length > 1 && (
                <button
                  id="quick-search-toggle-all-collapse"
                  onClick={toggleCollapseAll}
                  className="hidden sm:flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:text-slate-800 bg-white border border-slate-200/80 rounded-lg transition shrink-0 cursor-pointer"
                  title={areAllCollapsed ? "Expand all sections" : "Collapse all sections"}
                >
                  <ChevronsUpDown size={11} className="text-slate-400" />
                  <span>{areAllCollapsed ? 'Expand All' : 'Collapse All'}</span>
                </button>
              )}
            </div>
          )}

          {/* Main Workspace split */}
          <div className="flex flex-1 overflow-hidden min-h-0 bg-white">
            {/* Results List */}
            <div 
              ref={resultsContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-3 border-r border-slate-100"
            >
              {query.trim() === '' ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                  <Search size={32} className="text-indigo-400 mb-3 opacity-60 animate-pulse" />
                  <h4 className="text-xs font-bold text-slate-700">GTM Quick-Search System</h4>
                  <p className="text-[10px] text-slate-400 max-w-sm mt-1 leading-relaxed">
                    Instantly filter student files, staff records, class tiers, financial ledgers, and academic marks.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-bold border border-emerald-200/60 font-mono">Students</span>
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[9px] font-bold border border-amber-200/60 font-mono">Teachers</span>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[9px] font-bold border border-blue-200/60 font-mono">Classes & Tiers</span>
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[9px] font-bold border border-indigo-200/60 font-mono">Fee Invoices</span>
                    <span className="px-2 py-0.5 bg-sky-50 text-sky-700 rounded text-[9px] font-bold border border-sky-200/60 font-mono">Assessments</span>
                    <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-[9px] font-bold border border-purple-200/60 font-mono">Navigation</span>
                  </div>
                </div>
              ) : allResults.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                  <AlertCircle size={24} className="text-slate-300 mb-2" />
                  <p className="text-[11px] font-bold text-slate-600">No matching registers found</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-xs">We couldn't find any results matching "{query}". Try checking your spelling or search terms.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {groupedResults.map(group => {
                    const isCollapsed = collapsedCategories[group.meta.key];
                    const categoryCount = group.items.length;

                    return (
                      <div 
                        key={group.meta.key} 
                        id={`quick-search-group-${group.meta.key}`}
                        className={`rounded-xl border ${group.meta.borderAccent} overflow-hidden bg-white shadow-2xs transition-all`}
                      >
                        {/* Collapsible Category Header */}
                        <button
                          type="button"
                          id={`quick-search-header-${group.meta.key}`}
                          onClick={() => toggleCategoryCollapse(group.meta.key)}
                          className={`w-full flex items-center justify-between px-3 py-2 text-left cursor-pointer transition select-none ${group.meta.headerBg}`}
                          title={`Click to ${isCollapsed ? 'expand' : 'collapse'} ${group.meta.label}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="p-1 rounded-md bg-white border border-slate-200/60 shadow-2xs shrink-0">
                              {group.meta.icon}
                            </div>
                            <span className="text-[11px] font-bold text-slate-800 truncate">
                              {group.meta.label}
                            </span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold border ${group.meta.badgeBg} ${group.meta.badgeText}`}>
                              {categoryCount} {categoryCount === 1 ? 'match' : 'matches'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
                            <span className="text-[9px] font-mono hidden sm:inline text-slate-400">
                              {isCollapsed ? 'Expand' : 'Collapse'}
                            </span>
                            {isCollapsed ? (
                              <ChevronRight size={14} className="text-slate-400" />
                            ) : (
                              <ChevronDown size={14} className="text-slate-400" />
                            )}
                          </div>
                        </button>

                        {/* Category Items List */}
                        {!isCollapsed ? (
                          <div className="p-1.5 space-y-1 bg-white divide-y divide-slate-50">
                            {group.items.map(res => {
                              // Find index in flattened visible navigable results
                              const visibleIndex = visibleNavigableResults.findIndex(r => r.id === res.id);
                              const isActive = visibleIndex !== -1 && visibleIndex === activeResultIndex;

                              return (
                                <div
                                  key={res.id}
                                  id={`quick-search-item-${res.id}`}
                                  onMouseEnter={() => {
                                    if (visibleIndex !== -1) {
                                      setActiveResultIndex(visibleIndex);
                                    }
                                    setSelectedResult(res);
                                  }}
                                  onClick={() => handleTriggerResultAction(res)}
                                  className={`flex items-center justify-between p-2 rounded-lg transition-all border cursor-pointer ${
                                    isActive 
                                      ? 'bg-indigo-50/80 border-indigo-200 shadow-2xs' 
                                      : 'bg-transparent border-transparent hover:bg-slate-50/80'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 text-left min-w-0">
                                    <div className={`p-1.5 rounded-md shrink-0 ${isActive ? 'bg-white border border-indigo-100' : 'bg-slate-100/70'}`}>
                                      {getIcon(res.type)}
                                    </div>
                                    <div className="min-w-0">
                                      <p className={`text-[11px] font-bold truncate ${isActive ? 'text-indigo-900' : 'text-slate-800'}`}>
                                        {res.title}
                                      </p>
                                      <p className="text-[9px] text-slate-400 truncate leading-tight mt-0.5">
                                        {res.subtitle}
                                      </p>
                                    </div>
                                  </div>

                                  {isActive && (
                                    <div className="flex items-center gap-1 shrink-0 text-indigo-600 font-mono text-[9px] font-bold bg-white px-2 py-0.5 rounded border border-indigo-100 shadow-2xs">
                                      <span>Select</span>
                                      <CornerDownLeft size={9} />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div 
                            onClick={() => toggleCategoryCollapse(group.meta.key)}
                            className="px-3 py-1.5 text-[10px] text-slate-400 italic bg-slate-50/30 cursor-pointer hover:text-slate-600 transition flex items-center justify-between"
                          >
                            <span>{categoryCount} {group.meta.shortLabel.toLowerCase()} items collapsed</span>
                            <span className="text-[9px] text-indigo-500 font-semibold font-mono not-italic">Click header to view</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Details Panel on the right */}
            <div className="hidden md:block w-80 bg-slate-50/50 p-5 overflow-y-auto">
              {selectedResult ? (
                <div>
                  {selectedResult.type === 'student' && (
                    <StudentDetailView 
                      s={selectedResult.item} 
                      allBills={allBills} 
                      allAssessments={allAssessments} 
                      onAction={() => handleTriggerResultAction(selectedResult)}
                    />
                  )}
                  {selectedResult.type === 'teacher' && (
                    <TeacherDetailView 
                      t={selectedResult.item} 
                      onAction={() => handleTriggerResultAction(selectedResult)}
                    />
                  )}
                  {selectedResult.type === 'class' && (
                    <ClassDetailView 
                      item={selectedResult.item} 
                      onAction={() => handleTriggerResultAction(selectedResult)}
                    />
                  )}
                  {selectedResult.type === 'bill' && (
                    <BillDetailView 
                      b={selectedResult.item} 
                      studentName={studentMap.get(selectedResult.item.studentId) ? `${studentMap.get(selectedResult.item.studentId)?.firstName} ${studentMap.get(selectedResult.item.studentId)?.lastName}` : selectedResult.item.studentId} 
                      onAction={() => handleTriggerResultAction(selectedResult)}
                    />
                  )}
                  {selectedResult.type === 'assessment' && (
                    <AssessmentDetailView 
                      a={selectedResult.item} 
                      studentName={studentMap.get(selectedResult.item.studentId) ? `${studentMap.get(selectedResult.item.studentId)?.firstName} ${studentMap.get(selectedResult.item.studentId)?.lastName}` : selectedResult.item.studentId} 
                      onAction={() => handleTriggerResultAction(selectedResult)}
                    />
                  )}
                  {selectedResult.type === 'nav' && (
                    <div className="space-y-4 text-slate-700 text-left">
                      <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                        <div className="w-10 h-10 rounded-full bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                          <Navigation size={18} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">{selectedResult.title}</h4>
                          <span className="text-[10px] text-slate-400">Navigation shortcut</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-normal">
                        Directly swap active workspace tab to the <strong>{selectedResult.title}</strong> module.
                      </p>
                      <button
                        id="quick-search-jump-tab-btn"
                        onClick={() => handleTriggerResultAction(selectedResult)}
                        className="w-full mt-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>Jump to Tab</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 font-sans">
                  <Info size={24} className="text-slate-300 mb-2" />
                  <p className="text-[10px] italic">Hover over or select a search result to preview dynamic details instantly.</p>
                </div>
              )}
            </div>
          </div>

          {/* Status footer with keyboard shortcuts help */}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400 font-mono font-medium">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><kbd className="px-1 bg-white border border-slate-200 rounded">↑↓</kbd> Navigate</span>
              <span className="flex items-center gap-1"><kbd className="px-1 bg-white border border-slate-200 rounded">Enter</kbd> Open / Select</span>
              <span className="flex items-center gap-1"><kbd className="px-1 bg-white border border-slate-200 rounded">Esc</kbd> Close</span>
            </div>
            <div>
              <span>Shortcut: <kbd className="px-1 bg-white border border-slate-200 rounded">Ctrl+K</kbd> / <kbd className="px-1 bg-white border border-slate-200 rounded">Cmd+K</kbd></span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
