import React, { useState, useMemo, useEffect } from 'react';
import { Student, ClassType, CLASSES, AcademicYearType, ACADEMIC_YEARS, AttendanceRecord, StudentFeeBill, TermType, TERMS, SubjectType, UserRole, ActivityLog } from '../types';
import { DbController, getStorageItem, setStorageItem } from '../db';
import { ThemeStyles } from './ThemeWrapper';
import { motion } from 'motion/react';
import { evaluateSubscription } from '../subscription';
import { 
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, Users, Calendar, Coins, Percent, Award, Landmark, AlertCircle,
  FileCheck, Download, CreditCard, ChevronRight, CheckCircle2, CircleDollarSign,
  Clock, ShieldAlert, Key, ShieldCheck, RefreshCw, SlidersHorizontal, Eye, EyeOff, LayoutGrid,
  Search, Sparkles, BookOpen, UserCheck, GraduationCap, History
} from 'lucide-react';

interface Props {
  theme: ThemeStyles;
  students: Student[];
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
    const isSimulated = payload[0].payload.isSimulated;
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
        {isSimulated && (
          <div className="text-[9px] text-amber-400 font-medium italic pt-1 border-t border-slate-800 leading-normal">
            * Projected reference projection
          </div>
        )}
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
    const isSimulated = payload[0].payload.isSimulated;
    return (
      <div className="bg-slate-900 border border-slate-800 text-slate-100 p-3.5 rounded-xl shadow-xl max-w-xs font-sans text-xs space-y-2">
        <div className="border-b border-slate-800 pb-1.5 flex justify-between items-center gap-4">
          <span className="font-bold text-[12px] text-white uppercase tracking-wide">{label}</span>
          {isSimulated && (
            <span className="bg-amber-500/25 text-amber-300 font-bold px-2 py-0.5 rounded-md font-mono text-[9px]">
              Demo Mode
            </span>
          )}
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
        {isSimulated && (
          <div className="text-[9px] text-amber-400 font-medium italic pt-1 border-t border-slate-800 leading-normal">
            * Standard curriculum average baseline
          </div>
        )}
      </div>
    );
  }
  return null;
};

