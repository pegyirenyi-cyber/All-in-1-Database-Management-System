import { useState, useEffect, useMemo, FormEvent, ChangeEvent } from 'react';
import { ThemeType, UserRole, PaystackPayment, WebAuthnCredential, ActivityLog, CLASSES, ClassType, AttendanceRecord, StudentAssessment, AutoBackupConfig, AutoBackupEntry, CloudSyncConfig } from '../types';
import { DbController } from '../db';
import { THEME_CONFIGS, ThemeStyles } from './ThemeWrapper';
import { generateActivationCode, evaluateSubscription } from '../subscription';
import PaystackPaymentTrigger from './PaystackPaymentTrigger';
import { 
  Palette, Smartphone, Save, CheckCircle2, ShieldCheck, UserPlus, FileSliders, Laptop, Lock, Mail,
  Database, Download, Upload, AlertTriangle, Trash2, ShieldAlert, X, Sun, Moon, Key, CreditCard, Sparkles, HelpCircle, AlertCircle, Check,
  Fingerprint, RefreshCw, History, ArrowUpCircle, Filter, ClipboardCheck, ArrowUpDown, Users, UserCheck, Wrench,
  Hash, Link
} from 'lucide-react';

interface Props {
  theme: ThemeStyles;
  onThemeChange: (theme: ThemeType) => void;
  isAutoSave: boolean;
  onAutoSaveToggle: (active: boolean) => void;
  onRefresh: () => void;
  settingsSubTab?: 'general' | 'accounts' | 'backup' | 'billing' | 'logs' | 'teachers' | 'security';
  setSettingsSubTab?: (tab: 'general' | 'accounts' | 'backup' | 'billing' | 'logs' | 'teachers' | 'security') => void;
}

