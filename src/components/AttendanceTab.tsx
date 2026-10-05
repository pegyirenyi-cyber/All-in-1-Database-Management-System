import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AttendanceRecord, ClassType, CLASSES, AttendanceStatus, StaffAttendanceRecord, StaffAttendanceStatus, UserRole, SubjectType } from '../types';
import { DbController, getStorageItem, setStorageItem } from '../db';
import { ThemeStyles } from './ThemeWrapper';
import { CalendarCheck, Users, ToggleLeft, ToggleRight, CheckSquare, Coffee, ClipboardList, CalendarDays, Printer, FileDown, ShieldAlert, Trash2, RotateCcw, Eraser, Eye, Clock, LogIn, LogOut, MessageSquare, Briefcase, ChevronLeft, ChevronRight, Activity, QrCode } from 'lucide-react';
import { DefaultCrest } from './SchoolProfileTab';
import GoogleDriveExportControl from './GoogleDriveExportControl';
import { generatePdfFromHtml, downloadBlobLocally } from '../pdfHelper';
import { getWatermarkHtml, formatIdentifiableFilename } from '../utils';
import AttendanceSummaryView from './AttendanceSummaryView';
import StudentQRScanner from './StudentQRScanner';
import { evaluateSubscription } from '../subscription';

const GHANA_CREST_SVG_SIMPLE = `
<svg viewBox="0 0 100 100" width="100%" height="100%" style="width: 250px; height: 250px; color: #000;">
  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 1.5" />
  <circle cx="50" cy="50" r="41" fill="none" stroke="currentColor" stroke-width="0.6" />
  <path d="M 32,32 L 68,32 C 68,32 68,58 50,74 C 32,58 32,32 32,32 Z" fill="none" stroke="currentColor" stroke-width="1.2" />
  <path d="M 50,32 L 50,74" stroke="currentColor" stroke-width="0.6" />
  <path d="M 32,50 L 68,50" stroke="currentColor" stroke-width="0.6" />
  <polygon points="50,45 52,49 57,49 53,52 55,56 50,54 45,56 47,52 43,49 48,49" fill="currentColor" opacity="0.6" />
  <path d="M 53,36 L 65,36 L 65,46 L 53,46 Z" fill="none" stroke="currentColor" stroke-width="0.6" />
  <path d="M 53,41 L 65,41" stroke="currentColor" stroke-width="0.4" />
  <line x1="41" y1="36" x2="41" y2="46" stroke="currentColor" stroke-width="1.2" />
  <circle cx="41" cy="35" r="1.2" fill="currentColor" />
  <path d="M 23,35 C 19,48 19,63 34,74" fill="none" stroke="currentColor" stroke-width="0.6" />
  <path d="M 77,35 C 81,48 81,63 66,74" fill="none" stroke="currentColor" stroke-width="0.6" />
  <path d="M 25,79 L 75,79 C 75,79 65,85 50,85 C 35,85 25,79 25,79 Z" fill="none" stroke="currentColor" stroke-width="0.6" />
</svg>
`;

interface TeacherMonthlyStats {
  teacherId: string;
  teacherName: string;
  totalDays: number;
  presentDays: number;
  leaveDays: number;
  absentDays: number;
  ratio: number;
  avgArrivalTime: string;
}

const getMonthName = (m: string): string => {
  const months: Record<string, string> = {
    '01': 'January', '02': 'February', '03': 'March', '04': 'April',
    '05': 'May', '06': 'June', '07': 'July', '08': 'August',
    '09': 'September', '10': 'October', '11': 'November', '12': 'December'
  };
  return months[m] || 'Month ' + m;
};

interface Props {
  theme: ThemeStyles;
  isAutoSave: boolean;
  onManualSave: () => void;
  assignedClass?: ClassType | 'None';
  assignedClasses?: ClassType[];
  assignedSubjects?: SubjectType[];
  userRole?: UserRole;
  teacherPermissions?: {
    canEditGrades?: boolean;
    canApproveAttendance?: boolean;
    canExportReports?: boolean;
  } | null;
}

