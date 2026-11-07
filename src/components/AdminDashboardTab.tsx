import React, { useState, useEffect, useMemo } from 'react';
import { 
  UserPlus, Users, Trash2, Key, ShieldAlert, Check, Search, 
  Lock, Shield, RefreshCw, UserCheck, Smartphone, Info, CalendarClock, UserX, Activity,
  CreditCard, Settings, GraduationCap, Coins, LayoutDashboard, ChevronRight, Building2,
  BarChart3, TrendingUp, Scale, ArrowUpRight, FileSliders, Save, CheckCircle2, Award
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ReferenceLine, Cell 
} from 'recharts';
import { DbController, setStorageItem } from '../db';
import { UserAccount, UserRole, WebAuthnCredential } from '../types';
import { evaluateSubscription, generateActivationCode } from '../subscription';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../db'; // Assuming db is exported from your db setup

interface Props {
  theme: any;
  onNavigateTab?: (tabId: string) => void;
}

export default function AdminDashboardTab({ theme, onNavigateTab }: Props) {
  const [users, setUsers] = useState<UserAccount[]>(() => DbController.getRegisteredUsers());
  const [credentials, setCredentials] = useState<WebAuthnCredential[]>(() => DbController.getWebAuthnCredentials());
  const [loggedInUsers, setLoggedInUsers] = useState<any[]>(() => {
    const reg = DbController.getRegisteredUsers();
    return reg.filter(u => !u.isSuspended).map(u => ({ id: u.uid || u.email, ...u }));
  });
  const [managedSchools, setManagedSchools] = useState<any[]>(() => {
    const currentSchool = DbController.getSchoolInfo();
    const allStudents = DbController.getStudents();
    const allTeachers = DbController.getTeachers();
    return [{
      id: currentSchool.schoolId || currentSchool.id || 'default_school',
      schoolName: currentSchool.name || 'Primary Campus',
      adminEmail: DbController.getCurrentUser()?.email || 'admin@school.com',
      studentCount: allStudents.length,
      teacherCount: allTeachers.length,
      subscriptionTier: 'Licensed'
    }];
  });
  const currentUser = DbController.getCurrentUser();

  // Platform Subscription & License Pricing Adjustment State
  const initialPricing = useMemo(() => DbController.getPlatformPricing(), []);
  const [adminPrice1Y, setAdminPrice1Y] = useState(initialPricing.licensePrice1Year);
  const [adminPrice2Y, setAdminPrice2Y] = useState(initialPricing.licensePrice2Year);
  const [adminPrice3Y, setAdminPrice3Y] = useState(initialPricing.licensePrice3Year);
  const [adminPrice5Y, setAdminPrice5Y] = useState(initialPricing.licensePrice5Year);
  const [adminSmsRate, setAdminSmsRate] = useState(initialPricing.smsRate);
  const [isSavingPricing, setIsSavingPricing] = useState(false);
  const [pricingFeedback, setPricingFeedback] = useState<string | null>(null);

  useEffect(() => {
    const handlePlatformPricingUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      const newPricing = customEvent.detail || DbController.getPlatformPricing();
      setAdminPrice1Y(newPricing.licensePrice1Year);
      setAdminPrice2Y(newPricing.licensePrice2Year);
      setAdminPrice3Y(newPricing.licensePrice3Year);
      setAdminPrice5Y(newPricing.licensePrice5Year);
      setAdminSmsRate(newPricing.smsRate);
    };
    window.addEventListener('platform-pricing-updated', handlePlatformPricingUpdated);
    return () => window.removeEventListener('platform-pricing-updated', handlePlatformPricingUpdated);
  }, []);

  const handleSavePlatformPricing = async () => {
    setIsSavingPricing(true);
    try {
      const updated = {
        licensePrice1Year: adminPrice1Y,
        licensePrice2Year: adminPrice2Y,
        licensePrice3Year: adminPrice3Y,
        licensePrice5Year: adminPrice5Y,
        smsRate: adminSmsRate,
      };
      const saved = await DbController.savePlatformPricing(updated);
      setAdminPrice1Y(saved.licensePrice1Year);
      setAdminPrice2Y(saved.licensePrice2Year);
      setAdminPrice3Y(saved.licensePrice3Year);
      setAdminPrice5Y(saved.licensePrice5Year);
      setAdminSmsRate(saved.smsRate);
      setPricingFeedback("Platform renewal pricing saved to Cloud Firestore and strictly enforced for all user accounts and schools in real time!");
      triggerToast("Subscription renewal pricing updated and enforced for all users!", "success");
      setTimeout(() => setPricingFeedback(null), 5000);
    } catch (err: any) {
      console.error(err);
      triggerToast(err.message || "Failed to update platform pricing.", "error");
    } finally {
      setIsSavingPricing(false);
    }
  };
  useEffect(() => {
    let isMounted = true;
    const fetchAdminData = async () => {
      if (!db) return;
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), 3500)
        );

        const fetchSessions = async () => {
          try {
            const sessionsSnapshot = await getDocs(query(collection(db, 'sessions')));
            if (isMounted && sessionsSnapshot && !sessionsSnapshot.empty) {
              setLoggedInUsers(sessionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            }
          } catch {
            // Keep instant fallback
          }
        };

        const fetchSchools = async () => {
          try {
            const schoolsSnapshot = await getDocs(query(collection(db, 'schools')));
            if (isMounted && schoolsSnapshot && !schoolsSnapshot.empty) {
              setManagedSchools(schoolsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            }
          } catch {
            // Keep instant fallback
          }
        };

        await Promise.race([
          Promise.allSettled([fetchSessions(), fetchSchools()]),
          timeoutPromise
        ]);
      } catch {
        // Timeout gracefully handled
      }
    };
    fetchAdminData();
    return () => { isMounted = false; };
  }, []);

  // Analytics Display Mode
  const [analyticsMetric, setAnalyticsMetric] = useState<'distribution' | 'ratio'>('distribution');

  // Compute school-by-school metrics and overall averages
  const analyticsData = useMemo(() => {
    const currentSchool = DbController.getSchoolInfo();
    const allStudents = DbController.getStudents();
    const allTeachers = DbController.getTeachers();

    let list: Array<{
      id: string;
      name: string;
      students: number;
      teachers: number;
      adminEmail: string;
      subscription: string;
      ratio: number;
    }> = [];

    if (managedSchools && managedSchools.length > 0) {
      list = managedSchools.map(s => {
        const isCurrent = s.id === currentSchool.id || s.id === currentSchool.schoolId;
        const studentCount = Number(s.studentCount ?? (isCurrent ? allStudents.length : 0));
        const teacherCount = Number(s.teacherCount ?? (isCurrent ? allTeachers.length : 0));
        const ratio = teacherCount > 0 ? parseFloat((studentCount / teacherCount).toFixed(1)) : 0;
        return {
          id: s.id,
          name: s.schoolName || s.name || `School ${s.id?.slice(0, 8)}`,
          students: studentCount,
          teachers: teacherCount,
          adminEmail: s.adminEmail || 'N/A',
          subscription: s.subscriptionTier || 'Active',
          ratio
        };
      });
    }

    // Ensure current active school is represented
    const currentId = currentSchool.schoolId || currentSchool.id || 'default_school';
    const hasCurrent = list.some(s => s.id === currentId || s.name === (currentSchool.name || 'Primary Campus'));
    if (!hasCurrent) {
      const studentCount = allStudents.length;
      const teacherCount = allTeachers.length;
      const ratio = teacherCount > 0 ? parseFloat((studentCount / teacherCount).toFixed(1)) : 0;
      list.unshift({
        id: currentId,
        name: currentSchool.name || 'Current School Campus',
        students: studentCount,
        teachers: teacherCount,
        adminEmail: currentUser?.email || 'admin@school.com',
        subscription: 'Licensed',
        ratio
      });
    }

    const totalSchools = list.length;
    const totalStudentsCount = list.reduce((acc, curr) => acc + curr.students, 0);
    const totalTeachersCount = list.reduce((acc, curr) => acc + curr.teachers, 0);

    const avgStudents = totalSchools > 0 ? Math.round(totalStudentsCount / totalSchools) : 0;
    const avgTeachers = totalSchools > 0 ? parseFloat((totalTeachersCount / totalSchools).toFixed(1)) : 0;
    const avgRatio = avgTeachers > 0 ? parseFloat((avgStudents / avgTeachers).toFixed(1)) : 0;

    // Data for BarChart: each school + System Average bar
    const chartData = [
      ...list.map(s => ({
        name: s.name.length > 16 ? s.name.slice(0, 14) + '...' : s.name,
        fullName: s.name,
        students: s.students,
        teachers: s.teachers,
        ratio: s.ratio,
        isAverage: false
      })),
      {
        name: '★ SYSTEM AVG',
        fullName: 'Overall Monitored System Average',
        students: avgStudents,
        teachers: avgTeachers,
        ratio: avgRatio,
        isAverage: true
      }
    ];

    return {
      list,
      chartData,
      totalSchools,
      totalStudentsCount,
      totalTeachersCount,
      avgStudents,
      avgTeachers,
      avgRatio
    };
  }, [managedSchools, currentUser]);
  
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

  // License Authorization & Renewal State
  const [licenseEditModal, setLicenseEditModal] = useState<{
    isOpen: boolean;
    user: UserAccount;
    licenseType: 'unlicensed' | 'activated' | 'unlimited';
    licensePeriod: number;
    lastActivatedOn: string;
  } | null>(null);

  // System Integrity State
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<{
    orphanedAssessments: any[];
    duplicateStudents: any[];
    invalidGrades: any[];
    hasScanned: boolean;
  }>({
    orphanedAssessments: [],
    duplicateStudents: [],
    invalidGrades: [],
    hasScanned: false
  });

  const runIntegrityScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      const allStudents = DbController.getStudents();
      const allAssessments = DbController.getAssessments();
      
      const studentIds = new Set(allStudents.map(s => s.id));
      
      const orphaned = allAssessments.filter(a => !studentIds.has(a.studentId));
      
      const invalid = allAssessments.filter(a => {
        let hasInvalid = false;
        if (a.exercises && a.exercises.some(e => e < 0 || e > 10 || isNaN(e) || e === null)) hasInvalid = true;
        if (a.tests && a.tests.some(t => t < 0 || t > 20 || isNaN(t) || t === null)) hasInvalid = true;
        if (a.projectWork < 0 || a.projectWork > 10 || isNaN(a.projectWork) || a.projectWork === null) hasInvalid = true;
        if (a.groupWork < 0 || a.groupWork > 10 || isNaN(a.groupWork) || a.groupWork === null) hasInvalid = true;
        if (a.examScore100 < 0 || a.examScore100 > 100 || isNaN(a.examScore100) || a.examScore100 === null) hasInvalid = true;
        return hasInvalid;
      });

      const studentIdCounts: Record<string, number> = {};
      allStudents.forEach(s => {
        studentIdCounts[s.id] = (studentIdCounts[s.id] || 0) + 1;
      });
      const dupes = allStudents.filter(s => studentIdCounts[s.id] > 1);
      // To show actual duplicates, maybe we group them
      const actualDupes = dupes.filter((s, idx, self) => self.findIndex(t => t.id === s.id) !== idx);

      setScanResults({
        orphanedAssessments: orphaned,
        invalidGrades: invalid,
        duplicateStudents: actualDupes,
        hasScanned: true
      });
      setIsScanning(false);
      triggerToast('System Integrity Scan Complete', 'success');
    }, 800);
  };

  const handleFixOrphaned = () => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Orphaned Records?",
      message: `Are you sure you want to delete ${scanResults.orphanedAssessments.length} orphaned assessments? These records belong to students no longer in the directory.`,
      confirmText: "Delete Records",
      danger: true,
      onConfirm: () => {
        const allAssessments = DbController.getAssessments();
        const studentIds = new Set(DbController.getStudents().map(s => s.id));
        const validAssessments = allAssessments.filter(a => studentIds.has(a.studentId));
        DbController.saveAllAssessments(validAssessments);
        
        setScanResults(prev => ({ ...prev, orphanedAssessments: [] }));
        triggerToast('Orphaned assessments deleted.', 'success');
      }
    });
  };

  const handleFixInvalid = () => {
    setConfirmModal({
      isOpen: true,
      title: "Reset Invalid Grades?",
      message: `Are you sure you want to reset ${scanResults.invalidGrades.length} invalid grade records to zero? This fixes out-of-bounds or NaN values.`,
      confirmText: "Reset Grades",
      danger: true,
      onConfirm: () => {
        const allAssessments = DbController.getAssessments();
        const invalidIds = new Set(scanResults.invalidGrades.map(a => a.id));
        
        const fixed = allAssessments.map(a => {
          if (invalidIds.has(a.id)) {
             return DbController.calculateScoreDetails({
               ...a,
               exercises: a.exercises ? a.exercises.map(e => e < 0 || e > 10 || isNaN(e) || e === null ? 0 : e) : [0,0,0,0],
               tests: a.tests ? a.tests.map(t => t < 0 || t > 20 || isNaN(t) || t === null ? 0 : t) : [0,0],
               projectWork: a.projectWork < 0 || a.projectWork > 10 || isNaN(a.projectWork) || a.projectWork === null ? 0 : a.projectWork,
               groupWork: a.groupWork < 0 || a.groupWork > 10 || isNaN(a.groupWork) || a.groupWork === null ? 0 : a.groupWork,
               examScore100: a.examScore100 < 0 || a.examScore100 > 100 || isNaN(a.examScore100) || a.examScore100 === null ? 0 : a.examScore100,
             });
          }
          return a;
        });
        DbController.saveAllAssessments(fixed);
        
        setScanResults(prev => ({ ...prev, invalidGrades: [] }));
        triggerToast('Invalid grades reset.', 'success');
      }
    });
  };

  const handleFixDuplicates = () => {
    setConfirmModal({
      isOpen: true,
      title: "Remove Duplicate Students?",
      message: `Are you sure you want to remove ${scanResults.duplicateStudents.length} duplicate student records? This will keep only the first occurrence of each unique ID.`,
      confirmText: "Remove Duplicates",
      danger: true,
      onConfirm: () => {
        const allStudents = DbController.getStudents();
        const seen = new Set();
        const deduplicated = allStudents.filter(s => {
          if (seen.has(s.id)) return false;
          seen.add(s.id);
          return true;
        });
        DbController.saveAllStudents(deduplicated);
        
        setScanResults(prev => ({ ...prev, duplicateStudents: [] }));
        triggerToast('Duplicate students removed.', 'success');
      }
    });
  };

  const handleFixAll = () => {
    const totalIssues = scanResults.orphanedAssessments.length + scanResults.invalidGrades.length + scanResults.duplicateStudents.length;
    if (totalIssues === 0) return;
    
    setConfirmModal({
      isOpen: true,
      title: "Fix All Issues?",
      message: `Are you sure you want to automatically resolve all ${totalIssues} identified issues across orphans, duplicates, and invalid records? This action cannot be undone.`,
      confirmText: "Fix All",
      danger: true,
      onConfirm: () => {
        // Fix Duplicates
        if (scanResults.duplicateStudents.length > 0) {
          const allStudents = DbController.getStudents();
          const seen = new Set();
          const deduplicated = allStudents.filter(s => {
            if (seen.has(s.id)) return false;
            seen.add(s.id);
            return true;
          });
          DbController.saveAllStudents(deduplicated);
        }

        // Fix Invalid Grades & Orphaned
        let allAssessments = DbController.getAssessments();
        const studentIds = new Set(DbController.getStudents().map(s => s.id));
        
        // Remove orphans
        if (scanResults.orphanedAssessments.length > 0) {
          allAssessments = allAssessments.filter(a => studentIds.has(a.studentId));
        }
        
        // Fix Invalid
        if (scanResults.invalidGrades.length > 0) {
          const invalidIds = new Set(scanResults.invalidGrades.map(a => a.id));
          allAssessments = allAssessments.map(a => {
            if (invalidIds.has(a.id)) {
               return DbController.calculateScoreDetails({
                 ...a,
                 exercises: a.exercises ? a.exercises.map(e => e < 0 || e > 10 || isNaN(e) || e === null ? 0 : e) : [0,0,0,0],
                 tests: a.tests ? a.tests.map(t => t < 0 || t > 20 || isNaN(t) || t === null ? 0 : t) : [0,0],
                 projectWork: a.projectWork < 0 || a.projectWork > 10 || isNaN(a.projectWork) || a.projectWork === null ? 0 : a.projectWork,
                 groupWork: a.groupWork < 0 || a.groupWork > 10 || isNaN(a.groupWork) || a.groupWork === null ? 0 : a.groupWork,
                 examScore100: a.examScore100 < 0 || a.examScore100 > 100 || isNaN(a.examScore100) || a.examScore100 === null ? 0 : a.examScore100,
               });
            }
            return a;
          });
        }
        
        DbController.saveAllAssessments(allAssessments);
        
        setScanResults(prev => ({ ...prev, duplicateStudents: [], orphanedAssessments: [], invalidGrades: [] }));
        triggerToast('All system issues resolved.', 'success');
      }
    });
  };

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');

  // Add user form state
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('Headteacher');
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastCreatedOperator, setLastCreatedOperator] = useState<{ name: string; email: string; schoolId?: string } | null>(null);

  const triggerToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    window.dispatchEvent(new CustomEvent('app-toast', {
      detail: { text, type }
    }));
  };

  const handleAddUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newName) {
      triggerToast('Please fill in both name and email.', 'error');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      triggerToast('Please provide a valid email address.', 'error');
      return;
    }

    const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*.,])[a-zA-Z0-9!@#$%^&*.,]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      triggerToast('Password must be at least 8 characters long, include numbers and special characters.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const emailLower = newEmail.toLowerCase().trim();
      const existing = users.find(u => u.email.toLowerCase() === emailLower);
      if (existing) {
        triggerToast('A user with this email address already exists.', 'error');
        setIsSubmitting(false);
        return;
      }

      // Add user to DB list
      const addedUser = DbController.register(newName.trim(), emailLower, newRole);
      
      // Update local state
      const updatedList = DbController.getRegisteredUsers();
      setUsers(updatedList);
      
      // Save for UI display
      setLastCreatedOperator({
        name: addedUser.name,
        email: addedUser.email,
        schoolId: addedUser.schoolId
      });
      
      // Reset form
      setNewEmail('');
      setNewName('');
      setNewRole('Headteacher');
      
      const successMessage = addedUser.schoolId 
        ? `Account created! School ID for ${addedUser.name} is ${addedUser.schoolId}`
        : `Account created successfully for ${addedUser.name}!`;

      triggerToast(successMessage, 'success');
      
      // Write action audit log
      DbController.writeActivityLog(
        'User Registered',
        `Admin created new account for ${addedUser.name} (${addedUser.email}) with role ${addedUser.role}`,
        'medium'
      );
    } catch (err: any) {
      triggerToast(err.message || 'Error registering user.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleToggle = (user: UserAccount, targetRole: UserRole) => {
    if (user.email.toLowerCase() === currentUser?.email.toLowerCase()) {
      triggerToast('You cannot modify your own administrative role.', 'error');
      return;
    }

    try {
      const allUsers = DbController.getRegisteredUsers();
      const match = allUsers.find(u => u.uid === user.uid);
      if (match) {
        match.role = targetRole;
        DbController.saveRegisteredUsers(allUsers);
        setUsers(allUsers);
        triggerToast(`Role for ${user.name} updated to ${targetRole}.`, 'success');
        
        DbController.writeActivityLog(
          'Role Modified',
          `Admin changed role of ${user.name} to ${targetRole}`,
          'medium'
        );
      }
    } catch (err) {
      triggerToast('Failed to update role.', 'error');
    }
  };

  const handleRevokeUser = (user: UserAccount) => {
    if (user.uid === currentUser?.uid) {
      triggerToast('Security Lock: You are logged in and cannot revoke your own administrative account.', 'error');
      return;
    }

    const subStatus = evaluateSubscription(user);
    const isPaid = subStatus?.licenseType === 'activated';
    
    let confirmMsg = `Are you sure you want to revoke sign-in authority and completely delete the account for ${user.name} (${user.email})?`;
    if (isPaid) {
      confirmMsg = `CRITICAL WARNING: ${user.name} is a PAID SUBSCRIBER. Deleting this account will permanently revoke their access. Money is NOT refundable after license renewal. Proceed with PERMANENT deletion?`;
    }

    setConfirmModal({
      isOpen: true,
      title: isPaid ? "CRITICAL: Delete Paid Client?" : "Revoke Client Access?",
      message: confirmMsg,
      confirmText: "Revoke Access",
      cancelText: "Keep Client",
      danger: true,
      onConfirm: async () => {
        try {
          // Properly delete the user locally & on Firestore
          await DbController.deleteRegisteredUser(user.uid);
          
          // Retrieve the updated users list
          const updatedUsers = DbController.getRegisteredUsers();
          setUsers(updatedUsers);

          // Also clean up WebAuthn biometrics mapping to this email
          const creds = DbController.getWebAuthnCredentials();
          const remainingCreds = creds.filter(c => c.userEmail.toLowerCase() !== user.email.toLowerCase());
          setStorageItem('sms_webauthn_credentials', remainingCreds);
          setCredentials(remainingCreds);

          triggerToast(`Sign-in authority revoked for ${user.name}.`, 'success');

          DbController.writeActivityLog(
            'Account Revoked',
            `Admin deleted sign-in authority for ${user.name} (${user.email})`,
            'high'
          );
        } catch (err) {
          triggerToast('Failed to revoke access.', 'error');
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  const handleResetPassword = (email: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Send Reset Link?",
      message: `Send a password reset email to ${email}? The user will receive instructions to securely update their credentials.`,
      confirmText: "Send Link",
      onConfirm: async () => {
        try {
          await DbController.firebaseSendPasswordResetEmail(email);
          triggerToast(`Password reset link sent to ${email}.`, 'success');
          DbController.writeActivityLog('Password Reset Sent', `Admin triggered password reset for ${email}`, 'medium');
        } catch (err: any) {
          triggerToast(err.message || 'Error sending reset email.', 'error');
        }
      }
    });
  };

  const handleSaveUserLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseEditModal || !licenseEditModal.user) return;
    
    try {
      const { user, licenseType, licensePeriod, lastActivatedOn } = licenseEditModal;
      const sub = evaluateSubscription(user);
      const reqCode = sub?.requestCode || user.requestCode || `REQ-${user.email.split('@')[0].substring(0, 4).toUpperCase()}-9401`;
      const generatedCode = generateActivationCode(user.email, reqCode);
      
      // Record code as used
      DbController.recordUsedCode(generatedCode, user.email);
      // Generate rotated request code for next time
      const emailPrefix = user.email ? user.email.split('@')[0].substring(0, 4).toUpperCase() : 'USER';
      const freshReqCode = `REQ-${emailPrefix}-${Math.floor(1000 + Math.random() * 9000)}`;

      await DbController.updateUserLicense(
        user.uid,
        licenseType,
        lastActivatedOn,
        generatedCode,
        freshReqCode,
        licensePeriod
      );
      
      const updatedUsers = DbController.getRegisteredUsers();
      setUsers(updatedUsers);
      
      triggerToast(`License for ${user.name} successfully updated & synced across devices!`, 'success');
      
      DbController.writeActivityLog(
        'License Authorized',
        `Admin authorized ${licenseType} license (${licensePeriod} year(s)) for ${user.name} starting on ${new Date(lastActivatedOn).toLocaleDateString()}`,
        'high'
      );
      
      setLicenseEditModal(null);
    } catch (err: any) {
      console.error(err);
      triggerToast(err.message || 'Failed to authorize license.', 'error');
    }
  };

  const handleToggleSuspendUser = (targetUser: UserAccount) => {
    if (targetUser.email.toLowerCase().trim() === 'pegyirenyi@gmail.com') {
      triggerToast('System Admin cannot be suspended.', 'error');
      return;
    }
    const newSuspended = !targetUser.isSuspended;
    DbController.updateUserAccount(targetUser.uid, {
      isSuspended: newSuspended,
      licenseType: newSuspended ? 'unlicensed' : targetUser.licenseType
    });
    setUsers(DbController.getRegisteredUsers());
    triggerToast(
      newSuspended ? `Suspended and locked ${targetUser.name}` : `Unsuspended ${targetUser.name}`,
      newSuspended ? 'info' : 'success'
    );
  };

  const handleSuspendAllNonAdmins = () => {
    setConfirmModal({
      isOpen: true,
      title: "Suspend & Expire All Non-Admins?",
      message: "Are you sure you want to suspend and expire all users in the system except the Admin (pegyirenyi@gmail.com)? They will be locked out until given a new single-use activation passcode.",
      confirmText: "Suspend All Non-Admins",
      danger: true,
      onConfirm: () => {
        const allUsers = DbController.getRegisteredUsers();
        let suspendedCount = 0;
        const expiredDate = '2026-01-01T00:00:00.000Z';

        const updatedList = allUsers.map(u => {
          if (u.email.toLowerCase().trim() === 'pegyirenyi@gmail.com') {
            return u;
          }
          suspendedCount++;
          return {
            ...u,
            isSuspended: true,
            licenseType: 'unlicensed' as const,
            registeredOn: expiredDate,
            createdAt: expiredDate
          };
        });

        setStorageItem('sms_users_list', updatedList);
        DbController.saveRegisteredUsers(updatedList).catch(e => console.warn(e));
        setUsers(updatedList);
        triggerToast(`Successfully suspended and expired ${suspendedCount} non-admin user(s).`, 'info');
        
        DbController.writeActivityLog(
          'Mass Suspension Triggered',
          `Admin suspended and expired all non-admin users in the system (${suspendedCount} users).`,
          'high'
        );
      }
    });
  };

  const handleRevokeCredential = (credId: string, email: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Revoke Security Key?",
      message: "Are you sure you want to revoke this device credential security key? The user will have to enroll biometrics again on next sign-in.",
      confirmText: "Revoke Key",
      danger: true,
      onConfirm: () => {
        try {
          DbController.deleteWebAuthnCredential(credId);
          const remaining = DbController.getWebAuthnCredentials();
          setCredentials(remaining);
          triggerToast('Biometric security key revoked successfully.', 'success');

          DbController.writeActivityLog(
            'Biometrics Deleted',
            `Admin revoked device biometric token key for ${email}`,
            'high'
          );
        } catch (err) {
          triggerToast('Failed to revoke security token.', 'error');
        }
      }
    });
  };

  // Optimized Memoized Filter list
  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query && roleFilter === 'All') return users;
    return users.filter(user => {
      const matchesSearch = !query ||
        user.name.toLowerCase().includes(query) || 
        user.email.toLowerCase().includes(query) ||
        (user.requestCode && user.requestCode.toLowerCase().includes(query));
      
      const matchesRole = roleFilter === 'All' || user.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  const { totalAdmins, totalHeadteachers, totalTeachers } = useMemo(() => {
    let admins = 0;
    let headteachers = 0;
    let teachers = 0;
    for (let i = 0; i < users.length; i++) {
      const r = users[i].role;
      if (r === 'Admin') admins++;
      else if (r === 'Headteacher') headteachers++;
      else if (r === 'Teacher') teachers++;
    }
    return { totalAdmins: admins, totalHeadteachers: headteachers, totalTeachers: teachers };
  }, [users]);

  return (
    <div className="space-y-6">
      
      {/* HEADER SECTION */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="bg-red-500 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full text-white flex items-center gap-1 animate-pulse">
                <Shield size={11} /> Admin Lock Restricted
              </span>
            </div>
            <h1 className="text-xl lg:text-2xl font-black tracking-tight mt-1">Administrative Security Control</h1>
            <p className="text-xs text-slate-300 max-w-xl">
              Add new system operators, regulate account roles, and manage biometric key chains.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSuspendAllNonAdmins}
              className="bg-rose-600/90 hover:bg-rose-600 text-white border border-rose-500/30 rounded-2xl px-3.5 py-2.5 text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer"
              title="Suspend & expire all users except pegyirenyi@gmail.com"
            >
              <UserX size={14} /> Suspend All Non-Admins
            </button>
            <button
              onClick={() => {
                setUsers(DbController.getRegisteredUsers());
                setCredentials(DbController.getWebAuthnCredentials());
                triggerToast('Reloaded user registry database state.', 'info');
              }}
              className="bg-white/10 hover:bg-white/15 text-white border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs font-bold transition flex items-center gap-2"
            >
              <RefreshCw size={14} /> Refresh State
            </button>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
      </div>

      {/* STATS SUMMARY GRID */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div className="bg-white border border-slate-200/60 p-4.5 rounded-2xl flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-700">
            <Users size={18} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono font-black text-slate-400 block tracking-wider">Total Operators</span>
            <span className="text-lg font-black text-slate-800">{users.length}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/60 p-4.5 rounded-2xl flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100 text-indigo-600">
            <Shield size={18} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono font-black text-slate-400 block tracking-wider">Admins</span>
            <span className="text-lg font-black text-indigo-700">{totalAdmins}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/60 p-4.5 rounded-2xl flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100 text-emerald-600">
            <Activity size={18} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono font-black text-slate-400 block tracking-wider">Logged In Users</span>
            <span className="text-lg font-black text-emerald-700">{loggedInUsers.length}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/60 p-4.5 rounded-2xl flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100 text-emerald-600">
            <UserCheck size={18} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono font-black text-slate-400 block tracking-wider">Headteachers / Teachers</span>
            <span className="text-lg font-black text-slate-800">{totalHeadteachers} / {totalTeachers}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/60 p-4.5 rounded-2xl flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center border border-amber-100 text-amber-600">
            <Smartphone size={18} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono font-black text-slate-400 block tracking-wider">Biometrics Enrolled</span>
            <span className="text-lg font-black text-amber-700">{credentials.length} device keys</span>
          </div>
        </div>
      </div>

      {/* PLATFORM SUBSCRIPTION PRICING ADJUSTMENT DECK */}
      <div className="bg-white p-6 rounded-3xl border border-indigo-100 shadow-md space-y-6">
        <div className="flex items-center justify-between border-b border-slate-150 pb-4 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 border border-indigo-150 text-indigo-700 rounded-2xl shadow-xs">
              <FileSliders size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 tracking-tight font-sans flex items-center gap-2">
                Platform Subscription Pricing & Renewal Deck
                <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Cloud Firestore Real-Time
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-sans mt-0.5 leading-relaxed">
                Adjust system-wide subscription pricing tiers. Changes are stored in Firebase Cloud Firestore and immediately reflect on all Headteachers' and users' accounts in real time.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSavePlatformPricing}
            disabled={isSavingPricing}
            className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-750 hover:from-indigo-650 hover:to-indigo-800 text-white font-bold rounded-xl text-[11px] uppercase tracking-wider flex items-center gap-1.5 shadow-md hover:shadow-lg transition active:translate-y-0.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
          >
            <Save size={14} />
            {isSavingPricing ? 'Syncing to Firestore...' : 'Save & Sync to All Headteachers'}
          </button>
        </div>

        {pricingFeedback && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2.5 animate-fadeIn shadow-xs">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span>{pricingFeedback}</span>
          </div>
        )}

        {/* 5-Card Grid for Pricing Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          
          {/* 1-Year Tier */}
          <div className="bg-slate-50/70 p-4.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-3 hover:border-indigo-300 transition-all">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] bg-slate-200/70 text-slate-700 font-black px-2 py-0.5 rounded-md uppercase font-mono tracking-wider">
                  1 Year
                </span>
                <Shield size={13} className="text-slate-400" />
              </div>
              <h4 className="font-bold text-slate-800 text-xs">Standard License</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Benchmark annual renewal price</p>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-black text-slate-400 font-mono">GHS</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={adminPrice1Y}
                  onChange={(e) => setAdminPrice1Y(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full text-xs pl-12 pr-3 py-2 border border-slate-200 rounded-xl bg-white font-black font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                />
              </div>
              <div className="flex gap-1 justify-center">
                <button type="button" onClick={() => setAdminPrice1Y(Math.max(1, adminPrice1Y - 50))} className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-[9px] font-mono font-bold text-slate-500 border border-slate-200 rounded transition">-50</button>
                <button type="button" onClick={() => setAdminPrice1Y(Math.max(1, adminPrice1Y - 10))} className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-[9px] font-mono font-bold text-slate-500 border border-slate-200 rounded transition">-10</button>
                <button type="button" onClick={() => setAdminPrice1Y(adminPrice1Y + 10)} className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-[9px] font-mono font-bold text-slate-500 border border-slate-200 rounded transition">+10</button>
                <button type="button" onClick={() => setAdminPrice1Y(adminPrice1Y + 50)} className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-[9px] font-mono font-bold text-slate-500 border border-slate-200 rounded transition">+50</button>
              </div>
              <div className="border-t border-slate-200/60 pt-2 text-[10px] flex justify-between text-slate-500">
                <span>Annual:</span>
                <strong className="text-slate-800 font-mono">GHS {adminPrice1Y.toFixed(2)}</strong>
              </div>
            </div>
          </div>

          {/* 2-Year Tier */}
          <div className="bg-slate-50/70 p-4.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-3 hover:border-indigo-300 transition-all">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] bg-indigo-100 text-indigo-700 font-black px-2 py-0.5 rounded-md uppercase font-mono tracking-wider">
                  2 Years
                </span>
                <Coins size={13} className="text-indigo-500" />
              </div>
              <h4 className="font-bold text-slate-800 text-xs">Multi-Year Pack</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">2-Year upfront license</p>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-black text-slate-400 font-mono">GHS</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={adminPrice2Y}
                  onChange={(e) => setAdminPrice2Y(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full text-xs pl-12 pr-3 py-2 border border-slate-200 rounded-xl bg-white font-black font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                />
              </div>
              <div className="flex gap-1 justify-center">
                <button type="button" onClick={() => setAdminPrice2Y(Math.max(1, adminPrice2Y - 50))} className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-[9px] font-mono font-bold text-slate-500 border border-slate-200 rounded transition">-50</button>
                <button type="button" onClick={() => setAdminPrice2Y(Math.max(1, adminPrice2Y - 10))} className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-[9px] font-mono font-bold text-slate-500 border border-slate-200 rounded transition">-10</button>
                <button type="button" onClick={() => setAdminPrice2Y(adminPrice2Y + 10)} className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-[9px] font-mono font-bold text-slate-500 border border-slate-200 rounded transition">+10</button>
                <button type="button" onClick={() => setAdminPrice2Y(adminPrice2Y + 50)} className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-[9px] font-mono font-bold text-slate-500 border border-slate-200 rounded transition">+50</button>
              </div>
              <div className="border-t border-slate-200/60 pt-2 text-[10px] flex justify-between text-slate-500">
                <span>Annual Rate:</span>
                <strong className="text-slate-800 font-mono">GHS {(adminPrice2Y / 2).toFixed(2)}/yr</strong>
              </div>
            </div>
          </div>

          {/* 3-Year Tier */}
          <div className="bg-slate-50/70 p-4.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-3 hover:border-indigo-300 transition-all">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] bg-blue-100 text-blue-700 font-black px-2 py-0.5 rounded-md uppercase font-mono tracking-wider">
                  3 Years
                </span>
                <Award size={13} className="text-blue-500" />
              </div>
              <h4 className="font-bold text-slate-800 text-xs">Strategic Tier</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Recommended 3-Year license</p>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-black text-slate-400 font-mono">GHS</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={adminPrice3Y}
                  onChange={(e) => setAdminPrice3Y(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full text-xs pl-12 pr-3 py-2 border border-slate-200 rounded-xl bg-white font-black font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                />
              </div>
              <div className="flex gap-1 justify-center">
                <button type="button" onClick={() => setAdminPrice3Y(Math.max(1, adminPrice3Y - 50))} className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-[9px] font-mono font-bold text-slate-500 border border-slate-200 rounded transition">-50</button>
                <button type="button" onClick={() => setAdminPrice3Y(Math.max(1, adminPrice3Y - 10))} className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-[9px] font-mono font-bold text-slate-500 border border-slate-200 rounded transition">-10</button>
                <button type="button" onClick={() => setAdminPrice3Y(adminPrice3Y + 10)} className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-[9px] font-mono font-bold text-slate-500 border border-slate-200 rounded transition">+10</button>
                <button type="button" onClick={() => setAdminPrice3Y(adminPrice3Y + 50)} className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-[9px] font-mono font-bold text-slate-500 border border-slate-200 rounded transition">+50</button>
              </div>
              <div className="border-t border-slate-200/60 pt-2 text-[10px] flex justify-between text-slate-500">
                <span>Annual Rate:</span>
                <strong className="text-slate-800 font-mono">GHS {(adminPrice3Y / 3).toFixed(2)}/yr</strong>
              </div>
            </div>
          </div>

          {/* 5-Year Tier */}
          <div className="bg-slate-50/70 p-4.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-3 hover:border-indigo-300 transition-all">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] bg-purple-100 text-purple-700 font-black px-2 py-0.5 rounded-md uppercase font-mono tracking-wider">
                  5 Years
                </span>
                <Award size={13} className="text-purple-500" />
              </div>
              <h4 className="font-bold text-slate-800 text-xs">Enterprise Key</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Maximum savings long-term</p>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-black text-slate-400 font-mono">GHS</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={adminPrice5Y}
                  onChange={(e) => setAdminPrice5Y(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full text-xs pl-12 pr-3 py-2 border border-slate-200 rounded-xl bg-white font-black font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                />
              </div>
              <div className="flex gap-1 justify-center">
                <button type="button" onClick={() => setAdminPrice5Y(Math.max(1, adminPrice5Y - 100))} className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-[9px] font-mono font-bold text-slate-500 border border-slate-200 rounded transition">-100</button>
                <button type="button" onClick={() => setAdminPrice5Y(Math.max(1, adminPrice5Y - 50))} className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-[9px] font-mono font-bold text-slate-500 border border-slate-200 rounded transition">-50</button>
                <button type="button" onClick={() => setAdminPrice5Y(adminPrice5Y + 50)} className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-[9px] font-mono font-bold text-slate-500 border border-slate-200 rounded transition">+50</button>
                <button type="button" onClick={() => setAdminPrice5Y(adminPrice5Y + 100)} className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-[9px] font-mono font-bold text-slate-500 border border-slate-200 rounded transition">+100</button>
              </div>
              <div className="border-t border-slate-200/60 pt-2 text-[10px] flex justify-between text-slate-500">
                <span>Annual Rate:</span>
                <strong className="text-slate-800 font-mono">GHS {(adminPrice5Y / 5).toFixed(2)}/yr</strong>
              </div>
            </div>
          </div>

          {/* SMS Carrier Rate */}
          <div className="bg-slate-50/70 p-4.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-3 hover:border-indigo-300 transition-all">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] bg-emerald-100 text-emerald-700 font-black px-2 py-0.5 rounded-md uppercase font-mono tracking-wider">
                  SMS Carrier
                </span>
                <Smartphone size={13} className="text-emerald-500" />
              </div>
              <h4 className="font-bold text-slate-800 text-xs">SMS Credits / GHS</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Carrier exchange multiplier</p>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={adminSmsRate}
                  onChange={(e) => setAdminSmsRate(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl bg-white font-black font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                />
              </div>
              <div className="flex gap-1 justify-center">
                <button type="button" onClick={() => setAdminSmsRate(Math.max(1, adminSmsRate - 5))} className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-[9px] font-mono font-bold text-slate-500 border border-slate-200 rounded transition">-5</button>
                <button type="button" onClick={() => setAdminSmsRate(Math.max(1, adminSmsRate - 1))} className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-[9px] font-mono font-bold text-slate-500 border border-slate-200 rounded transition">-1</button>
                <button type="button" onClick={() => setAdminSmsRate(adminSmsRate + 1)} className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-[9px] font-mono font-bold text-slate-500 border border-slate-200 rounded transition">+1</button>
                <button type="button" onClick={() => setAdminSmsRate(adminSmsRate + 5)} className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-[9px] font-mono font-bold text-slate-500 border border-slate-200 rounded transition">+5</button>
              </div>
              <div className="border-t border-slate-200/60 pt-2 text-[10px] flex justify-between text-slate-500">
                <span>Exchange:</span>
                <strong className="text-slate-800 font-mono">1 GHS = {adminSmsRate} SMS</strong>
              </div>
            </div>
          </div>

        </div>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ADD NEW OPERATOR FORM */}
        <div className="bg-white border border-slate-200/60 p-5 rounded-3xl space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <UserPlus size={16} className="text-slate-600" />
              Register New Operator
            </h2>
            <p className="text-[11px] text-slate-400 mt-1">
              Manually add a client/employee to bypass standard automated role allocation on their next sign-in.
            </p>
          </div>

          {lastCreatedOperator && (
            <div className="bg-indigo-50 border border-indigo-150 p-4 rounded-2xl text-[11px] space-y-2.5 relative">
              <button 
                type="button"
                onClick={() => setLastCreatedOperator(null)}
                className="absolute top-2.5 right-2.5 text-slate-400 hover:text-slate-600 font-bold"
                title="Dismiss"
              >
                ✕
              </button>
              <div className="font-extrabold text-indigo-950 flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-500" />
                Operator Authorized!
              </div>
              <div className="space-y-1 text-slate-700">
                <div><span className="font-bold text-slate-500">Name:</span> {lastCreatedOperator.name}</div>
                <div><span className="font-bold text-slate-500">HeadTeacher's Email:</span> <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-indigo-100/50">{lastCreatedOperator.email}</span></div>
                {lastCreatedOperator.schoolId && (
                  <div className="bg-white border border-indigo-150 p-2.5 rounded-xl mt-1.5 text-center shadow-xs">
                    <div className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">Generated School ID</div>
                    <div className="text-base font-black text-indigo-600 font-mono tracking-wider select-all select-text">{lastCreatedOperator.schoolId}</div>
                    <div className="text-[9px] text-slate-500 mt-1 leading-tight">Copy this School ID to give to assign teacher profiles.</div>
                  </div>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleAddUserSubmit} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Full Name</label>
              <input
                type="text"
                placeholder="e.g. EBENEZER GYAN"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full border border-slate-200 bg-slate-50/50 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-800 focus:outline-none transition"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">HeadTeacher's Email Address</label>
              <input
                type="email"
                placeholder="e.g. gyan@school.edu"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full border border-slate-200 bg-slate-50/50 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-800 focus:outline-none transition"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Assign Role (Head Teacher)</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="w-full border border-slate-200 bg-slate-50/50 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-slate-800 focus:outline-none transition"
              >
                <option value="Headteacher">Head Teacher (Standard Executive Access)</option>
                <option value="Admin" disabled={newEmail.toLowerCase().trim() !== 'pegyirenyi@gmail.com'}>System Administrator (Emergency Only)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Initial Password</label>
              <input
                type="password"
                placeholder="Min 8 chars, 1 number, 1 special char"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-slate-200 bg-slate-50/50 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-800 focus:outline-none transition"
                required
              />
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-[10px] text-blue-700 flex gap-2">
              <Info size={14} className="shrink-0 mt-0.5 text-blue-500" />
              <div>
                Once registered, they can immediately log in with their email. The system will load their predefined role settings automatically.
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold rounded-xl py-2.5 text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <UserPlus size={14} />
              {isSubmitting ? 'Registering Operator...' : 'Authorize Operator'}
            </button>
          </form>
        </div>

        {/* REGULATE OPERATORS DIRECTORY */}
        <div className="bg-white border border-slate-200/60 p-5 rounded-3xl lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-2">
            <div>
              <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Lock size={16} className="text-red-500" />
                Regulate Operators Directory
              </h2>
              <p className="text-[11px] text-slate-400 mt-1">
                View, modify permissions, or revoke system login keys.
              </p>
            </div>
          </div>

          {/* SEARCH & FILTERS */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search operators by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-1.5 text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-800"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="All">All Roles</option>
              <option value="Admin">Admin</option>
              <option value="Headteacher">Headteacher</option>
              <option value="Teacher">Teacher</option>
            </select>
          </div>

           {/* OPERATORS TABLE */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                  <th className="py-2.5 px-3">Operator Name & ID</th>
                  <th className="py-2.5 px-3">Access Level</th>
                  <th className="py-2.5 px-3">Registered On</th>
                  <th className="py-2.5 px-3">Renewal License status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 text-[11px] italic">
                      No matching registered system operators found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const isSelf = user.uid === currentUser?.uid;
                    const subStatus = evaluateSubscription(user);
                    return (
                      <tr key={user.uid} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                        <td className="py-3 px-3">
                          <div className="font-extrabold text-slate-800 flex items-center gap-1.5">
                            {user.name} 
                            {isSelf && <span className="bg-red-100 text-red-700 text-[9px] font-black uppercase px-1.5 py-0.5 rounded">You</span>}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{user.email}</div>
                          {user.schoolId && (
                            <div className="text-[10px] text-indigo-600 font-black font-mono">School ID: {user.schoolId}</div>
                          )}
                          {user.requestCode && (
                            <div className="text-[9px] text-slate-400 font-mono">ID Code: {user.requestCode}</div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <select
                             value={user.role}
                            disabled={isSelf}
                            onChange={(e) => handleRoleToggle(user, e.target.value as UserRole)}
                            className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border border-slate-200/60 bg-white ${
                              user.role === 'Admin' 
                                ? 'text-indigo-600 font-black' 
                                : user.role === 'Teacher' 
                                  ? 'text-emerald-600 font-black' 
                                  : 'text-slate-700 font-black'
                            }`}
                          >
                            <option value="Admin" disabled={user.email.toLowerCase().trim() !== 'pegyirenyi@gmail.com'}>Admin</option>
                            <option value="Headteacher">Headteacher</option>
                            <option value="Teacher">Teacher</option>
                          </select>
                        </td>
                        <td className="py-3 px-3 text-slate-400 font-mono text-[10px]">
                          {user.registeredOn ? new Date(user.registeredOn).toLocaleDateString() : 'Initial Setup'}
                        </td>
                        <td className="py-3 px-3">
                          {subStatus ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${subStatus.isLocked ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                                <span className={`text-[10px] font-black uppercase tracking-wider ${subStatus.isLocked ? 'text-rose-600' : 'text-slate-800'}`}>
                                  {subStatus.licenseType === 'unlimited' ? 'Unlimited' : subStatus.licenseType === 'activated' ? `${user.licensePeriod || 1}-Yr Subscription` : 'Unlicensed / Expired'}
                                </span>
                              </div>
                              <div className="text-[10px] font-mono">
                                {subStatus.isLocked ? (
                                  <span className="text-rose-600 font-extrabold bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded inline-block">
                                    {user.isSuspended ? 'Suspended' : 'Expired / Locked'}
                                  </span>
                                ) : (
                                  <div className="space-y-0.5">
                                    <span className={`font-mono font-black px-2 py-0.5 rounded border text-[10px] inline-block shadow-2xs ${
                                      subStatus.remainingDays <= 30 
                                        ? 'bg-amber-50 text-amber-700 border-amber-200/90 animate-pulse' 
                                        : 'bg-emerald-50 text-emerald-800 border-emerald-200/90'
                                    }`}>
                                      ⏱️ {subStatus.countdownString}
                                    </span>
                                    {subStatus.lastActivatedOnDate && (
                                      <div className="text-[9px] text-slate-400 font-sans">
                                        Activated: {subStatus.lastActivatedOnDate.toLocaleDateString()}
                                      </div>
                                    )}
                                    <div className="text-[9px] text-slate-400 font-sans">
                                      Expires: {subStatus.expiryDate.toLocaleDateString()}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                const sub = evaluateSubscription(user);
                                setLicenseEditModal({
                                  isOpen: true,
                                  user,
                                  licenseType: (sub?.licenseType as any) || 'unlicensed',
                                  licensePeriod: user.licensePeriod || 1,
                                  lastActivatedOn: user.lastActivatedOn || new Date().toISOString()
                                });
                              }}
                              title="Authorize / Renew School Database License"
                              className="p-1.5 rounded-lg border border-amber-100 hover:border-amber-200 text-amber-550 hover:bg-amber-50 cursor-pointer"
                            >
                              <CalendarClock size={13} />
                            </button>
                            <button
                              onClick={() => handleResetPassword(user.email)}
                              title="Send Password Reset Email"
                              className="p-1.5 rounded-lg border border-indigo-100 hover:border-indigo-200 text-indigo-500 hover:bg-indigo-50 cursor-pointer"
                            >
                              <Key size={13} />
                            </button>
                            <button
                              onClick={() => handleToggleSuspendUser(user)}
                              disabled={isSelf}
                              title={isSelf ? "Cannot suspend system admin" : user.isSuspended ? "Unsuspend account" : "Suspend & expire account"}
                              className={`p-1.5 rounded-lg border transition ${
                                isSelf 
                                  ? 'border-slate-100 text-slate-300 bg-slate-50 cursor-not-allowed' 
                                  : user.isSuspended 
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 cursor-pointer' 
                                    : 'border-orange-200 text-orange-600 hover:bg-orange-50 cursor-pointer'
                              }`}
                            >
                              <UserX size={13} />
                            </button>
                            <button
                              onClick={() => handleRevokeUser(user)}
                              disabled={isSelf}
                              title={isSelf ? "Cannot revoke your own active login key" : "Revoke access rights"}
                              className={`p-1.5 rounded-lg border transition ${
                                isSelf 
                                  ? 'border-slate-100 text-slate-300 bg-slate-50 cursor-not-allowed' 
                                  : 'border-red-100 hover:border-red-200 text-red-500 hover:bg-red-50 cursor-pointer'
                              }`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* WEBAUTHN DEVICE KEY MANAGER */}
      <div className="bg-white border border-slate-200/60 p-5 rounded-3xl space-y-4">
        <div>
          <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <Key size={16} className="text-amber-500" />
            Registered Biometric Devices & Keys
          </h2>
          <p className="text-[11px] text-slate-400 mt-1">
            Devices mapped to direct biometrics-on-device login keys. Stolen or lost devices can have their authority revoked instantly here.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                <th className="py-2.5 px-3">Device Label / Nickname</th>
                <th className="py-2.5 px-3">Linked User Email</th>
                <th className="py-2.5 px-3">Credential Token Reference</th>
                <th className="py-2.5 px-3">Enrolled At</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {credentials.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 text-[11px] italic">
                    No active device biometrics or safety keys enrolled on this device.
                  </td>
                </tr>
              ) : (
                credentials.map((cred) => (
                  <tr key={cred.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                    <td className="py-3 px-3">
                      <span className="font-extrabold text-slate-800">{cred.deviceName || 'Unnamed Secure Device'}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono text-[10px] text-slate-500">{cred.userEmail}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono text-[9px] text-slate-400">{cred.id.substring(0, 15)}...</span>
                    </td>
                    <td className="py-3 px-3 text-slate-400 font-mono text-[10px]">
                      {cred.createdAt ? new Date(cred.createdAt).toLocaleDateString() : 'Initial Enrollment'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleRevokeCredential(cred.id, cred.userEmail)}
                        className="p-1.5 rounded-lg border border-red-100 hover:border-red-200 text-red-500 hover:bg-red-50 cursor-pointer"
                        title="Revoke device key"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SYSTEM INTEGRITY CHECK */}
      <div className="bg-white border border-slate-200/60 p-5 rounded-3xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-2">
          <div>
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <ShieldAlert size={16} className="text-rose-500" />
              System Integrity Scanner
            </h2>
            <p className="text-[11px] text-slate-400 mt-1">
              Scan the student and assessment databases for orphaned records, duplicate entries, or invalid grade formatting.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={runIntegrityScan}
              disabled={isScanning}
              className="shrink-0 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold rounded-xl px-4 py-2 text-xs transition flex items-center justify-center gap-2"
            >
              {isScanning ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Search size={14} />
              )}
              {isScanning ? 'Scanning System...' : 'Run Integrity Scan'}
            </button>
            {scanResults.hasScanned && (scanResults.orphanedAssessments.length > 0 || scanResults.invalidGrades.length > 0 || scanResults.duplicateStudents.length > 0) && (
              <button
                onClick={handleFixAll}
                className="shrink-0 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl px-4 py-2 text-xs transition flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} />
                Fix All Issues
              </button>
            )}
          </div>
        </div>

        {scanResults.hasScanned && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* Orphaned Records */}
            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">Orphaned Records</h3>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${scanResults.orphanedAssessments.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {scanResults.orphanedAssessments.length} found
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed mb-4">
                  Assessments that belong to students who no longer exist in the system directory.
                </p>
              </div>
              {scanResults.orphanedAssessments.length > 0 && (
                <button
                  onClick={handleFixOrphaned}
                  className="w-full bg-white border border-amber-200 text-amber-600 hover:bg-amber-50 text-[10px] font-bold py-2 rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={12} /> Delete Orphaned
                </button>
              )}
            </div>

            {/* Invalid Grades */}
            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">Invalid Grades</h3>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${scanResults.invalidGrades.length > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {scanResults.invalidGrades.length} found
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed mb-4">
                  Assessments containing out-of-bounds scores (e.g. exams &gt; 100, exercises &gt; 10, or negative/NaN values).
                </p>
              </div>
              {scanResults.invalidGrades.length > 0 && (
                <button
                  onClick={handleFixInvalid}
                  className="w-full bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-[10px] font-bold py-2 rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <RefreshCw size={12} /> Reset to Zero
                </button>
              )}
            </div>

            {/* Duplicate Students */}
            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">Duplicate Students</h3>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${scanResults.duplicateStudents.length > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {scanResults.duplicateStudents.length} found
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed mb-4">
                  Student profiles that appear more than once with the exact same unique ID.
                </p>
              </div>
              {scanResults.duplicateStudents.length > 0 && (
                <button
                  onClick={handleFixDuplicates}
                  className="w-full bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-[10px] font-bold py-2 rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <Check size={12} /> Keep First Only
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 no-print animate-fade-in">
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

      {licenseEditModal && licenseEditModal.isOpen && licenseEditModal.user && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 no-print animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden text-left p-6 sm:p-8 space-y-6 animate-scale-up">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-2.5 bg-amber-50 rounded-2xl text-amber-500">
                <CalendarClock size={24} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-950 font-sans tracking-tight">
                  License Authorization & Renewal
                </h3>
                <p className="text-[11px] text-slate-400 font-sans">
                  Configure school database license for <strong>{licenseEditModal.user.name}</strong>
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveUserLicense} className="space-y-4">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Email Address</span>
                  <span className="font-mono font-bold text-slate-700">{licenseEditModal.user.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Request Code</span>
                  <span className="font-mono font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100/30">
                    {licenseEditModal.user.requestCode || "REQ-SYSTEM-9401"}
                  </span>
                </div>
              </div>

              {/* Single-Use Renewal Passcode Box for Client */}
              <div className="bg-gradient-to-br from-amber-50 via-amber-50/80 to-orange-50/60 rounded-2xl p-4 border border-amber-200/90 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase text-amber-900 tracking-wider flex items-center gap-1">
                    🔑 Client Single-Use Renewal Code
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const reqC = licenseEditModal.user.requestCode || `REQ-${licenseEditModal.user.email.split('@')[0].substring(0, 4).toUpperCase()}-9401`;
                      const pass = generateActivationCode(licenseEditModal.user.email, reqC);
                      navigator.clipboard.writeText(pass);
                      triggerToast(`Copied passcode ${pass} to clipboard!`, 'info');
                    }}
                    className="text-[10px] font-black bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    Copy Code
                  </button>
                </div>
                <div className="font-mono text-base font-black text-amber-950 bg-white/95 px-3 py-2 rounded-xl border border-amber-200/80 shadow-inner text-center tracking-widest select-all">
                  {generateActivationCode(
                    licenseEditModal.user.email, 
                    licenseEditModal.user.requestCode || `REQ-${licenseEditModal.user.email.split('@')[0].substring(0, 4).toUpperCase()}-9401`
                  )}
                </div>
                <p className="text-[10px] text-amber-800/90 leading-relaxed font-sans">
                  Send this passcode to the client/school. When entered in <strong>Settings → School License Top Up</strong>, their subscription extends by <strong>{licenseEditModal.licensePeriod || 1} year(s)</strong> and rotates their Request Code automatically.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-black uppercase text-slate-500 tracking-wider">License Type</label>
                <select
                  value={licenseEditModal.licenseType}
                  onChange={(e) => setLicenseEditModal({
                    ...licenseEditModal,
                    licenseType: e.target.value as any
                  })}
                  className="w-full text-xs py-2.5 px-3 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition uppercase font-bold text-slate-700"
                >
                  <option value="trial">7-Day Free Trial</option>
                  <option value="activated">Activated Paid License</option>
                  <option value="unlimited">Unlimited Lifetime License</option>
                  <option value="unlicensed">Unlicensed / Locked</option>
                </select>
              </div>

              {licenseEditModal.licenseType === 'activated' && (
                <>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-black uppercase text-slate-500 tracking-wider">Subscription Period</label>
                    <select
                      value={licenseEditModal.licensePeriod}
                      onChange={(e) => setLicenseEditModal({
                        ...licenseEditModal,
                        licensePeriod: parseInt(e.target.value, 10)
                      })}
                      className="w-full text-xs py-2.5 px-3 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition font-bold text-slate-700"
                    >
                      <option value={1}>1 Year Access</option>
                      <option value={2}>2 Years Access</option>
                      <option value={3}>3 Years Access</option>
                      <option value={5}>5 Years Access</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-black uppercase text-slate-500 tracking-wider">Date Authorized (Activation Date)</label>
                    <input
                      type="date"
                      value={licenseEditModal.lastActivatedOn ? licenseEditModal.lastActivatedOn.substring(0, 10) : new Date().toISOString().substring(0, 10)}
                      onChange={(e) => setLicenseEditModal({
                        ...licenseEditModal,
                        lastActivatedOn: e.target.value ? new Date(e.target.value).toISOString() : new Date().toISOString()
                      })}
                      className="w-full text-xs py-2.5 px-3 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition font-mono font-bold text-slate-700"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setLicenseEditModal(null)}
                  className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer select-none text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-black text-xs rounded-xl transition cursor-pointer select-none text-center"
                >
                  Save & Sync
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* MANAGEMENT LOGIN SCHOOLS */}
      <div className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden mt-6 shadow-xs">
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-slate-700" />
            <h3 className="font-black text-slate-800 text-sm">Management Login Schools ({managedSchools.length})</h3>
          </div>
          <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
            Live Registry
          </span>
        </div>
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[700px] text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-5 py-3.5">School Name</th>
                <th className="px-5 py-3.5">Admin Email</th>
                <th className="px-5 py-3.5 text-center">Teachers</th>
                <th className="px-5 py-3.5 text-center">Students</th>
                <th className="px-5 py-3.5">Subscription</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {managedSchools.map((school) => (
                <tr key={school.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-slate-800">{school.schoolName || school.id}</td>
                  <td className="px-5 py-3.5 text-slate-600 font-mono text-[11px]">{school.adminEmail || 'N/A'}</td>
                  <td className="px-5 py-3.5 text-center font-semibold text-slate-700">{school.teacherCount || 0}</td>
                  <td className="px-5 py-3.5 text-center font-semibold text-slate-700">{school.studentCount || 0}</td>
                  <td className="px-5 py-3.5">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {school.subscriptionTier || 'Free'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (onNavigateTab) {
                          onNavigateTab('school_profile');
                        } else {
                          triggerToast(`Navigating to profile for ${school.schoolName || school.id}`, 'info');
                        }
                      }}
                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-[10px] transition cursor-pointer border border-indigo-200"
                    >
                      View Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (onNavigateTab) {
                          onNavigateTab('settings');
                        } else {
                          triggerToast(`Opening billing/license settings for ${school.schoolName || school.id}`, 'info');
                        }
                      }}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg text-[10px] transition cursor-pointer border border-emerald-200"
                    >
                      Extend License
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