export default function DashboardSummaryTab({ 
  theme, 
  students: propStudents, 
  onRefresh, 
  setActiveTab, 
  setSettingsSubTab, 
  assignedClass, 
  assignedClasses = [],
  assignedSubjects = [],
  userRole 
}: Props) {
  const students = useMemo(() => {
    if (userRole === 'Teacher') {
      const teacherClasses = [...assignedClasses];
      if (assignedClass && assignedClass !== 'None' && !teacherClasses.includes(assignedClass)) {
        teacherClasses.push(assignedClass);
      }
      
      if (teacherClasses.length === 0) return []; // No access if no assignments
      return propStudents.filter(s => teacherClasses.includes(s.class));
    }
    return propStudents;
  }, [propStudents, userRole, assignedClass, assignedClasses]);

  const teachers = useMemo(() => DbController.getTeachers(), []);
  const bills = useMemo(() => DbController.getStudentFeeBills(), []);

  // Selected period controls for deeper analytics focus
  const [selectedDashboardYear, setSelectedDashboardYear] = useState<AcademicYearType>('2026/2027');
  const [selectedDashboardTerm, setSelectedDashboardTerm] = useState<TermType>('Term 1');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => DbController.getActivityLogs());

  // Real-time synchronization polling
  useEffect(() => {
    let isSubscribed = true;
    const interval = setInterval(async () => {
      if (DbController.isFirebaseEnabled() && isSubscribed) {
        try {
          await DbController.syncAllDataFromFirebase();
          if (isSubscribed) onRefresh();
        } catch (e) {
          console.warn("Background sync error:", e);
        }
      }
    }, 60000); // Reduce frequency to 60 seconds for performance
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [onRefresh]);

  // --- WIDGET VISIBILITY CUSTOMIZATION ---
  const [widgets, setWidgets] = useState(() => {
    const defaultWidgets = {
      dailyAttendance: true,
      pendingFees: true,
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

  const [isCustomizing, setIsCustomizing] = useState(false);

  const toggleWidget = (key: keyof typeof widgets) => {
    const next = { ...widgets, [key]: !widgets[key] };
    setWidgets(next);
    setStorageItem('sms_dashboard_widgets', next);
  };

  const showAllWidgets = () => {
    const next = {
      dailyAttendance: true,
      pendingFees: true,
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
      dailyAttendance: false,
      pendingFees: false,
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
    { key: 'dailyAttendance', label: 'Daily Attendance Tracker', desc: 'Live status log of today\'s student attendance by class', category: 'Daily Operations' },
    { key: 'pendingFees', label: 'Sovereign Fees Settlement', desc: 'Donut chart showing ratio of collected versus outstanding school fees', category: 'Finance' },
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

  const attendanceRecords = useMemo(() => DbController.getAllAttendance(), []);

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
  })).filter(item => item.Total > 0 || students.length === 0); // show all if empty, otherwise filter empty classes for clean charts

  // If no students are in the database, present clean representation values
  const finalEnrollmentChartData = students.length > 0 ? enrollmentByClassData : [
    { name: 'Class 1', Male: 14, Female: 16, Total: 30 },
    { name: 'Class 2', Male: 18, Female: 12, Total: 30 },
    { name: 'Class 3', Male: 15, Female: 17, Total: 32 },
    { name: 'Class 4', Male: 11, Female: 19, Total: 30 },
    { name: 'Class 5', Male: 16, Female: 15, Total: 31 },
    { name: 'Class 6', Male: 20, Female: 14, Total: 34 }
  ];

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

  const enrollmentGrowthData = ACADEMIC_YEARS.map((yr, idx) => {
    const actualCount = yearCounts[yr] || 0;
    // Elegant base scaling for historical simulation so charts are styled with real progression
    const simulatedBase = 75 + idx * 38 + (idx % 2 === 0 ? 12 : -8);
    return {
      year: yr,
      Students: actualCount > 0 ? actualCount : Math.round(simulatedBase),
      isSimulated: actualCount === 0
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

  // Fallback fees demo metrics if empty school fees ledger
  const hasBillingData = bills.length > 0;
  
  const finalFeesChartData = hasBillingData ? classFeesChartData : [];

  const demoPaymentRatioData = [
    { name: 'Collected / Paid Fees', value: hasBillingData ? totalPaidGlobal : 0, color: '#10b981' },
    { name: 'Outstanding Balance', value: hasBillingData ? totalOutstandingGlobal : 0, color: '#ef4444' }
  ];

  // Statistics summaries
  const totalEnrolledCounter = students.length;
  const femaleEnrolledCounter = students.filter(s => s.gender === 'Female').length;
  const maleEnrolledCounter = students.filter(s => s.gender === 'Male').length;
  const boarderEnrolledCounter = students.filter(s => s.status === 'Boarder').length;
  const dayEnrolledCounter = students.filter(s => s.status === 'Day').length;

  // ACADEMIC PERFORMANCE DATA COMPUTATION
  const assessments = useMemo(() => DbController.getAssessments(), []);
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

  assessments.forEach(ass => {
    if (ass.academicYear === selectedDashboardYear) {
      const term = ass.term;
      if (termSubjectScoresMap[term]) {
        // Overall
        termSubjectScoresMap[term]['Overall'].total += ass.totalScore;
        termSubjectScoresMap[term]['Overall'].count += 1;

        // Subject specific
        if (topSubjects.includes(ass.subject)) {
          termSubjectScoresMap[term][ass.subject].total += ass.totalScore;
          termSubjectScoresMap[term][ass.subject].count += 1;
        }
      }
    }
  });

  const hasAssessments = assessments.some(ass => ass.academicYear === selectedDashboardYear);

  const performanceTrendData = TERMS.map(term => {
    const item: any = { term };
    
    // Overall
    const overallData = termSubjectScoresMap[term]['Overall'];
    item['Overall'] = overallData.count > 0 
      ? parseFloat((overallData.total / overallData.count).toFixed(1)) 
      : 0; // Fallback

    // Subjects
    topSubjects.forEach(s => {
      const sData = termSubjectScoresMap[term][s];
      item[s] = sData.count > 0
        ? parseFloat((sData.total / sData.count).toFixed(1))
        : 0; // Fallback
    });

    item.isSimulated = !hasAssessments;
    return item;
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

  // High fidelity fallback based on student count if there are no assessments logged yet
  let isUsingSimulatedGrades = false;
  if (totalGrades === 0) {
    isUsingSimulatedGrades = true;
    const studentCount = students.length || 185;
    l1Count = Math.max(1, Math.round(studentCount * 0.18)); // ~18% Highly Proficient
    l2Count = Math.max(1, Math.round(studentCount * 0.42)); // ~42% Proficient
    l3Count = Math.max(1, Math.round(studentCount * 0.22)); // ~22% Approaching
    l4Count = Math.max(1, Math.round(studentCount * 0.12)); // ~12% Developing
    l5Count = Math.max(1, Math.round(studentCount * 0.06)); // ~6% Emerging
    totalGrades = l1Count + l2Count + l3Count + l4Count + l5Count;
  }

  const gradeDistributionSimulated = [
    { name: 'Highly Proficient (L1)', value: l1Count, pct: totalGrades > 0 ? Math.round((l1Count / totalGrades) * 100) : 0, color: '#10b981' },
    { name: 'Proficient (L2)', value: l2Count, pct: totalGrades > 0 ? Math.round((l2Count / totalGrades) * 100) : 0, color: '#3b82f6' },
    { name: 'Approaching (L3)', value: l3Count, pct: totalGrades > 0 ? Math.round((l3Count / totalGrades) * 100) : 0, color: '#f59e0b' },
    { name: 'Developing (L4)', value: l4Count, pct: totalGrades > 0 ? Math.round((l4Count / totalGrades) * 100) : 0, color: '#6366f1' },
    { name: 'Emerging (L5)', value: l5Count, pct: totalGrades > 0 ? Math.round((l5Count / totalGrades) * 100) : 0, color: '#ef4444' },
  ];

  const currentUser = useMemo(() => DbController.getCurrentUser(), []);
  const subStatus = currentUser ? evaluateSubscription(currentUser) : null;

  // --- TEACHER SPECIFIC COMPUTATIONS & DATA PIPELINE ---
  const teacherProfile = useMemo(() => {
    if (!currentUser || currentUser.role !== 'Teacher') return null;
    const userEmail = currentUser.email?.toLowerCase().trim();
    if (!userEmail) return null;
    return teachers.find(
      t => t.email?.toLowerCase().trim() === userEmail
    );
  }, [currentUser, teachers]);

  const teacherName = teacherProfile ? `${teacherProfile.title || 'Mr/Mrs'} ${teacherProfile.name}` : 'Educator';

  // Filtered Assessments for their class
  const classAssessments = useMemo(() => {
    const allAssessments = DbController.getAssessments();
    if (userRole === 'Teacher' && assignedClass) {
      const studentIdsInClass = new Set(students.map(s => s.id));
      return allAssessments.filter(ass => studentIdsInClass.has(ass.studentId));
    }
    return allAssessments;
  }, [students, userRole, assignedClass]);

  // Subject Averages for their class
  const subjectAverages = useMemo(() => {
    const subjectMap: Record<string, { total: number; count: number }> = {};
    classAssessments.forEach(ass => {
      if (!subjectMap[ass.subject]) {
        subjectMap[ass.subject] = { total: 0, count: 0 };
      }
      subjectMap[ass.subject].total += ass.totalScore;
      subjectMap[ass.subject].count += 1;
    });

    const entries = Object.entries(subjectMap).map(([subject, data]) => ({
      subject,
      average: parseFloat((data.total / data.count).toFixed(1)),
      count: data.count
    })).sort((a, b) => b.average - a.average);

    if (entries.length === 0) {
      // High fidelity realistic fallbacks for class subject averages
      return [
        { subject: 'English Language', average: 81.2, count: 12 },
        { subject: 'Mathematics', average: 74.5, count: 12 },
        { subject: 'Integrated Science', average: 78.4, count: 12 },
        { subject: 'Social Studies', average: 85.1, count: 10 },
        { subject: 'ICT', average: 92.3, count: 8 },
      ];
    }
    return entries;
  }, [classAssessments]);

  // Class Academic Average
  const classAcademicAverage = useMemo(() => {
    if (classAssessments.length === 0) return 82.4;
    const total = classAssessments.reduce((sum, ass) => sum + ass.totalScore, 0);
    return parseFloat((total / classAssessments.length).toFixed(1));
  }, [classAssessments]);

  // Learning Level Counts specifically for their class
  const classGradeLevels = useMemo(() => {
    let l1 = 0, l2 = 0, l3 = 0, l4 = 0, l5 = 0;
    classAssessments.forEach(ass => {
      if (ass.gradeLevel === 'L1') l1++;
      else if (ass.gradeLevel === 'L2') l2++;
      else if (ass.gradeLevel === 'L3') l3++;
      else if (ass.gradeLevel === 'L4') l4++;
      else if (ass.gradeLevel === 'L5') l5++;
    });

    const total = l1 + l2 + l3 + l4 + l5;
    if (total === 0) {
      const size = students.length || 30;
      return [
        { name: 'Highly Proficient (L1)', value: Math.max(1, Math.round(size * 0.2)), pct: 20, color: '#10b981' },
        { name: 'Proficient (L2)', value: Math.max(1, Math.round(size * 0.45)), pct: 45, color: '#3b82f6' },
        { name: 'Approaching (L3)', value: Math.max(1, Math.round(size * 0.2)), pct: 20, color: '#f59e0b' },
        { name: 'Developing (L4)', value: Math.max(1, Math.round(size * 0.1)), pct: 10, color: '#6366f1' },
        { name: 'Emerging (L5)', value: Math.max(0, Math.round(size * 0.05)), pct: 5, color: '#ef4444' },
      ];
    }

    return [
      { name: 'Highly Proficient (L1)', value: l1, pct: Math.round((l1 / total) * 100), color: '#10b981' },
      { name: 'Proficient (L2)', value: l2, pct: Math.round((l2 / total) * 100), color: '#3b82f6' },
      { name: 'Approaching (L3)', value: l3, pct: Math.round((l3 / total) * 100), color: '#f59e0b' },
      { name: 'Developing (L4)', value: l4, pct: Math.round((l4 / total) * 100), color: '#6366f1' },
      { name: 'Emerging (L5)', value: l5, pct: Math.round((l5 / total) * 100), color: '#ef4444' },
    ];
  }, [classAssessments, students]);

  // Individual student attendance averages
  const studentAttendanceAverages = useMemo(() => {
    const averages: Record<string, { present: number; total: number }> = {};
    attendanceRecords.forEach(r => {
      if (!averages[r.studentId]) {
        averages[r.studentId] = { present: 0, total: 0 };
      }
      if (r.status === 'Present') {
        averages[r.studentId].present++;
      }
      if (r.status === 'Present' || r.status === 'Absent') {
        averages[r.studentId].total++;
      }
    });
    return averages;
  }, [attendanceRecords]);

  // Class Recent Attendance
  const classRecentAttendance = useMemo(() => {
    const dateMap: Record<string, { present: number; absent: number }> = {};
    attendanceRecords.forEach(r => {
      if (r.class === assignedClass) {
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
    return students.filter(s => 
      s.firstName.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
      s.lastName.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
      (s.otherNames && s.otherNames.toLowerCase().includes(studentSearchQuery.toLowerCase()))
    );
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
              subStatus.isTrial 
                ? 'bg-amber-50/70 border-amber-200 text-amber-900' 
                : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
            } flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs no-print`}
          >
            <div className="flex items-start gap-3.5">
              <div className={`p-2.5 rounded-xl shrink-0 flex items-center justify-center ${
                subStatus.isTrial 
                  ? 'bg-amber-100 text-amber-700' 
                  : 'bg-emerald-100 text-emerald-700'
              }`}>
                {subStatus.isTrial ? <Clock size={20} className="animate-pulse" /> : <ShieldCheck size={20} />}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black uppercase tracking-wider font-mono">
                    {subStatus.licenseType === 'trial' ? 'System Trial Mode' : 'Annual School License'}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-extrabold uppercase font-mono ${
                    subStatus.isTrial 
                      ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}>
                    {subStatus.remainingDays} Days Remaining
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
                    subStatus.isTrial 
                      ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <Key size={13} />
                  {subStatus.isTrial ? 'Renew License' : 'Manage License'}
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
                    <Sparkles size={11} className="animate-pulse" />
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
                              <span className="text-[9.5px] font-mono text-slate-400">ID: {student.studentId}</span>
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

  return (
    <div className="space-y-6">
      
      {/* SUBSCRIPTION STATUS LEVEL */}
      {subStatus && (
        <motion.div 
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl border ${
            subStatus.isTrial 
              ? 'bg-amber-50/70 border-amber-200 text-amber-900' 
              : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
          } flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs no-print`}
        >
          <div className="flex items-start gap-3.5">
            <div className={`p-2.5 rounded-xl shrink-0 flex items-center justify-center ${
              subStatus.isTrial 
                ? 'bg-amber-100 text-amber-700' 
                : 'bg-emerald-100 text-emerald-700'
            }`}>
              {subStatus.isTrial ? <Clock size={20} className="animate-pulse" /> : <ShieldCheck size={20} />}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider font-mono">
                  {subStatus.licenseType === 'trial' ? 'System Trial Mode' : 'Annual School License'}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-extrabold uppercase font-mono ${
                  subStatus.isTrial 
                    ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}>
                  {subStatus.remainingDays} Days Remaining
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
                  subStatus.isTrial 
                    ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                <Key size={13} />
                {subStatus.isTrial ? 'Renew License' : 'Manage License'}
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
            Active: {Object.values(widgets).filter(Boolean).length} of 8
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
                {totalEnrolledCounter || 185}
              </span>
              {!totalEnrolledCounter && (
                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 py-0.5 rounded border border-amber-100 font-mono">Simulated</span>
              )}
            </div>
            <div className="text-[9.5px] text-slate-500 font-medium">
              Male: <strong className="text-slate-700">{totalEnrolledCounter ? maleEnrolledCounter : 95}</strong> • Female: <strong className="text-slate-700">{totalEnrolledCounter ? femaleEnrolledCounter : 90}</strong>
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
                {teachers.length || 14}
              </span>
              {!teachers.length && (
                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 py-0.5 rounded border border-amber-100 font-mono">Simulated</span>
              )}
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
              {attendanceRecords.length === 0 && (
                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 py-0.5 rounded border border-amber-100 font-mono">Standard</span>
              )}
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
                {hasBillingData ? `${collectionRate}%` : "84.1%"}
              </span>
              {!hasBillingData && (
                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 py-0.5 rounded border border-amber-100 font-mono">Mock</span>
              )}
            </div>
            <div className="text-[9.5px] text-slate-500 font-medium truncate">
              Paid: <strong className="text-slate-700">GH¢{hasBillingData ? totalPaidGlobal.toLocaleString() : "25,000"}</strong>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Coins size={20} />
          </div>
        </motion.div>

      </div>

      {/* WARNING NOTIFICATION AREA */}
      {!totalEnrolledCounter && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 text-slate-700 text-xs no-print shadow-2xs">
          <AlertCircle className="text-amber-600 mt-0.5 flex-shrink-0" size={16} />
          <div className="space-y-1">
            <h5 className="font-bold text-slate-900">Demonstration Context Active:</h5>
            <p className="text-slate-600 leading-normal">
              No students or fee bills have been logged in the system yet. The statistics dashboard below presents structured demonstration data based on school averages. Once you populate students, mark daily attendance, and publish school fee invoices, this dashboard will update automatically with live metrics.
            </p>
          </div>
        </div>
      )}

      {/* ROW 1: TODAY'S OVERVIEW, STATUS & SUMMARY WIDGETS (3 columns grid) */}
      {(widgets.dailyAttendance || widgets.pendingFees || widgets.gradeDistribution) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Today's Class Attendance Summary Widget */}
          {widgets.dailyAttendance && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between h-[360px]">
              <div className="space-y-3">
                <div className="flex justify-between items-start pb-2 border-b border-slate-100">
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <FileCheck className="text-blue-600" size={16} />
                      Daily Attendance Tracker
                    </h4>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Live status log of student attendance</p>
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
          )}
          
          {/* Global fee settlement ratio visual donut */}
          {widgets.pendingFees && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between h-[360px]">
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Coins className="text-indigo-600" size={16} />
                      Sovereign Fees Settlement
                    </h4>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Ratio of settled school bills globally</p>
                  </div>
                </div>

                <div className="h-40 relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie
                        data={demoPaymentRatioData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {demoPaymentRatioData.map((entry, index) => (
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
                      {hasBillingData ? `${collectionRate}%` : "84.1%"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 font-sans text-left text-xs">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 block" /> Paid / Collected:
                  </span>
                  <strong className="text-slate-800 font-mono">
                    GH¢{hasBillingData ? totalPaidGlobal.toLocaleString() : "25,000"}
                  </strong>
                </div>
                
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 block" /> Remaining Debt:
                  </span>
                  <strong className="text-rose-600 font-mono">
                    GH¢{hasBillingData ? totalOutstandingGlobal.toLocaleString() : "4,700"}
                  </strong>
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-slate-500 font-semibold">Total Invoice Value:</span>
                  <strong className="text-slate-800 font-mono">
                    GH¢{hasBillingData ? totalBilledGlobal.toLocaleString() : "29,700"}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* Grade Level Distribution Summary Card */}
          {widgets.gradeDistribution && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between h-[360px] md:col-span-2 lg:col-span-1">
              <div className="space-y-3">
                <div className="pb-2 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Award className="text-indigo-600" size={16} />
                      Grade Distribution
                    </h4>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">GES Curriculum Grading Level Mix</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {isUsingSimulatedGrades ? (
                      <span className="text-[8.5px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-mono uppercase">Simulated</span>
                    ) : (
                      <span className="text-[8.5px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-mono uppercase">Live Roster</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5 pt-0.5">
                  {gradeDistributionSimulated.map((g, index) => (
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
              </div>

              <div className="text-[9px] text-slate-400 font-medium text-center italic">
                Computed based on total verified learning assessments
              </div>
            </div>
          )}

        </div>
      )}

      {/* ROW 2: DEMOGRAPHICS & SCHOOL GROWTH TRENDS */}
      {(widgets.enrollmentBreakdown || widgets.growthHistory) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Class Enrollment breakdown chart (Bar) */}
          {widgets.enrollmentBreakdown && (
            <div className={`bg-white p-6 rounded-2xl border border-slate-200 shadow-sm ${widgets.growthHistory ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-4`}>
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="text-blue-600" size={16} />
                    Student Enrollment Breakdown by Class
                  </h4>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Segmented counts of male vs female active enrollments</p>
                </div>
              </div>

              <div className="pt-2">
                <ResponsiveContainer width="100%" height={260}>
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
            </div>
          )}

          {/* Growth line chart over time */}
          {widgets.growthHistory && (
            <div className={`bg-white p-6 rounded-2xl border border-slate-200 shadow-sm ${widgets.enrollmentBreakdown ? 'lg:col-span-1' : 'lg:col-span-3'} space-y-4`}>
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="text-indigo-600" size={16} />
                    Historical Enrollment Growth
                  </h4>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Progression trend across academic seasons</p>
                </div>
              </div>

              <div className="pt-2">
                <ResponsiveContainer width="100%" height={260}>
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
            </div>
          )}

        </div>
      )}

      {/* ROW 3: ACADEMIC ACHIEVEMENTS & ATTENDANCE PERFORMANCE */}
      {(widgets.performanceTrends || widgets.attendanceStanding) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Academic Performance Trends Line Chart */}
          {widgets.performanceTrends && (
            <div className={`bg-white p-6 rounded-2xl border border-slate-200 shadow-sm ${widgets.attendanceStanding ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-4`}>
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="text-blue-600" style={{ color: themeHex }} size={16} />
                    Performance Trends Across Terms
                  </h4>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Average academic achievements grouped by school terms</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {!hasAssessments && (
                    <span className="text-[9.5px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 font-mono uppercase tracking-wider">Demo Data Active</span>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={performanceTrendData} margin={{ top: 10, right: 15, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
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
              </div>
            </div>
          )}

          {/* Class-by-Class Attendance Analysis Chart */}
          {widgets.attendanceStanding && (
            <div className={`bg-white p-6 rounded-2xl border border-slate-200 shadow-sm ${widgets.performanceTrends ? 'lg:col-span-1' : 'lg:col-span-3'} space-y-4`}>
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

              <div className="pt-2">
                <ResponsiveContainer width="100%" height={260}>
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
              </div>
            </div>
          )}

        </div>
      )}

      {/* ROW 4: FINANCIAL BILLINGS & BALANCES (Full Width) */}
      {widgets.feesBreakdown && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <CircleDollarSign className="text-indigo-600" size={16} />
                Term Fees Payment Status Breakdown by Class (GH¢)
              </h4>
              <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Comparing invoice totals, collected payments, and remaining balances per class</p>
            </div>
          </div>

          <div>
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
          </div>
        </div>
      )}

      {/* ACTIVITY LOGS WIDGET (Administrative Only) */}
      {widgets.activityLogs && (userRole === 'Headteacher' || userRole === 'Admin') && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <History className="text-indigo-600" size={16} />
                Recent Administrative & Teacher Activities
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
      )}

      {/* ASSESSMENT TASKS WIDGET (Administrative Only) */}
      {widgets.assessmentTasks && (userRole === 'Headteacher' || userRole === 'Admin') && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CLASSES.map(cls => {
              // Find teacher for this class
              const teacher = teachers.find(t => t.assignedClass === cls);
              // Find students in this class
              const classStudents = students.filter(s => s.class === cls);
              if (classStudents.length === 0) return null;
              
              // Find assessments for this class in current term/year
              const classStudentIds = new Set(classStudents.map(s => s.id));
              const classAssessments = assessments.filter(a => 
                classStudentIds.has(a.studentId) && 
                a.term === selectedDashboardTerm && 
                a.academicYear === selectedDashboardYear
              );
              
              // Define subjects expected
              const expectedSubjects = 4; // Typical required core subjects
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
                        {teacher ? `${teacher.firstName} ${teacher.lastName}` : 'No Assigned Teacher'}
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
        </div>
      )}

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

    </div>
  );
}