export default function AttendanceTab({ 
  theme, 
  isAutoSave, 
  onManualSave, 
  assignedClass, 
  assignedClasses = [],
  assignedSubjects = [],
  userRole, 
  teacherPermissions 
}: Props) {
  const schoolInfo = DbController.getSchoolInfo();
  const currentUser = DbController.getCurrentUser();
  const subscriptionStatus = currentUser ? evaluateSubscription(currentUser) : null;
  const isSubscriptionLocked = subscriptionStatus?.isLocked || false;
  const [printBlocked, setPrintBlocked] = useState(false);
  const [showPdfGuide, setShowPdfGuide] = useState(false);
  const [generatingMonthlyPdf, setGeneratingMonthlyPdf] = useState(false);

  const handlePrintMonthlyRoster = async () => {
    const studentsInClass = DbController.getStudents().filter(s => s.class === selectedClass);
    if (studentsInClass.length === 0) {
      alert(`There are no students enrolled in ${selectedClass} to print a roster.`);
      return;
    }
    if (visibleDates.length === 0) {
      alert("No active school days fall in the selected academic term date range for this month. Please adjust 'Term Start' and 'Term End' dates above.");
      return;
    }
    
    if (generatingMonthlyPdf) return;
    setGeneratingMonthlyPdf(true);
    try {
      const monthName = getMonthName(reportMonth);
      const filename = formatIdentifiableFilename({
        docType: 'Student Monthly Roster',
        className: selectedClass,
        term: `${monthName}_${reportYear}`,
        extension: 'pdf'
      });
      const result = await generatePdfFromHtml('student-monthly-roster-printable', filename, true);
      downloadBlobLocally(result.blob, result.filename);
    } catch (e) {
      console.error(e);
      alert("Could not generate Monthly Student Roster PDF: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGeneratingMonthlyPdf(false);
    }
  };

  const handlePrintRegister = () => {
    try {
      window.print();
    } catch (e) {
      console.warn("Direct print restricted inside sandbox iframe:", e);
      setPrintBlocked(true);
    }
  };

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // Default to current system date (2026-06-12 as per context)
    return '2026-06-12';
  });

  const [autoCloudSync, setAutoCloudSync] = useState<boolean>(() => {
    return getStorageItem('sms_auto_cloud_sync_attendance', true);
  });

  useEffect(() => {
    setStorageItem('sms_auto_cloud_sync_attendance', autoCloudSync);
  }, [autoCloudSync]);

  const [termStartDate, setTermStartDate] = useState<string>(() => {
    return getStorageItem('sms_term_start_date', '2026-05-20');
  });
  const [termEndDate, setTermEndDate] = useState<string>(() => {
    return getStorageItem('sms_term_end_date', '2026-07-04');
  });

  useEffect(() => {
    setStorageItem('sms_term_start_date', termStartDate);
  }, [termStartDate]);

  useEffect(() => {
    setStorageItem('sms_term_end_date', termEndDate);
  }, [termEndDate]);

  const allRangeDates = useMemo(() => {
    const dates: { dateStr: string; dayNum: string; dayName: string; monthKey: string; monthName: string; isWeekend: boolean }[] = [];
    const start = new Date(termStartDate);
    const end = new Date(termEndDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return [];
    }
    
    const current = new Date(start);
    // Limit to reasonable duration (e.g. 1 year max to prevent crashes)
    let limit = 0;
    while (current <= end && limit < 400) {
      limit++;
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const dayName = current.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = String(current.getDate());
      const monthKey = `${year}-${month}`;
      const monthName = current.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const isWeekend = current.getDay() === 0 || current.getDay() === 6;
      
      dates.push({
        dateStr,
        dayNum,
        dayName,
        monthKey,
        monthName,
        isWeekend
      });
      
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }, [termStartDate, termEndDate]);

  const uniqueMonths = useMemo(() => {
    const monthsMap = new Map<string, string>();
    allRangeDates.forEach(d => {
      monthsMap.set(d.monthKey, d.monthName);
    });
    return Array.from(monthsMap.entries()).map(([monthKey, monthName]) => ({
      monthKey,
      monthName
    }));
  }, [allRangeDates]);

  const [activeMonthTab, setActiveMonthTab] = useState<string>('');

  // Sync activeMonthTab to selectedDate's month if it changes
  useEffect(() => {
    if (selectedDate) {
      const parts = selectedDate.split('-');
      if (parts[0] && parts[1]) {
        setActiveMonthTab(`${parts[0]}-${parts[1]}`);
      }
    }
  }, [selectedDate]);

  // Adjust selectedDate if it falls outside the active range
  useEffect(() => {
    if (allRangeDates.length > 0) {
      const isWithinRange = allRangeDates.some(d => d.dateStr === selectedDate);
      if (!isWithinRange) {
        setSelectedDate(allRangeDates[0].dateStr);
      }
    }
  }, [allRangeDates, selectedDate]);

  const visibleDates = useMemo(() => {
    return allRangeDates.filter(d => d.monthKey === activeMonthTab);
  }, [allRangeDates, activeMonthTab]);
  const [selectedClass, setSelectedClass] = useState<ClassType>(() => {
    if (userRole === 'Teacher') {
      const fallback = (assignedClass && assignedClass !== 'None') ? assignedClass : 'Basic 1';
      return assignedClasses.length > 0 ? assignedClasses[0] : fallback;
    }
    return 'Basic 1';
  });

  // Custom Confirmation Dialog State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    if (userRole === 'Teacher') {
      const target = assignedClasses.length > 0 ? assignedClasses[0] : (assignedClass || 'None');
      if (target !== 'None') {
        setSelectedClass(target as ClassType);
      }
    }
  }, [assignedClass, assignedClasses, userRole]);
  const [attendanceView, setAttendanceView] = useState<'student' | 'staff' | 'roster' | 'summary'>('student');
  const [attendanceSheet, setAttendanceSheet] = useState<AttendanceRecord[]>([]);
  const [staffAttendanceSheet, setStaffAttendanceSheet] = useState<StaffAttendanceRecord[]>([]);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [showQRScanner, setShowQRScanner] = useState<boolean>(false);
  const [showMonthlyReportMode, setShowMonthlyReportMode] = useState<boolean>(false);
  const [reportMonth, setReportMonth] = useState<string>('06');
  const [reportYear, setReportYear] = useState<string>('2026');

  // Sync reportMonth and reportYear when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      const parts = selectedDate.split('-');
      if (parts[0]) setReportYear(parts[0]);
      if (parts[1]) setReportMonth(parts[1]);
    }
  }, [selectedDate]);

  const handleExportStaffCsv = (stats: TeacherMonthlyStats[]) => {
    const headers = ["Serial No", "Staff ID", "Full Name", "Total Tracked Days", "Days Present", "Days On Leave", "Days Absent", "Presence Rate (%)", "Average Arrival Time"];
    
    const rows = stats.map((item, index) => [
      index + 1,
      item.teacherId,
      `"${item.teacherName.replace(/"/g, '""')}"`,
      item.totalDays,
      item.presentDays,
      item.leaveDays,
      item.absentDays,
      `${item.ratio}%`,
      item.avgArrivalTime
    ]);
    
    const csvString = [headers.join(","), ...rows.map(e => e.join(","))].join("\r\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const monthName = getMonthName(reportMonth);
    link.setAttribute("download", `Staff_Attendance_Report_${monthName}_${reportYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Fetch student or staff roll roster whenever selections change or real-time sync occurs
  useEffect(() => {
    const reloadRoster = () => {
      if (attendanceView === 'staff') {
        const sheet = DbController.getStaffAttendance(selectedDate);
        setStaffAttendanceSheet(sheet);
      } else {
        const sheet = DbController.getAttendance(selectedDate, selectedClass);
        setAttendanceSheet(sheet);
      }
    };

    reloadRoster();
    setSaveStatus('');

    window.addEventListener('school-system-sync', reloadRoster);
    return () => window.removeEventListener('school-system-sync', reloadRoster);
  }, [selectedDate, selectedClass, attendanceView]);

  const handleStatusChange = (studentId: string, newStatus: AttendanceStatus) => {
    if (teacherPermissions?.canApproveAttendance === false) {
      alert("Permission to approve/modify attendance has been suspended by the Headteacher.");
      return;
    }
    const updated = attendanceSheet.map(item => {
      if (item.studentId === studentId) {
        return { ...item, status: newStatus };
      }
      return item;
    });
    setAttendanceSheet(updated);

    if (isAutoSave || autoCloudSync) {
      DbController.saveAttendanceBatch(updated);
      setSaveStatus(autoCloudSync ? 'Cloud Syncing...' : 'Auto-saved successfully!');
      setTimeout(() => setSaveStatus(''), 2000);
    } else {
      setSaveStatus('Modified - Click Save Session');
    }
  };

  const handleQRScanSuccess = (studentId: string) => {
    if (teacherPermissions?.canApproveAttendance === false) {
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: {
          text: "Permission to approve/modify attendance has been suspended by the Headteacher.",
          type: 'error'
        }
      }));
      return;
    }

    const studentRecord = attendanceSheet.find(item => item.studentId === studentId);
    if (studentRecord) {
      const updated = attendanceSheet.map(item => {
        if (item.studentId === studentId) {
          return { ...item, status: 'Present' as AttendanceStatus };
        }
        return item;
      });
      setAttendanceSheet(updated);

      if (isAutoSave || autoCloudSync) {
        DbController.saveAttendanceBatch(updated);
        setSaveStatus(autoCloudSync ? 'Cloud Syncing...' : 'Auto-saved successfully!');
        setTimeout(() => setSaveStatus(''), 2000);
      } else {
        setSaveStatus('Modified - Click Save Session');
      }

      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: {
          text: `QR Scan Success: Marked ${studentRecord.studentName} as Present!`,
          type: 'success'
        }
      }));
    } else {
      const allStudents = DbController.getStudents();
      const existingStudent = allStudents.find(s => s.id === studentId);
      if (existingStudent) {
        window.dispatchEvent(new CustomEvent('app-toast', {
          detail: {
            text: `QR Scan Error: Student ${existingStudent.firstName} ${existingStudent.lastName} belongs to class ${existingStudent.class} (Selected: ${selectedClass})`,
            type: 'error'
          }
        }));
      } else {
        window.dispatchEvent(new CustomEvent('app-toast', {
          detail: {
            text: `QR Scan Error: Student with ID "${studentId}" not found in system.`,
            type: 'error'
          }
        }));
      }
    }
  };

  const handleQRBatchScanSuccess = (studentIds: string[]) => {
    if (teacherPermissions?.canApproveAttendance === false) {
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: {
          text: "Permission to approve/modify attendance has been suspended by the Headteacher.",
          type: 'error'
        }
      }));
      return;
    }

    let markedCount = 0;
    const updated = attendanceSheet.map(item => {
      if (studentIds.includes(item.studentId)) {
        if (item.status !== 'Present') {
          markedCount++;
        }
        return { ...item, status: 'Present' as AttendanceStatus };
      }
      return item;
    });

    setAttendanceSheet(updated);

    if (isAutoSave || autoCloudSync) {
      DbController.saveAttendanceBatch(updated);
      setSaveStatus(autoCloudSync ? 'Cloud Syncing...' : 'Auto-saved successfully!');
      setTimeout(() => setSaveStatus(''), 2000);
    } else {
      setSaveStatus('Modified - Click Save Session');
    }

    window.dispatchEvent(new CustomEvent('app-toast', {
      detail: {
        text: `Successfully marked ${markedCount} student(s) as Present via batch scan!`,
        type: 'success'
      }
    }));
  };

  const handleSaveAll = () => {
    if (teacherPermissions?.canApproveAttendance === false) {
      alert("Permission to approve/modify attendance has been suspended by the Headteacher.");
      return;
    }
    DbController.saveAttendanceBatch(attendanceSheet);
    onManualSave();
    setSaveStatus('Session saved successfully!');
    setTimeout(() => setSaveStatus(''), 3000);
  };

  const markAllStatus = (status: AttendanceStatus) => {
    if (teacherPermissions?.canApproveAttendance === false) {
      alert("Permission to approve/modify attendance has been suspended by the Headteacher.");
      return;
    }
    const updated = attendanceSheet.map(item => ({ ...item, status }));
    setAttendanceSheet(updated);

    if (isAutoSave || autoCloudSync) {
      DbController.saveAttendanceBatch(updated);
      setSaveStatus(autoCloudSync ? 'Cloud Syncing...' : 'Auto-saved all as ' + status);
      setTimeout(() => setSaveStatus(''), 2000);
    } else {
      setSaveStatus('All status set - Click Save');
    }
  };

  // STAFF ATTENDANCE HANDLERS
  const handleStaffStatusChange = (teacherId: string, newStatus: StaffAttendanceStatus) => {
    const updated = staffAttendanceSheet.map(item => {
      if (item.teacherId === teacherId) {
        let arrival = item.arrivalTime;
        let departure = item.departureTime;
        if (newStatus === 'Present') {
          arrival = arrival || '07:45';
          departure = departure || '16:00';
        } else if (newStatus === 'Absent' || newStatus === 'On Leave') {
          arrival = '';
          departure = '';
        }
        return { ...item, status: newStatus, arrivalTime: arrival, departureTime: departure };
      }
      return item;
    });
    setStaffAttendanceSheet(updated);

    if (isAutoSave || autoCloudSync) {
      DbController.saveStaffAttendanceBatch(updated);
      setSaveStatus(autoCloudSync ? 'Cloud Syncing...' : 'Auto-saved successfully!');
      setTimeout(() => setSaveStatus(''), 2000);
    } else {
      setSaveStatus('Modified - Click Save Session');
    }
  };

  const handleStaffTimeChange = (teacherId: string, field: 'arrivalTime' | 'departureTime', timeVal: string) => {
    const updated = staffAttendanceSheet.map(item => {
      if (item.teacherId === teacherId) {
        return { ...item, [field]: timeVal };
      }
      return item;
    });
    setStaffAttendanceSheet(updated);

    if (isAutoSave || autoCloudSync) {
      DbController.saveStaffAttendanceBatch(updated);
      setSaveStatus(autoCloudSync ? 'Cloud Syncing...' : 'Auto-saved successfully!');
      setTimeout(() => setSaveStatus(''), 2000);
    } else {
      setSaveStatus('Modified - Click Save Session');
    }
  };

  const handleStaffRemarksChange = (teacherId: string, remarksVal: string) => {
    const updated = staffAttendanceSheet.map(item => {
      if (item.teacherId === teacherId) {
        return { ...item, remarks: remarksVal };
      }
      return item;
    });
    setStaffAttendanceSheet(updated);

    if (isAutoSave) {
      DbController.saveStaffAttendanceBatch(updated);
      setSaveStatus('Auto-saved successfully!');
      setTimeout(() => setSaveStatus(''), 2000);
    } else {
      setSaveStatus('Modified - Click Save Session');
    }
  };

  const handleSaveAllStaff = () => {
    DbController.saveStaffAttendanceBatch(staffAttendanceSheet);
    onManualSave();
    setSaveStatus('Staff session saved successfully!');
    setTimeout(() => setSaveStatus(''), 3000);
  };

  const markAllStaffStatus = (status: StaffAttendanceStatus) => {
    const updated = staffAttendanceSheet.map(item => {
      let arrival = item.arrivalTime;
      let departure = item.departureTime;
      if (status === 'Present') {
        arrival = arrival || '07:45';
        departure = departure || '16:00';
      } else {
        arrival = '';
        departure = '';
      }
      return { ...item, status, arrivalTime: arrival, departureTime: departure };
    });
    setStaffAttendanceSheet(updated);

    if (isAutoSave || autoCloudSync) {
      DbController.saveStaffAttendanceBatch(updated);
      setSaveStatus(autoCloudSync ? 'Cloud Syncing...' : 'Auto-saved all as ' + status);
      setTimeout(() => setSaveStatus(''), 2000);
    } else {
      setSaveStatus('All status set - Click Save');
    }
  };

  // Perform calculations for "Present", "Holiday", and "Absent" with high-performance memoization
  const { presentCount, holidayCount, absentCount } = useMemo(() => {
    let p = 0, h = 0, a = 0;
    for (let i = 0; i < attendanceSheet.length; i++) {
      const status = attendanceSheet[i].status;
      if (status === 'Present') p++;
      else if (status === 'Holiday') h++;
      else if (status === 'Absent') a++;
    }
    return { presentCount: p, holidayCount: h, absentCount: a };
  }, [attendanceSheet]);
  const totalRosterCount = attendanceSheet.length;

  const presentPct = useMemo(() => totalRosterCount > 0 ? Math.round((presentCount / totalRosterCount) * 100) : 0, [presentCount, totalRosterCount]);
  const absentPct = useMemo(() => totalRosterCount > 0 ? Math.round((absentCount / totalRosterCount) * 100) : 0, [absentCount, totalRosterCount]);
  const holidayPct = useMemo(() => totalRosterCount > 0 ? Math.round((holidayCount / totalRosterCount) * 100) : 0, [holidayCount, totalRosterCount]);

  // Perform calculations for "Present", "On Leave", and "Absent" (Staff) with high-performance memoization
  const staffTotalCount = staffAttendanceSheet.length;
  const { staffPresentCount, staffLeaveCount, staffAbsentCount } = useMemo(() => {
    let p = 0, l = 0, a = 0;
    for (let i = 0; i < staffAttendanceSheet.length; i++) {
      const status = staffAttendanceSheet[i].status;
      if (status === 'Present') p++;
      else if (status === 'On Leave') l++;
      else if (status === 'Absent') a++;
    }
    return { staffPresentCount: p, staffLeaveCount: l, staffAbsentCount: a };
  }, [staffAttendanceSheet]);

  const staffPresentPct = useMemo(() => staffTotalCount > 0 ? Math.round((staffPresentCount / staffTotalCount) * 100) : 0, [staffPresentCount, staffTotalCount]);
  const staffAbsentPct = useMemo(() => staffTotalCount > 0 ? Math.round((staffAbsentCount / staffTotalCount) * 100) : 0, [staffAbsentCount, staffTotalCount]);
  const staffLeavePct = useMemo(() => staffTotalCount > 0 ? Math.round((staffLeaveCount / staffTotalCount) * 100) : 0, [staffLeaveCount, staffTotalCount]);

  const handleClearInputs = () => {
    if (attendanceView === 'staff') {
      const cleared = staffAttendanceSheet.map(item => ({ ...item, status: 'Unmarked' as StaffAttendanceStatus, arrivalTime: '', departureTime: '', remarks: '' }));
      setStaffAttendanceSheet(cleared);
      if (isAutoSave) {
        DbController.saveStaffAttendanceBatch(cleared);
      }
      alert("Reset all current staff attendance records to Unmarked.");
    } else {
      const cleared = attendanceSheet.map(item => ({ ...item, status: 'Unmarked' as AttendanceStatus }));
      setAttendanceSheet(cleared);
      if (isAutoSave) {
        DbController.saveAttendanceBatch(cleared);
      }
      alert("Reset all current student attendance records to Unmarked.");
    }
  };

  const handleDeleteActiveSelection = () => {
    if (attendanceView === 'staff') {
      setConfirmModal({
        isOpen: true,
        title: "Clear Staff Attendance?",
        message: `Are you sure you want to delete/clear all recorded staff attendance records on ${selectedDate}?`,
        confirmText: "Clear Records",
        danger: true,
        onConfirm: () => {
          const cleared = staffAttendanceSheet.map(item => ({ ...item, status: 'Unmarked' as StaffAttendanceStatus, arrivalTime: '', departureTime: '', remarks: '' }));
          setStaffAttendanceSheet(cleared);
          DbController.saveStaffAttendanceBatch(cleared);
          window.dispatchEvent(new CustomEvent('app-toast', { detail: { text: `Deleted active staff attendance inputs on ${selectedDate}.`, type: 'info' } }));
        }
      });
    } else {
      setConfirmModal({
        isOpen: true,
        title: "Clear Student Attendance?",
        message: `Are you sure you want to delete/clear all recorded attendance for class "${selectedClass}" on ${selectedDate}?`,
        confirmText: "Clear Records",
        danger: true,
        onConfirm: () => {
          const cleared = attendanceSheet.map(item => ({ ...item, status: 'Unmarked' as AttendanceStatus }));
          setAttendanceSheet(cleared);
          DbController.saveAttendanceBatch(cleared);
          window.dispatchEvent(new CustomEvent('app-toast', { detail: { text: `Deleted active student attendance inputs for ${selectedClass} on ${selectedDate}.`, type: 'info' } }));
        }
      });
    }
  };

  const handleDeleteAllAttendance = () => {
    if (attendanceView === 'staff') {
      setConfirmModal({
        isOpen: true,
        title: "PURGE ALL STAFF ATTENDANCE?",
        message: "Are you sure you want to completely erase all historical staff attendance records? This action is irreversible and will delete all audit trails.",
        confirmText: "Purge Database",
        danger: true,
        onConfirm: () => {
          DbController.clearAllStaffAttendance();
          setStaffAttendanceSheet([]);
          onManualSave();
          window.dispatchEvent(new CustomEvent('app-toast', { detail: { text: "Successfully purged all staff attendance records.", type: 'success' } }));
        }
      });
    } else {
      setConfirmModal({
        isOpen: true,
        title: "PURGE ALL STUDENT ATTENDANCE?",
        message: "Are you sure you want to completely erase all historical student attendance records from the system database? This action is irreversible and will delete all audit trails.",
        confirmText: "Purge Database",
        danger: true,
        onConfirm: () => {
          DbController.clearAllAttendance();
          setAttendanceSheet([]);
          onManualSave();
          window.dispatchEvent(new CustomEvent('app-toast', { detail: { text: "Successfully purged all student attendance records.", type: 'success' } }));
        }
      });
    }
  };

  const hasAnyAssignment = (assignedClasses.length > 0) || (assignedSubjects.length > 0) || (assignedClass && assignedClass !== 'None');

  if (userRole === 'Teacher' && !hasAnyAssignment) {
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
    <div className="space-y-6 fade-in text-xs">
      
      {/* PERMISSION BANNER */}
      {userRole === 'Teacher' && (teacherPermissions?.canApproveAttendance === false || teacherPermissions?.canExportReports === false) && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-900 space-y-1.5 text-left shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-rose-500 animate-pulse" />
            <span className="font-bold text-xs uppercase tracking-wider font-mono">Administrative Restriction Notice</span>
          </div>
          <p className="text-[11px] font-medium text-rose-800 leading-relaxed">
            Your Headteacher has applied granular restrictions on your educator account:
          </p>
          <ul className="list-disc pl-5 text-[11px] text-rose-700 space-y-0.5 font-semibold">
            {teacherPermissions?.canApproveAttendance === false && (
              <li><strong>Attendance Privileges Suspended:</strong> You cannot modify, save, or mark daily student logs.</li>
            )}
            {teacherPermissions?.canExportReports === false && (
              <li><strong>Exporting Privileges Suspended:</strong> Register printing and PDF downloading features are disabled.</li>
            )}
          </ul>
        </div>
      )}
      
      {/* Dynamic Navigation Mode Selector Switch (no-print) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2">
            <CalendarCheck className={theme.accentText} size={20} />
            Attendance Marking & Registers
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Mark daily participation logs for students or academic faculty members</p>
        </div>

        {/* Dynamic button control */}
        <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-3xs flex flex-wrap gap-1">
          <button
            onClick={() => setAttendanceView('student')}
            className={`px-4 py-2 font-black transition rounded-lg cursor-pointer text-xs flex items-center gap-1.5 ${
              attendanceView === 'student' ? `${theme.primaryBg} text-white shadow-xs` : 'text-slate-600 hover:bg-slate-250'
            }`}
          >
            <Users size={14} /> Student Attendance
          </button>
          <button
            onClick={() => setAttendanceView('staff')}
            className={`px-4 py-2 font-black transition rounded-lg cursor-pointer text-xs flex items-center gap-1.5 ${
              attendanceView === 'staff' ? `${theme.primaryBg} text-white shadow-xs` : 'text-slate-600 hover:bg-slate-250'
            }`}
          >
            <Clock size={14} /> Staff Attendance
          </button>
          <button
            onClick={() => setAttendanceView('roster')}
            className={`px-4 py-2 font-black transition rounded-lg cursor-pointer text-xs flex items-center gap-1.5 ${
              attendanceView === 'roster' ? `${theme.primaryBg} text-white shadow-xs` : 'text-slate-600 hover:bg-slate-250'
            }`}
          >
            <Printer size={14} /> Exportable Roster
          </button>
          <button
            onClick={() => setAttendanceView('summary')}
            className={`px-4 py-2 font-black transition rounded-lg cursor-pointer text-xs flex items-center gap-1.5 ${
              attendanceView === 'summary' ? `${theme.primaryBg} text-white shadow-xs` : 'text-slate-600 hover:bg-slate-250'
            }`}
          >
            <Activity size={14} /> Summary Analytics
          </button>
        </div>
      </div>

      {/* Academic Term Date Range Selector & Month Horizontal Date Strip (no-print) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-indigo-600 block">Navigation Helper</span>
            <h3 className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1.5">
              <CalendarDays className="text-indigo-600" size={16} />
              Academic Term Date Range & Horizontal Register Selector
            </h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Define the academic term boundaries. Select months and scroll horizontally to instantly mark or audit registers.
            </p>
          </div>

          {/* Date range inputs */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-slate-400 font-bold">Term Start:</span>
              <input 
                type="date" 
                value={termStartDate}
                onChange={(e) => setTermStartDate(e.target.value)}
                className="px-2 py-1 border border-slate-200 rounded-md bg-white font-mono font-bold text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="text-slate-300">to</div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-slate-400 font-bold">Term End:</span>
              <input 
                type="date" 
                value={termEndDate}
                onChange={(e) => setTermEndDate(e.target.value)}
                className="px-2 py-1 border border-slate-200 rounded-md bg-white font-mono font-bold text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            
            <button
              onClick={() => {
                setTermStartDate('2026-05-20');
                setTermEndDate('2026-07-04');
              }}
              className="text-[10px] px-2 py-1 font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition border border-indigo-100 bg-white cursor-pointer"
              title="Reset to 20th May 2026 - 4th July 2026"
            >
              Reset Default
            </button>
          </div>
        </div>

        {/* Month Selector Tabs */}
        {uniqueMonths.length > 0 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase font-mono font-bold text-slate-400 mr-2">Select Month:</span>
              {uniqueMonths.map(({ monthKey, monthName }) => (
                <button
                  key={monthKey}
                  onClick={() => {
                    setActiveMonthTab(monthKey);
                    // Find first date of this month in range and select it
                    const firstDateInMonth = allRangeDates.find(d => d.monthKey === monthKey);
                    if (firstDateInMonth) {
                      setSelectedDate(firstDateInMonth.dateStr);
                    }
                  }}
                  className={`px-3 py-1 rounded-full font-bold transition text-[11px] cursor-pointer ${
                    activeMonthTab === monthKey 
                      ? 'bg-indigo-600 text-white shadow-xs' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {monthName}
                </button>
              ))}
            </div>

            {/* Horizontal Date Slider strip */}
            <div className="relative group">
              {/* Left Scroll Button */}
              <button
                onClick={() => {
                  const el = document.getElementById('horizontal-date-slider-strip');
                  if (el) el.scrollBy({ left: -160, behavior: 'smooth' });
                }}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white/90 hover:bg-white rounded-full border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-slate-800 transition -left-3 cursor-pointer opacity-0 group-hover:opacity-100"
              >
                <ChevronLeft size={16} />
              </button>

              {/* Scroll Container */}
              <div 
                id="horizontal-date-slider-strip"
                className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {visibleDates.map((item) => {
                  const isSelected = item.dateStr === selectedDate;
                  return (
                    <button
                      key={item.dateStr}
                      onClick={() => setSelectedDate(item.dateStr)}
                      className={`flex-none snap-start w-14 py-2 rounded-xl border text-center transition duration-150 cursor-pointer ${
                        isSelected 
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100 scale-105' 
                          : item.isWeekend 
                            ? 'bg-slate-50 border-slate-150 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block text-[9px] font-mono uppercase tracking-tight opacity-75">
                        {item.dayName}
                      </span>
                      <span className="block text-base font-extrabold font-mono mt-0.5">
                        {item.dayNum}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Right Scroll Button */}
              <button
                onClick={() => {
                  const el = document.getElementById('horizontal-date-slider-strip');
                  if (el) el.scrollBy({ left: 160, behavior: 'smooth' });
                }}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white/90 hover:bg-white rounded-full border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-slate-800 transition -right-3 cursor-pointer opacity-0 group-hover:opacity-100"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 text-center text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200 text-[11px]">
            Please enter a valid Academic Term Date Range.
          </div>
        )}
      </div>

      {/* Configuration Header Control Panel */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Marking Date</label>
            <div className="relative">
              <CalendarDays className="absolute left-2.5 top-2.5 text-slate-400" size={14} />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-400 text-xs font-mono font-semibold"
              />
            </div>
          </div>

          {(attendanceView === 'student' || attendanceView === 'summary') && (
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Class</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value as ClassType)}
                disabled={userRole === 'Teacher' && [...new Set([assignedClass, ...assignedClasses])].filter(c => c && c !== 'None').length <= 1}
                className="px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 font-semibold text-xs focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {userRole === 'Teacher' ? (
                  [...new Set([assignedClass, ...assignedClasses])].filter(c => c && c !== 'None').map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))
                ) : (
                  CLASSES.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))
                )}
              </select>
            </div>
          )}

          <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-tighter leading-none">Cloud Sync</span>
              <span className="text-[10px] font-bold text-slate-700">Auto-Sync</span>
            </div>
            <button
              onClick={() => setAutoCloudSync(!autoCloudSync)}
              className="cursor-pointer transition-colors"
              title="Toggle automatic cloud synchronization for attendance"
            >
              {autoCloudSync ? (
                <ToggleRight className="text-emerald-500" size={24} />
              ) : (
                <ToggleLeft className="text-slate-300" size={24} />
              )}
            </button>
          </div>
        </div>

        {/* Global Setter controls and Print button */}
        <div className="flex flex-wrap items-center gap-4">
          {attendanceView === 'student' && (
            <div className="flex items-center gap-2">
              <div className="text-[11px] text-slate-500 font-medium">Bulk Mark Class:</div>
              <button
                onClick={() => markAllStatus('Present')}
                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-xs font-semibold cursor-pointer transition"
              >
                All Present
              </button>
              <button
                onClick={() => markAllStatus('Holiday')}
                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-xs font-semibold cursor-pointer transition"
              >
                All Holiday
              </button>
              <button
                onClick={() => markAllStatus('Absent')}
                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 rounded text-xs font-semibold cursor-pointer transition"
              >
                All Absent
              </button>
              <button
                onClick={() => {
                  if (isSubscriptionLocked) {
                    alert("Scan QR Badge is inactive for expired accounts. Please renew your school license.");
                    return;
                  }
                  setShowQRScanner(true);
                }}
                disabled={isSubscriptionLocked}
                className={`px-3 py-1 rounded text-xs font-bold transition shadow-xs flex items-center gap-1 ${
                  isSubscriptionLocked
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 border border-slate-300 dark:border-slate-700 opacity-60 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
                }`}
                title={isSubscriptionLocked ? "Scan QR Badge is inactive for expired users" : "Scan student's QR badge with camera to automatically mark them as present"}
              >
                <QrCode size={13} className={isSubscriptionLocked ? "text-slate-400" : ""} />
                <span>{isSubscriptionLocked ? "Scan Student QR (Inactive)" : "Scan Student QR"}</span>
              </button>
            </div>
          )}
          {attendanceView === 'staff' && (
            <div className="flex items-center gap-2">
              <div className="text-[11px] text-slate-500 font-medium">Bulk Mark Staff:</div>
              <button
                onClick={() => markAllStaffStatus('Present')}
                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-xs font-semibold cursor-pointer transition"
              >
                All Present
              </button>
              <button
                onClick={() => markAllStaffStatus('On Leave')}
                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-xs font-semibold cursor-pointer transition"
              >
                All On Leave
              </button>
              <button
                onClick={() => markAllStaffStatus('Absent')}
                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 rounded text-xs font-semibold cursor-pointer transition"
              >
                All Absent
              </button>
            </div>
          )}

          <div className="hidden sm:block h-6 w-px bg-slate-200 mx-1" />

          {(attendanceView === 'student' || attendanceView === 'roster') && (
            <button
              onClick={handlePrintMonthlyRoster}
              disabled={generatingMonthlyPdf || teacherPermissions?.canExportReports === false}
              className={`flex items-center gap-1.5 px-3 py-1.5 border border-transparent rounded-lg font-bold text-xs cursor-pointer transition select-none ${theme.primaryBg} text-white hover:brightness-110 active:translate-y-0.5 disabled:opacity-50`}
              title="Compile and print entire month's student attendance as PDF"
            >
              {generatingMonthlyPdf ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <CalendarCheck size={14} />
              )}
              <span>{generatingMonthlyPdf ? 'Generating...' : 'Print Monthly Roster'}</span>
            </button>
          )}

          <button
            onClick={() => setShowPdfGuide(!showPdfGuide)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-900 text-white hover:bg-slate-800 active:translate-y-0.5 transition text-xs font-semibold rounded-lg cursor-pointer"
          >
            <Eye size={14} /> Toggle Preview Mode
          </button>
        </div>

      </div>

      {/* Grid: Stat Summary on Left, Roster Table on Right */}
      {attendanceView !== 'summary' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 no-print">
        
        {/* STATS AGGREGATES CARDS */}
        <div className="lg:col-span-1 space-y-4">
          
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-display font-bold text-slate-800 flex items-center gap-1.5">
              <ClipboardList className={theme.accentText} size={18} />
              Session Summary
            </h3>

            {attendanceView === 'student' ? (
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                <div className="border border-slate-100 bg-slate-50/50 p-3 rounded-lg text-center lg:text-left">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Enrolled on Roll</span>
                  <strong className="text-xl text-slate-800 font-display">{totalRosterCount}</strong>
                  <span className="text-[10px] block text-slate-400">active class students</span>
                </div>

                <div className="border border-emerald-100 bg-emerald-50/20 p-3 rounded-lg text-center lg:text-left">
                  <span className="text-[10px] text-emerald-600 uppercase font-mono block">Present Count</span>
                  <strong className="text-xl text-emerald-700 font-display">{presentCount}</strong>
                  <span className="text-[10px] block text-emerald-500">attendance marked</span>
                </div>

                <div className="border border-amber-100 bg-amber-50/20 p-3 rounded-lg text-center lg:text-left">
                  <span className="text-[10px] text-amber-600 uppercase font-mono block">Holiday Leave</span>
                  <strong className="text-xl text-amber-700 font-display">{holidayCount}</strong>
                  <span className="text-[10px] block text-amber-500 font-sans font-medium">marked off</span>
                </div>

                <div className="border border-red-100 bg-red-50/20 p-3 rounded-lg text-center lg:text-left">
                  <span className="text-[10px] text-red-600 uppercase font-mono block">Absent Lockouts</span>
                  <strong className="text-xl text-red-700 font-display">{absentCount}</strong>
                  <span className="text-[10px] block text-red-500">truances flagged</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                <div className="border border-slate-100 bg-slate-50/50 p-3 rounded-lg text-center lg:text-left">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Total Faculty</span>
                  <strong className="text-xl text-slate-800 font-display">{staffTotalCount}</strong>
                  <span className="text-[10px] block text-slate-400">academic staff</span>
                </div>

                <div className="border border-emerald-100 bg-emerald-50/20 p-3 rounded-lg text-center lg:text-left">
                  <span className="text-[10px] text-emerald-600 uppercase font-mono block">Present Count</span>
                  <strong className="text-xl text-emerald-700 font-display">{staffPresentCount}</strong>
                  <span className="text-[10px] block text-emerald-500">signed present today</span>
                </div>

                <div className="border border-amber-100 bg-amber-50/20 p-3 rounded-lg text-center lg:text-left">
                  <span className="text-[10px] text-amber-600 uppercase font-mono block">Staff On Leave</span>
                  <strong className="text-xl text-amber-700 font-display">{staffLeaveCount}</strong>
                  <span className="text-[10px] block text-amber-500 font-sans font-medium">excused leave</span>
                </div>

                <div className="border border-red-100 bg-red-50/20 p-3 rounded-lg text-center lg:text-left">
                  <span className="text-[10px] text-red-600 uppercase font-mono block">Staff Absent</span>
                  <strong className="text-xl text-red-700 font-display">{staffAbsentCount}</strong>
                  <span className="text-[10px] block text-red-500">unexcused absence</span>
                </div>
              </div>
            )}

            {/* Manual preservation notice */}
            {!isAutoSave && (
              <button
                onClick={attendanceView === 'student' ? handleSaveAll : handleSaveAllStaff}
                className={`w-full py-2.5 rounded-lg text-xs font-bold shadow-xs active:translate-y-0.5 transition cursor-pointer text-center ${theme.btnColors}`}
              >
                Save Attendance Session
              </button>
            )}

            {saveStatus && (
              <div className={`text-center font-semibold text-[11px] py-1.5 px-3 rounded text-slate-700 ${saveStatus.includes('success') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 border border-slate-200 animate-pulse'}`}>
                {saveStatus}
              </div>
            )}
          </div>

          {/* Daily Live Attendance Ratio Percentage Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-display font-medium text-slate-800 flex items-center gap-1.5 font-sans">
              <CalendarCheck className="text-indigo-600" size={18} />
              Attendance Ratio
            </h3>

            {(attendanceView === 'student' ? totalRosterCount : staffTotalCount) === 0 ? (
              <div className="text-center py-4 text-slate-400 italic">
                No active roster available
              </div>
            ) : (
              <div className="space-y-4">
                {/* Micro Stat side-by-side indicator layout */}
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-emerald-50/40 border border-emerald-100 p-2.5 rounded-lg flex flex-col items-center">
                    <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Present</span>
                    <strong className="text-xl text-emerald-700 font-display mt-0.5">
                      {attendanceView === 'student' ? presentPct : staffPresentPct}%
                    </strong>
                    <span className="text-[9px] text-emerald-500 font-mono mt-0.5 flex-wrap">
                      {attendanceView === 'student' ? `${presentCount} of ${totalRosterCount}` : `${staffPresentCount} of ${staffTotalCount}`}
                    </span>
                  </div>

                  <div className="bg-rose-50/40 border border-rose-100 p-2.5 rounded-lg flex flex-col items-center">
                    <span className="text-[10px] text-rose-600 font-bold uppercase tracking-wider">Absent</span>
                    <strong className="text-xl text-rose-700 font-display mt-0.5">
                      {attendanceView === 'student' ? absentPct : staffAbsentPct}%
                    </strong>
                    <span className="text-[9px] text-rose-500 font-mono mt-0.5 flex-wrap">
                      {attendanceView === 'student' ? `${absentCount} of ${totalRosterCount}` : `${staffAbsentCount} of ${staffTotalCount}`}
                    </span>
                  </div>
                </div>

                {/* Progress Bar Track */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[9px] text-slate-400 font-semibold tracking-wider uppercase">
                    <span>Roster Spread</span>
                    {attendanceView === 'student' ? (
                      holidayCount > 0 && <span className="text-amber-600">Holiday: {holidayPct}%</span>
                    ) : (
                      staffLeaveCount > 0 && <span className="text-amber-600">On Leave: {staffLeavePct}%</span>
                    )}
                  </div>
                  
                  {/* Visual stacked percentage bar representation */}
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                    <div 
                      style={{ width: `${attendanceView === 'student' ? presentPct : staffPresentPct}%` }}
                      className="h-full bg-emerald-500 transition-all duration-500 ease-out"
                      title="Present"
                    />
                    <div 
                      style={{ width: `${attendanceView === 'student' ? holidayPct : staffLeavePct}%` }}
                      className="h-full bg-amber-400 transition-all duration-500 ease-out"
                      title={attendanceView === 'student' ? 'Holiday' : 'On Leave'}
                    />
                    <div 
                      style={{ width: `${attendanceView === 'student' ? absentPct : staffAbsentPct}%` }}
                      className="h-full bg-red-400 transition-all duration-500 ease-out"
                      title="Absent"
                    />
                  </div>
                </div>

                {/* Insight footer message */}
                <div className="bg-slate-50 border border-slate-150 rounded-lg p-2.5 text-[10px] text-slate-500 leading-normal flex items-start gap-1.5 font-sans">
                  <span className="text-xs">💡</span>
                  <span>
                    Current day presence holds at <strong className="text-slate-800">{attendanceView === 'student' ? presentPct : staffPresentPct}%</strong>.
                    {(attendanceView === 'student' ? presentPct : staffPresentPct) >= 90 ? (
                      <span className="text-emerald-700/90 font-medium"> Excellent turnout rate!</span>
                    ) : (attendanceView === 'student' ? presentPct : staffPresentPct) >= 75 ? (
                      <span className="text-amber-700/90 font-medium"> Regular attendance.</span>
                    ) : (
                      <span className="text-rose-700/90 font-bold font-sans"> High absence rate detected.</span>
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-[11px] text-slate-500 leading-relaxed font-sans font-medium h-fit">
            {attendanceView === 'student' ? (
              <>
                <Users size={16} className="text-slate-400 mb-1" />
                <span>Attendance totals automatically roll into student catalogs. Check academic rosters to verify presence ratios of day/boarder sections correctly.</span>
              </>
            ) : (
              <>
                <Briefcase size={16} className="text-slate-400 mb-1" />
                <span>Track daily arrival and departure. Ensure timestamps are completed correctly prior to administrative reports generation.</span>
              </>
            )}
          </div>

          {attendanceView === 'staff' && (
            <div className="bg-gradient-to-br from-indigo-50 to-slate-50 p-5 rounded-xl border border-indigo-100 shadow-3xs space-y-4">
              <div className="flex items-center gap-2">
                <Briefcase className="text-indigo-600" size={18} />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Monthly Reports</h3>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal font-medium">
                Export and analyze compiled attendance performance, presence rate, leave quotas, and sign-in chronologies for all teachers.
              </p>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Month</label>
                    <select
                      value={reportMonth}
                      onChange={(e) => setReportMonth(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-[11px] font-bold focus:outline-none"
                    >
                      {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(m => (
                        <option key={m} value={m}>{getMonthName(m)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Year</label>
                    <select
                      value={reportYear}
                      onChange={(e) => setReportYear(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-[11px] font-bold focus:outline-none"
                    >
                      {['2025', '2026', '2027', '2028', '2029', '2030'].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowMonthlyReportMode(!showMonthlyReportMode)}
                  className={`w-full py-2.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition active:translate-y-0.5 cursor-pointer shadow-3xs border ${
                    showMonthlyReportMode
                      ? 'bg-slate-800 border-slate-900 text-white hover:bg-slate-700'
                      : `${theme.primaryBg} text-white border-transparent hover:brightness-110`
                  }`}
                >
                  <ClipboardList size={14} />
                  {showMonthlyReportMode ? 'Back to Daily Register' : 'Preview Monthly Performance'}
                </button>
              </div>
            </div>
          )}

        </div>

        {/* ROSTER DATA GRID WORKPAD */}
        {attendanceView === 'staff' && showMonthlyReportMode ? (
          <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col justify-between animate-fade-in">
            <div>
              {/* Header inside Workpad */}
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-extrabold text-slate-850 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                    <Briefcase className="text-indigo-600" size={15} />
                    Monthly Staff Performance Report
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Consolidated attendance analytics for <strong className="text-slate-700 font-bold">{getMonthName(reportMonth)} {reportYear}</strong>
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const teachersList = DbController.getTeachers();
                      const allStaffAttendance = DbController.getAllStaffAttendance();
                      const stats = teachersList.map(teacher => {
                        const trs = allStaffAttendance.filter(r => r.teacherId === teacher.id && r.date.startsWith(`${reportYear}-${reportMonth}`) && r.status !== 'Unmarked');
                        const totalDays = trs.length;
                        const presentDays = trs.filter(r => r.status === 'Present').length;
                        const leaveDays = trs.filter(r => r.status === 'On Leave').length;
                        const absentDays = trs.filter(r => r.status === 'Absent').length;
                        const ratio = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
                        
                        const arrivalTimesInMinutes = trs
                          .filter(r => r.status === 'Present' && r.arrivalTime)
                          .map(r => {
                            const [h, m] = r.arrivalTime!.split(':').map(Number);
                            return h * 60 + m;
                          });
                          
                        let avgArrivalTime = '-';
                        if (arrivalTimesInMinutes.length > 0) {
                          const avgMinutes = Math.round(arrivalTimesInMinutes.reduce((sum, val) => sum + val, 0) / arrivalTimesInMinutes.length);
                          const avgHours = Math.floor(avgMinutes / 60);
                          const avgMinsFraction = avgMinutes % 60;
                          avgArrivalTime = `${avgHours.toString().padStart(2, '0')}:${avgMinsFraction.toString().padStart(2, '0')}`;
                        }
                        
                        return {
                          teacherId: teacher.id,
                          teacherName: `${teacher.firstName} ${teacher.middleName ? teacher.middleName + ' ' : ''}${teacher.lastName}`,
                          totalDays,
                          presentDays,
                          leaveDays,
                          absentDays,
                          ratio,
                          avgArrivalTime
                        };
                      });
                      handleExportStaffCsv(stats);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-bold tracking-wide transition text-xs rounded-lg cursor-pointer animate-fade-in"
                  >
                    <FileDown size={14} /> Export CSV
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const monthName = getMonthName(reportMonth);
                        const fname = formatIdentifiableFilename({
                          docType: 'Staff Attendance Report',
                          term: `${monthName}_${reportYear}`,
                          extension: 'pdf'
                        });
                        const result = await generatePdfFromHtml('staff-monthly-report-printable', fname, false);
                        downloadBlobLocally(result.blob, result.filename);
                      } catch (e) {
                        console.error(e);
                        alert("Could not generate PDF: " + (e instanceof Error ? e.message : String(e)));
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-900 text-white hover:bg-slate-800 font-bold tracking-wide transition text-xs rounded-lg cursor-pointer shadow-3xs"
                  >
                    <Printer size={14} /> Export PDF Report
                  </button>
                </div>
              </div>

              {/* Grid or Table listing of staff performance */}
              <div className="p-4">
                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse animate-fade-in">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                        <th className="p-3">Staff ID</th>
                        <th className="p-3">Full Name</th>
                        <th className="p-3 text-center">Tracked Days</th>
                        <th className="p-3 text-center text-emerald-700 font-bold">Days Present</th>
                        <th className="p-3 text-center text-amber-700 font-bold">Days On Leave</th>
                        <th className="p-3 text-center text-rose-700 font-bold">Days Absent</th>
                        <th className="p-3 text-center font-bold">Attendance %</th>
                        <th className="p-3 text-center font-bold">Avg Arrival Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(() => {
                        const teachersList = DbController.getTeachers();
                        const allSaved = DbController.getAllStaffAttendance();
                        
                        const stats = teachersList.map(teacher => {
                          const trs = allSaved.filter(r => r.teacherId === teacher.id && r.date.startsWith(`${reportYear}-${reportMonth}`) && r.status !== 'Unmarked');
                          const totalDays = trs.length;
                          const presentDays = trs.filter(r => r.status === 'Present').length;
                          const leaveDays = trs.filter(r => r.status === 'On Leave').length;
                          const absentDays = trs.filter(r => r.status === 'Absent').length;
                          const ratio = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
                          
                          const arrivalTimesInMinutes = trs
                            .filter(r => r.status === 'Present' && r.arrivalTime)
                            .map(r => {
                              const [h, m] = r.arrivalTime!.split(':').map(Number);
                              return h * 60 + m;
                            });
                            
                          let avgArrivalTime = '-';
                          if (arrivalTimesInMinutes.length > 0) {
                            const avgMinutes = Math.round(arrivalTimesInMinutes.reduce((sum, val) => sum + val, 0) / arrivalTimesInMinutes.length);
                            const avgHours = Math.floor(avgMinutes / 60);
                            const avgMinsFraction = avgMinutes % 60;
                            avgArrivalTime = `${avgHours.toString().padStart(2, '0')}:${avgMinsFraction.toString().padStart(2, '0')}`;
                          }
                          
                          return {
                            teacherId: teacher.id,
                            teacherName: `${teacher.firstName} ${teacher.middleName ? teacher.middleName + ' ' : ''}${teacher.lastName}`,
                            totalDays,
                            presentDays,
                            leaveDays,
                            absentDays,
                            ratio,
                            avgArrivalTime
                          };
                        });

                        if (stats.length === 0) {
                          return (
                            <tr>
                              <td colSpan={8} className="p-6 text-center text-slate-400 italic">No academic staff profiles found to summarize.</td>
                            </tr>
                          );
                        }

                        return stats.map(item => (
                          <tr key={item.teacherId} className="hover:bg-slate-50/50 transition">
                            <td className="p-3 font-mono font-semibold text-slate-500">{item.teacherId}</td>
                            <td className="p-3 font-bold text-slate-850">{item.teacherName}</td>
                            <td className="p-3 text-center font-mono font-semibold text-slate-600">{item.totalDays} days</td>
                            <td className="p-3 text-center text-emerald-600 font-bold font-mono">{item.presentDays}</td>
                            <td className="p-3 text-center text-amber-650 font-mono">{item.leaveDays}</td>
                            <td className="p-3 text-center text-rose-600 font-mono">{item.absentDays}</td>
                            <td className="p-3 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold font-mono ${
                                item.ratio >= 90
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : item.ratio >= 75
                                  ? 'bg-amber-50 text-amber-700'
                                  : item.ratio > 0
                                  ? 'bg-rose-50 text-rose-600'
                                  : 'bg-slate-50 text-slate-400'
                              }`}>
                                {item.ratio}%
                              </span>
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-slate-705">
                              {item.avgArrivalTime !== '-' ? (
                                <span className="flex items-center justify-center gap-1 text-slate-755">
                                  <Clock size={11} className="text-slate-400" />
                                  {item.avgArrivalTime}
                                </span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            {/* Footer insight help */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-505 font-medium">
              💡 <span>Staff attendance criteria and checkmarks are saved automatically. Warnings should be issued for presence ratios under <strong>90%</strong>.</span>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-slate-700 text-xs">
                  {attendanceView === 'student' ? 'Digital Student Attendance Class Register' : 'Staff Daily Attendance Register Log'}
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {attendanceView === 'student' ? `${selectedClass} level roster logs on ${selectedDate}` : `School faculty rosters on ${selectedDate}`}
                </p>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                {attendanceView === 'student' ? `Present: ${presentCount} | Absent: ${absentCount}` : `Present: ${staffPresentCount} | Absent: ${staffAbsentCount}`}
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {attendanceView === 'roster' ? (
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h4 className="font-extrabold text-slate-850 text-sm uppercase tracking-wider">
                        Exportable Class Roster: {selectedClass}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Class roster for {selectedDate}. Print this grid to manually record daily attendance.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => window.print()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg cursor-pointer transition"
                      >
                        <Printer size={14} /> Print Grid
                      </button>
                      <button
                        onClick={handlePrintMonthlyRoster}
                        disabled={generatingMonthlyPdf || teacherPermissions?.canExportReports === false}
                        className={`flex items-center gap-1.5 px-3 py-1.5 ${theme.primaryBg} text-white font-bold text-xs rounded-lg cursor-pointer hover:brightness-110 transition disabled:opacity-50`}
                      >
                        {generatingMonthlyPdf ? (
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <CalendarCheck size={14} />
                        )}
                        <span>{generatingMonthlyPdf ? 'Generating...' : 'Print Monthly Roster'}</span>
                      </button>
                    </div>
                  </div>
                  
                  <div id="attendance-roster-print-area" className="w-full">
                    <table className="w-full border-collapse border border-slate-300">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="border border-slate-300 p-2 text-left text-[10px] uppercase font-bold text-slate-600 w-12">No.</th>
                          <th className="border border-slate-300 p-2 text-left text-[10px] uppercase font-bold text-slate-600 w-32">Student ID</th>
                          <th className="border border-slate-300 p-2 text-left text-[10px] uppercase font-bold text-slate-600">Full Name</th>
                          <th className="border border-slate-300 p-2 text-left text-[10px] uppercase font-bold text-slate-600 w-48">Signature / Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceSheet.length === 0 ? (
                          <tr><td colSpan={4} className="p-4 text-center text-slate-400">No students found.</td></tr>
                        ) : (
                          attendanceSheet.map((item, index) => (
                            <tr key={item.studentId}>
                              <td className="border border-slate-300 p-2 text-xs font-mono text-slate-500">{index + 1}</td>
                              <td className="border border-slate-300 p-2 text-xs font-mono text-slate-700">{item.studentId}</td>
                              <td className="border border-slate-300 p-2 text-xs font-semibold text-slate-800">{item.studentName}</td>
                              <td className="border border-slate-300 p-2 h-10"></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : attendanceView === 'student' ? (
                attendanceSheet.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center space-y-4">
                    <img 
                      src="/attendance_empty.jpg" 
                      alt="No attendance data illustration" 
                      className="w-48 h-48 object-contain rounded-2xl border border-slate-100 shadow-sm bg-white"
                      referrerPolicy="no-referrer"
                    />
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-600">No Enrolled Students In {selectedClass}</p>
                      <p className="max-w-sm mx-auto text-slate-400 text-[10px] leading-relaxed">Enroll student profiles to {selectedClass} under the primary Databases module to enable attendance register checkmarks.</p>
                    </div>
                  </div>
                ) : (
                  attendanceSheet.map((item, index) => (
                    <div 
                      key={item.studentId}
                      className="p-3 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition duration-150"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-slate-300 font-bold w-4">
                          {(index + 1).toString().padStart(2, '0')}
                        </span>
                        <div>
                          <div className="font-semibold text-slate-800 text-xs">{item.studentName}</div>
                          <div className="text-[10px] text-slate-500 font-mono flex flex-wrap gap-x-2">
                            <span>ID: {item.studentId}</span>
                            <span className="text-slate-300">•</span>
                            <span className="font-semibold text-emerald-600">Present: {DbController.getStudentAttendanceStats(item.studentId).present} times</span>
                            <span className="text-slate-300">•</span>
                            <span className="font-semibold text-indigo-600">School Open: {DbController.getStudentAttendanceStats(item.studentId).schoolOpen} times</span>
                          </div>
                        </div>
                      </div>

                      {/* Radio Select Checks */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleStatusChange(item.studentId, 'Present')}
                          className={`px-3 py-1.5 rounded-lg border font-semibold tracking-wide cursor-pointer transition text-[11px] ${item.status === 'Present' ? 'bg-emerald-500 border-emerald-600 text-white shadow-xs' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        >
                          Present
                        </button>
                        <button
                          onClick={() => handleStatusChange(item.studentId, 'Holiday')}
                          className={`px-3 py-1.5 rounded-lg border font-semibold tracking-wide cursor-pointer transition text-[11px] ${item.status === 'Holiday' ? 'bg-amber-500 border-amber-600 text-white shadow-xs' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        >
                          Holiday
                        </button>
                        <button
                          onClick={() => handleStatusChange(item.studentId, 'Absent')}
                          className={`px-3 py-1.5 rounded-lg border font-semibold tracking-wide cursor-pointer transition text-[11px] ${item.status === 'Absent' ? 'bg-red-500 border-red-600 text-white shadow-xs' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        >
                          Absent
                        </button>
                      </div>

                    </div>
                  ))
                )
              ) : (
                staffAttendanceSheet.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 space-y-2 animate-fade-in">
                    <Users size={32} className="text-slate-300 mx-auto" />
                    <p className="font-semibold text-slate-600">No Teachers Available</p>
                    <p className="max-w-sm mx-auto text-slate-400 text-[10px]">Create teacher profiles under the Databases module or use the bulk importer to track daily arrivals & departures logs.</p>
                  </div>
                ) : (
                  staffAttendanceSheet.map((item, index) => (
                    <div 
                      key={item.teacherId}
                      className="p-4 px-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 hover:bg-slate-50/50 transition duration-150 animate-fade-in"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-slate-300 font-bold w-4">
                          {(index + 1).toString().padStart(2, '0')}
                        </span>
                        <div>
                          <div className="font-semibold text-slate-800 text-xs">{item.teacherName}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Staff ID: <span className="font-semibold text-slate-700">{item.teacherId}</span>
                          </div>
                        </div>
                      </div>

                      {/* Staff Attendance Columns */}
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Status Select Buttons */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStaffStatusChange(item.teacherId, 'Present')}
                            className={`px-2.5 py-1.5 rounded-lg border font-bold cursor-pointer transition text-[10px] uppercase tracking-wider ${item.status === 'Present' ? 'bg-emerald-500 border-emerald-600 text-white shadow-3xs' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                          >
                            Present
                          </button>
                          <button
                            onClick={() => handleStaffStatusChange(item.teacherId, 'On Leave')}
                            className={`px-2.5 py-1.5 rounded-lg border font-bold cursor-pointer transition text-[10px] uppercase tracking-wider ${item.status === 'On Leave' ? 'bg-amber-500 border-amber-600 text-white shadow-3xs' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                          >
                            On Leave
                          </button>
                          <button
                            onClick={() => handleStaffStatusChange(item.teacherId, 'Absent')}
                            className={`px-2.5 py-1.5 rounded-lg border font-bold cursor-pointer transition text-[10px] uppercase tracking-wider ${item.status === 'Absent' ? 'bg-red-500 border-red-600 text-white shadow-3xs' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                          >
                            Absent
                          </button>
                        </div>

                        {/* Arrival/Departure inputs */}
                        {item.status === 'Present' && (
                          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl text-[10px]">
                            <div className="flex items-center gap-1 text-slate-600">
                              <LogIn size={11} className="text-slate-400" />
                              <span className="font-bold">In:</span>
                              <input
                                type="time"
                                value={item.arrivalTime || ''}
                                onChange={(e) => handleStaffTimeChange(item.teacherId, 'arrivalTime', e.target.value)}
                                className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-mono focus:outline-none w-16"
                              />
                            </div>
                            <div className="w-px h-3.5 bg-slate-200" />
                            <div className="flex items-center gap-1 text-slate-600">
                              <LogOut size={11} className="text-slate-400" />
                              <span className="font-bold">Out:</span>
                              <input
                                type="time"
                                value={item.departureTime || ''}
                                onChange={(e) => handleStaffTimeChange(item.teacherId, 'departureTime', e.target.value)}
                                className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-mono focus:outline-none w-16"
                              />
                            </div>
                          </div>
                        )}

                        {/* Remarks input field */}
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl text-[10px] min-w-[140px] max-w-xs flex-1">
                          <MessageSquare size={11} className="text-slate-400" />
                          <input
                            type="text"
                            value={item.remarks || ''}
                            onChange={(e) => handleStaffRemarksChange(item.teacherId, e.target.value)}
                            placeholder="Add remarks..."
                            className="bg-transparent border-none text-[11px] focus:outline-none text-slate-700 w-full font-medium"
                          />
                        </div>
                      </div>

                    </div>
                  ))
                )
              )}
            </div>
          </div>

          <div className="bg-slate-50/80 px-5 py-3 border-t border-slate-100 text-[10px] font-mono text-slate-400 text-center flex items-center justify-center gap-1">
            <CheckSquare size={12} className="text-slate-405" />
            <span>Registers must represent true daily attendance logs. Double check and save your ledger prior to close.</span>
          </div>
        </div>
        )}

      </div>
      ) : (
        <div className="no-print">
          <AttendanceSummaryView 
            selectedClass={selectedClass} 
            selectedDate={selectedDate} 
            theme={theme} 
          />
        </div>
      )}

      {/* PRINT-ONLY COHESIVE DAILY REGISTER LOG */}
      {attendanceView !== 'summary' && (
        <div className="hidden print:block font-serif max-w-5xl mx-auto p-12 bg-white text-black border-4 border-double border-slate-800 rounded-none shadow-none mt-10 relative">
          <div className="absolute inset-0 z-0 pointer-events-none" dangerouslySetInnerHTML={{ __html: getWatermarkHtml(schoolInfo?.crestUrl) }} />
        <div className="text-center border-b-2 border-slate-800 pb-4 mb-6">
          <div className="mx-auto w-16 h-16 mb-3 flex items-center justify-center overflow-hidden border border-slate-300 rounded-full bg-slate-50">
            {schoolInfo.logoUrl ? (
              <img src={schoolInfo.logoUrl} className="w-full h-full object-contain" alt="School logo" />
            ) : (
              <DefaultCrest className="h-10 w-10 text-slate-800" />
            )}
          </div>
          <h1 className="text-2xl font-bold uppercase font-display tracking-tight">{schoolInfo.name}</h1>
          <p className="text-xs italic font-serif mt-0.5">Motto: "{schoolInfo.motto}"</p>
          <p className="text-xs font-mono mt-1">EMIS: {schoolInfo.emisCode} | REG NO: {schoolInfo.schoolNumber}</p>
        </div>

        {attendanceView === 'student' ? (
          <>
            <div className="flex justify-between items-center bg-slate-50 p-3 rounded border border-slate-200 mb-6 text-xs font-mono">
              <div><strong>CLASS NAME:</strong> {selectedClass}</div>
              <div><strong>DATE OF REGISTER:</strong> {selectedDate}</div>
              <div><strong>TOTAL ROLL:</strong> {totalRosterCount}</div>
            </div>

            <h2 className="text-base font-bold uppercase text-center tracking-widest border-b border-slate-400 pb-2 mb-4">
              Daily Class Attendance Register Log
            </h2>

            <table className="w-full text-left text-xs border-collapse border border-slate-400">
              <thead>
                <tr className="bg-slate-50 text-slate-800 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-2 border border-slate-400 w-12 text-center">No.</th>
                  <th className="p-2 border border-slate-400 w-32">Student ID</th>
                  <th className="p-2 border border-slate-400">Full Name</th>
                  <th className="p-2 border border-slate-400 w-32 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {attendanceSheet.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center border border-slate-400 italic">No students registered in this class.</td>
                  </tr>
                ) : (
                  attendanceSheet.map((item, index) => (
                    <tr key={item.studentId} className="border-b border-slate-300">
                      <td className="p-2 border border-slate-400 text-center font-mono">{index + 1}</td>
                      <td className="p-2 border border-slate-400 font-mono">{item.studentId}</td>
                      <td className="p-2 border border-slate-400 font-bold">{item.studentName}</td>
                      <td className="p-2 border border-slate-400 text-center">
                        <span className="font-mono font-bold text-xs">
                          {item.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Statistical Summary Row */}
            <div className="grid grid-cols-3 gap-4 border border-slate-400 p-3 bg-slate-50 font-mono text-[11px] mt-6 leading-6">
              <div><strong>Present Summary:</strong> {presentCount} students</div>
              <div><strong>Holiday Leave:</strong> {holidayCount} students</div>
              <div><strong>Absent Summary:</strong> {absentCount} students</div>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between items-center bg-slate-50 p-3 rounded border border-slate-200 mb-6 text-xs font-mono">
              <div><strong>FACULTY LEVEL:</strong> All Active Academic Staff</div>
              <div><strong>DATE OF REGISTER:</strong> {selectedDate}</div>
              <div><strong>TOTAL STAFF:</strong> {staffTotalCount}</div>
            </div>

            <h2 className="text-base font-bold uppercase text-center tracking-widest border-b border-slate-400 pb-2 mb-4">
              Daily Staff Attendance & Check-In Log
            </h2>

            <table className="w-full text-left text-xs border-collapse border border-slate-400">
              <thead>
                <tr className="bg-slate-50 text-slate-800 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-2 border border-slate-400 w-12 text-center">No.</th>
                  <th className="p-2 border border-slate-400 w-28">Staff ID</th>
                  <th className="p-2 border border-slate-400">Full Name</th>
                  <th className="p-2 border border-slate-400 w-24 text-center">In Time</th>
                  <th className="p-2 border border-slate-400 w-24 text-center">Out Time</th>
                  <th className="p-2 border border-slate-400 w-28 text-center">Status</th>
                  <th className="p-2 border border-slate-400">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {staffAttendanceSheet.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center border border-slate-400 italic">No academic staff registered.</td>
                  </tr>
                ) : (
                  staffAttendanceSheet.map((item, index) => (
                    <tr key={item.teacherId} className="border-b border-slate-300">
                      <td className="p-2 border border-slate-400 text-center font-mono">{index + 1}</td>
                      <td className="p-2 border border-slate-400 font-mono">{item.teacherId}</td>
                      <td className="p-2 border border-slate-400 font-bold">{item.teacherName}</td>
                      <td className="p-2 border border-slate-400 text-center font-mono">{item.arrivalTime || '-'}</td>
                      <td className="p-2 border border-slate-400 text-center font-mono">{item.departureTime || '-'}</td>
                      <td className="p-2 border border-slate-400 text-center font-mono font-bold text-xs">{item.status.toUpperCase()}</td>
                      <td className="p-2 border border-slate-400 italic text-[11px] text-slate-700">{item.remarks || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Statistical Summary Row */}
            <div className="grid grid-cols-3 gap-4 border border-slate-400 p-3 bg-slate-50 font-mono text-[11px] mt-6 leading-6">
              <div><strong>Present Summary:</strong> {staffPresentCount} staff</div>
              <div><strong>On Leave:</strong> {staffLeaveCount} staff</div>
              <div><strong>Absent Summary:</strong> {staffAbsentCount} staff</div>
            </div>
          </>
        )}

        <div className="mt-16 flex justify-between text-xs font-serif pt-6 border-t border-slate-300">
          <div className="text-center">
            <div className="h-10 w-44 border-b border-slate-400"></div>
            <p className="mt-2 font-semibold">{schoolInfo.headteacherName}</p>
            <p className="text-slate-500 italic text-[10px]">Headteacher Signature</p>
          </div>
          <div className="text-center">
            <div className="h-10 w-44 border-b border-slate-400"></div>
            <p className="mt-2 font-semibold">Class Overseer / Teacher</p>
            <p className="text-slate-500 italic text-[10px]">Official Stamp / Signature</p>
          </div>
        </div>
      </div>
      )}

      {/* SANDBOX PRINT CAPTURE ALERT OVERLAY */}
      {printBlocked && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 no-print">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full text-center space-y-4 text-slate-800">
            <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 mx-auto">
              <Printer size={24} />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-sm font-bold text-slate-950 font-display">Print Dialog Intercepted</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Your browser blocks direct print triggers from inside the preview iframe. To print this daily register log, please click the <strong className="text-slate-800 font-bold">"Open in a new tab" ↗</strong> button at the top right of the application workspace first.
              </p>
            </div>
            <button
              onClick={() => setPrintBlocked(false)}
              className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer active:translate-y-0.5 transition"
            >
              Recognized, Dismiss
            </button>
          </div>
        </div>
      )}

      {/* COMPREHENSIVE PDF GENERATION / PRINTING MANUAL OVERLAY WITH LIVE INTERACTIVE VISUAL PRINT PREVIEW */}
      <AnimatePresence>
        {showPdfGuide && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowPdfGuide(false);
            }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 no-print overflow-y-auto cursor-pointer"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ ease: "easeOut", duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-100 rounded-[24px] border border-slate-200/50 shadow-2xl max-w-5xl w-full flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200/80 overflow-hidden my-8 max-h-[90vh] cursor-default"
            >
            
            {/* Left: Document Live Preview */}
            <div className="flex-1 p-6 overflow-y-auto bg-slate-700 flex flex-col justify-between items-center space-y-4">
              <div className="text-center space-y-1 select-none">
                <span className="text-amber-400 text-xs font-black tracking-wider uppercase block font-sans">
                  Print Preview & Document Layout Align
                </span>
                <span className="text-white/60 text-[9px] font-sans block max-w-md">
                  Optimize margins, branding, and paper size before submitting to printer
                </span>
              </div>
              
              <div id="attendance-register-preview-card" className="relative w-full max-w-[450px] min-h-[636px] bg-white p-8 text-black border-4 border-double border-slate-800 shadow-2xl text-[9px] space-y-3 font-serif rounded-none overflow-y-auto">
                {/* Transparent School Crest Watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.045] z-0">
                  {schoolInfo?.crestUrl ? (
                    <img src={schoolInfo.crestUrl} className="w-[280px] h-[280px] object-contain" alt="Watermark Crest" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-[280px] h-[280px]" dangerouslySetInnerHTML={{ __html: GHANA_CREST_SVG_SIMPLE }} />
                  )}
                </div>

                <div className="relative z-10 text-center border-b-2 border-slate-800 pb-2 mb-3">
                  <div className="mx-auto w-12 h-12 mb-2 flex items-center justify-center overflow-hidden border border-slate-200 rounded-full bg-slate-50">
                    {schoolInfo.logoUrl ? (
                      <img src={schoolInfo.logoUrl} className="w-full h-full object-contain" alt="School logo" />
                    ) : (
                      <DefaultCrest className="h-8 w-8 text-slate-800" />
                    )}
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-tight font-sans text-stone-900">{schoolInfo.name}</h3>
                  <p className="text-[9px] italic mt-0.5 text-stone-600">Motto: "{schoolInfo.motto}"</p>
                  <p className="text-[8px] font-mono mt-1 text-stone-500">EMIS: {schoolInfo.emisCode} | REG NO: {schoolInfo.schoolNumber}</p>
                </div>

                {attendanceView === 'student' ? (
                  <>
                    <div className="flex justify-between items-center bg-stone-50 p-2 rounded border border-stone-200 mb-3 text-[8px] font-mono text-stone-700">
                      <div><strong>CLASS:</strong> {selectedClass}</div>
                      <div><strong>DATE:</strong> {selectedDate}</div>
                      <div><strong>COUNT:</strong> {totalRosterCount}</div>
                    </div>

                    <h4 className="text-[10px] font-bold uppercase text-center tracking-widest border-b border-stone-300 pb-1 mb-2 text-stone-900">
                      Daily Class Attendance Register Log
                    </h4>
                ) : attendanceView === 'summary' ? (
                  <>
                    <div className="flex justify-between items-center bg-stone-50 p-2 rounded border border-stone-200 mb-3 text-[8px] font-mono text-stone-700">
                      <div><strong>CLASS:</strong> {selectedClass}</div>
                      <div><strong>PERIOD:</strong> SUMMARY</div>
                    </div>

                    <h4 className="text-[10px] font-bold uppercase text-center tracking-widest border-b border-stone-300 pb-1 mb-2 text-stone-900">
                      Attendance Aggregate Summary
                    </h4>
                    <p className="text-[8px] italic text-center text-stone-500 mb-2">
                      Please use the 'Print Summary' button in the summary dashboard to print full statistics with gender aggregates.
                    </p>
                  </>

                    <table className="w-full text-left text-[8px] border-collapse border border-stone-400">
                      <thead>
                        <tr className="bg-stone-100 font-bold uppercase text-stone-800">
                          <th className="p-1 border border-stone-400 text-center">No.</th>
                          <th className="p-1 border border-stone-400">Full Name</th>
                          <th className="p-1 border border-stone-400 text-center w-16">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceSheet.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="p-2 text-center border border-stone-400 italic">No student attendance logs to preview.</td>
                          </tr>
                        ) : (
                          attendanceSheet.slice(0, 8).map((item, index) => (
                            <tr key={item.studentId} className="border-b border-stone-300">
                              <td className="p-1 border border-stone-400 text-center font-mono">{index + 1}</td>
                              <td className="p-1 border border-stone-400 font-bold text-stone-950">{item.studentName}</td>
                              <td className="p-1 border border-stone-400 text-center">
                                <span className={`px-1.5 py-0.5 font-bold font-sans text-[7px] border rounded ${
                                  item.status.toLowerCase() === 'present' 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                    : item.status.toLowerCase() === 'absent' 
                                    ? 'bg-rose-50 text-rose-700 border-rose-200' 
                                    : item.status.toLowerCase() === 'holiday'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-slate-50 text-slate-400 border-slate-200'
                                }`}>
                                  {item.status.toUpperCase()}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                        {attendanceSheet.length > 8 && (
                          <tr>
                            <td colSpan={3} className="p-1 border border-stone-400 text-center font-mono text-indigo-600 italic">
                              ... and {attendanceSheet.length - 8} more students listed in Daily Register sheet ...
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center bg-stone-50 p-2 rounded border border-stone-200 mb-3 text-[8px] font-mono text-stone-700">
                      <div><strong>FACULTY:</strong> Active Staff</div>
                      <div><strong>DATE:</strong> {selectedDate}</div>
                      <div><strong>COUNT:</strong> {staffTotalCount}</div>
                    </div>

                    <h4 className="text-[10px] font-bold uppercase text-center tracking-widest border-b border-stone-300 pb-1 mb-2 text-stone-900">
                      Daily Staff Attendance Register Log
                    </h4>

                    <table className="w-full text-left text-[8px] border-collapse border border-stone-400">
                      <thead>
                        <tr className="bg-stone-100 font-bold uppercase text-stone-800">
                          <th className="p-1 border border-stone-400 text-center">No.</th>
                          <th className="p-1 border border-stone-400">Full Name</th>
                          <th className="p-1 border border-stone-400 text-center">In/Out</th>
                          <th className="p-1 border border-stone-400 text-center w-16">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {staffAttendanceSheet.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-2 text-center border border-stone-400 italic">No teacher registers found to preview.</td>
                          </tr>
                        ) : (
                          staffAttendanceSheet.slice(0, 8).map((item, index) => (
                            <tr key={item.teacherId} className="border-b border-stone-300 text-[8px]">
                              <td className="p-1 border border-stone-400 text-center font-mono">{index + 1}</td>
                              <td className="p-1 border border-stone-400 font-bold text-stone-950">{item.teacherName}</td>
                              <td className="p-1 border border-stone-400 text-center font-mono text-[7px]">
                                {item.status === 'Present' ? `${item.arrivalTime || '??'}/${item.departureTime || '??'}` : '-'}
                              </td>
                              <td className="p-1 border border-stone-400 text-center">
                                <span className={`px-1 rounded text-[7px] font-mono font-bold border ${
                                  item.status === 'Present'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : item.status === 'On Leave'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}>
                                  {item.status.toUpperCase()}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                        {staffAttendanceSheet.length > 8 && (
                          <tr>
                            <td colSpan={4} className="p-1 border border-stone-400 text-center font-mono text-indigo-600 italic">
                              ... and {staffAttendanceSheet.length - 8} more teachers listed ...
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
              
              <span className="text-[10px] text-slate-300 font-mono tracking-wide">Standard Portrait A4 Format Draft Miniature</span>
            </div>

            {/* Right: Setup Manual & Control */}
            <div className="w-full md:w-[400px] p-6 bg-white flex flex-col justify-between overflow-y-auto max-h-none md:max-h-[90vh] no-print">
              <div className="space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 flex-shrink-0">
                    <Eye size={22} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-950">Toggle Preview Mode & Print Controller</h4>
                    <p className="text-[10px] text-slate-400">Review register print parameters</p>
                  </div>
                </div>

                <GoogleDriveExportControl 
                  elementId="attendance-register-preview-card" 
                  defaultFilename={`${selectedClass.replace(/\s+/g, '_')}_Register_${selectedDate}.pdf`}
                  isLandscape={false} 
                />

                <div className="p-3 bg-teal-50 border border-teal-100/70 rounded-xl space-y-1 text-teal-800 text-[11px]">
                  <span className="font-bold">✨ Portrait Optimized Layout</span>
                  <p className="text-[10px] text-teal-700/90 leading-relaxed">
                    Class Attendance Register sheets are beautifully scaled for vertical PDF A4 standards. Keep layout as Portrait.
                  </p>
                </div>

                <div className="space-y-3 text-xs text-slate-700 font-sans">
                  <span className="font-bold text-slate-900 border-b border-slate-100 pb-1 block">How to Export to PDF Checklist:</span>
                  
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <div className="font-bold text-[10px] text-slate-600 bg-slate-100 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">1</div>
                      <p className="text-[11px] leading-relaxed">
                        Click the <strong className="text-indigo-600 font-bold">Trigger Print Engine</strong> button down below to configure layout.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <div className="font-bold text-[10px] text-slate-600 bg-slate-100 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">2</div>
                      <p className="text-[11px] leading-relaxed">
                        Under the <strong>Destination</strong> list selector, choose <strong className="text-slate-900 font-bold">Save as PDF</strong> as your target.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <div className="font-bold text-[10px] text-slate-600 bg-slate-100 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">3</div>
                      <p className="text-[11px] leading-relaxed">
                        Ensure layout/orientation is set to <strong>Portrait</strong>, paper size <strong>A4</strong>, tick <strong>Background Graphics</strong>, and untick headers.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200/60 text-[10px] text-amber-800 leading-relaxed space-y-1">
                  <strong>💡 Tip for Sandbox Environments:</strong>
                  <p className="leading-normal">
                    Some browsers limit script popups within frame sandboxes. If the trigger fails, please click the <strong className="font-bold">"Open in a new tab" ↗</strong> button on the top right, then trigger print.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-6 border-t border-slate-100 mt-6 font-sans bg-white">
                <button
                  type="button"
                  onClick={() => setShowPdfGuide(false)}
                  className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 font-semibold rounded-xl transition cursor-pointer text-[12px] flex-shrink-0"
                >
                  Close Preview
                </button>
                <button
                  type="button"
                  disabled={teacherPermissions?.canExportReports === false}
                  onClick={() => {
                    if (teacherPermissions?.canExportReports === false) {
                      alert("Permission to export reports has been suspended by the Headteacher.");
                      return;
                    }
                    handlePrintRegister();
                  }}
                  className={`flex-1 px-5 py-2.5 ${
                    teacherPermissions?.canExportReports === false
                      ? 'bg-slate-350 text-slate-500 cursor-not-allowed opacity-65'
                      : 'bg-[#059669] hover:bg-[#047857] text-white cursor-pointer active:translate-y-0.5'
                  } font-semibold rounded-xl shadow-xs transition text-[12px] text-center flex items-center justify-center gap-1.5`}
                >
                  <Printer size={14} /> Trigger Print Engine
                </button>
              </div>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* SECTION DATA CONTROLS */}
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3 no-print mt-6">
      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
        <ShieldAlert className="text-indigo-500" size={14} /> Section Attendance Controls
      </h4>
      <p className="text-[10px] text-slate-500 leading-relaxed">
        Manage local attendance logs, clear input registers of active grids, and purge historical log records for this module.
      </p>
      <div className="flex flex-wrap gap-2.5 pt-1">
        <button
          type="button"
          onClick={handleClearInputs}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-850 hover:bg-slate-100 rounded-xl font-bold font-sans transition text-xs cursor-pointer shadow-xs"
        >
          <Eraser size={13} /> Clear All Inputs (Mark Absent)
        </button>
        <button
          type="button"
          onClick={handleDeleteActiveSelection}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 hover:text-amber-850 hover:bg-amber-100 rounded-xl font-bold font-sans transition text-xs cursor-pointer shadow-xs"
        >
          <RotateCcw size={13} /> Delete Present Grid Day Input
        </button>
        <button
          type="button"
          onClick={handleDeleteAllAttendance}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 hover:text-rose-850 hover:bg-rose-100 rounded-xl font-bold font-sans transition text-xs cursor-pointer shadow-xs sm:ml-auto"
        >
          <Trash2 size={13} /> Delete All Section Data
        </button>
      </div>
    </div>

    {/* OFF-SCREEN PRINT TEMPLATE FOR MONTHLY STAFF ATTENDANCE SUMMARY */}
    <div id="staff-monthly-report-printable" className="fixed left-0 top-0 -z-[999999] opacity-0 pointer-events-none w-[800px] p-10 bg-white font-sans text-slate-900 border-12 border-double border-slate-400">
      <div className="flex items-center justify-between border-b-2 border-slate-500 pb-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold text-2xl shadow-sm">
            {schoolInfo.name ? schoolInfo.name.charAt(0) : 'S'}
          </div>
          <div>
            <h1 className="text-xl font-extrabold uppercase tracking-widest text-slate-800 font-serif">{schoolInfo.name}</h1>
            <p className="text-[10px] text-slate-505 font-semibold uppercase font-sans tracking-wider">Motto: "{schoolInfo.motto}"</p>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              EMIS: {schoolInfo.emisCode} | REG NO: {schoolInfo.schoolNumber}
            </p>
          </div>
        </div>
        <div className="text-right text-[10px] font-mono text-slate-500">
          <div>MONTHLY FACULTY PERFORMANCE LEDGER</div>
          <div className="font-bold text-slate-800 text-xs">{getMonthName(reportMonth).toUpperCase()} {reportYear}</div>
          <div>GENERATED: {new Date().toLocaleDateString()}</div>
        </div>
      </div>

      <h2 className="text-center text-sm font-black uppercase tracking-widest border-b border-slate-200 pb-2 mb-6 text-slate-900">
        Monthly Academic Staff Attendance & Performance Summary
      </h2>

      {/* Aggregate metrics block */}
      {(() => {
        const teachersList = DbController.getTeachers();
        const allSaved = DbController.getAllStaffAttendance();
        
        const stats = teachersList.map(teacher => {
          const trs = allSaved.filter(r => r.teacherId === teacher.id && r.date.startsWith(`${reportYear}-${reportMonth}`) && r.status !== 'Unmarked');
          const totalDays = trs.length;
          const presentDays = trs.filter(r => r.status === 'Present').length;
          const leaveDays = trs.filter(r => r.status === 'On Leave').length;
          const absentDays = trs.filter(r => r.status === 'Absent').length;
          const ratio = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
          
          const arrivalTimesInMinutes = trs
            .filter(r => r.status === 'Present' && r.arrivalTime)
            .map(r => {
              const [h, m] = r.arrivalTime!.split(':').map(Number);
              return h * 60 + m;
            });
            
          let avgArrivalTime = '-';
          if (arrivalTimesInMinutes.length > 0) {
            const avgMinutes = Math.round(arrivalTimesInMinutes.reduce((sum, val) => sum + val, 0) / arrivalTimesInMinutes.length);
            const avgHours = Math.floor(avgMinutes / 60);
            const avgMinsFraction = avgMinutes % 60;
            avgArrivalTime = `${avgHours.toString().padStart(2, '0')}:${avgMinsFraction.toString().padStart(2, '0')}`;
          }
          
          return {
            teacherId: teacher.id,
            teacherName: `${teacher.firstName} ${teacher.middleName ? teacher.middleName + ' ' : ''}${teacher.lastName}`,
            totalDays,
            presentDays,
            leaveDays,
            absentDays,
            ratio,
            avgArrivalTime
          };
        });

        const activeDates = new Set(allSaved.filter(r => r.date.startsWith(`${reportYear}-${reportMonth}`)).map(r => r.date));
        const validStats = stats.filter(s => s.totalDays > 0);
        const avgAttendance = validStats.length > 0 ? Math.round(validStats.reduce((sum, s) => sum + s.ratio, 0) / validStats.length) : 0;

        return (
          <>
            <div className="grid grid-cols-4 gap-4 mb-6 text-center">
              <div className="border border-slate-200 p-3 bg-slate-50 rounded-lg">
                <div className="text-[9px] text-slate-500 font-bold uppercase">Total Faculty</div>
                <div className="text-lg font-black text-slate-800 font-serif">{teachersList.length} staff</div>
              </div>
              <div className="border border-slate-200 p-3 bg-slate-50 rounded-lg">
                <div className="text-[9px] text-slate-500 font-bold uppercase">Avg Month Attendance</div>
                <div className="text-lg font-black text-emerald-700 font-serif">{avgAttendance}%</div>
              </div>
              <div className="border border-slate-200 p-3 bg-slate-50 rounded-lg">
                <div className="text-[9px] text-slate-505 font-bold uppercase">Tracked Sittings</div>
                <div className="text-lg font-black text-slate-800 font-serif">{activeDates.size} days</div>
              </div>
              <div className="border border-slate-200 p-3 bg-slate-50 rounded-lg">
                <div className="text-[9px] text-slate-505 font-bold uppercase">Average Check-in</div>
                <div className="text-lg font-black text-indigo-705 font-serif font-bold">
                  {(() => {
                    const allArrivals = allSaved
                      .filter(r => r.date.startsWith(`${reportYear}-${reportMonth}`) && r.status === 'Present' && r.arrivalTime)
                      .map(r => {
                        const [h, m] = r.arrivalTime!.split(':').map(Number);
                        return h * 60 + m;
                      });
                    if (allArrivals.length === 0) return '-';
                    const avg = Math.round(allArrivals.reduce((sum, val) => sum + val, 0) / allArrivals.length);
                    const h = Math.floor(avg / 60);
                    const m = avg % 60;
                    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                  })()}
                </div>
              </div>
            </div>

            <table className="w-full text-left text-[11px] border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[9px] border-b border-slate-300">
                  <th className="p-2 border border-slate-300 text-center w-10">No.</th>
                  <th className="p-2 border border-slate-300 w-24">Staff ID</th>
                  <th className="p-2 border border-slate-300">Full Name</th>
                  <th className="p-2 border border-slate-300 text-center w-24">Working Days</th>
                  <th className="p-2 border border-slate-300 text-center w-16 text-emerald-800">Present</th>
                  <th className="p-2 border border-slate-300 text-center w-16 text-amber-800">On Leave</th>
                  <th className="p-2 border border-slate-300 text-center w-16 text-rose-800">Absent</th>
                  <th className="p-2 border border-slate-300 text-center w-28 font-bold">Attendance %</th>
                  <th className="p-2 border border-slate-300 text-center w-28 font-bold">Avg Arrival</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {stats.map((item, index) => (
                  <tr key={item.teacherId} className="border-b border-slate-200">
                    <td className="p-2 border border-slate-300 text-center font-mono">{index + 1}</td>
                    <td className="p-2 border border-slate-300 font-mono font-bold text-slate-600">{item.teacherId}</td>
                    <td className="p-2 border border-slate-300 font-bold text-slate-900">{item.teacherName}</td>
                    <td className="p-2 border border-slate-300 text-center font-mono">{item.totalDays} days</td>
                    <td className="p-2 border border-slate-300 text-center font-bold text-emerald-800 font-mono">{item.presentDays}</td>
                    <td className="p-2 border border-slate-300 text-center font-bold text-amber-800 font-mono">{item.leaveDays}</td>
                    <td className="p-2 border border-slate-300 text-center font-bold text-rose-800 font-mono">{item.absentDays}</td>
                    <td className="p-2 border border-slate-300 text-center font-extrabold font-mono text-slate-850">{item.ratio}%</td>
                    <td className="p-2 border border-slate-300 text-center font-mono font-bold text-slate-750">{item.avgArrivalTime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        );
      })()}

      {/* Signature block */}
      <div className="mt-16 flex justify-between text-[11px] font-serif pt-6 border-t border-slate-200">
        <div className="text-center w-48">
          <div className="h-10 border-b border-slate-300 mb-1" />
          <div className="font-bold">Headteacher Signature</div>
          <div className="text-[9px] text-slate-400">Date: ____/____/20__</div>
        </div>
        <div className="text-center w-48">
          <div className="h-10 border-b border-slate-300 mb-1" />
          <div className="font-bold">Stamp Area</div>
          <div className="text-[9px] text-slate-400">Official Seal</div>
        </div>
      </div>
    </div>

    {/* OFF-SCREEN PRINT TEMPLATE FOR MONTHLY STUDENT ATTENDANCE ROSTER */}
    <div id="student-monthly-roster-printable" className="fixed left-0 top-0 -z-[999999] opacity-0 pointer-events-none w-[1120px] p-8 bg-white font-sans text-slate-900 border-12 border-double border-slate-400">
      <div className="flex items-center justify-between border-b-2 border-slate-500 pb-4 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold text-2xl shadow-sm">
            {schoolInfo.name ? schoolInfo.name.charAt(0) : 'S'}
          </div>
          <div>
            <h1 className="text-xl font-extrabold uppercase tracking-widest text-slate-800 font-serif">{schoolInfo.name}</h1>
            <p className="text-[10px] text-slate-550 font-semibold uppercase font-sans tracking-wider">Motto: "{schoolInfo.motto}"</p>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              EMIS: {schoolInfo.emisCode} | REG NO: {schoolInfo.schoolNumber}
            </p>
          </div>
        </div>
        <div className="text-right text-[10px] font-mono text-slate-500">
          <div>CONSOLIDATED STUDENT ATTENDANCE REGISTER</div>
          <div className="font-bold text-slate-800 text-xs">CLASS: {selectedClass.toUpperCase()}</div>
          <div className="font-bold text-indigo-700 text-xs">{getMonthName(reportMonth).toUpperCase()} {reportYear}</div>
          <div>GENERATED: {new Date().toLocaleDateString()}</div>
        </div>
      </div>

      <h2 className="text-center text-xs font-black uppercase tracking-widest border-b border-slate-200 pb-2 mb-4 text-slate-900">
        Monthly Student Attendance Ledger & Roster Sheet
      </h2>

      {(() => {
        const studentsInClass = DbController.getStudents().filter(s => s.class === selectedClass);
        const sortedStudents = [...studentsInClass].sort((a, b) => 
          `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
        );
        const allSaved = DbController.getAllAttendance();

        // Calculate class metrics
        let totalPresentAll = 0;
        let totalAbsentAll = 0;

        const studentRowsData = sortedStudents.map(student => {
          let pCount = 0;
          let aCount = 0;
          let hCount = 0;
          let uCount = 0;

          const daysData = visibleDates.map(d => {
            const idKey = `${d.dateStr}_${student.id}`;
            const found = allSaved.find(r => r.id === idKey);
            const status = found ? found.status : 'Unmarked';
            
            if (status === 'Present') pCount++;
            else if (status === 'Absent') aCount++;
            else if (status === 'Holiday') hCount++;
            else uCount++;

            return {
              dateStr: d.dateStr,
              dayNum: d.dayNum,
              dayName: d.dayName,
              status
            };
          });

          const totalTracked = pCount + aCount;
          const ratio = totalTracked > 0 ? Math.round((pCount / totalTracked) * 100) : 0;

          totalPresentAll += pCount;
          totalAbsentAll += aCount;

          return {
            student,
            daysData,
            pCount,
            aCount,
            hCount,
            ratio
          };
        });

        const overallTotalTracked = totalPresentAll + totalAbsentAll;
        const overallAvgAttendance = overallTotalTracked > 0 ? Math.round((totalPresentAll / overallTotalTracked) * 100) : 0;

        return (
          <>
            {/* Top Stats summary row */}
            <div className="grid grid-cols-4 gap-4 mb-4 text-center">
              <div className="border border-slate-200 p-2 bg-slate-50 rounded-lg">
                <div className="text-[8px] text-slate-500 font-bold uppercase">Class Level</div>
                <div className="text-sm font-black text-slate-800 font-serif">{selectedClass}</div>
              </div>
              <div className="border border-slate-200 p-2 bg-slate-50 rounded-lg">
                <div className="text-[8px] text-slate-505 font-bold uppercase">Enrolled Profiles</div>
                <div className="text-sm font-black text-slate-800 font-serif">{studentsInClass.length} Students</div>
              </div>
              <div className="border border-slate-200 p-2 bg-slate-50 rounded-lg">
                <div className="text-[8px] text-slate-505 font-bold uppercase">Average Attendance Rate</div>
                <div className="text-sm font-black text-emerald-700 font-serif">{overallAvgAttendance}%</div>
              </div>
              <div className="border border-slate-200 p-2 bg-slate-50 rounded-lg">
                <div className="text-[8px] text-slate-550 font-bold uppercase">School Days Tracked</div>
                <div className="text-sm font-black text-indigo-705 font-serif">{visibleDates.length} Days</div>
              </div>
            </div>

            {/* Roster Sheet Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-[9px] border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[8px] border-b border-slate-300">
                    <th className="p-1 border border-slate-300 text-center w-8">No.</th>
                    <th className="p-1 border border-slate-300 w-44">Student Profile</th>
                    <th className="p-1 border border-slate-300 w-20">Student ID</th>
                    {visibleDates.map(d => (
                      <th key={d.dateStr} className={`p-1 border border-slate-300 text-center min-w-[20px] font-mono text-[7px] leading-none ${d.isWeekend ? 'bg-slate-200 text-slate-500' : ''}`}>
                        <div>{d.dayNum}</div>
                        <div className="text-[6px] text-slate-400 mt-0.5">{d.dayName.charAt(0)}</div>
                      </th>
                    ))}
                    <th className="p-1 border border-slate-300 text-center w-10 text-emerald-800 font-bold">P</th>
                    <th className="p-1 border border-slate-300 text-center w-10 text-rose-800 font-bold">A</th>
                    <th className="p-1 border border-slate-300 text-center w-10 text-amber-800 font-bold">H</th>
                    <th className="p-1 border border-slate-300 text-center w-12 font-bold bg-slate-50">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {studentRowsData.length === 0 ? (
                    <tr>
                      <td colSpan={visibleDates.length + 7} className="p-4 text-center text-slate-400 italic">
                        No students enrolled in this class.
                      </td>
                    </tr>
                  ) : (
                    studentRowsData.map(({ student, daysData, pCount, aCount, hCount, ratio }, idx) => (
                      <tr key={student.id} className="hover:bg-slate-50/50">
                        <td className="p-1 border border-slate-300 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-1 border border-slate-300 font-bold text-slate-900 truncate max-w-[176px]">
                          {student.firstName} {student.lastName}
                        </td>
                        <td className="p-1 border border-slate-300 font-mono text-slate-500 text-[8px]">{student.id}</td>
                        {daysData.map(d => {
                          let statusChar = '-';
                          let cellClass = 'text-slate-400';
                          if (d.status === 'Present') {
                            statusChar = '✔';
                            cellClass = 'bg-emerald-50 text-emerald-700 font-black';
                          } else if (d.status === 'Absent') {
                            statusChar = '✘';
                            cellClass = 'bg-rose-50 text-rose-700 font-black';
                          } else if (d.status === 'Holiday') {
                            statusChar = 'H';
                            cellClass = 'bg-amber-50 text-amber-700 font-semibold';
                          }
                          return (
                            <td key={d.dateStr} className={`p-0.5 border border-slate-200 text-center font-mono text-[8px] ${cellClass}`}>
                              {statusChar}
                            </td>
                          );
                        })}
                        <td className="p-1 border border-slate-300 text-center font-bold text-emerald-800 font-mono">{pCount}</td>
                        <td className="p-1 border border-slate-300 text-center font-bold text-rose-800 font-mono">{aCount}</td>
                        <td className="p-1 border border-slate-300 text-center font-bold text-amber-800 font-mono">{hCount}</td>
                        <td className="p-1 border border-slate-300 text-center font-extrabold font-mono text-slate-850 bg-slate-50">{ratio}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        );
      })()}

      {/* Legend Block */}
      <div className="mt-4 p-2 bg-slate-50 rounded border border-slate-100 flex items-center justify-between text-[7.5px] font-mono text-slate-500">
        <div>
          <span className="font-bold uppercase text-slate-600 mr-2">Status Key:</span>
          <span className="inline-flex items-center gap-0.5 mr-3"><span className="text-emerald-600 font-bold">✔</span> Present</span>
          <span className="inline-flex items-center gap-0.5 mr-3"><span className="text-rose-600 font-bold">✘</span> Absent</span>
          <span className="inline-flex items-center gap-0.5 mr-3"><span className="text-amber-600 font-bold">H</span> Holiday</span>
          <span className="inline-flex items-center gap-0.5"><span className="text-slate-400">-</span> Unmarked / No Session</span>
        </div>
        <div className="italic">
          * Attendance rate is computed as: [Present Days / (Present Days + Absent Days)] × 100%
        </div>
      </div>

      {/* Signature blocks */}
      <div className="mt-8 flex justify-between text-[10px] font-serif pt-4 border-t border-slate-200">
        <div className="text-center w-48">
          <div className="h-8 border-b border-slate-300 mb-1" />
          <div className="font-bold">Class Teacher Signature</div>
          <div className="text-[8px] text-slate-400">Date: ____/____/20__</div>
        </div>
        <div className="text-center w-48">
          <div className="h-8 border-b border-slate-300 mb-1" />
          <div className="font-bold">Headteacher Approval</div>
          <div className="text-[8px] text-slate-400">Signature & Stamp</div>
        </div>
      </div>
    </div>

    {confirmModal && confirmModal.isOpen && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[110] p-4 no-print animate-fade-in">
        <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden text-left p-6 space-y-4 animate-scale-up">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-xl shrink-0 ${confirmModal.danger ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
              <ShieldAlert size={24} className="animate-bounce-slow" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 font-sans tracking-tight">
                {confirmModal.title}
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {confirmModal.message}
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setConfirmModal(null)}
              className="flex-1 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer select-none text-center"
            >
              {confirmModal.cancelText || 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => {
                confirmModal.onConfirm();
                setConfirmModal(null);
              }}
              className={`flex-1 py-2 px-4 text-white font-bold text-xs rounded-xl transition cursor-pointer select-none text-center ${
                confirmModal.danger 
                  ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800' 
                  : 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800'
              }`}
            >
              {confirmModal.confirmText || 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    )}

    {showQRScanner && (
      <StudentQRScanner
        selectedClass={selectedClass}
        onScanSuccess={handleQRScanSuccess}
        onBatchScanSuccess={handleQRBatchScanSuccess}
        onClose={() => setShowQRScanner(false)}
        theme={theme}
        isSubscriptionLocked={isSubscriptionLocked}
      />
    )}

    </div>
  );
}