export default function SettingsTab({ 
  theme, 
  onThemeChange, 
  isAutoSave, 
  onAutoSaveToggle, 
  onRefresh,
  settingsSubTab: propSettingsSubTab,
  setSettingsSubTab: propSetSettingsSubTab
}: Props) {
  const [activeTheme, setActiveTheme] = useState<ThemeType>(theme.name);
  const [autoSaveActive, setAutoSaveActive] = useState<boolean>(isAutoSave);
  const [saveStatus, setSaveStatus] = useState(false);

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

  const [lastLightTheme, setLastLightTheme] = useState<ThemeType>(() => {
    const saved = DbController.getSystemSettings();
    if (saved && saved.theme && saved.theme !== 'Sophisticated Dark') {
      return saved.theme as ThemeType;
    }
    return 'Classic';
  });

  // User registration forms
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('Teacher');
  const [regPassword, setRegPassword] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  const [registeredAccounts, setRegisteredAccounts] = useState(DbController.getRegisteredUsers());

  // License generator states (only for pegyirenyi@gmail.com Admin)
  const [licTargetEmail, setLicTargetEmail] = useState('');
  const [licRequestCode, setLicRequestCode] = useState('');
  const [licGeneratedCode, setLicGeneratedCode] = useState('');
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Sub-tabs state inside System Controls (SettingsTab)
  const [settingsSubTabState, setSettingsSubTabState] = useState<'general' | 'accounts' | 'backup' | 'billing' | 'logs' | 'teachers' | 'security'>('general');
  const settingsSubTab = propSettingsSubTab !== undefined ? propSettingsSubTab : settingsSubTabState;
  const setSettingsSubTab = propSetSettingsSubTab !== undefined ? propSetSettingsSubTab : setSettingsSubTabState;
  const [teachersList, setTeachersList] = useState(() => DbController.getTeachers());
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');
  const [teacherSaveStatus, setTeacherSaveStatus] = useState(false);
  const [selectedLicenseTier, setSelectedLicenseTier] = useState<'1year' | '2year' | '3year' | '5year'>('1year');
  const [subscriptionSuccess, setSubscriptionSuccess] = useState(false);
  const [systemSettings, setSystemSettings] = useState(() => DbController.getSystemSettings());

  // Dynamic licensing pricing states
  const [school, setSchool] = useState(() => DbController.getSchoolInfo());
  const [adminPrice1Y, setAdminPrice1Y] = useState(school.licensePrice1Year ?? 350);
  const [adminPrice2Y, setAdminPrice2Y] = useState(school.licensePrice2Year ?? 600);
  const [adminPrice3Y, setAdminPrice3Y] = useState(school.licensePrice3Year ?? 800);
  const [adminPrice5Y, setAdminPrice5Y] = useState(school.licensePrice5Year ?? 1200);
  const [adminSmsRate, setAdminSmsRate] = useState(school.smsRate ?? 20);

  const price1Year = school.licensePrice1Year ?? 350;
  const price2Year = school.licensePrice2Year ?? 600;
  const price3Year = school.licensePrice3Year ?? 800;
  const price5Year = school.licensePrice5Year ?? 1200;

  const currentUser = useMemo(() => DbController.getCurrentUser(), [registeredAccounts]);
  const promoDiscount = currentUser?.promoDiscountRate || 0;
  const promoMultiplier = promoDiscount > 0 ? (1 - promoDiscount / 100) : 1;

  const discountedPrice1Year = price1Year * promoMultiplier;
  const discountedPrice2Year = price2Year * promoMultiplier;
  const discountedPrice3Year = price3Year * promoMultiplier;
  const discountedPrice5Year = price5Year * promoMultiplier;

  const savings2Year = (discountedPrice1Year * 2) - discountedPrice2Year;
  const savings3Year = (discountedPrice1Year * 3) - discountedPrice3Year;
  const savings5Year = (discountedPrice1Year * 5) - discountedPrice5Year;

  const isAdmin = useMemo(() => {
    return currentUser?.role === 'Admin' || currentUser?.email?.toLowerCase().trim() === 'pegyirenyi@gmail.com';
  }, [currentUser]);
  const subStatus = useMemo(() => currentUser ? evaluateSubscription(currentUser) : null, [currentUser]);

  // Backup and restore UI states
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  const [lastBackupTime, setLastBackupTime] = useState<string | null>(() => {
    return localStorage.getItem('last_backup_download_timestamp');
  });

  // --- AUTOMATIC SCHEDULED BACKUPS STATE ---
  const [autoBackupConfig, setAutoBackupConfig] = useState<AutoBackupConfig>(() => {
    return DbController.getAutoBackupConfig();
  });
  const [autoBackupsList, setAutoBackupsList] = useState<AutoBackupEntry[]>(() => {
    return DbController.getAutoBackups();
  });

  // --- SCHEDULED CLOUD SYNC STATE ---
  const [cloudSyncConfig, setCloudSyncConfig] = useState<CloudSyncConfig>(() => {
    return DbController.getCloudSyncConfig();
  });

  const [specialSchoolId, setSpecialSchoolId] = useState(school.schoolId || '');

  const handleUpdateSchoolId = async () => {
    if (!specialSchoolId.trim()) {
      alert("Please enter a valid School ID or generate one.");
      return;
    }
    
    if (window.confirm("Changing the Special School ID will re-route your database connectivity to a different partition. Are you sure?")) {
      await DbController.updateSchoolId(specialSchoolId.trim());
      const updatedSchool = DbController.getSchoolInfo();
      setSchool(updatedSchool);
      setSpecialSchoolId(updatedSchool.schoolId || '');
      setImportSuccess("✓ Special School ID linked successfully! Database re-routed.");
      setTimeout(() => setImportSuccess(''), 5000);
    }
  };

  const handleGenerateSchoolId = () => {
    const newId = DbController.generateSpecialSchoolId();
    setSpecialSchoolId(newId);
  };

  const handleToggleCloudSync = (enabled: boolean) => {
    const updated = { ...cloudSyncConfig, enabled };
    DbController.saveCloudSyncConfig(updated);
    setCloudSyncConfig(updated);
    
    DbController.writeActivityLog(
      'Cloud Sync Preference Modified',
      `Scheduled Cloud Sync set to: ${enabled ? 'ENABLED' : 'DISABLED'}.`,
      'medium'
    );
  };

  const handleCloudSyncProviderChange = (provider: 'Google Drive' | 'Firebase Cloud Storage') => {
    const updated = { ...cloudSyncConfig, provider };
    DbController.saveCloudSyncConfig(updated);
    setCloudSyncConfig(updated);
  };

  const handleCloudSyncIntervalChange = (interval: 'daily' | 'weekly' | 'monthly') => {
    const updated = { ...cloudSyncConfig, interval };
    DbController.saveCloudSyncConfig(updated);
    setCloudSyncConfig(updated);
  };

  const handleTriggerCloudSyncNow = async () => {
    const result = await DbController.performCloudSync();
    setCloudSyncConfig(DbController.getCloudSyncConfig());
    if (result.success) {
      setImportSuccess(`✓ Successfully synced database to ${cloudSyncConfig.provider}!`);
      setTimeout(() => setImportSuccess(''), 5000);
    } else {
      setImportError(`Cloud Sync failed: ${result.error}`);
      setTimeout(() => setImportError(''), 5000);
    }
  };

  const handleToggleAutoBackup = (enabled: boolean) => {
    const updated = { ...autoBackupConfig, enabled };
    DbController.saveAutoBackupConfig(updated);
    setAutoBackupConfig(updated);
    
    // Write activity log
    DbController.writeActivityLog(
      'Backup Preference Modified',
      `Automatic database backup set to: ${enabled ? 'ENABLED' : 'DISABLED'}.`,
      'medium'
    );
  };

  const handleAutoBackupFrequencyChange = (frequency: 'daily' | 'weekly') => {
    const updated = { ...autoBackupConfig, frequency };
    DbController.saveAutoBackupConfig(updated);
    setAutoBackupConfig(updated);
    
    // Write activity log
    DbController.writeActivityLog(
      'Backup Preference Modified',
      `Automatic database backup frequency updated to: ${frequency.toUpperCase()}.`,
      'medium'
    );
  };

  const handleTriggerAutoBackupNow = () => {
    try {
      const result = DbController.performAutoBackup();
      if (result.success) {
        setAutoBackupsList(DbController.getAutoBackups());
        setAutoBackupConfig(DbController.getAutoBackupConfig());
        setImportSuccess("✓ Automatic browser-cached backup executed and saved successfully!");
        setTimeout(() => setImportSuccess(''), 4000);
        onRefresh();
      }
    } catch (e: any) {
      setImportError("Failed to trigger automatic backup: " + e.message);
      setTimeout(() => setImportError(''), 4000);
    }
  };

  const handleRestoreAutoBackup = (entry: AutoBackupEntry) => {
    const timeStr = new Date(entry.timestamp).toLocaleString();
    if (window.confirm(`RESTORE CONFIRMATION: Are you sure you want to restore the automatic backup from ${timeStr}? This will replace your current local registers and sync with your database configurations.`)) {
      try {
        const result = DbController.importAllData(entry.data);
        if (result.success) {
          setImportSuccess(`✓ Successfully restored system backup state from ${timeStr}! Core registers and settings reloaded.`);
          onRefresh();
          setTimeout(() => setImportSuccess(''), 5000);
        } else {
          setImportError(result.error || "Failed to restore backup.");
          setTimeout(() => setImportError(''), 5000);
        }
      } catch (err: any) {
        setImportError("Restore failed: " + err.message);
        setTimeout(() => setImportError(''), 5000);
      }
    }
  };

  const handleDeleteAutoBackup = (id: string, timestamp: string) => {
    const timeStr = new Date(timestamp).toLocaleString();
    if (window.confirm(`Are you sure you want to delete the automatic backup from ${timeStr}? This cached data will be permanently removed from your browser.`)) {
      try {
        DbController.deleteAutoBackup(id);
        setAutoBackupsList(DbController.getAutoBackups());
        setAutoBackupConfig(DbController.getAutoBackupConfig());
      } catch (e: any) {
        alert("Failed to delete auto-backup: " + e.message);
      }
    }
  };

  const handleDownloadAutoBackup = (entry: AutoBackupEntry) => {
    try {
      const dataStr = entry.data;
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      const formatedDate = new Date(entry.timestamp).toISOString().split('T')[0];
      const filename = `geetech_sms_auto_backup_${formatedDate}_${entry.id}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', filename);
      linkElement.click();

      const now = new Date().toISOString();
      localStorage.setItem('last_backup_download_timestamp', now);
      setLastBackupTime(now);
    } catch (e: any) {
      alert("Failed to download auto-backup file: " + e.message);
    }
  };

  const backupStatus = useMemo(() => {
    if (!lastBackupTime) {
      return { 
        needsBackup: true, 
        message: "No local backup history found in this browser. Please download a copy to protect administrative records.",
        daysAgo: null,
        label: "Backup Overdue"
      };
    }
    
    const lastDate = new Date(lastBackupTime);
    const now = new Date();
    const diffMs = now.getTime() - lastDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays >= 7) {
      return {
        needsBackup: true,
        message: `Your last downloaded backup was ${diffDays} days ago. Weekly backup is highly recommended to protect against unforeseen browser cache clearing.`,
        daysAgo: diffDays,
        label: "Backup Overdue"
      };
    } else {
      return {
        needsBackup: false,
        message: diffDays === 0 
          ? "Your database snapshot was saved today! Your administrative registries are secure."
          : `Your last database snapshot was downloaded ${diffDays} day${diffDays > 1 ? 's' : ''} ago. Your weekly backup protection is up to date.`,
        daysAgo: diffDays,
        label: "System Safeguarded"
      };
    }
  }, [lastBackupTime]);

  // Wipe states
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState('');
  const [wipeError, setWipeError] = useState('');

  // === BIOMETRIC WEBAUTHN STATES ===
  const [webauthnCredentials, setWebauthnCredentials] = useState<WebAuthnCredential[]>(() => DbController.getWebAuthnCredentials());
  const [biometricDeviceName, setBiometricDeviceName] = useState('');
  const [isBiometricModalOpen, setIsBiometricModalOpen] = useState(false);
  const [biometricModalStep, setBiometricModalStep] = useState<'idle' | 'scanning' | 'success' | 'failed'>('idle');
  const [biometricModalType, setBiometricModalType] = useState<'finger' | 'face'>('finger');
  const [biometricError, setBiometricError] = useState('');

  // === ACTIVITY LOGS & ADMINISTRATIVE PROMOTIONS ===
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => DbController.getActivityLogs());
  const [integrityReport, setIntegrityReport] = useState<string | null>(null);
  const [canRepair, setCanRepair] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [logSeverityFilter, setLogSeverityFilter] = useState<'all' | 'info' | 'low' | 'medium' | 'high' | 'critical'>('all');
  
  // Promotion Utilities States
  const [promoSourceClass, setPromoSourceClass] = useState<ClassType>('Creche');
  const [promoTargetClass, setPromoTargetClass] = useState<ClassType | 'Graduated'>('Nursery 1');
  const [promotionSuccessText, setPromotionSuccessText] = useState('');

  const handleRunIntegrityReport = () => {
    const students = DbController.getStudents();
    const attendance = DbController.getAllAttendance();
    const assessments = DbController.getAssessments();
    const errors: string[] = [];
    let repairableCount = 0;

    // 1. Audit Students (Invalids and Duplicates)
    const seenStudentIds = new Set<string>();
    const seenStudentNames = new Set<string>();
    
    students.forEach(s => {
      // Invalid records
      if (!s.id || !s.firstName || !s.lastName || !s.class) {
        errors.push(`[Student] Missing critical fields: ID ${s.id || 'N/A'}, Name "${s.firstName || ''} ${s.lastName || ''}"`);
        repairableCount++;
      }
      
      // Duplicates by ID
      if (s.id && seenStudentIds.has(s.id)) {
        errors.push(`[Student] Duplicate ID detected: ${s.id} (Name: ${s.firstName} ${s.lastName})`);
        repairableCount++;
      }
      if (s.id) seenStudentIds.add(s.id);

      // Potential Duplicates by Name and Class (soft check)
      const fullNameClass = `${s.firstName?.toLowerCase()}|${s.lastName?.toLowerCase()}|${s.class}`;
      if (s.firstName && s.lastName && s.class && seenStudentNames.has(fullNameClass)) {
        errors.push(`[Student] Possible duplicate name/class: ${s.firstName} ${s.lastName} in ${s.class}`);
        repairableCount++;
      }
      seenStudentNames.add(fullNameClass);
    });

    // 2. Audit Attendance (Orphans)
    attendance.forEach(a => {
      if (!students.find(s => s.id === a.studentId)) {
        errors.push(`[Attendance] Orphaned record: Student ID ${a.studentId} not found in student list`);
        repairableCount++;
      }
    });

    // 3. Audit Assessments (Orphans and Invalids)
    assessments.forEach(ass => {
      const studentExists = students.find(s => s.id === ass.studentId);
      if (!studentExists) {
        errors.push(`[Assessment] Orphaned record: Student ID "${ass.studentId}" not found for assessment ID ${ass.id}`);
        repairableCount++;
      }
      if (!ass.academicYear) {
        errors.push(`[Assessment] Missing Academic Year: ID ${ass.id} (Student: ${ass.studentName || 'Orphaned ID ' + ass.studentId})`);
        repairableCount++;
      }
    });

    if (errors.length === 0) {
      setIntegrityReport("Database Integrity Report: No issues found! Database is consistent.");
      setCanRepair(false);
    } else {
      setIntegrityReport(
        `Database Integrity Report Found ${errors.length} Issue(s):\n` +
        `----------------------------------------\n` +
        errors.join('\n') +
        `\n----------------------------------------\n` +
        `Summary: ${repairableCount} repairable issue(s) detected.`
      );
      setCanRepair(repairableCount > 0);
    }
  };

  const handleFixAllIssues = () => {
    if (!window.confirm("SYSTEM INTEGRITY WARNING: This action will permanently modify your database records to resolve identified inconsistencies. \n\n- Orphaned records will be deleted.\n- Duplicate students (same ID) will be merged/pruned.\n- Invalid fields will be assigned default values.\n\nAre you sure you want to execute a bulk repair?")) {
      return;
    }

    const students = DbController.getStudents();
    const assessments = DbController.getAssessments();
    const attendance = DbController.getAllAttendance();
    const calendar = DbController.getAcademicCalendar();
    const activeYear = calendar.activeAcademicYear;

    let repairedStudents = 0;
    let prunedDuplicates = 0;
    let repairedAssessments = 0;
    let prunedAttendance = 0;

    // 1. Repair Students & Prune Duplicates
    const finalStudents: typeof students = [];
    const seenIds = new Set<string>();

    students.forEach(s => {
      // Handle Duplicates by ID
      if (seenIds.has(s.id)) {
        prunedDuplicates++;
        return; // Skip this duplicate
      }
      seenIds.add(s.id);

      let changed = false;
      const copy = { ...s };
      if (!copy.firstName) {
        copy.firstName = 'Unknown';
        changed = true;
      }
      if (!copy.lastName) {
        copy.lastName = 'Unknown';
        changed = true;
      }
      if (!copy.class) {
        copy.class = 'Creche';
        changed = true;
      }
      
      if (changed) repairedStudents++;
      finalStudents.push(copy);
    });

    // 2. Repair Assessments
    const updatedAssessments = assessments.map(ass => {
      let changed = false;
      const copy = { ...ass };
      if (!copy.academicYear) {
        copy.academicYear = activeYear;
        changed = true;
        repairedAssessments++;
      }
      if (!copy.studentName) {
        const matchingStudent = students.find(s => s.id === copy.studentId);
        if (matchingStudent) {
          copy.studentName = `${matchingStudent.firstName} ${matchingStudent.lastName}`;
          changed = true;
        } else {
          copy.studentName = `Former Student (${copy.studentId})`;
          changed = true;
        }
      }
      return copy;
    }).filter(ass => students.some(s => s.id === ass.studentId)); // Prune orphaned assessments
    
    const assessmentPruned = assessments.length - updatedAssessments.length;

    // 3. Prune Attendance
    const updatedAttendance = attendance.filter(a => students.some(s => s.id === a.studentId));
    prunedAttendance = attendance.length - updatedAttendance.length;

    // Save
    DbController.saveAllStudents(finalStudents);
    DbController.saveAllAssessments(updatedAssessments);
    DbController.saveAllAttendance(updatedAttendance);

    const totalActions = repairedStudents + prunedDuplicates + repairedAssessments + prunedAttendance + assessmentPruned;

    if (totalActions > 0) {
      setIntegrityReport(
        `Bulk Integrity Fix Complete!\n` +
        `----------------------------------------\n` +
        `- Corrected ${repairedStudents} invalid student record(s)\n` +
        `- Pruned ${prunedDuplicates} duplicate student(s)\n` +
        `- Fixed ${repairedAssessments} assessment(s)\n` +
        `- Deleted ${prunedAttendance} orphaned attendance logs\n` +
        `- Deleted ${assessmentPruned} orphaned assessment records\n` +
        `----------------------------------------\n` +
        `Database health restored successfully.`
      );
      DbController.writeActivityLog(
        'Database Integrity Bulk Fix', 
        `Executed Fix All: ${totalActions} actions performed across students, assessments, and attendance.`, 
        'high'
      );
      setCanRepair(false);
    } else {
      setIntegrityReport("No issues required fixing.");
      setCanRepair(false);
    }
  };

  // Refresh logs when tab selected
  useEffect(() => {
    if (settingsSubTab === 'logs') {
      setActivityLogs(DbController.getActivityLogs());
    }
  }, [settingsSubTab]);

  // Load school pricing configuration dynamically when billing sub-tab is opened
  useEffect(() => {
    if (settingsSubTab === 'billing') {
      const freshSchool = DbController.getSchoolInfo();
      setSchool(freshSchool);
      setAdminPrice1Y(freshSchool.licensePrice1Year ?? 350);
      setAdminPrice2Y(freshSchool.licensePrice2Year ?? 600);
      setAdminPrice3Y(freshSchool.licensePrice3Year ?? 800);
      setAdminPrice5Y(freshSchool.licensePrice5Year ?? 1200);
      setAdminSmsRate(freshSchool.smsRate ?? 20);
    }
  }, [settingsSubTab]);

  const handleSavePricing = () => {
    try {
      const updatedSchool = {
        ...school,
        licensePrice1Year: adminPrice1Y,
        licensePrice2Year: adminPrice2Y,
        licensePrice3Year: adminPrice3Y,
        licensePrice5Year: adminPrice5Y,
        smsRate: adminSmsRate,
      };
      DbController.saveSchoolInfo(updatedSchool);
      setSchool(updatedSchool);
      DbController.writeActivityLog(
        'Licensing pricing modified',
        `Adjusted tier prices: 1-Year = GHS ${adminPrice1Y}, 2-Year = GHS ${adminPrice2Y}, 3-Year = GHS ${adminPrice3Y}, 5-Year = GHS ${adminPrice5Y}, SMS Rate = ${adminSmsRate} credits/GHS`,
        'medium'
      );
      alert("License tier and SMS carrier pricing configurations updated successfully across the entire platform!");
      onRefresh();
    } catch (e: any) {
      alert("Failed to save pricing configuration updates: " + e.message);
    }
  };

  const filteredLogs = useMemo(() => {
    return activityLogs.filter(log => {
      if (logSeverityFilter !== 'all' && log.severity !== logSeverityFilter) {
        return false;
      }
      if (logSearch.trim()) {
        const q = logSearch.toLowerCase();
        return (
          log.action.toLowerCase().includes(q) ||
          log.details.toLowerCase().includes(q) ||
          log.userName.toLowerCase().includes(q) ||
          log.userEmail.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [activityLogs, logSearch, logSeverityFilter]);

  // Keep theme & autosave active states fully synchronized when prop signals change
  useEffect(() => {
    setActiveTheme(theme.name);
  }, [theme.name]);

  useEffect(() => {
    setAutoSaveActive(isAutoSave);
  }, [isAutoSave]);

  const handleApplyTheme = (tName: ThemeType) => {
    setActiveTheme(tName);
    onThemeChange(tName);
    if (tName !== 'Sophisticated Dark') {
      setLastLightTheme(tName);
    }
    
    // Save locally
    const current = DbController.getSystemSettings();
    DbController.saveSystemSettings({ ...current, theme: tName });
    setSaveStatus(true);
    setTimeout(() => setSaveStatus(false), 2000);
  };

  const handleToggleAutoSave = (val: boolean) => {
    setAutoSaveActive(val);
    onAutoSaveToggle(val);

    const current = DbController.getSystemSettings();
    DbController.saveSystemSettings({ ...current, autoSave: val });
    setSaveStatus(true);
    setTimeout(() => setSaveStatus(false), 2000);
  };

  const handleUserRegistration = (e: FormEvent) => {
    e.preventDefault();
    if (!regName || !regEmail) {
      alert("Please populate all fields");
      return;
    }

    const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*.,])[a-zA-Z0-9!@#$%^&*.,]{8,}$/;
    if (!passwordRegex.test(regPassword)) {
      alert("Password must be at least 8 characters long, include numbers and special characters.");
      return;
    }

    const assignedRole: UserRole = regEmail.toLowerCase().trim() === 'pegyirenyi@gmail.com' ? 'Admin' : regRole;

    if (assignedRole === 'Headteacher' && !isAdmin) {
      alert("Only Admins can register Headteachers.");
      return;
    }

    DbController.register(regName, regEmail, assignedRole);
    setRegisteredAccounts(DbController.getRegisteredUsers());
    onRefresh();

    setRegSuccess(`Account for ${regName} (${assignedRole}) created successfully!`);
    setRegName('');
    setRegEmail('');
    setRegPassword('');
    setTimeout(() => setRegSuccess(''), 3500);
  };

  // === BIOMETRIC WEBAUTHN CONTROLLERS ===
  const deleteWebAuthnCredential = (id: string) => {
    if (window.confirm("Are you sure you want to delete this enrolled biometric key from this device? You will no longer be able to log in using it.")) {
      DbController.deleteWebAuthnCredential(id);
      setWebauthnCredentials(DbController.getWebAuthnCredentials());
    }
  };

  const enrollBiometrics = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      alert("Please login first to enroll biometrics.");
      return;
    }
    const devName = biometricDeviceName.trim() || `${currentUser.name}'s Device (${navigator.userAgent.substring(0, 20)})`;
    setBiometricError('');

    try {
      if (typeof window !== 'undefined' && window.PublicKeyCredential) {
        // Prepare challenge & options for real WebAuthn
        const challengeBuffer = new Uint8Array(32);
        window.crypto.getRandomValues(challengeBuffer);
        const userIdBuffer = new TextEncoder().encode(currentUser.email);

        const publicKeyOptions: PublicKeyCredentialCreationOptions = {
          challenge: challengeBuffer,
          rp: {
            name: "GEETECH School DB System",
            id: window.location.hostname || "localhost"
          },
          user: {
            id: userIdBuffer,
            name: currentUser.email,
            displayName: currentUser.name
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },   // ES256
            { type: "public-key", alg: -257 }  // RS256
          ],
          authenticatorSelection: {
            userVerification: "required"
          },
          timeout: 45000
        };

        const credential = await navigator.credentials.create({
          publicKey: publicKeyOptions
        }) as PublicKeyCredential;

        if (credential) {
          const rawIdBase64 = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
          const newCred: WebAuthnCredential = {
            id: rawIdBase64,
            publicKey: "PUBLIC_KEY_BOUND_HARDWARE", 
            userEmail: currentUser.email,
            userName: currentUser.name,
            deviceName: devName,
            createdAt: new Date().toISOString(),
            isSimulated: false
          };
          DbController.registerWebAuthnCredential(newCred);
          setWebauthnCredentials(DbController.getWebAuthnCredentials());
          setBiometricDeviceName('');
          alert("✓ Physical biometric verification successful! Biometric device credential enrolled and synced successfully.");
          return;
        }
      }
      throw new Error("WebAuthn API is not fully available or was canceled/blocked by environment sandboxing.");
    } catch (err: any) {
      console.warn("Real WebAuthn failed or blocked:", err);
      // Fallback to beautiful high-fidelity, educational biometric simulator modal
      setBiometricModalStep('scanning');
      setIsBiometricModalOpen(true);
    }
  };

  const handleSimulateEnrolmentSuccess = () => {
    if (!currentUser) return;
    const devName = biometricDeviceName.trim() || `${currentUser.name}'s Shared Device Key`;
    const randomId = `SIM_CRED_${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
    const newCred: WebAuthnCredential = {
      id: randomId,
      publicKey: "SIMULATED_SECURE_PUBLIC_KEY_" + Math.floor(1000 + Math.random() * 9000),
      userEmail: currentUser.email,
      userName: currentUser.name,
      deviceName: devName,
      createdAt: new Date().toISOString(),
      isSimulated: true
    };
    DbController.registerWebAuthnCredential(newCred);
    setWebauthnCredentials(DbController.getWebAuthnCredentials());
    setBiometricDeviceName('');
    setBiometricModalStep('success');
  };

  const handleBulkPromote = () => {
    if (promoSourceClass === promoTargetClass) {
      alert("Error: Source class and target class cannot be identical!");
      return;
    }
    
    const count = DbController.getStudents().filter(s => s.class === promoSourceClass).length;
    if (count === 0) {
      alert(`There are currently no active student profiles enrolled in class '${promoSourceClass}' to promote.`);
      return;
    }

    if (window.confirm(`CRITICAL CONFIRMATION: You are about to bulk promote ALL ${count} students from '${promoSourceClass}' to '${promoTargetClass}'. This action updates critical security and profile structures. Press OK to authorize bulk promotion.`)) {
      const promotedCount = DbController.promoteClassBulk(promoSourceClass, promoTargetClass);
      setPromotionSuccessText(`Successfully promoted ${promotedCount} students from ${promoSourceClass} to ${promoTargetClass}!`);
      setActivityLogs(DbController.getActivityLogs());
      onRefresh(); // refresh main context
      setTimeout(() => setPromotionSuccessText(''), 5000);
    }
  };

  const handleClearLogs = () => {
    if (window.confirm("Are you sure you want to permanently delete all local administrative activity security logs? This action is irreversible.")) {
      DbController.clearActivityLogs();
      DbController.writeActivityLog('Cleared Activity Logs', 'All historical administrative actions have been permanently cleared from this workstation directory.', 'medium');
      setActivityLogs(DbController.getActivityLogs());
    }
  };

  const handleExportBackup = () => {
    try {
      const dataStr = DbController.exportAllData();
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const formatedDate = new Date().toISOString().split('T')[0];
      const exportFileDefaultName = `geetech_sms_backup_${formatedDate}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();

      // Update backup downloaded timestamp
      const now = new Date().toISOString();
      localStorage.setItem('last_backup_download_timestamp', now);
      setLastBackupTime(now);
    } catch (e: any) {
      alert("Failed to export backup: " + e.message);
    }
  };

  const handlePurgeCache = async () => {
    if (window.confirm("Are you sure you want to permanently delete all offline cached assets? This will force a full refresh of the application on the next load.")) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
        alert("Offline storage cache successfully purged. Please reload the application.");
        onRefresh();
      } catch (err) {
        console.error("Cache purge failed:", err);
        alert("Failed to purge cache. Please check browser permissions.");
      }
    }
  };

  const handleImportBackup = (e: ChangeEvent<HTMLInputElement>) => {
    setImportError('');
    setImportSuccess('');
    
    const fileReader = new FileReader();
    const file = e.target.files?.[0];
    if (!file) return;

    fileReader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content !== 'string') {
        setImportError("Failed to read backup file contents.");
        return;
      }

      const result = DbController.importAllData(content);
      if (result.success) {
        setImportSuccess("Database snapshot successfully completed! Core registers and theme values have been reloaded.");
        
        // Propagate system updates
        setTimeout(() => {
          setRegisteredAccounts(DbController.getRegisteredUsers());
          onRefresh();
        }, 800);
      } else {
        setImportError(result.error || "The selected JSON file appears to have a corrupted schema or structure.");
      }
    };

    fileReader.onerror = () => {
      setImportError("Hardware error occurred while reading the document.");
    };

    fileReader.readAsText(file);
    e.target.value = ''; // Reset input to allow double uploads of the same file
  };

  return (
    <div className="space-y-6 fade-in text-xs no-print">

      {/* Settings Sub Tabs Bar */}
      <div className="flex flex-wrap gap-2 pb-1 border-b border-slate-200 no-print">
        {!subStatus?.isLocked && (
          <>
            <button
              type="button"
              onClick={() => setSettingsSubTab('general')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold transition text-[11px] cursor-pointer ${settingsSubTab === 'general' ? `${theme.btnColors} shadow-xs` : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
            >
              <Palette size={13} /> Appearance & Themes
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setSettingsSubTab('accounts')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold transition text-[11px] cursor-pointer ${settingsSubTab === 'accounts' ? `${theme.btnColors} shadow-xs` : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
              >
                <UserPlus size={13} /> Account Provisioning
              </button>
            )}
            <button
              type="button"
              onClick={() => setSettingsSubTab('backup')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold transition text-[11px] cursor-pointer ${settingsSubTab === 'backup' ? `${theme.btnColors} shadow-xs` : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
            >
              <Database size={13} /> Backup & Hard Reset
            </button>
          </>
        )}
        {(isAdmin || currentUser?.role === 'Headteacher') && (
          <button
            type="button"
            onClick={() => setSettingsSubTab('billing')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold transition text-[11px] cursor-pointer ${settingsSubTab === 'billing' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs animate-pulse' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
          >
            <CreditCard size={13} /> Buy Subscription / Renewal
          </button>
        )}
        {!subStatus?.isLocked && (
          <>
            <button
              type="button"
              onClick={() => setSettingsSubTab('logs')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold transition text-[11px] cursor-pointer ${settingsSubTab === 'logs' ? `${theme.btnColors} shadow-xs` : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
            >
              <ClipboardCheck size={13} /> Activity Logs & Admin Utilities
            </button>
            <button
              type="button"
              onClick={() => setSettingsSubTab('teachers')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold transition text-[11px] cursor-pointer ${settingsSubTab === 'teachers' ? `${theme.btnColors} shadow-xs` : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
            >
              <UserCheck size={13} /> Teacher Permissions
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setSettingsSubTab('security')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold transition text-[11px] cursor-pointer ${settingsSubTab === 'security' ? `${theme.btnColors} shadow-xs` : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
              >
                <Lock size={13} /> Security & Session
              </button>
            )}
          </>
        )}
      </div>
      
      {/* Dynamic Weekly Backup Alert Card (only on backup tab) */}
      {settingsSubTab === 'backup' && (
        <div className={`p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 ${backupStatus.needsBackup ? 'bg-amber-50/70 border-amber-200/80 text-amber-900 shadow-xs' : 'bg-emerald-50/40 border-emerald-200/80 text-emerald-950 shadow-xs'}`}>
          <div className="flex items-start gap-3.5 text-left">
            <div className={`p-2.5 rounded-xl border flex-shrink-0 ${backupStatus.needsBackup ? 'bg-amber-100 border-amber-200 text-amber-700 animate-pulse' : 'bg-emerald-100 border-emerald-200 text-emerald-700'}`}>
              <Database size={18} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${backupStatus.needsBackup ? 'bg-amber-200/60 text-amber-900' : 'bg-emerald-200/60 text-emerald-900'}`}>
                  {backupStatus.label}
                </span>
                <h3 className="text-xs font-bold font-sans">Weekly Database Backup Safeguard</h3>
              </div>
              <p className="text-[11px] opacity-90 leading-relaxed font-sans max-w-xl">
                {backupStatus.message} Administrators are strongly advised to extract a physical database snapshot weekly to guarantee safety against sudden client storage updates or local wipes.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
            {isAdmin && (
              <button
                onClick={handlePurgeCache}
                type="button"
                className="py-2 px-4 rounded-lg font-bold text-xs bg-red-600 hover:bg-red-700 text-white shadow-xs cursor-pointer hover:scale-101 active:scale-99 transition-all duration-200 flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                <span>Purge Cache</span>
              </button>
            )}
            <button
              onClick={handleExportBackup}
              type="button"
              className={`py-2 px-4 rounded-lg font-bold text-xs shadow-xs cursor-pointer hover:scale-101 active:scale-99 transition-all duration-200 flex items-center gap-1.5 ${backupStatus.needsBackup ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
            >
              <Download size={13} />
              <span>Backup Data Now</span>
            </button>
          </div>
        </div>
      )}
      
      {/* Settings columns container */}
      <div className="grid grid-cols-1 gap-6">

        {/* Column 1: Appearance Themes and Save Behaviors */}
        {settingsSubTab === 'general' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          
          {/* Appearance Selection */}
          <div className="space-y-3">
            <h3 className="text-sm font-display font-bold text-slate-800 flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <Palette size={17} className={theme.accentText} />
              Branding & Dynamic Color Themes
            </h3>
            <p className="text-[10px] text-slate-400 leading-relaxed">Customize the application interface with institutional color profiles instantly.</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              {(Object.keys(THEME_CONFIGS) as ThemeType[]).map(tName => {
                const conf = THEME_CONFIGS[tName];
                const isActive = activeTheme === tName;
                return (
                  <button
                    key={tName}
                    onClick={() => handleApplyTheme(tName)}
                    className={`p-3 rounded-lg border text-left flex flex-col justify-between transition cursor-pointer hover:border-slate-300 ${isActive ? `${theme.cardBorder} bg-slate-50 border-2` : 'border-slate-200'}`}
                  >
                    <span className="font-bold text-slate-800 text-xs block">{tName}</span>
                    <span className={`w-3.5 h-3.5 rounded-full mt-2 self-end ${conf.primaryBg}`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dedicated Light/Dark Mode Preference */}
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-display font-bold text-slate-800 flex items-center gap-1.5 pb-2 border-b border-slate-100">
              {activeTheme === 'Sophisticated Dark' ? <Moon size={17} className={theme.accentText} /> : <Sun size={17} className={theme.accentText} />}
              Display Theme Mode
            </h3>
            <p className="text-[10px] text-slate-400 leading-relaxed">Directly switch the application container between the high-contrast slate dark scheme and light color palettes.</p>
            
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (activeTheme === 'Sophisticated Dark') {
                    handleApplyTheme(lastLightTheme);
                  }
                }}
                className={`flex-1 py-2.5 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${activeTheme !== 'Sophisticated Dark' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-xs ring-1 ring-indigo-100' : 'bg-[#0f172a] text-slate-400 border-slate-800 hover:bg-slate-800/80 hover:text-slate-300'}`}
              >
                <Sun size={14} />
                <span>Light Mode</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (activeTheme !== 'Sophisticated Dark') {
                    setLastLightTheme(activeTheme);
                    handleApplyTheme('Sophisticated Dark');
                  }
                }}
                className={`flex-1 py-2.5 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${activeTheme === 'Sophisticated Dark' ? 'bg-indigo-600 border-indigo-700 text-white shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
              >
                <Moon size={14} />
                <span>Dark Mode</span>
              </button>
            </div>
          </div>

          {/* Database Synchronization Policy */}
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-display font-bold text-slate-800 flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <Save size={17} className={theme.accentText} />
              Database Storage Policy
            </h3>
            <p className="text-[10px] text-slate-400 leading-relaxed">The application runs an enterprise-grade background synchronization database engine, keeping your records saved instantly.</p>

            <div className="flex items-center justify-between bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 mt-3 no-print">
              <div>
                <strong className="block text-emerald-800 text-xs text-left font-semibold">Real-time Auto Saving</strong>
                <span className="text-[10px] text-emerald-600 mt-1 block">Every single change to student profiles, grade assessments, fees payments, attendance and profile data is saved and synced instantly.</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 border border-emerald-700 text-white font-mono font-bold text-[10px] shadow-sm select-none">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span>ALWAYS ON</span>
              </div>
            </div>
          </div>

          {saveStatus && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-lg flex items-center gap-2 animate-fade-in">
              <CheckCircle2 size={15} className="text-emerald-605" />
              <span>Appearance and persistent configurations successfully locked-in!</span>
            </div>
          )}

          {/* Firebase Authorization Section */}
          {isAdmin && (
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h3 className="text-sm font-display font-bold text-slate-800 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                <ShieldAlert size={17} className="text-rose-500" />
                Firebase Connectivity & Domain Authorization
              </h3>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                If you encounter "Unauthorized Domain" errors during Google Login or Auth popups, you must authorize this domain in your Firebase Console.
              </p>
              
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Active Auth Domain</span>
                  <div className="flex items-center gap-2">
                    <code className="text-[11px] font-mono font-bold text-slate-700 bg-white border border-slate-200 px-2 py-1 rounded select-all">
                      {DbController.getFirebaseConfig().authDomain}
                    </code>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(DbController.getFirebaseConfig().authDomain);
                        alert("Auth domain copied to clipboard.");
                      }}
                      className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition cursor-pointer"
                      title="Copy Domain"
                    >
                      <Save size={12} className="text-slate-500" />
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 font-bold text-[11px]">
                    <AlertCircle size={14} />
                    <span>How to fix "Popup Blocked/Unauthorized Domain":</span>
                  </div>
                  <ol className="text-[10px] text-amber-700 space-y-1 ml-4 list-decimal font-medium">
                    <li>Go to <strong>Firebase Console</strong> &gt; Authentication &gt; Settings.</li>
                    <li>Select <strong>Authorized Domains</strong> tab.</li>
                    <li>Click <strong>Add Domain</strong> and enter: <code className="bg-white px-1 rounded border border-amber-200">school-database-and-assessment-system.netlify.app</code></li>
                    <li>Also ensure <code className="bg-white px-1 rounded border border-amber-200">localhost</code> is present for development.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

        </div>
        )}

        {/* Column 2: User Account registries & role registry */}
        {settingsSubTab === 'accounts' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          
          {(isAdmin || currentUser?.role === 'Headteacher') && (
            <div className="space-y-3">
              <h3 className="text-sm font-display font-bold text-slate-800 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                <UserPlus size={17} className={theme.accentText} />
                Role Accounts Provisioning Center
              </h3>
              <p className="text-[10px] text-slate-400 leading-relaxed">Add administrative handles securely mapped for {isAdmin ? 'Admin, Headteacher, or Teacher' : 'Teacher'} access roles.</p>

              <form onSubmit={handleUserRegistration} className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Account Full Name</label>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none"
                      placeholder="e.g. Ama Serwaa"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Mailing Address (Email) *</label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => {
                        const emailVal = e.target.value;
                        setRegEmail(emailVal);
                        if (isAdmin && emailVal.toLowerCase().trim() === 'pegyirenyi@gmail.com') {
                          setRegRole('Admin');
                        } else {
                          // Default for non-admin email is Teacher, but Admin can manually toggle Headteacher if we add a selector
                          setRegRole('Teacher');
                        }
                      }}
                      className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none font-mono"
                      placeholder="e.g. pegyirenyi@gmail.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Initial Password *</label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none font-mono"
                    placeholder="Min 8 chars, 1 number, 1 special char"
                  />
                </div>

                <div className="flex flex-col gap-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200/40 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-slate-400" />
                    <span className="font-semibold text-slate-600">Administrative Permission Role Assignment:</span>
                  </div>
                  <div className="mt-1 font-bold">
                    {regEmail.toLowerCase().trim() === 'pegyirenyi@gmail.com' ? (
                      <span className="text-indigo-600 px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded">System Administrator Level Permissions</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <select
                          value={regRole}
                          onChange={(e) => setRegRole(e.target.value as UserRole)}
                          className="text-[10px] font-bold border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="Teacher">Teacher (Classroom Access)</option>
                          {isAdmin && (
                            <option value="Headteacher">Headteacher (School Management Access)</option>
                          )}
                        </select>
                        <span className="text-slate-400 italic font-normal">* {isAdmin ? 'Choose Teacher or Headteacher' : 'Teacher role assigned by default'}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-1 italic">
                    * Dynamic Authorization: only pegyirenyi@gmail.com is granted System Administrator access. {isAdmin ? 'Admins can provision Headteachers and Teachers.' : 'Headteachers can provision Teachers.'}
                  </div>
                </div>

                <button
                  type="submit"
                  className={`w-full py-2 rounded-lg font-bold shadow-xs cursor-pointer active:translate-y-0.5 transition ${theme.btnColors}`}
                >
                  Provision Role Account
                </button>
              </form>

              {regSuccess && (
                <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 p-2 rounded-lg animate-fade-in font-medium">
                  {regSuccess}
                </div>
              )}
            </div>
          )}

          {isAdmin && (
            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registered Security Accounts</span>
              <div className="divide-y divide-slate-100 max-h-[140px] overflow-y-auto border border-slate-100 rounded-lg p-2.5 bg-slate-50/50">
                {registeredAccounts.map(u => (
                  <div key={u.uid} className="py-1.5 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-700 block text-xs">{u.name}</span>
                        {u.promoDiscountRate && u.promoDiscountRate > 0 ? (
                          <span className="text-[8px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200/50 px-1.5 py-0.5 rounded leading-none uppercase font-mono tracking-wider">
                            {u.promoDiscountRate}% Promo
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono italic">{u.email}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${u.role === 'Admin' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-teal-50 text-teal-800 border border-teal-100'}`}>
                      {u.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WebAuthn Biometric Security & Shared Devices Segment */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-sm font-display font-bold text-slate-800 flex items-center gap-1.5 pb-1">
              <Fingerprint size={17} className="text-indigo-600 animate-pulse" />
              🔒 Biometric Device Keys (WebAuthn Web API)
            </h3>
            <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
              Register biometric credentials (TouchID, FaceID, or Hardware USB Keys) for secure, one-click teacher login on this shared device.
            </p>

            <form onSubmit={enrollBiometrics} className="space-y-3 bg-slate-50 border border-slate-200/65 p-3.5 rounded-xl">
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1">Friendly Identifier/Device Name</label>
                <input
                  type="text"
                  required
                  value={biometricDeviceName}
                  onChange={(e) => setBiometricDeviceName(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 border border-slate-200 bg-white rounded-lg focus:outline-none"
                  placeholder="e.g. Ama's Staff Room Laptop"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setBiometricModalType('finger')}
                  className={`flex-1 py-1 rounded-md text-[10px] font-bold border transition ${
                    biometricModalType === 'finger' 
                      ? 'bg-indigo-55 bg-indigo-50 border-indigo-200 text-indigo-700' 
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  Fingerprint Key
                </button>
                <button
                  type="button"
                  onClick={() => setBiometricModalType('face')}
                  className={`flex-1 py-1 rounded-md text-[10px] font-bold border transition ${
                    biometricModalType === 'face' 
                      ? 'bg-indigo-55 bg-indigo-50 border-indigo-200 text-indigo-700' 
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  Face ID Key
                </button>
              </div>

              <button
                type="submit"
                className={`w-full py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-black rounded-lg shadow-sm flex items-center justify-center gap-1.5 cursor-pointer`}
              >
                <Fingerprint size={14} />
                <span>Enroll Biometric Login Code</span>
              </button>
            </form>

            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registered Keys on this Device</span>
              {webauthnCredentials.length === 0 ? (
                <div className="text-[10px] text-slate-400 border border-dashed border-slate-205 border-slate-200 p-3 rounded-lg text-center italic">
                  No biometrics keys enrolled. Turn on biometrics for one-click shared device login.
                </div>
              ) : (
                <div className="space-y-2 max-h-[155px] overflow-y-auto">
                  {webauthnCredentials.map(c => (
                    <div key={c.id} className="p-2 border border-slate-100 bg-slate-50/50 rounded-lg flex items-center justify-between font-mono text-[10px]">
                      <div>
                        <div className="font-bold text-slate-800 flex items-center gap-1">
                          <Fingerprint size={11} className="text-emerald-600" />
                          <span>{c.deviceName}</span>
                        </div>
                        <div className="text-slate-400 flex flex-col gap-0.5 mt-0.5 text-[8px]">
                          <span>User: <strong>{c.userName}</strong> ({c.userEmail})</span>
                          <span>Registered: {new Date(c.createdAt).toLocaleDateString()}</span>
                          {c.isSimulated && <span className="text-amber-600 font-bold bg-amber-50 px-1 rounded max-w-max">Simulated Hardware Sandbox</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteWebAuthnCredential(c.id)}
                        className="text-rose-500 hover:text-rose-700 font-bold hover:bg-rose-50 p-1 rounded border border-slate-250 bg-white shadow-7xs transition cursor-pointer"
                        title="Revoke device access key"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* GEETECH Administrator License Generator key block (for pegyirenyi@gmail.com ONLY) */}
          {DbController.getCurrentUser()?.email.toLowerCase().trim() === 'pegyirenyi@gmail.com' && (
            <div className="space-y-3 pt-4 border-t border-slate-100 mt-2">
              <h4 className="text-xs font-black text-indigo-900 uppercase font-sans tracking-wide flex items-center gap-1.5">
                <Key size={13} className="text-indigo-600 shrink-0" />
                Administrative Activation Codes Generator
              </h4>
              <p className="text-[9px] text-slate-400 leading-normal">
                Generate deterministic yearly renewal codes for your school clients securely.
              </p>
              
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[8px] text-slate-500 uppercase font-bold tracking-wide mb-1 mb-0.5">
                      Target User Account Email
                    </label>
                    <select
                      value={licTargetEmail}
                      onChange={(e) => {
                        const emailVal = e.target.value;
                        setLicTargetEmail(emailVal);
                        
                        const matched = registeredAccounts.find(u => u.email.toLowerCase().trim() === emailVal.toLowerCase().trim());
                        if (matched && matched.requestCode) {
                          setLicRequestCode(matched.requestCode);
                          setLicGeneratedCode(generateActivationCode(emailVal, matched.requestCode));
                        } else {
                          setLicRequestCode('');
                          setLicGeneratedCode('');
                        }
                        setCopiedSuccess(false);
                      }}
                      className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none bg-slate-50"
                    >
                      <option value="">-- Select Client --</option>
                      {registeredAccounts.filter(u => u.email.toLowerCase().trim() !== 'pegyirenyi@gmail.com').map(u => (
                        <option key={u.uid} value={u.email}>{u.email}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[8px] text-slate-500 uppercase font-bold tracking-wide mb-1 mb-0.5">
                      Request Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. REQ-AMAS-3749"
                      value={licRequestCode}
                      onChange={(e) => {
                        const codeVal = e.target.value.toUpperCase();
                        setLicRequestCode(codeVal);
                        if (licTargetEmail && codeVal) {
                          setLicGeneratedCode(generateActivationCode(licTargetEmail, codeVal));
                        } else {
                          setLicGeneratedCode('');
                        }
                        setCopiedSuccess(false);
                      }}
                      className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none font-mono uppercase"
                    />
                  </div>
                </div>

                {licTargetEmail && licRequestCode && (
                  <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2 text-center animate-fade-in relative overflow-hidden">
                    <span className="block text-[8px] text-slate-500 uppercase font-bold tracking-wider">
                      Activation Passcode
                    </span>
                    <div className="font-mono font-black text-sm text-indigo-700 tracking-widest uppercase select-all bg-white py-1 px-3 border border-indigo-200/50 inline-block rounded">
                      {licGeneratedCode}
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(licGeneratedCode);
                          setCopiedSuccess(true);
                          setTimeout(() => setCopiedSuccess(false), 2000);
                        }}
                        className="py-1 px-2 text-[9px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded shadow-xs cursor-pointer select-none transition"
                      >
                        {copiedSuccess ? "✓ Copied Key!" : "Copy Passcode"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
        )}

      </div>

      {/* Recovery, Backup & Restore Section */}
      {settingsSubTab === 'backup' && (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-display font-bold text-slate-800 flex items-center gap-1.5 pb-2 border-b border-slate-100">
          <Database size={17} className={theme.accentText} />
          Manual Backup snapshot & System Restoration Center
        </h3>
        <p className="text-[10px] text-slate-400 leading-relaxed max-w-2xl text-left">
          Perform state checkpoints directly on your dashboard. Exporting collects all student enrollment rosters, subject grade parameters, historical class attendance records, access profiles, and local configs into a standard raw JSON payload.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          
          {/* Download snapshots */}
          <div className="border border-slate-200/60 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between space-y-4">
            <div className="text-left">
              <span className="font-bold text-slate-700 text-xs block mb-1">Download Database Snapshot</span>
              <p className="text-[10px] text-slate-400 leading-normal">
                Generates a portable, structures-checked JSON payload that preserves all institutional settings, marks logs, and logins. Save this output securely.
              </p>
            </div>
            
            <button
              onClick={handleExportBackup}
              type="button"
              className={`py-2 px-4 rounded-lg font-bold shadow-xs cursor-pointer hover:opacity-90 active:translate-y-0.5 transition flex items-center justify-center gap-1.5 text-center ${theme.btnColors}`}
            >
              <Download size={14} />
              Export System Data (JSON)
            </button>
          </div>

          {/* Upload snapshots */}
          <div className="border border-slate-200/60 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between space-y-4 text-left">
            <div>
              <span className="font-bold text-slate-700 text-xs block mb-1">Restore Database Snapshot</span>
              <p className="text-[10px] text-slate-400 leading-normal font-sans">
                Upload a preselected JSON dump from a previous manual backup. This updates or overwrites current local directories and syncs with cloud datasets.
              </p>
            </div>

            <div className="relative">
              <input
                type="file"
                accept=".json"
                id="import-backup-file"
                onChange={handleImportBackup}
                className="hidden"
              />
              <label
                htmlFor="import-backup-file"
                className="w-full py-2 px-4 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold shadow-xs cursor-pointer transition flex items-center justify-center gap-1.5 text-center"
              >
                <Upload size={14} className="text-slate-500" />
                Select Backup file (.json)
              </label>
            </div>
          </div>

        </div>

        {importSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg flex items-center gap-2 animate-fade-in text-[11px] font-medium">
            <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
            <span>{importSuccess}</span>
          </div>
        )}

        {importError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg flex items-center gap-2 animate-fade-in text-[11px] font-medium">
            <AlertTriangle size={16} className="text-rose-600 flex-shrink-0" />
            <span>{importError}</span>
          </div>
        )}

      </div>

      {/* AUTOMATIC SCHEDULED DATABASE BACKUPS */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5 text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div className="space-y-1">
            <h3 className="text-sm font-display font-bold text-slate-800 flex items-center gap-1.5">
              <RefreshCw size={17} className={`${theme.accentText}`} />
              Scheduled Auto-Backups (Browser-Cached)
            </h3>
            <p className="text-[10px] text-slate-400 leading-normal max-w-xl">
              Configure local background processes to keep automatic snapshot logs of your school records. Backups rotate in local storage using a safe FIFO queue of the last 5 records.
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${autoBackupConfig.enabled ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
              {autoBackupConfig.enabled ? "Active" : "Disabled"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Control Panel: Toggle and frequency */}
          <div className="md:col-span-1 border border-slate-200/60 rounded-xl p-4 bg-slate-50/50 space-y-4">
            <div>
              <span className="font-bold text-slate-700 text-xs block mb-1">Automation Settings</span>
              <p className="text-[10px] text-slate-400 leading-normal">
                Turn on automatic local backups and select your preferred schedule.
              </p>
            </div>

            {/* Toggle Switch */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/70">
              <span className="text-[11px] font-bold text-slate-700">Enable Auto-Backup</span>
              <button
                type="button"
                onClick={() => handleToggleAutoBackup(!autoBackupConfig.enabled)}
                className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${autoBackupConfig.enabled ? 'bg-emerald-600' : 'bg-slate-300'}`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${autoBackupConfig.enabled ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>

            {/* Frequency Selector */}
            {autoBackupConfig.enabled && (
              <div className="space-y-2 animate-fade-in">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Backup Frequency</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleAutoBackupFrequencyChange('daily')}
                    className={`py-1.5 px-3 rounded-lg border text-xs font-bold transition ${autoBackupConfig.frequency === 'daily' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                  >
                    Daily Backup
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAutoBackupFrequencyChange('weekly')}
                    className={`py-1.5 px-3 rounded-lg border text-xs font-bold transition ${autoBackupConfig.frequency === 'weekly' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                  >
                    Weekly Backup
                  </button>
                </div>
              </div>
            )}

            {/* Manual Trigger */}
            <button
              type="button"
              onClick={handleTriggerAutoBackupNow}
              className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 text-center cursor-pointer"
            >
              <Database size={13} />
              Trigger Auto-Backup Now
            </button>
          </div>

          {/* Backups List */}
          <div className="md:col-span-2 border border-slate-200/60 rounded-xl p-4 bg-slate-50/50 space-y-4 flex flex-col justify-between">
            <div>
              <span className="font-bold text-slate-700 text-xs block mb-1">Local Browser-Cached Backups</span>
              <p className="text-[10px] text-slate-400 leading-normal">
                Last Backup Timestamp: <strong className="text-slate-600">{autoBackupConfig.lastBackupTime ? new Date(autoBackupConfig.lastBackupTime).toLocaleString() : "Never Executed"}</strong>
              </p>
            </div>

            <div className="bg-white border border-slate-200/70 rounded-lg divide-y divide-slate-100 overflow-hidden max-h-[160px] overflow-y-auto">
              {autoBackupsList.length === 0 ? (
                <div className="p-6 text-center text-slate-400">
                  <Database size={24} className="mx-auto mb-2 text-slate-300 opacity-60" />
                  <p className="text-[10px]">No automatic backups are currently stored in this browser's cache.</p>
                </div>
              ) : (
                autoBackupsList.map((entry, idx) => {
                  const time = new Date(entry.timestamp);
                  return (
                     <div key={entry.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
                       <div className="space-y-0.5">
                         <div className="flex items-center gap-2">
                           <span className="text-[10px] font-mono font-bold text-slate-700">
                             #{autoBackupsList.length - idx} Auto-Backup
                           </span>
                           <span className="text-[9px] text-indigo-600 font-bold px-1.5 py-0.2 bg-indigo-50 border border-indigo-100/60 rounded">
                             {(entry.size / 1024).toFixed(1)} KB
                           </span>
                         </div>
                         <p className="text-[10px] text-slate-400 font-sans leading-none">
                           Saved: {time.toLocaleString()}
                         </p>
                       </div>

                       <div className="flex items-center gap-1.5">
                         <button
                           type="button"
                           onClick={() => handleRestoreAutoBackup(entry)}
                           className="p-1 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 rounded-md font-bold text-[10px] transition cursor-pointer"
                           title="Restore database from this backup"
                         >
                           Restore
                         </button>
                         <button
                           type="button"
                           onClick={() => handleDownloadAutoBackup(entry)}
                           className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-md transition cursor-pointer"
                           title="Download JSON copy"
                         >
                           <Download size={11} />
                         </button>
                         <button
                           type="button"
                           onClick={() => handleDeleteAutoBackup(entry.id, entry.timestamp)}
                           className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-md transition cursor-pointer"
                           title="Delete backup"
                         >
                           <Trash2 size={11} />
                         </button>
                       </div>
                     </div>
                  );
                })
              )}
            </div>

            <div className="bg-amber-50/50 border border-amber-200 p-2.5 rounded-lg flex items-start gap-2 text-[10px] text-amber-800 leading-normal">
              <AlertCircle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <span>
                <strong>Storage Warning:</strong> These backups exist inside your active browser cache. Clearing your browser's site data or history may delete these auto-backups. Downloading a physical JSON file is recommended for permanent safety.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SPECIAL SCHOOL ID MANAGEMENT */}
      <div className="bg-white p-6 rounded-xl border border-indigo-100 shadow-sm space-y-5 text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-indigo-50">
          <div className="space-y-1">
            <h3 className="text-sm font-display font-bold text-slate-800 flex items-center gap-1.5">
              <Hash size={17} className="text-indigo-600" />
              Special School ID (Shared Database Key)
            </h3>
            <p className="text-[10px] text-slate-400 leading-normal max-w-xl">
              Linking a unique ID allows multiple users (Headteachers & Teachers) to share a single database. Leave blank to use your personal private database.
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${school.schoolId ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400'}`}>
              {school.schoolId ? "Linked" : "Personal Mode"}
            </span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 pt-1">
          <div className="flex-1 space-y-3">
            <div className="relative group">
              <input
                type="text"
                value={specialSchoolId}
                onChange={(e) => setSpecialSchoolId(e.target.value.toUpperCase())}
                placeholder="Enter School ID (e.g. SMS-XXXXXXXX)"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition"
              />
              <Link size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <button
                type="button"
                onClick={handleGenerateSchoolId}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-indigo-100 text-indigo-600 rounded-lg transition cursor-pointer"
                title="Generate New ID"
              >
                <RefreshCw size={13} />
              </button>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleUpdateSchoolId}
                className={`flex-1 py-2 rounded-xl font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white`}
              >
                <ShieldCheck size={14} />
                Link This School ID
              </button>
              {school.schoolId && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Disconnecting will revert your access to your private database. Continue?")) {
                      setSpecialSchoolId('');
                      DbController.updateSchoolId('');
                      setSchool(DbController.getSchoolInfo());
                    }
                  }}
                  className="px-4 py-2 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl font-bold text-xs hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition cursor-pointer"
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>

          <div className="md:w-1/2 p-4 bg-indigo-50/40 border border-indigo-100/60 rounded-2xl flex items-start gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600 flex-shrink-0">
              <Users size={16} />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-bold text-indigo-900">Multi-User Collaboration</h4>
              <p className="text-[10px] text-indigo-700/80 leading-relaxed">
                Provide this ID to your staff. Once they link it in their settings, all entries made by them will automatically sync to your central dashboard and cloud backups.
              </p>
              {school.schoolId && (
                <div className="pt-1 flex items-center gap-2">
                  <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Share ID:</span>
                  <code className="text-[11px] font-mono font-bold text-indigo-600 bg-white px-2 py-0.5 rounded border border-indigo-100 select-all cursor-pointer" onClick={() => {
                    navigator.clipboard.writeText(school.schoolId || '');
                    alert("ID copied for sharing!");
                  }}>
                    {school.schoolId}
                  </code>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SCHEDULED CLOUD SYNC CONFIGURATION */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5 text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div className="space-y-1">
            <h3 className="text-sm font-display font-bold text-slate-800 flex items-center gap-1.5">
              <RefreshCw size={17} className={`${theme.accentText}`} />
              Scheduled Cloud Sync (Drive/Storage)
            </h3>
            <p className="text-[10px] text-slate-400 leading-normal max-w-xl">
              Automate full database backups to Google Drive or Firebase Cloud Storage. This ensures your records are protected even if local device data is cleared or lost.
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${cloudSyncConfig.enabled ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
              {cloudSyncConfig.enabled ? "Active" : "Disabled"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Controls */}
          <div className="md:col-span-1 border border-slate-200/60 rounded-xl p-4 bg-slate-50/50 space-y-4">
            <div>
              <span className="font-bold text-slate-700 text-xs block mb-1">Sync Automation</span>
              <p className="text-[10px] text-slate-400 leading-normal">
                Enable automated cloud exports and select your preferred destination.
              </p>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/70">
              <span className="text-[11px] font-bold text-slate-700">Enable Cloud Sync</span>
              <button
                type="button"
                onClick={() => handleToggleCloudSync(!cloudSyncConfig.enabled)}
                className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${cloudSyncConfig.enabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${cloudSyncConfig.enabled ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>

            {cloudSyncConfig.enabled && (
              <div className="space-y-4 animate-fade-in">
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Storage Provider</label>
                  <select
                    value={cloudSyncConfig.provider}
                    onChange={(e) => handleCloudSyncProviderChange(e.target.value as any)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  >
                    <option value="Firebase Cloud Storage">Firebase Cloud Storage</option>
                    <option value="Google Drive">Google Drive (OAuth required)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sync Interval</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['daily', 'weekly', 'monthly'] as const).map((interval) => (
                      <button
                        key={interval}
                        type="button"
                        onClick={() => handleCloudSyncIntervalChange(interval)}
                        className={`py-1.5 px-1 rounded-lg border text-[10px] font-bold capitalize transition ${cloudSyncConfig.interval === interval ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                      >
                        {interval}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleTriggerCloudSyncNow}
              disabled={cloudSyncConfig.status === 'syncing'}
              className={`w-full py-2 px-3 rounded-lg font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 text-center cursor-pointer ${cloudSyncConfig.status === 'syncing' ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
            >
              {cloudSyncConfig.status === 'syncing' ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  Syncing to Cloud...
                </>
              ) : (
                <>
                  <Upload size={13} />
                  Trigger Cloud Sync Now
                </>
              )}
            </button>
          </div>

          {/* Status and History Placeholder */}
          <div className="md:col-span-2 border border-slate-200/60 rounded-xl p-5 bg-slate-50/50 flex flex-col justify-between space-y-4 text-left">
            <div className="space-y-3">
              <div>
                <span className="font-bold text-slate-700 text-xs block mb-1">Sync Status & Health</span>
                <div className="flex items-center gap-2 mt-2">
                  <div className={`w-2 h-2 rounded-full ${
                    cloudSyncConfig.status === 'success' ? 'bg-emerald-500 animate-pulse' :
                    cloudSyncConfig.status === 'failed' ? 'bg-rose-500' :
                    cloudSyncConfig.status === 'syncing' ? 'bg-indigo-500 animate-bounce' : 'bg-slate-300'
                  }`} />
                  <span className="text-[11px] font-bold text-slate-600 capitalize">
                    {cloudSyncConfig.status === 'idle' ? 'System Idle' : `Current State: ${cloudSyncConfig.status}`}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Last Successful Sync</span>
                  <p className="text-xs font-mono font-bold text-slate-700">
                    {cloudSyncConfig.lastSyncTime ? new Date(cloudSyncConfig.lastSyncTime).toLocaleString() : 'Never'}
                  </p>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Backup Destination</span>
                  <p className="text-xs font-bold text-slate-700 truncate">
                    {cloudSyncConfig.enabled ? cloudSyncConfig.provider : 'N/A'}
                  </p>
                </div>
              </div>

              {cloudSyncConfig.error && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex gap-2 items-start">
                  <AlertTriangle size={14} className="text-rose-500 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-rose-700 block">Critical Sync Error</span>
                    <p className="text-[10px] text-rose-600 leading-snug">{cloudSyncConfig.error}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-indigo-50/50 border border-indigo-100 p-3 rounded-lg flex items-start gap-2.5 text-[10px] text-indigo-900 leading-normal">
              <ShieldCheck size={16} className="text-indigo-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <strong>Cloud Redundancy:</strong> This feature securely encrypts your database snapshot and replicates it to your selected cloud provider. For Google Drive, ensure you have signed in via the login screen with an authorized account.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SYSTEM HARD RESET & RECOVERY CONSOLE */}
      <div className="bg-white p-6 rounded-xl border border-rose-100 shadow-sm space-y-4">
        <h3 className="text-sm font-display font-bold text-rose-800 flex items-center gap-1.5 pb-2 border-b border-rose-100">
          <ShieldAlert size={17} className="text-rose-600 animate-pulse animate-bounce" />
          Critical Administrative Operations
        </h3>
        <p className="text-[10px] text-slate-400 leading-relaxed max-w-2xl text-left">
          These controls affect all active data caches, session credentials, and local directories. Always save a local copy before initiating any recovery triggers.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          
          <div className="border border-slate-200/60 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between space-y-3 text-left">
            <div>
              <span className="font-bold text-slate-700 text-xs block mb-1 animate-pulse">Save All Persistent Data</span>
              <p className="text-[10px] text-slate-400 leading-normal">
                Back up school logs, rosters, and schedules onto a secure offline backup document.
              </p>
            </div>
            <button
              onClick={handleExportBackup}
              type="button"
              className={`w-full py-2 rounded-lg font-bold shadow-xs cursor-pointer active:translate-y-0.5 transition flex items-center justify-center gap-1.5 text-center ${theme.btnColors}`}
            >
              <Download size={14} />
              Save All Data
            </button>
          </div>

          <div className="border border-rose-100 rounded-xl p-4 bg-rose-50/20 flex flex-col justify-between space-y-3 text-left">
            <div>
              <span className="font-bold text-rose-700 text-xs block mb-1">Clear & Reset All Data</span>
              <p className="text-[10px] text-slate-400 leading-normal">
                Completely purge all students, staff, attendance registers, and assessments to start fresh.
              </p>
            </div>
            <button
              onClick={() => {
                setWipeConfirmText('');
                setWipeError('');
                setShowWipeModal(true);
              }}
              type="button"
              className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-xs cursor-pointer active:translate-y-0.5 transition flex items-center justify-center gap-1.5 text-center font-sans tracking-wide"
            >
              <Trash2 size={14} />
              Clear All Data
            </button>
          </div>

        </div>
      </div>
      </div>
      )}

      {/* ONLINE LICENSE SUBSCRIPTION - BILLING VIEW */}
      {settingsSubTab === 'billing' && (
        <div className="space-y-6 animate-fade-in text-left">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-emerald-600 via-teal-650 to-indigo-700 p-6 rounded-2xl text-white shadow-md relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="relative z-10 space-y-2">
              <span className="text-[10px] uppercase font-mono tracking-widest font-black text-emerald-250 bg-white/10 px-2.5 py-1 rounded-md border border-white/10">
                Instant Paystack Gateway Activation
              </span>
              <h3 className="text-lg font-black font-sans leading-tight">
                GEETECH Multimedia Online License Portal
              </h3>
              <p className="text-xs text-white opacity-90 max-w-2xl leading-relaxed">
                Upgrade your school database from restricted boundaries to a healthy full yearly academic account. Our Paystack secure checkout processes payments instantly, credit-checks the server, and activates your digital passcodes automatically.
              </p>
            </div>
          </div>

          {/* Subscription Status Level Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Current Bounds status card */}
            <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs flex flex-col justify-between space-y-3">
              <div className="space-y-1">
                <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-slate-400">Current Status</span>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${subStatus?.isLocked ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                  <strong className="text-slate-800 text-xs font-black">
                    {subStatus?.licenseType === 'trial' ? '14-Day System Trial' : 'Active School License'}
                  </strong>
                </div>
                <p className="text-[10px] text-slate-500 leading-normal font-sans pt-1">
                  Request Code: <span className="font-mono bg-slate-50 px-1 py-0.5 border border-slate-200/50 rounded text-slate-650 font-bold">{currentUser?.requestCode || 'N/A'}</span>
                </p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-mono">Borders expiry limit:</span>
                <span className="text-xs font-bold text-slate-700">{subStatus?.expiryDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
            </div>

            {/* Days remaining card */}
            <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs flex flex-col justify-between space-y-3">
              <div className="space-y-1">
                <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-slate-400">Time Remaining</span>
                <h4 className="text-2xl font-black text-slate-800 font-mono tracking-tight pt-1">
                  {subStatus?.remainingDays || 0} <span className="text-xs text-slate-400 font-normal font-sans">Days Left</span>
                </h4>
                <p className="text-[10px] text-slate-500 leading-normal font-sans">
                  Your software has {subStatus?.remainingDays || 0} days remaining before database security boundaries request renewal.
                </p>
              </div>
            </div>

            {/* Action Suggestion Card */}
            <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs flex flex-col justify-between space-y-3">
              <div className="space-y-1">
                <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-slate-400">Renewal Policy</span>
                <p className="text-[11px] text-slate-600 leading-relaxed font-sans pt-1">
                  Multi-year keys protect you from standard yearly renewal price adjustments. On successful verification, the license activates instantly.
                </p>
              </div>
            </div>
          </div>

          {/* Selector & Paystack triggers */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Part 1: Tier Selector Column (Lg: 7 cols) */}
            <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <h4 className="text-xs font-black text-slate-800 uppercase font-sans tracking-wide flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500 animate-pulse animate-bounce" />
                Select Your School License Term
              </h4>
              <p className="text-[10px] text-slate-400 font-sans">Choose the desired subscription period to initialize with Paystack checkout security gateways.</p>
              
              <div className="space-y-3 pt-2">
                {/* 1 Year */}
                <label className={`block p-4 rounded-xl border transition cursor-pointer flex items-start gap-3.5 ${selectedLicenseTier === '1year' ? 'bg-emerald-50/50 border-emerald-500 ring-2 ring-emerald-555' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input 
                    type="radio" 
                    name="subTier" 
                    value="1year" 
                    checked={selectedLicenseTier === '1year'} 
                    onChange={() => setSelectedLicenseTier('1year')}
                    className="mt-1 accent-emerald-600 cursor-pointer"
                  />
                  <div className="flex-grow space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-xs">Standard 1-Year License Renewal</span>
                      {promoDiscount > 0 ? (
                        <div className="flex flex-col items-end">
                          <span className="line-through text-slate-400 text-[10px] font-mono leading-none">GHS {price1Year.toFixed(2)}</span>
                          <span className="font-black text-emerald-600 font-mono text-xs leading-none mt-0.5">GHS {discountedPrice1Year.toFixed(2)} (-{promoDiscount}%)</span>
                        </div>
                      ) : (
                        <span className="font-black text-slate-800 font-mono text-xs">GHS {price1Year.toFixed(2)}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 font-sans leading-normal">
                      Grants complete institutional database authorization, reports analytics, and enrollment sync registers through July of the active calendar year.
                    </p>
                  </div>
                </label>

                {/* 2 Years */}
                <label className={`block p-4 rounded-xl border transition cursor-pointer flex items-start gap-3.5 ${selectedLicenseTier === '2year' ? 'bg-emerald-50/50 border-emerald-500 ring-2 ring-emerald-555' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input 
                    type="radio" 
                    name="subTier" 
                    value="2year" 
                    checked={selectedLicenseTier === '2year'} 
                    onChange={() => setSelectedLicenseTier('2year')}
                    className="mt-1 accent-emerald-600 cursor-pointer"
                  />
                  <div className="flex-grow space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-800 text-xs">Extended 2-Year License Renewal</span>
                        {savings2Year > 0 && (
                          <span className="text-[8px] bg-emerald-100 text-emerald-800 font-black px-1.5 py-0.5 rounded uppercase font-mono tracking-wider">Save GHS {savings2Year.toFixed(2)}</span>
                        )}
                      </div>
                      {promoDiscount > 0 ? (
                        <div className="flex flex-col items-end">
                          <span className="line-through text-slate-400 text-[10px] font-mono leading-none">GHS {price2Year.toFixed(2)}</span>
                          <span className="font-black text-emerald-600 font-mono text-xs leading-none mt-0.5">GHS {discountedPrice2Year.toFixed(2)} (-{promoDiscount}%)</span>
                        </div>
                      ) : (
                        <span className="font-black text-slate-800 font-mono text-xs">GHS {price2Year.toFixed(2)}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 font-sans leading-normal">
                      Grants extended multi-term database protection ensuring stability against eventual year inflation or subscription pricing updates.
                    </p>
                  </div>
                </label>

                {/* 3 Years */}
                <label className={`block p-4 rounded-xl border transition cursor-pointer flex items-start gap-3.5 ${selectedLicenseTier === '3year' ? 'bg-emerald-50/50 border-emerald-500 ring-2 ring-emerald-555' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input 
                    type="radio" 
                    name="subTier" 
                    value="3year" 
                    checked={selectedLicenseTier === '3year'} 
                    onChange={() => setSelectedLicenseTier('3year')}
                    className="mt-1 accent-emerald-600 cursor-pointer"
                  />
                  <div className="flex-grow space-y-1">
                    <div className="flex items-center justify-between font-sans">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-800 text-xs">Premium 3-Year License Protection</span>
                        {savings3Year > 0 && (
                          <span className="text-[8px] bg-indigo-100 text-indigo-800 font-black px-1.5 py-0.5 rounded uppercase font-mono tracking-wider">Best Value - Save GHS {savings3Year.toFixed(2)}</span>
                        )}
                      </div>
                      {promoDiscount > 0 ? (
                        <div className="flex flex-col items-end">
                          <span className="line-through text-slate-400 text-[10px] font-mono leading-none">GHS {price3Year.toFixed(2)}</span>
                          <span className="font-black text-emerald-600 font-mono text-xs leading-none mt-0.5">GHS {discountedPrice3Year.toFixed(2)} (-{promoDiscount}%)</span>
                        </div>
                      ) : (
                        <span className="font-black text-slate-800 font-mono text-xs">GHS {price3Year.toFixed(2)}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 font-sans leading-normal">
                      Maximum reliability for premium schools. Secures continuous access, software upgrades, backups synchronization, and parent portal communications.
                    </p>
                  </div>
                </label>

                {/* 5 Years */}
                <label className={`block p-4 rounded-xl border transition cursor-pointer flex items-start gap-3.5 ${selectedLicenseTier === '5year' ? 'bg-emerald-50/50 border-emerald-500 ring-2 ring-emerald-555' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input 
                    type="radio" 
                    name="subTier" 
                    value="5year" 
                    checked={selectedLicenseTier === '5year'} 
                    onChange={() => setSelectedLicenseTier('5year')}
                    className="mt-1 accent-emerald-600 cursor-pointer"
                  />
                  <div className="flex-grow space-y-1">
                    <div className="flex items-center justify-between font-sans">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-800 text-xs">Golden 5-Year Enterprise Shield</span>
                        {savings5Year > 0 && (
                          <span className="text-[8px] bg-amber-100 text-amber-800 font-black px-1.5 py-0.5 rounded uppercase font-mono tracking-wider">Ultimate Value - Save GHS {savings5Year.toFixed(2)}</span>
                        )}
                      </div>
                      {promoDiscount > 0 ? (
                        <div className="flex flex-col items-end">
                          <span className="line-through text-slate-400 text-[10px] font-mono leading-none">GHS {price5Year.toFixed(2)}</span>
                          <span className="font-black text-emerald-600 font-mono text-xs leading-none mt-0.5">GHS {discountedPrice5Year.toFixed(2)} (-{promoDiscount}%)</span>
                        </div>
                      ) : (
                        <span className="font-black text-slate-800 font-mono text-xs">GHS {price5Year.toFixed(2)}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 font-sans leading-normal">
                      Comprehensive long-term institutional database shield. Permanent priority support, continuous security protocols, auto-recovery backups, and full SMS system integration support.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Part 2: Secure Paystack trigger checkout (Lg: 5 cols) */}
            <div className="lg:col-span-12 xl:col-span-4 flex flex-col justify-between">
              <div className="h-full">
                {currentUser ? (
                  <PaystackPaymentTrigger 
                    studentId={`LICENSE_${currentUser.uid.substring(0, 8)}`}
                    studentName={`License Renewal [${currentUser.name}]`}
                    email={currentUser.email}
                    amount={selectedLicenseTier === '1year' ? discountedPrice1Year : selectedLicenseTier === '2year' ? discountedPrice2Year : selectedLicenseTier === '3year' ? discountedPrice3Year : discountedPrice5Year}
                    academicYear="2026/2027"
                    term="Term 1"
                    component="Other Fee"
                    billId={`LICENSE_${currentUser.uid.substring(0, 8)}_${selectedLicenseTier}`}
                    triggerLabel={`Activate Online System License (GHS ${(selectedLicenseTier === '1year' ? discountedPrice1Year : selectedLicenseTier === '2year' ? discountedPrice2Year : selectedLicenseTier === '3year' ? discountedPrice3Year : discountedPrice5Year).toFixed(2)})`}
                    btnClassName="bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase py-3 border border-emerald-700/20 rounded-xl cursor-pointer"
                    onSuccess={async (txData) => {
                      console.log("Paystack upgrading license on success transaction:", txData);
                      try {
                        const generatedKey = generateActivationCode(currentUser.email, currentUser.requestCode || 'REQ-SYSTEM-9401');
                        
                        // Settle payment in local+cloud Paystack ledgers
                        const paymentLog: PaystackPayment = {
                          id: txData.reference || `LIC-${currentUser.uid.substring(0, 8)}-${Date.now()}`,
                          reference: txData.reference || `LIC-${currentUser.uid.substring(0, 8)}-${Date.now()}`,
                          studentId: `LICENSE_${currentUser.uid.substring(0, 8)}`,
                          studentName: `Software License: ${currentUser.name} (${currentUser.role})`,
                          billId: `LICENSE_${currentUser.uid.substring(0, 8)}_${selectedLicenseTier}`,
                          component: 'Other Fee',
                          amount: txData.amount || (selectedLicenseTier === '1year' ? discountedPrice1Year : selectedLicenseTier === '2year' ? discountedPrice2Year : selectedLicenseTier === '3year' ? discountedPrice3Year : discountedPrice5Year),
                          academicYear: "2026/2027",
                          term: "Term 1",
                          status: "success",
                          paidAt: txData.paidAt || new Date().toISOString(),
                          createdAt: new Date().toISOString()
                        };
                        
                        DbController.savePaystackPayment(paymentLog);

                        const tierYears = selectedLicenseTier === '1year' ? 1 : selectedLicenseTier === '2year' ? 2 : selectedLicenseTier === '3year' ? 3 : selectedLicenseTier === '5year' ? 5 : 1;

                        await DbController.updateUserLicense(
                          currentUser.uid,
                          'activated',
                          new Date().toISOString(),
                          generatedKey,
                          currentUser.requestCode || 'REQ-SYSTEM-9401',
                          tierYears
                        );
                        setSubscriptionSuccess(true);
                        // Force refresh lists of users locally so evaluateSubscription finds the new state
                        setRegisteredAccounts(DbController.getRegisteredUsers());
                        onRefresh();
                      } catch (e: any) {
                        alert("Paystack payment completed but local license state synchronization had errors: " + e.message);
                      }
                    }}
                  />
                ) : (
                  <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500 font-sans">
                    Please log in to purchase a school license index check.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Subscription Success State Overlay / Message */}
          {subscriptionSuccess && (
            <div className="p-5 bg-emerald-50 border border-emerald-250 rounded-2xl flex items-start gap-4 animate-fade-in relative overflow-hidden mt-4">
              <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
              <div className="p-3 bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl flex-shrink-0 animate-bounce">
                <Check size={20} className="stroke-[3]" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-emerald-950 font-sans">Corporate Database License Fully Activated!</h4>
                <p className="text-xs text-emerald-800/90 leading-relaxed font-sans max-w-2xl">
                  Paystack transaction settled. The licensing system has successfully verified the cryptographic passcode and upgraded your account <strong>{currentUser?.email}</strong> from Trial limits to fully <strong>Licensed Year Access</strong>. All core student directories, assessments, and attendance logs are secured.
                </p>
                <div className="pt-2">
                  <button 
                    type="button" 
                    onClick={() => setSubscriptionSuccess(false)}
                    className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-lg text-[10px] transition cursor-pointer select-none"
                  >
                    Superb, Carry On
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Dynamic License Pricing Administrative Panel */}
          {isAdmin && (
            <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-md space-y-6 mt-6">
              <div className="flex items-center justify-between border-b border-slate-150 pb-4 flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 border border-indigo-150 text-indigo-700 rounded-xl">
                    <FileSliders size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide font-sans">
                      Licensing Pricing & Renewal Adjustment Deck (Admin Only)
                    </h4>
                    <p className="text-xs text-slate-400 font-sans leading-relaxed">
                      Restructure standard GHS pricing parameters to dynamically modify front-end gateway prices with integrated cost metrics.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSavePricing}
                  className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-750 hover:from-indigo-650 hover:to-indigo-800 text-white font-bold rounded-xl text-[11px] uppercase tracking-wider flex items-center gap-1.5 shadow-md hover:shadow-lg transition active:translate-y-0.5 cursor-pointer font-sans select-none"
                >
                  <Save size={13} />
                  Save and Sync New Prices
                </button>
              </div>

              {/* 4-Card Responsive Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                
                {/* 1-Year Card */}
                <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all duration-200">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] bg-slate-200/70 text-slate-700 font-black px-2.5 py-1 rounded-lg uppercase font-mono tracking-wider">
                        Benchmark Tier
                      </span>
                      <Sparkles size={14} className="text-slate-400" />
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-800 text-xs font-sans leading-tight">Standard 1-Year License</h5>
                      <p className="text-[10px] text-slate-400 font-sans mt-0.5 leading-relaxed">The cornerstone rate used to calculate value metrics and multi-year subscription benefits.</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-xs font-black text-slate-400 font-mono">GHS</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={adminPrice1Y}
                          onChange={(e) => setAdminPrice1Y(Math.max(1, parseInt(e.target.value) || 0))}
                          className="w-full text-xs pl-13 pr-3.5 py-2.5 border border-slate-200 rounded-xl bg-white font-black font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-2xs"
                        />
                      </div>
                      
                      {/* Incremental Adjustment controls */}
                      <div className="flex gap-1 justify-center">
                        <button type="button" onClick={() => setAdminPrice1Y(Math.max(1, adminPrice1Y - 50))} className="px-2 py-1 bg-white hover:bg-slate-100 text-[9px] font-mono font-bold text-slate-500 border border-slate-200 rounded-md transition select-none cursor-pointer">-50</button>
                        <button type="button" onClick={() => setAdminPrice1Y(Math.max(1, adminPrice1Y - 10))} className="px-2 py-1 bg-white hover:bg-slate-100 text-[9px] font-mono font-bold text-slate-500 border border-slate-200 rounded-md transition select-none cursor-pointer">-10</button>
                        <button type="button" onClick={() => setAdminPrice1Y(adminPrice1Y + 10)} className="px-2 py-1 bg-white hover:bg-slate-100 text-[9px] font-mono font-bold text-slate-500 border border-slate-200 rounded-md transition select-none cursor-pointer">+10</button>
                        <button type="button" onClick={() => setAdminPrice1Y(adminPrice1Y + 50)} className="px-2 py-1 bg-white hover:bg-slate-100 text-[9px] font-mono font-bold text-slate-500 border border-slate-200 rounded-md transition select-none cursor-pointer">+50</button>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-2.5 space-y-1 text-[10px] font-sans">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Effective Annual Rate:</span>
                        <strong className="text-slate-700 font-mono">GHS {adminPrice1Y.toFixed(2)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Base Multiplier:</span>
                        <strong className="text-slate-500 font-mono">1.0x (Baseline)</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2-Year Card */}
                <div className="bg-indigo-50/20 p-5 rounded-2xl border border-indigo-100/80 shadow-xs flex flex-col justify-between space-y-4 hover:border-indigo-200 transition-all duration-200">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] bg-indigo-100/60 text-indigo-700 font-black px-2.5 py-1 rounded-lg uppercase font-mono tracking-wider">
                        Double Term
                      </span>
                      <ArrowUpCircle size={14} className="text-indigo-400 animate-pulse" />
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-800 text-xs font-sans leading-tight">Extended 2-Year License</h5>
                      <p className="text-[10px] text-slate-400 font-sans mt-0.5 leading-relaxed">Secures institutional databases and features against potential year-on-year local currency inflation.</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-xs font-black text-slate-400 font-mono">GHS</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={adminPrice2Y}
                          onChange={(e) => setAdminPrice2Y(Math.max(1, parseInt(e.target.value) || 0))}
                          className="w-full text-xs pl-13 pr-3.5 py-2.5 border border-indigo-100 rounded-xl bg-white font-black font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-2xs"
                        />
                      </div>
                      
                      {/* Incremental Adjustment controls */}
                      <div className="flex gap-1 justify-center">
                        <button type="button" onClick={() => setAdminPrice2Y(Math.max(1, adminPrice2Y - 50))} className="px-2 py-1 bg-white hover:bg-indigo-50 text-[9px] font-mono font-bold text-indigo-600/80 border border-indigo-100 rounded-md transition select-none cursor-pointer">-50</button>
                        <button type="button" onClick={() => setAdminPrice2Y(Math.max(1, adminPrice2Y - 10))} className="px-2 py-1 bg-white hover:bg-indigo-50 text-[9px] font-mono font-bold text-indigo-600/80 border border-indigo-100 rounded-md transition select-none cursor-pointer">-10</button>
                        <button type="button" onClick={() => setAdminPrice2Y(adminPrice2Y + 10)} className="px-2 py-1 bg-white hover:bg-indigo-50 text-[9px] font-mono font-bold text-indigo-600/80 border border-indigo-100 rounded-md transition select-none cursor-pointer">+10</button>
                        <button type="button" onClick={() => setAdminPrice2Y(adminPrice2Y + 50)} className="px-2 py-1 bg-white hover:bg-indigo-50 text-[9px] font-mono font-bold text-indigo-600/80 border border-indigo-100 rounded-md transition select-none cursor-pointer">+50</button>
                      </div>
                    </div>

                    <div className="border-t border-indigo-100/50 pt-2.5 space-y-1 text-[10px] font-sans">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Effective Annual Rate:</span>
                        <strong className="text-slate-700 font-mono">GHS {(adminPrice2Y / 2).toFixed(2)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Admin Savings Spread:</span>
                        <strong className={`font-mono ${(adminPrice1Y * 2 - adminPrice2Y) > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                          {(adminPrice1Y * 2 - adminPrice2Y) > 0 
                            ? `GHS ${(adminPrice1Y * 2 - adminPrice2Y).toFixed(2)} (${(((adminPrice1Y * 2 - adminPrice2Y) / (adminPrice1Y * 2)) * 100).toFixed(0)}%)` 
                            : 'No Discount'}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3-Year Card */}
                <div className="bg-emerald-50/20 p-5 rounded-2xl border border-emerald-100/80 shadow-xs flex flex-col justify-between space-y-4 hover:border-emerald-200 transition-all duration-200">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] bg-emerald-100/60 text-emerald-800 font-black px-2.5 py-1 rounded-lg uppercase font-mono tracking-wider">
                        Premium Shield
                      </span>
                      <ShieldCheck size={14} className="text-emerald-500 animate-pulse" />
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-800 text-xs font-sans leading-tight">Premium 3-Year Protection</h5>
                      <p className="text-[10px] text-slate-400 font-sans mt-0.5 leading-relaxed">Secures continuous upgrades, cloud back-ups, data storage, and school communication services.</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-xs font-black text-slate-400 font-mono">GHS</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={adminPrice3Y}
                          onChange={(e) => setAdminPrice3Y(Math.max(1, parseInt(e.target.value) || 0))}
                          className="w-full text-xs pl-13 pr-3.5 py-2.5 border border-emerald-100 rounded-xl bg-white font-black font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 transition shadow-2xs"
                        />
                      </div>
                      
                      {/* Incremental Adjustment controls */}
                      <div className="flex gap-1 justify-center">
                        <button type="button" onClick={() => setAdminPrice3Y(Math.max(1, adminPrice3Y - 50))} className="px-2 py-1 bg-white hover:bg-emerald-50 text-[9px] font-mono font-bold text-emerald-600 border border-emerald-100 rounded-md transition select-none cursor-pointer">-50</button>
                        <button type="button" onClick={() => setAdminPrice3Y(Math.max(1, adminPrice3Y - 10))} className="px-2 py-1 bg-white hover:bg-emerald-50 text-[9px] font-mono font-bold text-emerald-600 border border-emerald-100 rounded-md transition select-none cursor-pointer">-10</button>
                        <button type="button" onClick={() => setAdminPrice3Y(adminPrice3Y + 10)} className="px-2 py-1 bg-white hover:bg-emerald-50 text-[9px] font-mono font-bold text-emerald-600 border border-emerald-100 rounded-md transition select-none cursor-pointer">+10</button>
                        <button type="button" onClick={() => setAdminPrice3Y(adminPrice3Y + 50)} className="px-2 py-1 bg-white hover:bg-emerald-50 text-[9px] font-mono font-bold text-emerald-600 border border-emerald-100 rounded-md transition select-none cursor-pointer">+50</button>
                      </div>
                    </div>

                    <div className="border-t border-emerald-100/50 pt-2.5 space-y-1 text-[10px] font-sans">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Effective Annual Rate:</span>
                        <strong className="text-slate-700 font-mono">GHS {(adminPrice3Y / 3).toFixed(2)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Admin Savings Spread:</span>
                        <strong className={`font-mono ${(adminPrice1Y * 3 - adminPrice3Y) > 0 ? 'text-emerald-600 font-bold' : 'text-slate-500'}`}>
                          {(adminPrice1Y * 3 - adminPrice3Y) > 0 
                            ? `GHS ${(adminPrice1Y * 3 - adminPrice3Y).toFixed(2)} (${(((adminPrice1Y * 3 - adminPrice3Y) / (adminPrice1Y * 3)) * 100).toFixed(0)}%)` 
                            : 'No Discount'}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5-Year Card */}
                <div className="bg-amber-50/20 p-5 rounded-2xl border border-amber-100/80 shadow-xs flex flex-col justify-between space-y-4 hover:border-amber-200 transition-all duration-200">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] bg-amber-100/60 text-amber-800 font-black px-2.5 py-1 rounded-lg uppercase font-mono tracking-wider">
                        Enterprise Gold
                      </span>
                      <Lock size={14} className="text-amber-500 animate-pulse" />
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-800 text-xs font-sans leading-tight">Golden 5-Year Shield</h5>
                      <p className="text-[10px] text-slate-400 font-sans mt-0.5 leading-relaxed">Full long-term system guarantee with primary support privileges, permanent databases shield, and custom layouts.</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-xs font-black text-slate-400 font-mono">GHS</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={adminPrice5Y}
                          onChange={(e) => setAdminPrice5Y(Math.max(1, parseInt(e.target.value) || 0))}
                          className="w-full text-xs pl-13 pr-3.5 py-2.5 border border-amber-100 rounded-xl bg-white font-black font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 transition shadow-2xs"
                        />
                      </div>
                      
                      {/* Incremental Adjustment controls */}
                      <div className="flex gap-1 justify-center">
                        <button type="button" onClick={() => setAdminPrice5Y(Math.max(1, adminPrice5Y - 50))} className="px-2 py-1 bg-white hover:bg-amber-50 text-[9px] font-mono font-bold text-amber-700/80 border border-amber-100 rounded-md transition select-none cursor-pointer">-50</button>
                        <button type="button" onClick={() => setAdminPrice5Y(Math.max(1, adminPrice5Y - 10))} className="px-2 py-1 bg-white hover:bg-amber-50 text-[9px] font-mono font-bold text-amber-700/80 border border-amber-100 rounded-md transition select-none cursor-pointer">-10</button>
                        <button type="button" onClick={() => setAdminPrice5Y(adminPrice5Y + 10)} className="px-2 py-1 bg-white hover:bg-amber-50 text-[9px] font-mono font-bold text-amber-700/80 border border-amber-100 rounded-md transition select-none cursor-pointer">+10</button>
                        <button type="button" onClick={() => setAdminPrice5Y(adminPrice5Y + 50)} className="px-2 py-1 bg-white hover:bg-amber-50 text-[9px] font-mono font-bold text-amber-700/80 border border-amber-100 rounded-md transition select-none cursor-pointer">+50</button>
                      </div>
                    </div>

                    <div className="border-t border-amber-100/50 pt-2.5 space-y-1 text-[10px] font-sans">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Effective Annual Rate:</span>
                        <strong className="text-slate-700 font-mono">GHS {(adminPrice5Y / 5).toFixed(2)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Admin Savings Spread:</span>
                        <strong className={`font-mono ${(adminPrice1Y * 5 - adminPrice5Y) > 0 ? 'text-emerald-600 font-bold' : 'text-slate-500'}`}>
                          {(adminPrice1Y * 5 - adminPrice5Y) > 0 
                            ? `GHS ${(adminPrice1Y * 5 - adminPrice5Y).toFixed(2)} (${(((adminPrice1Y * 5 - adminPrice5Y) / (adminPrice1Y * 5)) * 100).toFixed(0)}%)` 
                            : 'No Discount'}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* SMS Rate Adjustment Sub-Section */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50/50 p-5 rounded-2xl border border-amber-200/60 shadow-xs space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] bg-amber-200 text-amber-800 font-black px-2.5 py-1 rounded-lg uppercase font-mono tracking-wider">
                      Prepaid SMS Rate Adjuster
                    </span>
                    <h5 className="font-bold text-slate-800 text-xs font-sans">Ghana SMS Carrier Wallet Exchange Multiplier</h5>
                    <p className="text-[10px] text-slate-500 font-sans leading-relaxed">
                      Define how many SMS credits are granted per 1 GHS loaded. Higher values decrease the unit price per SMS, making broadcasts cheaper. Only administrators can alter this rate.
                    </p>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase font-mono">Credits per GHS 1.00</label>
                      <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-8xs">
                        <input 
                          type="number"
                          value={adminSmsRate}
                          onChange={(e) => setAdminSmsRate(Math.max(1, parseInt(e.target.value) || 0))}
                          className="w-16 px-2 py-1 text-slate-700 bg-transparent text-xs font-mono font-bold focus:outline-none"
                        />
                        <div className="flex gap-1">
                          <button type="button" onClick={() => setAdminSmsRate(Math.max(5, adminSmsRate - 5))} className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-[9px] font-mono font-bold text-slate-600 rounded-md transition cursor-pointer">-5</button>
                          <button type="button" onClick={() => setAdminSmsRate(adminSmsRate + 5)} className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-[9px] font-mono font-bold text-slate-600 rounded-md transition cursor-pointer">+5</button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white/80 border border-amber-100 p-3 rounded-xl flex items-center gap-4 text-xs">
                      <div>
                        <span className="block text-[9px] text-slate-400 uppercase font-mono leading-none">Equivalent Cost</span>
                        <strong className="text-amber-700 font-black font-mono mt-1 block">GHS {(1 / adminSmsRate).toFixed(3)} / SMS</strong>
                      </div>
                      <div className="border-l border-amber-100 pl-4">
                        <span className="block text-[9px] text-slate-400 uppercase font-mono leading-none">Price Level Description</span>
                        <span className={`text-[10px] font-bold mt-1 block ${adminSmsRate >= 20 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {adminSmsRate >= 20 ? 'Highly Discounted (Lowered)' : 'Standard Premium Rate'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* SECURE ACTIVITY LOGS & ADMINISTRATIVE CORNER */}
      {settingsSubTab === 'logs' && (
        <div className="space-y-6 animate-fade-in text-left">
          
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-violet-600 via-indigo-650 to-indigo-800 p-6 rounded-2xl text-white shadow-md relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="relative z-10 space-y-2">
              <span className="text-[10px] uppercase font-mono tracking-widest font-black text-indigo-200 bg-white/10 px-2.5 py-1 rounded-md border border-white/10 flex items-center gap-1.5 w-fit">
                <ShieldCheck size={12} className="text-indigo-300" />
                Workstation Audit & Security Center
              </span>
              <h3 className="text-lg font-black font-sans leading-tight">
                Secure Activity Logs & Institutional Promotion Engine
              </h3>
              <p className="text-xs text-white opacity-90 max-w-2xl leading-relaxed">
                Monitor and review sensitive administrative actions performed on this school database ledger. You can also run system-level operations such as cohort bulk student promotion below.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* LEFT COLUMN: Cohort Bulk Promotion Panel */}
            <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs space-y-4 self-start">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 font-sans">
                <ArrowUpCircle size={18} className="text-indigo-600 font-bold" />
                <h4 className="font-sans font-bold text-slate-800 text-xs uppercase tracking-wider">Bulk Cohort Promotion</h4>
              </div>
              
              <p className="text-[10.5px] text-slate-500 leading-normal font-sans">
                Elevate a whole class of students to the next level in one step. Stored profile rosters, tuition bills, and historical assessments are safely maintained.
              </p>

              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Source Class Cohort</label>
                  <select
                    value={promoSourceClass}
                    onChange={(e) => setPromoSourceClass(e.target.value as ClassType)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                  >
                    {CLASSES.map((cls) => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Target Class Cohort</label>
                  <select
                    value={promoTargetClass}
                    onChange={(e) => setPromoTargetClass(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium font-sans"
                  >
                    {CLASSES.map((cls) => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                    <option value="Graduated">🎓 Graduated (Alumni archives)</option>
                  </select>
                </div>
              </div>

              {promotionSuccessText && (
                <div className="p-3 bg-emerald-50 border border-emerald-150 rounded-xl text-[10px] text-emerald-800 font-bold flex items-center gap-1.5 animate-pulse">
                  <CheckCircle2 size={13} className="text-emerald-600 flex-shrink-0" />
                  <span>{promotionSuccessText}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleBulkPromote}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs font-sans"
              >
                <ArrowUpCircle size={14} />
                <span>Execute Bulk Promotion</span>
              </button>
            </div>

            {/* RIGHT COLUMN: WORKSTATION AUDIT LOG PANEL */}
            <div className="lg:col-span-2 bg-white p-5 border border-slate-200 rounded-2xl shadow-xs space-y-4">
              
              {/* Controls bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 font-sans">
                <div className="flex items-center gap-2">
                  <History size={18} className="text-slate-500" />
                  <h4 className="font-sans font-bold text-slate-800 text-xs uppercase tracking-wider">Audit Security Log ({filteredLogs.length})</h4>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setActivityLogs(DbController.getActivityLogs())}
                    className="px-2.5 py-1.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg text-slate-600 hover:text-indigo-600 transition cursor-pointer text-[10px] font-bold flex items-center gap-1 font-sans"
                    title="Refresh logs ledger"
                  >
                    <RefreshCw size={12} />
                    <span>Refresh Logs</span>
                  </button>
                  {currentUser?.role === 'Admin' && (
                    <button
                      type="button"
                      onClick={handleClearLogs}
                      className="px-2.5 py-1.5 hover:bg-rose-50 border border-rose-200 text-rose-600 hover:text-rose-700 rounded-lg transition cursor-pointer text-[10px] font-bold flex items-center gap-1 font-sans"
                    >
                      <Trash2 size={12} />
                      <span>Clear Audit Logs</span>
                    </button>
                  )}
                  <button
                      type="button"
                      onClick={handleRunIntegrityReport}
                      className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 hover:text-sky-800 rounded-lg transition cursor-pointer text-[10px] font-bold flex items-center gap-1 font-sans"
                    >
                      <Database size={12} />
                      <span>Database Integrity Report</span>
                    </button>
                    {canRepair && (
                      <button
                        type="button"
                        onClick={handleFixAllIssues}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition cursor-pointer text-[10px] font-bold flex items-center gap-1 font-sans shadow-sm"
                      >
                        <Check size={12} />
                        <span>Fix All Issues</span>
                      </button>
                    )}
                </div>
              </div>
              
              {integrityReport && (
                <div className="p-4 bg-slate-800 text-white rounded-xl text-xs font-mono whitespace-pre-wrap mt-2 overflow-auto max-h-40 relative">
                  <button 
                    onClick={() => setIntegrityReport(null)}
                    className="absolute top-2 right-2 text-slate-400 hover:text-white"
                  >
                    <X size={14}/>
                  </button>
                  {integrityReport}
                </div>
              )}

              {/* Filters bar */}
              <div className="flex flex-col sm:flex-row gap-2 font-sans">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    placeholder="Search by actions, operators or descriptors..."
                    className="w-full text-xs px-3 py-1.5 pl-8 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <div className="absolute left-2.5 top-2.5 text-slate-400">
                    <Filter size={12} />
                  </div>
                  {logSearch && (
                    <button
                      type="button"
                      onClick={() => setLogSearch('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-900 border-0 bg-transparent p-0 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="sm:w-44 flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 border border-slate-200 rounded-lg">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Level:</span>
                  <select
                    value={logSeverityFilter}
                    onChange={(e: any) => setLogSeverityFilter(e.target.value)}
                    className="flex-1 text-[11px] font-bold bg-transparent border-0 outline-none text-slate-700 focus:ring-0 cursor-pointer text-left"
                  >
                    <option value="all">Any Severity</option>
                    <option value="info">Info</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              {/* Audit Roster */}
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {filteredLogs.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 space-y-2 border border-dashed border-slate-200 rounded-2xl">
                    <History size={32} className="mx-auto text-slate-300 stroke-[1.25]" />
                    <p className="text-[11px] font-bold font-sans">No administrative actions logged</p>
                    <p className="text-[10px] text-slate-400/90 leading-normal max-w-sm mx-auto">
                      All audit trails or promotions logged here remain protected under hardware security boundaries. Try searching or adjusting the filters!
                    </p>
                  </div>
                ) : (
                  filteredLogs.map((log) => {
                    // Decide badge styling based on severity level
                    let badgeStyles = 'bg-slate-50 text-slate-500 border border-slate-100';
                    let textStyles = 'text-slate-705 text-slate-700';
                    if (log.severity === 'critical') {
                      badgeStyles = 'bg-rose-550/10 text-rose-700 border border-rose-150 animate-pulse';
                    } else if (log.severity === 'high') {
                      badgeStyles = 'bg-amber-500/10 text-amber-700 border border-amber-150';
                    } else if (log.severity === 'medium') {
                      badgeStyles = 'bg-indigo-500/10 text-indigo-700 border border-indigo-150';
                    } else if (log.severity === 'low') {
                      badgeStyles = 'bg-blue-500/10 text-blue-700 border border-blue-150';
                    }

                    // Format Timestamp
                    let formattedTime = log.timestamp;
                    try {
                      formattedTime = new Date(log.timestamp).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                      });
                    } catch (e) {
                      // fallback
                    }

                    return (
                      <div
                        key={log.id}
                        className="p-3.5 border border-slate-150 rounded-xl hover:border-slate-300 hover:bg-slate-50/50 transition duration-150 flex flex-col md:flex-row gap-3 text-left"
                      >
                        {/* Column 1: Action Title and Type Indicator */}
                        <div className="md:w-56 space-y-1 my-auto">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`text-[9px] font-mono leading-none font-bold uppercase tracking-wider px-2 py-0.5 rounded ${badgeStyles}`}>
                              {log.severity}
                            </span>
                          </div>
                          <h5 className="text-xs font-bold font-sans text-slate-805 text-slate-800">
                            {log.action}
                          </h5>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {formattedTime}
                          </p>
                        </div>

                        {/* Column 2: Specific Description & User Identity details */}
                        <div className="flex-1 space-y-1.5 md:border-l md:border-slate-100 md:pl-4">
                          <p className={`text-[11px] leading-relaxed font-sans font-semibold ${textStyles}`}>
                            {log.details}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px]">
                            <span className="text-slate-400 uppercase tracking-widest font-mono text-[9px] font-bold">Operator:</span>
                            <span className="text-slate-700 font-bold font-sans">
                              {log.userName}
                            </span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-400 font-mono">
                              {log.userEmail}
                            </span>
                            <span className="text-slate-400">•</span>
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold font-mono">
                              {log.userRole}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* COMPREHENSIVE SECURITY SAFE CLEAR-DATA MODAL POP-UP */}
      {showWipeModal && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowWipeModal(false);
          }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 no-print cursor-pointer animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl text-slate-900 font-sans space-y-6 cursor-default"
          >
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-rose-800 flex items-center gap-1.5">
                <ShieldAlert className="text-rose-600" size={18} />
                Dangerous Action Warning
              </h3>
              <button 
                onClick={() => setShowWipeModal(false)}
                className="p-1 hover:bg-slate-100 rounded text-slate-400 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-slate-650 text-left">
              <p>
                You are about to initiate a <strong>Complete System Reset</strong>. This operation will:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-500 font-semibold font-sans">
                <li>Wipe all Student Profiles entirely</li>
                <li>Wipe all Teacher Profiles & records</li>
                <li>Clear the entire Class Attendance Roster</li>
                <li>Reset all Academic Assessments & grade sheets</li>
                <li>Reset the School Fees Ledger completely</li>
                <li>Purge active login sessions & clear school settings</li>
                <li>Initialize blank input data fields for any new user login</li>
              </ul>
              <p className="text-rose-600 font-bold bg-rose-50 p-2.5 rounded-lg border border-rose-100">
                This action is irreversible. We highly recommend clicking "Save All Data" to back up first!
              </p>
            </div>

            <div className="space-y-2 text-left">
              <label className="block text-[10px] font-sans font-bold text-slate-500 uppercase tracking-wider">
                Type the word <span className="text-rose-600 font-black">'WIPE'</span> to confirm authorization:
              </label>
              <input 
                type="text"
                value={wipeConfirmText}
                onChange={(e) => {
                  setWipeConfirmText(e.target.value);
                  setWipeError('');
                }}
                placeholder="e.g. WIPE"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 font-bold focus:outline-none"
              />
              {wipeError && (
                <span className="text-rose-600 text-[10px] block font-semibold">{wipeError}</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowWipeModal(false)}
                className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer text-center"
              >
                Discard / Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (wipeConfirmText.toUpperCase() === 'WIPE') {
                    await DbController.clearAllData();
                    setShowWipeModal(false);
                    window.location.reload();
                  } else {
                    setWipeError("Please type 'WIPE' to confirm.");
                  }
                }}
                className="py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition cursor-pointer flex items-center justify-center gap-1 text-center"
              >
                <Trash2 size={13} />
                Wipe & Start Fresh
              </button>
            </div>

          </div>
        </div>
      )}

      {/* TEACHER MANAGEMENT & GRANULAR PERMISSION CONTROL */}
      {settingsSubTab === 'teachers' && (
        <div className="space-y-6 animate-fade-in text-left">
          
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-teal-600 via-emerald-650 to-emerald-800 p-6 rounded-2xl text-white shadow-md relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="relative z-10 space-y-2">
              <span className="text-[10px] uppercase font-mono tracking-widest font-black text-emerald-200 bg-white/10 px-2.5 py-1 rounded-md border border-white/10 flex items-center gap-1.5 w-fit">
                <ShieldCheck size={12} className="text-emerald-300" />
                Staff Access Controls & Privileges
              </span>
              <h3 className="text-lg font-black font-sans leading-tight">
                Teacher Permission Management
              </h3>
              <p className="text-xs text-white opacity-90 max-w-2xl leading-relaxed">
                Configure granular access permissions for each class teacher. You can explicitly revoke or grant their ability to enter grades, approve daily attendance logs, or export institutional reports.
              </p>
            </div>
          </div>

          {/* Teacher Search & Quick Filter */}
          <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1">
                <h4 className="font-sans font-bold text-slate-800 text-xs uppercase tracking-wider">Active Faculty Registry</h4>
                <p className="text-[10px] text-slate-400">Search for teachers by name, email or Staff ID and manage their active privileges.</p>
              </div>
              
              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Filter teachers..."
                  value={teacherSearchQuery}
                  onChange={(e) => setTeacherSearchQuery(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 border border-slate-205 border-slate-200 rounded-xl focus:border-indigo-400 focus:outline-none bg-slate-50/50 text-slate-850"
                />
              </div>
            </div>

            {teacherSaveStatus && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-xl flex items-center gap-2 animate-fade-in">
                <CheckCircle2 size={15} className="text-emerald-600 animate-pulse" />
                <span className="text-xs font-semibold">Teacher credentials updated and synced to system security register!</span>
              </div>
            )}

            {/* List of Teachers */}
            <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100">
              {(() => {
                const filtered = teachersList.filter(teacher => {
                  const q = teacherSearchQuery.toLowerCase().trim();
                  if (!q) return true;
                  return (
                    teacher.firstName.toLowerCase().includes(q) ||
                    teacher.lastName.toLowerCase().includes(q) ||
                    (teacher.email && teacher.email.toLowerCase().includes(q)) ||
                    (teacher.staffId && teacher.staffId.toLowerCase().includes(q))
                  );
                });

                if (filtered.length === 0) {
                  return (
                    <div className="p-8 text-center text-slate-400 space-y-1.5 bg-slate-50/50">
                      <Users size={24} className="text-slate-300 mx-auto animate-bounce" />
                      <p className="text-xs font-bold text-slate-500">No teachers matched your query</p>
                      <p className="text-[10px] text-slate-400">Add or register teachers in the Primary Teachers Profiles tab first.</p>
                    </div>
                  );
                }

                return filtered.map(teacher => {
                  const canEditGrades = teacher.permissions?.canEditGrades !== false;
                  const canApproveAttendance = teacher.permissions?.canApproveAttendance !== false;
                  const canExportReports = teacher.permissions?.canExportReports !== false;

                  return (
                    <div key={teacher.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white hover:bg-slate-50/30 transition-all">
                      
                      {/* Teacher Profile Info */}
                      <div className="flex items-center gap-3">
                        {teacher.photoUrl ? (
                          <img src={teacher.photoUrl} alt="" className="w-10 h-10 rounded-full border border-slate-200 object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                            {teacher.firstName[0] || ''}{teacher.lastName[0] || ''}
                          </div>
                        )}
                        <div className="space-y-0.5 text-left">
                          <h4 className="font-sans font-bold text-slate-850 text-xs flex items-center gap-1.5">
                            {teacher.firstName} {teacher.lastName}
                            {teacher.assignedClass && teacher.assignedClass !== 'None' ? (
                              <span className="bg-indigo-50 border border-indigo-150 text-indigo-700 text-[9px] px-1.5 py-0.5 rounded-md font-mono font-bold">
                                {teacher.assignedClass} Class Duty
                              </span>
                            ) : (
                              <span className="bg-slate-100 border border-slate-200 text-slate-500 text-[9px] px-1.5 py-0.5 rounded-md font-mono">
                                Floating Duty
                              </span>
                            )}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {teacher.email || 'No email bound'} • Staff ID: {teacher.staffId || 'N/A'}
                          </p>
                        </div>
                      </div>

                      {/* Permissions Toggles Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 w-full md:w-auto">
                        
                        {/* Toggle 1: Can Edit Grades */}
                        <div className="flex items-center justify-between gap-4 p-2 bg-slate-50 border border-slate-150 rounded-xl">
                          <div className="space-y-0.5 text-left">
                            <span className="text-[10px] font-bold text-slate-700 block">Edit Grades</span>
                            <span className="text-[9px] text-slate-400 block font-medium">Can update worksheet</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const updatedPermissions = {
                                ...teacher.permissions,
                                canEditGrades: !canEditGrades
                              };
                              const updatedTeacher = {
                                ...teacher,
                                permissions: updatedPermissions
                              };
                              DbController.saveTeacher(updatedTeacher);
                              
                              DbController.writeActivityLog(
                                'Teacher Permission Change',
                                `Updated grading permissions for ${teacher.firstName} ${teacher.lastName} to ${!canEditGrades}`,
                                'info'
                              );

                              setTeachersList(DbController.getTeachers());
                              setTeacherSaveStatus(true);
                              setTimeout(() => setTeacherSaveStatus(false), 2000);
                            }}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              canEditGrades ? 'bg-emerald-600' : 'bg-slate-350 bg-slate-300'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                                canEditGrades ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Toggle 2: Can Approve Attendance */}
                        <div className="flex items-center justify-between gap-4 p-2 bg-slate-50 border border-slate-150 rounded-xl">
                          <div className="space-y-0.5 text-left">
                            <span className="text-[10px] font-bold text-slate-700 block">Mark Attendance</span>
                            <span className="text-[9px] text-slate-400 block font-medium">Can submit class roll</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const updatedPermissions = {
                                ...teacher.permissions,
                                canApproveAttendance: !canApproveAttendance
                              };
                              const updatedTeacher = {
                                ...teacher,
                                permissions: updatedPermissions
                              };
                              DbController.saveTeacher(updatedTeacher);
                              
                              DbController.writeActivityLog(
                                'Teacher Permission Change',
                                `Updated attendance permissions for ${teacher.firstName} ${teacher.lastName} to ${!canApproveAttendance}`,
                                'info'
                              );

                              setTeachersList(DbController.getTeachers());
                              setTeacherSaveStatus(true);
                              setTimeout(() => setTeacherSaveStatus(false), 2000);
                            }}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              canApproveAttendance ? 'bg-emerald-600' : 'bg-slate-350 bg-slate-300'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                                canApproveAttendance ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Toggle 3: Can Export Reports */}
                        <div className="flex items-center justify-between gap-4 p-2 bg-slate-50 border border-slate-150 rounded-xl">
                          <div className="space-y-0.5 text-left">
                            <span className="text-[10px] font-bold text-slate-700 block">Export & Print</span>
                            <span className="text-[9px] text-slate-400 block font-medium">Can print report cards</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const updatedPermissions = {
                                ...teacher.permissions,
                                canExportReports: !canExportReports
                              };
                              const updatedTeacher = {
                                ...teacher,
                                permissions: updatedPermissions
                              };
                              DbController.saveTeacher(updatedTeacher);
                              
                              DbController.writeActivityLog(
                                'Teacher Permission Change',
                                `Updated export/print permissions for ${teacher.firstName} ${teacher.lastName} to ${!canExportReports}`,
                                'info'
                              );

                              setTeachersList(DbController.getTeachers());
                              setTeacherSaveStatus(true);
                              setTimeout(() => setTeacherSaveStatus(false), 2000);
                            }}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              canExportReports ? 'bg-emerald-600' : 'bg-slate-350 bg-slate-300'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                                canExportReports ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>

                      </div>

                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* SECURITY & SESSION SESSION CONTROL TAB */}
      {settingsSubTab === 'security' && isAdmin && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6 animate-fade-in">
          <div className="flex items-center justify-between gap-4 pb-2 border-b border-slate-100">
            <h3 className="text-sm font-display font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck size={17} className="text-indigo-600" />
              Administrative Security & Session Management
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">Admin Only</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed font-medium max-w-2xl">
            Configure global security policies to protect the school database. These settings apply to all user sessions and administrative modules across this workspace.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Auto-Logout Timer Section */}
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white rounded-lg border border-slate-200 text-indigo-600 shadow-sm">
                  <Laptop size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Automatic Session Expiry (Idle Timer)</h4>
                  <p className="text-[10px] text-slate-400 leading-normal mt-0.5">
                    Automatically log out teachers and staff after a period of inactivity to prevent unauthorized access to open workstations.
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600">Auto-Logout Threshold</span>
                  <span className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                    {systemSettings.idleLogoutTimer || 30} Minutes
                  </span>
                </div>
                
                <input 
                  type="range" 
                  min="5" 
                  max="120" 
                  step="5"
                  value={systemSettings.idleLogoutTimer || 30}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    const updated = { ...systemSettings, idleLogoutTimer: val };
                    setSystemSettings(updated);
                    DbController.saveSystemSettings(updated);
                    
                    DbController.writeActivityLog(
                      'Security Policy Modified',
                      `Idle session timeout threshold updated to ${val} minutes.`,
                      'medium'
                    );
                  }}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />

                <div className="flex justify-between text-[9px] font-bold text-slate-400">
                  <span>5m (Max Security)</span>
                  <span>120m (Low Security)</span>
                </div>
              </div>

              <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-start gap-2.5">
                <AlertCircle size={14} className="text-indigo-600 mt-0.5 flex-shrink-0" />
                <p className="text-[10px] text-indigo-800 leading-normal font-medium">
                  <strong>Recommendation:</strong> Use 15-30 minutes for public staff rooms and 60+ minutes for private administrative offices. Changes take effect on next activity.
                </p>
              </div>
            </div>

            {/* Database Access Section */}
            <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 text-slate-600">
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Core System Lockdown</h4>
                  <p className="text-[10px] text-slate-400 leading-normal mt-0.5">
                    Prevent any data modifications (Grades, Attendance, Finance) across the entire system.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-150 rounded-xl">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold text-slate-700 block">Enable Read-Only Mode</span>
                  <span className="text-[9px] text-slate-400 block font-medium">Suspend all database writes globally</span>
                </div>
                <button
                  type="button"
                  disabled
                  className="relative inline-flex h-5 w-10 flex-shrink-0 cursor-not-allowed rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out bg-slate-200"
                >
                  <span className="translate-x-0 pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out" />
                </button>
              </div>
              
              <p className="text-[9px] text-slate-400 italic">
                * Global lockdown feature is currently disabled and managed via administrative shell for integrity.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* WEB-BASED BIOMETRIC AUTHENTICATION / WEBAUTHN DEVICE EXPERIMENTAL SIMULATOR */}
      {isBiometricModalOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in cursor-default font-sans text-slate-100"
        >
          <div className="bg-slate-905 bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-6 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 animate-pulse" />
            
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div className="flex items-center gap-1.5 text-indigo-400">
                <Fingerprint size={18} className="animate-pulse" />
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-left">WebAuthn Secure Shield</span>
              </div>
              <button 
                onClick={() => setIsBiometricModalOpen(false)}
                className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {biometricModalStep === 'scanning' && (
              <div className="space-y-6 text-center py-4">
                <div className="relative w-28 h-28 mx-auto flex items-center justify-center rounded-full bg-indigo-950/40 border border-indigo-900/50 shadow-inner overflow-hidden">
                  
                  {/* Glowing sensor scanning effect */}
                  <div className="absolute inset-x-4 top-0 h-0.5 bg-indigo-400 shadow-[0_0_15px_#6366f1] animate-bounce" style={{ animationDuration: '3s' }} />
                  
                  {biometricModalType === 'finger' ? (
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
                    {biometricModalType === 'finger' ? 'Scanning Touch ID Fingerprint...' : 'Reading Face ID Biomap...'}
                  </h3>
                  <p className="text-[10px] text-slate-400 max-w-xs mx-auto leading-relaxed font-semibold">
                    The sandbox environment requires user verification. Please place your finger or align your face to compile public-key credentials.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSimulateEnrolmentSuccess}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-slate-700 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-md tracking-wider uppercase font-mono animate-pulse"
                >
                  Verify Biomap ID Key
                </button>
              </div>
            )}

            {biometricModalStep === 'success' && (
              <div className="space-y-6 text-center py-4 animate-fade-in">
                <div className="w-16 h-16 bg-emerald-950/50 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto text-emerald-400 animate-bounce">
                  <Check size={28} className="stroke-[3]" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-emerald-400">Credential Sync Complete!</h3>
                  <p className="text-[10px] text-slate-300 max-w-xs mx-auto leading-relaxed">
                    Visual WebAuthn attestation resolved successfully! Private key generated in hardware secure vault and public key bound to <strong>{currentUser?.name}</strong>.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsBiometricModalOpen(false)}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-[0_2px_10px_-4px_rgba(16,185,129,0.5)]"
                >
                  Close & Activate Biometric Secure Login
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
    </div>
  );
}
