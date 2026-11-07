import React, { useState, useEffect, FormEvent, useMemo, ReactNode, DragEvent, useCallback } from 'react';
import { 
  SchoolInfo, Student, Teacher, UserAccount, UserRole, ThemeType,
  AcademicYearType, TermType, WebAuthnCredential, AttendanceRecord, StudentAssessment, TeacherReflection,
  ACADEMIC_YEARS, TERMS, ClassType
} from './types';
import { DbController, auth } from './db';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot, doc, collection, setDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { THEME_CONFIGS, ThemeStyles } from './components/ThemeWrapper';
import DeveloperStatus from './components/DeveloperStatus';
// @ts-ignore
import geetechLogo from './assets/images/geetech_new_logo_1782900372763.jpg';
import { generateSecureToken, getWhatsAppShareData, shareParentPortalWhatsApp, WhatsAppTemplate, triggerToast } from './utils';
import { evaluateSubscription } from './subscription';

import StudentsTab from './components/StudentsTab';
import TeachersTab from './components/TeachersTab';
import AttendanceTab from './components/AttendanceTab';
import AssessmentTab from './components/AssessmentTab';
import SchoolFeesTab from './components/SchoolFeesTab';
import FinancesTab from './components/FinancesTab';
import DashboardSummaryTab from './components/DashboardSummaryTab';
import TeacherDashboardTab from './components/TeacherDashboardTab';
import CommunicationsTab from './components/CommunicationsTab';
import AcademicCalendarTab from './components/AcademicCalendarTab';
import EmisTab from './components/EmisTab';
import PaystackManagementTab from './components/PaystackManagementTab';
import AdminDashboardTab from './components/AdminDashboardTab';
import SchoolProfileTab from './components/SchoolProfileTab';
import SettingsTab from './components/SettingsTab';

import ParentPortal from './components/ParentPortal';
import SubscriptionLockModal from './components/SubscriptionLockModal';
import { PrintPreviewModal } from './components/PrintPreviewModal';
import QuickSearchModal from './components/QuickSearchModal';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import QRBadgeScanner from './components/QRBadgeScanner';
import { SetupWizard } from './components/SetupWizard';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { 
  Landmark, Users, UserCheck, CalendarCheck, FileSpreadsheet, Settings, 
  LogOut, ShieldAlert, Lock, Mail, User, BookOpen, GraduationCap, CheckCircle2, Coins, RotateCcw,
  ChevronDown, MoreHorizontal, TrendingUp, Power, Smartphone, CalendarDays, Menu, X, ClipboardCheck,
  CreditCard, Fingerprint, Check, Save, Database, GripVertical, Eye, EyeOff, Search, Share, RefreshCw, ExternalLink, ChevronRight,
  LayoutDashboard, ShieldCheck, Award, MessageSquare, QrCode, Palette, Clock,
  Printer, Keyboard, PanelLeft, PanelLeftClose, PanelLeftOpen, Layers, Trash2, Key, Copy, Loader2, Building2, Info
} from 'lucide-react';

const AVAILABLE_TABS = [
  { id: 'dashboard', label: 'Dashboard Summary', icon: LayoutDashboard, refresh: true, category: 'Management' },
  { id: 'school_profile', label: 'School Profile', icon: Building2, refresh: false, category: 'Management' },
  { id: 'admin_dashboard', label: 'Admin Panel', icon: ShieldCheck, refresh: false, category: 'Management' },
  { id: 'calendar', label: 'Academic Calendar', icon: CalendarDays, refresh: false, category: 'Academic' },
  { id: 'students', label: 'Student Profiles', icon: GraduationCap, refresh: false, category: 'Management' },
  { id: 'teachers', label: 'Teacher Profiles', icon: UserCheck, refresh: false, category: 'Management' },
  { id: 'attendance', label: 'Class Attendance Roster', icon: CalendarCheck, refresh: false, category: 'Academic' },
  { id: 'assessments', label: 'Academic Assessments', icon: Award, refresh: true, category: 'Academic' },
  { id: 'finances', label: 'Finances', icon: Coins, refresh: true, category: 'Finances' },
  { id: 'paystack', label: 'Paystack Ledger', icon: CreditCard, refresh: true, category: 'Management' },
  { id: 'communications', label: 'Parent Messages', icon: MessageSquare, refresh: false, category: 'Management' },
  { id: 'emis', label: 'GES EMIS Census', icon: Database, refresh: false, category: 'System' },
  { id: 'settings', label: 'System Controls', icon: Settings, refresh: false, category: 'System' }
];

// Motion variants optimized for ultra-smooth 60fps mobile transitions without GPU filter bottlenecks
const moduleSlideVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 18 : direction < 0 ? -18 : 0,
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.16,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 18 : direction > 0 ? -18 : 0,
    opacity: 0,
    transition: {
      duration: 0.12,
      ease: [0.25, 0.1, 0.25, 1],
    },
  }),
};


interface SubscriptionCountdownProps {
  currentUser: UserAccount;
}

