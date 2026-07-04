import React, { useState, useEffect, FormEvent, useMemo, ReactNode, DragEvent, useCallback } from 'react';
import { 
  SchoolInfo, Student, Teacher, UserAccount, UserRole, ThemeType,
  AcademicYearType, TermType, WebAuthnCredential, AttendanceRecord, StudentAssessment, TeacherReflection
} from './types';
import { DbController } from './db';
import { onAuthStateChanged } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { THEME_CONFIGS, ThemeStyles } from './components/ThemeWrapper';
import DeveloperStatus from './components/DeveloperStatus';
// @ts-ignore
import geetechLogo from './assets/images/geetech_new_logo_1782900372763.jpg';
const SchoolProfileTab = React.lazy(() => import('./components/SchoolProfileTab'));
const ParentPortal = React.lazy(() => import('./components/ParentPortal'));
import { generateSecureToken, getWhatsAppShareData, shareParentPortalWhatsApp, WhatsAppTemplate, triggerToast } from './utils';

const StudentsTab = React.lazy(() => import('./components/StudentsTab'));
const TeachersTab = React.lazy(() => import('./components/TeachersTab'));
const AttendanceTab = React.lazy(() => import('./components/AttendanceTab'));
const AssessmentTab = React.lazy(() => import('./components/AssessmentTab'));
const SettingsTab = React.lazy(() => import('./components/SettingsTab'));
const SchoolFeesTab = React.lazy(() => import('./components/SchoolFeesTab'));
const DashboardSummaryTab = React.lazy(() => import('./components/DashboardSummaryTab'));
const TeacherDashboardTab = React.lazy(() => import('./components/TeacherDashboardTab'));
const CommunicationsTab = React.lazy(() => import('./components/CommunicationsTab'));
const AcademicCalendarTab = React.lazy(() => import('./components/AcademicCalendarTab'));
const EmisTab = React.lazy(() => import('./components/EmisTab'));
const PaystackManagementTab = React.lazy(() => import('./components/PaystackManagementTab'));
const AdminDashboardTab = React.lazy(() => import('./components/AdminDashboardTab'));
import { evaluateSubscription } from './subscription';
import SubscriptionLockModal from './components/SubscriptionLockModal';
import { PrintPreviewModal } from './components/PrintPreviewModal';
import QuickSearchModal from './components/QuickSearchModal';
import QRBadgeScanner from './components/QRBadgeScanner';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Landmark, Users, UserCheck, CalendarCheck, FileSpreadsheet, Settings, 
  LogOut, ShieldAlert, Lock, Mail, User, BookOpen, GraduationCap, Sparkles, Coins, RotateCcw,
  ChevronDown, MoreHorizontal, TrendingUp, Power, Smartphone, CalendarDays, Menu, X, ClipboardCheck,
  CreditCard, Fingerprint, Check, Save, Database, GripVertical, Eye, EyeOff, Search, Share, RefreshCw, ExternalLink, ChevronRight,
  LayoutDashboard, ShieldCheck, Award, MessageSquare, QrCode
} from 'lucide-react';

const AVAILABLE_TABS = [
  { id: 'dashboard', label: 'Dashboard Summary', icon: LayoutDashboard, refresh: true },
  { id: 'admin_dashboard', label: 'Admin Panel', icon: ShieldCheck, refresh: false },
  { id: 'school_profile', label: 'School Profile', icon: Landmark, refresh: false },
  { id: 'calendar', label: 'Academic Calendar', icon: CalendarDays, refresh: false },
  { id: 'students', label: 'Student Profiles', icon: GraduationCap, refresh: false },
  { id: 'teachers', label: 'Teacher Profiles', icon: UserCheck, refresh: false },
  { id: 'attendance', label: 'Class Attendance Roster', icon: CalendarCheck, refresh: false },
  { id: 'assessments', label: 'Academic Assessments', icon: Award, refresh: true },
  { id: 'fees', label: 'School Fees Ledger', icon: Coins, refresh: true },
  { id: 'paystack', label: 'Paystack Ledger', icon: CreditCard, refresh: true },
  { id: 'communications', label: 'Parent Messages', icon: MessageSquare, refresh: false },
  { id: 'emis', label: 'GES EMIS Census', icon: Database, refresh: false },
  { id: 'settings', label: 'System Controls', icon: Settings, refresh: false }
];


