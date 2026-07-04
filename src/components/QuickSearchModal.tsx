import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Search, X, User, UserCheck, Coins, FileSpreadsheet, 
  Navigation, CornerDownLeft, FileText, CheckCircle, XCircle, 
  AlertCircle, Calendar, ArrowRight, Info, ShieldAlert, BookOpen
} from 'lucide-react';
import { Student, Teacher, StudentFeeBill, StudentAssessment } from '../types';
import { DbController } from '../db';

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  teachers: Teacher[];
  theme: any;
  onNavigate: (tabId: string) => void;
}

type SearchResult = 
  | { type: 'student'; id: string; title: string; subtitle: string; item: Student }
  | { type: 'teacher'; id: string; title: string; subtitle: string; item: Teacher }
  | { type: 'bill'; id: string; title: string; subtitle: string; item: StudentFeeBill }
  | { type: 'assessment'; id: string; title: string; subtitle: string; item: StudentAssessment }
  | { type: 'nav'; id: string; title: string; subtitle: string; tabId: string };

const getStudentFullName = (s: Student) => {
  return `${s.firstName} ${s.middleName ? s.middleName + ' ' : ''}${s.lastName}`.trim();
};

const getTeacherFullName = (t: Teacher) => {
  return `${t.firstName} ${t.middleName ? t.middleName + ' ' : ''}${t.lastName}`.trim();
};