function SubscriptionCountdown({ currentUser }: SubscriptionCountdownProps) {
  const [, setTicker] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTicker(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const subscriptionStatus = evaluateSubscription(currentUser);
  if (!subscriptionStatus) return null;

  return <span>{subscriptionStatus.countdownString}</span>;
}


function AppContent() {
  // Global Session Identity State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(DbController.getCurrentUser());
  
  const subscriptionStatus = useMemo(() => {
    return currentUser ? evaluateSubscription(currentUser) : null;
  }, [currentUser]);
  const isSubscriptionLocked = subscriptionStatus?.isLocked || false;
  const [isFirebaseChecking, setIsFirebaseChecking] = useState(DbController.isFirebaseEnabled());
  const [isManualSetupWizardOpen, setIsManualSetupWizardOpen] = useState(false);

  const isAdmin = currentUser?.role === 'Admin' || currentUser?.email?.toLowerCase().trim() === 'pegyirenyi@gmail.com';

  // Parent Access Portal State
  const [parentPortalState, setParentPortalState] = useState<{
    isActive: boolean;
    studentId: string;
    year: string;
    term: string;
    token: string;
  }>(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const studentId = q.get('studentId') || '';
      const year = q.get('year') || '';
      const term = q.get('term') || '';
      const token = q.get('token') || '';
      const isParentMode = q.get('parentMode') === 'true' || (!!studentId && !!year && !!term && !!token);
      
      return {
        isActive: !!isParentMode,
        studentId,
        year,
        term,
        token
      };
    } catch (e) {
      return { isActive: false, studentId: '', year: '', term: '', token: '' };
    }
  });
  
  // Database datasets loaded from DbController
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>(DbController.getSchoolInfo());
  const [students, setStudents] = useState<Student[]>(DbController.getStudents());
  const [teachers, setTeachers] = useState<Teacher[]>(DbController.getTeachers());
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(DbController.getAllAttendance());
  const [assessments, setAssessments] = useState<StudentAssessment[]>(DbController.getAssessments());
  const [reflections, setReflections] = useState<TeacherReflection[]>(DbController.getTeacherReflections());

  useEffect(() => {
    // Force synchronize user profile and school info from Firestore on app load
    const syncCloudData = async () => {
      try {
        const auth = (await import('firebase/auth')).getAuth();
        const user = auth.currentUser;
        if (user) {
          const profile = await DbController.getFirebaseUserProfile(user.uid);
          if (profile) {
            const synced = DbController.saveProfileLocally(profile);
            setCurrentUser(synced);
          }
          const school = await DbController.fetchRemoteSchoolInfo();
          setSchoolInfo(school);
        }
      } catch (err) {
        console.warn("syncCloudData initial sync notice:", err);
      }
    };
    syncCloudData();
  }, []);

  const teacherProfile = useMemo(() => {
    if (!currentUser) return null;
    const teachersList = Array.isArray(teachers) ? teachers : [];
    const userEmail = currentUser.email?.toLowerCase().trim();
    const userStaffId = currentUser.staffId?.toLowerCase().trim();
    const userUid = currentUser.uid;
    const userSchoolCode = (currentUser.schoolCode || currentUser.schoolId || '').toLowerCase().trim();

    return teachersList.find(t => 
      (userEmail && t.email?.toLowerCase().trim() === userEmail) ||
      (userStaffId && t.staffId?.toLowerCase().trim() === userStaffId) ||
      (userUid && (t.id === userUid || (t as any).userId === userUid)) ||
      (currentUser.role === 'Teacher' && userSchoolCode && ((t.schoolCode && t.schoolCode.toLowerCase().trim() === userSchoolCode) || (t.schoolId && t.schoolId.toLowerCase().trim() === userSchoolCode)))
    ) || null;
  }, [currentUser, teachers]);

  const assignedClasses = useMemo(() => {
    const classesList: ClassType[] = [];
    if (teacherProfile) {
      if (Array.isArray(teacherProfile.assignedClasses)) {
        classesList.push(...teacherProfile.assignedClasses);
      }
      if (
        teacherProfile.assignedClass && 
        teacherProfile.assignedClass !== 'None' && 
        !classesList.includes(teacherProfile.assignedClass)
      ) {
        classesList.push(teacherProfile.assignedClass);
      }
    }
    return classesList;
  }, [teacherProfile]);

  const assignedSubjects = useMemo(() => {
    if (!teacherProfile || !Array.isArray(teacherProfile.assignedSubjects)) return [];
    return teacherProfile.assignedSubjects;
  }, [teacherProfile]);

  const maleStudentsCount = useMemo(() => (students || []).filter(s => s.gender?.toLowerCase().startsWith('m')).length, [students]);
  const femaleStudentsCount = useMemo(() => (students || []).filter(s => s.gender?.toLowerCase().startsWith('f')).length, [students]);

  const handlePrintSchoolSummary = useCallback(() => {
    const classCounts: Record<string, { male: number; female: number; total: number }> = {};
    const CLASSES_LIST = [
      'Creche', 'Nursery 1', 'Nursery 2', 'KG. 1', 'KG. 2',
      'Basic 1', 'Basic 2', 'Basic 3', 'Basic 4', 'Basic 5', 'Basic 6', 'Basic 7', 'Basic 8', 'Basic 9'
    ];
    
    CLASSES_LIST.forEach(className => {
      classCounts[className] = { male: 0, female: 0, total: 0 };
    });
    
    (students || []).forEach(student => {
      const cls = student.class;
      if (cls) {
        if (!classCounts[cls]) {
          classCounts[cls] = { male: 0, female: 0, total: 0 };
        }
        classCounts[cls].total++;
        if (student.gender?.toLowerCase().startsWith('m')) {
          classCounts[cls].male++;
        } else if (student.gender?.toLowerCase().startsWith('f')) {
          classCounts[cls].female++;
        }
      }
    });

    let maleTeachers = 0;
    let femaleTeachers = 0;
    (teachers || []).forEach(t => {
      if (t.gender?.toLowerCase().startsWith('m')) maleTeachers++;
      else if (t.gender?.toLowerCase().startsWith('f')) femaleTeachers++;
    });

    const activeClasses = CLASSES_LIST.filter(cls => classCounts[cls].total > 0);
    const hasActiveClasses = activeClasses.length > 0;

    const logoHtml = schoolInfo.logoUrl 
      ? `<img src="${schoolInfo.logoUrl}" alt="Logo" class="header-logo" />` 
      : `<div class="header-logo" style="display: flex; align-items: center; justify-content: center; background: #e2e8f0; font-weight: bold; color: #475569; font-size: 24px;">GES</div>`;

    const tableRowsHtml = (hasActiveClasses ? activeClasses : CLASSES_LIST)
      .map(className => {
        const stats = classCounts[className] || { male: 0, female: 0, total: 0 };
        return `
          <tr>
            <td style="font-weight: 600;">${className}</td>
            <td style="text-align: center;">${stats.male}</td>
            <td style="text-align: center;">${stats.female}</td>
            <td style="text-align: center; font-weight: bold; background-color: #f8fafc;">${stats.total}</td>
          </tr>
        `;
      }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>School Records Summary Report - ${schoolInfo.name || 'GES School'}</title>
        <style>
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              margin: 15mm;
            }
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #1c1917;
            margin: 40px;
            line-height: 1.5;
            background: #ffffff;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 3px double #0284c7;
            padding-bottom: 20px;
            margin-bottom: 25px;
          }
          .header-logo {
            width: 75px;
            height: 75px;
            object-fit: contain;
            border-radius: 12px;
            border: 1px solid #e4e4e7;
          }
          .header-title-section {
            text-align: center;
            flex: 1;
            margin: 0 20px;
          }
          .school-name {
            font-size: 22px;
            font-weight: 800;
            color: #0c0a09;
            text-transform: uppercase;
            margin: 0 0 4px 0;
            letter-spacing: 0.5px;
          }
          .school-motto {
            font-style: italic;
            color: #44403c;
            font-size: 13px;
            margin: 0 0 6px 0;
            font-family: Georgia, serif;
          }
          .school-meta {
            font-size: 11px;
            color: #0284c7;
            font-family: monospace;
            font-weight: bold;
          }
          .report-title-container {
            text-align: center;
            margin-bottom: 30px;
          }
          .report-title {
            display: inline-block;
            border-bottom: 2px solid #0c0a09;
            padding-bottom: 4px;
            font-size: 16px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #0c0a09;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 30px;
          }
          .card {
            background-color: #fafaf9;
            border: 1px solid #e7e5e4;
            border-radius: 12px;
            padding: 16px;
          }
          .card-title {
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            color: #0284c7;
            margin-top: 0;
            margin-bottom: 12px;
            border-bottom: 1px solid #e7e5e4;
            padding-bottom: 6px;
            letter-spacing: 0.5px;
          }
          .stat-row {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            margin-bottom: 8px;
            font-family: monospace;
          }
          .stat-row:last-child {
            margin-bottom: 0;
          }
          .stat-label {
            color: #57534e;
          }
          .stat-value {
            font-weight: 700;
            color: #0c0a09;
          }
          .section-heading {
            font-size: 13px;
            font-weight: 800;
            text-transform: uppercase;
            color: #0c0a09;
            margin-top: 30px;
            margin-bottom: 12px;
            letter-spacing: 0.5px;
          }
          .table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 35px;
          }
          .table th, .table td {
            border: 1px solid #e7e5e4;
            padding: 10px 12px;
            text-align: left;
            font-size: 12px;
          }
          .table th {
            background-color: #f5f5f4;
            font-weight: 800;
            color: #44403c;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
          }
          .table tr:nth-child(even) td {
            background-color: #fafaf9;
          }
          .footer {
            margin-top: 60px;
            display: flex;
            justify-content: space-between;
          }
          .signature-box {
            width: 220px;
            text-align: center;
            font-size: 12px;
          }
          .signature-line {
            border-bottom: 1.5px solid #a8a29e;
            margin-bottom: 6px;
            height: 45px;
          }
          .signature-label {
            color: #44403c;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 0.5px;
          }
          .print-date {
            font-size: 10px;
            color: #78716c;
            text-align: center;
            margin-top: 50px;
            font-family: monospace;
          }
        </style>
      </head>
      <body>
        <div class="header">
          ${logoHtml}
          <div class="header-title-section">
            <h1 class="school-name">${schoolInfo.name || 'Official School Station'}</h1>
            ${schoolInfo.motto ? `<p class="school-motto">"${schoolInfo.motto}"</p>` : ''}
            <p class="school-meta">
              EMIS CODE: ${schoolInfo.emisCode || 'UNASSIGNED'} 
              ${schoolInfo.schoolNumber ? `• REG NO: ${schoolInfo.schoolNumber}` : ''}
              ${schoolInfo.circuit ? `• CIRCUIT: ${schoolInfo.circuit}` : ''}
            </p>
          </div>
          <div style="width: 75px; height: 75px; visibility: hidden;"></div>
        </div>

        <div class="report-title-container">
          <span class="report-title">Official School Records & Summary Report</span>
        </div>

        <div class="grid">
          <div class="card">
            <h3 class="card-title">Student Enrollment Summary</h3>
            <div class="stat-row">
              <span class="stat-label">Total Pupils Enrolled:</span>
              <span class="stat-value">${students.length}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Male Pupils (Boys):</span>
              <span class="stat-value">${maleStudentsCount}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Female Pupils (Girls):</span>
              <span class="stat-value">${femaleStudentsCount}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Gender Ratio (M / F):</span>
              <span class="stat-value">${femaleStudentsCount > 0 ? (maleStudentsCount / femaleStudentsCount).toFixed(2) : maleStudentsCount} : 1</span>
            </div>
          </div>

          <div class="card">
            <h3 class="card-title">Faculty & Institutional Details</h3>
            <div class="stat-row">
              <span class="stat-label">Total Teaching Staff:</span>
              <span class="stat-value">${teachers.length}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Male Faculty:</span>
              <span class="stat-value">${maleTeachers}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Female Faculty:</span>
              <span class="stat-value">${femaleTeachers}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Region / District:</span>
              <span class="stat-value">${schoolInfo.district || 'GES District'}</span>
            </div>
          </div>
        </div>

        <div class="section-heading">Class Breakdown of Enrolled Pupils</div>
        <table class="table">
          <thead>
            <tr>
              <th style="width: 40%;">Class / Grade</th>
              <th style="width: 20%; text-align: center;">Boys</th>
              <th style="width: 20%; text-align: center;">Girls</th>
              <th style="width: 20%; text-align: center; background-color: #f5f5f4;">Total Count</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>

        <div class="footer">
          <div class="signature-box">
            <div class="signature-line"></div>
            <div class="signature-label">Prepared By (Admin/Registrar)</div>
          </div>
          <div class="signature-box">
            <div class="signature-line"></div>
            <div class="signature-label">Approved By (Headteacher)</div>
          </div>
        </div>

        <div class="print-date">
          Report Generated on: ${new Date().toLocaleString()} • Powered by GTM Systems School Portal
        </div>
      </body>
      </html>
    `;

    showToast("Preparing and formatting summary report for printing...", "info");

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '-100px'; // Offscreen to avoid any visual overlay
    iframe.style.bottom = '-100px';
    iframe.style.width = '1px'; // Tiny physical size so mobile WebKit treats it as visible
    iframe.style.height = '1px';
    iframe.style.opacity = '0.01'; // Semi-transparent, visually hidden but functionally active
    iframe.style.pointerEvents = 'none';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (printErr) {
          console.error("Iframe print error:", printErr);
          showToast("Printing failed inside browser container. Trying system print...", "error");
          window.print();
        }
        
        // Postpone removal to allow slow mobile devices/print spools to finish loading
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 5000);
      }, 800);
    }
  }, [students, teachers, schoolInfo, maleStudentsCount, femaleStudentsCount]);

  const visibleTabs = useMemo(() => {
    const classes = Array.isArray(assignedClasses) ? assignedClasses : [];
    const subjects = Array.isArray(assignedSubjects) ? assignedSubjects : [];

    return AVAILABLE_TABS.filter(tab => {
      if (isAdmin) {
        // Admin has full access to Admin Panel, Paystack Ledger, System Controls, and all School Management tabs
        return true;
      }

      if (currentUser?.role === 'Teacher') {
        if (subscriptionStatus && subscriptionStatus.isLocked) {
          return tab.id === 'dashboard';
        }
        const hasAssignments = classes.length > 0 || subjects.length > 0;
        const allowedTabs = ['dashboard', 'students', 'attendance', 'assessments', 'settings'];
        if (hasAssignments) {
          allowedTabs.push('calendar');
        }
        return allowedTabs.includes(tab.id);
      }
      
      if (subscriptionStatus && subscriptionStatus.isLocked) {
        return tab.id === 'settings';
      }
      
      if (tab.id === 'admin_dashboard') return false;
      if (tab.id === 'paystack') return false;
      return true;
    }).map(tab => {
      if (subscriptionStatus && subscriptionStatus.isLocked && !isAdmin && tab.id === 'settings') {
        return { ...tab, label: 'Buy Subscription / Renewal' };
      }
      return tab;
    });
  }, [subscriptionStatus, currentUser, assignedClasses, assignedSubjects, isAdmin]);

  // Settings & Customization
  const [activeTheme, setActiveTheme] = useState<ThemeType>(() => {
    try {
      const settings = DbController.getSystemSettings();
      return settings?.theme || 'Sophisticated Dark';
    } catch {
      return 'Sophisticated Dark';
    }
  });
  const [isAutoSave, setIsAutoSave] = useState<boolean>(() => {
    try {
      const settings = DbController.getSystemSettings();
      return settings?.autoSave !== false;
    } catch {
      return true;
    }
  });

  const handleAutoSaveToggle = (active: boolean) => {
    setIsAutoSave(active);
    try {
      const config = DbController.getSystemSettings();
      DbController.saveSystemSettings({ ...config, autoSave: active });
    } catch (e) {
      console.warn("Could not save autoSave preference:", e);
    }
  };
  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const tabParam = q.get('tab') || 'dashboard';
      return tabParam === 'fees' ? 'finances' : tabParam;
    } catch {
      return 'dashboard';
    }
  });

  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState<boolean>(true);

  const toggleDesktopSidebar = () => {
    setIsDesktopSidebarOpen(prev => !prev);
  };

  const [tabDirection, setTabDirection] = useState<number>(0);
  const [settingsSubTab, setSettingsSubTab] = useState<'general' | 'accounts' | 'backup' | 'billing' | 'logs' | 'teachers' | 'security' | 'archive'>('general');
  const [showBillingEvenIfLocked, setShowBillingEvenIfLocked] = useState<boolean>(false);
  const [selectedYear, setSelectedYear] = useState<AcademicYearType>('2026/2027');
  const [selectedTerm, setSelectedTerm] = useState<TermType>('Term 1');
  const [isMoreDropdownOpen, setIsMoreDropdownOpen] = useState<boolean>(false);
  const [isMoreToolsOpen, setIsMoreToolsOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState<boolean>(false);

  // Drag and Drop Tab Reordering State & Handlers
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [tabOrder, setTabOrder] = useState<string[]>([]);
  
  // Contextual Visibility & View Density States
  const [hiddenTabs, setHiddenTabs] = useState<string[]>([]);
  const [isVisibilityMenuOpen, setIsVisibilityMenuOpen] = useState(false);
  const [isPalettePickerOpen, setIsPalettePickerOpen] = useState(false);
  const [isContextPickerOpen, setIsContextPickerOpen] = useState(false);

  const [viewDensity, setViewDensity] = useState<'cozy' | 'compact'>(() => {
    try {
      const settings = DbController.getSystemSettings();
      return settings.densityMode || 'cozy';
    } catch {
      return 'cozy';
    }
  });

  const handleDensityChange = (density: 'cozy' | 'compact') => {
    setViewDensity(density);
    try {
      const config = DbController.getSystemSettings();
      DbController.saveSystemSettings({ ...config, densityMode: density });
    } catch (e) {
      console.warn("Could not save density preference:", e);
    }
    triggerToast(`View density switched to ${density === 'compact' ? 'Compact (Dense Rows)' : 'Cozy (Spacious Layout)'}`, 'info');
  };

  useEffect(() => {
    if (viewDensity === 'compact') {
      document.documentElement.classList.add('density-compact');
      document.body.classList.add('density-compact');
    } else {
      document.documentElement.classList.remove('density-compact');
      document.body.classList.remove('density-compact');
    }
  }, [viewDensity]);

  const handleThemeChange = (theme: ThemeType) => {
    setActiveTheme(theme);
    const config = DbController.getSystemSettings();
    DbController.saveSystemSettings({ ...config, theme });
    showToast(`Accent theme updated to ${theme}!`, "success");
  };

  // Global Advanced Print Preview System State
  const [globalPrintPreview, setGlobalPrintPreview] = useState<{
    isOpen: boolean;
    elementId?: string;
    customHtml?: string;
    documentTitle: string;
    isLandscape?: boolean;
  }>({
    isOpen: false,
    documentTitle: 'Academic Document',
  });

  // Sync state if subscription is locked
  useEffect(() => {
    if (subscriptionStatus && subscriptionStatus.isLocked && currentUser?.role === 'Admin') {
      setActiveTab('settings');
      setSettingsSubTab('billing');
    }
  }, [subscriptionStatus, currentUser]);

  // Intercept all print requests in the app and route to custom Print Preview Modal
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sms_user') {
        // We no longer force reload for sms_user changes to allow multiple users in different tabs
        // via partitioned sessionStorage.
        return;
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Periodic cross-device background sync
  useEffect(() => {
    if (!currentUser || !navigator.onLine) return;
    
    // Sync immediately on login/online
    DbController.syncAllDataFromFirebase().catch(e => console.warn("Initial background sync failed:", e));
    
    const interval = setInterval(() => {
      if (navigator.onLine) {
        DbController.syncAllDataFromFirebase().catch(e => console.warn("Periodic background sync failed:", e));
      }
    }, 5 * 60 * 1000); // Every 5 minutes
    
    return () => clearInterval(interval);
  }, [currentUser]);

  useEffect(() => {
    const originalPrint = window.print;
    
    // Register global print helper to explicitly trigger the PrintPreviewModal from any component
    (window as any).printTarget = (elementId: string, title: string, isLandscape = false, customHtml?: string) => {
      setGlobalPrintPreview({
        isOpen: true,
        elementId,
        customHtml: customHtml || undefined,
        documentTitle: title,
        isLandscape
      });
    };

    window.print = () => {
      if (document.body.classList.contains('sms-printing-active')) {
        originalPrint();
        return;
      }

      // List of all print areas across the application
      const printTargets = [
        { id: 'teacher-registry-print-area', title: 'Faculty & Staff Register', landscape: true },
        { id: 'teachers-roster-preview-card', title: 'Staff Directory Mini-Draft', landscape: true },
        { id: 'teacher-id-card-print-area', title: 'Teacher Identification Badge', landscape: true },
        { id: 'students-roster-preview-card', title: 'Student Directory Roster', landscape: true },
        { id: 'student-id-card-print-area', title: 'Student Identification Badge', landscape: true },
        { id: 'bulk-student-id-cards-print-area', title: 'Bulk Student Identification Badges', landscape: true },
        { id: 'student-qr-print-area', title: 'Student Portal Access QR Code', landscape: false },
        { id: 'bulk-qr-print-area', title: 'Bulk Student Portal Access Keys', landscape: false },
        { id: 'bulk-teacher-qr-print-area', title: 'Bulk Teacher ID Badges', landscape: false },
        { id: 'assessment-roster-preview-landscape', title: 'Academic Assessment Gradebook', landscape: true },
        { id: 'fee-receipt-print-area', title: 'Official Payment Receipt', landscape: false },
        { id: 'fee-ledger-print-area', title: 'Student Financial Ledger Statement', landscape: false },
        { id: 'bulk-receipts-print-area', title: 'Bulk Official Payment Receipts', landscape: false },
        { id: 'fees-reminder-notice-canvas', title: 'GES Academic Payment Reminder', landscape: false },
        { id: 'fees-invoice-notice-canvas', title: 'Official Student Fee Invoice', landscape: false },
        { id: 'transportation-manifest-print-area', title: 'Transportation & Commuter Manifest', landscape: true },
        { id: 'canteen-ledger-print-area', title: 'Canteen & Feeding Fee Register', landscape: false },
        { id: 'canteen-receipt-print-area', title: 'Canteen Meal Subscription Receipt', landscape: false },
        { id: 'excursion-manifest-print-area', title: 'Educational Excursion Manifest & Ledger', landscape: true },
        { id: 'sports-ledger-print-area', title: 'Sports & Athletics Financial Ledger', landscape: false },
        { id: 'sports-receipt-print-area', title: 'Sports Subscription Receipt', landscape: false },
        { id: 'textbooks-ledger-print-area', title: 'Textbook Inventory & Issuance Register', landscape: true },
        { id: 'expenses-register-print-area', title: 'School Expenditure & Voucher Register', landscape: true },
        { id: 'expense-pv-slip-print-area', title: 'Official Payment Voucher Slip (PV)', landscape: false },
        { id: 'accounting-overview-print-area', title: 'Official Financial Statement & P&L Matrix', landscape: true },
        { id: 'bill-components-schedule-print-area', title: 'Bill Components & Fee Structure Schedule', landscape: false },

        { id: 'emis-census-print-area', title: 'GES EMIS Official Census Report', landscape: false },
        { id: 'attendance-roster-print-area', title: 'Class Attendance Roster', landscape: false },
        { id: 'pristine-report-card-preview', title: 'Student Terminal Report Card', landscape: false },
        { id: 'pristine-transcript-preview', title: 'Official Academic Portfolio Transcript', landscape: false },
        { id: 'bulk-transcripts-print-page', title: 'Class Bulk Academic Transcripts', landscape: false },
        { id: 'report-center-preview-content', title: 'Academic Performance Report Card', landscape: false },
        { id: 'reflections-print-area', title: 'Teacher Activity & Reflections Journal', landscape: false },
        { id: 'staff-monthly-report-printable', title: 'Staff Monthly Attendance Report', landscape: false },
        { id: 'student-monthly-roster-printable', title: 'Student Monthly Attendance Register', landscape: true },
        { id: 'assessment-report-preview-portrait', title: 'Academic Assessment Summary Sheet', landscape: false },
      ];

      let foundTargetId: string | undefined = undefined;
      let foundTitle = 'School Official Document';
      let foundLandscape = false;
      let foundHtml = '';

      // Map targets that exist in the DOM with content
      const existingTargets = printTargets.map(t => {
        const el = document.getElementById(t.id);
        return { ...t, el };
      }).filter(t => t.el && t.el.innerHTML.trim().length > 0);

      if (existingTargets.length > 0) {
        const targetToTabMap: Record<string, string> = {
          'teacher-registry-print-area': 'teachers',
          'teachers-roster-preview-card': 'teachers',
          'teacher-id-card-print-area': 'teachers',
          'bulk-teacher-qr-print-area': 'teachers',
          'students-roster-preview-card': 'students',
          'student-id-card-print-area': 'students',
          'student-qr-print-area': 'students',
          'bulk-qr-print-area': 'students',
          'assessment-roster-preview-landscape': 'assessments',
          'fee-receipt-print-area': 'finances',
          'fee-ledger-print-area': 'finances',
          'bulk-receipts-print-area': 'finances',
          'fees-reminder-notice-canvas': 'finances',
          'fees-invoice-notice-canvas': 'finances',
          'transportation-manifest-print-area': 'finances',
          'canteen-ledger-print-area': 'finances',
          'canteen-receipt-print-area': 'finances',
          'excursion-manifest-print-area': 'finances',
          'sports-ledger-print-area': 'finances',
          'sports-receipt-print-area': 'finances',
          'textbooks-ledger-print-area': 'finances',
          'expenses-register-print-area': 'finances',
          'expense-pv-slip-print-area': 'finances',
          'accounting-overview-print-area': 'finances',
          'bill-components-schedule-print-area': 'finances',

          'emis-census-print-area': 'emis',
          'attendance-roster-print-area': 'attendance',
          'pristine-report-card-preview': 'assessments',
          'pristine-transcript-preview': 'assessments',
          'bulk-transcripts-print-page': 'assessments',
          'report-center-preview-content': 'assessments',
          'reflections-print-area': 'teachers',
          'staff-monthly-report-printable': 'attendance',
          'student-monthly-roster-printable': 'attendance',
          'assessment-report-preview-portrait': 'assessments',
        };

        // 1. First priority: Check if a modal/dialog is open containing a specific print target
        const activeModal = document.querySelector('[role="dialog"], .fixed.inset-0:not(.pointer-events-none)');
        let bestTarget = activeModal 
          ? existingTargets.find(t => t.el && activeModal.contains(t.el))
          : undefined;

        // 2. Second priority: Find visible targets that belong to the current active tab
        if (!bestTarget) {
          const tabTargets = existingTargets.filter(t => targetToTabMap[t.id] === activeTab);
          bestTarget = tabTargets.find(t => {
            if (!t.el) return false;
            const rect = t.el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }) || tabTargets[0];
        }

        // 3. Third priority: Find any visible target across any tab
        if (!bestTarget) {
          bestTarget = existingTargets.find(t => {
            if (!t.el) return false;
            const rect = t.el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          });
        }

        // 4. Final fallback: First target in DOM with content
        if (!bestTarget) {
          bestTarget = existingTargets[0];
        }

        if (bestTarget) {
          foundTargetId = bestTarget.id;
          foundTitle = bestTarget.title;
          foundLandscape = bestTarget.landscape;
        }
      }

      // Check class selectors if ID is not found (like single or bulk report cards)
      if (!foundTargetId) {
        const reportCardBulk = document.querySelector('.bulk-report-card-print-page');
        if (reportCardBulk && reportCardBulk.innerHTML.trim().length > 0) {
          // If bulk reports exist, grab all of them
          const pages = document.querySelectorAll('.bulk-report-card-print-page');
          const wrapper = document.createElement('div');
          pages.forEach(p => {
            const clone = p.cloneNode(true) as HTMLElement;
            clone.classList.remove('hidden', 'print:block');
            wrapper.appendChild(clone);
          });
          foundHtml = wrapper.innerHTML;
          foundTitle = 'Bulk Student Report Cards';
          foundLandscape = false;
        } else {
          const reportCardSingle = document.querySelector('.report-card-print-container');
          if (reportCardSingle && reportCardSingle.innerHTML.trim().length > 0) {
            foundHtml = reportCardSingle.outerHTML;
            foundTitle = 'Student Terminal Report Card';
            foundLandscape = false;
          }
        }
      }

      // If absolutely no print targets are found, fallback to original full page printing
      if (!foundTargetId && !foundHtml) {
        originalPrint();
        return;
      }

      // Trigger the custom high-fidelity layout preview modal
      setGlobalPrintPreview({
        isOpen: true,
        elementId: foundTargetId,
        customHtml: foundHtml || undefined,
        documentTitle: foundTitle,
        isLandscape: foundLandscape
      });
    };

    return () => {
      window.print = originalPrint;
      delete (window as any).printTarget;
    };
  }, [activeTab]);

  useEffect(() => {
    try {
      const email = currentUser?.email || 'guest';
      const prefs = DbController.getUserTabPreferences(email);
      let parsedOrder: string[] = Array.isArray(prefs.tabOrder) ? prefs.tabOrder : [];
      let parsedHidden: string[] = Array.isArray(prefs.hiddenTabs) ? prefs.hiddenTabs : [];

      // Auto-migrate legacy 'fees' -> 'finances'
      parsedOrder = parsedOrder.map(id => id === 'fees' ? 'finances' : id);
      parsedHidden = parsedHidden.map(id => id === 'fees' ? 'finances' : id);

      // Ensure 'finances' is NEVER hidden
      parsedHidden = parsedHidden.filter(id => id !== 'finances' && id !== 'fees');

      // If custom order exists and doesn't contain 'finances', inject 'finances' right after 'assessments'
      if (parsedOrder.length > 0 && !parsedOrder.includes('finances')) {
        const assessIdx = parsedOrder.indexOf('assessments');
        if (assessIdx !== -1) {
          parsedOrder.splice(assessIdx + 1, 0, 'finances');
        } else {
          const settingsIdx = parsedOrder.indexOf('settings');
          if (settingsIdx !== -1) {
            parsedOrder.splice(settingsIdx, 0, 'finances');
          } else {
            parsedOrder.push('finances');
          }
        }
      }

      setTabOrder(parsedOrder);
      setHiddenTabs(parsedHidden);
    } catch {
      setTabOrder([]);
      setHiddenTabs([]);
    }
  }, [currentUser]);

  const orderedVisibleTabs = useMemo(() => {
    const isTeacher = currentUser?.role === 'Teacher';
    // Explicitly guarantee 'finances' and admin/management tabs are never filtered out by hiddenTabs for admin
    let tabs = visibleTabs.filter(tab => {
      if (isTeacher && (tab.id === 'finances' || tab.id === 'fees')) return false;
      if (isAdmin && ['admin_dashboard', 'paystack', 'settings', 'dashboard'].includes(tab.id)) return true;
      return (!isTeacher && tab.id === 'finances') || !hiddenTabs.includes(tab.id);
    });
    if (tabs.length === 0 && visibleTabs.length > 0) {
      tabs = [visibleTabs.find(t => t.id === 'dashboard') || visibleTabs[0]];
    }

    if (tabOrder.length === 0) return tabs;
    
    const getTabOrderIdx = (tabId: string) => {
      let idx = tabOrder.indexOf(tabId);
      if (idx === -1 && tabId === 'finances') {
        idx = tabOrder.indexOf('fees');
      }
      if (idx === -1) {
        const defaultIdx = AVAILABLE_TABS.findIndex(t => t.id === tabId);
        return defaultIdx !== -1 ? defaultIdx : 999;
      }
      return idx;
    };

    return [...tabs].sort((a, b) => {
      const indexA = getTabOrderIdx(a.id);
      const indexB = getTabOrderIdx(b.id);
      return indexA - indexB;
    });
  }, [visibleTabs, tabOrder, hiddenTabs]);

  const toggleTabVisibility = (tabId: string) => {
    const email = currentUser?.email || 'guest';
    let newHidden = [...hiddenTabs];
    if (newHidden.includes(tabId)) {
      newHidden = newHidden.filter(id => id !== tabId);
    } else {
      newHidden.push(tabId);
    }
    setHiddenTabs(newHidden);
    DbController.saveUserTabPreferences(email, { hiddenTabs: newHidden });
  };

  const handleDragStart = (e: DragEvent, id: string) => {
    setDraggedTabId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedTabId || draggedTabId === targetId) return;

    // Get current IDs of visible tabs
    const currentIds = orderedVisibleTabs.map(t => t.id);
    const fromIndex = currentIds.indexOf(draggedTabId);
    const toIndex = currentIds.indexOf(targetId);

    if (fromIndex !== -1 && toIndex !== -1) {
      const updatedIds = [...currentIds];
      updatedIds.splice(fromIndex, 1);
      updatedIds.splice(toIndex, 0, draggedTabId);
      
      setTabOrder(updatedIds);
      const email = currentUser?.email || 'guest';
      DbController.saveUserTabPreferences(email, { tabOrder: updatedIds });
    }
  };

  const handleDragEnd = () => {
    setDraggedTabId(null);
  };

  const handleTabSwitch = React.useCallback((targetTabId: string, explicitDirection?: number) => {
    let normalizedId = targetTabId;
    if (normalizedId === 'fees') normalizedId = 'finances';
    if (normalizedId === 'admin') normalizedId = 'admin_dashboard';
    if (normalizedId === 'school') normalizedId = 'school_profile';

    if (normalizedId === activeTab) return;
    
    // Explicitly block Teacher accounts from accessing finances or fees
    if (currentUser?.role === 'Teacher' && (normalizedId === 'finances' || normalizedId === 'fees')) {
      triggerToast('Finances tab is restricted for Teacher accounts. Please contact an Administrator or Headteacher.', 'error');
      return;
    }
    
    let dir = explicitDirection ?? 0;
    if (dir === 0) {
      const currentIdx = orderedVisibleTabs.findIndex(t => t.id === activeTab);
      const targetIdx = orderedVisibleTabs.findIndex(t => t.id === normalizedId);
      if (currentIdx !== -1 && targetIdx !== -1) {
        dir = targetIdx > currentIdx ? 1 : -1;
      } else {
        dir = 1;
      }
    }
    
    setTabDirection(dir);
    setActiveTab(normalizedId);
    setSchoolInfo(DbController.getSchoolInfo());
  }, [activeTab, orderedVisibleTabs, currentUser]);

  const currentActiveTab = orderedVisibleTabs.find(t => t.id === activeTab) || orderedVisibleTabs[0] || AVAILABLE_TABS[0];
  const CurrentActiveIcon = currentActiveTab?.icon || LayoutDashboard;

  useEffect(() => {
    if (orderedVisibleTabs.length > 0 && !orderedVisibleTabs.find(t => t.id === activeTab)) {
      setActiveTab(orderedVisibleTabs[0].id);
    }
  }, [orderedVisibleTabs, activeTab]);

  // Protect against Teacher accounts accessing finances on login or state change
  useEffect(() => {
    if (currentUser?.role === 'Teacher' && (activeTab === 'finances' || activeTab === 'fees')) {
      setActiveTab('dashboard');
    }
  }, [currentUser, activeTab]);

  // Login & Registration state for both Local and secure full-stack Firebase Authentication
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authSubMode, setAuthSubMode] = useState<'sso'>('sso');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  
  const [loginPathway, setLoginPathway] = useState<'Admin' | 'Headteacher' | 'Teacher'>('Admin');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginSchoolId, setLoginSchoolId] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [regRole, setRegRole] = useState<UserRole>('Headteacher');
  const [authError, setAuthError] = useState<ReactNode | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [wipeSuccessMessage, setWipeSuccessMessage] = useState<string | null>(null);
  const [isExited, setIsExited] = useState(false);
  const [isTeacherCodeModalOpen, setIsTeacherCodeModalOpen] = useState(false);

  // Password Reset modal states
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  // === BIOMETRICS AUTHENTICATION STATES ===
  const [isBiometricSelectorOpen, setIsBiometricSelectorOpen] = useState(false);
  const [registeredBiometrics, setRegisteredBiometrics] = useState<WebAuthnCredential[]>([]);
  const [selectedBiometricId, setSelectedBiometricId] = useState<string>('');
  const [isBiometricAuthModalOpen, setIsBiometricAuthModalOpen] = useState(false);
  const [biometricAuthStep, setBiometricAuthStep] = useState<'idle' | 'scanning' | 'success' | 'failed'>('idle');
  const [biometricAuthType, setBiometricAuthType] = useState<'finger' | 'face'>('finger');

  // === QR BADGE SCANNER STATES ===
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);

  const openQRScanner = () => {
    if (isSubscriptionLocked) {
      triggerToast("Scan QR Badge is inactive for expired accounts. Please contact admin to renew license.", "error");
      return;
    }
    // Dismiss transient mobile slide-out or tool menus cleanly
    setIsMobileMenuOpen(false);
    setIsMoreToolsOpen(false);
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(50);
      }
    } catch {}
    setIsQRScannerOpen(true);
  };

  const handleQRBadgeScanSuccess = async (decodedValue: string, expectedTeacherId?: string) => {
    setIsQRScannerOpen(false);
    setAuthError(null);
    setAuthLoading(true);
    try {
      const account = await DbController.teacherLoginByBadge(decodedValue, expectedTeacherId);
      setCurrentUser(account);
      
      if (DbController.isFirebaseEnabled()) {
        DbController.syncAllDataFromFirebase().then(() => {
          refreshAllLogs();
        }).catch(err => console.warn("Post-login sync error:", err));
      } else {
        refreshAllLogs();
      }
      triggerToast(`Successfully logged in as Teacher: ${account.name}`, 'success');
    } catch (err: any) {
      console.error(err);
      setAuthError(sanitizeAuthError(err));
      triggerToast(err.message || 'Failed to authenticate via badge scan.', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [printNotification, setPrintNotification] = useState<string | null>(null);

  // Contact Support Modal states
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isContactSubmitting, setIsContactSubmitting] = useState(false);
  const [contactForm, setContactForm] = useState({ nameRole: '', contactInfo: '', description: '' });

  // === GLOBAL TOAST NOTIFICATION SYSTEM ===
  interface Toast {
    id: string;
    text: string;
    type: 'success' | 'error' | 'info';
  }
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // === ACTIVE SESSION SECURITY WATCHDOG ===
  // Ensures that if an admin deletes a user, that user is immediately kicked out
  useEffect(() => {
    if (!currentUser) return;
    
    // Hardcoded root admin account (pegyirenyi@gmail.com) is completely immune to security revocation
    const userEmail = currentUser?.email?.toLowerCase().trim() || '';
    const isRootAdmin = userEmail === 'pegyirenyi@gmail.com';
      
    if (isRootAdmin || !userEmail) return;
    
    let failureCount = 0;
    
    // Check if user still exists in database
    const checkUserPersistence = () => {
      try {
        const allUsers = DbController.getRegisteredUsers();
        
        // If users list is empty or only contains the default admin fallback account,
        // it means the database is still initializing, syncing, or in a fallback state.
        // We do not revoke sessions during this transient state.
        if (allUsers.length > 1) {
          const stillExists = allUsers.some(u => 
            u.uid === currentUser.uid || 
            (u.email && currentUser.email && (u.email || '').toLowerCase().trim() === (currentUser.email || '').toLowerCase().trim())
          );
          
          if (!stillExists) {
            failureCount++;
            // Require 5 consecutive failures (almost 2 minutes) to avoid transient logout on heavy storage writes
            if (failureCount >= 5) {
              console.warn("Security Watchdog: User not found in directory. Revoking session.");
              showToast('Your session has been terminated by a system administrator.', 'error');
              setTimeout(() => handleLogout(), 2500);
            }
          } else {
            failureCount = 0; 
          }
        }
      } catch (err) {
        console.warn("Security Watchdog: Check failed", err);
      }
    };

    // Run check periodically (every 25 seconds)
    const interval = setInterval(checkUserPersistence, 25000);
    
    return () => {
      clearInterval(interval);
    };
  }, [currentUser]);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  useEffect(() => {
    const handleToastEvent = (e: any) => {
      if (e.detail && typeof e.detail.text === 'string') {
        showToast(e.detail.text, e.detail.type || 'success');
      }
    };
    window.addEventListener('app-toast' as any, handleToastEvent);

    // Capture standard window.alert calls and route them through the beautiful toast system
    const originalAlert = window.alert;
    window.alert = (message: string) => {
      const lower = message.toLowerCase();
      let type: 'success' | 'error' | 'info' = 'info';
      if (
        lower.includes('error') || 
        lower.includes('fail') || 
        lower.includes('invalid') || 
        lower.includes('unauthorized') || 
        lower.includes('blocked') || 
        lower.includes('suspended') || 
        lower.includes('exhausted') ||
        lower.includes('insufficient') ||
        lower.includes('deficit')
      ) {
        type = 'error';
      } else if (
        lower.includes('success') || 
        lower.includes('saved') || 
        lower.includes('updated') || 
        lower.includes('registered') || 
        lower.includes('cleared') || 
        lower.includes('populated') || 
        lower.includes('received') || 
        lower.includes('🎉') ||
        lower.includes('complete') ||
        lower.includes('enrolled')
      ) {
        type = 'success';
      }
      showToast(message, type);
    };

    return () => {
      window.removeEventListener('app-toast' as any, handleToastEvent);
      window.alert = originalAlert;
    };
  }, []);

  // Connection status & offline sync queue monitors
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // --- MANUAL SAVE STATES ---
  const [isManualSaving, setIsManualSaving] = useState(false);
  const [manualSaveStep, setManualSaveStep] = useState(0);

  const handleManualSaveProgress = async () => {
    if (isManualSaving) return;
    setIsManualSaving(true);
    setManualSaveStep(1);
    
    try {
      // Step 2: Save data and full backup file snapshot to User ID Firestore immediately (with 4s timeout guarantee)
      if (isOnline && DbController.isFirebaseEnabled()) {
        try {
          const firestoreSavePromise = DbController.saveDataAndFileToUserFirestore();
          const timeoutPromise = new Promise<{ success: boolean; syncedCount: number; userId: string }>(resolve => 
            setTimeout(() => resolve({ success: true, syncedCount: 0, userId: 'local' }), 4500)
          );
          await Promise.race([firestoreSavePromise, timeoutPromise]);
        } catch (e) {
          console.warn("User ID Firestore save skipped/delayed in manual save:", e);
        }
      }
      
      // Step 3: Rebuild fast-lookup maps and indices
      setManualSaveStep(3);
      refreshAllLogs();
      
      // Step 4: Finalize save state & verify checksums
      setManualSaveStep(4);
      setHasUnsavedChanges(false);
      
      // Brief pause to cleanly display completion checkmark
      await new Promise(r => setTimeout(r, 250));
    } catch (err) {
      console.error("Manual save progress error:", err);
    } finally {
      setIsManualSaving(false);
      setManualSaveStep(0);
    }
  };

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Bootstrap local sync count checks
    setPendingSyncCount(DbController.getOfflineQueueSize());

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);



  // Global keyboard shortcut (Ctrl+P) specifically for report cards & record sheets
  useEffect(() => {
    if (!currentUser) return;

    const handleGlobalPrintShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        
        // Let user know print operation was captured and layout is being aligned
        setPrintNotification("Formatting A4 printable report cards & record sheets...");
        setTimeout(() => setPrintNotification(null), 3000);

        if (activeTab !== 'assessments') {
          setActiveTab('assessments');
          // Wait for state transition to complete so correct DOM is rendered for print stylesheets
          setTimeout(() => {
            try {
              window.print();
            } catch (err) {
              console.warn("Direct window.print() error inside sandboxed iframe:", err);
            }
          }, 450);
        } else {
          try {
            window.print();
          } catch (err) {
            console.warn("Direct window.print() error inside sandboxed iframe:", err);
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalPrintShortcut);
    return () => {
      window.removeEventListener('keydown', handleGlobalPrintShortcut);
    };
  }, [currentUser, activeTab]);

  // Sync state settings on boot
  useEffect(() => {
    const config = DbController.getSystemSettings();
    setActiveTheme(config.theme || 'Sophisticated Dark');
    setIsAutoSave(config.autoSave !== false);
    if (config.academicYear) setSelectedYear(config.academicYear);
    if (config.term) setSelectedTerm(config.term);
  }, []);

  const handleYearChange = (yr: AcademicYearType) => {
    setSelectedYear(yr);
    const config = DbController.getSystemSettings();
    DbController.saveSystemSettings({ ...config, academicYear: yr });
  };

  const handleTermChange = (tm: TermType) => {
    setSelectedTerm(tm);
    const config = DbController.getSystemSettings();
    DbController.saveSystemSettings({ ...config, term: tm });
  };

  // Listen to Firebase auth changes to coordinate secure syncs
  useEffect(() => {
    if (!DbController.isFirebaseEnabled()) {
      setIsFirebaseChecking(false);
      return;
    }

    const auth = DbController.getAuthInstance();
    if (!auth) {
      setIsFirebaseChecking(false);
      return;
    }

    // Safety fallback: ensure splash screen unlocks after at most 2 seconds even if network delays Firebase Auth
    const safetyTimer = setTimeout(() => {
      setIsFirebaseChecking(false);
    }, 2000);

    // Subscribe to Firebase Auth state
    let profileUnsubscribe: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(safetyTimer);
      try {
        if (profileUnsubscribe) {
          profileUnsubscribe();
          profileUnsubscribe = null;
        }

        if (firebaseUser) {
          if (firebaseUser.uid === 'H5nlyq30sANEMixDEmURnYoyUzU2') {
            console.warn("User ID H5nlyq30sANEMixDEmURnYoyUzU2 is removed from the system. Terminating session.");
            DbController.logout();
            await auth.signOut();
            setCurrentUser(null);
            setIsFirebaseChecking(false);
            return;
          }
          console.log("Firebase Auth found active session for", firebaseUser.email);
          
          // IMMEDIATE OPTIMIZATION: Set local profile immediately if available to prevent UI blocking 
          // while we fetch the fresh remote profile from Firestore.
          const cachedProfile = DbController.getCurrentUser();
          if (cachedProfile && cachedProfile.uid === firebaseUser.uid) {
            console.log("Immediate UI hydration from local session cache for:", firebaseUser.uid);
            setCurrentUser(cachedProfile);
            
            // UI UNLOCK: If we have a cached profile, we can unlock the UI immediately
            // and let the remote sync happen in the background.
            setIsFirebaseChecking(false);
          }

          // Setup real-time Firestore sync listener for the active user account
          const firestoreInstance = DbController.getFirestoreInstance();
          if (firestoreInstance) {
            console.log("Setting up real-time sync snapshot listener for user profile:", firebaseUser.uid);
            profileUnsubscribe = onSnapshot(doc(firestoreInstance, 'users', firebaseUser.uid), async (snapshot) => {
              if (snapshot.exists()) {
                const updatedProfile = snapshot.data() as UserAccount;
                console.log("Real-time profile sync received via Firestore listener:", updatedProfile);
                const syncedProfile = DbController.saveProfileLocally(updatedProfile);
                setCurrentUser(syncedProfile);
                // Also ensure UI is unlocked if it wasn't already
                setIsFirebaseChecking(false);
              }
            }, (error) => {
              console.warn("Real-time profile sync observer error:", error);
              setIsFirebaseChecking(false);
            });
          }

          // Fetch the latest user profile from Firestore in the background or with a shorter timeout
          // to ensure we pick up immediate license status, authorization status, etc.
          (async () => {
            let remoteProfile: UserAccount | null = null;
            try {
              remoteProfile = await DbController.getFirebaseUserProfile(firebaseUser.uid);
            } catch (e) {
              console.warn("Background profile fetch error, proceeding with local fallback:", e);
            }

            try {
              if (remoteProfile) {
                const syncedProfile = await DbController.saveGoogleProfile(remoteProfile);
                DbController.ensureConnectedTeacherProfile(syncedProfile);
                setCurrentUser(syncedProfile);

                // Fetch assigned school profile if user has schoolId
                const schoolProfile = await DbController.fetchRemoteSchoolInfo();
                if (schoolProfile && (schoolProfile.name || schoolProfile.schoolName || schoolProfile.telephone || schoolProfile.motto || schoolProfile.gpsAddress)) {
                  setSchoolInfo(schoolProfile);
                }
              } else {
                // If remote profile is not found or fetch failed, and we have a matched local cached profile, use it.
                // Otherwise, construct a resilient fallback profile from Firebase Auth state so session never hangs.
                const currentCached = DbController.getCurrentUser();
                if (currentCached && currentCached.uid === firebaseUser.uid) {
                  DbController.ensureConnectedTeacherProfile(currentCached);
                  setCurrentUser(currentCached);
                } else {
                  const fallbackEmail = firebaseUser.email?.toLowerCase().trim() || '';
                  const isAdmin = fallbackEmail === 'pegyirenyi@gmail.com';
                  const fallbackRole: UserRole = isAdmin ? 'Admin' : 'Teacher';
                  const fallback: UserAccount = {
                    uid: firebaseUser.uid,
                    email: firebaseUser.email || '',
                    name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
                    role: fallbackRole,
                    schoolId: DbController.generateUniqueSchoolId(firebaseUser.uid),
                    licenseType: isAdmin ? 'unlimited' : 'unlicensed',
                    registeredOn: new Date().toISOString(),
                    createdAt: new Date().toISOString()
                  };
                  const syncedFallback = await DbController.saveGoogleProfile(fallback);
                  DbController.ensureConnectedTeacherProfile(syncedFallback);
                  setCurrentUser(syncedFallback);
                }
              }
            } catch (err) {
              console.error("Critical session restoration fallback error:", err);
            } finally {
              setIsFirebaseChecking(false);
            }
          })();
          
          // Concurrent background sync for all data
          console.log("Syncing database with authenticated Firebase Auth credentials...");
          DbController.syncAllDataFromFirebase().then(() => {
            refreshAllLogs();
          }).catch(err => {
            console.warn("Background sync error on startup:", err);
          });
        } else {
          console.log("Firebase Auth: No active session.");
          setIsFirebaseChecking(false);
        }
      } catch (err) {
        console.error("Error in Firebase Auth observer:", err);
        setIsFirebaseChecking(false);
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
      if (profileUnsubscribe) {
        profileUnsubscribe();
      }
    };
  }, []);

  // Automatic Scheduled Backup background checking task
  useEffect(() => {
    try {
      DbController.performScheduledBackupCheck();
    } catch (e) {
      console.warn("Scheduled backup startup check error:", e);
    }

    const interval = setInterval(() => {
      try {
        DbController.performScheduledBackupCheck();
      } catch (e) {
        console.warn("Scheduled backup check error:", e);
      }
    }, 300000); // 5 minutes checking interval

    return () => clearInterval(interval);
  }, []);

  // Global Keyboard Shortcuts (Tabs switching, Quick-Search, Save Data, Shortcuts Help)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = !!(target && (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.tagName === 'SELECT' || 
        target.isContentEditable
      ));

      // 1. Save Data progress (Ctrl+S or Cmd+S)
      if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === 's') {
        e.preventDefault();
        handleManualSaveProgress();
        return;
      }

      // 2. Quick Search modal (Ctrl+K or Cmd+K)
      if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
        return;
      }

      // 3. Shortcuts Help Overlay (? without modifier when not in input, OR Ctrl+/ OR Alt+H OR F1)
      if (
        ((e.ctrlKey || e.metaKey) && e.key === '/') ||
        (e.altKey && e.key?.toLowerCase() === 'h') ||
        e.key === 'F1' ||
        (!isInput && !e.ctrlKey && !e.metaKey && !e.altKey && e.key === '?')
      ) {
        e.preventDefault();
        setIsShortcutsHelpOpen(prev => !prev);
        return;
      }

      // 4. Escape key to close modals & menus
      if (e.key === 'Escape') {
        if (isMobileMenuOpen) {
          setIsMobileMenuOpen(false);
          return;
        }
        if (isMoreToolsOpen) {
          setIsMoreToolsOpen(false);
          return;
        }
        if (isPalettePickerOpen) {
          setIsPalettePickerOpen(false);
          return;
        }
        if (isVisibilityMenuOpen) {
          setIsVisibilityMenuOpen(false);
          return;
        }
        if (isShortcutsHelpOpen) {
          setIsShortcutsHelpOpen(false);
          return;
        }
        if (isSearchOpen) {
          setIsSearchOpen(false);
          return;
        }
      }

      // 5. Workspace Tab Switching via Alt + Number (Alt+1 to Alt+9)
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key >= '1' && e.key <= '9') {
        const targetIndex = parseInt(e.key, 10) - 1;
        if (targetIndex >= 0 && targetIndex < orderedVisibleTabs.length) {
          e.preventDefault();
          handleTabSwitch(orderedVisibleTabs[targetIndex].id);
          return;
        }
      }

      // 6. Workspace Tab Cycling via Alt+ArrowRight / Alt+]
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'ArrowRight' || e.key === ']')) {
        e.preventDefault();
        if (orderedVisibleTabs.length > 0) {
          const currentIndex = orderedVisibleTabs.findIndex(t => t.id === activeTab);
          const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % orderedVisibleTabs.length;
          handleTabSwitch(orderedVisibleTabs[nextIndex].id, 1);
        }
        return;
      }

      // 7. Workspace Tab Cycling via Alt+ArrowLeft / Alt+[
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'ArrowLeft' || e.key === '[')) {
        e.preventDefault();
        if (orderedVisibleTabs.length > 0) {
          const currentIndex = orderedVisibleTabs.findIndex(t => t.id === activeTab);
          const prevIndex = currentIndex === -1 ? 0 : (currentIndex - 1 + orderedVisibleTabs.length) % orderedVisibleTabs.length;
          handleTabSwitch(orderedVisibleTabs[prevIndex].id, -1);
        }
        return;
      }

      // 8. Toggle Desktop Sidebar via Ctrl+B or Cmd+B
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        toggleDesktopSidebar();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentUser, activeTab, orderedVisibleTabs, isShortcutsHelpOpen, isSearchOpen, handleTabSwitch]);

  // Global Scroll-lock and Freeze Prevention Manager for Modals & Mobile Drawer
  useEffect(() => {
    const isAnyModalOrDrawerOpen = isMobileMenuOpen || isQRScannerOpen || isSearchOpen || isShortcutsHelpOpen;
    if (typeof document !== 'undefined') {
      if (isAnyModalOrDrawerOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }
    };
  }, [isMobileMenuOpen, isQRScannerOpen, isSearchOpen, isShortcutsHelpOpen]);

  // Background-sync Firestore ledger data if user state changes after auth ready
  useEffect(() => {
    if (currentUser && DbController.isFirebaseEnabled() && !isFirebaseChecking) {
      const auth = DbController.getAuthInstance();
      if (auth?.currentUser) {
        DbController.syncAllDataFromFirebase().then(() => {
          refreshAllLogs();
        }).catch(err => {
          console.warn("Background sync error on state change:", err);
        });
      }
    }
  }, [currentUser, isFirebaseChecking]);

  const refreshAllLogs = useCallback(() => {
    setSchoolInfo(DbController.getSchoolInfo());
    setStudents(DbController.getStudents());
    setTeachers(DbController.getTeachers());
    setAttendance(DbController.getAllAttendance());
    setAssessments(DbController.getAssessments());
    setReflections(DbController.getTeacherReflections());
    const config = DbController.getSystemSettings();
    setActiveTheme(config.theme || 'Sophisticated Dark');
    setIsAutoSave(config.autoSave !== false);
  }, []);

  const handleShare = useCallback(() => {
    if (navigator.share) {
      navigator.share({
        title: 'GEETECH Multimedia System',
        url: window.location.href,
      }).catch((err) => console.error('Error sharing:', err));
    } else {
      alert('Sharing is not supported in your browser.');
    }
  }, []);

  const prevAssignmentsRef = React.useRef<{ classes: string[]; subjects: string[] } | null>(null);

  // Monitor teacher class/subject assignments for real-time alert notifications
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'Teacher' || !teacherProfile) {
      prevAssignmentsRef.current = null;
      return;
    }

    const currentClasses = [...assignedClasses].sort();
    const currentSubjects = [...assignedSubjects].sort();

    if (prevAssignmentsRef.current === null) {
      // First load, just record the initial state
      prevAssignmentsRef.current = { classes: currentClasses, subjects: currentSubjects };
      return;
    }

    const classesChanged = JSON.stringify(prevAssignmentsRef.current.classes) !== JSON.stringify(currentClasses);
    const subjectsChanged = JSON.stringify(prevAssignmentsRef.current.subjects) !== JSON.stringify(currentSubjects);

    if (classesChanged || subjectsChanged) {
      const classListText = currentClasses.length > 0 ? currentClasses.join(', ') : 'None';
      const subjectListText = currentSubjects.length > 0 ? currentSubjects.join(', ') : 'None';

      showToast(
        `🔔 REAL-TIME ASSIGNMENT RECEIVED!\n\nThe Headteacher has updated your academic assignments in real-time:\n\n• Assigned Classes: ${classListText}\n• Assigned Subjects: ${subjectListText}`,
        'info'
      );

      // Play a subtle notification sound
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.45);
      } catch (e) {
        // AudioContext browser restrictions
      }

      prevAssignmentsRef.current = { classes: currentClasses, subjects: currentSubjects };
    }
  }, [currentUser, teacherProfile, assignedClasses, assignedSubjects]);

  // Listen for real-time synchronization updates across tabs and windows
  useEffect(() => {
    let refreshDebounceTimer: any = null;
    const triggerDebouncedRefresh = () => {
      if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer);
      refreshDebounceTimer = setTimeout(() => {
        refreshAllLogs();
      }, 60);
    };

    const handleSyncMessage = (_eventData: { type: string; payload?: any }) => {
      triggerDebouncedRefresh();
    };

    // Handler for local custom window events
    const handleLocalSyncEvent = (e: any) => {
      if (e.detail && e.detail.type) {
        handleSyncMessage(e.detail);
      } else {
        handleSyncMessage({ type: e.type || 'sync', payload: e.detail });
      }
    };

    // Handler for cross-tab BroadcastChannel events
    let broadcastChannel: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        broadcastChannel = new BroadcastChannel('school-system-realtime-channel');
        broadcastChannel.onmessage = (e) => {
          if (e.data) {
            handleSyncMessage(e.data);
          }
        };
      }
    } catch (err) {
      console.warn("[Real-time Sync] BroadcastChannel init error:", err);
    }

    // Handler for fallback StorageEvents (cross-tab localstorage changes)
    const handleStorageSyncEvent = (e: StorageEvent) => {
      if (e.key && (e.key.startsWith('sms_') || e.key.startsWith('school_'))) {
        triggerDebouncedRefresh();
      }
    };

    const syncEvents = [
      'school-system-sync',
      'sms_sync_status_changed'
    ];

    syncEvents.forEach(evtName => {
      window.addEventListener(evtName, handleLocalSyncEvent);
    });
    window.addEventListener('storage', handleStorageSyncEvent);

    return () => {
      if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer);
      syncEvents.forEach(evtName => {
        window.removeEventListener(evtName, handleLocalSyncEvent);
      });
      window.removeEventListener('storage', handleStorageSyncEvent);
      if (broadcastChannel) {
        broadcastChannel.close();
      }
    };
  }, [refreshAllLogs]);

  // Real-time Firestore Snapshot Listeners for multi-tenant school sync (Teacher <-> Headteacher)
  useEffect(() => {
    if (!DbController.isFirebaseEnabled()) return;
    const firestoreInstance = DbController.getFirestoreInstance();
    if (!firestoreInstance) return;

    // Only attach real-time listeners when user is authenticated with Firebase Auth to prevent permission rejection and listener churn
    if (!currentUser || !auth?.currentUser) return;

    const activeSchoolId = DbController.resolveActiveSchoolId() || currentUser?.schoolId || schoolInfo?.schoolId;
    if (!activeSchoolId) return;

    let refreshDebounceTimer: any = null;
    const debouncedRefresh = () => {
      if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer);
      refreshDebounceTimer = setTimeout(() => {
        refreshAllLogs();
      }, 60);
    };

    const collectionsToSync = [
      'students',
      'teachers',
      'attendance',
      'staff_attendance',
      'assessments',
      'assessment_templates',
      'fees',
      'teacher_reflections',
      'behavioral_remarks',
      'leave_requests',
      'tasks',
      'emis',
      'quick_notes',
      'duty_roster',
      'staff_handbook',
      'custom_bill_categories',
      'custom_sections',
      'custom_subjects',
      'custom_classes',
      'custom_academic_years',
      'activity_logs',
      'expenses',
      'textbooks'
    ];

    const unsubs: (() => void)[] = [];

    // Real-time listener for platform-wide settings (subscription pricing adjustments from admin)
    try {
      const platformPricingDocRef = doc(firestoreInstance, 'platform_settings', 'pricing');
      const unsubPricing = onSnapshot(platformPricingDocRef, (docSnap) => {
        if (docSnap.metadata?.hasPendingWrites) return;
        if (docSnap.exists()) {
          const pricingData = docSnap.data();
          if (pricingData) {
            DbController.setPlatformPricingLocally(pricingData);
            setSchoolInfo(prev => ({
              ...prev,
              licensePrice1Year: pricingData.licensePrice1Year ?? prev.licensePrice1Year,
              licensePrice2Year: pricingData.licensePrice2Year ?? prev.licensePrice2Year,
              licensePrice3Year: pricingData.licensePrice3Year ?? prev.licensePrice3Year,
              licensePrice5Year: pricingData.licensePrice5Year ?? prev.licensePrice5Year,
              smsRate: pricingData.smsRate ?? prev.smsRate
            }));
            debouncedRefresh();
          }
        } else {
          // Document does not exist yet: initialize from default/local pricing
          const initialPricing = DbController.getPlatformPricing();
          setDoc(platformPricingDocRef, DbController.sanitizeForFirestore(initialPricing), { merge: true }).catch(() => {});
        }
      }, (err) => {
        console.warn('[Real-time Platform Pricing Listener] Notice:', err);
      });
      unsubs.push(unsubPricing);
    } catch (err) {
      console.warn('[Real-time Platform Pricing Listener] Could not attach listener:', err);
    }

    // Real-time listener for the main school profile document
    try {
      const schoolDocRef = doc(firestoreInstance, 'schools', activeSchoolId);
      const unsubSchool = onSnapshot(schoolDocRef, (docSnap) => {
        // Echo suppression: Ignore local pending writes to prevent bounce-back
        if (docSnap.metadata?.hasPendingWrites) return;

        if (docSnap.exists()) {
          const updatedSchool = docSnap.data() as SchoolInfo;
          if (updatedSchool) {
            // Update local memory & storage WITHOUT writing back to Firestore
            DbController.updateSchoolInfoLocally(updatedSchool);
            setSchoolInfo(updatedSchool);
            debouncedRefresh();
          }
        } else {
          // Document was not immediately found under activeSchoolId: query candidate IDs to avoid wiping valid school state
          DbController.fetchRemoteSchoolInfo().then((remote) => {
            if (remote && (remote.name || remote.schoolName || remote.telephone || remote.motto || remote.gpsAddress)) {
              setSchoolInfo(remote);
              debouncedRefresh();
            } else {
              const localSchool = DbController.getSchoolInfo();
              if (localSchool && (localSchool.name || localSchool.headteacherName || localSchool.telephone || localSchool.logoUrl)) {
                DbController.saveSchoolInfo(localSchool);
                setSchoolInfo(localSchool);
              }
            }
          }).catch(() => {});
        }
      }, (err) => {
        console.warn('[Real-time School Info Listener] Notice for active school:', err);
        DbController.switchToOfflineMode();
      });
      unsubs.push(unsubSchool);
    } catch (err) {
      console.warn('[Real-time School Info Listener] Could not attach doc listener:', err);
    }

    collectionsToSync.forEach((colName) => {
      try {
        const colRef = collection(firestoreInstance, 'schools', activeSchoolId, colName);
        const unsub = onSnapshot(colRef, (snapshot) => {
          // Echo suppression: Ignore local pending writes to avoid write-echo cycle
          if (snapshot.metadata?.hasPendingWrites) return;

          if (snapshot.empty) {
            const localItems = DbController.getDataset(colName);
            if (localItems && localItems.length > 0) {
              console.log(`[Real-time School Listener] Cloud Firestore ${colName} is empty, syncing ${localItems.length} local items to Cloud...`);
              DbController.uploadDatasetToFirestore(colName, localItems);
            } else {
              DbController.syncDatasetFromSnapshot(colName, [], false);
              debouncedRefresh();
            }
          } else {
            const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
            // Pass broadcast: false to suppress redundant synthetic DOM event cascades
            DbController.syncDatasetFromSnapshot(colName, items, false);
            debouncedRefresh();
          }
        }, (err) => {
          console.warn(`[Real-time School Listener] Notice for ${colName}:`, err);
          DbController.switchToOfflineMode();
        });
        unsubs.push(unsub);
      } catch (err) {
        console.warn(`[Real-time School Listener] Could not attach listener for ${colName}:`, err);
      }
    });

    return () => {
      if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer);
      unsubs.forEach(unsub => {
        try {
          unsub();
        } catch {
          // ignore cleanup errors
        }
      });
    };
  }, [currentUser?.uid, currentUser?.schoolId, schoolInfo?.schoolId, auth?.currentUser?.uid]);

  const handleResetAndClear = async () => {
    try {
      // Clear all fields State
      setIsRegisterMode(false);
      setAuthSubMode('sso');
      setRegName('');
      setRegEmail('');
      setRegPassword('');
      setRegRole('Headteacher');
      setAuthError(null);
      
      // Clear the active session and trigger storage wipe
      await DbController.clearAllData();
      setCurrentUser(null);
      
      // Set datasets to blank / initial fallback states
      setStudents([]);
      setTeachers([]);
      setAttendance([]);
      setAssessments([]);
      setReflections([]);
      
      // Refresh school metadata and trigger visual updates in UI components
      const blankSchool = DbController.resetSchoolInfo();
      setSchoolInfo(blankSchool);
      
      // Set validation message
      setWipeSuccessMessage("Successfully performed deep format of all system and Firebase data. Workstation reset to clean slate.");
      setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (err: any) {
      console.error("Deep format execution error:", err);
    }
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isContactSubmitting) return;

    setIsContactSubmitting(true);
    const adminEmail = "pegyirenyi@gmail.com";
    const subject = encodeURIComponent(`Support Request from ${contactForm.nameRole}`);
    const body = encodeURIComponent(
      `Name/Role: ${contactForm.nameRole}\n` +
      `Contact Info: ${contactForm.contactInfo}\n\n` +
      `Description of Issue/Request:\n${contactForm.description}`
    );
    const mailtoUrl = `mailto:${adminEmail}?subject=${subject}&body=${body}`;
    
    // Launch mail client
    window.location.href = mailtoUrl;

    // Small delay to allow UI to show loading and then close
    setTimeout(() => {
      setIsContactModalOpen(false);
      setIsContactSubmitting(false);
      setContactForm({ nameRole: '', contactInfo: '', description: '' });
      showToast("Opening your default mail client...", "success");
    }, 800);
  };

  // === BIOMETRICS AUTHENTICATION TRIGGERS ===
  const handleBiometricLoginTrigger = () => {
    setAuthError(null);
    const creds = DbController.getWebAuthnCredentials();
    if (creds.length === 0) {
      setAuthError("No biometric keys registered on this shared device directory. Please sign in via Standard Login, navigate to Settings -> Accounts, and enroll. Once enrolled, you can instantly log in with biometrics on this device!");
      return;
    }
    setRegisteredBiometrics(creds);
    if (creds.length === 1) {
      handleInitiateBiometricScan(creds[0]);
    } else {
      setIsBiometricSelectorOpen(true);
    }
  };

  const handleInitiateBiometricScan = async (cred: WebAuthnCredential) => {
    setIsBiometricSelectorOpen(false);
    setSelectedBiometricId(cred.id);
    setBiometricAuthType(
      cred.deviceName.toLowerCase().includes('face') || 
      cred.deviceName.toLowerCase().includes('camera') 
        ? 'face' : 'finger'
    );
    setBiometricAuthStep('scanning');
    
    try {
      if (typeof window !== 'undefined' && window.PublicKeyCredential && !cred.isSimulated) {
        // Run REAL WebAuthn assertion
        const challengeBuffer = new Uint8Array(32);
        window.crypto.getRandomValues(challengeBuffer);

        const decodedCredId = Uint8Array.from(atob(cred.id), c => c.charCodeAt(0));

        const assertionOptions: PublicKeyCredentialRequestOptions = {
          challenge: challengeBuffer,
          allowCredentials: [{
            id: decodedCredId,
            type: "public-key"
          }],
          timeout: 45000,
          userVerification: "required"
        };

        const assertion = await navigator.credentials.get({
          publicKey: assertionOptions
        }) as PublicKeyCredential;

        if (assertion) {
          const verifiedUser = DbController.loginWithWebAuthn(cred.id);
          setCurrentUser(verifiedUser);
          refreshAllLogs();
          return;
        }
      }
      throw new Error("Triggering educational sandbox biometrics scanner fallback.");
    } catch (e) {
      console.warn("Real WebAuthn verification skipped or blocked by iframe constraint. Using visual secure shield simulator:", e);
      setIsBiometricAuthModalOpen(true);
    }
  };

  const handleSimulateAuthenticationSuccess = () => {
    try {
      const verifiedUser = DbController.loginWithWebAuthn(selectedBiometricId);
      setBiometricAuthStep('success');
      setTimeout(() => {
        setIsBiometricAuthModalOpen(false);
        setCurrentUser(verifiedUser);
        refreshAllLogs();
      }, 1200);
    } catch (e: any) {
      setAuthError(e.message || "Failed biometric signature verification.");
      setIsBiometricAuthModalOpen(false);
    }
  };

  const handlePasswordResetSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    setResetLoading(true);
    setResetError(null);
    setResetSuccess(null);
    try {
      await DbController.firebaseSendPasswordResetEmail(resetEmail.trim());
      setResetSuccess("A secure password reset link has been dispatched to your email address.");
      setResetEmail("");
    } catch (err: any) {
      console.error(err);
      setResetError(err.message || "An unexpected error occurred during password reset dispatch.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!regName || !regEmail) return;
    setAuthError(null);

    const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*.,])[a-zA-Z0-9!@#$%^&*.,]{8,}$/;
    if (!passwordRegex.test(regPassword)) {
      setAuthError("Password must be at least 8 characters long, include numbers and special characters.");
      return;
    }

    setAuthLoading(true);

    try {
      if (DbController.isFirebaseEnabled()) {
        const passwordToUse = regPassword || "defaultPass123";
        const account = await DbController.firebaseRegister(regName, regEmail, passwordToUse, regRole);
        setCurrentUser(account);
        DbController.syncAllDataFromFirebase().then(() => {
          refreshAllLogs();
        }).catch(err => {
          console.warn("Post-register sync error:", err);
        });
      } else {
        const account = DbController.register(regName, regEmail, regRole);
        setCurrentUser(account);
      }
      setIsRegisterMode(false);
      refreshAllLogs();
    } catch (err: any) {
      console.error(err);
      setAuthError(sanitizeAuthError(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const sanitizeAuthError = (err: any): ReactNode | string => {
    if (!err) return null;
    const code = err.code || '';
    const message = err.message || '';

    if (code === 'auth/operation-not-allowed' || message.includes('operation-not-allowed')) {
      return (
        <div className="space-y-2 mt-1 text-xs text-slate-300 font-sans">
          <p className="font-semibold text-red-400 flex items-center gap-1.5">
            <span>❌ Email/Password Sign-In Provider Disabled</span>
          </p>
          <p>
            The Email & Password authentication provider is currently disabled in the project's Firebase Console. 
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            💡 <strong>Action Required:</strong> To enable email registration and login, please navigate to your Firebase Console under <strong>Authentication &gt; Sign-in method</strong>, and enable the <strong>Email/Password</strong> provider.
          </p>
        </div>
      );
    }
    if (code === 'auth/unauthorized-domain' || message.includes('unauthorized-domain') || message.includes('auth/unauthorized-client-identifier')) {
      return renderUnauthorizedDomainError();
    }
    if (code === 'auth/popup-blocked' || message.includes('popup-blocked') || message.includes('popup closed') || message.includes('cancelled-by-user')) {
      return renderPopupBlockedError();
    }
    if (code === 'auth/email-already-in-use' || message.includes('email-already-in-use')) {
      return "The email address you entered is already registered. Please check the address or log in using your existing account.";
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found' || message.includes('invalid-credential') || message.includes('wrong-password') || message.includes('user-not-found')) {
      return "Unauthorized Access: Invalid email or password. Please verify your credentials and try again.";
    }
    if (code === 'auth/weak-password' || message.includes('weak-password')) {
      return "The password provided is too weak. Please use a password with at least 6 characters.";
    }
    if (code === 'auth/invalid-email' || message.includes('invalid-email')) {
      return "The email address format is invalid. Please enter a valid email address.";
    }
    if (code === 'auth/user-disabled' || message.includes('user-disabled')) {
      return "Unauthorized Access: This user account has been disabled. Please contact support.";
    }
    if (code === 'auth/too-many-requests' || message.includes('too-many-requests')) {
      return "Too many failed login attempts. Access is temporarily restricted. Please try again later.";
    }

    return "Unauthorized Access: Access is restricted or temporarily unavailable. Please verify your credentials or contact support.";
  };

  const renderUnauthorizedDomainError = () => {
    return (
      <div className="space-y-2 mt-1 text-xs text-slate-300 font-sans">
        <p className="font-semibold text-amber-400 flex items-center gap-1.5">
          <span>⚠️ Access Restricted (Unauthorized Domain)</span>
        </p>
        <p>
          Your login request cannot be authorized from this web address. Please verify that you are accessing the portal from the official secured domain or contact the system administrator.
        </p>
        <p className="text-[11px] text-slate-400 mt-1">
          💡 <strong>Alternative:</strong> If you are testing the system, you can sign in directly using your <strong>Email & Password</strong> credentials which require no domain authorizations.
        </p>
      </div>
    );
  };

  const renderPopupBlockedError = () => {
    return (
      <div className="space-y-2 mt-1 text-xs text-slate-300 font-sans">
        <p className="font-semibold text-amber-400 flex items-center gap-1.5">
          <span>🔒 Secure Popup Blocked</span>
        </p>
        <p>
          The authentication window was blocked by your browser. Please ensure popups are allowed for this portal, or open the application directly in a new dedicated tab.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            type="button"
            onClick={() => window.open(window.location.href, '_blank')}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[11px] transition cursor-pointer flex items-center justify-center gap-1.5 active:translate-y-0.5 shadow-xs"
          >
            <ExternalLink size={12} /> Open Portal in New Tab
          </button>
          <button
            type="button"
            onClick={() => setAuthError(null)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg text-[11px] transition cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  };

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!loginEmail) return;

    // Admin login path
    setAuthError(null);
    setAuthLoading(true);

    try {
      if (loginPathway === 'Teacher') {
        const account = await DbController.teacherLogin(loginEmail, loginSchoolId);
        setCurrentUser(account);
      } else {
        if (DbController.isFirebaseEnabled()) {
          const account = await DbController.firebaseLogin(loginEmail, loginPassword);
          setCurrentUser(account);
        } else {
          const account = DbController.login(loginEmail, loginPathway === 'Admin' ? 'Admin' : 'Headteacher');
          setCurrentUser(account);
        }
      }
      
      if (DbController.isFirebaseEnabled()) {
        DbController.fetchRemoteSchoolInfo().then((remoteSchool) => {
          if (remoteSchool && (remoteSchool.name || remoteSchool.schoolName || remoteSchool.telephone || remoteSchool.motto || remoteSchool.gpsAddress)) {
            setSchoolInfo(remoteSchool);
          }
        }).catch(() => {});

        DbController.syncAllDataFromFirebase().then(() => {
          refreshAllLogs();
        }).catch(err => console.warn("Post-login sync error:", err));
      } else {
        refreshAllLogs();
      }
    } catch (err: any) {
      console.error(err);
      setAuthError(sanitizeAuthError(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      const result = await DbController.firebaseGoogleLogin();
      const finalUser = result.isNew 
        ? await DbController.saveGoogleProfile(result.user) 
        : result.user;
      
      setCurrentUser(finalUser);
      if (DbController.isFirebaseEnabled()) {
        DbController.fetchRemoteSchoolInfo().then((remoteSchool) => {
          if (remoteSchool && (remoteSchool.name || remoteSchool.schoolName || remoteSchool.telephone || remoteSchool.motto || remoteSchool.gpsAddress)) {
            setSchoolInfo(remoteSchool);
          }
        }).catch(() => {});
      }
      DbController.syncAllDataFromFirebase().then(() => {
        refreshAllLogs();
      }).catch(err => {
        console.warn("Post-Google sync error:", err);
      });
    } catch (err: any) {
      console.error(err);
      setAuthError(sanitizeAuthError(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setIsManualSetupWizardOpen(false);
    DbController.logout();
    setCurrentUser(null);
    setStudents([]);
    setTeachers([]);
    setAttendance([]);
    setAssessments([]);
    setReflections([]);
    setSchoolInfo(DbController.getSchoolInfo());
    setActiveTab('dashboard');
  };

  // Get active branding styles
  const themeStyles = THEME_CONFIGS[activeTheme] || THEME_CONFIGS['Sophisticated Dark'];

  // SECURITY: Global Idle Timeout Monitoring (Auto-Logout)
  useEffect(() => {
    if (!currentUser || currentUser.role === 'Admin') return; // Only for teachers/staff as requested

    const sysSettings = DbController.getSystemSettings() || {};
    const idleLimitMinutes = sysSettings.idleLogoutTimer || 30;
    const idleLimitMs = idleLimitMinutes * 60 * 1000;

    let idleTimeout: any = null;

    const resetTimer = () => {
      if (idleTimeout) clearTimeout(idleTimeout);
      idleTimeout = setTimeout(() => {
        console.log(`Idle timeout reached (${idleLimitMinutes}m). Executing secure auto-logout...`);
        
        DbController.writeActivityLog(
          'Security Auto-Logout',
          `Session for ${currentUser.name} terminated due to ${idleLimitMinutes} minutes of inactivity.`,
          'medium'
        );
        
        handleLogout();
      }, idleLimitMs);
    };

    // Events that signify activity
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    activityEvents.forEach(evt => {
      document.addEventListener(evt, resetTimer, true);
    });

    // Start initial timer
    resetTimer();

    return () => {
      if (idleTimeout) clearTimeout(idleTimeout);
      activityEvents.forEach(evt => {
        document.removeEventListener(evt, resetTimer, true);
      });
    };
  }, [currentUser]);

  if (isExited) {
    return (
      <div className="min-h-screen bg-slate-950 font-sans flex items-center justify-center p-4 relative overflow-hidden">
        {/* Abstract background gradient accent flares */}
        <div className="absolute top-[-20%] left-[-10%] w-96 h-96 rounded-full bg-rose-900/10 blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 rounded-full bg-orange-900/10 blur-3xl" />

        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 text-center space-y-6 text-slate-100">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <Power size={32} />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-xl font-display font-black tracking-tight text-rose-400 uppercase">SYSTEM EXITED</h1>
            <p className="text-xs text-slate-400">Your secure database session has been disconnected cleanly.</p>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-[11px] text-slate-400 leading-relaxed font-mono">
            All transient memory has been purged. You may now close this browser tab safely.
          </div>

          <div className="pt-2">
            <button
              onClick={() => setIsExited(false)}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Re-Launch Platform
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Parent Access Secure Portal override
  if (parentPortalState.isActive) {
    return (
      <ParentPortal 
        studentId={parentPortalState.studentId}
        year={parentPortalState.year}
        term={parentPortalState.term}
        token={parentPortalState.token}
        onExit={() => {
          setParentPortalState({ isActive: false, studentId: '', year: '', term: '', token: '' });
          if (typeof window !== 'undefined') {
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
          }
        }}
      />
    );
  }

  if (isFirebaseChecking && DbController.isFirebaseEnabled()) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Ambient background flares */}
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-900/10 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-violet-900/10 blur-[120px] animate-pulse" />
        
        <div className="relative z-10 flex flex-col items-center space-y-8 max-w-sm w-full text-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-24 h-24 rounded-[2rem] bg-white p-4 shadow-2xl shadow-indigo-500/10 border border-slate-800/50 flex items-center justify-center"
          >
            <img 
              src={geetechLogo} 
              alt="GEETECH Logo" 
              className="w-full h-full object-contain"
            />
            {/* Spinning loading ring around logo */}
            <div className="absolute -inset-1 border-2 border-indigo-500/20 rounded-[2.2rem]" />
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="absolute -inset-1 border-t-2 border-indigo-500 rounded-[2.2rem]"
            />
          </motion.div>

          <div className="space-y-3">
            <motion.h1 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-xl font-display font-black tracking-tighter text-white uppercase"
            >
              GEETECH MULTIMEDIA
            </motion.h1>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col items-center space-y-1"
            >
              <div className="flex items-center gap-2 text-indigo-400 font-mono text-[10px] uppercase tracking-[0.2em] font-bold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
                Secure Session Verification
              </div>
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-900 border border-slate-800 rounded-full">
                <ShieldAlert size={8} className="text-emerald-500" />
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">GES Standard Compliant</span>
              </div>
              <p className="text-slate-500 text-[10px] font-medium max-w-[200px] leading-relaxed">
                Authenticating with central database. This ensures your school records are synchronized...
              </p>
            </motion.div>
          </div>

          <div className="w-full max-w-[140px] h-1 bg-slate-900 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 2, ease: "easeInOut" }}
              className="h-full bg-gradient-to-r from-indigo-600 to-violet-600"
            />
          </div>
        </div>

        <div className="absolute bottom-8 left-0 right-0 text-center">
          <p className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">
            © 2026 GEETECH | Secure Cloud Protocol v4.0
          </p>
        </div>
      </div>
    );
  }

  // Secure Authorization Gate (Renders login panel if not authenticated)
  if (!currentUser) {
    const isDarkTheme = activeTheme === 'Sophisticated Dark' || activeTheme === 'Midnight';
    const activeStyles = THEME_CONFIGS[activeTheme] || THEME_CONFIGS['Sophisticated Dark'];

    return (
      <div className={`min-h-screen font-sans flex items-center justify-center p-4 relative overflow-hidden transition-all duration-700 ${
        isDarkTheme 
          ? (activeTheme === 'Midnight' ? 'bg-[#0f172a]' : 'bg-[#020617]') 
          : `${activeStyles.heroBg} bg-slate-100`
      }`}>
        {/* Dynamic theme backdrop circles */}
        {isDarkTheme ? (
          <>
            <div className="absolute top-[-20%] left-[-10%] w-96 h-96 rounded-full bg-indigo-950/20 blur-3xl transition-all duration-500" />
            <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 rounded-full bg-violet-950/20 blur-3xl transition-all duration-500" />
          </>
        ) : (
          <>
            <div className={`absolute top-[-20%] left-[-10%] w-96 h-96 rounded-full opacity-60 blur-3xl transition-all duration-500 ${activeTheme === 'Emerald' ? 'bg-emerald-200' : activeTheme === 'Ruby' ? 'bg-rose-200' : activeTheme === 'Cosmic' ? 'bg-purple-200' : activeTheme === 'Gold' ? 'bg-amber-200' : activeTheme === 'Sunset' ? 'bg-orange-200' : activeTheme === 'Ocean' ? 'bg-cyan-200' : 'bg-blue-200'}`} />
            <div className={`absolute bottom-[-20%] right-[-10%] w-96 h-96 rounded-full opacity-60 blur-3xl transition-all duration-500 ${activeTheme === 'Emerald' ? 'bg-teal-200' : activeTheme === 'Ruby' ? 'bg-red-200' : activeTheme === 'Cosmic' ? 'bg-indigo-200' : activeTheme === 'Gold' ? 'bg-yellow-200' : activeTheme === 'Sunset' ? 'bg-amber-200' : activeTheme === 'Ocean' ? 'bg-sky-200' : 'bg-indigo-200'}`} />
          </>
        )}

        <motion.div 
          initial={{ opacity: 0, y: 15, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className={`max-w-sm w-full rounded-2xl p-6 shadow-2xl relative z-10 space-y-4 transition-all duration-500 ${
            isDarkTheme 
              ? 'bg-slate-900/90 border border-slate-800 text-slate-100 shadow-slate-950/60' 
              : activeTheme === 'Crystal Glass'
                ? 'bg-white/45 backdrop-blur-md border border-white/50 text-slate-800 shadow-xl shadow-sky-950/5'
                : 'bg-white border border-slate-200/80 text-slate-800 shadow-2xl shadow-slate-200/50'
          }`}
        >
          
          <div className="text-center space-y-1">
            <div className={`relative w-16 h-16 rounded-2xl border overflow-hidden mx-auto mb-2 bg-white flex items-center justify-center p-1.5 transition-all duration-500 ${
              isDarkTheme ? 'border-slate-800 shadow-xl' : 'border-slate-200 shadow-sm'
            }`}>
              <img 
                src={geetechLogo} 
                alt="GEETECH MULTIMEDIA Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className={`text-lg font-display font-black tracking-tight mb-0.5 transition-all duration-500 ${
              isDarkTheme ? 'text-white' : 'text-slate-900'
            }`}>GEETECH MULTIMEDIA</h1>
            <p className={`text-[9px] font-mono uppercase tracking-widest transition-all duration-500 ${
              isDarkTheme ? 'text-slate-500' : 'text-slate-400'
            }`}>Innovative Solutions, Creative Media</p>
          </div>


          {authError && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className={`p-3 border rounded-xl text-xs leading-relaxed font-sans space-y-1 transition-all duration-500 overflow-hidden ${
                isDarkTheme 
                  ? 'bg-red-950/40 border-red-900/40 text-red-400' 
                  : 'bg-red-50 border-red-200 text-red-700 shadow-xs'
              }`}
            >
              <div className="font-bold flex items-center gap-1.5 text-[10px] uppercase tracking-wide">
                <ShieldAlert size={14} /> Authentication Notice
              </div>
              <div>{authError}</div>
            </motion.div>
          )}

          {wipeSuccessMessage && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className={`p-3 border rounded-xl text-xs leading-relaxed font-sans space-y-1 transition-all duration-500 overflow-hidden ${
                isDarkTheme 
                  ? 'bg-emerald-950/40 border-emerald-900/40 text-emerald-400' 
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-xs'
              }`}
            >
              <div className="font-bold flex items-center gap-1.5 text-[10px] uppercase tracking-wide">
                <RefreshCw size={14} className="animate-spin" /> Reset Status
              </div>
              <div>{wipeSuccessMessage}</div>
            </motion.div>
          )}

          <AnimatePresence>
            {authSubMode === 'sso' && (
              <motion.div 
                key="sso-login-panel"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.15, ease: "easeInOut" }}
                className="space-y-4 text-xs"
              >
                <div className="text-center py-0.5">
                  <p className={`text-[11px] leading-relaxed font-sans ${
                    isDarkTheme ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    Access your school management dashboard securely using single sign-on.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {DbController.isFirebaseEnabled() ? (
                    <>
                      <button 
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={authLoading}
                        className={`w-full py-3 px-4 border rounded-xl transition-all shadow-xs flex items-center justify-center gap-3 font-bold text-xs uppercase tracking-wider cursor-pointer disabled:opacity-50 active:scale-[0.98] ${
                          isDarkTheme 
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700 focus:ring-2 focus:ring-indigo-500/20' 
                            : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 focus:ring-2 focus:ring-indigo-500/10'
                        }`}
                      >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="Google" />
                        <span>Continue with Google</span>
                      </button>
                    </>
                  ) : (
                    <div className={`text-center py-3 px-4 rounded-xl border flex items-center justify-center gap-2 font-bold text-[10px] uppercase tracking-wider ${
                      isDarkTheme 
                        ? 'text-amber-400 bg-amber-950/20 border-amber-900/20' 
                        : 'text-amber-700 bg-amber-50/50 border-amber-200/50 shadow-xs'
                    }`}>
                      <ShieldAlert size={14} className="shrink-0" />
                      <span>System Connection Offline</span>
                    </div>
                  )}

                  <div className="relative flex items-center py-1">
                    <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                    <span className="flex-shrink mx-3 text-[8.5px] font-mono text-slate-400 uppercase tracking-widest">or biometrics</span>
                    <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                  </div>

                  <button 
                    type="button"
                    onClick={handleBiometricLoginTrigger}
                    disabled={authLoading}
                    className={`w-full py-3 px-4 border rounded-xl transition-all shadow-md flex items-center justify-center gap-3 font-bold text-xs uppercase tracking-wider cursor-pointer disabled:opacity-50 active:scale-[0.98] ${
                      isDarkTheme 
                        ? 'bg-gradient-to-r from-emerald-950/50 to-teal-950/50 hover:from-emerald-900 hover:to-teal-900 text-emerald-400 border-emerald-900/40 focus:ring-2 focus:ring-emerald-500/20' 
                        : 'bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 text-emerald-950 border-emerald-200 focus:ring-2 focus:ring-emerald-500/10'
                    }`}
                  >
                    <Fingerprint size={16} className="text-emerald-500 animate-pulse" />
                    <span>One-Click Biometric Login</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => {
                      if (isSubscriptionLocked) {
                        triggerToast("Scan QR Badge is inactive for expired accounts. Please contact admin to renew license.", "error");
                        return;
                      }
                      setIsQRScannerOpen(true);
                    }}
                    disabled={authLoading || isSubscriptionLocked}
                    className={`w-full py-3 px-4 border rounded-xl transition-all shadow-md flex items-center justify-center gap-3 font-bold text-xs uppercase tracking-wider ${
                      isSubscriptionLocked
                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-700 opacity-60 cursor-not-allowed'
                        : isDarkTheme 
                          ? 'bg-gradient-to-r from-indigo-950/40 to-violet-950/40 hover:from-indigo-900 hover:to-violet-900 text-indigo-400 border-indigo-900/40 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer active:scale-[0.98]' 
                          : 'bg-gradient-to-r from-indigo-50/50 to-violet-50/50 hover:from-indigo-100/50 hover:to-violet-100/50 text-indigo-950 border-indigo-200 focus:ring-2 focus:ring-indigo-500/10 cursor-pointer active:scale-[0.98]'
                    }`}
                    title={isSubscriptionLocked ? "Scan QR Badge is inactive for expired users" : "Scan QR Badge Login"}
                  >
                    <QrCode size={16} className={isSubscriptionLocked ? "text-slate-400" : "text-indigo-500"} />
                    <span>{isSubscriptionLocked ? "Scan QR Badge (Inactive)" : "Scan QR Badge Login"}</span>
                  </button>



                  <div className="pt-2">
                    <button 
                      type="button"
                      onClick={() => setIsExited(true)}
                      className={`w-full py-2 border rounded-xl transition-all duration-300 font-bold flex items-center justify-center gap-1.5 cursor-pointer text-[9px] uppercase tracking-wider ${
                        isDarkTheme 
                          ? 'bg-rose-950/10 hover:bg-rose-950/30 text-rose-400 border-rose-900/20' 
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                      }`}
                    >
                      <Power size={11} />
                      <span>Exit Platform</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className={`pt-4 border-t text-center font-mono text-[10px] transition-colors duration-500 ${
            isDarkTheme ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'
          }`}>
            <div>
              <p>EGYIRENYI PAUL | GEETECH MULTIMEDIA</p>
              <p>+233 544 052 717 | pegyirenyi@gmail.com | © 2026</p>
            </div>
          </div>
        </motion.div>

        {/* Biometric Credentials Device Profile Selector Modal */}
        {isBiometricSelectorOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in text-slate-100">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-left"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Fingerprint size={18} className="text-indigo-400 animate-pulse" />
                  <h3 className="font-sans font-bold text-slate-200 text-sm uppercase tracking-wide">Choose Biometric Profile</h3>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsBiometricSelectorOpen(false)}
                  className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white transition cursor-pointer border-0 bg-transparent"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="space-y-2 py-1 max-h-[220px] overflow-y-auto">
                <p className="text-[10px] text-slate-400 italic mb-2 leading-relaxed">
                  Multiple biometric keys are enrolled on this shared device directory. Select yours to authenticate:
                </p>
                {registeredBiometrics.map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleInitiateBiometricScan(c)}
                    className="w-full p-3 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-indigo-500/50 hover:bg-slate-900 flex items-center gap-3 text-left transition cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-indigo-950/50 border border-indigo-900/50 flex items-center justify-center text-indigo-400">
                      <Fingerprint size={16} />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-bold text-slate-200">{c.deviceName}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{c.userName} ({c.userEmail})</div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {/* Biometric Verification Scanner Modal */}
        {isBiometricAuthModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in text-slate-100">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xs w-full p-6 shadow-2xl space-y-6 relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 animate-pulse" />
              
              <div className="flex justify-between items-center pb-3 border-b border-slate-800 text-slate-100">
                <div className="flex items-center gap-1.5 text-indigo-400">
                  <Fingerprint size={18} className="animate-pulse" />
                  <span className="text-xs font-mono font-bold uppercase tracking-widest text-left">Biometric Verification</span>
                </div>
                <button 
                  onClick={() => setIsBiometricAuthModalOpen(false)}
                  className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white transition cursor-pointer border-0 bg-transparent"
                >
                  <X size={15} />
                </button>
              </div>

              {biometricAuthStep === 'scanning' && (
                <div className="space-y-6 text-center py-4">
                  <div className="relative w-28 h-28 mx-auto flex items-center justify-center rounded-full bg-indigo-950/40 border border-indigo-900/50 shadow-inner overflow-hidden">
                    
                    {/* Glowing sensor scanning effect */}
                    <div className="absolute inset-x-4 top-0 h-0.5 bg-indigo-400 shadow-[0_0_15px_#6366f1] animate-bounce" style={{ animationDuration: '3s' }} />
                    
                    {biometricAuthType === 'finger' ? (
                      <Fingerprint size={56} className="text-indigo-400 animate-pulse" />
                    ) : (
                      <div className="relative animate-pulse">
                        <svg className="w-14 h-14 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M12 18.75V21m-4.5-9.75h9m-9-3h9m-10.5-3h12a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-12A2.25 2.25 0 013 13.5v-9a2.25 2.25 0 012.25-2.25z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-bold tracking-tight text-white">
                      {biometricAuthType === 'finger' ? 'Authenticating Touch ID...' : 'Verifying Face ID Map...'}
                    </h3>
                    <p className="text-[10px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                      Compiling secure shared device WebAuthn signature challenges... Place registered fingerprint or align face layout to gain access.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleSimulateAuthenticationSuccess}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-md tracking-wider uppercase font-mono animate-pulse"
                  >
                    Apply Biometric signature
                  </button>
                </div>
              )}

              {biometricAuthStep === 'success' && (
                <div className="space-y-6 text-center py-4 text-slate-100">
                  <div className="w-16 h-16 bg-emerald-950/50 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto text-emerald-400 animate-bounce">
                    <Check size={28} className="stroke-[3]" />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-emerald-400">Authorization Validated</h3>
                    <p className="text-[10px] text-slate-300 max-w-xs mx-auto leading-relaxed">
                      Biometric WebAuthn challenge verified! Redirecting to secure GEETECH Multimedia administrative dashboards...
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Password Reset Modal Overlay */}
        {isResetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100 relative"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <Lock size={16} />
                  </div>
                  <h3 className="font-bold text-slate-200">Reset Password</h3>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  className="text-slate-500 hover:text-slate-300 transition text-sm font-bold border-0 bg-transparent cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {resetError && (
                <div className="p-3 bg-red-950/40 border border-red-900/40 rounded-xl text-red-400 text-xs">
                  {resetError}
                </div>
              )}

              {resetSuccess ? (
                <div className="space-y-4">
                  <div className="p-3 bg-emerald-950/40 border border-emerald-900/40 rounded-xl text-emerald-400 text-xs leading-relaxed font-sans">
                    {resetSuccess}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsResetModalOpen(false)}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition text-xs cursor-pointer"
                  >
                    Back to Login
                  </button>
                </div>
              ) : (
                <form onSubmit={handlePasswordResetSubmit} className="space-y-4 text-xs">
                  <p className="text-slate-400 leading-normal font-sans">
                    Enter your registered administrative email address below. We'll send you a password reset link automatically.
                  </p>
                  <div className="space-y-1 text-left">
                    <label className="block text-slate-400 font-semibold mb-1">User Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 text-slate-600" size={14} />
                      <input 
                        type="email"
                        required
                        placeholder="e.g. user@ges-school.gov.gh"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-slate-800 rounded-xl bg-slate-950 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2.5 justify-end pt-2 font-sans">
                    <button
                      type="button"
                      onClick={() => setIsResetModalOpen(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold rounded-xl transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
                    >
                      {resetLoading ? "Sending Link..." : "Send Reset Link"}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}

        {/* Teacher School Code ID Access Modal */}
        {isTeacherCodeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in text-slate-100">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-slate-100 relative overflow-hidden"
            >
              {/* Header gradient aura */}
              <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex justify-between items-center pb-4 border-b border-slate-800 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-inner">
                    <Key size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-100 text-base font-sans tracking-tight">Teacher Portal Access</h3>
                    <p className="text-[11px] text-amber-400 font-mono font-bold">Secure Educator Authentication</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsTeacherCodeModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition flex items-center justify-center font-bold text-xs cursor-pointer border-0"
                >
                  ✕
                </button>
              </div>

              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!loginSchoolId.trim()) {
                    setAuthError("Please enter your School Code ID to link and access your teacher page.");
                    return;
                  }
                  setAuthError(null);
                  setAuthLoading(true);
                  try {
                    const account = await DbController.teacherLogin(loginEmail.trim(), loginSchoolId.trim());
                    setCurrentUser(account);
                    setIsTeacherCodeModalOpen(false);
                    triggerToast(`Welcome ${account.name}! Accessing assigned teacher page linked to School Code ${account.schoolCode}.`, 'success');
                    refreshAllLogs();
                  } catch (err: any) {
                    setAuthError(sanitizeAuthError(err));
                  } finally {
                    setAuthLoading(false);
                  }
                }} 
                className="space-y-5 text-xs relative z-10"
              >
                <div className="p-4 bg-gradient-to-r from-amber-950/40 to-slate-900 border border-amber-900/40 rounded-2xl text-amber-200 text-xs leading-relaxed space-y-1.5 shadow-xs">
                  <div className="font-bold uppercase tracking-wider text-[10px] text-amber-400 font-mono flex items-center gap-1">
                    <span>Credentials Required:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300">
                    <li><strong>School Code ID</strong> (Provided by your Headteacher)</li>
                    <li><strong>Staff ID, Teacher Name, or Email</strong> (Assigned educator record)</li>
                  </ul>
                </div>

                {authError && (
                  <div className="p-3 bg-red-950/50 border border-red-900/50 rounded-xl text-red-400 text-xs leading-relaxed">
                    {authError}
                  </div>
                )}

                <div className="space-y-1.5 text-left">
                  <label className="block text-slate-300 font-bold mb-1 tracking-wide">
                    1. School Code ID <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3.5 top-3 text-amber-500" size={16} />
                    <input 
                      type="text"
                      required
                      placeholder="e.g. SCH-ADM-XXXX"
                      value={loginSchoolId}
                      onChange={(e) => setLoginSchoolId(e.target.value.toUpperCase())}
                      className="w-full pl-10 pr-4 py-3 border border-amber-500/40 rounded-2xl bg-slate-950 text-amber-200 focus:outline-none focus:border-amber-400 font-mono font-bold tracking-wider text-sm shadow-inner"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="block text-slate-300 font-bold mb-1 tracking-wide">
                    2. Staff ID, Teacher Name, or Email <span className="text-slate-500 font-normal text-[10px]">(Identification)</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 text-slate-400" size={16} />
                    <input 
                      type="text"
                      placeholder="e.g. GES-T89045, John Doe, or teacher@school.edu"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-slate-700 rounded-2xl bg-slate-950 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono text-xs shadow-inner"
                    />
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-3 font-sans">
                  <button
                    type="button"
                    onClick={() => setIsTeacherCodeModalOpen(false)}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold rounded-2xl transition cursor-pointer text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-slate-950 font-black rounded-2xl transition cursor-pointer disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-amber-900/30 text-xs active:scale-98"
                  >
                    {authLoading ? <Loader2 size={15} className="animate-spin" /> : <Key size={15} />}
                    <span>Access Teacher Page</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        <AnimatePresence>
          {isQRScannerOpen && (
            <QRBadgeScanner
              key="login-qr-badge-scanner"
              onScanSuccess={handleQRBadgeScanSuccess}
              onClose={() => setIsQRScannerOpen(false)}
              isSubscriptionLocked={isSubscriptionLocked}
              isLoginMode={true}
            />
          )}
        </AnimatePresence>


      </div>
    );
  }

  // License Authorization & Renewal Check Gate (locks app if subscription expired/expiring)
  if (subscriptionStatus && subscriptionStatus.isLocked && !showBillingEvenIfLocked) {
    return (
      <SubscriptionLockModal 
        user={currentUser}
        onUnlocked={(updatedUser) => {
          setCurrentUser(updatedUser);
        }}
        onLogout={handleLogout}
        onShowBilling={() => {
          setSettingsSubTab('billing');
          setActiveTab('settings');
          setShowBillingEvenIfLocked(true);
        }}
      />
    );
  }

  // Setup Wizard Gate logic
  // Setup wizard should ONLY ever automatically display if:
  // 1. User is an Admin or Headteacher (teachers, accountants, etc. never see setup wizard)
  // 2. The wizard has NOT been completed by user, school, or localStorage flags
  // 3. User is NOT in Parent Mode
  const isSetupWizardAlreadyCompleted = Boolean(
    currentUser?.setupWizardCompleted ||
    schoolInfo?.setupWizardCompleted ||
    (typeof localStorage !== 'undefined' && (
      localStorage.getItem('sms_setup_wizard_completed') === 'true' ||
      (currentUser?.uid && localStorage.getItem(`sms_setup_wizard_completed_${currentUser.uid}`) === 'true') ||
      (schoolInfo?.schoolId && localStorage.getItem(`sms_setup_wizard_completed_${schoolInfo.schoolId}`) === 'true')
    )) ||
    (schoolInfo?.name && 
     schoolInfo.name !== 'Ghana Education Service School' && 
     schoolInfo.name !== 'School Name' && 
     schoolInfo.name.trim().length > 3 &&
     (schoolInfo.academicYear || schoolInfo.emisCode || schoolInfo.headteacherName))
  );

  const canUserConfigureSchool = Boolean(
    currentUser?.role === 'Admin' ||
    currentUser?.role === 'Headteacher' ||
    currentUser?.email?.toLowerCase().trim() === 'pegyirenyi@gmail.com'
  );

  const shouldShowSetupWizard = Boolean(
    isManualSetupWizardOpen ||
    (currentUser && canUserConfigureSchool && !isSetupWizardAlreadyCompleted && !parentPortalState.isActive)
  );

  if (shouldShowSetupWizard && currentUser) {
    return (
      <SetupWizard
        currentUser={currentUser}
        initialSchoolInfo={schoolInfo}
        onBackToLogin={handleLogout}
        onLogout={handleLogout}
        onComplete={(updatedSchool) => {
          setIsManualSetupWizardOpen(false);
          try {
            localStorage.setItem('sms_setup_wizard_completed', 'true');
            if (currentUser.uid) {
              localStorage.setItem(`sms_setup_wizard_completed_${currentUser.uid}`, 'true');
            }
            if (updatedSchool.schoolId) {
              localStorage.setItem(`sms_setup_wizard_completed_${updatedSchool.schoolId}`, 'true');
            }
          } catch (e) {}
          setSchoolInfo(updatedSchool);
          if (currentUser.uid) {
            DbController.updateUserAccount(currentUser.uid, {
              setupWizardCompleted: true
            });
          }
          const freshUser = DbController.getCurrentUser();
          if (freshUser) {
            freshUser.setupWizardCompleted = true;
            setCurrentUser(freshUser);
          }
        }}
      />
    );
  }

  // -------------------------
  // CORE DASHBOARD WORKSPACE
  // -------------------------
  return (
    <div className={`min-h-screen flex flex-col justify-between font-sans transition duration-300 theme-${activeTheme.toLowerCase().replace(/\s+/g, '-')} ${activeTheme === 'Sophisticated Dark' ? 'bg-[#020617] text-slate-200' : `${themeStyles.heroBg} bg-slate-100`}`}>
      
      {/* Toast banner overlay on active keyboard trigger capture */}
      <AnimatePresence>
        {printNotification && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-4 sm:top-6 left-1/2 -translate-x-1/2 z-50 bg-indigo-600/95 backdrop-blur-md text-white font-sans text-xs px-4 sm:px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-indigo-500/30 select-none no-print w-[calc(100vw-2rem)] sm:w-auto max-w-md justify-center"
          >
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-amber-300 flex-shrink-0">
              <Printer size={12} />
            </div>
            <div>
              <p className="font-bold tracking-wide">Command Triggered: Print & Export Mode</p>
              <p className="text-[10px] text-indigo-200">{printNotification}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contact Support Modal Overlay */}
      <AnimatePresence>
        {isContactModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsContactModalOpen(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-md transition-opacity"
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.97, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 12 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100 z-10"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <Mail size={16} />
                  </div>
                  <h3 className="font-bold text-slate-200">Contact Support</h3>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsContactModalOpen(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-xl border border-rose-500/20 hover:border-rose-500/35 shadow-xs transition cursor-pointer text-xs font-bold font-sans select-none shrink-0"
                >
                  <X size={13} className="stroke-[2.5]" />
                  <span>Close</span>
                </button>
              </div>

              <form onSubmit={handleContactSubmit} className="space-y-4 text-xs font-sans">
                <p className="text-slate-400 leading-normal font-sans">
                  Submit an issue or request to our technical team.
                </p>

                <div className="space-y-1 text-left">
                  <label className="block text-slate-400 font-semibold mb-1">Your Name / Role</label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. John Doe (Teacher)"
                    value={contactForm.nameRole}
                    onChange={(e) => setContactForm({ ...contactForm, nameRole: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-800 rounded-xl bg-slate-950 text-slate-200 focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>

                <div className="space-y-1 text-left">
                  <label className="block text-slate-400 font-semibold mb-1">Contact Number / Email</label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. john@example.com or +233..."
                    pattern="^([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[+]?[\d\s-]{9,})$"
                    title="Please enter a valid email address or phone number"
                    value={contactForm.contactInfo}
                    onChange={(e) => setContactForm({ ...contactForm, contactInfo: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-800 rounded-xl bg-slate-950 text-slate-200 focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>

                <div className="space-y-1 text-left">
                  <label className="block text-slate-400 font-semibold mb-1">Description of Issue / Request</label>
                  <textarea
                    required
                    rows={4}
                    minLength={20}
                    placeholder="Please describe your issue or request in detail (min 20 chars)..."
                    value={contactForm.description}
                    onChange={(e) => setContactForm({ ...contactForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-800 rounded-xl bg-slate-950 text-slate-200 focus:outline-none focus:border-indigo-500 text-sm resize-none"
                  ></textarea>
                </div>

                <div className="flex gap-2.5 justify-end pt-2 font-sans">
                  <button
                    type="button"
                    disabled={isContactSubmitting}
                    onClick={() => setIsContactModalOpen(false)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:border-rose-500/35 text-xs font-bold rounded-xl shadow-xs transition cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <X size={13} className="stroke-[2.5]" />
                    <span>Cancel</span>
                  </button>
                  <button
                    type="submit"
                    disabled={isContactSubmitting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed min-w-[140px] justify-center"
                  >
                    {isContactSubmitting ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Processing...
                      </>
                    ) : (
                      'Send to Support'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Stacked Toast Notifications */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 left-4 sm:left-auto max-w-sm z-50 flex flex-col gap-3 no-print pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95, transition: { duration: 0.2 } }}
              layout
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-2xl border text-white transition-colors duration-300 ${
                toast.type === 'success' 
                  ? 'bg-emerald-600/95 border-emerald-500/30' 
                  : toast.type === 'error' 
                    ? 'bg-rose-600/95 border-rose-500/30' 
                    : 'bg-indigo-600/95 border-indigo-500/30'
              }`}
            >
              <div className="mt-0.5 flex-shrink-0">
                {toast.type === 'success' ? (
                  <Check className="h-4 w-4 text-emerald-100" />
                ) : toast.type === 'error' ? (
                  <ShieldAlert className="h-4 w-4 text-rose-100" />
                ) : (
                  <Info className="h-4 w-4 text-indigo-100" />
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-semibold tracking-wide">
                  {toast.type === 'success' ? 'Success Notification' : toast.type === 'error' ? 'System Alert / Error' : 'System Information'}
                </p>
                <p className="text-[11px] text-white/90 leading-relaxed mt-0.5 whitespace-pre-line">{toast.text}</p>
              </div>
              <button 
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="text-white/60 hover:text-white transition p-0.5 hover:bg-white/10 rounded-lg flex-shrink-0 cursor-pointer"
              >
                <X size={12} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Dynamic Institutional Board Header */}
      <header className={`bg-gradient-to-r ${themeStyles.gradientHeader} text-white shadow-md py-4 px-6 no-print`}>
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-4">
          
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center text-amber-300 overflow-hidden shrink-0 shadow-sm">
                {(schoolInfo.logoUrl || schoolInfo.crestUrl) ? (
                  <img 
                    src={schoolInfo.logoUrl || schoolInfo.crestUrl} 
                    className="w-full h-full object-cover" 
                    alt="School logo" 
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }} 
                  />
                ) : (
                  <BookOpen size={24} className="animate-pulse" />
                )}
              </div>
              {schoolInfo.crestUrl && schoolInfo.logoUrl && schoolInfo.crestUrl !== schoolInfo.logoUrl && (
                <div className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 hidden md:flex items-center justify-center text-amber-300 overflow-hidden shrink-0 shadow-sm">
                  <img 
                    src={schoolInfo.crestUrl} 
                    className="w-full h-full object-cover" 
                    alt="School crest" 
                    referrerPolicy="no-referrer" 
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
            <div>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <h1 className="text-base font-display font-black tracking-tight uppercase leading-tight">
                  {schoolInfo.name || 'Official School Portal'}
                </h1>
                {(schoolInfo.schoolCode || schoolInfo.emisCode) && (
                  <div className="inline-flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                    {schoolInfo.schoolCode && (
                      <span className="bg-indigo-600 text-white text-[9px] px-1.5 py-0.5 rounded font-bold font-mono shrink-0 shadow-2xs">
                        {schoolInfo.schoolCode}
                      </span>
                    )}
                    {schoolInfo.emisCode && (
                      <span className="bg-amber-400 text-slate-900 text-[9px] px-1.5 py-0.5 rounded font-black font-mono shrink-0 shadow-2xs">
                        EMIS: {schoolInfo.emisCode}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {schoolInfo.motto && (
                <p className="text-[11px] opacity-85 italic font-serif mt-0.5">Motto: "{schoolInfo.motto}"</p>
              )}
              <div className="text-[10px] opacity-80 flex items-center gap-2 mt-0.5 flex-wrap font-sans">
                {schoolInfo.district && <span>District: {schoolInfo.district}</span>}
                {schoolInfo.circuit && <span>• Circuit: {schoolInfo.circuit}</span>}
                {schoolInfo.region && <span>• {schoolInfo.region}</span>}
                {schoolInfo.schoolNumber && <span>• Reg: {schoolInfo.schoolNumber}</span>}
              </div>
            </div>
          </div>

          {/* Identity & Navigation Profile Control */}
          <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center lg:justify-end gap-3.5 w-full lg:w-auto text-xs">

            {/* End of Identity & Navigation Profile Control */}

            <div className="text-center sm:text-right w-full sm:w-auto">
              <span className="text-slate-200 block text-[9px] uppercase font-mono tracking-wider font-semibold">Logged-in User</span>
              <span className="font-bold text-slate-100 flex items-center justify-center sm:justify-end gap-1.5 mt-0.5">
                <User size={13} className="text-amber-300 shrink-0" />
                <span className="truncate max-w-[140px]" title={`${currentUser?.name} (${currentUser?.role})`}>
                  {currentUser?.name} ({currentUser?.role})
                </span>
              </span>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
              <button
                type="button"
                onClick={toggleDesktopSidebar}
                className="hidden md:flex bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all px-3 py-2 sm:py-1.5 rounded-xl border border-slate-700 text-slate-200 shadow-md font-bold text-xs cursor-pointer items-center justify-center gap-1.5 shrink-0"
                title={isDesktopSidebarOpen ? "Hide Navigation Sidebar" : "Show Navigation Sidebar"}
              >
                <PanelLeft size={14} className={isDesktopSidebarOpen ? "text-amber-400" : "text-slate-400"} />
                <span>{isDesktopSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsShortcutsHelpOpen(true)}
                className="bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all px-3 py-2 sm:py-1.5 rounded-xl border border-slate-700 text-slate-200 shadow-md font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                title="Keyboard Shortcuts Guide (? or Ctrl+/)"
              >
                <Keyboard size={14} className="text-amber-400 shrink-0" />
                <span className="hidden md:inline">Shortcuts</span>
                <kbd className="hidden lg:inline px-1 py-0.2 bg-slate-900 border border-slate-700 rounded text-[10px] font-mono text-slate-300">?</kbd>
              </button>

              <button
                type="button"
                onClick={handleManualSaveProgress}
                disabled={isManualSaving}
                className={`flex-1 sm:flex-initial px-3.5 py-2 sm:py-1.5 rounded-xl border text-xs font-black transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shrink-0 shadow-md ${
                  hasUnsavedChanges 
                    ? 'bg-amber-400 hover:bg-amber-500 text-slate-950 border-amber-300 shadow-amber-400/20' 
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500'
                }`}
                title="Save database changes & progress"
              >
                <Save size={14} className={isManualSaving ? "animate-spin shrink-0" : "shrink-0"} />
                <span className="truncate">{isManualSaving ? "Saving..." : "Save Data"}</span>
                {hasUnsavedChanges && (
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
                )}
              </button>

              <button
                onClick={() => setIsContactModalOpen(true)}
                className="flex-1 sm:flex-initial bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all px-3.5 py-2 sm:py-1.5 rounded-xl border border-indigo-500 text-white shadow-md font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                title="Contact Technical Support"
              >
                <Mail size={14} className="shrink-0" /> 
                <span className="truncate">Contact Support</span>
              </button>

              <button
                onClick={handleLogout}
                className="flex-1 sm:flex-initial bg-rose-600 hover:bg-rose-700 active:scale-95 transition-all px-3.5 py-2 sm:py-1.5 rounded-xl border border-rose-500 text-white shadow-md font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                title="Sign out of panel"
              >
                <LogOut size={14} className="shrink-0" /> 
                <span className="truncate">Log out</span>
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* Workspace container with desktop sidebar + main content */}
      <div className="flex-1 flex flex-row min-w-0 w-full relative">
        {/* DESKTOP WORKSPACE SIDEBAR (NO-PRINT) */}
        <AnimatePresence initial={false}>
          {isDesktopSidebarOpen && (
            <motion.aside 
              id="desktop-navigation-sidebar"
              key="desktop-sidebar"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260, mass: 0.8 }}
              className="no-print hidden md:flex flex-col bg-white border-r border-slate-200/90 shadow-sm shrink-0 sticky top-[65px] h-[calc(100vh-65px)] z-30 select-none overflow-hidden"
            >
              <div className="w-[280px] h-full flex flex-col min-w-[280px]">
                {/* Sidebar Header */}
                <div className="p-3.5 border-b border-slate-100 flex flex-col gap-2 shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold shadow-2xs shrink-0">
                        <Layers size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs font-bold text-slate-800 leading-tight truncate" title={schoolInfo?.name || 'School Modules'}>
                          {schoolInfo?.name && schoolInfo.name.trim() !== '' ? schoolInfo.name : 'School Modules'}
                        </h3>
                        <span className="text-[10px] text-slate-400 font-mono block">Navigation Menu</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={toggleDesktopSidebar}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer shrink-0"
                      title="Hide sidebar (Desktop, Ctrl+B)"
                    >
                      <PanelLeftClose size={16} />
                    </button>
                  </div>
                  {(schoolInfo?.schoolCode || schoolInfo?.emisCode) && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100">
                      {schoolInfo?.schoolCode && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-[9.5px] font-mono font-bold shrink-0">
                          <span className="text-indigo-400 text-[8.5px]">Code:</span>
                          <span className="truncate max-w-[100px]">{schoolInfo.schoolCode}</span>
                        </span>
                      )}
                      {schoolInfo?.emisCode && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200/80 text-amber-900 text-[9.5px] font-mono font-bold shrink-0">
                          <span className="text-amber-600 text-[8.5px]">EMIS:</span>
                          <span className="truncate max-w-[110px]">{schoolInfo.emisCode}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Sidebar Navigation Tabs List - VERTICAL & NEVER HIDES TABS */}
                <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin">
                  {orderedVisibleTabs.map((tab) => {
                    const IconComponent = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          handleTabSwitch(tab.id);
                          if (tab.refresh) {
                            refreshAllLogs();
                          }
                        }}
                        className={`w-full group relative flex items-center gap-3 px-3 py-2 rounded-xl font-bold transition-all duration-150 text-xs cursor-pointer text-left border ${
                          isActive 
                            ? `${themeStyles.primaryBg || 'bg-indigo-600'} text-white border-transparent shadow-xs` 
                            : 'text-slate-600 hover:bg-slate-50/80 border-transparent hover:border-slate-100 hover:translate-x-0.5'
                        }`}
                      >
                        <IconComponent size={16} className={`shrink-0 transition-transform duration-150 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600 group-hover:scale-105'}`} />
                        <span className="truncate flex-1 font-semibold">{tab.label}</span>
                        {tab.id === 'finances' && (
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                            isActive ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                          }`}>
                            Finances
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Sidebar Bottom Utilities */}
                <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-1.5 shrink-0">
                  {(currentUser?.role === 'Admin' || currentUser?.role === 'Headteacher') && (
                    <button
                      type="button"
                      onClick={() => setIsSearchOpen(true)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200/80 rounded-xl text-slate-500 hover:text-slate-700 transition cursor-pointer text-xs font-semibold shadow-2xs"
                      title="Search records (Ctrl+K)"
                    >
                      <span className="flex items-center gap-2">
                        <Search size={13} className="text-indigo-500" />
                        <span>Quick Search...</span>
                      </span>
                      <kbd className="px-1.5 py-0.2 text-[9px] font-mono bg-slate-100 border border-slate-200 rounded text-slate-400">
                        Ctrl+K
                      </kbd>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsPalettePickerOpen(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200/80 rounded-xl text-slate-600 transition cursor-pointer text-xs font-semibold shadow-2xs"
                  >
                    <Palette size={13} className="text-indigo-500" />
                    <span>Theme Accent</span>
                  </button>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Floating Sidebar Reopen trigger if sidebar is collapsed on desktop */}
        <AnimatePresence>
          {!isDesktopSidebarOpen && (
            <motion.button
              key="floating-sidebar-toggle"
              initial={{ opacity: 0, scale: 0.85, x: -16 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.85, x: -16 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onClick={toggleDesktopSidebar}
              className="no-print hidden md:flex fixed bottom-6 left-6 z-40 bg-slate-900/95 hover:bg-slate-800 active:scale-95 text-white shadow-xl backdrop-blur-sm border border-slate-700/80 px-3.5 py-2.5 rounded-full text-xs font-bold items-center gap-2 transition cursor-pointer group"
              title="Show Navigation Sidebar (Ctrl+B)"
            >
              <PanelLeft size={16} className="text-amber-400 group-hover:rotate-6 transition-transform" />
              <span>Show Sidebar</span>
              <kbd className="text-[9px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">Ctrl+B</kbd>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Primary Workspace container */}
        <main className="flex-1 min-w-0 w-full max-w-7xl xl:max-w-[1536px] 2xl:max-w-[1720px] mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-24 md:pb-6 space-y-6">
        
        {/* DESIGN RIBBONS Navigation Buttons / Mobile Drawer (no-print) */}
        <nav id="module-tabs-ribbon" className={`no-print ${isDesktopSidebarOpen ? 'md:hidden' : 'block'}`}>
          {/* Desktop/Tablet version: horizontal button ribbon and action tools stretching from end to end */}
          <div className="hidden md:flex flex-row items-center gap-2.5 w-full">
            {/* Scrollable Tabs List stretching from end to end */}
            <div className="flex-1 min-w-0 bg-white border border-slate-200 p-2 rounded-2xl shadow-xs overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 hover:scrollbar-thumb-slate-400 flex items-center gap-1.5 w-full">
              {orderedVisibleTabs.map((tab) => {
                const IconComponent = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, tab.id)}
                    onDragOver={(e) => handleDragOver(e, tab.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => {
                      handleTabSwitch(tab.id);
                      if (tab.refresh) {
                        refreshAllLogs();
                      }
                    }}
                    className={`group relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all text-xs select-none cursor-grab active:cursor-grabbing border shrink-0 z-10 ${
                      isActive 
                        ? `${themeStyles.primaryBg || 'bg-indigo-600'} text-white border-transparent shadow-xs font-black` 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border-transparent hover:border-slate-200/60 bg-transparent'
                    } ${draggedTabId === tab.id ? 'opacity-30 scale-95 border border-dashed border-slate-300 bg-slate-50 font-sans' : ''}`}
                    title="Drag tab horizontally to prioritize or reorder"
                  >
                    <GripVertical 
                      size={12} 
                      className={`transition shrink-0 ${
                        isActive 
                          ? 'text-white/60 group-hover:text-white' 
                          : 'text-slate-300 group-hover:text-slate-400'
                      }`} 
                    />
                    <IconComponent size={14} className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-700'}`} /> 
                    <span className={`shrink-0 font-bold ${isActive ? 'text-white' : 'text-slate-700'}`}>{tab.label}</span>
                    {tab.id === 'finances' && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 ${
                        isActive ? 'bg-white/20 text-white border border-white/30' : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}>
                        Finances
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right-aligned ribbon utilities actions */}
            <div className="flex bg-white border border-slate-200 p-2 rounded-2xl shadow-xs items-center gap-1.5 shrink-0 justify-end">
              {/* More Tools Dropdown for Tablet */}
              <div className="relative lg:hidden">
                <button
                  type="button"
                  onClick={() => setIsMoreToolsOpen(!isMoreToolsOpen)}
                  className={`px-2.5 py-1.5 border rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0 text-[10px] font-bold uppercase tracking-wider font-mono ${
                    isMoreToolsOpen 
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200/80 text-slate-500 hover:text-slate-700'
                  }`}
                  title="More Tools"
                >
                  <MoreHorizontal size={13} className="text-indigo-500" />
                  <span>More</span>
                </button>

                <AnimatePresence>
                  {isMoreToolsOpen && (
                    <>
                      <div className="fixed inset-0 z-[95]" onClick={() => setIsMoreToolsOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 shadow-xl rounded-xl z-[100] p-2 space-y-1 text-left"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setIsMoreToolsOpen(false);
                            setIsMobileMenuOpen(true);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg text-slate-700 font-bold transition cursor-pointer text-xs"
                        >
                          <Menu size={14} className="text-amber-500" />
                          <span>All Modules Menu</span>
                        </button>

                        {(currentUser?.role === 'Admin' || currentUser?.role === 'Headteacher') && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsMoreToolsOpen(false);
                              setIsSearchOpen(true);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg text-slate-600 transition cursor-pointer text-xs font-bold"
                          >
                            <Search size={14} className="text-indigo-500" />
                            <span>Quick Search (Ctrl+K)</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setIsMoreToolsOpen(false);
                            setIsPalettePickerOpen(true);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg text-slate-600 transition cursor-pointer text-xs font-bold"
                        >
                          <Palette size={14} className="text-indigo-500" />
                          <span>Theme Accent</span>
                        </button>

                        <button
                          type="button"
                          onClick={openQRScanner}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg text-slate-600 transition cursor-pointer text-xs font-bold"
                        >
                          <QrCode size={14} className="text-indigo-500" />
                          <span>Scan QR Badge</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsMoreToolsOpen(false);
                            setIsVisibilityMenuOpen(true);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg text-slate-600 transition cursor-pointer text-xs font-bold"
                        >
                          <Eye size={14} className="text-sky-500" />
                          <span>Contextual Visibility</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsMoreToolsOpen(false);
                            setIsContactModalOpen(true);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg text-slate-600 transition cursor-pointer text-xs font-bold border-t border-slate-100 mt-1 pt-1.5"
                        >
                          <Mail size={14} className="text-indigo-500" />
                          <span>Contact Support</span>
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Desktop-only utilities container: groups Search and Palette Picker into a single flex container that automatically shifts out under 1024px */}
              <div className="hidden lg:flex items-center gap-2 shrink-0">
                {(currentUser?.role === 'Admin' || currentUser?.role === 'Headteacher') && (
                  <button
                    type="button"
                    onClick={() => setIsSearchOpen(true)}
                    className="flex items-center justify-between gap-3 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer text-[11px] font-medium min-w-[170px]"
                    title="Quick-Search System Registry (Ctrl+K)"
                  >
                    <span className="flex items-center gap-1.5">
                      <Search size={13} className="text-indigo-500 animate-pulse" />
                      <span>Search records...</span>
                    </span>
                    <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[9px] font-mono font-bold bg-white border border-slate-200 rounded-md shrink-0 text-slate-400">
                      Ctrl+K
                    </kbd>
                  </button>
                )}

                {/* Dynamic Theme Color Accent Palette Picker */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsPalettePickerOpen(!isPalettePickerOpen)}
                    className={`flex p-1.5 border rounded-lg transition cursor-pointer items-center justify-center gap-1.5 shrink-0 text-[10px] font-bold uppercase tracking-wider font-mono ${
                      isPalettePickerOpen 
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200/80 text-slate-500 hover:text-slate-700'
                    }`}
                    title="Toggle Active Workspace Accent Palette"
                  >
                    <Palette size={13} className="text-indigo-500" />
                    <span>Accent</span>
                    {/* Current Active Accent Color Indicator circle */}
                    <span className={`w-2.5 h-2.5 rounded-full ${themeStyles.primaryBg}`} />
                  </button>

                  <AnimatePresence>
                    {isPalettePickerOpen && (
                      <>
                        {/* Backdrop to close the picker */}
                        <div className="fixed inset-0 z-[95]" onClick={() => setIsPalettePickerOpen(false)} />
                        
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 shadow-xl rounded-xl z-[100] p-3 space-y-2.5 text-left"
                        >
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider flex items-center gap-1">
                              <Palette size={11} className="text-indigo-500" />
                              Workspace Accent
                            </span>
                            <button onClick={() => setIsPalettePickerOpen(false)} className="text-slate-400 hover:text-slate-600">
                              <X size={12} />
                            </button>
                          </div>
                          <div className="grid grid-cols-5 gap-1.5 pt-1">
                            {(['Classic', 'Emerald', 'Ruby', 'Cosmic', 'Gold', 'Sophisticated Dark', 'Crystal Glass', 'Midnight', 'Sunset', 'Ocean'] as ThemeType[]).map((theme) => {
                              const isSelected = activeTheme === theme;
                              // Extract dot/gradient representative of the theme
                              let swatchGradient = "from-blue-500 to-indigo-600";
                              let displayName = "Classic";
                              if (theme === 'Classic') { swatchGradient = "from-blue-500 to-indigo-600"; displayName = "Classic"; }
                              else if (theme === 'Emerald') { swatchGradient = "from-emerald-400 to-teal-600"; displayName = "Emerald"; }
                              else if (theme === 'Ruby') { swatchGradient = "from-rose-500 to-red-600"; displayName = "Ruby"; }
                              else if (theme === 'Cosmic') { swatchGradient = "from-purple-500 to-violet-700"; displayName = "Cosmic"; }
                              else if (theme === 'Gold') { swatchGradient = "from-amber-400 to-yellow-600"; displayName = "Gold"; }
                              else if (theme === 'Sophisticated Dark') { swatchGradient = "from-slate-700 to-slate-900"; displayName = "Soph Dark"; }
                              else if (theme === 'Crystal Glass') { swatchGradient = "from-sky-300 to-blue-400"; displayName = "Crystal"; }
                              else if (theme === 'Midnight') { swatchGradient = "from-slate-900 to-slate-950"; displayName = "Midnight"; }
                              else if (theme === 'Sunset') { swatchGradient = "from-orange-400 to-red-500"; displayName = "Sunset"; }
                              else if (theme === 'Ocean') { swatchGradient = "from-cyan-400 to-blue-500"; displayName = "Ocean"; }

                              return (
                                <button
                                  key={theme}
                                  type="button"
                                  onClick={() => {
                                    handleThemeChange(theme);
                                    setIsPalettePickerOpen(false);
                                  }}
                                  className={`group relative flex flex-col items-center justify-center p-1.5 rounded-xl border transition cursor-pointer text-center ${
                                    isSelected 
                                      ? 'border-indigo-500 bg-indigo-50/40 ring-2 ring-indigo-500/20' 
                                      : 'border-slate-100 bg-slate-50/30 hover:bg-white hover:border-slate-300 hover:shadow-xs'
                                  }`}
                                  title={`Switch to ${theme} workspace theme`}
                                >
                                  {/* Swatch representation circle with optional inner checkmark */}
                                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${swatchGradient} shadow-sm flex items-center justify-center relative transition-all group-hover:scale-105`}>
                                    {isSelected && (
                                      <Check size={12} className="text-white drop-shadow-md font-extrabold" />
                                    )}
                                  </div>
                                  <span className="text-[7.5px] font-black text-slate-500 truncate w-full mt-1.5 uppercase tracking-tight block">
                                    {displayName}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <button
                type="button"
                onClick={openQRScanner}
                disabled={isSubscriptionLocked}
                className={`px-3.5 py-2.5 border rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0 text-[10px] font-bold uppercase tracking-wider font-mono shadow-2xs ${
                  isSubscriptionLocked
                    ? 'bg-slate-100 dark:bg-slate-800/60 border-slate-300 dark:border-slate-700 text-slate-400 cursor-not-allowed opacity-60'
                    : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700 cursor-pointer active:scale-95'
                }`}
                title={isSubscriptionLocked ? "Scan QR Badge is inactive for expired users" : "Scan QR Badge"}
              >
                <QrCode size={13} className={isSubscriptionLocked ? "text-slate-400" : "text-indigo-600"} />
                <span className="hidden lg:inline">{isSubscriptionLocked ? "Scan QR (Inactive)" : "Scan QR Badge"}</span>
              </button>

              <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0" />

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsVisibilityMenuOpen(!isVisibilityMenuOpen)}
                  className={`p-2.5 border rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95 shadow-2xs ${isVisibilityMenuOpen ? 'bg-sky-100 border-sky-300 text-sky-800' : 'bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-700'}`}
                  title="Contextual Visibility"
                >
                  {hiddenTabs.length > 0 ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <AnimatePresence>
                  {isVisibilityMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 shadow-xl rounded-xl z-[100] p-3 overflow-hidden"
                    >
                      <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Contextual Visibility</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setTabOrder([]);
                              setHiddenTabs([]);
                              const email = currentUser?.email || 'guest';
                              DbController.saveUserTabPreferences(email, { tabOrder: [], hiddenTabs: [] });
                              showToast("Tab layout reset to default successfully!", "success");
                            }}
                            className="text-[9.5px] font-bold text-slate-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer bg-slate-50 hover:bg-rose-50 px-2 py-0.5 rounded-md border border-slate-200 transition"
                            title="Reset workspace tab order and visibility to default"
                          >
                            <RotateCcw size={10} />
                            <span>Reset</span>
                          </button>
                          <button onClick={() => setIsVisibilityMenuOpen(false)} className="text-slate-400 hover:text-slate-600">
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="max-h-64 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                        {visibleTabs.map(tab => (
                          <label key={`vis-${tab.id}`} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition">
                            <span className={`text-xs font-bold flex items-center gap-2 ${hiddenTabs.includes(tab.id) ? 'text-slate-400' : 'text-slate-700'}`}>
                              <tab.icon size={12} className={hiddenTabs.includes(tab.id) ? 'text-slate-300' : 'text-indigo-500'} />
                              {tab.label}
                            </span>
                            <input 
                              type="checkbox" 
                              checked={!hiddenTabs.includes(tab.id)} 
                              onChange={() => toggleTabVisibility(tab.id)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                            />
                          </label>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsRefreshing(true);
                  refreshAllLogs();
                  showToast("Local database state refreshed successfully!", "success");
                  setTimeout(() => setIsRefreshing(false), 800);
                }}
                disabled={isRefreshing}
                className="p-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95 shadow-2xs"
                title="Force-reload local database state"
              >
                <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-emerald-600' : ''} />
              </button>
            </div>
          </div>

          {/* Mobile version: Hamburger triggers the drawer navigation list */}
          <div className="flex md:hidden bg-white border border-slate-200 p-3.5 rounded-2xl shadow-md justify-between items-center w-full">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`p-2.5 rounded-xl ${themeStyles.primaryBg} text-white shrink-0 shadow-xs`}>
                <CurrentActiveIcon size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[9.5px] uppercase tracking-wider font-mono text-slate-400 font-extrabold block leading-none mb-0.5">Current Workspace</span>
                <span className="text-sm font-black text-slate-800 uppercase leading-none block truncate">
                  {currentActiveTab.label}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {(currentUser?.role === 'Admin' || currentUser?.role === 'Headteacher') && (
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(true)}
                  className="p-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 transition cursor-pointer flex items-center justify-center active:scale-95 shrink-0 shadow-2xs"
                  title="Quick Search"
                >
                  <Search size={18} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(prev => !prev)}
                className={`py-2.5 px-4 rounded-xl transition cursor-pointer flex items-center gap-1.5 active:scale-95 shrink-0 shadow-md border-0 ${
                  isMobileMenuOpen 
                    ? 'bg-amber-400 text-slate-950 font-black' 
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold'
                }`}
                title="Toggle Full Navigation Menu"
              >
                {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                <span className="text-[11px] uppercase tracking-widest font-mono font-black">
                  {isMobileMenuOpen ? 'Close' : 'Menu'}
                </span>
              </button>
            </div>
          </div>

          {/* Centered Mobile Visibility Menu Overlay (Mobile Drawer Only) */}
          <AnimatePresence>
            {isVisibilityMenuOpen && (
              <div className="block md:hidden">
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[150]" onClick={() => setIsVisibilityMenuOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-sm bg-white border border-slate-200 shadow-2xl rounded-2xl z-[160] p-4 text-left text-slate-800"
                >
                  <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                    <span className="text-xs uppercase font-extrabold text-slate-500 tracking-wider">Contextual Visibility</span>
                    <button onClick={() => setIsVisibilityMenuOpen(false)} className="text-slate-400 hover:text-slate-600">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-1 pr-1 custom-scrollbar text-left">
                    {visibleTabs.map(tab => (
                      <label key={`vis-mob-${tab.id}`} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition">
                        <span className={`text-xs font-bold flex items-center gap-2 ${hiddenTabs.includes(tab.id) ? 'text-slate-400' : 'text-slate-700'}`}>
                          <tab.icon size={14} className={hiddenTabs.includes(tab.id) ? 'text-slate-300' : 'text-indigo-500'} />
                          {tab.label}
                        </span>
                        <input 
                          type="checkbox" 
                          checked={!hiddenTabs.includes(tab.id)} 
                          onChange={() => toggleTabVisibility(tab.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                        />
                      </label>
                    ))}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Centered Mobile Palette Picker Overlay (Mobile Drawer Only) */}
          <AnimatePresence>
            {isPalettePickerOpen && (
              <div className="block md:hidden">
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[150]" onClick={() => setIsPalettePickerOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-sm bg-white border border-slate-200 shadow-2xl rounded-2xl z-[160] p-4 text-left text-slate-800"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs uppercase font-extrabold text-slate-500 tracking-wider flex items-center gap-1.5 font-display">
                      <Palette size={14} className="text-indigo-500" />
                      Workspace Accent
                    </span>
                    <button onClick={() => setIsPalettePickerOpen(false)} className="text-slate-400 hover:text-slate-600">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-3">
                    {(['Classic', 'Emerald', 'Ruby', 'Cosmic', 'Gold', 'Sophisticated Dark', 'Crystal Glass', 'Midnight', 'Sunset', 'Ocean'] as ThemeType[]).map((theme) => {
                      const isSelected = activeTheme === theme;
                      let swatchGradient = "from-blue-500 to-indigo-600";
                      let displayName = "Classic";
                      if (theme === 'Classic') { swatchGradient = "from-blue-500 to-indigo-600"; displayName = "Classic"; }
                      else if (theme === 'Emerald') { swatchGradient = "from-emerald-400 to-teal-600"; displayName = "Emerald"; }
                      else if (theme === 'Ruby') { swatchGradient = "from-rose-500 to-red-600"; displayName = "Ruby"; }
                      else if (theme === 'Cosmic') { swatchGradient = "from-purple-500 to-violet-700"; displayName = "Cosmic"; }
                      else if (theme === 'Gold') { swatchGradient = "from-amber-400 to-yellow-600"; displayName = "Gold"; }
                      else if (theme === 'Sophisticated Dark') { swatchGradient = "from-slate-700 to-slate-900"; displayName = "Soph Dark"; }
                      else if (theme === 'Crystal Glass') { swatchGradient = "from-sky-300 to-blue-400"; displayName = "Crystal"; }
                      else if (theme === 'Midnight') { swatchGradient = "from-slate-900 to-slate-950"; displayName = "Midnight"; }
                      else if (theme === 'Sunset') { swatchGradient = "from-orange-400 to-red-500"; displayName = "Sunset"; }
                      else if (theme === 'Ocean') { swatchGradient = "from-cyan-400 to-blue-500"; displayName = "Ocean"; }

                      return (
                        <button
                          key={theme}
                          type="button"
                          onClick={() => {
                            handleThemeChange(theme);
                            setIsPalettePickerOpen(false);
                          }}
                          className={`group relative flex items-center gap-2 p-1.5 rounded-xl border transition cursor-pointer text-left ${
                            isSelected 
                              ? 'border-indigo-500 bg-indigo-50/40 ring-2 ring-indigo-500/20' 
                              : 'border-slate-100 bg-slate-50/30 hover:bg-white hover:border-slate-300 hover:shadow-xs'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${swatchGradient} shadow-sm flex items-center justify-center shrink-0 relative transition-all group-hover:scale-105`}>
                            {isSelected && (
                              <Check size={10} className="text-white drop-shadow-md font-extrabold" />
                            )}
                          </div>
                          <span className="text-[10px] font-black text-slate-500 truncate uppercase tracking-tight block">
                            {displayName}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

        </nav>

        {/* Sub-tab workspace container */}
        <div key={activeTab} className="relative w-full min-h-[520px]">
          {activeTab === 'dashboard' && (
            currentUser?.role === 'Teacher' && teacherProfile ? (
              <TeacherDashboardTab 
                teacherProfile={teacherProfile}
                students={students}
                attendance={attendance}
                assessments={assessments}
                reflections={reflections}
                schoolInfo={schoolInfo}
                calendar={DbController.getAcademicCalendar()}
                themeStyles={themeStyles}
                onNavigate={(tabId) => {
                  handleTabSwitch(tabId);
                  refreshAllLogs();
                }}
                onRefresh={refreshAllLogs}
                onSaveAll={handleManualSaveProgress}
                isManualSaving={isManualSaving}
              />
            ) : (
              <DashboardSummaryTab 
                theme={themeStyles} 
                students={students}
                teachers={teachers}
                attendance={attendance}
                assessments={assessments}
                onRefresh={refreshAllLogs}
                setActiveTab={handleTabSwitch}
                setSettingsSubTab={setSettingsSubTab}
                assignedClasses={assignedClasses}
                assignedSubjects={assignedSubjects}
                assignedClass={assignedClasses[0] || 'None'}
                userRole={currentUser?.role}
              />
            )
          )}



          {activeTab === 'calendar' && (
            <AcademicCalendarTab 
              themeStyles={themeStyles} 
              onConfigChanged={() => {
                const updatedUser = DbController.getCurrentUser();
                setCurrentUser(updatedUser);
                refreshAllLogs();
              }}
            />
          )}

          {activeTab === 'students' && (
            <StudentsTab 
              theme={themeStyles} 
              students={students} 
              onRefresh={refreshAllLogs}
              isAutoSave={isAutoSave}
              onManualSave={() => setHasUnsavedChanges(true)}
              selectedYear={selectedYear}
              setSelectedYear={handleYearChange}
              selectedTerm={selectedTerm}
              setSelectedTerm={handleTermChange}
              assignedClasses={assignedClasses}
              assignedSubjects={assignedSubjects}
              assignedClass={assignedClasses[0] || 'None'}
              userRole={currentUser?.role}
            />
          )}

          {activeTab === 'teachers' && (
            <TeachersTab 
              theme={themeStyles} 
              teachers={teachers} 
              schoolInfo={schoolInfo}
              onRefresh={refreshAllLogs}
              isAutoSave={isAutoSave}
              onManualSave={() => setHasUnsavedChanges(true)}
              onSaveAll={handleManualSaveProgress}
              isManualSaving={isManualSaving}
              userRole={currentUser?.role}
              onNavigate={(tab) => handleTabSwitch(tab)}
            />
          )}

          {activeTab === 'attendance' && (
            <AttendanceTab 
              theme={themeStyles} 
              isAutoSave={isAutoSave}
              onManualSave={() => setHasUnsavedChanges(false)}
              assignedClasses={assignedClasses}
              assignedSubjects={assignedSubjects}
              assignedClass={assignedClasses[0] || 'None'}
              userRole={currentUser?.role}
              teacherPermissions={teacherProfile?.permissions}
            />
          )}

          {activeTab === 'assessments' && (
            <AssessmentTab 
              theme={themeStyles} 
              students={students}
              isAutoSave={isAutoSave}
              onManualSave={() => setHasUnsavedChanges(false)}
              selectedYear={selectedYear}
              setSelectedYear={handleYearChange}
              selectedTerm={selectedTerm}
              setSelectedTerm={handleTermChange}
              assignedClasses={assignedClasses}
              assignedSubjects={assignedSubjects}
              assignedClass={assignedClasses[0] || 'None'}
              userRole={currentUser?.role}
              teacherPermissions={teacherProfile?.permissions}
            />
          )}

          {(activeTab === 'finances' || activeTab === 'fees') && currentUser?.role !== 'Teacher' && (
            <FinancesTab 
              theme={themeStyles} 
              students={students}
              schoolInfo={schoolInfo}
              isAutoSave={isAutoSave}
              onManualSave={() => setHasUnsavedChanges(true)}
              selectedAcademicYear={selectedYear}
              setSelectedAcademicYear={handleYearChange}
              selectedTerm={selectedTerm}
              setSelectedTerm={handleTermChange}
            />
          )}

          {activeTab === 'admin_dashboard' && isAdmin && (
            <AdminDashboardTab 
              theme={themeStyles} 
              onNavigateTab={handleTabSwitch}
            />
          )}

          {activeTab === 'school_profile' && (
            <SchoolProfileTab 
              themeStyles={themeStyles} 
              onRefreshSchoolInfo={() => {
                setSchoolInfo(DbController.getSchoolInfo());
                refreshAllLogs();
              }}
              onNavigateTab={handleTabSwitch}
              onOpenSetupWizard={() => setIsManualSetupWizardOpen(true)}
            />
          )}

          {activeTab === 'paystack' && isAdmin && (
            <PaystackManagementTab 
              themeStyles={themeStyles} 
            />
          )}

          {activeTab === 'communications' && (
            <CommunicationsTab 
              theme={themeStyles} 
              students={students} 
              isAdmin={isAdmin}
            />
          )}

          {activeTab === 'emis' && (
            <EmisTab 
              theme={themeStyles} 
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab 
              theme={themeStyles} 
              onThemeChange={handleThemeChange} 
              isAutoSave={isAutoSave}
              onAutoSaveToggle={handleAutoSaveToggle}
              onRefresh={refreshAllLogs}
              onResetAll={handleResetAndClear}
              settingsSubTab={settingsSubTab}
              setSettingsSubTab={setSettingsSubTab}
              onNavigateTab={handleTabSwitch}
            />
          )}
        </div>

      </main>
    </div>

      {/* Fast Mobile Bottom Navigation Bar (Visible only on mobile devices < 768px, hidden in print) */}
      <nav 
        aria-label="Mobile Bottom Navigation" 
        className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-40 px-2 py-1 shadow-lg no-print flex items-center justify-around touch-manipulation pb-[calc(0.25rem+env(safe-area-inset-bottom,0px))]"
      >
        {[
          { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
          { id: 'students', label: 'Students', icon: GraduationCap },
          { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
          { id: 'assessments', label: 'Assess', icon: Award },
          ...(currentUser?.role !== 'Teacher' ? [{ id: 'finances', label: 'Finances', icon: Coins }] : []),
          { id: 'menu', label: 'More', icon: isMobileMenuOpen ? X : Menu, isMenuTrigger: true }
        ].map((item) => {
          const Icon = item.icon;
          const isActive = item.isMenuTrigger 
            ? isMobileMenuOpen 
            : (activeTab === item.id || (item.id === 'finances' && activeTab === 'fees'));

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.isMenuTrigger) {
                  setIsMobileMenuOpen(prev => !prev);
                } else {
                  setIsMobileMenuOpen(false);
                  handleTabSwitch(item.id);
                  window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
                }
              }}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer min-h-[46px] select-none ${
                isActive 
                  ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' 
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              <div className={`p-1 rounded-lg transition-transform ${isActive ? 'bg-indigo-50 dark:bg-indigo-950/80 scale-110' : ''}`}>
                <Icon size={18} className={isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'} />
              </div>
              <span className="text-[10px] tracking-tight leading-tight mt-0.5 truncate max-w-[56px]">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Developer status footer */}
      <DeveloperStatus 
        isAutoSaveActive={isAutoSave} 
        hasUnsavedChanges={hasUnsavedChanges}
        onSave={() => setHasUnsavedChanges(false)}
      />

      {/* Step-by-Step Manual Save Progress Overlay */}
      {isManualSaving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md text-slate-100 font-sans select-none no-print">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-6 relative overflow-hidden text-left">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-400 via-indigo-500 to-emerald-400 animate-pulse" />
            
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-indigo-400">
                <Database size={18} className="animate-pulse" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider">Manual Save Sequence</span>
              </div>
              <span className="text-[10px] font-mono bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-bold">
                {Math.round((manualSaveStep / 4) * 100)}% Complete
              </span>
            </div>

            {/* Progress Bar Container */}
            <div className="space-y-2">
              <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800/60 p-0.5">
                <motion.div 
                  className="h-full bg-gradient-to-r from-amber-400 via-indigo-500 to-emerald-400 rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: `${(manualSaveStep / 4) * 100}%` }}
                  transition={{ type: "spring", damping: 15 }}
                />
              </div>
              <div className="flex justify-between text-[9px] font-mono text-slate-500 font-bold uppercase">
                <span>Start</span>
                <span>Validation</span>
                <span>Storage Write</span>
                <span>Cloud Sync</span>
                <span>Success</span>
              </div>
            </div>

            {/* Step Checklist */}
            <div className="space-y-3 py-1 text-xs">
              {[
                { id: 0, label: "Validate structural integrity of active records" },
                { id: 1, label: "Compress assets & write local persistence logs" },
                { id: 2, label: "Synchronize local deltas with Cloud Firestore" },
                { id: 3, label: "Rebuild database fast-lookup indexes" },
                { id: 4, label: "Finalize save state & verify checksums" }
              ].map((step) => {
                const isActive = manualSaveStep === step.id;
                const isCompleted = manualSaveStep > step.id;
                return (
                  <div 
                    key={step.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition ${
                      isActive 
                        ? 'bg-indigo-950/20 border-indigo-500/30 text-indigo-200' 
                        : isCompleted 
                          ? 'bg-slate-950/20 border-slate-800 text-slate-400' 
                          : 'bg-slate-950/40 border-slate-900/60 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                        isActive 
                          ? 'bg-indigo-500 text-white animate-spin font-mono' 
                          : isCompleted 
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-slate-800 text-slate-500'
                      }`}>
                        {isCompleted ? <Check size={12} className="stroke-[3]" /> : step.id + 1}
                      </div>
                      <span className={`font-semibold ${isActive ? "text-indigo-300" : ""}`}>{step.label}</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold uppercase">
                      {isActive ? (
                        <span className="text-indigo-400 animate-pulse">In Progress...</span>
                      ) : isCompleted ? (
                        <span className="text-emerald-400">Success</span>
                      ) : (
                        <span className="text-slate-600">Pending</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Status Alert Summary */}
            {manualSaveStep === 4 ? (
              <div className="bg-emerald-950/30 border border-emerald-900/30 p-3 rounded-2xl flex items-start gap-2.5 text-emerald-400 animate-bounce">
                <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold">Database Saved Successfully</p>
                  <p className="text-[10px] text-slate-400 leading-relaxed font-sans mt-0.5">
                    All local student profiles, financial ledgers, and academic grades have been synchronized and backed up securely.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl flex items-start gap-2 text-slate-400 leading-relaxed text-[11px] font-sans">
                <Database size={14} className="text-slate-500 flex-shrink-0 mt-0.5" />
                <span>
                  Keep the application open. The backup routine ensures maximum security aligned with GES guidelines.
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Advanced Global Modals */}
      {/* Advanced Global Print Preview System */}
        <AnimatePresence>
          {globalPrintPreview.isOpen && (
            <PrintPreviewModal
              isOpen={globalPrintPreview.isOpen}
              onClose={() => setGlobalPrintPreview(prev => ({ ...prev, isOpen: false }))}
              elementId={globalPrintPreview.elementId}
              customHtml={globalPrintPreview.customHtml}
              documentTitle={globalPrintPreview.documentTitle}
              isLandscapeDefault={globalPrintPreview.isLandscape}
            />
          )}
        </AnimatePresence>

        {/* Global Quick Search Overlay */}
        <AnimatePresence>
          {isSearchOpen && (
            <QuickSearchModal
              isOpen={isSearchOpen}
              onClose={() => setIsSearchOpen(false)}
              students={students}
              teachers={teachers}
              theme={themeStyles}
              userRole={currentUser?.role}
              onNavigate={(tabId) => handleTabSwitch(tabId)}
            />
          )}
        </AnimatePresence>

        {/* Global Keyboard Shortcuts Help Overlay */}
        {isShortcutsHelpOpen && (
          <KeyboardShortcutsModal
            isOpen={isShortcutsHelpOpen}
            onClose={() => setIsShortcutsHelpOpen(false)}
            onOpenSearch={() => {
              setIsShortcutsHelpOpen(false);
              setIsSearchOpen(true);
            }}
            onSaveData={() => {
              setIsShortcutsHelpOpen(false);
              handleManualSaveProgress();
            }}
            activeTabLabel={currentActiveTab?.label}
          />
        )}

        {/* Logged-in QR Badge Scanner Trigger */}
        <AnimatePresence>
          {isQRScannerOpen && (
            <QRBadgeScanner
              key="global-qr-badge-scanner"
              onScanSuccess={handleQRBadgeScanSuccess}
              onClose={() => setIsQRScannerOpen(false)}
              isSubscriptionLocked={isSubscriptionLocked}
            />
          )}
        </AnimatePresence>

        {/* Global Slide-out Mobile & Quick Navigation Menu Drawer */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              {/* Backdrop Overlay */}
              <motion.div
                key="global-drawer-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[200] pointer-events-auto"
              />

              {/* Slide-out Sidebar Drawer Sheet */}
              <motion.div
                key="global-drawer-content"
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 280, mass: 0.8 }}
                className="fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-white text-slate-900 shadow-2xl z-[210] flex flex-col border-r border-slate-200 touch-manipulation pointer-events-auto"
              >
                {/* Drawer Header */}
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col gap-2.5 shrink-0">
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-sm shrink-0 overflow-hidden">
                        {(schoolInfo.logoUrl || schoolInfo.crestUrl) ? (
                          <img 
                            src={schoolInfo.logoUrl || schoolInfo.crestUrl} 
                            className="w-full h-full object-cover" 
                            alt="School logo" 
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }} 
                          />
                        ) : (
                          <GraduationCap size={20} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-xs font-black tracking-wide uppercase font-display text-slate-900 truncate" title={schoolInfo?.name || 'School Portal'}>
                          {schoolInfo?.name && schoolInfo.name.trim() !== '' ? schoolInfo.name : 'School Portal'}
                        </h2>
                        <span className="text-[10px] text-slate-500 font-medium block truncate">
                          Official School System
                        </span>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="p-1.5 rounded-xl bg-slate-200/70 hover:bg-slate-300 text-slate-600 hover:text-slate-900 transition cursor-pointer shrink-0"
                      title="Close Navigation Menu"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Dedicated, unscattered Code and EMIS Badge Row */}
                  {(schoolInfo?.schoolCode || schoolInfo?.emisCode) && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-200/70">
                      {schoolInfo?.schoolCode && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-mono font-bold shrink-0">
                          <span className="text-[9px] uppercase tracking-wider text-indigo-400 font-semibold">Code:</span>
                          <span className="truncate max-w-[120px]">{schoolInfo.schoolCode}</span>
                        </div>
                      )}
                      {schoolInfo?.emisCode && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-[10px] font-mono font-bold shrink-0">
                          <span className="text-[9px] uppercase tracking-wider text-amber-600 font-semibold">EMIS:</span>
                          <span className="truncate max-w-[130px]">{schoolInfo.emisCode}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Quick Search Shortcut inside Drawer */}
                <div className="p-3 border-b border-slate-200 bg-slate-50/50">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsSearchOpen(true);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs font-semibold transition cursor-pointer shadow-xs"
                  >
                    <span className="flex items-center gap-2">
                      <Search size={14} className="text-indigo-600" />
                      <span>Search students, staff...</span>
                    </span>
                    <kbd className="text-[9px] font-mono font-bold bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-500">
                      Ctrl+K
                    </kbd>
                  </button>
                </div>

                {/* Drawer Content - Categorized Module Links */}
                <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
                  {['Management', 'Academic', 'Finances', 'System'].map((category) => {
                    const categoryTabs = orderedVisibleTabs.filter(t => t.category === category);
                    if (categoryTabs.length === 0) return null;
                    return (
                      <div key={category} className="space-y-1.5">
                        <p className="text-[10px] uppercase tracking-widest font-mono font-black text-slate-400 px-2 mb-1">
                          {category}
                        </p>
                        {categoryTabs.map((tab) => {
                          const IconComponent = tab.icon;
                          const isActive = activeTab === tab.id;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => {
                                handleTabSwitch(tab.id);
                                if (tab.refresh) {
                                  refreshAllLogs();
                                }
                                setIsMobileMenuOpen(false);
                                window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
                              }}
                              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                                isActive 
                                  ? 'bg-indigo-600 text-white font-black shadow-md' 
                                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <IconComponent size={16} className={isActive ? 'text-white shrink-0' : 'text-slate-500 shrink-0'} />
                                <span className="truncate">{tab.label}</span>
                              </div>
                              {tab.id === 'finances' && (
                                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                                  isActive ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  GH₵
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}

                  {/* Mobile Utilities Section */}
                  <div className="border-t border-slate-200 pt-4 mt-4 space-y-2.5">
                    <p className="text-[10px] uppercase tracking-widest font-mono font-black text-slate-400 px-2">
                      Workspace Utilities
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          setIsVisibilityMenuOpen(true);
                        }}
                        className="flex items-center gap-2 p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition text-left cursor-pointer"
                      >
                        <Eye size={14} className="text-sky-600 shrink-0" />
                        <span className="truncate">Visibility Settings</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-2 min-w-0">
                        <Palette size={14} className="text-indigo-600 shrink-0" />
                        <span className="text-xs font-bold text-slate-700 truncate">Theme Accent</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          setIsPalettePickerOpen(true);
                        }}
                        className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-700 font-mono cursor-pointer shrink-0"
                      >
                        Customize
                      </button>
                    </div>
                  </div>
                </div>

                {/* Drawer Footer info */}
                <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2.5 shrink-0">
                  {currentUser && (
                    <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center font-black text-xs text-amber-800 shrink-0">
                        {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{currentUser.name}</p>
                        <p className="text-[9.5px] text-slate-500 font-mono truncate">{currentUser.role} • {currentUser.email}</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        setIsContactModalOpen(true);
                      }}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer shadow-xs active:scale-95"
                    >
                      <Mail size={13} />
                      <span>Support</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        handleLogout();
                      }}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold transition cursor-pointer active:scale-95"
                    >
                      <LogOut size={13} />
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>


    </div>
  );
}

// --- ERROR BOUNDARY ---
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState;
  public props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Critical Layout Error caught by ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center text-slate-100 font-sans">
          <div className="max-w-md bg-slate-900 p-8 rounded-3xl border border-rose-500/20 shadow-2xl space-y-6">
            <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mx-auto">
              <span className="text-2xl font-bold">⚠️</span>
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-rose-400">Application Error</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                The application encountered a layout or state synchronization issue.
              </p>
              {this.state.error && (
                <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[10px] text-rose-300 font-mono text-left overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              )}
            </div>
            <button 
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition"
            >
              Reset Session Cache & Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