function AppContent() {
  // Global Session Identity State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(DbController.getCurrentUser());
  
  const subscriptionStatus = currentUser ? evaluateSubscription(currentUser) : null;
  const [isFirebaseChecking, setIsFirebaseChecking] = useState(DbController.isFirebaseEnabled());

  const isAdmin = currentUser?.role === 'Admin';

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

  const teacherProfile = useMemo(() => {
    if (!currentUser || currentUser.role !== 'Teacher') return null;
    const teachersList = Array.isArray(teachers) ? teachers : [];
    const userEmail = currentUser.email?.toLowerCase().trim();
    if (!userEmail) return null;
    return teachersList.find(
      t => t.email?.toLowerCase().trim() === userEmail
    ) || null;
  }, [currentUser, teachers]);

  const assignedClasses = useMemo(() => {
    const classesList: string[] = [];
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

  const visibleTabs = useMemo(() => {
    const classes = Array.isArray(assignedClasses) ? assignedClasses : [];
    const subjects = Array.isArray(assignedSubjects) ? assignedSubjects : [];

    return AVAILABLE_TABS.filter(tab => {
      if (currentUser?.role === 'Teacher') {
        if (subscriptionStatus && subscriptionStatus.isLocked) {
          return tab.id === 'dashboard';
        }
        const hasAssignments = classes.length > 0 || subjects.length > 0;
        const allowedTabs = ['dashboard', 'students', 'attendance', 'assessments'];
        if (hasAssignments) {
          allowedTabs.push('calendar');
        }
        return allowedTabs.includes(tab.id);
      }
      if (subscriptionStatus && subscriptionStatus.isLocked) {
        return tab.id === 'settings';
      }
      if (tab.id === 'admin_dashboard') return isAdmin;
      if (tab.id === 'paystack') return isAdmin;
      return true;
    }).map(tab => {
      if (subscriptionStatus && subscriptionStatus.isLocked && tab.id === 'settings') {
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
  const [isAutoSave, setIsAutoSave] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      return q.get('tab') || 'dashboard';
    } catch {
      return 'dashboard';
    }
  });
  const [settingsSubTab, setSettingsSubTab] = useState<'general' | 'accounts' | 'backup' | 'billing' | 'logs' | 'teachers' | 'security'>('general');
  const [showBillingEvenIfLocked, setShowBillingEvenIfLocked] = useState<boolean>(false);
  const [selectedYear, setSelectedYear] = useState<AcademicYearType>('2026/2027');
  const [selectedTerm, setSelectedTerm] = useState<TermType>('Term 1');
  const [isMoreDropdownOpen, setIsMoreDropdownOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  // Drag and Drop Tab Reordering State & Handlers
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [tabOrder, setTabOrder] = useState<string[]>([]);
  
  // Contextual Visibility States
  const [hiddenTabs, setHiddenTabs] = useState<string[]>([]);
  const [isVisibilityMenuOpen, setIsVisibilityMenuOpen] = useState(false);

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
    
    window.print = () => {
      // List of all print areas across the application
      const printTargets = [
        { id: 'teacher-registry-print-area', title: 'Faculty & Staff Register', landscape: true },
        { id: 'teachers-roster-preview-card', title: 'Staff Directory Mini-Draft', landscape: true },
        { id: 'students-roster-preview-card', title: 'Student Directory Roster', landscape: true },
        { id: 'assessment-roster-preview-landscape', title: 'Academic Assessment Gradebook', landscape: true },
        { id: 'fee-receipt-print-area', title: 'Official Payment Receipt', landscape: false },
        { id: 'fee-ledger-print-area', title: 'Student Financial Ledger Statement', landscape: false },
        { id: 'fees-reminder-notice-canvas', title: 'GES Academic Payment Reminder', landscape: false },
        { id: 'school-profile-print-area', title: 'School Official Profile Document', landscape: false },
        { id: 'school-profile-preview-card', title: 'School Official Profile Document', landscape: false },
        { id: 'student-id-card-print-area', title: 'Student Identification Badge', landscape: false },
        { id: 'student-qr-print-area', title: 'Student Portal Access QR Code', landscape: false },
        { id: 'bulk-qr-print-area', title: 'Bulk Student Portal Access Keys', landscape: false },
        { id: 'emis-census-print-area', title: 'GES EMIS Official Census Report', landscape: false },
        { id: 'attendance-roster-print-area', title: 'Class Attendance Roster', landscape: false },
      ];

      let foundTargetId: string | undefined = undefined;
      let foundTitle = 'School Official Document';
      let foundLandscape = false;
      let foundHtml = '';

      for (const target of printTargets) {
        if (target.id) {
          const el = document.getElementById(target.id);
          if (el && el.innerHTML.trim().length > 0) {
            foundTargetId = target.id;
            foundTitle = target.title;
            foundLandscape = target.landscape;
            break;
          }
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
    };
  }, []);

  useEffect(() => {
    try {
      const email = currentUser?.email || 'guest';
      const saved = localStorage.getItem(`tab_order_${email}`);
      const savedHidden = localStorage.getItem(`hidden_tabs_${email}`);
      setTabOrder(saved ? JSON.parse(saved) : []);
      setHiddenTabs(savedHidden ? JSON.parse(savedHidden) : []);
    } catch {
      setTabOrder([]);
      setHiddenTabs([]);
    }
  }, [currentUser]);

  const orderedVisibleTabs = useMemo(() => {
    let tabs = visibleTabs.filter(tab => !hiddenTabs.includes(tab.id));
    if (tabs.length === 0 && visibleTabs.length > 0) {
      tabs = [visibleTabs.find(t => t.id === 'dashboard') || visibleTabs[0]];
    }

    if (tabOrder.length === 0) return tabs;
    return [...tabs].sort((a, b) => {
      const indexA = tabOrder.indexOf(a.id);
      const indexB = tabOrder.indexOf(b.id);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return 0;
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
    localStorage.setItem(`hidden_tabs_${email}`, JSON.stringify(newHidden));
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
      localStorage.setItem(`tab_order_${currentUser?.email || 'guest'}`, JSON.stringify(updatedIds));
    }
  };

  const handleDragEnd = () => {
    setDraggedTabId(null);
  };

  const currentActiveTab = orderedVisibleTabs.find(t => t.id === activeTab) || orderedVisibleTabs[0];
  const CurrentActiveIcon = currentActiveTab.icon;

  useEffect(() => {
    if (orderedVisibleTabs.length > 0 && !orderedVisibleTabs.find(t => t.id === activeTab)) {
      setActiveTab(orderedVisibleTabs[0].id);
    }
  }, [orderedVisibleTabs, activeTab]);

  // Login & Registration state for both Local and secure full-stack Firebase Authentication
  const [isRegisterMode, setIsRegisterMode] = useState(false);
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

  const handleQRBadgeScanSuccess = async (decodedValue: string) => {
    setIsQRScannerOpen(false);
    setAuthError(null);
    setAuthLoading(true);
    try {
      const account = await DbController.teacherLoginByBadge(decodedValue);
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
    
    // Hardcoded root admin accounts are completely immune to security revocation
    const userEmail = currentUser?.email?.toLowerCase().trim() || '';
    const isRootAdmin = false;
      
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
            u.email.toLowerCase().trim() === currentUser.email.toLowerCase().trim()
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
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // --- MANUAL SAVE STATES ---
  const [isManualSaving, setIsManualSaving] = useState(false);
  const [manualSaveStep, setManualSaveStep] = useState(0);

  const handleManualSaveProgress = async () => {
    setIsManualSaving(true);
    setManualSaveStep(0);
    
    // Step 0 -> Step 1 (Validate records)
    await new Promise(resolve => setTimeout(resolve, 400));
    setManualSaveStep(1);
    
    // Step 1 -> Step 2 (Commit cached states to storage)
    await new Promise(resolve => setTimeout(resolve, 500));
    setManualSaveStep(2);
    
    // Step 2 -> Step 3 (Sync to secure Firestore Cloud if online)
    if (isOnline && DbController.isFirebaseEnabled()) {
      try {
        await DbController.syncOfflineQueue();
      } catch (e) {
        console.warn("Queue sync skipped/delayed in manual save:", e);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 600));
    setManualSaveStep(3);
    
    // Step 3 -> Step 4 (Rebuild fast-lookup maps and indices)
    refreshAllLogs();
    await new Promise(resolve => setTimeout(resolve, 400));
    setManualSaveStep(4);
    
    // Step 4 -> Finished (Success state)
    await new Promise(resolve => setTimeout(resolve, 1200));
    setHasUnsavedChanges(false);
    setIsManualSaving(false);
  };

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
      if (navigator.onLine) {
        handleManualSync();
      }
    };
    const updateSyncCount = () => {
      setPendingSyncCount(DbController.getOfflineQueueSize());
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    window.addEventListener('sms_sync_status_changed', updateSyncCount);

    // Bootstrap local sync count checks
    setPendingSyncCount(DbController.getOfflineQueueSize());

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      window.removeEventListener('sms_sync_status_changed', updateSyncCount);
    };
  }, []);

  const handleManualSync = async () => {
    if (!navigator.onLine) return;
    setIsSyncing(true);
    try {
      const result = await DbController.syncOfflineQueue();
      if (result.syncedCount > 0) {
        refreshAllLogs();
      }
    } catch (err) {
      console.warn("Manual background sync error during retry:", err);
    } finally {
      setIsSyncing(false);
      setPendingSyncCount(DbController.getOfflineQueueSize());
    }
  };

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
    setIsAutoSave(true);
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

    // Subscribe to Firebase Auth state
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          console.log("Firebase Auth found active session for", firebaseUser.email);
          let localProfile = DbController.getCurrentUser();
          
          if (!localProfile || localProfile.uid !== firebaseUser.uid) {
            const remoteProfile = await DbController.getFirebaseUserProfile(firebaseUser.uid);
            if (remoteProfile) {
              setCurrentUser(remoteProfile);
              // We do not set localStorage here to avoid triggering reloads in other tabs
              // and to allow multi-user session isolation per tab.
            } else {
              // Create default fallback profile
              const fallbackEmail = firebaseUser.email?.toLowerCase().trim() || '';
              const fallbackRole = fallbackEmail === 'pegyirenyi@gmail.com' 
                ? 'Admin' 
                : (fallbackEmail === 'sammyotoo06@gmail.com' ? 'Headteacher' : 'Teacher');
              const fallback: UserAccount = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
                role: fallbackRole,
                createdAt: new Date().toISOString()
              };
              await DbController.saveGoogleProfile(fallback);
              setCurrentUser(fallback);
            }
          }
          
          // Now that auth is fully initialized and authenticated, do a secure background sync
          console.log("Syncing database with authenticated Firebase Auth credentials...");
          DbController.syncAllDataFromFirebase().then(() => {
            refreshAllLogs();
          }).catch(err => {
            console.warn("Background sync error on startup:", err);
          });
        } else {
          console.log("Firebase Auth: No active session.");
        }
      } catch (err) {
        console.error("Error in Firebase Auth observer:", err);
      } finally {
        setIsFirebaseChecking(false);
      }
    });

    return () => unsubscribe();
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

  // Keyboard Shortcut listener for Quick-Search modal (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === 'k') {
        const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Headteacher';
        if (isAdmin) {
          e.preventDefault();
          setIsSearchOpen(prev => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentUser]);

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
    setIsAutoSave(true);
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
    const handleSyncMessage = (eventData: { type: string; payload: any }) => {
      console.log(`[Real-time Sync Channel] Event Received:`, eventData.type);

      // Clear memory cache so it retrieves fresh values from localStorage
      DbController.clearCache();

      // Trigger re-fetch of datasets in App.tsx
      refreshAllLogs();
    };

    // Handler for local custom window events
    const handleLocalSyncEvent = (e: any) => {
      if (e.detail) {
        handleSyncMessage(e.detail);
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
      if (e.key === 'sms_teachers' || e.key === 'sms_users_list') {
        DbController.clearCache();
        refreshAllLogs();
      }
    };

    window.addEventListener('school-system-sync' as any, handleLocalSyncEvent);
    window.addEventListener('storage', handleStorageSyncEvent);

    return () => {
      window.removeEventListener('school-system-sync' as any, handleLocalSyncEvent);
      window.removeEventListener('storage', handleStorageSyncEvent);
      if (broadcastChannel) {
        broadcastChannel.close();
      }
    };
  }, [refreshAllLogs]);

  const handleResetAndClear = async () => {
    // Clear all fields State
    setIsRegisterMode(false);
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
    
    // Refresh school metadata and trigger visual updates in UI components
    setSchoolInfo(DbController.getSchoolInfo());
    
    // Set validation message
    setWipeSuccessMessage("Successfully reset all fields and wiped the database for a clean new login.");
    setTimeout(() => {
      setWipeSuccessMessage(null);
    }, 6000);
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
      return renderOperationNotAllowedError();
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

  const renderOperationNotAllowedError = () => {
    return (
      <div className="space-y-2 mt-1 text-xs text-slate-300 font-sans">
        <p className="font-semibold text-amber-400 flex items-center gap-1.5">
          <span>⚠️ Unauthorized Access</span>
        </p>
        <p>
          This authentication provider is currently disabled or restricted on this domain. Please verify your credentials or contact your administrator to enable access.
        </p>
      </div>
    );
  };

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!loginEmail) return;

    // Enforce Admin Email restriction
    if (loginPathway === 'Admin' && loginEmail.toLowerCase().trim() !== 'pegyirenyi@gmail.com') {
      setAuthError("Administrative Access Restricted: This portal is reserved for authorized system administrators only.");
      return;
    }

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
    DbController.logout();
    setCurrentUser(null);
  };

  // Get active branding styles
  const themeStyles = THEME_CONFIGS[activeTheme] || THEME_CONFIGS['Sophisticated Dark'];

  // SECURITY: Global Idle Timeout Monitoring (Auto-Logout)
  useEffect(() => {
    if (!currentUser || currentUser.role === 'Admin') return; // Only for teachers/staff as requested

    const sysSettings = DbController.getSystemSettings();
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
      <React.Suspense fallback={<div className="p-8 flex justify-center w-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>}>
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
      </React.Suspense>
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

        <div className={`max-w-sm w-full rounded-2xl p-6 shadow-2xl relative z-10 space-y-4 fade-in transition-all duration-500 ${
          isDarkTheme 
            ? 'bg-slate-900/90 border border-slate-800 text-slate-100 shadow-slate-950/60' 
            : activeTheme === 'Crystal Glass'
              ? 'bg-white/45 backdrop-blur-md border border-white/50 text-slate-800 shadow-xl shadow-sky-950/5'
              : 'bg-white border border-slate-200/80 text-slate-800 shadow-2xl shadow-slate-200/50'
        }`}>
          
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
                <Sparkles size={14} className="animate-pulse" /> Reset Status
              </div>
              <div>{wipeSuccessMessage}</div>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {!isRegisterMode ? (
              // STEP: Standard / Firebase Login form
              <motion.div 
                key="login-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-5 text-xs"
              >
                {/* Compact Professional Pathway Switcher */}
                <div className="relative flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 overflow-hidden h-10 border border-slate-200 dark:border-slate-750">
                  <motion.div
                    className="absolute top-1 bottom-1 bg-white dark:bg-slate-700 shadow-sm rounded-lg z-0 border border-slate-200/50 dark:border-slate-600/50"
                    initial={false}
                    animate={{
                      left: loginPathway === 'Admin' ? '4px' : loginPathway === 'Headteacher' ? '33.33%' : '66.66%',
                      width: 'calc(33.33% - 4px)'
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                  <button 
                    type="button" 
                    onClick={() => setLoginPathway('Admin')}
                    className={`flex-1 relative z-10 text-[9px] font-black uppercase tracking-wider transition-colors duration-300 ${loginPathway === 'Admin' ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                  >
                    Admin
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setLoginPathway('Headteacher')}
                    className={`flex-1 relative z-10 text-[9px] font-black uppercase tracking-wider transition-colors duration-300 ${loginPathway === 'Headteacher' ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                  >
                    HeadTeacher
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setLoginPathway('Teacher')}
                    className={`flex-1 relative z-10 text-[9px] font-black uppercase tracking-wider transition-colors duration-300 ${loginPathway === 'Teacher' ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                  >
                    Teacher
                  </button>
                </div>
                <form onSubmit={handleLoginSubmit} className="space-y-3">
                  <div className="space-y-3">
                    <div className="relative group">
                      <label className={`text-[9px] font-extrabold uppercase tracking-wider ml-1 mb-1 block transition-colors ${isDarkTheme ? 'text-slate-500 group-focus-within:text-indigo-400' : 'text-slate-400 group-focus-within:text-indigo-600'}`}>
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className={`absolute left-3 top-2.5 transition-colors ${isDarkTheme ? 'text-slate-600' : 'text-slate-400'}`} size={14} />
                        <input 
                          type="email" 
                          required
                          placeholder="e.g. administrator@ges-school.gov.gh"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          className={`w-full pl-9 pr-3 py-2 border rounded-xl transition-all outline-none font-sans font-medium text-xs ${
                            isDarkTheme 
                              ? 'border-slate-800 bg-slate-950/50 text-slate-200 focus:border-indigo-500/50 focus:bg-slate-950 ring-1 ring-transparent focus:ring-indigo-500/20' 
                              : 'border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-indigo-500 focus:shadow-md focus:shadow-indigo-500/5 ring-1 ring-transparent focus:ring-indigo-500/10'
                          }`}
                        />
                      </div>
                    </div>

                    <AnimatePresence mode="popLayout" initial={false}>
                      {loginPathway === 'Teacher' ? (
                        <motion.div 
                          key="school-id-field"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="relative group"
                        >
                          <label className={`text-[9px] font-extrabold uppercase tracking-wider ml-1 mb-1 block transition-colors ${isDarkTheme ? 'text-slate-500 group-focus-within:text-indigo-400' : 'text-slate-400 group-focus-within:text-indigo-600'}`}>
                            Access ID (School ID)
                          </label>
                          <div className="relative">
                            <Lock className={`absolute left-3 top-2.5 transition-colors ${isDarkTheme ? 'text-slate-600' : 'text-slate-400'}`} size={14} />
                            <input 
                              type="text" 
                              required
                              placeholder="e.g. SMS-ABC12345"
                              value={loginSchoolId}
                              onChange={(e) => setLoginSchoolId(e.target.value)}
                              className={`w-full pl-9 pr-12 py-2 border rounded-xl transition-all outline-none font-mono font-bold text-xs uppercase tracking-wider ${
                                isDarkTheme 
                                  ? 'border-slate-800 bg-slate-950/50 text-slate-200 focus:border-indigo-500/50 focus:bg-slate-950 ring-1 ring-transparent focus:ring-indigo-500/20' 
                                  : 'border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-indigo-500 focus:shadow-md focus:shadow-indigo-500/5 ring-1 ring-transparent focus:ring-indigo-500/10'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => setIsQRScannerOpen(true)}
                              title="Scan Badge QR Code"
                              className={`absolute right-3 top-2.5 transition-colors cursor-pointer hover:scale-105 active:scale-95 ${
                                isDarkTheme ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-800'
                              }`}
                            >
                              <QrCode size={15} />
                            </button>
                          </div>
                          <div className="mt-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => setIsQRScannerOpen(true)}
                              className={`inline-flex items-center gap-1 text-[8.5px] font-bold uppercase tracking-wider transition ${
                                isDarkTheme ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-800'
                              }`}
                            >
                              <QrCode size={10} /> Scan school credential badge
                            </button>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div 
                          key="password-field"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="relative group"
                        >
                          <label className={`text-[9px] font-extrabold uppercase tracking-wider ml-1 mb-1 block transition-colors ${isDarkTheme ? 'text-slate-500 group-focus-within:text-indigo-400' : 'text-slate-400 group-focus-within:text-indigo-600'}`}>
                            Secret Key (Password)
                          </label>
                          <div className="relative">
                            <Lock className={`absolute left-3 top-2.5 transition-colors ${isDarkTheme ? 'text-slate-600' : 'text-slate-400'}`} size={14} />
                            <input 
                              type={showLoginPassword ? "text" : "password"} 
                              required
                              placeholder="••••••••"
                              value={loginPassword}
                              onChange={(e) => setLoginPassword(e.target.value)}
                              className={`w-full pl-9 pr-10 py-2 border rounded-xl transition-all outline-none font-sans font-medium text-xs ${
                                isDarkTheme 
                                  ? 'border-slate-800 bg-slate-950/50 text-slate-200 focus:border-indigo-500/50 focus:bg-slate-950 ring-1 ring-transparent focus:ring-indigo-500/20' 
                                  : 'border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-indigo-500 focus:shadow-md focus:shadow-indigo-500/5 ring-1 ring-transparent focus:ring-indigo-500/10'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowLoginPassword(!showLoginPassword)}
                              className={`absolute right-3 top-2.5 transition-colors cursor-pointer ${isDarkTheme ? 'text-slate-600 hover:text-slate-300' : 'text-slate-400 hover:text-slate-700'}`}
                            >
                              {showLoginPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <button 
                    type="submit"
                    disabled={authLoading}
                    className={`group w-full py-2.5 font-bold uppercase tracking-wider rounded-xl transition-all duration-300 shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-[10px] overflow-hidden relative ${
                      isDarkTheme 
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/10' 
                        : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/10'
                    }`}
                  >
                    <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    <span className="relative z-10">Access Dashboard</span>
                    {authLoading ? (
                      <RefreshCw size={13} className="animate-spin relative z-10" />
                    ) : (
                      <ChevronRight size={13} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                    )}
                  </button>
                </form>

                <div className="relative flex items-center justify-center py-0.5">
                  <div className={`absolute inset-x-0 h-px ${isDarkTheme ? 'bg-slate-800' : 'bg-slate-200/60'}`} />
                  <span className={`relative px-3 font-mono text-[7.5px] font-black uppercase tracking-[0.25em] leading-none ${
                    isDarkTheme ? 'bg-slate-900 text-slate-600' : 'bg-white text-slate-300'
                  }`}>System Gateways</span>
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {DbController.isFirebaseEnabled() ? (
                      <button 
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={authLoading}
                        className={`py-2 px-1.5 border rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 font-bold text-[9px] uppercase tracking-wider cursor-pointer disabled:opacity-50 active:scale-[0.98] ${
                          isDarkTheme 
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700' 
                            : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                        }`}
                      >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-3.5 h-3.5" alt="Google" />
                        <span>Google SSO</span>
                      </button>
                    ) : (
                      <div className={`text-center py-2 px-1.5 rounded-xl border flex items-center justify-center gap-1 font-bold text-[8.5px] uppercase tracking-wider ${
                        isDarkTheme 
                          ? 'text-amber-400 bg-amber-950/20 border-amber-900/20' 
                          : 'text-amber-700 bg-amber-50/50 border-amber-200/50 shadow-xs'
                      }`}>
                        <ShieldAlert size={11} className="shrink-0" />
                        <span>Offline Mode</span>
                      </div>
                    )}

                    <button 
                      type="button"
                      onClick={handleBiometricLoginTrigger}
                      disabled={authLoading}
                      className={`py-2 px-1.5 border rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 font-bold text-[9px] uppercase tracking-wider cursor-pointer disabled:opacity-50 active:scale-[0.98] ${
                        isDarkTheme 
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700' 
                          : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                      }`}
                    >
                      <Fingerprint size={13} className={isDarkTheme ? 'text-indigo-400' : 'text-indigo-600'} />
                      <span>Biometrics</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsQRScannerOpen(true)}
                    disabled={authLoading}
                    className={`w-full py-2 border rounded-xl transition-all duration-300 font-bold flex items-center justify-center gap-1.5 cursor-pointer text-[9px] uppercase tracking-wider ${
                      isDarkTheme 
                        ? 'bg-indigo-950/20 hover:bg-indigo-950/35 text-indigo-400 border-indigo-900/30' 
                        : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 shadow-sm hover:shadow-md'
                    }`}
                  >
                    <QrCode size={13} className={isDarkTheme ? 'text-indigo-400' : 'text-indigo-600'} />
                    <span>Quick QR Badge Login</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => setIsExited(true)}
                    className={`w-full py-2 border rounded-xl transition-all duration-300 font-bold flex items-center justify-center gap-1.5 cursor-pointer text-[9px] uppercase tracking-wider ${
                      isDarkTheme 
                        ? 'bg-rose-950/20 hover:bg-rose-950/35 text-rose-400 border-rose-900/30' 
                        : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                    }`}
                  >
                    <Power size={11} />
                    <span>Exit Platform</span>
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="register-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-5 text-xs"
              >
                {DbController.isFirebaseEnabled() && (
                  <>
                    <button 
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={authLoading}
                      className={`w-full py-3.5 bg-white hover:bg-slate-50 text-slate-900 border rounded-2xl transition-all shadow-sm flex items-center justify-center gap-3 font-bold text-[11px] cursor-pointer disabled:opacity-50 active:scale-[0.98] ${
                        isDarkTheme ? 'border-slate-800' : 'border-slate-200'
                      }`}
                    >
                      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                      <span>Sign Up with Identity Provider</span>
                    </button>

                    <div className="relative flex items-center justify-center py-1">
                      <div className={`absolute inset-x-0 h-px ${isDarkTheme ? 'bg-slate-800' : 'bg-slate-200/60'}`} />
                      <span className={`relative px-4 font-mono text-[8px] font-black uppercase tracking-[0.3em] leading-none ${
                        isDarkTheme ? 'bg-slate-900 text-slate-600' : 'bg-white text-slate-300'
                      }`}>or utilize email</span>
                    </div>
                  </>
                )}

                <form 
                  onSubmit={handleRegisterSubmit} 
                  className="space-y-4"
                >
                  <div className="space-y-4">
                    <div className="relative group">
                      <label className={`text-[10px] font-bold uppercase tracking-widest ml-1 mb-1.5 block transition-colors ${isDarkTheme ? 'text-slate-500 group-focus-within:text-indigo-400' : 'text-slate-400 group-focus-within:text-indigo-600'}`}>
                        Account Holder Name
                      </label>
                      <div className="relative">
                        <User className={`absolute left-3.5 top-3 transition-colors ${isDarkTheme ? 'text-slate-600' : 'text-slate-400'}`} size={16} />
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. Paul Egyirenyi"
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          className={`w-full pl-11 pr-4 py-3 border rounded-2xl transition-all outline-none font-sans font-medium text-sm ${
                            isDarkTheme 
                              ? 'border-slate-800 bg-slate-950/50 text-slate-200 focus:border-indigo-500/50 focus:bg-slate-950 ring-1 ring-transparent focus:ring-indigo-500/20' 
                              : 'border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-indigo-500 focus:shadow-lg focus:shadow-indigo-500/5 ring-1 ring-transparent focus:ring-indigo-500/10'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="relative group">
                      <label className={`text-[10px] font-bold uppercase tracking-widest ml-1 mb-1.5 block transition-colors ${isDarkTheme ? 'text-slate-500 group-focus-within:text-indigo-400' : 'text-slate-400 group-focus-within:text-indigo-600'}`}>
                        Access Email Address
                      </label>
                      <div className="relative">
                        <Mail className={`absolute left-3.5 top-3 transition-colors ${isDarkTheme ? 'text-slate-600' : 'text-slate-400'}`} size={16} />
                        <input 
                          type="email" 
                          required
                          placeholder="e.g. headteacher@ges-school.gov.gh"
                          value={regEmail}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRegEmail(val);
                            setRegRole('Headteacher');
                          }}
                          className={`w-full pl-11 pr-4 py-3 border rounded-2xl transition-all outline-none font-sans font-medium text-sm ${
                            isDarkTheme 
                              ? 'border-slate-800 bg-slate-950/50 text-slate-200 focus:border-indigo-500/50 focus:bg-slate-950 ring-1 ring-transparent focus:ring-indigo-500/20' 
                              : 'border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-indigo-500 focus:shadow-lg focus:shadow-indigo-500/5 ring-1 ring-transparent focus:ring-indigo-500/10'
                          }`}
                        />
                      </div>
                    </div>

                    {DbController.isFirebaseEnabled() && (
                      <div className="relative group">
                        <label className={`text-[10px] font-bold uppercase tracking-widest ml-1 mb-1.5 block transition-colors ${isDarkTheme ? 'text-slate-500 group-focus-within:text-indigo-400' : 'text-slate-400 group-focus-within:text-indigo-600'}`}>
                          Secure Gateway Password
                        </label>
                        <div className="relative">
                          <Lock className={`absolute left-3.5 top-3 transition-colors ${isDarkTheme ? 'text-slate-600' : 'text-slate-400'}`} size={16} />
                          <input 
                            type={showRegPassword ? "text" : "password"} 
                            required
                            placeholder="Min 6 characters"
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            className={`w-full pl-11 pr-12 py-3 border rounded-2xl transition-all outline-none font-sans font-medium text-sm ${
                              isDarkTheme 
                                ? 'border-slate-800 bg-slate-950/50 text-slate-200 focus:border-indigo-500/50 focus:bg-slate-950 ring-1 ring-transparent focus:ring-indigo-500/20' 
                                : 'border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-indigo-500 focus:shadow-lg focus:shadow-indigo-500/5 ring-1 ring-transparent focus:ring-indigo-500/10'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegPassword(!showRegPassword)}
                            className={`absolute right-4 top-3 transition-colors cursor-pointer ${isDarkTheme ? 'text-slate-600 hover:text-slate-300' : 'text-slate-400 hover:text-slate-700'}`}
                          >
                            {showRegPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <button 
                      type="submit"
                      disabled={authLoading}
                      className={`group w-full py-4 font-black uppercase tracking-widest rounded-2xl transition-all duration-300 shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 text-[11px] overflow-hidden relative ${
                        isDarkTheme 
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white' 
                          : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/10'
                      }`}
                    >
                      <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                      <span className="relative z-10">{authLoading ? "Provisioning..." : "Create Account"}</span>
                      {!authLoading && <ChevronRight size={14} className="relative z-10 group-hover:translate-x-1 transition-transform" />}
                    </button>
                  </div>

                  <div className="text-center pt-2">
                    <span className={`text-[10px] font-medium ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>Already a registered user? </span>
                    <button 
                      type="button" 
                      onClick={() => { setIsRegisterMode(false); setAuthError(null); }}
                      className={`text-[10px] font-black uppercase tracking-wider hover:underline transition-colors ${isDarkTheme ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'}`}
                    >
                      Login Here
                    </button>
                  </div>
                </form>
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
        </div>

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

        {isQRScannerOpen && (
          <QRBadgeScanner
            onScanSuccess={handleQRBadgeScanSuccess}
            onClose={() => setIsQRScannerOpen(false)}
          />
        )}


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
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-indigo-600/95 backdrop-blur-md text-white font-sans text-xs px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-indigo-500/30 select-none no-print"
          >
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-amber-300 flex-shrink-0">
              <Sparkles size={12} className="animate-spin" />
            </div>
            <div>
              <p className="font-bold tracking-wide">Command Triggered: Print & Export Mode</p>
              <p className="text-[10px] text-indigo-200">{printNotification}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contact Support Modal Overlay */}
      {isContactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100 relative"
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
                className="text-slate-500 hover:text-slate-300 transition text-sm font-bold border-0 bg-transparent cursor-pointer"
              >
                ✕
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
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold rounded-xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
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

      {/* Global Stacked Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full no-print pointer-events-none">
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
                  <Sparkles className="h-4 w-4 text-indigo-100 animate-pulse" />
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
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center text-amber-300 overflow-hidden">
              {schoolInfo.logoUrl ? (
                <img src={schoolInfo.logoUrl} className="w-full h-full object-cover" alt="School logo" referrerPolicy="no-referrer" />
              ) : (
                <BookOpen size={22} className="animate-pulse" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-display font-black tracking-tight uppercase">{schoolInfo.name}</h1>
                <span className="bg-amber-400 text-slate-900 text-[9px] px-1.5 py-0.5 rounded font-black font-mono">EMIS: {schoolInfo.emisCode}</span>
              </div>
              <p className="text-[11px] opacity-80 italic font-serif">Motto: "{schoolInfo.motto}"</p>
            </div>
          </div>

          {/* Identity & Navigation Profile Control */}
          <div className="flex flex-wrap items-center gap-4 text-xs">
            {/* Real-time Connection & Sync Monitor */}
            <div className="flex items-center gap-2.5 bg-white/10 hover:bg-white/15 transition py-1.5 px-3 rounded-lg border border-white/10 text-white font-sans text-xs">
              <div className="flex items-center gap-1.5">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span className="font-semibold">{isOnline ? 'Cloud Sync Online' : 'Offline Mode Active'}</span>
              </div>
              
              {pendingSyncCount > 0 && (
                <div className="flex items-center gap-2 border-l border-white/20 pl-2.5">
                  <span className="font-mono font-bold bg-amber-400 text-slate-950 text-[10px] px-2 py-0.5 rounded-full animate-bounce">
                    {pendingSyncCount} pending
                  </span>
                  {isOnline && (
                    <button
                      onClick={handleManualSync}
                      disabled={isSyncing}
                      className="bg-indigo-600 hover:bg-indigo-500 active:translate-y-0.5 text-white text-[9px] font-black px-2 py-0.5 rounded transition uppercase tracking-wider cursor-pointer disabled:opacity-50"
                    >
                      {isSyncing ? 'Syncing...' : 'Sync Now'}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="text-right">
              <span className="text-slate-200 block text-[10px] uppercase font-mono tracking-wider font-semibold">Logged-in User</span>
              <span className="font-bold text-slate-100 flex items-center gap-1.5">
                <User size={13} className="text-amber-300" />
                {currentUser?.name} ({currentUser?.role})
              </span>
            </div>
            
            <button
              onClick={() => setIsContactModalOpen(true)}
              className="bg-indigo-600/50 hover:bg-indigo-500/80 active:translate-y-0.5 transition px-3 py-1.5 rounded-lg border border-indigo-400/30 hover:border-indigo-400/60 cursor-pointer flex items-center gap-1 font-bold text-white shadow-sm"
              title="Contact Technical Support"
            >
              <Mail size={13} /> Contact Support
            </button>

            <button
              onClick={handleLogout}
              className="bg-white/10 hover:bg-white/20 active:translate-y-0.5 transition px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40 cursor-pointer flex items-center gap-1 font-bold"
              title="Sign out of panel"
            >
              <LogOut size={13} /> Log out
            </button>
          </div>

        </div>
      </header>

      {/* Primary Workspace container */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex-grow space-y-6">
        
        {/* DESIGN RIBBONS Navigation Buttons / Mobile Drawer (no-print) */}
        <nav id="module-tabs-ribbon" className="no-print">
          {/* Desktop version: horizontal button ribbon */}
          <div className="hidden md:flex bg-white border border-slate-200 p-2 rounded-xl shadow-xs flex-wrap gap-1 items-center w-full">
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
                    setActiveTab(tab.id);
                    if (tab.refresh) {
                      refreshAllLogs();
                    }
                  }}
                  className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition text-xs select-none cursor-grab active:cursor-grabbing border ${
                    isActive 
                      ? `${themeStyles.primaryBg} text-white shadow-xs border-transparent` 
                      : 'text-slate-600 hover:bg-slate-50 border-transparent hover:border-slate-100'
                  } ${draggedTabId === tab.id ? 'opacity-30 scale-95 border border-dashed border-slate-300 bg-slate-50' : ''}`}
                  title="Drag tab horizontally to prioritize or reorder"
                >
                  <GripVertical 
                    size={12} 
                    className={`transition shrink-0 ${
                      isActive 
                        ? 'text-white/40 group-hover:text-white/80' 
                        : 'text-slate-300 group-hover:text-slate-400'
                    }`} 
                  />
                  <IconComponent size={14} className="shrink-0" /> 
                  <span>{tab.label}</span>
                </button>
              );
            })}

            {/* Right-aligned ribbon utilities */}
            <div className="ml-auto flex items-center gap-2">
              {(currentUser?.role === 'Admin' || currentUser?.role === 'Headteacher') && (
                <>
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

                </>
              )}

              {tabOrder.length > 0 && (
                <button
                  onClick={() => {
                    setTabOrder([]);
                    localStorage.removeItem(`tab_order_${currentUser?.email || 'guest'}`);
                  }}
                  className="px-2.5 py-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 transition cursor-pointer flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider font-mono shrink-0"
                  title="Reset workspace tab order to default"
                >
                  <RotateCcw size={11} />
                  <span>Reset Order</span>
                </button>
              )}

              <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsVisibilityMenuOpen(!isVisibilityMenuOpen)}
                  className={`p-1.5 border rounded-lg transition cursor-pointer flex items-center justify-center shrink-0 ${isVisibilityMenuOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 hover:bg-slate-100 border-slate-200/80 text-slate-500 hover:text-slate-700'}`}
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
                        <button onClick={() => setIsVisibilityMenuOpen(false)} className="text-slate-400 hover:text-slate-600">
                          <X size={14} />
                        </button>
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
                className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-lg text-slate-500 hover:text-slate-700 transition cursor-pointer flex items-center justify-center shrink-0"
                title="Force-reload local database state"
              >
                <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-indigo-500' : ''} />
              </button>
            </div>
          </div>

          {/* Mobile version: Hamburger triggers the drawer navigation list */}
          <div className="flex md:hidden bg-white border border-slate-200 p-2.5 rounded-xl shadow-xs justify-between items-center w-full">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${themeStyles.primaryBg} text-white`}>
                <CurrentActiveIcon size={16} />
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-wider font-mono text-slate-400 font-bold block leading-none mb-0.5">Current Workspace</span>
                <span className="text-xs font-black text-slate-800 uppercase leading-none block">
                  {currentActiveTab.label}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {(currentUser?.role === 'Admin' || currentUser?.role === 'Headteacher') && (
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(true)}
                  className="p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-700 transition cursor-pointer flex items-center justify-center active:scale-95 shrink-0"
                  title="Quick Search"
                >
                  <Search size={16} />
                </button>
              )}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsVisibilityMenuOpen(!isVisibilityMenuOpen)}
                  className={`p-2 rounded-xl border transition cursor-pointer flex items-center justify-center shrink-0 ${isVisibilityMenuOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 hover:bg-slate-100 border-slate-100 text-slate-700'}`}
                  title="Contextual Visibility"
                >
                  {hiddenTabs.length > 0 ? <EyeOff size={16} /> : <Eye size={16} />}
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
                        <button onClick={() => setIsVisibilityMenuOpen(false)} className="text-slate-400 hover:text-slate-600">
                          <X size={14} />
                        </button>
                      </div>
                      <div className="max-h-64 overflow-y-auto space-y-1 pr-1 custom-scrollbar text-left">
                        {visibleTabs.map(tab => (
                          <label key={`vis-mob-${tab.id}`} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition">
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
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 text-slate-700 transition cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <Menu size={16} />
                <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Menu</span>
              </button>
            </div>
          </div>

          {/* Slide-out Mobile Drawer */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                key="drawer-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 md:hidden"
              />
            )}
            {isMobileMenuOpen && (
              <motion.div
                key="drawer-sidebar"
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-slate-900 text-white shadow-2xl z-50 flex flex-col md:hidden border-r border-slate-800"
              >
                {/* Drawer Header */}
                <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="text-amber-400" size={24} />
                    <div>
                      <h2 className="text-sm font-black tracking-wider uppercase font-display">GTM Systems</h2>
                      <p className="text-[10px] text-slate-400 font-mono">School Portal</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Drawer Content - Module Links */}
                <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider font-mono font-bold text-slate-500 px-3 mb-2">
                    Portal Sections
                  </p>
                  {orderedVisibleTabs.map((tab) => {
                    const IconComponent = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveTab(tab.id);
                          if (tab.refresh) {
                            refreshAllLogs();
                          }
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                          isActive 
                            ? 'bg-amber-400 text-slate-950 font-black shadow-lg' 
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <IconComponent size={18} className={isActive ? 'text-slate-950' : 'text-slate-400'} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Drawer Footer info */}
                <div className="p-5 border-t border-slate-800 bg-slate-950/40 space-y-3">
                  {currentUser && (
                    <div className="flex items-center gap-3 bg-slate-800/40 p-2.5 rounded-xl border border-slate-800/80">
                      <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-amber-400">
                        {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{currentUser.name}</p>
                        <p className="text-[9px] text-slate-400 font-mono truncate">{currentUser.role}</p>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      DbController.logout();
                      setCurrentUser(null);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-bold transition cursor-pointer"
                  >
                    <LogOut size={14} /> Log Out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>

        {/* Active Tab Control Toolbar (Save Progress) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print select-none">
          
          {/* Workspace Title & Metadata */}
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${themeStyles.primaryBg || 'bg-indigo-600'} text-white shadow-xs`}>
              <CurrentActiveIcon size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold tracking-tight text-slate-800 dark:text-slate-100 uppercase">
                  {currentActiveTab.label} Workspace
                </h2>
                {/* AnimatePresence for tab status */}
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 font-sans leading-none">
                GEETECH aligned live database interface. Sync status: {isOnline ? "Online Connected" : "Local Backup Mode"}
              </p>
            </div>
          </div>

          {/* Action Buttons for Save and Refresh */}
          <div className="flex items-center gap-2.5">
            {/* Manual Save Progress Button */}
            <button
              onClick={handleManualSaveProgress}
              disabled={isManualSaving}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition active:scale-95 cursor-pointer border select-none ${
                hasUnsavedChanges 
                  ? 'bg-amber-400 hover:bg-amber-500 text-slate-950 border-amber-300 shadow-md shadow-amber-400/10' 
                  : 'bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
              }`}
              title="Manually trigger step-by-step progress save check"
            >
              <Save size={14} className={isManualSaving ? "animate-pulse" : ""} />
              <span>
                {isManualSaving ? "Saving..." : "Save Progress"}
              </span>
              {hasUnsavedChanges && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              )}
            </button>
          </div>

        </div>

        {/* Dynamic sub-tab workspace rendering */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.15 }}
          >
            <React.Suspense fallback={<div className="p-8 flex justify-center w-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>}>
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
                      setActiveTab(tabId);
                      refreshAllLogs();
                    }}
                    onRefresh={refreshAllLogs}
                  />
                ) : (
                  <DashboardSummaryTab 
                    theme={themeStyles} 
                    students={students}
                    onRefresh={refreshAllLogs}
                    setActiveTab={setActiveTab}
                    setSettingsSubTab={setSettingsSubTab}
                    assignedClasses={assignedClasses}
                    assignedSubjects={assignedSubjects}
                    assignedClass={assignedClasses[0] || 'None'}
                    userRole={currentUser?.role}
                  />
                )
              )}

            {activeTab === 'school_profile' && (
              <SchoolProfileTab 
                theme={themeStyles} 
                schoolInfo={schoolInfo} 
                onUpdate={setSchoolInfo}
                isAutoSave={isAutoSave}
                onManualSave={() => setHasUnsavedChanges(false)}
              />
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
                onRefresh={refreshAllLogs}
                isAutoSave={isAutoSave}
                onManualSave={() => setHasUnsavedChanges(true)}
                userRole={currentUser?.role}
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

            {activeTab === 'fees' && (
              <SchoolFeesTab 
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
                onThemeChange={setActiveTheme} 
                isAutoSave={isAutoSave}
                onAutoSaveToggle={setIsAutoSave}
                onRefresh={refreshAllLogs}
                settingsSubTab={settingsSubTab}
                setSettingsSubTab={setSettingsSubTab}
              />
            )}
            </React.Suspense>
          </motion.div>
        </AnimatePresence>

      </main>

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
                <Sparkles size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
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
            onNavigate={(tabId) => setActiveTab(tabId)}
          />
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