// --- Sub-components for detail views to avoid hook issues in useMemo ---
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
        onClick={onAction}
        className="w-full mt-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
      >
        <span>Open Staff Profile</span>
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
  onNavigate
}: QuickSearchModalProps) {
  const [query, setQuery] = useState('');
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Load fee bills and assessments dynamically for searching
  const allBills = useMemo(() => {
    if (!isOpen) return [];
    try {
      return DbController.getStudentFeeBills();
    } catch {
      return [];
    }
  }, [isOpen]);

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
    { label: 'School Fees Ledger', id: 'fees', subtitle: 'Invoices, fee collections and status' },
    { label: 'Paystack Ledger', id: 'paystack', subtitle: 'Online card payment gateway logs' },
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
    }
  }, [isOpen]);

  // Compute search results across indices
  const results = useMemo<SearchResult[]>(() => {
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
    }).slice(0, 5);

    studentMatches.forEach(st => {
      matches.push({
        type: 'student',
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
    }).slice(0, 4);

    teacherMatches.forEach(tc => {
      matches.push({
        type: 'teacher',
        id: `teacher_${tc.id}`,
        title: getTeacherFullName(tc),
        subtitle: `Teacher • ID: ${tc.id} • Assigned: ${tc.assignedClass || 'None'} • Rank: ${tc.rank}`,
        item: tc
      });
    });

    // 3. Search Fees / Bills
    const billMatches = allBills.filter(b => {
      if (!b) return false;
      const student = studentMap.get(b.studentId);
      const studentName = student ? (getStudentFullName(student) || '').toLowerCase() : '';
      return (
        (b.id?.toLowerCase() || '').includes(normalizedQuery) ||
        (b.studentId?.toLowerCase() || '').includes(normalizedQuery) ||
        (b.status?.toLowerCase() || '').includes(normalizedQuery) ||
        studentName.includes(normalizedQuery)
      );
    }).slice(0, 4);

    billMatches.forEach(bl => {
      const student = studentMap.get(bl.studentId);
      const name = student ? getStudentFullName(student) : bl.studentId;
      const amountDue = (bl.schoolFees || 0) + (bl.utilityBill || 0) + (bl.sportsFees || 0) + (bl.ptaDues || 0) + (bl.transportationBill || 0) + (bl.otherFee || 0);
      const amountPaid = bl.payments ? bl.payments.reduce((sum, p) => sum + p.amount, 0) : 0;
      const status = amountPaid >= amountDue ? 'Fully Paid' : amountPaid > 0 ? 'Partially Paid' : 'Unpaid';

      matches.push({
        type: 'bill',
        id: `bill_${bl.id}`,
        title: `Bill #${bl.id.substring(0, 8)} - GHS ${amountDue.toFixed(2)}`,
        subtitle: `Fee Bill • Student: ${name} • Status: ${status}`,
        item: bl
      });
    });

    // 4. Search Assessments
    const assessmentMatches = allAssessments.filter(a => {
      const student = studentMap.get(a.studentId);
      const studentName = student ? getStudentFullName(student).toLowerCase() : '';
      return (
        (a.subject?.toLowerCase() || '').includes(normalizedQuery) ||
        (a.gradeLevel?.toLowerCase() || '').includes(normalizedQuery) ||
        studentName.includes(normalizedQuery) ||
        a.academicYear.includes(normalizedQuery) ||
        a.term.toLowerCase().includes(normalizedQuery)
      );
    }).slice(0, 4);

    assessmentMatches.forEach(as => {
      const student = studentMap.get(as.studentId);
      const name = student ? getStudentFullName(student) : as.studentId;
      matches.push({
        type: 'assessment',
        id: `assessment_${as.id}`,
        title: `${as.subject} Grade: ${as.gradeLevel || 'N/A'}`,
        subtitle: `Assessment • Student: ${name} • Score: ${as.totalScore}% • ${as.academicYear} ${as.term}`,
        item: as
      });
    });

    // 5. Search Quick Nav
    const navMatches = NAV_ITEMS.filter(n => 
      n.label.toLowerCase().includes(normalizedQuery) ||
      n.subtitle.toLowerCase().includes(normalizedQuery)
    ).slice(0, 3);

    navMatches.forEach(nv => {
      matches.push({
        type: 'nav',
        id: `nav_${nv.id}`,
        title: nv.label,
        subtitle: `Navigation Action • ${nv.subtitle}`,
        tabId: nv.id
      });
    });

    return matches;
  }, [query, students, teachers, allBills, allAssessments, studentMap]);

  // Handle arrow key and enter key navigation
  useEffect(() => {
    setActiveResultIndex(0);
    if (results.length > 0) {
      setSelectedResult(results[0]);
    } else {
      setSelectedResult(null);
    }
  }, [results]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveResultIndex(prev => {
        const next = prev + 1 >= results.length ? 0 : prev + 1;
        setSelectedResult(results[next] || null);
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveResultIndex(prev => {
        const next = prev - 1 < 0 ? results.length - 1 : prev - 1;
        setSelectedResult(results[next] || null);
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
    } else if (res.type === 'bill') {
      onNavigate('fees');
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
      case 'bill': return <Coins size={14} className="text-indigo-500" />;
      case 'assessment': return <FileSpreadsheet size={14} className="text-sky-500" />;
      default: return <Navigation size={14} className="text-purple-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto no-print">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
      />

      {/* Modal Box */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[520px]"
        >
              {/* Header Input bar */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 bg-slate-50/50">
                <Search size={18} className="text-slate-400 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Type anything to search students, teachers, grades, fees, or system tools..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 text-xs py-1 leading-normal"
                />
                
                <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono font-bold text-slate-400 bg-white border border-slate-200 rounded-md shrink-0">
                  ESC
                </kbd>
                <button 
                  onClick={onClose}
                  className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Main Workspace split */}
              <div className="flex flex-1 overflow-hidden min-h-0 bg-white">
                {/* Results List */}
                <div 
                  ref={resultsContainerRef}
                  className="flex-1 overflow-y-auto p-4 space-y-2 border-r border-slate-100"
                >
                  {query.trim() === '' ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                      <Search size={32} className="text-indigo-400 mb-3 opacity-60 animate-pulse" />
                      <h4 className="text-xs font-bold text-slate-700">GTM Quick-Search System</h4>
                      <p className="text-[10px] text-slate-400 max-w-sm mt-1 leading-relaxed">
                        Instantly filter registers, query financial ledgers, or jump straight to any section across the school portal.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2 justify-center">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-bold border border-slate-200 font-mono">Student names/IDs</span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-bold border border-slate-200 font-mono">Teachers</span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-bold border border-slate-200 font-mono">Grades & Subjects</span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-bold border border-slate-200 font-mono">Fee ledger</span>
                      </div>
                    </div>
                  ) : results.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                      <AlertCircle size={24} className="text-slate-300 mb-2" />
                      <p className="text-[11px] font-bold text-slate-600">No matching registers found</p>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-xs">We couldn't find any results matching "{query}". Try checking your spelling or search parameters.</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono mb-2">Search Results ({results.length})</span>
                      {results.map((res, index) => {
                        const isActive = index === activeResultIndex;
                        return (
                          <div
                            key={res.id}
                            onMouseEnter={() => {
                              setActiveResultIndex(index);
                              setSelectedResult(res);
                            }}
                            onClick={() => handleTriggerResultAction(res)}
                            className={`flex items-center justify-between p-2.5 rounded-xl transition-all border cursor-pointer ${
                              isActive 
                                ? 'bg-indigo-50/70 border-indigo-100 shadow-xs' 
                                : 'bg-transparent border-transparent hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-3 text-left min-w-0">
                              <div className={`p-2 rounded-lg shrink-0 ${isActive ? 'bg-white border border-indigo-100/50' : 'bg-slate-100/70'}`}>
                                {getIcon(res.type)}
                              </div>
                              <div className="min-w-0">
                                <p className={`text-[11px] font-bold truncate ${isActive ? 'text-indigo-800' : 'text-slate-700'}`}>
                                  {res.title}
                                </p>
                                <p className="text-[9px] text-slate-400 truncate leading-none mt-1">
                                  {res.subtitle}
                                </p>
                              </div>
                            </div>

                            {isActive && (
                              <div className="flex items-center gap-1 shrink-0 text-indigo-500 font-mono text-[9px] font-bold">
                                <span>Select</span>
                                <CornerDownLeft size={10} />
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
