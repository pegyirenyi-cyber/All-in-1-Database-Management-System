import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  OAuthProvider
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
  query,
  where,
  getDocFromServer,
  disableNetwork,
  enableNetwork,
  enableIndexedDbPersistence,
  limit,
  orderBy,
  writeBatch
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadString,
  getDownloadURL,
  uploadBytes
} from 'firebase/storage';
import {
  SchoolInfo,
  Student,
  Teacher,
  AttendanceRecord,
  StaffAttendanceRecord,
  StudentAssessment,
  AssessmentTemplate,
  UserAccount,
  UserRole,
  ClassType,
  AcademicYearType,
  TermType,
  SubjectType,
  SUBJECTS,
  ThemeType,
  StudentFeeBill,
  FeePayment,
  AcademicCalendarConfig,
  EmisData,
  PaystackPayment,
  WebAuthnCredential,
  ActivityLog,
  BehavioralRemark,
  TeacherReflection,
  AutoBackupConfig,
  AutoBackupEntry,
  CloudSyncConfig,
  DutyAssignment,
  DutyType,
  StaffHandbookDocument,
  LeaveRequest,
  CustomTask,
  QuickNote,
  CommunicationTemplate,
  TransportRoute,
  StudentTransportRecord,
  CanteenPlan,
  CanteenPaymentRecord,
  SchoolExcursion,
  ExcursionParticipant,
  SportsActivity,
  StudentSportsRecord,
  TextbookItem,
  StudentTextbookTransaction,
  SchoolExpense,
  CustomBillComponent,
  FinancialAuditLog,
  VoucherApprovalStatus,
  StaffPayslip,
  CustomExpenseCategory
} from './types';
import firebaseConfig from '../firebase-applet-config.json';
import CryptoJS from 'crypto-js';

// Resolve configuration from Vite environment variables (secrets) or fallback to firebase-applet-config.json
const resolvedFirebaseConfig = {
  projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId || '',
  appId: (import.meta as any).env.VITE_FIREBASE_APP_ID || firebaseConfig.appId || '',
  apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey || '',
  authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain || ((import.meta as any).env.VITE_FIREBASE_PROJECT_ID ? `${(import.meta as any).env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com` : firebaseConfig.projectId ? `${firebaseConfig.projectId}.firebaseapp.com` : ''),
  storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket || '',
  messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId || '',
  measurementId: (import.meta as any).env.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfig.measurementId || '',
  firestoreDatabaseId: (import.meta as any).env.VITE_FIREBASE_DATABASE_ID || (firebaseConfig as any).firestoreDatabaseId || 'ai-studio-schoolmanagement-a2d8d304-855b-466a-8f1a-47e69bbb165b'
};

const AES_SECRET_KEY = (import.meta as any).env.VITE_AES_SECRET_KEY || 'school_shield_default_secret_key_98234710';

export function generateUniqueSchoolId(uid?: string): string {
  const prefix = 'SCH';
  if (uid) {
    const cleanUid = uid.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase();
    const numPart = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${cleanUid}-${numPart}`;
  }
  const randPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  const numPart = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${randPart}-${numPart}`;
}

// Initialize Firebase using the provisioned config
let firebaseApp;
let firebaseAuth: any = null;
let firestoreDb: any = null;
let isFirebaseActive = false;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: firebaseAuth?.currentUser?.uid || null,
      email: firebaseAuth?.currentUser?.email || null,
      emailVerified: firebaseAuth?.currentUser?.emailVerified || null,
      isAnonymous: firebaseAuth?.currentUser?.isAnonymous || null,
      tenantId: firebaseAuth?.currentUser?.tenantId || null,
      providerInfo: firebaseAuth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

try {
  if (resolvedFirebaseConfig.apiKey && resolvedFirebaseConfig.projectId) {
    const configWithAuthDomain = {
      ...resolvedFirebaseConfig,
      authDomain: resolvedFirebaseConfig.authDomain || `${resolvedFirebaseConfig.projectId}.firebaseapp.com`
    };
    firebaseApp = getApps().length === 0 ? initializeApp(configWithAuthDomain) : getApp();
    firebaseAuth = getAuth(firebaseApp);
    const dbId = resolvedFirebaseConfig.firestoreDatabaseId;
    firestoreDb = (dbId && dbId !== '(default)') 
      ? getFirestore(firebaseApp, dbId) 
      : getFirestore(firebaseApp);
    isFirebaseActive = true;
    console.log("Firebase initialized successfully with live database instance:", dbId || '(default)');
    
    // Attempt to enable offline persistence for resilient local caching
    enableIndexedDbPersistence(firestoreDb).catch((err) => {
      console.warn("Firestore offline persistence could not be enabled (possibly multiple tabs open):", err.message || err);
    });
  }
} catch (e) {
  console.log("Firebase is not initialized; running securely in offline LocalStorage mode.", e);
}

// Validate Connection to Firestore (Prerequisite check)
async function testConnection() {
  if (isFirebaseActive && firestoreDb) {
    try {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (!isOnline) {
        console.warn("Device is offline. Placing Firestore in offline cache mode immediately.");
        await disableNetwork(firestoreDb);
        return;
      }
      
      let raceFinished = false;

      const connectionPromise = getDocFromServer(doc(firestoreDb, 'test', 'connection'))
        .then(res => {
          raceFinished = true;
          return res;
        })
        .catch(err => {
          if (raceFinished) {
            console.log("Firestore connection check failed after race finished (swallowed to prevent unhandled rejection):", err.message || err);
            return null;
          }
          raceFinished = true;
          throw err;
        });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => {
          if (raceFinished) return;
          raceFinished = true;
          reject(new Error("Firestore connection handshake timed out after 12000ms"));
        }, 12000)
      );

      await Promise.race([connectionPromise, timeoutPromise]);
      console.log("Firestore connection check completed successfully. Online mode activated.");
    } catch (error) {
      console.warn("Firestore connection check failed or timed out. Placing Firestore in offline mode immediately to prevent blocking/latency issues.", error);
      try {
        await disableNetwork(firestoreDb);
      } catch (networkError) {
        console.warn("Error disabling Firestore network mode:", networkError);
      }
    }
  }
}
testConnection();

// Default system configurations
const DEFAULT_SCHOOL_INFO: SchoolInfo = {
  id: 'school_default',
  name: '',
  motto: '',
  logoUrl: '',
  schoolNumber: '',
  emisCode: '',
  gpsAddress: '',
  schoolType: 'Public',
  headteacherName: '',
  telephone: '',
  email: '',
  qualifications: '',
  highestAcademicQualifications: '',
  district: '',
  circuit: '',
  reopeningDate: '',
  signatureUrl: '',
  stampUrl: '',
  assignedTeacherId: '',
  paystackPublicKey: '',
  paystackSecretKey: '',
  paystackMode: 'test',
  twilioAccountSid: '',
  twilioAuthToken: '',
  twilioFromNumber: '',
  twilioEnabled: false,
  smsBalance: 0,
  smsSenderId: 'GEETECH',
  licensePrice1Year: 350,
  licensePrice2Year: 600,
  licensePrice3Year: 800,
  licensePrice5Year: 1200,
  schoolId: ''
};

export const DEFAULT_CALENDAR: AcademicCalendarConfig = {
  activeAcademicYear: '2026/2027',
  activeTerm: 'Term 1',
  years: {
    '2025/2026': {
      academicYear: '2025/2026',
      startDate: '2025-09-01',
      endDate: '2026-07-31',
      terms: {
        'Term 1': { startDate: '2025-09-01', endDate: '2025-12-19' },
        'Term 2': { startDate: '2026-01-08', endDate: '2026-04-10' },
        'Term 3': { startDate: '2026-05-04', endDate: '2026-07-31' }
      }
    },
    '2026/2027': {
      academicYear: '2026/2027',
      startDate: '2026-09-01',
      endDate: '2027-07-31',
      terms: {
        'Term 1': { startDate: '2026-09-01', endDate: '2026-12-18' },
        'Term 2': { startDate: '2027-01-07', endDate: '2027-04-09' },
        'Term 3': { startDate: '2027-05-03', endDate: '2027-07-30' }
      }
    },
    '2027/2028': {
      academicYear: '2027/2028',
      startDate: '2027-09-01',
      endDate: '2028-07-31',
      terms: {
        'Term 1': { startDate: '2027-09-01', endDate: '2027-12-17' },
        'Term 2': { startDate: '2028-01-06', endDate: '2028-04-07' },
        'Term 3': { startDate: '2028-05-02', endDate: '2028-07-31' }
      }
    },
    '2028/2029': {
      academicYear: '2028/2029',
      startDate: '2028-09-01',
      endDate: '2029-07-31',
      terms: {
        'Term 1': { startDate: '2028-09-01', endDate: '2028-12-15' },
        'Term 2': { startDate: '2029-01-05', endDate: '2029-04-06' },
        'Term 3': { startDate: '2029-05-04', endDate: '2029-07-31' }
      }
    },
    '2029/2030': {
      academicYear: '2029/2030',
      startDate: '2029-09-01',
      endDate: '2030-07-31',
      terms: {
        'Term 1': { startDate: '2029-09-01', endDate: '2029-12-21' },
        'Term 2': { startDate: '2030-01-07', endDate: '2030-04-12' },
        'Term 3': { startDate: '2030-05-06', endDate: '2030-07-31' }
      }
    },
    '2030/2031': {
      academicYear: '2030/2031',
      startDate: '2030-09-01',
      endDate: '2031-07-31',
      terms: {
        'Term 1': { startDate: '2030-09-01', endDate: '2030-12-20' },
        'Term 2': { startDate: '2031-01-07', endDate: '2031-04-11' },
        'Term 3': { startDate: '2031-05-05', endDate: '2031-07-31' }
      }
    },
    '2031/2032': {
      academicYear: '2031/2032',
      startDate: '2031-09-01',
      endDate: '2032-07-31',
      terms: {
        'Term 1': { startDate: '2031-09-01', endDate: '2031-12-19' },
        'Term 2': { startDate: '2032-01-08', endDate: '2032-04-09' },
        'Term 3': { startDate: '2032-05-03', endDate: '2032-07-30' }
      }
    },
    '2032/2033': {
      academicYear: '2032/2033',
      startDate: '2032-09-01',
      endDate: '2033-07-31',
      terms: {
        'Term 1': { startDate: '2032-09-01', endDate: '2032-12-17' },
        'Term 2': { startDate: '2033-01-07', endDate: '2033-04-08' },
        'Term 3': { startDate: '2033-05-02', endDate: '2033-07-29' }
      }
    },
    '2033/2034': {
      academicYear: '2033/2034',
      startDate: '2033-09-01',
      endDate: '2034-07-31',
      terms: {
        'Term 1': { startDate: '2033-09-01', endDate: '2033-12-16' },
        'Term 2': { startDate: '2034-01-06', endDate: '2034-04-07' },
        'Term 3': { startDate: '2034-05-01', endDate: '2034-07-28' }
      }
    },
    '2034/2035': {
      academicYear: '2034/2035',
      startDate: '2034-09-01',
      endDate: '2035-07-31',
      terms: {
        'Term 1': { startDate: '2034-09-01', endDate: '2034-12-15' },
        'Term 2': { startDate: '2035-01-05', endDate: '2035-04-06' },
        'Term 3': { startDate: '2035-05-04', endDate: '2035-07-31' }
      }
    },
    '2035/2036': {
      academicYear: '2035/2036',
      startDate: '2035-09-01',
      endDate: '2036-07-31',
      terms: {
        'Term 1': { startDate: '2035-09-01', endDate: '2035-12-21' },
        'Term 2': { startDate: '2036-01-04', endDate: '2036-04-11' },
        'Term 3': { startDate: '2036-05-02', endDate: '2036-07-31' }
      }
    },
    '2036/2037': {
      academicYear: '2036/2037',
      startDate: '2036-09-01',
      endDate: '2037-07-31',
      terms: {
        'Term 1': { startDate: '2036-09-01', endDate: '2036-12-19' },
        'Term 2': { startDate: '2037-01-08', endDate: '2037-04-10' },
        'Term 3': { startDate: '2037-05-04', endDate: '2037-07-31' }
      }
    },
    '2037/2038': {
      academicYear: '2037/2038',
      startDate: '2037-09-01',
      endDate: '2038-07-31',
      terms: {
        'Term 1': { startDate: '2037-09-01', endDate: '2037-12-18' },
        'Term 2': { startDate: '2038-01-07', endDate: '2038-04-09' },
        'Term 3': { startDate: '2038-05-03', endDate: '2038-07-30' }
      }
    },
    '2038/2039': {
      academicYear: '2038/2039',
      startDate: '2038-09-01',
      endDate: '2039-07-31',
      terms: {
        'Term 1': { startDate: '2038-09-01', endDate: '2038-12-17' },
        'Term 2': { startDate: '2039-01-06', endDate: '2039-04-08' },
        'Term 3': { startDate: '2039-05-02', endDate: '2039-07-29' }
      }
    },
    '2039/2040': {
      academicYear: '2039/2040',
      startDate: '2039-09-01',
      endDate: '2040-07-31',
      terms: {
        'Term 1': { startDate: '2039-09-01', endDate: '2039-12-16' },
        'Term 2': { startDate: '2040-01-05', endDate: '2040-04-12' },
        'Term 3': { startDate: '2040-05-03', endDate: '2040-07-31' }
      }
    }
  }
};

// Local storage key constants
const STORAGE_KEYS = {
  USER: 'sms_user',
  USERS_LIST: 'sms_users_list',
  SCHOOL: 'sms_school_info',
  STUDENTS: 'sms_students',
  TEACHERS: 'sms_teachers',
  ATTENDANCE: 'sms_attendance',
  STAFF_ATTENDANCE: 'sms_staff_attendance',
  ASSESSMENTS: 'sms_assessments',
  ASSESSMENT_TEMPLATES: 'sms_assessment_templates',
  SETTINGS: 'sms_settings',
  FEES: 'sms_fees',
  CALENDAR: 'sms_academic_calendar',
  EMIS: 'sms_emis_reports',
  PAYSTACK_LOGS: 'sms_paystack_logs',
  WEBAUTHN_CREDENTIALS: 'sms_webauthn_credentials',
  ACTIVITY_LOGS: 'sms_activity_logs',
  BEHAVIORAL_REMARKS: 'sms_behavioral_remarks',
  TEACHER_REFLECTIONS: 'sms_teacher_reflections',
  AUTO_BACKUP_CONFIG: 'sms_auto_backup_config',
  AUTO_BACKUPS: 'sms_auto_backups',
  CLOUD_SYNC_CONFIG: 'sms_cloud_sync_config',
  DUTY_ROSTER: 'sms_duty_roster',
  STAFF_HANDBOOK: 'sms_staff_handbook',
  LEAVE_REQUESTS: 'sms_leave_requests',
  TASKS: 'sms_tasks',
  QUICK_NOTES: 'sms_quick_notes',
  USED_ACTIVATION_CODES: 'sms_used_activation_codes',
  COMM_TEMPLATES: 'sms_communication_templates',
  TRANSPORT_ROUTES: 'sms_transport_routes',
  TRANSPORT_RECORDS: 'sms_transport_records',
  CANTEEN_PLANS: 'sms_canteen_plans',
  CANTEEN_PAYMENTS: 'sms_canteen_payments',
  EXCURSIONS: 'sms_excursions',
  EXCURSION_PARTICIPANTS: 'sms_excursion_participants',
  SPORTS_ACTIVITIES: 'sms_sports_activities',
  SPORTS_RECORDS: 'sms_sports_records',
  TEXTBOOKS: 'sms_textbooks',
  TEXTBOOK_TRANSACTIONS: 'sms_textbook_transactions',
  EXPENSES: 'sms_expenses',
  CUSTOM_BILL_COMPONENTS: 'sms_custom_bill_components',
  CUSTOM_BILL_CATEGORIES: 'sms_custom_bill_categories',
  STAFF_PAYSLIPS: 'sms_staff_payslips',
  CUSTOM_EXPENSE_CATEGORIES: 'sms_custom_expense_categories',
  FINANCIAL_AUDIT_LOGS: 'sms_financial_audit_logs',
  CUSTOM_SECTIONS: 'sms_custom_sections'
};

// -------------------------------------------------------------
// INDEXEDDB DURABLE OFFLINE STORAGE ENGINE
// Mirrors localStorage into IndexedDB & restores on cache wipe
// -------------------------------------------------------------
export class IndexedDbEngine {
  private static dbName = 'SchoolShieldDB_v1';
  private static storeName = 'appData';
  private static dbPromise: Promise<IDBDatabase> | null = null;

  private static getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject('IndexedDB not available');
        return;
      }
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'key' });
        }
      };
      req.onsuccess = (e: any) => resolve(e.target.result);
      req.onerror = (e: any) => reject(e);
    });
    return this.dbPromise;
  }

  static async setItem(key: string, val: string): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      store.put({ key, val, updatedAt: Date.now() });
    } catch (e) {
      // Ignore background IDB errors
    }
  }

  static async getItem(key: string): Promise<string | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.get(key);
        req.onsuccess = () => {
          if (req.result && req.result.val !== undefined) resolve(req.result.val);
          else resolve(null);
        };
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  }

  static async removeItem(key: string): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      store.delete(key);
    } catch (e) {}
  }

  static async clearAll(): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      store.clear();
    } catch (e) {
      console.warn("Error clearing IndexedDB store:", e);
    }
  }

  static async restoreAllToLocalStorage(): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const req = store.getAll();
      req.onsuccess = () => {
        const records = req.result || [];
        let updated = false;
        records.forEach((rec: any) => {
          if (rec && rec.key && rec.val !== undefined) {
            // Restore into localStorage if missing
            const current = localStorage.getItem(rec.key);
            if (!current) {
              try {
                localStorage.setItem(rec.key, typeof rec.val === 'string' ? rec.val : JSON.stringify(rec.val));
                console.log(`[IndexedDB Auto-Recovery] Restored key "${rec.key}" from IndexedDB persistence after cache wipe.`);
                updated = true;
              } catch {}
            }
          }
        });
        if (updated) {
          DbController.clearCache();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('school-system-sync', { detail: { type: 'all_restored' } }));
          }
        }
      };
    } catch (e) {
      console.warn('IndexedDB auto-recovery scan failed:', e);
    }
  }
}

// Request Persistent Storage API from browser on load & trigger auto-restore
if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then((granted) => {
    if (granted) {
      console.log('[Storage] Browser persistent storage activated successfully.');
    }
  }).catch(() => {});
  IndexedDbEngine.restoreAllToLocalStorage().catch(() => {});
}

// Get user-specific key prefix/suffix to support clean multi-user login and cross-device syncing
let _lastSessionUid: string | null = null;

export function getPartitionedKey(key: string): string {
  // Institutional school data is shared across ALL roles (Headteacher, Teacher, Admin) on this device.
  // ONLY user session/auth data is scoped to the individual user.
  if (
    key === 'sms_user' ||
    key === 'sms_users_list' ||
    key === 'users_list' ||
    key === 'webauthn_credentials' ||
    key === 'sms_used_activation_codes' ||
    key === STORAGE_KEYS.SCHOOL ||
    key === STORAGE_KEYS.STUDENTS ||
    key === STORAGE_KEYS.TEACHERS ||
    key === STORAGE_KEYS.ATTENDANCE ||
    key === STORAGE_KEYS.STAFF_ATTENDANCE ||
    key === STORAGE_KEYS.ASSESSMENTS ||
    key === STORAGE_KEYS.ASSESSMENT_TEMPLATES ||
    key === STORAGE_KEYS.SETTINGS ||
    key === STORAGE_KEYS.FEES ||
    key === STORAGE_KEYS.CALENDAR ||
    key === STORAGE_KEYS.EMIS ||
    key === STORAGE_KEYS.PAYSTACK_LOGS ||
    key === STORAGE_KEYS.ACTIVITY_LOGS ||
    key === STORAGE_KEYS.BEHAVIORAL_REMARKS ||
    key === STORAGE_KEYS.TEACHER_REFLECTIONS ||
    key === STORAGE_KEYS.AUTO_BACKUP_CONFIG ||
    key === STORAGE_KEYS.AUTO_BACKUPS ||
    key === STORAGE_KEYS.CLOUD_SYNC_CONFIG ||
    key === STORAGE_KEYS.DUTY_ROSTER ||
    key === STORAGE_KEYS.STAFF_HANDBOOK ||
    key === STORAGE_KEYS.LEAVE_REQUESTS ||
    key === STORAGE_KEYS.TASKS ||
    key === STORAGE_KEYS.QUICK_NOTES ||
    key === STORAGE_KEYS.COMM_TEMPLATES ||
    key === STORAGE_KEYS.TRANSPORT_ROUTES ||
    key === STORAGE_KEYS.TRANSPORT_RECORDS ||
    key === STORAGE_KEYS.CANTEEN_PLANS ||
    key === STORAGE_KEYS.CANTEEN_PAYMENTS ||
    key === STORAGE_KEYS.EXCURSIONS ||
    key === STORAGE_KEYS.EXCURSION_PARTICIPANTS ||
    key === STORAGE_KEYS.SPORTS_ACTIVITIES ||
    key === STORAGE_KEYS.SPORTS_RECORDS ||
    key === STORAGE_KEYS.TEXTBOOKS ||
    key === STORAGE_KEYS.TEXTBOOK_TRANSACTIONS ||
    key === STORAGE_KEYS.EXPENSES ||
    key === STORAGE_KEYS.CUSTOM_BILL_COMPONENTS ||
    key === STORAGE_KEYS.CUSTOM_BILL_CATEGORIES ||
    key === STORAGE_KEYS.STAFF_PAYSLIPS ||
    key === STORAGE_KEYS.CUSTOM_EXPENSE_CATEGORIES ||
    key === STORAGE_KEYS.FINANCIAL_AUDIT_LOGS ||
    key === STORAGE_KEYS.CUSTOM_SECTIONS
  ) {
    return key;
  }
  
  try {
    const rawUser = sessionStorage.getItem('sms_user') || localStorage.getItem('sms_user');
    if (rawUser) {
      let parsed: any = null;
      try {
        parsed = JSON.parse(rawUser);
      } catch {
        try {
          const bytes = CryptoJS.AES.decrypt(rawUser, AES_SECRET_KEY);
          parsed = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        } catch {}
      }
      
      if (parsed && parsed.uid) {
        _lastSessionUid = parsed.uid;
        return `${key}_${_lastSessionUid}`;
      }
    }
  } catch (e) {
    console.error("Error reading user suffix for key partition:", e);
  }
  return key;
}

// Helper to deep copy or get storage with client-side AES encryption/decryption
export function getStorageItem<T>(key: string, defaultValue: T): T {
  const partitionedKey = getPartitionedKey(key);
  const storage = key === 'sms_user' ? sessionStorage : localStorage;
  let item = storage.getItem(partitionedKey);
  if (!item && key === 'sms_user') {
    item = localStorage.getItem(partitionedKey);
  }

  if (!item || item === 'null' || item === 'undefined') return defaultValue;
  try {
    // Try raw JSON parse first
    const parsed = JSON.parse(item);
    if (parsed === null || parsed === undefined) return defaultValue;
    return parsed as T;
  } catch {
    // If not raw JSON, try decryption
    try {
      const bytes = CryptoJS.AES.decrypt(item, AES_SECRET_KEY);
      const parsedText = bytes.toString(CryptoJS.enc.Utf8);
      if (!parsedText || parsedText === 'null' || parsedText === 'undefined') return defaultValue;
      const parsed = JSON.parse(parsedText);
      if (parsed === null || parsed === undefined) return defaultValue;
      return parsed as T;
    } catch (err) {
      console.warn(`[Client-side] Failed to get storage item for key "${partitionedKey}", falling back to default value:`, err);
      return defaultValue;
    }
  }
}

export function setStorageItem<T>(key: string, value: T): void {
  DbController.clearCache();
  const partitionedKey = getPartitionedKey(key);
  const storage = key === 'sms_user' ? sessionStorage : localStorage;
  try {
    const rawString = JSON.stringify(value);
    const encrypted = CryptoJS.AES.encrypt(rawString, AES_SECRET_KEY).toString();
    try {
      storage.setItem(partitionedKey, encrypted);
      if (key === 'sms_user') {
        localStorage.setItem(partitionedKey, encrypted);
        sessionStorage.setItem(partitionedKey, encrypted);
      }
      IndexedDbEngine.setItem(partitionedKey, encrypted);
    } catch (storageErr) {
      console.error(`[Storage] Direct write failed for key "${partitionedKey}" (likely quota exceeded):`, storageErr);
    }
  } catch (err) {
    console.error(`[Client-side AES] Encryption failed for key "${partitionedKey}":`, err);
    try {
      const plainStr = JSON.stringify(value);
      storage.setItem(partitionedKey, plainStr);
      if (key === 'sms_user') {
        localStorage.setItem(partitionedKey, plainStr);
        sessionStorage.setItem(partitionedKey, plainStr);
      }
      IndexedDbEngine.setItem(partitionedKey, plainStr);
    } catch (storageErr) {
      console.error(`[Storage] Fallback write failed for key "${partitionedKey}":`, storageErr);
    }
  }
}

export function removeStorageItem(key: string): void {
  const partitionedKey = getPartitionedKey(key);
  sessionStorage.removeItem(partitionedKey);
  localStorage.removeItem(partitionedKey);
  IndexedDbEngine.removeItem(partitionedKey);
}

export interface OfflineQueueItem {
  id: string;
  collection: string;
  docId: string;
  type: 'set' | 'delete';
  data?: any;
  timestamp: number;
  attempts?: number;
}

// -----------------------------------------------------------------------------
// CORE DB CONTROLLER (Handles seamless firebase vs local storage persistence)
// -----------------------------------------------------------------------------
export class DbController {
  private static _isSyncing = false;
  private static _cache: Record<string, any> = {};
  private static _assessmentsByStudent: Map<string, StudentAssessment[]> = new Map();
  private static _studentsByClass: Map<ClassType | string, Student[]> = new Map();

  static generateUniqueSchoolId(uid?: string): string {
    return generateUniqueSchoolId(uid);
  }

  static clearCache() {
    this._cache = {};
    this._assessmentsByStudent = new Map();
    this._studentsByClass = new Map();
    _lastSessionUid = null;
  }

  static broadcastSyncEvent(type: string, payload: any) {
    try {
      // 1. Dispatch custom event for the current window/tab
      const event = new CustomEvent('school-system-sync', { detail: { type, payload } });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(event);
        window.dispatchEvent(new CustomEvent(type, { detail: payload }));
      }

      // 2. Broadcast via BroadcastChannel to other tabs
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('school-system-realtime-channel');
        channel.postMessage({ type, payload });
        channel.close();
      }
    } catch (e) {
      console.warn("[Real-time Sync] Failed to broadcast sync event:", e);
    }
  }

  static isFirebaseEnabled(): boolean {
    return isFirebaseActive;
  }

  static getAuthInstance(): any {
    return firebaseAuth;
  }

  static getFirestoreInstance(): any {
    return firestoreDb;
  }

  private static _isSyncingQueue = false;
  private static _autoFlushTimeout: any = null;

  static scheduleAutoFlush(delayMs: number = 150): void {
    if (this._autoFlushTimeout) clearTimeout(this._autoFlushTimeout);
    this._autoFlushTimeout = setTimeout(() => {
      this._autoFlushTimeout = null;
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        this.syncOfflineQueue().catch(e => console.warn("[Cloud Auto-Flush] Queue sync notice:", e));
      }
    }, delayMs);
  }

  // Synchronize active login user profile, subscriptions, and schoolId directly to Cloud Firestore by User ID
  static async syncCurrentUserToFirebase(user?: UserAccount | null): Promise<{ success: boolean; uid: string }> {
    if (!isFirebaseActive || !firestoreDb) return { success: false, uid: '' };
    const targetUser = user || this.getCurrentUser();
    if (!targetUser || !targetUser.uid || targetUser.uid === 'H5nlyq30sANEMixDEmURnYoyUzU2') return { success: false, uid: '' };

    try {
      const sanitized: any = { 
        ...targetUser,
        syncedToCloudAt: new Date().toISOString(),
        cloudFirestoreSynced: true
      };
      Object.keys(sanitized).forEach(k => {
        if (sanitized[k] === undefined) delete sanitized[k];
      });

      const userDocRef = doc(firestoreDb, 'users', targetUser.uid);
      await setDoc(userDocRef, sanitized, { merge: true });
      console.log(`[Cloud User Sync] User ID ${targetUser.uid} profile, subscriptions, and schoolId successfully synced to Cloud Firestore.`);
      return { success: true, uid: targetUser.uid };
    } catch (e) {
      console.warn(`[Cloud User Sync] Non-blocking notice syncing user ID ${targetUser?.uid} to Cloud Firestore:`, e);
      this.enqueueOfflineOperation('users', targetUser.uid, 'set', targetUser);
      return { success: false, uid: targetUser.uid };
    }
  }

  // Helper to handle safe write operations with offline queuing
  static async performFirestoreWrite(
    colName: string,
    docId: string,
    type: 'set' | 'delete',
    data?: any
  ): Promise<void> {
    if (!isFirebaseActive || !firestoreDb) return;

    // Sanitize docId to prevent sub-collection routing issues (e.g., forward slashes in academic years)
    const safeDocId = docId.replace(/\//g, '-');
    let safeData = data;
    if (safeData && safeData.id) {
      safeData = { ...safeData, id: safeDocId };
    }

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const currentUser = this.getCurrentUser();
    const schoolId = this.resolveActiveSchoolId();

    let collectionRef;
    if (colName === 'schools' || colName === 'users') {
      collectionRef = collection(firestoreDb, colName);
    } else {
      collectionRef = collection(firestoreDb, 'schools', schoolId, colName);
    }

    if (!isOnline) {
      this.enqueueOfflineOperation(colName, safeDocId, type, safeData);
      return;
    }

    try {
      const docRef = doc(collectionRef, safeDocId);
      if (type === 'set') {
        await setDoc(docRef, { ...safeData, ownerId: currentUser?.uid });
      } else if (type === 'delete') {
        await deleteDoc(docRef);
      }
      console.log(`[Cloud Sync] Fast synced ${type} on ${colName}/${safeDocId}.`);
    } catch (error) {
      console.warn(`[Cloud Sync] Direct write failed for ${colName}/${safeDocId}, queueing for auto-flush:`, error);
      this.enqueueOfflineOperation(colName, safeDocId, type, safeData);
    }
  }

  // High-performance batch write method utilizing Firestore writeBatch (up to 400 operations per batch)
  static async performFirestoreWriteBatch(
    colName: string,
    items: { id: string; data?: any; type: 'set' | 'delete' }[]
  ): Promise<void> {
    if (!isFirebaseActive || !firestoreDb || !items || items.length === 0) return;

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const currentUser = this.getCurrentUser();
    const schoolId = this.resolveActiveSchoolId();

    let collectionRef;
    if (colName === 'schools' || colName === 'users') {
      collectionRef = collection(firestoreDb, colName);
    } else {
      collectionRef = collection(firestoreDb, 'schools', schoolId, colName);
    }

    if (!isOnline) {
      items.forEach(item => {
        const safeDocId = item.id.replace(/\//g, '-');
        this.enqueueOfflineOperation(colName, safeDocId, item.type, item.data);
      });
      return;
    }

    try {
      const chunkSize = 400;
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const batch = writeBatch(firestoreDb);
        chunk.forEach(item => {
          const safeDocId = item.id.replace(/\//g, '-');
          const docRef = doc(collectionRef, safeDocId);
          if (item.type === 'set') {
            let safeData = item.data;
            if (safeData && safeData.id) {
              safeData = { ...safeData, id: safeDocId };
            }
            batch.set(docRef, { ...safeData, ownerId: currentUser?.uid });
          } else {
            batch.delete(docRef);
          }
        });
        await batch.commit();
      }
      console.log(`[Cloud Sync Batch] Committed batch of ${items.length} records to ${colName} in atomic roundtrip.`);
    } catch (error) {
      console.warn(`[Cloud Sync Batch] Batch write failed on ${colName}, queuing for background replay:`, error);
      items.forEach(item => {
        const safeDocId = item.id.replace(/\//g, '-');
        this.enqueueOfflineOperation(colName, safeDocId, item.type, item.data);
      });
    }
  }

  // Enqueue a fallback write operation
  static enqueueOfflineOperation(
    colName: string,
    docId: string,
    type: 'set' | 'delete',
    data?: any
  ): void {
    const queue = getStorageItem<OfflineQueueItem[]>('sms_offline_queue', []);
    
    // To minimize redundancy: overwrite or merge operations on the exact same document
    const existingIdx = queue.findIndex(item => item.collection === colName && item.docId === docId);
    
    const newItem: OfflineQueueItem = {
      id: 'op_' + Math.random().toString(36).substring(2, 9),
      collection: colName,
      docId,
      type,
      data,
      timestamp: Date.now()
    };

    if (existingIdx >= 0) {
      queue[existingIdx] = newItem;
    } else {
      queue.push(newItem);
    }
    
    setStorageItem('sms_offline_queue', queue);
    console.log(`[Offline Sync] Enqueued ${type} operation for ${colName}/${docId}. Queue size: ${queue.length}`);
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sms_sync_status_changed'));
    }

    // Automatically trigger debounced auto-flush in background without blocking UI
    this.scheduleAutoFlush(150);
  }

  static getOfflineQueueSize(): number {
    return getStorageItem<OfflineQueueItem[]>('sms_offline_queue', []).length;
  }

  // Auto-synchronize pending local writes with Firestore once online (Batched for instant completion)
  static async syncOfflineQueue(): Promise<{ success: boolean; syncedCount: number }> {
    if (!isFirebaseActive || !firestoreDb) return { success: false, syncedCount: 0 };
    if (this._isSyncingQueue) return { success: false, syncedCount: 0 };
    
    const queue = getStorageItem<OfflineQueueItem[]>('sms_offline_queue', []);
    if (queue.length === 0) return { success: true, syncedCount: 0 };

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isOnline) {
      return { success: false, syncedCount: 0 };
    }

    this._isSyncingQueue = true;
    console.log(`[Offline Sync] Active. Replaying ${queue.length} pending writes in cloud batches...`);
    
    const remainingQueue: OfflineQueueItem[] = [];
    let syncedCount = 0;
    const currentUser = this.getCurrentUser();
    const schoolId = this.resolveActiveSchoolId();

    // Process queue in fast atomic batches of 400 operations
    const chunkSize = 400;
    for (let i = 0; i < queue.length; i += chunkSize) {
      const chunk = queue.slice(i, i + chunkSize);
      try {
        const batch = writeBatch(firestoreDb);
        chunk.forEach(item => {
          const safeDocId = item.docId.replace(/\//g, '-');
          let safeData = item.data;
          if (safeData && safeData.id) {
            safeData = { ...safeData, id: safeDocId };
          }

          let collectionRef;
          if (item.collection === 'schools' || item.collection === 'users') {
            collectionRef = collection(firestoreDb, item.collection);
          } else {
            collectionRef = collection(firestoreDb, 'schools', schoolId, item.collection);
          }

          const docRef = doc(collectionRef, safeDocId);
          if (item.type === 'set') {
            batch.set(docRef, { ...safeData, ownerId: currentUser?.uid });
          } else if (item.type === 'delete') {
            batch.delete(docRef);
          }
        });

        await batch.commit();
        syncedCount += chunk.length;

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sms_sync_progress', {
            detail: { current: syncedCount, total: queue.length }
          }));
        }
        console.log(`[Offline Sync] Successfully batch replayed ${chunk.length} operations.`);
      } catch (chunkErr) {
        console.warn("[Offline Sync] Batch commit error, retrying items individually:", chunkErr);
        // Fallback: item-by-item retry for this chunk
        for (const item of chunk) {
          try {
            const safeDocId = item.docId.replace(/\//g, '-');
            let safeData = item.data;
            if (safeData && safeData.id) {
              safeData = { ...safeData, id: safeDocId };
            }
            let collectionRef;
            if (item.collection === 'schools' || item.collection === 'users') {
              collectionRef = collection(firestoreDb, item.collection);
            } else {
              collectionRef = collection(firestoreDb, 'schools', schoolId, item.collection);
            }
            const docRef = doc(collectionRef, safeDocId);
            if (item.type === 'set') {
              await setDoc(docRef, { ...safeData, ownerId: currentUser?.uid });
            } else if (item.type === 'delete') {
              await deleteDoc(docRef);
            }
            syncedCount++;
          } catch (itemErr) {
            const nextAttempts = (item.attempts || 0) + 1;
            if (nextAttempts <= 3) {
              remainingQueue.push({ ...item, attempts: nextAttempts });
            } else {
              console.warn(`[Offline Sync] Pruned operation ${item.type} on ${item.collection}/${item.docId} after 3 failed attempts:`, itemErr);
            }
          }
        }
      }
    }

    setStorageItem('sms_offline_queue', remainingQueue);
    this._isSyncingQueue = false;
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sms_sync_status_changed'));
    }

    return {
      success: remainingQueue.length === 0,
      syncedCount
    };
  }

  // Account / Role-based Authentication state
  static getCurrentUser(): UserAccount | null {
    const user = getStorageItem<UserAccount | null>(STORAGE_KEYS.USER, null);
    if (user) {
      if (user.uid === 'H5nlyq30sANEMixDEmURnYoyUzU2') {
        setStorageItem(STORAGE_KEYS.USER, null);
        delete this._cache[STORAGE_KEYS.USER];
        if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('sms_user');
        if (typeof localStorage !== 'undefined') localStorage.removeItem('sms_user');
        return null;
      }
      if (user.email) {
        const emailLower = user.email.toLowerCase().trim();
        let changed = false;
        if (emailLower === 'pegyirenyi@gmail.com') {
          if (user.role !== 'Admin') {
            user.role = 'Admin';
            changed = true;
          }
        }
        if (emailLower === 'multimediageetech@gmail.com' || emailLower === 'sammyotoo06@gmail.com' || emailLower === 'wilkinsonannan@gmail.com') {
          if (emailLower === 'multimediageetech@gmail.com') {
            if (user.requestCode === 'REQ-MULTI-8888' || user.requestCode?.endsWith('8888')) {
              user.requestCode = 'REQ-MULTI-7007';
              changed = true;
            }
            if (user.uid?.endsWith('8888')) {
              user.uid = 'user_multimedia_headteacher';
              changed = true;
            }
          }
          if (user.role !== 'Headteacher') {
            user.role = 'Headteacher';
            changed = true;
          }
        }

        const nowMs = Date.now();
        const isWilkinson = emailLower === 'wilkinsonannan@gmail.com';
        const isSammy = emailLower === 'sammyotoo06@gmail.com';
        const trialDaysMs = (isWilkinson ? 21 : isSammy ? 15 : 14) * 24 * 60 * 60 * 1000;

        // Link subscription and trial period directly to login user ID
        if (emailLower === 'pegyirenyi@gmail.com' || user.role === 'Admin') {
          if (user.licenseType !== 'unlimited') {
            user.licenseType = 'unlimited';
            changed = true;
          }
        } else if (user.licenseType === 'activated') {
          // Active license is linked directly to this user ID
        } else {
          if (user.licenseType !== 'trial') {
            user.licenseType = 'trial';
            changed = true;
          }
          if (!user.trialEndDate) {
            user.trialEndDate = new Date(nowMs + trialDaysMs).toISOString();
            if (!user.registeredOn) user.registeredOn = new Date().toISOString();
            changed = true;
          }
        }

        // Ensure user has a one-time unique School ID assigned
        if (!user.schoolId || user.schoolId === 'SMS-P8U4F22L' || user.schoolId === 'school_default') {
          user.schoolId = generateUniqueSchoolId(user.uid);
          changed = true;
        }

        if (changed) {
          setStorageItem(STORAGE_KEYS.USER, user);
          this.syncCurrentUserToFirebase(user).catch(() => {});
        }
      }
    }
    return user;
  }

  // Robustly resolve active School ID across user session, assigned teacher profile, and school profile
  static resolveActiveSchoolId(): string {
    const user = this.getCurrentUser();
    
    // 1. Explicit unique schoolId on active user session
    if (user?.schoolId && user.schoolId.trim() && user.schoolId !== 'school_default' && user.schoolId !== 'SMS-P8U4F22L') {
      return user.schoolId.trim();
    }

    // 2. Check if a local/cached Teacher profile matches user email, staffId, or uid
    if (user) {
      const userEmail = user.email?.toLowerCase().trim();
      const userStaffId = user.staffId?.toLowerCase().trim();
      const userUid = user.uid;

      const teachers = this.getTeachers();
      const matchedTeacher = teachers.find(t => 
        (userEmail && t.email?.toLowerCase().trim() === userEmail) ||
        (userStaffId && t.staffId?.toLowerCase().trim() === userStaffId) ||
        (userUid && (t.id === userUid || (t as any).userId === userUid))
      );

      if (matchedTeacher?.schoolId && matchedTeacher.schoolId.trim() && matchedTeacher.schoolId !== 'school_default' && matchedTeacher.schoolId !== 'SMS-P8U4F22L') {
        const resolvedId = matchedTeacher.schoolId.trim();
        user.schoolId = resolvedId;
        if (!user.staffId && matchedTeacher.staffId) {
          user.staffId = matchedTeacher.staffId;
        }
        setStorageItem(STORAGE_KEYS.USER, user);
        this._cache[STORAGE_KEYS.USER] = user;
        return resolvedId;
      }
    }

    // 3. Check SchoolInfo in storage/cache
    const schoolInfo = this.getSchoolInfo();
    if (schoolInfo?.schoolId && schoolInfo.schoolId.trim() && schoolInfo.schoolId !== 'school_default' && schoolInfo.schoolId !== 'SMS-P8U4F22L') {
      const resolvedId = schoolInfo.schoolId.trim();
      if (user) {
        user.schoolId = resolvedId;
        setStorageItem(STORAGE_KEYS.USER, user);
        this._cache[STORAGE_KEYS.USER] = user;
      }
      return resolvedId;
    }

    // 4. Generate one-time unique School ID for every login user ID
    if (user?.uid) {
      const uniqueId = generateUniqueSchoolId(user.uid);
      user.schoolId = uniqueId;
      setStorageItem(STORAGE_KEYS.USER, user);
      this._cache[STORAGE_KEYS.USER] = user;
      if (isFirebaseActive && firestoreDb) {
        setDoc(doc(firestoreDb, 'users', user.uid), { schoolId: uniqueId }, { merge: true }).catch(console.error);
      }
      return uniqueId;
    }

    return generateUniqueSchoolId();
  }

  // Look up an existing assigned Teacher profile for a user if one exists in the school database
  static getConnectedTeacherProfile(user?: UserAccount | null): Teacher | null {
    const activeUser = user || this.getCurrentUser();
    if (!activeUser) return null;

    const teachers = this.getTeachers();
    const userEmail = activeUser.email?.toLowerCase().trim();
    const userStaffId = activeUser.staffId?.toLowerCase().trim();
    const userUid = activeUser.uid;

    const matchedTeacher = teachers.find(t => 
      (userEmail && t.email?.toLowerCase().trim() === userEmail) ||
      (userStaffId && t.staffId?.toLowerCase().trim() === userStaffId) ||
      (userUid && (t.id === userUid || (t as any).userId === userUid))
    );

    if (!matchedTeacher) {
      // Login user ID is NOT automatically a teacher. Return null if no teacher profile exists.
      return null;
    }

    const activeSchoolId = activeUser.schoolId || this.resolveActiveSchoolId();

    let updated = false;
    if (!matchedTeacher.schoolId || matchedTeacher.schoolId !== activeSchoolId) {
      matchedTeacher.schoolId = activeSchoolId;
      updated = true;
    }
    if (activeUser.email && (!matchedTeacher.email || matchedTeacher.email.includes('@school.internal'))) {
      matchedTeacher.email = activeUser.email;
      updated = true;
    }
    if (updated) {
      this.saveTeacher(matchedTeacher);
    }

    if (activeUser && (!activeUser.schoolId || activeUser.schoolId !== activeSchoolId || (matchedTeacher.staffId && !activeUser.staffId))) {
      activeUser.schoolId = activeSchoolId;
      if (matchedTeacher.staffId) activeUser.staffId = matchedTeacher.staffId;
      setStorageItem(STORAGE_KEYS.USER, activeUser);
      this._cache[STORAGE_KEYS.USER] = activeUser;
      if (isFirebaseActive && firestoreDb) {
        setDoc(doc(firestoreDb, 'users', activeUser.uid), activeUser, { merge: true }).catch(console.error);
      }
    }

    return matchedTeacher;
  }

  // Alias for backward compatibility
  static ensureConnectedTeacherProfile(user?: UserAccount | null): Teacher | null {
    return this.getConnectedTeacherProfile(user);
  }

  static getRegisteredUsers(): UserAccount[] {
    if (this._cache[STORAGE_KEYS.USERS_LIST]) {
      return this._cache[STORAGE_KEYS.USERS_LIST];
    }
    // One-time system clear for new entry
    if (typeof window !== 'undefined') {
      const isCleared = localStorage.getItem('sms_system_cleared_june_30_v2');
      if (!isCleared) {
        localStorage.removeItem(STORAGE_KEYS.USERS_LIST);
        localStorage.setItem('sms_system_cleared_june_30_v2', 'true');
      }
    }

    const list = getStorageItem<UserAccount[]>(STORAGE_KEYS.USERS_LIST, []);
    
    // Filter out specific revoked duplicate ID, target UID H5nlyq30sANEMixDEmURnYoyUzU2, or ID ending in 8888
    const filtered = list.filter(user => {
      if (user.uid === 'H5nlyq30sANEMixDEmURnYoyUzU2') return false;
      if (user.requestCode === 'REQ-PEGY-5103') return false;
      if (user.requestCode === 'REQ-MULTI-8888' || user.requestCode?.endsWith('8888') || user.uid?.endsWith('8888')) return false;
      return true;
    });

    // Ensure pegyirenyi@gmail.com is present in the list as Admin with unlimited license
    const pegyIdx = filtered.findIndex(user => user.email.toLowerCase().trim() === 'pegyirenyi@gmail.com');
    const createdNow = new Date().toISOString();
    if (pegyIdx >= 0) {
      let changed = false;
      if (filtered[pegyIdx].role !== 'Admin') {
        filtered[pegyIdx].role = 'Admin';
        changed = true;
      }
      if (filtered[pegyIdx].licenseType !== 'unlimited') {
        filtered[pegyIdx].licenseType = 'unlimited';
        changed = true;
      }
      if (changed) {
        setStorageItem(STORAGE_KEYS.USERS_LIST, filtered);
      }
    } else {
      const newAdmin: UserAccount = {
        uid: 'user_pegyirenyi_admin',
        email: 'pegyirenyi@gmail.com',
        name: 'EGYIRENYI PAUL',
        role: 'Admin',
        createdAt: createdNow,
        licenseType: 'unlimited',
        registeredOn: createdNow,
        requestCode: 'REQ-PEGY-9999',
        schoolId: generateUniqueSchoolId('user_pegyirenyi_admin')
      };
      filtered.push(newAdmin);
      setStorageItem(STORAGE_KEYS.USERS_LIST, filtered);
    }

    // Ensure sammyotoo06@gmail.com is present in the list as Headteacher with 15-day trial license
    const samIdx = filtered.findIndex(user => user.email.toLowerCase().trim() === 'sammyotoo06@gmail.com');
    const sammyTrialEnd = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
    if (samIdx >= 0) {
      let changed = false;
      if (filtered[samIdx].role !== 'Headteacher') {
        filtered[samIdx].role = 'Headteacher';
        changed = true;
      }
      if (filtered[samIdx].licenseType !== 'trial') {
        filtered[samIdx].licenseType = 'trial';
        changed = true;
      }
      const currentEnd = filtered[samIdx].trialEndDate ? new Date(filtered[samIdx].trialEndDate).getTime() : 0;
      if (currentEnd < Date.now()) {
        filtered[samIdx].trialEndDate = sammyTrialEnd;
        changed = true;
      }
      if (!filtered[samIdx].schoolId || filtered[samIdx].schoolId === 'SMS-P8U4F22L') {
        filtered[samIdx].schoolId = generateUniqueSchoolId(filtered[samIdx].uid);
        changed = true;
      }
      if (changed) {
        setStorageItem(STORAGE_KEYS.USERS_LIST, filtered);
      }
    } else {
      const newSammy: UserAccount = {
        uid: 'user_sammyotoo_headteacher',
        email: 'sammyotoo06@gmail.com',
        name: 'SAMMY OTOO',
        role: 'Headteacher',
        schoolId: generateUniqueSchoolId('user_sammyotoo_headteacher'),
        createdAt: createdNow,
        licenseType: 'trial',
        registeredOn: createdNow,
        trialEndDate: sammyTrialEnd,
        requestCode: 'REQ-SAMMY-7007'
      };
      filtered.push(newSammy);
      setStorageItem(STORAGE_KEYS.USERS_LIST, filtered);
    }

    // Ensure wilkinsonannan@gmail.com is present in the list as Headteacher with 21-day trial license
    const wilkIdx = filtered.findIndex(user => user.email.toLowerCase().trim() === 'wilkinsonannan@gmail.com');
    const wilkTrialEnd = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();
    if (wilkIdx >= 0) {
      let changed = false;
      if (filtered[wilkIdx].role !== 'Headteacher') {
        filtered[wilkIdx].role = 'Headteacher';
        changed = true;
      }
      if (filtered[wilkIdx].licenseType !== 'trial') {
        filtered[wilkIdx].licenseType = 'trial';
        changed = true;
      }
      const currentEnd = filtered[wilkIdx].trialEndDate ? new Date(filtered[wilkIdx].trialEndDate).getTime() : 0;
      if (currentEnd < Date.now()) {
        filtered[wilkIdx].trialEndDate = wilkTrialEnd;
        changed = true;
      }
      if (!filtered[wilkIdx].schoolId || filtered[wilkIdx].schoolId === 'SMS-P8U4F22L') {
        filtered[wilkIdx].schoolId = generateUniqueSchoolId(filtered[wilkIdx].uid);
        changed = true;
      }
      if (changed) {
        setStorageItem(STORAGE_KEYS.USERS_LIST, filtered);
      }
    } else {
      const newWilk: UserAccount = {
        uid: 'user_wilkinsonannan_headteacher',
        email: 'wilkinsonannan@gmail.com',
        name: 'WILKINSON ANNAN',
        role: 'Headteacher',
        schoolId: generateUniqueSchoolId('user_wilkinsonannan_headteacher'),
        createdAt: createdNow,
        licenseType: 'trial',
        registeredOn: createdNow,
        trialEndDate: wilkTrialEnd,
        requestCode: 'REQ-WILK-7007'
      };
      filtered.push(newWilk);
      setStorageItem(STORAGE_KEYS.USERS_LIST, filtered);
    }

    // Persist filtered list if it changed
    if (filtered.length !== list.length) {
      setStorageItem(STORAGE_KEYS.USERS_LIST, filtered);
      this.saveRegisteredUsers(filtered).catch(err => {
        console.warn("Could not sync filtered user list to Firestore: ", err);
      });
    }

    this._cache[STORAGE_KEYS.USERS_LIST] = filtered;
    return filtered;
  }

  static async saveRegisteredUsers(users: UserAccount[]): Promise<void> {
    // Safety check for revoked ID ending in 8888 or target UID H5nlyq30sANEMixDEmURnYoyUzU2
    const sanitized = users.filter(user => {
      if (user.uid === 'H5nlyq30sANEMixDEmURnYoyUzU2') return false;
      if (user.requestCode === 'REQ-PEGY-5103') return false;
      if (user.requestCode === 'REQ-MULTI-8888' || user.requestCode?.endsWith('8888') || user.uid?.endsWith('8888')) return false;
      return true;
    });

    const pegyIdx = sanitized.findIndex(user => user.email.toLowerCase().trim() === 'pegyirenyi@gmail.com');
    if (pegyIdx >= 0) {
      sanitized[pegyIdx].role = 'Admin';
      sanitized[pegyIdx].licenseType = 'unlimited';
    } else {
      const createdNow = new Date().toISOString();
      sanitized.push({
        uid: 'user_pegyirenyi_admin',
        email: 'pegyirenyi@gmail.com',
        name: 'EGYIRENYI PAUL',
        role: 'Admin',
        createdAt: createdNow,
        licenseType: 'unlimited',
        registeredOn: createdNow,
        requestCode: 'REQ-PEGY-9999'
      });
    }

    // Ensure sammyotoo06@gmail.com has their 15-day trial details set if they exist in the list
    const samIdx = sanitized.findIndex(user => user.email.toLowerCase().trim() === 'sammyotoo06@gmail.com');
    if (samIdx >= 0) {
      sanitized[samIdx].role = 'Headteacher';
      sanitized[samIdx].licenseType = 'trial';
      if (!sanitized[samIdx].schoolId || sanitized[samIdx].schoolId === 'SMS-P8U4F22L' || sanitized[samIdx].schoolId === 'school_default') {
        sanitized[samIdx].schoolId = generateUniqueSchoolId(sanitized[samIdx].uid);
      }
      if (!sanitized[samIdx].trialEndDate || new Date(sanitized[samIdx].trialEndDate).getTime() < Date.now()) {
        sanitized[samIdx].trialEndDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
      }
    }

    // Ensure wilkinsonannan@gmail.com has their 21-day trial details set if they exist in the list
    const wilkIdx = sanitized.findIndex(user => user.email.toLowerCase().trim() === 'wilkinsonannan@gmail.com');
    if (wilkIdx >= 0) {
      sanitized[wilkIdx].role = 'Headteacher';
      sanitized[wilkIdx].licenseType = 'trial';
      if (!sanitized[wilkIdx].schoolId || sanitized[wilkIdx].schoolId === 'SMS-P8U4F22L' || sanitized[wilkIdx].schoolId === 'school_default') {
        sanitized[wilkIdx].schoolId = generateUniqueSchoolId(sanitized[wilkIdx].uid);
      }
      if (!sanitized[wilkIdx].trialEndDate || new Date(sanitized[wilkIdx].trialEndDate).getTime() < Date.now()) {
        sanitized[wilkIdx].trialEndDate = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();
      }
    }

    setStorageItem(STORAGE_KEYS.USERS_LIST, sanitized);
    
    const currentUser = this.getCurrentUser();
    if (currentUser) {
      const match = sanitized.find(u => u.uid === currentUser.uid);
      if (match) {
        setStorageItem(STORAGE_KEYS.USER, match);
      }
    }

    if (isFirebaseActive && firestoreDb) {
      try {
        for (const user of sanitized) {
          const sanitizedUser = { ...user };
          for (const key in sanitizedUser) {
            if (sanitizedUser[key as keyof typeof sanitizedUser] === undefined) {
              delete sanitizedUser[key as keyof typeof sanitizedUser];
            }
          }
          await setDoc(doc(firestoreDb, 'users', user.uid), sanitizedUser);
        }
        // Also update the global directory document for the security watchdog
        await setDoc(doc(firestoreDb, 'users', 'directory'), { list: sanitized, updatedAt: new Date().toISOString() });
      } catch (err) {
        console.warn("Could not sync user list to firestore: ", err);
      }
    }
    this.broadcastSyncEvent('users-updated', sanitized);
  }

  static async deleteRegisteredUser(uid: string): Promise<void> {
    const list = this.getRegisteredUsers();
    const filtered = list.filter(u => u.uid !== uid);
    setStorageItem(STORAGE_KEYS.USERS_LIST, filtered);

    if (isFirebaseActive && firestoreDb) {
      try {
        // 1. Delete individual user document
        await deleteDoc(doc(firestoreDb, 'users', uid));
        
        // 2. Update global directory document
        await setDoc(doc(firestoreDb, 'users', 'directory'), { list: filtered, updatedAt: new Date().toISOString() });
      } catch (err) {
        console.warn("Could not sync user deletion to firestore: ", err);
      }
    }
    this.broadcastSyncEvent('users-updated', filtered);
  }

  static determineRole(email: string): UserRole {
    const trimmedEmail = email.toLowerCase().trim();
    if (trimmedEmail === 'pegyirenyi@gmail.com') {
      return 'Admin';
    }
    if (trimmedEmail === 'multimediageetech@gmail.com' || trimmedEmail === 'sammyotoo06@gmail.com' || trimmedEmail === 'wilkinsonannan@gmail.com') {
      return 'Headteacher';
    }
    if (trimmedEmail === 'patienceedusah724@gmail.com') {
      return 'Teacher';
    }
    
    // Check if the user is a teacher with assigned classes. If so, they are seen as Class Teachers.
    const teachers = this.getTeachers();
    const matchingTeacher = teachers.find(t => t.email?.toLowerCase().trim() === trimmedEmail);
    if (matchingTeacher) {
      const assignedClasses = matchingTeacher.assignedClasses || [];
      const assignedClass = matchingTeacher.assignedClass;
      if (assignedClasses.length > 0 || (assignedClass && assignedClass !== 'None')) {
        return 'Teacher';
      }
    }

    // Check if user is explicitly registered with an assigned role first
    const users = getStorageItem<UserAccount[]>(STORAGE_KEYS.USERS_LIST, []);
    const existingUser = users.find(u => u.email.toLowerCase().trim() === trimmedEmail);
    if (existingUser) {
      return existingUser.role;
    }
    
    const hasTeacherEmail = teachers.some(t => t.email?.toLowerCase().trim() === trimmedEmail);
    if (hasTeacherEmail) {
      return 'Teacher';
    }
    return 'Teacher';
  }

  static login(email: string, role: UserRole): UserAccount {
    // Find or bootstrap user account (for offline fallback)
    const prevUser = this.getCurrentUser();
    if (!prevUser || prevUser.email.toLowerCase() !== email.toLowerCase()) {
      this.clearCache();
      _lastSessionUid = null; // Reset session lock on explicit login
    }
    const users = this.getRegisteredUsers();
    
    const trimmedEmail = email.toLowerCase().trim();
    let assignedRole: UserRole = role;
    
    // Let any email sign in directly without pre-authorization.

    if (trimmedEmail === 'pegyirenyi@gmail.com') {
      assignedRole = 'Admin';
    } else if (trimmedEmail === 'multimediageetech@gmail.com' || trimmedEmail === 'sammyotoo06@gmail.com' || trimmedEmail === 'wilkinsonannan@gmail.com') {
      assignedRole = 'Headteacher';
    } else if (trimmedEmail === 'patienceedusah724@gmail.com') {
      assignedRole = 'Teacher';
    }
    
    const existingUser = users.find(u => u.email.toLowerCase().trim() === trimmedEmail);
    if (existingUser) {
      assignedRole = existingUser.role;
    }

    // Force roles for specific accounts
    if (trimmedEmail === 'pegyirenyi@gmail.com') {
      assignedRole = 'Admin';
    } else if (trimmedEmail === 'multimediageetech@gmail.com' || trimmedEmail === 'sammyotoo06@gmail.com' || trimmedEmail === 'wilkinsonannan@gmail.com') {
      assignedRole = 'Headteacher';
    }

    // Check if the user is a teacher with assigned classes. If so, they are seen as Class Teachers.
    const teachers = this.getTeachers();
    const matchingTeacher = teachers.find(t => t.email?.toLowerCase().trim() === trimmedEmail);
    if (matchingTeacher) {
      const assignedClasses = matchingTeacher.assignedClasses || [];
      const assignedClass = matchingTeacher.assignedClass;
      if (assignedClasses.length > 0 || (assignedClass && assignedClass !== 'None')) {
        assignedRole = 'Teacher';
      }
    }
    
    let user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (user) {
      if (user.role !== assignedRole) {
        user.role = assignedRole;
        setStorageItem(STORAGE_KEYS.USERS_LIST, users);
      }
      // Fill missing licensing info if existing
      let changed = false;
      if (!user.licenseType) {
        user.licenseType = trimmedEmail === 'pegyirenyi@gmail.com' ? 'unlimited' : 'trial';
        changed = true;
      }
      if (trimmedEmail === 'multimediageetech@gmail.com' || trimmedEmail === 'sammyotoo06@gmail.com' || trimmedEmail === 'wilkinsonannan@gmail.com') {
        const nowMs = Date.now();
        const isWilkinson = trimmedEmail === 'wilkinsonannan@gmail.com';
        const isSammy = trimmedEmail === 'sammyotoo06@gmail.com';
        const trialDaysMs = (isWilkinson ? 21 : isSammy ? 15 : 7) * 24 * 60 * 60 * 1000;
        const currentTrialEnd = user.trialEndDate ? new Date(user.trialEndDate).getTime() : 0;
        if (currentTrialEnd < nowMs) {
          user.licenseType = 'trial';
          user.registeredOn = new Date().toISOString();
          user.createdAt = new Date().toISOString();
          user.trialEndDate = new Date(nowMs + trialDaysMs).toISOString();
          changed = true;
        }
        if (trimmedEmail === 'multimediageetech@gmail.com') {
          if (user.requestCode === 'REQ-MULTI-8888' || user.requestCode?.endsWith('8888')) {
            user.requestCode = 'REQ-MULTI-7007';
            changed = true;
          }
          if (user.uid?.endsWith('8888')) {
            user.uid = 'user_multimedia_headteacher';
            changed = true;
          }
        }
      }
      if (!user.registeredOn) {
        user.registeredOn = user.createdAt;
        changed = true;
      }
      if (!user.requestCode) {
        const prefix = user.email.split('@')[0].substring(0, 4).toUpperCase();
        user.requestCode = `REQ-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
        changed = true;
      }
      if (changed) {
        setStorageItem(STORAGE_KEYS.USERS_LIST, users);
      }
    } else {
      // Create user
      const createdNow = new Date().toISOString();
      const prefix = email.split('@')[0].substring(0, 4).toUpperCase();
      user = {
        uid: trimmedEmail === 'pegyirenyi@gmail.com' ? 'user_pegyirenyi_admin' : 'user_' + Math.random().toString(36).substring(2, 9),
        email: email,
        name: trimmedEmail === 'pegyirenyi@gmail.com' ? 'EGYIRENYI PAUL' : email.split('@')[0].toUpperCase(),
        role: assignedRole,
        createdAt: createdNow,
        licenseType: trimmedEmail === 'pegyirenyi@gmail.com' ? 'unlimited' : 'trial',
        registeredOn: createdNow,
        requestCode: `REQ-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`
      };
      users.push(user);
      setStorageItem(STORAGE_KEYS.USERS_LIST, users);
    }
    setStorageItem(STORAGE_KEYS.USER, user);
    this.syncCurrentUserToFirebase(user).catch(() => {});
    return user;
  }

  static register(name: string, email: string, role: UserRole): UserAccount {
    this.clearCache();
    const users = this.getRegisteredUsers();
    
    const trimmedEmail = email.toLowerCase().trim();
    let assignedRole: UserRole = role;
    
    // Allow registering user directly without pre-authorization when there is no logged-in user context
    if (trimmedEmail !== 'pegyirenyi@gmail.com' && trimmedEmail !== 'multimediageetech@gmail.com' && trimmedEmail !== 'patienceedusah724@gmail.com' && trimmedEmail !== 'sammyotoo06@gmail.com' && trimmedEmail !== 'wilkinsonannan@gmail.com') {
      const isAuthorized = users.some(u => u.email.toLowerCase().trim() === trimmedEmail);
      const currentUser = this.getCurrentUser();
      
      if (currentUser) {
        const isCurrentAdmin = currentUser?.role === 'Admin' || currentUser?.email?.toLowerCase().trim() === 'pegyirenyi@gmail.com';
        const isCurrentHeadteacher = currentUser?.role === 'Headteacher';

        if (!isAuthorized) {
          if (assignedRole === 'Teacher') {
            if (!isCurrentHeadteacher) {
              throw new Error("Access Denied: Only Headteachers can register Teachers.");
            }
          } else if (assignedRole === 'Headteacher') {
            if (!isCurrentAdmin) {
              throw new Error("Access Denied: Only the Admin can register Headteachers.");
            }
          } else {
            if (!isCurrentAdmin) {
              throw new Error("Access Denied: Only the Admin can authorize and register accounts.");
            }
          }
        }
      }
    }

    if (trimmedEmail === 'pegyirenyi@gmail.com') {
      assignedRole = 'Admin';
    } else if (trimmedEmail === 'multimediageetech@gmail.com' || trimmedEmail === 'sammyotoo06@gmail.com' || trimmedEmail === 'wilkinsonannan@gmail.com') {
      assignedRole = 'Headteacher';
    } else if (trimmedEmail === 'patienceedusah724@gmail.com') {
      assignedRole = 'Teacher';
    } else {
      const currentUser = this.getCurrentUser();
      const isAdmin = currentUser?.role === 'Admin' || currentUser?.email?.toLowerCase().trim() === 'pegyirenyi@gmail.com';
      
      if (assignedRole === 'Headteacher' && currentUser && !isAdmin) {
        // Enforce: only admin can register Headteachers when logged in
        assignedRole = 'Teacher';
      }
      
      // Nobody else can be registered as Admin
      if (assignedRole === 'Admin') {
        assignedRole = 'Teacher';
      }
    }

    const currentUser = this.getCurrentUser();
    let userSchoolId: string | undefined = undefined;
    if (assignedRole === 'Teacher' && currentUser?.schoolId && currentUser.schoolId !== 'SMS-P8U4F22L' && currentUser.schoolId !== 'school_default') {
      userSchoolId = currentUser.schoolId;
    } else {
      userSchoolId = generateUniqueSchoolId(trimmedEmail.replace(/[^a-zA-Z0-9]/g, ''));
    }

    const createdNow = new Date().toISOString();
    const prefix = email.split('@')[0].substring(0, 4).toUpperCase();
    const isSammy = trimmedEmail === 'sammyotoo06@gmail.com';
    const isWilkinson = trimmedEmail === 'wilkinsonannan@gmail.com';
    const newUser: UserAccount = {
      uid: isWilkinson ? 'user_wilkinsonannan_headteacher' : isSammy ? 'user_sammyotoo_headteacher' : 'user_' + Math.random().toString(36).substring(2, 9),
      email: email,
      name: name,
      role: assignedRole,
      schoolId: userSchoolId,
      createdAt: createdNow,
      licenseType: 'trial',
      registeredOn: createdNow,
      trialEndDate: isWilkinson ? new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString() : isSammy ? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString() : undefined,
      requestCode: isWilkinson ? 'REQ-WILK-7007' : isSammy ? 'REQ-SAMMY-7007' : `REQ-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`
    };
    users.push(newUser);
    this.saveRegisteredUsers(users);
    return newUser;
  }

  // === WEBAUTHN BIOMETRICS CONTROLLERS ===
  static getWebAuthnCredentials(): WebAuthnCredential[] {
    return getStorageItem<WebAuthnCredential[]>(STORAGE_KEYS.WEBAUTHN_CREDENTIALS, []);
  }

  static registerWebAuthnCredential(cred: WebAuthnCredential): void {
    const list = this.getWebAuthnCredentials();
    const filtered = list.filter(c => c.id !== cred.id);
    filtered.push(cred);
    setStorageItem(STORAGE_KEYS.WEBAUTHN_CREDENTIALS, filtered);
  }

  static deleteWebAuthnCredential(id: string): void {
    const list = this.getWebAuthnCredentials();
    const filtered = list.filter(c => c.id !== id);
    setStorageItem(STORAGE_KEYS.WEBAUTHN_CREDENTIALS, filtered);
  }

  static loginWithWebAuthn(id: string): UserAccount {
    const creds = this.getWebAuthnCredentials();
    const cred = creds.find(c => c.id === id);
    if (!cred) {
      throw new Error("Specified biometric credential is not registered on this device.");
    }
    const email = cred.userEmail.toLowerCase();
    const assignedRole: UserRole = this.determineRole(email);
    const account = this.login(cred.userEmail, assignedRole);
    return account;
  }

  // === ACTIVITY LOGS MANAGEMENT ===
  static getActivityLogs(): ActivityLog[] {
    return getStorageItem<ActivityLog[]>(STORAGE_KEYS.ACTIVITY_LOGS, []);
  }

  static writeActivityLog(
    action: string,
    details: string,
    severity: 'info' | 'low' | 'medium' | 'high' | 'critical' = 'info'
  ): void {
    const logs = this.getActivityLogs();
    const currentUser = this.getCurrentUser();
    
    const newLog: ActivityLog = {
      id: `log_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
      timestamp: new Date().toISOString(),
      userEmail: currentUser?.email || 'system@geetech.com',
      userName: currentUser?.name || 'System / Guest',
      userRole: currentUser?.role || 'Headteacher',
      action,
      details,
      severity
    };
    
    logs.unshift(newLog);
    if (logs.length > 1000) {
      logs.pop();
    }
    setStorageItem(STORAGE_KEYS.ACTIVITY_LOGS, logs);
    this.performFirestoreWrite('activity_logs', newLog.id, 'set', newLog).catch(err => {
      console.warn("Could not sync activity log to Firestore:", err);
    });
  }

  static clearActivityLogs(): void {
    const logs = this.getActivityLogs();
    this.performFirestoreWriteBatch('activity_logs', logs.filter(l => !!l.id).map(l => ({
      id: l.id,
      type: 'delete'
    })));
    setStorageItem(STORAGE_KEYS.ACTIVITY_LOGS, []);
  }

  static isCodeUsed(code: string): boolean {
    if (!code) return false;
    const cleanCode = code.trim().toUpperCase();
    const globalUsed = getStorageItem<string[]>(STORAGE_KEYS.USED_ACTIVATION_CODES, []);
    if (globalUsed.map(c => c.toUpperCase()).includes(cleanCode)) return true;

    const users = this.getRegisteredUsers();
    return users.some(u => u.usedCodes && u.usedCodes.map(c => c.toUpperCase()).includes(cleanCode));
  }

  static recordUsedCode(code: string, email?: string): void {
    if (!code) return;
    const cleanCode = code.trim().toUpperCase();
    const globalUsed = getStorageItem<string[]>(STORAGE_KEYS.USED_ACTIVATION_CODES, []);
    if (!globalUsed.includes(cleanCode)) {
      globalUsed.push(cleanCode);
      setStorageItem(STORAGE_KEYS.USED_ACTIVATION_CODES, globalUsed);
    }
  }

  static async updateUserLicense(
    uid: string, 
    licenseType: 'trial' | 'activated' | 'unlimited', 
    lastActivatedOn: string, 
    activationCode: string, 
    requestCode: string,
    licensePeriod?: number
  ): Promise<UserAccount> {
    const users = this.getRegisteredUsers();
    const idx = users.findIndex(u => u.uid === uid);
    if (idx < 0) {
      throw new Error("User account not found");
    }
    
    const user = users[idx];
    const cleanCode = (activationCode || '').trim().toUpperCase();
    if (cleanCode) {
      this.recordUsedCode(cleanCode, user.email);
    }

    const isAlreadyActivated = user.licenseType === 'activated';
    
    // Check if the current license is still active to decide whether to EXTEND or RESET
    const now = new Date();
    const regDate = new Date(user.registeredOn || user.createdAt || now.toISOString());
    const activationDate = user.lastActivatedOn ? new Date(user.lastActivatedOn) : regDate;
    const currentPeriod = user.licensePeriod || 1;
    const expDate = new Date(activationDate.getTime());
    expDate.setFullYear(expDate.getFullYear() + currentPeriod);
    
    const isStillActive = isAlreadyActivated && (now.getTime() < expDate.getTime());
    const addedYears = licensePeriod !== undefined ? licensePeriod : 1;

    let finalLastActivatedOn = lastActivatedOn;
    let finalLicensePeriod = addedYears;

    if (isStillActive) {
      // EXTENSION: Keep the original activation date and just add more years to the period
      finalLastActivatedOn = user.lastActivatedOn || lastActivatedOn;
      finalLicensePeriod = currentPeriod + addedYears;
    } else {
      // RESET/NEW: Set activation date to now and period to the newly purchased years
      finalLastActivatedOn = lastActivatedOn;
      finalLicensePeriod = addedYears;
    }

    // Always rotate request code upon license activation/renewal so each code is single-use
    const emailPrefix = user.email ? user.email.split('@')[0].substring(0, 4).toUpperCase() : 'USER';
    const freshRequestCode = `REQ-${emailPrefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    const updatedUsedCodes = Array.from(new Set([...(user.usedCodes || []), cleanCode].filter(Boolean)));
    
    const updated: UserAccount = {
      ...user,
      licenseType,
      isSuspended: false,
      registeredOn: user.registeredOn || user.createdAt || new Date().toISOString(),
      lastActivatedOn: finalLastActivatedOn,
      activationCode: cleanCode,
      requestCode: freshRequestCode,
      licensePeriod: finalLicensePeriod,
      usedCodes: updatedUsedCodes
    };
    
    users[idx] = updated;
    setStorageItem(STORAGE_KEYS.USERS_LIST, users);
    
    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.uid === uid) {
      setStorageItem(STORAGE_KEYS.USER, updated);
    }
    
    if (isFirebaseActive && firestoreDb) {
      try {
        await setDoc(doc(firestoreDb, 'users', uid), updated);
      } catch (err) {
        console.warn("Could not sync license status to firestore: ", err);
      }
    }
    
    return updated;
  }

  static updateUserAccount(uid: string, updates: Partial<UserAccount>): UserAccount {
    const users = this.getRegisteredUsers();
    const idx = users.findIndex(u => u.uid === uid);
    if (idx < 0) {
      throw new Error("User account not found");
    }
    
    const updated = {
      ...users[idx],
      ...updates
    };
    
    users[idx] = updated;
    setStorageItem(STORAGE_KEYS.USERS_LIST, users);
    
    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.uid === uid) {
      setStorageItem(STORAGE_KEYS.USER, updated);
    }
    
    if (isFirebaseActive && firestoreDb) {
      try {
        setDoc(doc(firestoreDb, 'users', uid), updated, { merge: true });
      } catch (err) {
        console.warn("Could not sync user update to firestore: ", err);
      }
    }
    
    return updated;
  }

  static logout() {
    this.clearCache();
    _lastSessionUid = null;
    sessionStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.USER);
    if (isFirebaseActive && firebaseAuth) {
      try {
        signOut(firebaseAuth).catch(err => console.error("Firebase Auth SignOut error:", err));
      } catch (e) {
        console.error(e);
      }
    }
  }

  // Real full-stack Firebase register method
  static async firebaseRegister(name: string, email: string, password: string, role: UserRole): Promise<UserAccount> {
    this.clearCache();
    if (!isFirebaseActive || !firebaseAuth || !firestoreDb) {
      // Fallback
      return this.register(name, email, role);
    }

    const trimmedEmail = email.toLowerCase().trim();
    let assignedRole: UserRole = role;
    const users = this.getRegisteredUsers();

    // Allow registering user directly without pre-authorization when there is no logged-in user context
    if (trimmedEmail !== 'pegyirenyi@gmail.com' && trimmedEmail !== 'multimediageetech@gmail.com' && trimmedEmail !== 'patienceedusah724@gmail.com' && trimmedEmail !== 'sammyotoo06@gmail.com' && trimmedEmail !== 'wilkinsonannan@gmail.com') {
      const isAuthorized = users.some(u => u.email.toLowerCase().trim() === trimmedEmail);
      const currentUser = this.getCurrentUser();

      if (currentUser) {
        const isCurrentAdmin = currentUser?.role === 'Admin' || currentUser?.email?.toLowerCase().trim() === 'pegyirenyi@gmail.com';
        const isCurrentHeadteacher = currentUser?.role === 'Headteacher';

        if (!isAuthorized) {
          if (assignedRole === 'Teacher') {
            if (!isCurrentHeadteacher) {
              throw new Error("Access Denied: Only Headteachers can register Teachers.");
            }
          } else if (assignedRole === 'Headteacher') {
            if (!isCurrentAdmin) {
              throw new Error("Access Denied: Only the Admin can register Headteachers.");
            }
          } else {
            if (!isCurrentAdmin) {
              throw new Error("Access Denied: Only the Admin can authorize and register accounts.");
            }
          }
        }
      }
    }

    if (trimmedEmail === 'pegyirenyi@gmail.com') {
      assignedRole = 'Admin';
    } else if (trimmedEmail === 'multimediageetech@gmail.com' || trimmedEmail === 'sammyotoo06@gmail.com' || trimmedEmail === 'wilkinsonannan@gmail.com') {
      assignedRole = 'Headteacher';
    } else if (trimmedEmail === 'patienceedusah724@gmail.com') {
      assignedRole = 'Teacher';
    } else {
      const currentUser = this.getCurrentUser();
      const isAdmin = currentUser?.role === 'Admin' || currentUser?.email?.toLowerCase().trim() === 'pegyirenyi@gmail.com';
      
      if (assignedRole === 'Headteacher' && currentUser && !isAdmin) {
        // Enforce: only admin can register Headteachers when logged in
        assignedRole = 'Teacher';
      }
      
      // Nobody else can be registered as Admin
      if (assignedRole === 'Admin') {
        assignedRole = 'Teacher';
      }
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      const uid = userCredential.user.uid;
      
      const currentUser = this.getCurrentUser();
      let userSchoolId: string | undefined = undefined;
      if (assignedRole === 'Teacher' && currentUser?.schoolId && currentUser.schoolId !== 'SMS-P8U4F22L' && currentUser.schoolId !== 'school_default') {
        userSchoolId = currentUser.schoolId;
      } else {
        userSchoolId = generateUniqueSchoolId(uid);
      }

      const createdNow = new Date().toISOString();
      const prefix = email.split('@')[0].substring(0, 4).toUpperCase();
      const isSammy = trimmedEmail === 'sammyotoo06@gmail.com';
      const isWilkinson = trimmedEmail === 'wilkinsonannan@gmail.com';
      
      const profile: UserAccount = {
        uid,
        email,
        name,
        role: assignedRole,
        schoolId: userSchoolId,
        createdAt: createdNow,
        licenseType: 'trial',
        registeredOn: createdNow,
        trialEndDate: isWilkinson ? new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString() : isSammy ? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString() : undefined,
        requestCode: isWilkinson ? 'REQ-WILK-7007' : isSammy ? 'REQ-SAMMY-7007' : `REQ-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`
      };

      // Store in users collection
      await setDoc(doc(firestoreDb, 'users', uid), profile);
      
      // Store in local storage
      setStorageItem(STORAGE_KEYS.USER, profile);
      const users = this.getRegisteredUsers();
      if (!users.some(u => u.uid === uid)) {
        users.push(profile);
        await this.saveRegisteredUsers(users);
      }

      return profile;
    } catch (e) {
      throw e;
    }
  }

  // Real full-stack Firebase email/password Login method
  static async firebaseLogin(email: string, password: string): Promise<UserAccount> {
    const prevUser = this.getCurrentUser();
    if (!prevUser || prevUser.email.toLowerCase() !== email.toLowerCase()) {
      this.clearCache();
    }
    if (!isFirebaseActive || !firebaseAuth || !firestoreDb) {
      throw new Error("Firebase Authentication is offline. Please verify your connection.");
    }

    try {
      const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      const uid = userCredential.user.uid;

      // Retrieve user profile data with offline resiliency
      let userDoc = null;
      let isOffline = false;
      try {
        userDoc = await getDoc(doc(firestoreDb, 'users', uid));
      } catch (getDocErr: any) {
        const errMsg = (getDocErr?.message || getDocErr?.code || String(getDocErr)).toLowerCase();
        if (errMsg.includes("offline") || errMsg.includes("unavailable") || errMsg.includes("network") || !navigator.onLine) {
          console.warn("Firestore offline during login profile fetch. Falling back to cached local storage profile.");
          isOffline = true;
        } else {
          throw getDocErr;
        }
      }

      const userProfile = userDoc?.exists() ? userDoc.data() as UserAccount : null;
      const assignedRole: UserRole = userProfile?.role || this.determineRole(email);

      if (isOffline) {
        const cachedUsers = this.getRegisteredUsers();
        const localUser = cachedUsers.find(u => u.uid === uid) || this.getCurrentUser();
        if (localUser && localUser.uid === uid) {
          setStorageItem(STORAGE_KEYS.USER, localUser);
          return localUser;
        }
        // If no cached local user exists, create one locally
        const createdNow = new Date().toISOString();
        const prefix = email.split('@')[0].substring(0, 4).toUpperCase();
        const profile: UserAccount = {
          uid,
          email,
          name: email.split('@')[0].toUpperCase(),
          role: assignedRole,
          createdAt: createdNow,
          licenseType: 'trial',
          registeredOn: createdNow,
          requestCode: `REQ-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`
        };
        setStorageItem(STORAGE_KEYS.USER, profile);
        return profile;
      }

      if (userDoc && userDoc.exists()) {
        const profile = userDoc.data() as UserAccount;
        let profileChanged = false;
        
        if (profile.role !== assignedRole) {
          profile.role = assignedRole;
          profileChanged = true;
        }
        if (!profile.licenseType) {
          profile.licenseType = 'trial';
          profileChanged = true;
        }
        if (!profile.registeredOn) {
          profile.registeredOn = profile.createdAt || new Date().toISOString();
          profileChanged = true;
        }
        if (!profile.requestCode) {
          const prefix = profile.email.split('@')[0].substring(0, 4).toUpperCase();
          profile.requestCode = `REQ-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
          profileChanged = true;
        }
        
        if (profileChanged) {
          await setDoc(doc(firestoreDb, 'users', uid), profile);
        }
        
        setStorageItem(STORAGE_KEYS.USER, profile);
        
        const users = this.getRegisteredUsers();
        const existingIdx = users.findIndex(u => u.uid === uid);
        if (existingIdx >= 0) {
          users[existingIdx] = profile;
        } else {
          users.push(profile);
        }
        await this.saveRegisteredUsers(users);
        return profile;
      } else {
        // Create user profile document if missing
        const createdNow = new Date().toISOString();
        const prefix = email.split('@')[0].substring(0, 4).toUpperCase();
        const emailLower = email.toLowerCase().trim();
        const isWilkinson = emailLower === 'wilkinsonannan@gmail.com';
        const isSammy = emailLower === 'sammyotoo06@gmail.com';
        const trialDays = isWilkinson ? 21 : isSammy ? 15 : 14;
        const profile: UserAccount = {
          uid,
          email,
          name: email.split('@')[0].toUpperCase(),
          role: assignedRole,
          schoolId: generateUniqueSchoolId(uid),
          createdAt: createdNow,
          licenseType: assignedRole === 'Admin' ? 'unlimited' : 'trial',
          registeredOn: createdNow,
          trialEndDate: assignedRole === 'Admin' ? undefined : new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString(),
          requestCode: `REQ-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`
        };
        await setDoc(doc(firestoreDb, 'users', uid), profile);
        setStorageItem(STORAGE_KEYS.USER, profile);
        
        const users = this.getRegisteredUsers();
        if (!users.some(u => u.uid === uid)) {
          users.push(profile);
          await this.saveRegisteredUsers(users);
        }
        
        return profile;
      }
    } catch (e) {
      throw e;
    }
  }

  static async teacherLogin(email: string, schoolId: string): Promise<UserAccount> {
    const trimmedEmail = email.toLowerCase().trim();
    
    // Fallback: check local users list first
    const cachedUsers = this.getRegisteredUsers();
    let userAccount = cachedUsers.find(u => u.email.toLowerCase().trim() === trimmedEmail);
    
    if (isFirebaseActive && firestoreDb) {
      try {
        // Try to fetch from firestore first
        const usersRef = collection(firestoreDb, 'users');
        const q = query(usersRef, where("email", "==", trimmedEmail));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          userAccount = querySnapshot.docs[0].data() as UserAccount;
        }
      } catch (e) {
        console.warn("Failed to fetch user from Firestore during teacher login:", e);
      }
    }
    
    if (!userAccount) {
      // Auto-bootstrap user account if present in teacher profiles
      const teachers = this.getTeachers();
      const match = teachers.find(t => t.email?.toLowerCase().trim() === trimmedEmail);
      if (match) {
        const createdNow = new Date().toISOString();
        userAccount = {
          uid: match.id || ('user_' + Math.random().toString(36).substring(2, 9)),
          email: trimmedEmail,
          name: `${match.firstName} ${match.lastName}`.trim(),
          role: 'Teacher',
          staffId: match.staffId,
          schoolId: schoolId || match.schoolId || this.getSchoolInfo().schoolId || "school_default",
          createdAt: createdNow,
          licenseType: 'trial',
          registeredOn: createdNow
        };
        cachedUsers.push(userAccount);
        setStorageItem(STORAGE_KEYS.USERS_LIST, cachedUsers);
      } else {
        throw new Error("Account not found. Please ensure you are registered.");
      }
    }
    
    if (userAccount.role !== 'Teacher' && userAccount.role !== 'Headteacher' && userAccount.role !== 'Admin') {
      userAccount.role = 'Teacher';
      setStorageItem(STORAGE_KEYS.USERS_LIST, cachedUsers);
    }
    
    if (schoolId && userAccount.schoolId !== schoolId) {
      userAccount.schoolId = schoolId;
      setStorageItem(STORAGE_KEYS.USERS_LIST, cachedUsers);
    }
    
    setStorageItem(STORAGE_KEYS.USER, userAccount);
    this.syncCurrentUserToFirebase(userAccount).catch(() => {});
    return userAccount;
  }

  static generateBadgeSignature(staffId: string, email: string, schoolId: string): string {
    const salt = "GES-SECURE-KEY-7007";
    const payload = `${staffId.trim().toLowerCase()}:${email.trim().toLowerCase()}:${schoolId.trim().toLowerCase()}:${salt}`;
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      const char = payload.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).toUpperCase();
  }

  static async teacherLoginByBadge(badgeData: string, expectedTeacherId?: string): Promise<UserAccount> {
    let email: string | undefined;
    let staffId: string | undefined;
    let schoolId: string | undefined;
    let isSignedJson = false;
    let isSignatureValid = false;

    // 1. Try parsing badgeData as JSON
    try {
      const parsed = JSON.parse(badgeData);
      if (parsed && typeof parsed === 'object') {
        email = parsed.email || parsed.Email;
        staffId = parsed.staffId || parsed.StaffId || parsed.staffid || parsed.id || parsed.Id;
        schoolId = parsed.schoolId || parsed.SchoolId || parsed.schoolid;
        
        const signature = parsed.signature || parsed.Signature;
        if (signature) {
          isSignedJson = true;
          const expectedSig = this.generateBadgeSignature(staffId || '', email || '', schoolId || "school_default");
          if (signature === expectedSig) {
            isSignatureValid = true;
          }
        }
      }
    } catch (e) {
      // Not JSON, treat as plain text email or staffId
      const cleanData = badgeData.trim();
      if (cleanData.includes('@')) {
        email = cleanData;
      } else {
        staffId = cleanData;
      }
    }

    // Strict security check: If it was a JSON badge generated by our system, it MUST have a valid signature
    if (isSignedJson && !isSignatureValid) {
      throw new Error("Security Violation: Cryptographic signature mismatch! The scanned QR badge appears spoofed, modified, or generated by an untrusted origin. Faculty login blocked.");
    }

    const cleanEmail = email?.toLowerCase().trim();
    const cleanStaffId = staffId?.toLowerCase().trim();
    const cleanRaw = badgeData.trim().toLowerCase();

    // 2. Locate the corresponding teacher in registry
    const teachers = this.getTeachers();
    let matchingTeacher: Teacher | undefined;

    // Search A: By email
    if (cleanEmail && cleanEmail.length > 0) {
      matchingTeacher = teachers.find(t => t.email?.toLowerCase().trim() === cleanEmail);
    }

    // Search B: By staffId or id (including clean alphanumeric comparison)
    if (!matchingTeacher && cleanStaffId && cleanStaffId.length > 0) {
      matchingTeacher = teachers.find(t => {
        const sId = t.staffId?.toLowerCase().trim();
        const id = t.id?.toLowerCase().trim();
        const cleanSId = sId?.replace(/[^a-z0-9]/g, '');
        const targetClean = cleanStaffId.replace(/[^a-z0-9]/g, '');

        return (
          sId === cleanStaffId ||
          id === cleanStaffId ||
          (cleanSId && targetClean && cleanSId === targetClean)
        );
      });
    }

    // Search C: By raw payload against email, staffId, id, or full name
    if (!matchingTeacher && cleanRaw.length > 0) {
      matchingTeacher = teachers.find(t => {
        const tEmail = t.email?.toLowerCase().trim();
        const tStaffId = t.staffId?.toLowerCase().trim();
        const tId = t.id?.toLowerCase().trim();
        const tFullName = `${t.firstName} ${t.lastName}`.toLowerCase().trim();

        return (
          (tEmail && (tEmail === cleanRaw || cleanRaw.includes(tEmail))) ||
          (tStaffId && (tStaffId === cleanRaw || cleanRaw.includes(tStaffId))) ||
          (tId && (tId === cleanRaw || cleanRaw.includes(tId))) ||
          (tFullName && (tFullName === cleanRaw || cleanRaw.includes(tFullName)))
        );
      });
    }

    // Search D: Check registered UserAccounts if not found in teachers registry
    if (!matchingTeacher) {
      const users = this.getRegisteredUsers();
      const matchedUser = users.find(u => {
        const uEmail = u.email?.toLowerCase().trim();
        const uStaffId = u.staffId?.toLowerCase().trim();
        const uUid = u.uid?.toLowerCase().trim();
        const uName = u.name?.toLowerCase().trim();

        return (
          (cleanEmail && uEmail === cleanEmail) ||
          (cleanStaffId && (uStaffId === cleanStaffId || uUid === cleanStaffId)) ||
          (cleanRaw && (uEmail === cleanRaw || uStaffId === cleanRaw || uUid === cleanRaw || uName === cleanRaw))
        );
      });

      if (matchedUser) {
        const nameParts = matchedUser.name.split(' ');
        matchingTeacher = {
          id: matchedUser.uid || `t_${Math.random().toString(36).substring(2, 7)}`,
          firstName: nameParts[0] || matchedUser.name,
          lastName: nameParts.slice(1).join(' ') || 'Staff',
          gender: 'Male',
          dateOfBirth: '1990-01-01',
          placeOfBirth: 'Accra',
          subjectsTaught: 'Class Teacher',
          professionalQualifications: 'Degree',
          highestAcademicQualifications: 'Bachelor of Education',
          rank: 'Senior Superintendent I',
          dateOfFirstAppointment: new Date().toISOString().split('T')[0],
          dateOfPostingToCurrentStation: new Date().toISOString().split('T')[0],
          staffId: matchedUser.staffId || matchedUser.uid || 'STAFF-01',
          ntcNumber: '',
          ssnitNumber: '',
          district: '',
          circuit: '',
          photoUrl: '',
          createdAt: new Date().toISOString(),
          email: matchedUser.email,
          schoolId: matchedUser.schoolId,
          assignedClass: 'None',
          assignedClasses: [],
          assignedSubjects: []
        };
        this.saveTeacher(matchingTeacher);
      }
    }

    if (!matchingTeacher) {
      throw new Error(`Access Denied: Unrecognized badge details "${badgeData.substring(0, 40)}...". Please ensure the teacher is registered in the Staff Directory.`);
    }

    if (expectedTeacherId && matchingTeacher) {
      const matchId = matchingTeacher.id?.toLowerCase().trim();
      const matchStaffId = matchingTeacher.staffId?.toLowerCase().trim();
      const expTarget = expectedTeacherId.toLowerCase().trim();
      if (matchId !== expTarget && matchStaffId !== expTarget) {
        throw new Error(`Security Violation: The scanned QR badge (${matchingTeacher.firstName} ${matchingTeacher.lastName}) does NOT match the selected teacher profile. Access denied.`);
      }
    }

    // Ensure matchingTeacher has a non-empty email address
    let teacherEmail = matchingTeacher.email?.toLowerCase().trim();
    if (!teacherEmail) {
      const safeId = (matchingTeacher.staffId || matchingTeacher.id || 'teacher').toLowerCase().replace(/[^a-z0-9]/g, '');
      teacherEmail = `${safeId}@school.internal`;
      matchingTeacher.email = teacherEmail;
      this.saveTeacher(matchingTeacher);
    }

    // 3. Find or bootstrap UserAccount
    const activeSchoolId = schoolId || matchingTeacher.schoolId || this.getSchoolInfo().schoolId || "school_default";
    const users = this.getRegisteredUsers();
    let userAccount = users.find(u => u.email.toLowerCase().trim() === teacherEmail!.toLowerCase().trim());

    if (!userAccount) {
      const createdNow = new Date().toISOString();
      userAccount = {
        uid: matchingTeacher.id || ('user_' + Math.random().toString(36).substring(2, 9)),
        email: teacherEmail,
        name: `${matchingTeacher.firstName} ${matchingTeacher.lastName}`.trim(),
        role: 'Teacher',
        staffId: matchingTeacher.staffId,
        schoolId: activeSchoolId,
        createdAt: createdNow,
        licenseType: 'trial',
        registeredOn: createdNow
      };
      users.push(userAccount);
      setStorageItem(STORAGE_KEYS.USERS_LIST, users);
    } else {
      let updated = false;
      if (userAccount.role !== 'Teacher' && userAccount.role !== 'Headteacher' && userAccount.role !== 'Admin') {
        userAccount.role = 'Teacher';
        updated = true;
      }
      if (userAccount.schoolId !== activeSchoolId) {
        userAccount.schoolId = activeSchoolId;
        updated = true;
      }
      if (!userAccount.staffId && matchingTeacher.staffId) {
        userAccount.staffId = matchingTeacher.staffId;
        updated = true;
      }
      if (updated) {
        setStorageItem(STORAGE_KEYS.USERS_LIST, users);
      }
    }

    // 4. Authenticate user
    setStorageItem(STORAGE_KEYS.USER, userAccount);
    return userAccount;
  }

  // Real full-stack Firebase sendPasswordResetEmail method
  static async firebaseSendPasswordResetEmail(email: string): Promise<void> {
    if (!isFirebaseActive || !firebaseAuth) {
      throw new Error("Firebase Authentication is offline. Please verify your connection.");
    }
    try {
      await sendPasswordResetEmail(firebaseAuth, email);
    } catch (e) {
      throw e;
    }
  }

  // Real full-stack Firebase Google Login method
  static async firebaseGoogleLogin(): Promise<{ user: UserAccount; isNew: boolean }> {
    if (!isFirebaseActive || !firebaseAuth || !firestoreDb) {
      throw new Error("Firebase is offline. Google sign in requires an active Firebase instance.");
    }

    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.file');

    try {
      const result = await signInWithPopup(firebaseAuth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential && credential.accessToken) {
        localStorage.setItem('google_access_token', credential.accessToken);
      }
      const user = result.user;
      const email = user.email || '';
      
      const trimmedEmail = email.toLowerCase().trim();
      // Enforce Google account pre-authorization check to allow only registered emails to login/register via Google SSO
      if (trimmedEmail !== 'pegyirenyi@gmail.com' && trimmedEmail !== 'multimediageetech@gmail.com' && trimmedEmail !== 'patienceedusah724@gmail.com' && trimmedEmail !== 'sammyotoo06@gmail.com' && trimmedEmail !== 'wilkinsonannan@gmail.com') {
        const users = this.getRegisteredUsers();
        const isAuthorized = users.some(u => u.email.toLowerCase().trim() === trimmedEmail);
        if (!isAuthorized) {
          await signOut(firebaseAuth);
          throw new Error("Access Denied: Your Google account email (" + email + ") is not registered by the Admin. Please contact the System Administrator to register your account.");
        }
      }

      const prevUser = this.getCurrentUser();
      if (!prevUser || prevUser.email.toLowerCase() !== email.toLowerCase()) {
        this.clearCache();
      }
      const assignedRole: UserRole = this.determineRole(email);
      
      // Check if user profile already exists in Firestore with offline resilience
      let userDocSnapshot = null;
      let isOffline = false;
      
      // Pre-check local cache for immediate availability
      const cachedUsers = this.getRegisteredUsers();
      const cachedLocalUser = (cachedUsers.find(u => u.uid === user.uid) || this.getCurrentUser()) as UserAccount | null;
      
      try {
        // Optimization: Race the remote fetch with a 10000ms timeout to prevent sign-in from "hanging" 
        // indefinitely on slow connections. We proceed with the local profile if it times out.
        const fetchPromise = getDoc(doc(firestoreDb, 'users', user.uid));
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 10000));
        
        userDocSnapshot = await Promise.race([fetchPromise, timeoutPromise]) as any;
      } catch (getDocErr: any) {
        const errMsg = (getDocErr?.message || getDocErr?.code || String(getDocErr)).toLowerCase();
        if (errMsg === "timeout" || errMsg.includes("offline") || errMsg.includes("unavailable") || errMsg.includes("network") || !navigator.onLine) {
          console.warn("Firestore profile fetch timed out or offline. Using local session fallback for immediate access.");
          isOffline = true;
        } else {
          throw getDocErr;
        }
      }

      if (isOffline) {
        if (cachedLocalUser && cachedLocalUser.uid === user.uid) {
          setStorageItem(STORAGE_KEYS.USER, cachedLocalUser);
          return { user: cachedLocalUser, isNew: false };
        }
        const tempProfile: UserAccount = {
          uid: user.uid,
          email: email,
          name: user.displayName || email.split('@')[0] || 'Google User',
          role: assignedRole,
          createdAt: new Date().toISOString()
        };
        setStorageItem(STORAGE_KEYS.USER, tempProfile);
        return { user: tempProfile, isNew: true };
      }

      if (userDocSnapshot && userDocSnapshot.exists()) {
        const profile = userDocSnapshot.data() as UserAccount;
        let profileChanged = false;
        
        if (profile.role !== assignedRole) {
          profile.role = assignedRole;
          profileChanged = true;
        }
        if (!profile.licenseType) {
          profile.licenseType = 'trial';
          profileChanged = true;
        }
        if (!profile.registeredOn) {
          profile.registeredOn = profile.createdAt || new Date().toISOString();
          profileChanged = true;
        }
        if (!profile.requestCode) {
          const prefix = profile.email.split('@')[0].substring(0, 4).toUpperCase();
          profile.requestCode = `REQ-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
          profileChanged = true;
        }
        
        if (profileChanged) {
          await setDoc(doc(firestoreDb, 'users', user.uid), profile);
        }
        
        setStorageItem(STORAGE_KEYS.USER, profile);
        
        const users = this.getRegisteredUsers();
        const existingIdx = users.findIndex(u => u.uid === user.uid);
        if (existingIdx >= 0) {
          users[existingIdx] = profile;
        } else {
          users.push(profile);
        }
        await this.saveRegisteredUsers(users);
        
        return { user: profile, isNew: false };
      } else {
        const tempProfile: UserAccount = {
          uid: user.uid,
          email: email,
          name: user.displayName || email.split('@')[0] || 'Google User',
          role: assignedRole,
          createdAt: new Date().toISOString()
        };
        
        // Ensure new Google users are also added to the list immediately
        const users = this.getRegisteredUsers();
        if (!users.some(u => u.uid === tempProfile.uid)) {
          users.push(tempProfile);
          await this.saveRegisteredUsers(users);
        }
        
        return { user: tempProfile, isNew: true };
      }
    } catch (e) {
      throw e;
    }
  }

  // Real full-stack Firebase Microsoft Login method
  static async firebaseMicrosoftLogin(): Promise<{ user: UserAccount; isNew: boolean }> {
    if (!isFirebaseActive || !firebaseAuth || !firestoreDb) {
      throw new Error("Firebase is offline. Microsoft sign in requires an active Firebase instance.");
    }

    try {
      const provider = new OAuthProvider('microsoft.com');
      const result = await signInWithPopup(firebaseAuth, provider);
      const user = result.user;
      const email = user.email || '';
      
      const trimmedEmail = email.toLowerCase().trim();
      // Enforce Microsoft account pre-authorization check to allow only registered emails to login/register via Microsoft SSO
      if (trimmedEmail !== 'pegyirenyi@gmail.com' && trimmedEmail !== 'multimediageetech@gmail.com' && trimmedEmail !== 'patienceedusah724@gmail.com' && trimmedEmail !== 'sammyotoo06@gmail.com' && trimmedEmail !== 'wilkinsonannan@gmail.com') {
        const users = this.getRegisteredUsers();
        const isAuthorized = users.some(u => u.email.toLowerCase().trim() === trimmedEmail);
        if (!isAuthorized) {
          await signOut(firebaseAuth);
          throw new Error("Access Denied: Your Microsoft account email (" + email + ") is not registered by the Admin. Please contact the System Administrator to register your account.");
        }
      }

      const assignedRole: UserRole = this.determineRole(email);
      
      // Check if user profile already exists in Firestore with offline resilience
      let userDocSnapshot = null;
      let isOffline = false;
      try {
        userDocSnapshot = await getDoc(doc(firestoreDb, 'users', user.uid));
      } catch (getDocErr: any) {
        const errMsg = (getDocErr?.message || getDocErr?.code || String(getDocErr)).toLowerCase();
        if (errMsg.includes("offline") || errMsg.includes("unavailable") || errMsg.includes("network") || !navigator.onLine) {
          console.warn("Firestore offline during Microsoft login profile fetch. Falling back to cached local storage profile.");
          isOffline = true;
        } else {
          throw getDocErr;
        }
      }

      if (isOffline) {
        const cachedUsers = this.getRegisteredUsers();
        const localUser = cachedUsers.find(u => u.uid === user.uid) || this.getCurrentUser();
        if (localUser && localUser.uid === user.uid) {
          setStorageItem(STORAGE_KEYS.USER, localUser);
          return { user: localUser, isNew: false };
        }
        const tempProfile: UserAccount = {
          uid: user.uid,
          email: email,
          name: user.displayName || email.split('@')[0] || 'Microsoft User',
          role: assignedRole,
          createdAt: new Date().toISOString()
        };
        setStorageItem(STORAGE_KEYS.USER, tempProfile);
        return { user: tempProfile, isNew: true };
      }

      if (userDocSnapshot && userDocSnapshot.exists()) {
        const profile = userDocSnapshot.data() as UserAccount;
        let profileChanged = false;
        
        if (profile.role !== assignedRole) {
          profile.role = assignedRole;
          profileChanged = true;
        }
        if (!profile.licenseType) {
          profile.licenseType = 'trial';
          profileChanged = true;
        }
        if (!profile.registeredOn) {
          profile.registeredOn = profile.createdAt || new Date().toISOString();
          profileChanged = true;
        }
        if (!profile.requestCode) {
          const prefix = profile.email.split('@')[0].substring(0, 4).toUpperCase();
          profile.requestCode = `REQ-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
          profileChanged = true;
        }
        
        if (profileChanged) {
          await setDoc(doc(firestoreDb, 'users', user.uid), profile);
        }
        
        setStorageItem(STORAGE_KEYS.USER, profile);
        
        const users = this.getRegisteredUsers();
        const existingIdx = users.findIndex(u => u.uid === user.uid);
        if (existingIdx >= 0) {
          users[existingIdx] = profile;
        } else {
          users.push(profile);
        }
        await this.saveRegisteredUsers(users);
        
        return { user: profile, isNew: false };
      } else {
        const tempProfile: UserAccount = {
          uid: user.uid,
          email: email,
          name: user.displayName || email.split('@')[0] || 'Microsoft User',
          role: assignedRole,
          createdAt: new Date().toISOString()
        };
        
        // Ensure new Microsoft users are also added to the list immediately
        const users = this.getRegisteredUsers();
        if (!users.some(u => u.uid === tempProfile.uid)) {
          users.push(tempProfile);
          await this.saveRegisteredUsers(users);
        }
        
        return { user: tempProfile, isNew: true };
      }
    } catch (e) {
      throw e;
    }
  }

  // Real full-stack Firebase Apple Login method
  static async firebaseAppleLogin(): Promise<{ user: UserAccount; isNew: boolean }> {
    if (!isFirebaseActive || !firebaseAuth || !firestoreDb) {
      throw new Error("Firebase is offline. Apple sign in requires an active Firebase instance.");
    }

    try {
      const provider = new OAuthProvider('apple.com');
      const result = await signInWithPopup(firebaseAuth, provider);
      const user = result.user;
      const email = user.email || '';
      const trimmedEmail = email.toLowerCase().trim();
      
      // Enforce Apple account pre-authorization check to allow only registered emails to login/register via Apple SSO
      if (trimmedEmail !== 'pegyirenyi@gmail.com' && trimmedEmail !== 'multimediageetech@gmail.com' && trimmedEmail !== 'patienceedusah724@gmail.com' && trimmedEmail !== 'sammyotoo06@gmail.com' && trimmedEmail !== 'wilkinsonannan@gmail.com') {
        const users = this.getRegisteredUsers();
        const isAuthorized = users.some(u => u.email.toLowerCase().trim() === trimmedEmail);
        if (!isAuthorized) {
          await signOut(firebaseAuth);
          throw new Error("Access Denied: Your Apple account email (" + email + ") is not registered by the Admin. Please contact the System Administrator to register your account.");
        }
      }

      const assignedRole: UserRole = this.determineRole(email);
      
      // Check if user profile already exists in Firestore with offline resilience
      let userDocSnapshot = null;
      let isOffline = false;
      try {
        userDocSnapshot = await getDoc(doc(firestoreDb, 'users', user.uid));
      } catch (getDocErr: any) {
        const errMsg = (getDocErr?.message || getDocErr?.code || String(getDocErr)).toLowerCase();
        if (errMsg.includes("offline") || errMsg.includes("unavailable") || errMsg.includes("network") || !navigator.onLine) {
          console.warn("Firestore offline during Apple login profile fetch. Falling back to cached local storage profile.");
          isOffline = true;
        } else {
          throw getDocErr;
        }
      }

      if (isOffline) {
        const cachedUsers = this.getRegisteredUsers();
        const localUser = cachedUsers.find(u => u.uid === user.uid) || this.getCurrentUser();
        if (localUser && localUser.uid === user.uid) {
          setStorageItem(STORAGE_KEYS.USER, localUser);
          return { user: localUser, isNew: false };
        }
        const tempProfile: UserAccount = {
          uid: user.uid,
          email: email,
          name: user.displayName || email.split('@')[0] || 'Apple User',
          role: assignedRole,
          createdAt: new Date().toISOString()
        };
        setStorageItem(STORAGE_KEYS.USER, tempProfile);
        return { user: tempProfile, isNew: true };
      }

      if (userDocSnapshot && userDocSnapshot.exists()) {
        const profile = userDocSnapshot.data() as UserAccount;
        let profileChanged = false;
        
        if (profile.role !== assignedRole) {
          profile.role = assignedRole;
          profileChanged = true;
        }
        if (!profile.licenseType) {
          profile.licenseType = 'trial';
          profileChanged = true;
        }
        if (!profile.registeredOn) {
          profile.registeredOn = profile.createdAt || new Date().toISOString();
          profileChanged = true;
        }
        if (!profile.requestCode) {
          const prefix = profile.email.split('@')[0].substring(0, 4).toUpperCase();
          profile.requestCode = `REQ-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
          profileChanged = true;
        }
        
        if (profileChanged) {
          await setDoc(doc(firestoreDb, 'users', user.uid), profile);
        }
        
        setStorageItem(STORAGE_KEYS.USER, profile);
        
        const users = this.getRegisteredUsers();
        const existingIdx = users.findIndex(u => u.uid === user.uid);
        if (existingIdx >= 0) {
          users[existingIdx] = profile;
        } else {
          users.push(profile);
        }
        await this.saveRegisteredUsers(users);
        
        return { user: profile, isNew: false };
      } else {
        const tempProfile: UserAccount = {
          uid: user.uid,
          email: email,
          name: user.displayName || email.split('@')[0] || 'Apple User',
          role: assignedRole,
          createdAt: new Date().toISOString()
        };
        
        // Ensure new Apple users are also added to the list immediately
        const users = this.getRegisteredUsers();
        if (!users.some(u => u.uid === tempProfile.uid)) {
          users.push(tempProfile);
          await this.saveRegisteredUsers(users);
        }
        
        return { user: tempProfile, isNew: true };
      }
    } catch (e) {
      throw e;
    }
  }

  // Create or confirm Google User Profile
  static async saveGoogleProfile(profile: UserAccount): Promise<UserAccount> {
    const assignedRole: UserRole = this.determineRole(profile.email);
    const createdNow = profile.createdAt || new Date().toISOString();
    const prefix = profile.email.split('@')[0].substring(0, 4).toUpperCase();
    const emailLower = profile.email.toLowerCase().trim();
    const isMultiMedia = emailLower === 'multimediageetech@gmail.com';
    const isSammy = emailLower === 'sammyotoo06@gmail.com';
    const isWilkinson = emailLower === 'wilkinsonannan@gmail.com';
    const isSpecialHeadteacher = isMultiMedia || isSammy || isWilkinson;
    const nowMs = Date.now();
    const trialDaysMs = (isWilkinson ? 21 : isSammy ? 15 : 14) * 24 * 60 * 60 * 1000;
    const computedTrialEnd = profile.trialEndDate || new Date(nowMs + trialDaysMs).toISOString();

    const isAdminUser = emailLower === 'pegyirenyi@gmail.com' || assignedRole === 'Admin';
    const isAlreadyActivated = profile.licenseType === 'activated' || profile.licenseType === 'unlimited';

    const updatedProfile = {
      ...profile,
      role: isSpecialHeadteacher ? ('Headteacher' as UserRole) : assignedRole,
      schoolId: (profile.schoolId && profile.schoolId !== 'SMS-P8U4F22L' && profile.schoolId !== 'school_default') ? profile.schoolId : generateUniqueSchoolId(profile.uid),
      licenseType: isAdminUser ? 'unlimited' : (profile.licenseType || 'trial'),
      registeredOn: profile.registeredOn || createdNow,
      trialEndDate: isAdminUser ? undefined : (isAlreadyActivated ? profile.trialEndDate : (profile.trialEndDate || computedTrialEnd)),
      requestCode: isWilkinson
        ? 'REQ-WILK-7007'
        : isSammy
        ? 'REQ-SAMMY-7007'
        : (isMultiMedia && (profile.requestCode === 'REQ-MULTI-8888' || profile.requestCode?.endsWith('8888') || !profile.requestCode))
        ? 'REQ-MULTI-7007'
        : (profile.requestCode || `REQ-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`)
    };

    const sanitizedProfile = { ...updatedProfile };
    for (const key in sanitizedProfile) {
      if (sanitizedProfile[key as keyof typeof sanitizedProfile] === undefined) {
        delete sanitizedProfile[key as keyof typeof sanitizedProfile];
      }
    }

    if (isFirebaseActive && firestoreDb) {
      try {
        await setDoc(doc(firestoreDb, 'users', sanitizedProfile.uid), sanitizedProfile);
      } catch (e: any) {
        const errMsg = (e?.message || e?.code || String(e)).toLowerCase();
        if (errMsg.includes("offline") || errMsg.includes("unavailable") || errMsg.includes("network") || !navigator.onLine) {
          console.warn("Firestore client is offline. Enqueueing user profile save for later offline sync.");
          this.enqueueOfflineOperation('users', sanitizedProfile.uid, 'set', sanitizedProfile);
        } else {
          handleFirestoreError(e, OperationType.WRITE, `users/${sanitizedProfile.uid}`);
          throw e;
        }
      }
    }
    setStorageItem(STORAGE_KEYS.USER, sanitizedProfile);
    const users = this.getRegisteredUsers();
    const existingIdx = users.findIndex(u => u.uid === sanitizedProfile.uid);
    if (existingIdx >= 0) {
      users[existingIdx] = sanitizedProfile;
    } else {
      users.push(sanitizedProfile);
    }
    setStorageItem(STORAGE_KEYS.USERS_LIST, users);
    return updatedProfile;
  }

  // Save user profile details only in local storage cache (avoiding recursive Firestore writes)
  static saveProfileLocally(profile: UserAccount): UserAccount {
    const assignedRole: UserRole = this.determineRole(profile.email);
    const createdNow = profile.createdAt || new Date().toISOString();
    const prefix = profile.email.split('@')[0].substring(0, 4).toUpperCase();
    const emailLower = profile.email.toLowerCase().trim();
    const isMultiMedia = emailLower === 'multimediageetech@gmail.com';
    const isSammy = emailLower === 'sammyotoo06@gmail.com';
    const isWilkinson = emailLower === 'wilkinsonannan@gmail.com';
    const isSpecialHeadteacher = isMultiMedia || isSammy || isWilkinson;
    const nowMs = Date.now();
    const trialDaysMs = (isWilkinson ? 21 : isSammy ? 15 : 14) * 24 * 60 * 60 * 1000;
    const computedTrialEnd = profile.trialEndDate && new Date(profile.trialEndDate).getTime() > nowMs
      ? profile.trialEndDate
      : new Date(nowMs + trialDaysMs).toISOString();

    const isAdminUser = emailLower === 'pegyirenyi@gmail.com' || assignedRole === 'Admin';
    const isAlreadyActivated = profile.licenseType === 'activated' || profile.licenseType === 'unlimited';

    const updatedProfile = {
      ...profile,
      role: isSpecialHeadteacher ? ('Headteacher' as UserRole) : assignedRole,
      schoolId: (profile.schoolId && profile.schoolId !== 'SMS-P8U4F22L' && profile.schoolId !== 'school_default') ? profile.schoolId : generateUniqueSchoolId(profile.uid),
      licenseType: isAdminUser ? 'unlimited' : (profile.licenseType || 'trial'),
      registeredOn: profile.registeredOn || createdNow,
      trialEndDate: isAdminUser ? undefined : (isAlreadyActivated ? profile.trialEndDate : computedTrialEnd),
      requestCode: isWilkinson
        ? 'REQ-WILK-7007'
        : isSammy
        ? 'REQ-SAMMY-7007'
        : (isMultiMedia && (profile.requestCode === 'REQ-MULTI-8888' || profile.requestCode?.endsWith('8888') || !profile.requestCode))
        ? 'REQ-MULTI-7007'
        : (profile.requestCode || `REQ-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`)
    };

    const sanitizedProfile = { ...updatedProfile };
    for (const key in sanitizedProfile) {
      if (sanitizedProfile[key as keyof typeof sanitizedProfile] === undefined) {
        delete sanitizedProfile[key as keyof typeof sanitizedProfile];
      }
    }

    setStorageItem(STORAGE_KEYS.USER, sanitizedProfile);
    const users = this.getRegisteredUsers();
    const existingIdx = users.findIndex(u => u.uid === sanitizedProfile.uid);
    if (existingIdx >= 0) {
      users[existingIdx] = sanitizedProfile;
    } else {
      users.push(sanitizedProfile);
    }
    setStorageItem(STORAGE_KEYS.USERS_LIST, users);
    return sanitizedProfile;
  }

  // Retrieve user profile data by UID directly
  static async getFirebaseUserProfile(uid: string): Promise<UserAccount | null> {
    if (!uid || uid === 'H5nlyq30sANEMixDEmURnYoyUzU2') {
      if (uid === 'H5nlyq30sANEMixDEmURnYoyUzU2' && isFirebaseActive && firestoreDb) {
        deleteDoc(doc(firestoreDb, 'users', 'H5nlyq30sANEMixDEmURnYoyUzU2')).catch(() => {});
      }
      return null;
    }
    if (!isFirebaseActive || !firestoreDb) return null;
    try {
      // Optimization: Add a 10000ms timeout to prevent profile fetch from blocking startup
      const fetchPromise = getDoc(doc(firestoreDb, 'users', uid));
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 10000));
      const userDoc = await Promise.race([fetchPromise, timeoutPromise]) as any;
      
      if (userDoc.exists()) {
        const data = userDoc.data() as UserAccount;
        if (data?.uid === 'H5nlyq30sANEMixDEmURnYoyUzU2') {
          deleteDoc(doc(firestoreDb, 'users', 'H5nlyq30sANEMixDEmURnYoyUzU2')).catch(() => {});
          return null;
        }
        return data;
      }
    } catch (e: any) {
      const errMsg = (e?.message || e?.code || String(e)).toLowerCase();
      if (errMsg === "timeout" || errMsg.includes("offline") || errMsg.includes("unavailable") || errMsg.includes("network") || !navigator.onLine) {
        console.warn("Firestore client is offline or timed out. Resolving user profile from cache/localStorage instead of failing.");
        
        // 1. Try to get from local users list
        const cachedUsers = getStorageItem<UserAccount[]>(STORAGE_KEYS.USERS_LIST, []);
        const localUser = cachedUsers.find(u => u.uid === uid);
        if (localUser) {
          return localUser;
        }
        
        // 2. Try the current user fallback
        const curr = this.getCurrentUser();
        if (curr && curr.uid === uid) {
          return curr;
        }
        return null;
      }
      handleFirestoreError(e, OperationType.GET, `users/${uid}`);
      throw e;
    }
    return null;
  }

  // Retrieve school profile document by schoolId directly from Firestore
  static async getFirebaseSchoolProfile(schoolId: string): Promise<SchoolInfo | null> {
    if (!isFirebaseActive || !firestoreDb || !schoolId) return null;
    try {
      const fetchPromise = getDoc(doc(firestoreDb, 'schools', schoolId));
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 10000));
      const schoolDoc = await Promise.race([fetchPromise, timeoutPromise]) as any;

      if (schoolDoc && schoolDoc.exists()) {
        const schoolData = schoolDoc.data() as SchoolInfo;
        console.log("School Profile fetched from Firestore:", schoolData);
        return schoolData;
      }
      return null;
    } catch (e: any) {
      console.warn(`Failed to fetch school profile for ID ${schoolId}:`, e);
      handleFirestoreError(e, OperationType.GET, `schools/${schoolId}`);
      return null;
    }
  }

  // Fetch user's assigned school profile using onAuthStateChanged workflow
  static async fetchUserAssignedSchoolProfile(uid: string): Promise<{ schoolId?: string; schoolProfile?: SchoolInfo | null }> {
    if (!isFirebaseActive || !firestoreDb || !uid) return { schoolProfile: null };
    try {
      // 1. Get user doc to find assigned school ID
      const userDoc = await getDoc(doc(firestoreDb, "users", uid));
      if (!userDoc.exists()) return { schoolProfile: null };
      
      const userData = userDoc.data();
      const schoolId = userData?.schoolId;
      
      if (!schoolId) {
        console.log("User doc found, but no schoolId assigned.");
        return { schoolProfile: null };
      }

      // 2. Fetch the actual school profile document from schools/{schoolId}
      const schoolProfile = await this.getFirebaseSchoolProfile(schoolId);
      if (schoolProfile) {
        this.saveSchoolInfo(schoolProfile);
      }
      return { schoolId, schoolProfile };
    } catch (e) {
      console.warn("Failed to fetch user assigned school profile:", e);
      return { schoolProfile: null };
    }
  }

  // Full cross-device background sync of all Firestore assets
  static async syncAllDataFromFirebase(): Promise<void> {
    if (!isFirebaseActive || !firestoreDb) return;
    if (this._isSyncing) {
      console.log("Database sync already in progress, skipping overlapping request.");
      return;
    }
    if (firebaseAuth && !firebaseAuth.currentUser) {
      console.warn("Database sync from Firestore skipped: No currently authenticated user.");
      return;
    }
    
    this._isSyncing = true;
    // CRITICAL: Flush offline queue FIRST before overwriting local state with Firestore state
    try {
      await this.syncOfflineQueue();
    } catch (qErr) {
      console.warn("Queue flush failed before full sync, proceeding anyway:", qErr);
    }

    try {
      console.log("Beginning optimized parallelized database sync from Firestore...");
      // We don't clear the cache immediately to keep the UI snappy while we fetch new data
      
      const currentUser = this.getCurrentUser();
      if (currentUser) {
        this.ensureConnectedTeacherProfile(currentUser);
      }
      const schoolId = this.resolveActiveSchoolId();
      const uid = firebaseAuth.currentUser?.uid || (currentUser?.uid || 'unknown');

      const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 6000): Promise<T> => {
        return Promise.race([
          promise,
          new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Sync task timeout')), timeoutMs))
        ]);
      };

      // Define all synchronization tasks to run concurrently
      const syncTasks: Promise<void>[] = [
        // 0. Active User Profile & Subscription Sync by User ID
        (async () => {
          if (!uid || uid === 'unknown' || uid === 'H5nlyq30sANEMixDEmURnYoyUzU2') return;
          try {
            const userSnap = await withTimeout(getDoc(doc(firestoreDb, 'users', uid)), 5000);
            if (userSnap.exists()) {
              const remoteUserData = userSnap.data() as UserAccount;
              if (remoteUserData && remoteUserData.uid !== 'H5nlyq30sANEMixDEmURnYoyUzU2') {
                const localUser = DbController.getCurrentUser();
                const mergedUser: UserAccount = {
                  ...localUser,
                  ...remoteUserData,
                  uid: remoteUserData.uid || uid,
                  email: remoteUserData.email || localUser?.email || '',
                  name: remoteUserData.name || localUser?.name || '',
                  role: remoteUserData.role || localUser?.role || 'Teacher',
                  schoolId: (remoteUserData.schoolId && remoteUserData.schoolId !== 'SMS-P8U4F22L' && remoteUserData.schoolId !== 'school_default')
                    ? remoteUserData.schoolId
                    : (localUser?.schoolId || DbController.generateUniqueSchoolId(uid)),
                  licenseType: remoteUserData.licenseType || localUser?.licenseType || 'trial',
                  trialEndDate: remoteUserData.trialEndDate || localUser?.trialEndDate,
                  licensePeriod: remoteUserData.licensePeriod || localUser?.licensePeriod,
                  lastActivatedOn: remoteUserData.lastActivatedOn || localUser?.lastActivatedOn,
                  activationCode: remoteUserData.activationCode || localUser?.activationCode,
                  requestCode: remoteUserData.requestCode || localUser?.requestCode
                };
                setStorageItem(STORAGE_KEYS.USER, mergedUser);
                DbController._cache[STORAGE_KEYS.USER] = mergedUser;
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('sms_user_synced', { detail: mergedUser }));
                }
              }
            } else if (currentUser && currentUser.uid === uid) {
              await DbController.syncCurrentUserToFirebase(currentUser);
            }
          } catch (uErr) {
            console.warn("Could not sync user profile by user ID from firestore:", uErr);
          }
        })(),

        // 1. School Profile Info
        (async () => {
          try {
            let schoolData: SchoolInfo | null = null;
            const schoolDocSnap = await getDoc(doc(firestoreDb, 'schools', schoolId));
            if (schoolDocSnap.exists()) {
              schoolData = schoolDocSnap.data() as SchoolInfo;
            } else {
              // Try fallback document locations
              const defaultSnap = await getDoc(doc(firestoreDb, 'schools', 'school_default'));
              if (defaultSnap.exists()) {
                schoolData = defaultSnap.data() as SchoolInfo;
              } else {
                const mainSnap = await getDoc(doc(firestoreDb, 'schools', 'main_school_profile'));
                if (mainSnap.exists()) {
                  schoolData = mainSnap.data() as SchoolInfo;
                }
              }
            }

            if (schoolData) {
              // Also fetch secrets if Admin (for editing settings)
              let secretsData = {};
              const isAdmin = currentUser?.role === 'Admin';
              
              if (isAdmin) {
                try {
                  const secretsSnap = await getDoc(doc(firestoreDb, 'schools', `secrets_${uid}`));
                  if (secretsSnap.exists()) {
                    secretsData = secretsSnap.data();
                  }
                } catch (secErr) {
                  console.warn("Could not fetch school secrets:", secErr);
                }
              }
              const merged = { ...schoolData, ...secretsData };
              setStorageItem(STORAGE_KEYS.SCHOOL, merged);
              DbController._cache[STORAGE_KEYS.SCHOOL] = merged;
              DbController.broadcastSyncEvent('school-updated', merged);
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('school-system-sync', { detail: { type: 'school-updated', payload: merged } }));
              }
            }
          } catch (e) {
            console.warn("Could not sync school profile:", e);
          }
        })(),

        // 2. Students
        (async () => {
          try {
            const studentsSnap = await getDocs(collection(firestoreDb, 'schools', schoolId, 'students'));
            const studentsList = studentsSnap.docs.map(d => d.data() as Student);
            setStorageItem(STORAGE_KEYS.STUDENTS, studentsList);
          } catch (e) {
            console.warn("Could not sync students:", e);
          }
        })(),

        // 3. Teachers
        (async () => {
          try {
            const teachersSnap = await getDocs(collection(firestoreDb, 'schools', schoolId, 'teachers'));
            const teachersList = teachersSnap.docs.map(d => d.data() as Teacher);
            setStorageItem(STORAGE_KEYS.TEACHERS, teachersList);
          } catch (e) {
            console.warn("Could not sync teachers:", e);
          }
        })(),

        // 4. Attendance Registers
        (async () => {
          try {
            const attendanceSnap = await getDocs(collection(firestoreDb, 'schools', schoolId, 'attendance'));
            const attendanceList = attendanceSnap.docs.map(d => d.data() as AttendanceRecord);
            setStorageItem(STORAGE_KEYS.ATTENDANCE, attendanceList);
          } catch (e) {
            console.warn("Could not sync attendance:", e);
          }
        })(),

        // 4b. Staff Attendance Registers
        (async () => {
          try {
            const staffAttendanceSnap = await getDocs(collection(firestoreDb, 'schools', schoolId, 'staff_attendance'));
            const staffAttendanceList = staffAttendanceSnap.docs.map(d => d.data() as StaffAttendanceRecord);
            setStorageItem(STORAGE_KEYS.STAFF_ATTENDANCE, staffAttendanceList);
          } catch (e) {
            console.warn("Could not sync staff attendance:", e);
          }
        })(),

        // 5. Assessments Registers
        (async () => {
          try {
            const assessmentsSnap = await getDocs(collection(firestoreDb, 'schools', schoolId, 'assessments'));
            const assessmentsList = assessmentsSnap.docs.map(d => d.data() as StudentAssessment);
            setStorageItem(STORAGE_KEYS.ASSESSMENTS, assessmentsList);
            DbController._cache[STORAGE_KEYS.ASSESSMENTS] = assessmentsList;
          } catch (e) {
            console.warn("Could not sync assessments:", e);
          }
        })(),

        // 5b. Assessment Templates
        (async () => {
          try {
            const templatesSnap = await getDocs(collection(firestoreDb, 'schools', schoolId, 'assessment_templates'));
            const templatesList = templatesSnap.docs.map(d => d.data() as AssessmentTemplate);
            setStorageItem(STORAGE_KEYS.ASSESSMENT_TEMPLATES, templatesList);
          } catch (e) {
            console.warn("Could not sync assessment templates:", e);
          }
        })(),

        // 5c. Communication Templates
        (async () => {
          try {
            const templatesSnap = await getDocs(collection(firestoreDb, 'schools', schoolId, 'communication_templates'));
            const templatesList = templatesSnap.docs.map(d => d.data() as CommunicationTemplate);
            setStorageItem(STORAGE_KEYS.COMM_TEMPLATES, templatesList);
            DbController._cache[STORAGE_KEYS.COMM_TEMPLATES] = templatesList;
          } catch (e) {
            console.warn("Could not sync communication templates:", e);
          }
        })(),

        // 6. Fees Bills
        (async () => {
          try {
            const feesSnap = await getDocs(collection(firestoreDb, 'schools', schoolId, 'fees'));
            const feesList = feesSnap.docs.map(d => d.data() as StudentFeeBill);
            setStorageItem(STORAGE_KEYS.FEES, feesList);
          } catch (e) {
            console.warn("Could not sync fees bills:", e);
          }
        })(),

        // 7. Settings (Academic Calendar, System Customizations, Auto-Backup Config)
        (async () => {
          try {
            const settingsSnap = await getDocs(collection(firestoreDb, 'schools', schoolId, 'settings'));
            const calendarDoc = settingsSnap.docs.find(d => d.id === 'academic_calendar');
            if (calendarDoc) {
              setStorageItem(STORAGE_KEYS.CALENDAR, calendarDoc.data() as AcademicCalendarConfig);
            }
            const systemDoc = settingsSnap.docs.find(d => d.id === 'system_settings');
            if (systemDoc) {
              setStorageItem(STORAGE_KEYS.SETTINGS, systemDoc.data());
            }
            const backupConfigDoc = settingsSnap.docs.find(d => d.id === 'auto_backup_config');
            if (backupConfigDoc) {
              setStorageItem(STORAGE_KEYS.AUTO_BACKUP_CONFIG, backupConfigDoc.data() as AutoBackupConfig);
            }
          } catch (e: any) {
            if (e.message?.includes('offline')) {
              console.log("Offline mode: Using cached system settings.");
            } else {
              console.warn("Could not sync system settings:", e);
            }
          }
        })(),

        // 8. EMIS Reports (GES aligned)
        (async () => {
          try {
            const emisSnap = await getDocs(collection(firestoreDb, 'schools', schoolId, 'emis'));
            const emisList = emisSnap.docs.map(d => d.data() as EmisData);
            setStorageItem(STORAGE_KEYS.EMIS, emisList);
          } catch (e: any) {
            if (e.message?.includes('offline')) {
              console.log("Offline mode: Using cached EMIS reports.");
            } else {
              console.warn("Could not sync EMIS reports:", e);
            }
          }
        })(),

        // 9. Behavioral Remarks
        (async () => {
          try {
            const remarksSnap = await getDocs(collection(firestoreDb, 'schools', schoolId, 'behavioral_remarks'));
            const remarksList = remarksSnap.docs.map(d => d.data() as BehavioralRemark);
            setStorageItem(STORAGE_KEYS.BEHAVIORAL_REMARKS, remarksList);
          } catch (e: any) {
            if (e.message?.includes('offline')) {
              console.log("Offline mode: Using cached behavioral remarks.");
            } else {
              console.warn("Could not sync behavioral remarks:", e);
            }
          }
        })(),

        // 9b. Paystack Payments
        (async () => {
          try {
            const paystackSnap = await getDocs(collection(firestoreDb, 'schools', schoolId, 'paystack_payments'));
            const paystackList = paystackSnap.docs.map(d => {
              const data = d.data();
              return {
                id: data.id || d.id,
                reference: data.reference || data.id || d.id,
                studentId: data.studentId || '',
                studentName: data.studentName || '',
                billId: data.billId || '',
                component: data.component || 'School Fees',
                amount: typeof data.amount === 'number' ? data.amount : (data.amount?.doubleValue || Number(data.amount) || 0),
                academicYear: data.academicYear || '',
                term: data.term || '',
                status: data.status || 'ongoing',
                paidAt: data.paidAt || '',
                createdAt: data.createdAt || ''
              } as PaystackPayment;
            });
            setStorageItem(STORAGE_KEYS.PAYSTACK_LOGS, paystackList);
          } catch (e: any) {
            console.warn("Could not sync Paystack payments:", e);
          }
        })(),

        // 9c. Activity Logs - Optimized with limit(150) query constraint to prevent build-up loading issues
        (async () => {
          try {
            const activitySnap = await getDocs(query(collection(firestoreDb, 'schools', schoolId, 'activity_logs'), limit(150)));
            const activityList = activitySnap.docs.map(d => d.data() as ActivityLog);
            activityList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setStorageItem(STORAGE_KEYS.ACTIVITY_LOGS, activityList);
          } catch (e: any) {
            console.warn("Could not sync activity logs:", e);
          }
        })(),

        // 9d. Teacher Reflections
        (async () => {
          try {
            const reflectionsSnap = await getDocs(collection(firestoreDb, 'schools', schoolId, 'teacher_reflections'));
            const reflectionsList = reflectionsSnap.docs.map(d => d.data() as TeacherReflection);
            setStorageItem(STORAGE_KEYS.TEACHER_REFLECTIONS, reflectionsList);
          } catch (e: any) {
            console.warn("Could not sync teacher reflections:", e);
          }
        })(),

        // 9e. Leave Requests
        (async () => {
          try {
            const leaveSnap = await getDocs(collection(firestoreDb, 'schools', schoolId, 'leave_requests'));
            const leaveList = leaveSnap.docs.map(d => d.data() as LeaveRequest);
            setStorageItem(STORAGE_KEYS.LEAVE_REQUESTS, leaveList);
          } catch (e: any) {
            console.warn("Could not sync leave requests:", e);
          }
        })(),

        // 9f. Custom Tasks
        (async () => {
          try {
            const tasksSnap = await getDocs(collection(firestoreDb, 'schools', schoolId, 'tasks'));
            const tasksList = tasksSnap.docs.map(d => d.data() as CustomTask);
            setStorageItem(STORAGE_KEYS.TASKS, tasksList);
          } catch (e: any) {
            console.warn("Could not sync custom tasks:", e);
          }
        })(),

        // 9g. Quick Notes & Urgent Memos
        (async () => {
          try {
            const notesSnap = await getDocs(collection(firestoreDb, 'schools', schoolId, 'quick_notes'));
            const notesList = notesSnap.docs.map(d => d.data() as QuickNote);
            setStorageItem(STORAGE_KEYS.QUICK_NOTES, notesList);
          } catch (e: any) {
            console.warn("Could not sync quick notes:", e);
          }
        })(),

        // 10. Registered Users Directory (Security Watchdog source)
        (async () => {
          try {
            const directorySnap = await getDoc(doc(firestoreDb, 'users', 'directory'));
            if (directorySnap.exists()) {
              const data = directorySnap.data();
              if (data && Array.isArray(data.list) && data.list.length > 0) {
                setStorageItem(STORAGE_KEYS.USERS_LIST, data.list);
              }
            }
          } catch (e) {
            console.warn("Could not sync users directory:", e);
          }
        })(),

        // 11. Custom Sections
        (async () => {
          try {
            const secSnap = await getDoc(doc(firestoreDb, 'schools', schoolId, 'custom_sections', 'all'));
            if (secSnap.exists()) {
              const data = secSnap.data();
              if (data && Array.isArray(data.sections) && data.sections.length > 0) {
                setStorageItem(STORAGE_KEYS.CUSTOM_SECTIONS, data.sections);
                DbController._cache[STORAGE_KEYS.CUSTOM_SECTIONS] = data.sections;
              }
            }
          } catch (e) {
            console.warn("Could not sync custom sections from firestore:", e);
          }
        })()
      ];

      // Execute all fetches concurrently with resilient allSettled
      await Promise.allSettled(syncTasks);

      console.log("Database sync from Firestore completed successfully in parallel.");
      this.clearCache();
    } catch (e) {
      this.clearCache();
      console.warn("Database sync from Firestore aborted (running in offline LocalStorage backup mode):", e);
    } finally {
      this._isSyncing = false;
    }
  }

  static syncDatasetFromSnapshot(colName: string, items: any[]): void {
    if (!Array.isArray(items)) return;
    switch (colName) {
      case 'students':
        setStorageItem(STORAGE_KEYS.STUDENTS, items);
        this._cache[STORAGE_KEYS.STUDENTS] = items;
        // Rebuild student class index
        {
          const sIdx = new Map<string, Student[]>();
          items.forEach(s => {
            if (s && s.class) {
              if (!sIdx.has(s.class)) sIdx.set(s.class, []);
              sIdx.get(s.class)!.push(s);
            }
          });
          this._studentsByClass = sIdx;
        }
        break;
      case 'teachers':
        setStorageItem(STORAGE_KEYS.TEACHERS, items);
        this._cache[STORAGE_KEYS.TEACHERS] = items;
        break;
      case 'attendance':
        setStorageItem(STORAGE_KEYS.ATTENDANCE, items);
        this._cache[STORAGE_KEYS.ATTENDANCE] = items;
        break;
      case 'staff_attendance':
        setStorageItem(STORAGE_KEYS.STAFF_ATTENDANCE, items);
        this._cache[STORAGE_KEYS.STAFF_ATTENDANCE] = items;
        break;
      case 'assessments': {
        const local = getStorageItem<StudentAssessment[]>(STORAGE_KEYS.ASSESSMENTS, []);
        const mergedMap = new Map<string, StudentAssessment>();
        local.forEach(a => { if (a && a.id) mergedMap.set(a.id, a); });
        items.forEach(a => { if (a && a.id) mergedMap.set(a.id, a); });
        const merged = Array.from(mergedMap.values());
        setStorageItem(STORAGE_KEYS.ASSESSMENTS, merged);
        this._cache[STORAGE_KEYS.ASSESSMENTS] = merged;
        // Rebuild assessment student index
        const aIdx = new Map<string, StudentAssessment[]>();
        merged.forEach(item => {
          if (item && item.studentId) {
            if (!aIdx.has(item.studentId)) aIdx.set(item.studentId, []);
            aIdx.get(item.studentId)!.push(item);
          }
        });
        this._assessmentsByStudent = aIdx;
        break;
      }
      case 'assessment_templates':
        setStorageItem(STORAGE_KEYS.ASSESSMENT_TEMPLATES, items);
        this._cache[STORAGE_KEYS.ASSESSMENT_TEMPLATES] = items;
        break;
      case 'fees':
        setStorageItem(STORAGE_KEYS.FEES, items);
        this._cache[STORAGE_KEYS.FEES] = items;
        break;
      case 'teacher_reflections':
        setStorageItem(STORAGE_KEYS.TEACHER_REFLECTIONS, items);
        this._cache[STORAGE_KEYS.TEACHER_REFLECTIONS] = items;
        break;
      case 'behavioral_remarks':
        setStorageItem(STORAGE_KEYS.BEHAVIORAL_REMARKS, items);
        this._cache[STORAGE_KEYS.BEHAVIORAL_REMARKS] = items;
        break;
      case 'leave_requests':
        setStorageItem(STORAGE_KEYS.LEAVE_REQUESTS, items);
        this._cache[STORAGE_KEYS.LEAVE_REQUESTS] = items;
        break;
      case 'tasks':
        setStorageItem(STORAGE_KEYS.TASKS, items);
        this._cache[STORAGE_KEYS.TASKS] = items;
        break;
      case 'emis':
        setStorageItem(STORAGE_KEYS.EMIS, items);
        this._cache[STORAGE_KEYS.EMIS] = items;
        break;
      case 'schools':
      case 'school':
      case 'school_info':
        if (items && !Array.isArray(items)) {
          setStorageItem(STORAGE_KEYS.SCHOOL, items);
          this._cache[STORAGE_KEYS.SCHOOL] = items;
          this.broadcastSyncEvent('school-updated', items);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('school-system-sync', { detail: { type: 'school-updated', payload: items } }));
          }
        } else if (Array.isArray(items) && items.length > 0) {
          setStorageItem(STORAGE_KEYS.SCHOOL, items[0]);
          this._cache[STORAGE_KEYS.SCHOOL] = items[0];
          this.broadcastSyncEvent('school-updated', items[0]);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('school-system-sync', { detail: { type: 'school-updated', payload: items[0] } }));
          }
        }
        break;
      case 'custom_sections':
        if (items && Array.isArray(items)) {
          const list = items[0]?.sections || items;
          if (Array.isArray(list) && list.length > 0) {
            setStorageItem(STORAGE_KEYS.CUSTOM_SECTIONS, list);
            this._cache[STORAGE_KEYS.CUSTOM_SECTIONS] = list;
            this.broadcastSyncEvent('sections-updated', { sections: list });
          }
        }
        break;
      default:
        break;
    }
  }

  // -------------------------
  // SCHOOL PROFILE
  // -------------------------
  static getSchoolInfo(): SchoolInfo {
    if (this._cache[STORAGE_KEYS.SCHOOL]) {
      const cached = this._cache[STORAGE_KEYS.SCHOOL];
      if (cached && (cached.name || cached.motto || cached.logoUrl || cached.crestUrl)) {
        return cached;
      }
    }
    let info = getStorageItem<SchoolInfo>(STORAGE_KEYS.SCHOOL, DEFAULT_SCHOOL_INFO);

    // If info is blank/empty default, check if any legacy/partitioned keys have school info
    if (!info || (!info.name && !info.motto && !info.logoUrl && !info.crestUrl)) {
      try {
        const keys = Object.keys(localStorage);
        for (const k of keys) {
          if (k.startsWith('sms_school_info_') || k.startsWith('school_info_') || k === 'sms_school_info' || k === 'school_info') {
            const rawVal = localStorage.getItem(k);
            if (rawVal) {
              try {
                let parsed: any = null;
                try {
                  parsed = JSON.parse(rawVal);
                } catch {
                  const bytes = CryptoJS.AES.decrypt(rawVal, AES_SECRET_KEY);
                  const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
                  if (decryptedStr) parsed = JSON.parse(decryptedStr);
                }
                if (parsed && typeof parsed === 'object' && (parsed.name || parsed.motto || parsed.logoUrl || parsed.crestUrl)) {
                  info = { ...DEFAULT_SCHOOL_INFO, ...parsed };
                  // Persist to canonical key so everyone has it
                  setStorageItem(STORAGE_KEYS.SCHOOL, info);
                  break;
                }
              } catch {}
            }
          }
        }
      } catch (e) {
        console.warn("Could not scan legacy school info keys:", e);
      }
    }

    const resolved = info || DEFAULT_SCHOOL_INFO;
    this._cache[STORAGE_KEYS.SCHOOL] = resolved;
    return resolved;
  }

  static saveSchoolInfo(info: SchoolInfo): void {
    setStorageItem(STORAGE_KEYS.SCHOOL, info);
    this._cache[STORAGE_KEYS.SCHOOL] = info;

    // Also mirror to legacy keys and unpartitioned plain local storage for safety
    try {
      localStorage.setItem('sms_school_info', CryptoJS.AES.encrypt(JSON.stringify(info), AES_SECRET_KEY).toString());
      localStorage.setItem('school_info', JSON.stringify(info));
      IndexedDbEngine.setItem('sms_school_info', JSON.stringify(info));
    } catch {}

    // Split public fields and secret fields for data breach protection
    const {
      paystackSecretKey,
      twilioAccountSid,
      twilioAuthToken,
      twilioFromNumber,
      ...publicFields
    } = info;

    // Save public school details
    const currentUser = this.getCurrentUser();
    const schoolId = info.schoolId || (currentUser?.schoolId ? currentUser.schoolId : (currentUser ? `school_${currentUser.uid}` : (info.id || 'school_default')));
    
    // Write to main school doc and standard aliases
    this.performFirestoreWrite('schools', schoolId, 'set', publicFields);
    if (schoolId !== 'school_default') {
      this.performFirestoreWrite('schools', 'school_default', 'set', publicFields);
    }
    this.performFirestoreWrite('schools', 'main_school_profile', 'set', publicFields);

    // If there are secret fields, save them to the secure school_secrets document
    if (paystackSecretKey !== undefined || twilioAccountSid !== undefined || twilioAuthToken !== undefined || twilioFromNumber !== undefined) {
      const secrets: Record<string, any> = {};
      if (paystackSecretKey !== undefined) secrets.paystackSecretKey = paystackSecretKey;
      if (twilioAccountSid !== undefined) secrets.twilioAccountSid = twilioAccountSid;
      if (twilioAuthToken !== undefined) secrets.twilioAuthToken = twilioAuthToken;
      if (twilioFromNumber !== undefined) secrets.twilioFromNumber = twilioFromNumber;
      
      const secretsId = info.schoolId ? `secrets_${info.schoolId}` : (currentUser ? `secrets_${currentUser.uid}` : 'school_secrets');
      this.performFirestoreWrite('schools', secretsId, 'set', secrets);
    }

    // Propagation to user profile
    if (currentUser && info.schoolId && currentUser.schoolId !== info.schoolId) {
      currentUser.schoolId = info.schoolId;
      setStorageItem(STORAGE_KEYS.USER, currentUser);
      if (isFirebaseActive && firestoreDb) {
        setDoc(doc(firestoreDb, 'users', currentUser.uid), currentUser, { merge: true }).catch(console.error);
      }
    }

    this.broadcastSyncEvent('school-updated', info);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('school-system-sync', { detail: { type: 'school-updated', payload: info } }));
    }
  }

  static async updateSchoolId(newId: string): Promise<void> {
    const info = this.getSchoolInfo();
    const oldId = info.schoolId;
    info.schoolId = newId;
    this.saveSchoolInfo(info);

    const user = this.getCurrentUser();
    if (user) {
      user.schoolId = newId;
      setStorageItem(STORAGE_KEYS.USER, user);
    }

    // Update all local teachers to new schoolId
    const teachers = this.getTeachers();
    let teacherUpdated = false;
    teachers.forEach(t => {
      if (!t.schoolId || t.schoolId === oldId || oldId === 'school_default') {
        t.schoolId = newId;
        teacherUpdated = true;
      }
    });
    if (teacherUpdated) {
      setStorageItem(STORAGE_KEYS.TEACHERS, teachers);
      this._cache[STORAGE_KEYS.TEACHERS] = teachers;
    }

    // Update registered users
    const users = this.getRegisteredUsers();
    let usersUpdated = false;
    users.forEach(u => {
      if (!u.schoolId || u.schoolId === oldId || oldId === 'school_default') {
        u.schoolId = newId;
        usersUpdated = true;
      }
    });
    if (usersUpdated) {
      setStorageItem(STORAGE_KEYS.USERS_LIST, users);
    }

    this.writeActivityLog(
      'Special School ID Updated',
      `School linked to ID: ${newId}. Database access re-routed.`,
      'high'
    );
  }

  static generateSpecialSchoolId(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = 'SMS-';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // -------------------------
  // ACADEMIC CALENDAR MANAGEMENT
  // -------------------------
  static getAcademicCalendar(): AcademicCalendarConfig {
    if (this._cache[STORAGE_KEYS.CALENDAR]) {
      const cached = this._cache[STORAGE_KEYS.CALENDAR];
      if (cached && cached.activeAcademicYear && cached.years) {
        return cached;
      }
    }
    let calendar = getStorageItem<AcademicCalendarConfig>(STORAGE_KEYS.CALENDAR, DEFAULT_CALENDAR);
    if (!calendar || !calendar.activeAcademicYear || !calendar.years) {
      calendar = DEFAULT_CALENDAR;
    }
    this._cache[STORAGE_KEYS.CALENDAR] = calendar;
    return calendar;
  }

  static saveAcademicCalendar(calendar: AcademicCalendarConfig): void {
    setStorageItem(STORAGE_KEYS.CALENDAR, calendar);
    this._cache[STORAGE_KEYS.CALENDAR] = calendar;
    this.performFirestoreWrite('settings', 'academic_calendar', 'set', calendar);
  }

  // -------------------------
  // EMIS DATA MANAGEMENT (Ghana Education Service aligned)
  // -------------------------
  static getEmisReports(): EmisData[] {
    if (this._cache[STORAGE_KEYS.EMIS]) {
      return this._cache[STORAGE_KEYS.EMIS];
    }
    const list = getStorageItem<EmisData[]>(STORAGE_KEYS.EMIS, []);
    this._cache[STORAGE_KEYS.EMIS] = list;
    return list;
  }

  static getEmisReportByYear(year: AcademicYearType): EmisData | null {
    const list = this.getEmisReports();
    return list.find(r => r.academicYear === year) || null;
  }

  static saveEmisReport(report: EmisData): void {
    const list = this.getEmisReports();
    const idx = list.findIndex(r => r.academicYear === report.academicYear);
    if (idx >= 0) {
      list[idx] = report;
    } else {
      list.push(report);
    }
    setStorageItem(STORAGE_KEYS.EMIS, list);
    this._cache[STORAGE_KEYS.EMIS] = list;
    this.performFirestoreWrite('emis', report.id, 'set', report);
  }

  static deleteEmisReport(year: AcademicYearType): void {
    const list = this.getEmisReports();
    const filtered = list.filter(r => r.academicYear !== year);
    setStorageItem(STORAGE_KEYS.EMIS, filtered);
    this._cache[STORAGE_KEYS.EMIS] = filtered;
    this.performFirestoreWrite('emis', year, 'delete');
  }

  // -------------------------
  // STUDENTS PROFILE REGISTRY
  // -------------------------
  static getStudents(): Student[] {
    if (this._cache[STORAGE_KEYS.STUDENTS]) {
      return this._cache[STORAGE_KEYS.STUDENTS];
    }
    const list = getStorageItem<Student[]>(STORAGE_KEYS.STUDENTS, []);
    this._cache[STORAGE_KEYS.STUDENTS] = list;

    // Build class index
    const index = new Map<string, Student[]>();
    list.forEach(student => {
      const cls = student.class;
      if (!index.has(cls)) {
        index.set(cls, []);
      }
      index.get(cls)!.push(student);
    });
    this._studentsByClass = index;

    return list;
  }

  static saveStudent(student: Student): void {
    const students = this.getStudents();
    const idx = students.findIndex(s => s.id === student.id);
    if (idx >= 0) {
      students[idx] = student;
    } else {
      students.push(student);
    }
    setStorageItem(STORAGE_KEYS.STUDENTS, students);
    this._cache[STORAGE_KEYS.STUDENTS] = students;

    // Update index
    const index = new Map<string, Student[]>();
    students.forEach(s => {
      const cls = s.class;
      if (!index.has(cls)) {
        index.set(cls, []);
      }
      index.get(cls)!.push(s);
    });
    this._studentsByClass = index;

    this.performFirestoreWrite('students', student.id, 'set', student);
    this.broadcastSyncEvent('students-updated', student);
  }

  static deleteStudent(studentId: string): void {
    const students = this.getStudents();
    const student = students.find(s => s.id === studentId);
    if (student) {
      this.writeActivityLog(
        'Student Profile Deletion',
        `Deleted student profile: ${student.firstName} ${student.lastName} (ID: ${studentId}, Class: ${student.class}) with cascaded assessments and attendance records.`,
        'high'
      );
    }
    const filtered = students.filter(s => s.id !== studentId);
    setStorageItem(STORAGE_KEYS.STUDENTS, filtered);
    this._cache[STORAGE_KEYS.STUDENTS] = filtered;

    // Rebuild index
    const index = new Map<string, Student[]>();
    filtered.forEach(s => {
      const cls = s.class;
      if (!index.has(cls)) {
        index.set(cls, []);
      }
      index.get(cls)!.push(s);
    });
    this._studentsByClass = index;

    // Also cascade delete assessments and attendance for this student locally
    const assessments = this.getAssessments();
    const filteredAssessments = assessments.filter(a => a.studentId !== studentId);
    setStorageItem(STORAGE_KEYS.ASSESSMENTS, filteredAssessments);
    this._cache[STORAGE_KEYS.ASSESSMENTS] = filteredAssessments;

    // Rebuild assessments index
    const aIndex = new Map<string, StudentAssessment[]>();
    filteredAssessments.forEach(item => {
      const sid = item.studentId;
      if (!aIndex.has(sid)) {
        aIndex.set(sid, []);
      }
      aIndex.get(sid)!.push(item);
    });
    this._assessmentsByStudent = aIndex;

    const attendanceList = getStorageItem<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
    const filteredAttendance = attendanceList.filter(a => a.studentId !== studentId);
    setStorageItem(STORAGE_KEYS.ATTENDANCE, filteredAttendance);
    this._cache[STORAGE_KEYS.ATTENDANCE] = filteredAttendance;

    this.performFirestoreWrite('students', studentId, 'delete');

    // Also cascade delete behavioral remarks for this student locally and on Firestore
    try {
      const remarks = this.getBehavioralRemarks();
      const studentRemarks = remarks.filter(r => r.studentId === studentId);
      studentRemarks.forEach(r => {
        this.performFirestoreWrite('behavioral_remarks', r.id, 'delete').catch(e => console.error(e));
      });
      const filteredRemarks = remarks.filter(r => r.studentId !== studentId);
      setStorageItem(STORAGE_KEYS.BEHAVIORAL_REMARKS, filteredRemarks);
      this._cache[STORAGE_KEYS.BEHAVIORAL_REMARKS] = filteredRemarks;
    } catch (e) {
      console.warn("Error cascading delete on behavioral remarks:", e);
    }
    this.broadcastSyncEvent('students-updated', { studentId });
  }

  // BEHAVIORAL REMARKS TRACKER
  // -------------------------
  static getBehavioralRemarks(): BehavioralRemark[] {
    if (this._cache[STORAGE_KEYS.BEHAVIORAL_REMARKS]) {
      return this._cache[STORAGE_KEYS.BEHAVIORAL_REMARKS];
    }
    const list = getStorageItem<BehavioralRemark[]>(STORAGE_KEYS.BEHAVIORAL_REMARKS, []);
    this._cache[STORAGE_KEYS.BEHAVIORAL_REMARKS] = list;
    return list;
  }

  static getBehavioralRemarksForStudent(studentId: string): BehavioralRemark[] {
    return this.getBehavioralRemarks().filter(r => r.studentId === studentId);
  }

  static saveBehavioralRemark(remark: BehavioralRemark): void {
    if (!remark.schoolId) {
      remark.schoolId = this.resolveActiveSchoolId();
    }
    const remarks = this.getBehavioralRemarks();
    const idx = remarks.findIndex(r => r.id === remark.id);
    if (idx >= 0) {
      remarks[idx] = remark;
    } else {
      remarks.push(remark);
    }
    setStorageItem(STORAGE_KEYS.BEHAVIORAL_REMARKS, remarks);
    this._cache[STORAGE_KEYS.BEHAVIORAL_REMARKS] = remarks;

    this.performFirestoreWrite('behavioral_remarks', remark.id, 'set', remark);
  }

  static deleteBehavioralRemark(id: string): void {
    const remarks = this.getBehavioralRemarks();
    const filtered = remarks.filter(r => r.id !== id);
    setStorageItem(STORAGE_KEYS.BEHAVIORAL_REMARKS, filtered);
    this._cache[STORAGE_KEYS.BEHAVIORAL_REMARKS] = filtered;

    this.performFirestoreWrite('behavioral_remarks', id, 'delete');
  }

  // TEACHER REFLECTIONS (JOURNAL ENTRIES)
  // -------------------------
  static getTeacherReflections(): TeacherReflection[] {
    if (this._cache[STORAGE_KEYS.TEACHER_REFLECTIONS]) {
      return this._cache[STORAGE_KEYS.TEACHER_REFLECTIONS];
    }
    const list = getStorageItem<TeacherReflection[]>(STORAGE_KEYS.TEACHER_REFLECTIONS, []);
    this._cache[STORAGE_KEYS.TEACHER_REFLECTIONS] = list;
    return list;
  }

  static getReflectionsForTeacher(teacherId: string): TeacherReflection[] {
    return this.getTeacherReflections().filter(r => r.teacherId === teacherId);
  }

  static saveTeacherReflection(reflection: TeacherReflection): void {
    if (!reflection.schoolId) {
      reflection.schoolId = this.resolveActiveSchoolId();
    }
    const reflections = this.getTeacherReflections();
    const idx = reflections.findIndex(r => r.id === reflection.id);
    if (idx >= 0) {
      reflections[idx] = reflection;
    } else {
      reflections.push(reflection);
    }
    setStorageItem(STORAGE_KEYS.TEACHER_REFLECTIONS, reflections);
    this._cache[STORAGE_KEYS.TEACHER_REFLECTIONS] = reflections;

    this.performFirestoreWrite('teacher_reflections', reflection.id, 'set', reflection);
    this.broadcastSyncEvent('reflections-updated', reflection);
  }

  static deleteTeacherReflection(id: string): void {
    const reflections = this.getTeacherReflections();
    const filtered = reflections.filter(r => r.id !== id);
    setStorageItem(STORAGE_KEYS.TEACHER_REFLECTIONS, filtered);
    this._cache[STORAGE_KEYS.TEACHER_REFLECTIONS] = filtered;

    this.performFirestoreWrite('teacher_reflections', id, 'delete');
    this.broadcastSyncEvent('reflections-updated', { id });
  }

  static promoteClassBulk(sourceClass: ClassType, targetClass: ClassType | 'Graduated'): number {
    const students = this.getStudents();
    let count = 0;
    
    const updatedStudents = students.map(student => {
      if (student.class === sourceClass) {
        count++;
        return {
          ...student,
          class: targetClass === 'Graduated' ? student.class : targetClass,
          status: (targetClass === 'Graduated' ? 'Graduated' : (student.status || 'Active')) as any
        };
      }
      return student;
    });

    setStorageItem(STORAGE_KEYS.STUDENTS, updatedStudents);
    this._cache[STORAGE_KEYS.STUDENTS] = updatedStudents;

    // Rebuild index
    const index = new Map<string, Student[]>();
    updatedStudents.forEach(s => {
      const cls = s.class;
      if (!index.has(cls)) {
        index.set(cls, []);
      }
      index.get(cls)!.push(s);
    });
    this._studentsByClass = index;
    
    // Perform Firestore updates if Firebase is active
    students.forEach(student => {
      if (student.class === sourceClass) {
        const payload = {
          ...student,
          class: targetClass === 'Graduated' ? student.class : targetClass,
          status: (targetClass === 'Graduated' ? 'Graduated' : (student.status || 'Active')) as any
        };
        this.performFirestoreWrite('students', student.id, 'set', payload);
      }
    });

    this.writeActivityLog(
      'Bulk Student Promotion',
      `Promoted all ${count} students of class level '${sourceClass}' to '${targetClass}'.`,
      'high'
    );
    this.broadcastSyncEvent('students-updated', updatedStudents);
    
    return count;
  }

  // -------------------------
  // TEACHERS PROFILE REGISTRY
  // -------------------------
  static getTeachers(): Teacher[] {
    if (this._cache[STORAGE_KEYS.TEACHERS]) {
      return this._cache[STORAGE_KEYS.TEACHERS];
    }
    const list = getStorageItem<Teacher[]>(STORAGE_KEYS.TEACHERS, []);
    this._cache[STORAGE_KEYS.TEACHERS] = list;
    return list;
  }

  static saveTeacher(teacher: Teacher): void {
    // Ensure email is set
    if (!teacher.email || !teacher.email.trim()) {
      const safeId = (teacher.staffId || teacher.id || 'teacher').toLowerCase().replace(/[^a-z0-9]/g, '');
      teacher.email = `${safeId}@school.internal`;
    }

    const activeSchoolId = teacher.schoolId || this.getSchoolInfo().schoolId || "school_default";
    teacher.schoolId = activeSchoolId;

    const teachers = this.getTeachers();
    const idx = teachers.findIndex(t => t.id === teacher.id || (t.staffId && teacher.staffId && t.staffId.toLowerCase().trim() === teacher.staffId.toLowerCase().trim()));
    if (idx >= 0) {
      teachers[idx] = teacher;
    } else {
      teachers.push(teacher);
    }
    setStorageItem(STORAGE_KEYS.TEACHERS, teachers);
    this._cache[STORAGE_KEYS.TEACHERS] = teachers;
    this.performFirestoreWrite('teachers', teacher.id, 'set', teacher);

    // Synchronize or create corresponding UserAccount in USERS_LIST
    const users = this.getRegisteredUsers();
    let userAcc = users.find(u => u.email.toLowerCase().trim() === teacher.email!.toLowerCase().trim());
    if (!userAcc && teacher.staffId) {
      userAcc = users.find(u => u.staffId?.toLowerCase().trim() === teacher.staffId.toLowerCase().trim());
    }

    const createdNow = new Date().toISOString();

    if (!userAcc) {
      userAcc = {
        uid: teacher.id || ('user_' + Math.random().toString(36).substring(2, 9)),
        email: teacher.email.toLowerCase().trim(),
        name: `${teacher.firstName} ${teacher.lastName}`.trim(),
        role: 'Teacher',
        staffId: teacher.staffId,
        schoolId: activeSchoolId,
        createdAt: createdNow,
        licenseType: 'trial',
        registeredOn: createdNow
      };
      users.push(userAcc);
    } else {
      userAcc.name = `${teacher.firstName} ${teacher.lastName}`.trim();
      if (teacher.staffId) userAcc.staffId = teacher.staffId;
      if (teacher.email) userAcc.email = teacher.email;
      userAcc.schoolId = activeSchoolId;
    }
    setStorageItem(STORAGE_KEYS.USERS_LIST, users);

    this.broadcastSyncEvent('teacher-updated', teacher);
  }

  static deleteTeacher(teacherId: string): void {
    const teachers = this.getTeachers();
    const teacher = teachers.find(t => t.id === teacherId);
    if (teacher) {
      this.writeActivityLog(
        'Teacher Account Deletion', 
        `Permanently deleted teacher account record: ${teacher.firstName} ${teacher.lastName} (ID: ${teacherId}, Staff ID: ${teacher.staffId || 'N/A'}, NTC Number: ${teacher.ntcNumber || 'N/A'})`,
        'critical'
      );
    }
    const filtered = teachers.filter(t => t.id !== teacherId);
    setStorageItem(STORAGE_KEYS.TEACHERS, filtered);
    this._cache[STORAGE_KEYS.TEACHERS] = filtered;
    this.performFirestoreWrite('teachers', teacherId, 'delete');
    this.broadcastSyncEvent('teacher-deleted', { id: teacherId });
  }

  // -------------------------
  // ATTENDANCE MANAGEMENT
  // -------------------------
  static getAllAttendance(): AttendanceRecord[] {
    if (this._cache[STORAGE_KEYS.ATTENDANCE]) {
      return this._cache[STORAGE_KEYS.ATTENDANCE];
    }
    const list = getStorageItem<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
    this._cache[STORAGE_KEYS.ATTENDANCE] = list;
    return list;
  }

  static saveAllAttendance(records: AttendanceRecord[]): void {
    setStorageItem(STORAGE_KEYS.ATTENDANCE, records);
    this._cache[STORAGE_KEYS.ATTENDANCE] = records;
    this.performFirestoreWriteBatch('attendance', records.map(item => ({
      id: item.id,
      type: 'set',
      data: item
    })));
    this.broadcastSyncEvent('attendance-updated', records);
  }

  static getAttendance(date: string, className: ClassType): AttendanceRecord[] {
    let list: AttendanceRecord[];
    if (this._cache[STORAGE_KEYS.ATTENDANCE]) {
      list = this._cache[STORAGE_KEYS.ATTENDANCE];
    } else {
      list = getStorageItem<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
      this._cache[STORAGE_KEYS.ATTENDANCE] = list;
    }
    // Get all students enrolled in this class
    this.getStudents();
    const students = this._studentsByClass.get(className) || [];
    
    // Build attendance records ensuring every currently enrolled student has an entry for this class/date
    return students.map(student => {
      const idKey = `${date}_${student.id}`;
      const existing = list.find(r => r.id === idKey);
      if (existing) {
        return existing;
      } else {
        return {
          id: idKey,
          date,
          studentId: student.id,
          studentName: `${student.firstName} ${student.middleName ? student.middleName + ' ' : ''}${student.lastName}`,
          class: className,
          status: 'Unmarked' // Default status
        };
      }
    });
  }

  static saveAttendanceBatch(records: AttendanceRecord[]): void {
    const activeSchoolId = this.resolveActiveSchoolId();
    let list: AttendanceRecord[];
    if (this._cache[STORAGE_KEYS.ATTENDANCE]) {
      list = this._cache[STORAGE_KEYS.ATTENDANCE];
    } else {
      list = getStorageItem<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
    }
    records.forEach(rec => {
      if (!rec.schoolId) rec.schoolId = activeSchoolId;
      const idx = list.findIndex(r => r.id === rec.id);
      if (idx >= 0) {
        list[idx] = rec;
      } else {
        list.push(rec);
      }
    });

    // Atomic batch sync to cloud without delay
    this.performFirestoreWriteBatch('attendance', records.map(rec => ({
      id: rec.id,
      type: 'set',
      data: rec
    })));

    setStorageItem(STORAGE_KEYS.ATTENDANCE, list);
    this._cache[STORAGE_KEYS.ATTENDANCE] = list;

    if (records.length > 0) {
      const dateStr = records[0].date;
      const classLevel = records[0].class;
      this.writeActivityLog(
        'Class Attendance Marked',
        `Attendance log submitted for ${classLevel} on ${dateStr} (${records.length} students updated).`,
        'low'
      );
    }
    this.broadcastSyncEvent('attendance-updated', records);
  }

  static getAttendanceStats(className: ClassType, date: string) {
    let records: AttendanceRecord[];
    if (this._cache[STORAGE_KEYS.ATTENDANCE]) {
      records = this._cache[STORAGE_KEYS.ATTENDANCE];
    } else {
      records = getStorageItem<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
      this._cache[STORAGE_KEYS.ATTENDANCE] = records;
    }
    const classRecords = records.filter(r => r.class === className && r.date === date);
    
    const present = classRecords.filter(r => r.status === 'Present').length;
    const holiday = classRecords.filter(r => r.status === 'Holiday').length;
    const absent = classRecords.filter(r => r.status === 'Absent').length;
    
    this.getStudents();
    return {
      totalEnrolled: (this._studentsByClass.get(className) || []).length || this.getStudents().filter(s => s.class === className).length,
      present,
      holiday,
      absent,
      totalMarked: classRecords.length
    };
  }

  static getStudentAttendanceStats(studentId: string) {
    let records: AttendanceRecord[];
    if (this._cache[STORAGE_KEYS.ATTENDANCE]) {
      records = this._cache[STORAGE_KEYS.ATTENDANCE];
    } else {
      records = getStorageItem<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
      this._cache[STORAGE_KEYS.ATTENDANCE] = records;
    }
    const studentRecords = records.filter(r => r.studentId === studentId);
    
    const present = studentRecords.filter(r => r.status === 'Present').length;
    const absent = studentRecords.filter(r => r.status === 'Absent').length;
    const schoolOpen = present + absent;
    
    return {
      present,
      schoolOpen
    };
  }

  static getStudentAttendanceHistory(studentId: string) {
    let records: AttendanceRecord[];
    if (this._cache[STORAGE_KEYS.ATTENDANCE]) {
      records = this._cache[STORAGE_KEYS.ATTENDANCE];
    } else {
      records = getStorageItem<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
      this._cache[STORAGE_KEYS.ATTENDANCE] = records;
    }
    return records
      .filter(r => r.studentId === studentId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  static getStudentAcademicTrends(studentId: string) {
    this.getAssessments(); // ensures _assessmentsByStudent is populated
    const studentAssessments = this._assessmentsByStudent.get(studentId) || [];
    
    // Sort by year and term to get chronological order
    return studentAssessments.sort((a, b) => {
      if (a.academicYear !== b.academicYear) {
        return a.academicYear.localeCompare(b.academicYear);
      }
      return a.term.localeCompare(b.term);
    });
  }

  // -------------------------
  // STAFF ATTENDANCE MANAGEMENT
  // -------------------------
  static getStaffAttendance(date: string): StaffAttendanceRecord[] {
    let list: StaffAttendanceRecord[];
    if (this._cache[STORAGE_KEYS.STAFF_ATTENDANCE]) {
      list = this._cache[STORAGE_KEYS.STAFF_ATTENDANCE];
    } else {
      list = getStorageItem<StaffAttendanceRecord[]>(STORAGE_KEYS.STAFF_ATTENDANCE, []);
      this._cache[STORAGE_KEYS.STAFF_ATTENDANCE] = list;
    }
    const teachers = this.getTeachers();

    return teachers.map(teacher => {
      const idKey = `${date}_${teacher.id}`;
      const existing = list.find(r => r.id === idKey);
      if (existing) {
        return existing;
      } else {
        return {
          id: idKey,
          date,
          teacherId: teacher.id,
          teacherName: `${teacher.firstName} ${teacher.middleName ? teacher.middleName + ' ' : ''}${teacher.lastName}`,
          status: 'Unmarked',
          arrivalTime: '',
          departureTime: '',
          remarks: ''
        };
      }
    });
  }

  static saveStaffAttendanceBatch(records: StaffAttendanceRecord[]): void {
    let list: StaffAttendanceRecord[];
    if (this._cache[STORAGE_KEYS.STAFF_ATTENDANCE]) {
      list = this._cache[STORAGE_KEYS.STAFF_ATTENDANCE];
    } else {
      list = getStorageItem<StaffAttendanceRecord[]>(STORAGE_KEYS.STAFF_ATTENDANCE, []);
    }
    records.forEach(rec => {
      const idx = list.findIndex(r => r.id === rec.id);
      if (idx >= 0) {
        list[idx] = rec;
      } else {
        list.push(rec);
      }
    });
    this.performFirestoreWriteBatch('staff_attendance', records.map(rec => ({
      id: rec.id,
      type: 'set',
      data: rec
    })));
    setStorageItem(STORAGE_KEYS.STAFF_ATTENDANCE, list);
    this._cache[STORAGE_KEYS.STAFF_ATTENDANCE] = list;
  }

  static getAllStaffAttendance(): StaffAttendanceRecord[] {
    if (this._cache[STORAGE_KEYS.STAFF_ATTENDANCE]) {
      return this._cache[STORAGE_KEYS.STAFF_ATTENDANCE];
    }
    const list = getStorageItem<StaffAttendanceRecord[]>(STORAGE_KEYS.STAFF_ATTENDANCE, []);
    this._cache[STORAGE_KEYS.STAFF_ATTENDANCE] = list;
    return list;
  }

  // -------------------------
  // SCHOOL ASSESSMENT SYSTEM
  // -------------------------
  static getAssessmentTemplates(): AssessmentTemplate[] {
    if (this._cache[STORAGE_KEYS.ASSESSMENT_TEMPLATES]) {
      return this._cache[STORAGE_KEYS.ASSESSMENT_TEMPLATES];
    }
    const list = getStorageItem<AssessmentTemplate[]>(STORAGE_KEYS.ASSESSMENT_TEMPLATES, []);
    this._cache[STORAGE_KEYS.ASSESSMENT_TEMPLATES] = list;
    return list;
  }

  static saveAssessmentTemplate(template: AssessmentTemplate): void {
    const list = this.getAssessmentTemplates();
    const idx = list.findIndex(t => t.id === template.id);
    if (idx >= 0) {
      list[idx] = template;
    } else {
      list.push(template);
    }
    setStorageItem(STORAGE_KEYS.ASSESSMENT_TEMPLATES, list);
    this._cache[STORAGE_KEYS.ASSESSMENT_TEMPLATES] = list;
    this.performFirestoreWrite('assessment_templates', template.id, 'set', template);
  }

  static deleteAssessmentTemplate(id: string): void {
    const list = this.getAssessmentTemplates();
    const updated = list.filter(t => t.id !== id);
    setStorageItem(STORAGE_KEYS.ASSESSMENT_TEMPLATES, updated);
    this._cache[STORAGE_KEYS.ASSESSMENT_TEMPLATES] = updated;
    this.performFirestoreWrite('assessment_templates', id, 'delete');
  }

  static getAssessmentTemplate(classType: ClassType, academicYear: AcademicYearType, term: TermType, subject: SubjectType): AssessmentTemplate | null {
    const compoundId = `${classType}_${academicYear}_${term}_${subject.replace(/\s+/g, '')}`.replace(/\//g, '-');
    const list = this.getAssessmentTemplates();
    return list.find(t => t.id === compoundId) || null;
  }

  static getAssessments(includeArchived: boolean = false): StudentAssessment[] {
    let list: StudentAssessment[];
    if (this._cache[STORAGE_KEYS.ASSESSMENTS]) {
      list = this._cache[STORAGE_KEYS.ASSESSMENTS];
    } else {
      list = getStorageItem<StudentAssessment[]>(STORAGE_KEYS.ASSESSMENTS, []);
      let updated = false;
      const sanitized = list.map(item => {
        if (item.id && item.id.includes('/')) {
          item.id = item.id.replace(/\//g, '-');
          updated = true;
        }
        return item;
      });
      if (updated) {
        setStorageItem(STORAGE_KEYS.ASSESSMENTS, sanitized);
      }
      this._cache[STORAGE_KEYS.ASSESSMENTS] = sanitized;
      list = sanitized;
    }

    // Always ensure _assessmentsByStudent index is thoroughly populated
    if (this._assessmentsByStudent.size === 0 && list.length > 0) {
      const index = new Map<string, StudentAssessment[]>();
      list.forEach(item => {
        const studentId = item.studentId;
        if (studentId) {
          if (!index.has(studentId)) {
            index.set(studentId, []);
          }
          index.get(studentId)!.push(item);
        }
      });
      this._assessmentsByStudent = index;
    }

    return includeArchived ? list : list.filter(a => !a.isArchived);
  }

  static saveAllAssessments(assessments: StudentAssessment[]): void {
    setStorageItem(STORAGE_KEYS.ASSESSMENTS, assessments);
    this._cache[STORAGE_KEYS.ASSESSMENTS] = assessments;
    this.performFirestoreWriteBatch('assessments', assessments.map(item => ({
      id: item.id,
      type: 'set',
      data: item
    })));

    // Rebuild assessment lookup index
    const index = new Map<string, StudentAssessment[]>();
    assessments.forEach(item => {
      const studentId = item.studentId;
      if (studentId) {
        if (!index.has(studentId)) {
          index.set(studentId, []);
        }
        index.get(studentId)!.push(item);
      }
    });
    this._assessmentsByStudent = index;
    this.broadcastSyncEvent('assessments-updated', assessments);
  }

  static saveAllStudents(students: Student[]): void {
    setStorageItem(STORAGE_KEYS.STUDENTS, students);
    this._cache[STORAGE_KEYS.STUDENTS] = students;
    this.performFirestoreWriteBatch('students', students.map(item => ({
      id: item.id,
      type: 'set',
      data: item
    })));

    // Rebuild index
    const index = new Map<string, Student[]>();
    students.forEach(s => {
      const cls = s.class;
      if (cls) {
        if (!index.has(cls)) {
          index.set(cls, []);
        }
        index.get(cls)!.push(s);
      }
    });
    this._studentsByClass = index;
  }

  // Load or construct assessment sheets for a class, year, term, and subject
  static getAssessmentsSheet(
    className: ClassType,
    academicYear: AcademicYearType,
    term: TermType,
    subject: SubjectType,
    includeArchived: boolean = true
  ): StudentAssessment[] {
    const allAssessments = this.getAssessments(true); // guaranteed to populate _assessmentsByStudent
    this.getStudents(); // guaranteed to populate _studentsByClass
    const students = this._studentsByClass.get(className) || this.getStudents().filter(s => s.class === className);
    
    const template = this.getAssessmentTemplate(className, academicYear, term, subject);
    const normalizedSubject = subject.trim().toLowerCase();
    const compactSubject = subject.replace(/\s+/g, '');

    // Build assessment row for each student
    const sheet = students.map(st => {
      const compoundId = `${st.id}_${academicYear}_${term}_${compactSubject}`.replace(/\//g, '-');
      const studentAssessments = this._assessmentsByStudent.get(st.id) || [];
      
      // Look up existing assessment: by direct compound ID or matching composite keys
      const found = studentAssessments.find(a => 
        a.id === compoundId || 
        (a.studentId === st.id && 
         a.academicYear === academicYear && 
         a.term === term && 
         (a.subject === subject || 
          a.subject?.trim().toLowerCase() === normalizedSubject || 
          a.subject?.replace(/\s+/g, '') === compactSubject))
      ) || allAssessments.find(a => 
        a.id === compoundId || 
        (a.studentId === st.id && 
         a.academicYear === academicYear && 
         a.term === term && 
         (a.subject === subject || 
          a.subject?.trim().toLowerCase() === normalizedSubject || 
          a.subject?.replace(/\s+/g, '') === compactSubject))
      );
      
      if (found) {
        // Enforce the student name check in case it was renamed in database
        found.studentName = `${st.firstName} ${st.middleName ? st.middleName + ' ' : ''}${st.lastName}`;
        // Ensure custom assessment fields sync with template
        if (template) {
          found.isCustomAssessment = true;
          if (!found.customAssessments) found.customAssessments = [];
          // Match length
          while (found.customAssessments.length < template.components.length) {
            found.customAssessments.push(0);
          }
        } else {
          found.isCustomAssessment = false;
        }
        return this.calculateScoreDetails(found, template);
      } else {
        // Empty default template with no automatically input/pre-populated scores or values
        const emptyAssessment: StudentAssessment = {
          id: compoundId,
          studentId: st.id,
          studentName: `${st.firstName} ${st.middleName ? st.middleName + ' ' : ''}${st.lastName}`,
          class: className,
          academicYear,
          term,
          subject,
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

        if (template) {
          emptyAssessment.isCustomAssessment = true;
          emptyAssessment.customAssessments = new Array(template.components.length).fill(0);
        }

        return this.calculateScoreDetails(emptyAssessment, template);
      }
    });

    // Calculate rankings dynamically for this specific sheet
    return this.calculatePositions(sheet);
  }

  // Recalculates scoring results for a given assessment and ranks the entire cohort
  static calculateScoreDetails(item: StudentAssessment, template?: AssessmentTemplate | null): StudentAssessment {
    // 1. Constrain individual inputs defensively
    const exercises = item.exercises.map(m => Math.min(10, Math.max(0, Number(m) || 0)));
    const tests = item.tests.map(m => Math.min(20, Math.max(0, Number(m) || 0)));
    const projectWork = Math.min(10, Math.max(0, Number(item.projectWork) || 0));
    const groupWork = Math.min(10, Math.max(0, Number(item.groupWork) || 0));
    const examScore100 = Math.min(100, Math.max(0, Number(item.examScore100) || 0));

    let classScoreTotal = 0;
    let classScore50 = 0;

    if (item.isCustomAssessment && item.customAssessments && template && template.components.length > 0) {
      // Scale custom assessments to 50% based on template max scores
      let totalMax = 0;
      let totalScore = 0;
      
      const customScores = item.customAssessments.map((score, idx) => {
        const max = template.components[idx]?.maxScore || 100;
        totalMax += max;
        const constrainedScore = Math.min(max, Math.max(0, Number(score) || 0));
        totalScore += constrainedScore;
        return constrainedScore;
      });
      
      item.customAssessments = customScores;
      
      classScoreTotal = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
      classScore50 = parseFloat((classScoreTotal * 0.50).toFixed(2));
      classScoreTotal = parseFloat(classScoreTotal.toFixed(2));
    } else {
      // 2. Class Assessment Total: 4 Exercises (40) + 2 Tests (40) + Project (10) + Group (10) = 100 marks maximum
      const sumExercises = exercises.reduce((a, b) => a + b, 0);
      const sumTests = tests.reduce((a, b) => a + b, 0);
      classScoreTotal = sumExercises + sumTests + projectWork + groupWork;

      // Convert class assessment to 50%
      classScore50 = parseFloat((classScoreTotal * 0.50).toFixed(2));
    }

    // Exam score to 50%
    const examScore50 = parseFloat((examScore100 * 0.50).toFixed(2));

    // Total score = Class Assessment 50% + Examination 50%
    const totalScore = parseFloat((classScore50 + examScore50).toFixed(2));

    // Determine GES new curriculum grading levels
    // L5 (0%-39%) - Emerging
    // L4 (40%-53%) - Developing
    // L3 (54% - 67%) - Approaching Proficiency
    // L2 (68%-79%) - Proficient
    // L1 (80%-100%) - Highly Proficient
    let gradeLevel: 'L1' | 'L2' | 'L3' | 'L4' | 'L5' = 'L5';
    let remarks = 'Emerging';

    if (totalScore >= 80) {
      gradeLevel = 'L1';
      remarks = 'Highly Proficient';
    } else if (totalScore >= 68) {
      gradeLevel = 'L2';
      remarks = 'Proficient';
    } else if (totalScore >= 54) {
      gradeLevel = 'L3';
      remarks = 'Approaching Proficiency';
    } else if (totalScore >= 40) {
      gradeLevel = 'L4';
      remarks = 'Developing';
    } else {
      gradeLevel = 'L5';
      remarks = 'Emerging';
    }

    return {
      ...item,
      exercises,
      tests,
      projectWork,
      groupWork,
      classScoreTotal,
      classScore50,
      examScore100,
      examScore50,
      totalScore,
      gradeLevel,
      remarks
    };
  }

  // Assign position ranks to students based on total scores (Descending)
  static calculatePositions(sheet: StudentAssessment[], template?: AssessmentTemplate | null): StudentAssessment[] {
    const rawScores = sheet.map(s => this.calculateScoreDetails(s, template));
    
    // Sort descending by total score
    const sorted = [...rawScores].sort((a, b) => b.totalScore - a.totalScore);
    
    // Assign position ranks supporting tied scores
    return rawScores.map(item => {
      const positionIndex = sorted.findIndex(s => s.totalScore === item.totalScore);
      return {
        ...item,
        position: positionIndex + 1
      };
    });
  }

  static saveAssessmentsSheet(sheet: StudentAssessment[]): void {
    if (!sheet || sheet.length === 0) return;
    const activeSchoolId = this.resolveActiveSchoolId();
    const first = sheet[0];
    const template = this.getAssessmentTemplate(first.class, first.academicYear, first.term, first.subject);
    const allAssessments = this.getAssessments(true);
    const updatedSheet = this.calculatePositions(sheet, template);

    let loggedChangesCount = 0;
    const changeDetails: string[] = [];

    updatedSheet.forEach(item => {
      if (!item.schoolId) item.schoolId = activeSchoolId;
      const normalizedSubj = item.subject?.trim().toLowerCase();
      const compactSubj = item.subject?.replace(/\s+/g, '');
      const idx = allAssessments.findIndex(a => 
        a.id === item.id || 
        (a.studentId === item.studentId && 
         a.academicYear === item.academicYear && 
         a.term === item.term && 
         (a.subject === item.subject || 
          a.subject?.trim().toLowerCase() === normalizedSubj || 
          a.subject?.replace(/\s+/g, '') === compactSubj))
      );

      if (idx >= 0) {
        const olditem = allAssessments[idx];
        const oldExam = olditem.examScore100;
        const newExam = item.examScore100;
        const oldTotal = olditem.totalScore;
        const newTotal = item.totalScore;

        if (oldExam !== newExam || oldTotal !== newTotal) {
          loggedChangesCount++;
          if (changeDetails.length < 5) {
            changeDetails.push(
              `${item.studentName} (${item.class}, ${item.subject}): Exam ${oldExam}% → ${newExam}%, Total ${oldTotal.toFixed(1)}% → ${newTotal.toFixed(1)}%`
            );
          }
        }
        allAssessments[idx] = item;
      } else {
        allAssessments.push(item);
      }
    });

    // Atomic batch sync to cloud without delay
    this.performFirestoreWriteBatch('assessments', updatedSheet.map(item => ({
      id: item.id,
      type: 'set',
      data: item
    })));

    if (loggedChangesCount > 0) {
      let detailsMessage = `Modified grades for ${loggedChangesCount} student assessment records.`;
      if (changeDetails.length > 0) {
        detailsMessage += ` Highlights: ${changeDetails.join(' | ')}`;
      }
      if (loggedChangesCount > 5) {
        detailsMessage += ` (+${loggedChangesCount - 5} more)`;
      }
      this.writeActivityLog(
        'Assessment Grade Changes',
        detailsMessage,
        'high'
      );
    }

    setStorageItem(STORAGE_KEYS.ASSESSMENTS, allAssessments);
    this._cache[STORAGE_KEYS.ASSESSMENTS] = allAssessments;

    // Rebuild assessment lookup index
    const index = new Map<string, StudentAssessment[]>();
    allAssessments.forEach(item => {
      const studentId = item.studentId;
      if (!index.has(studentId)) {
        index.set(studentId, []);
      }
      index.get(studentId)!.push(item);
    });
    this._assessmentsByStudent = index;
    this.broadcastSyncEvent('assessments-updated', updatedSheet);
  }

  static archiveAssessmentWorksheet(
    className: ClassType,
    academicYear: AcademicYearType,
    term: TermType,
    subject: SubjectType
  ): void {
    const activeRows = this.getAssessmentsSheet(className, academicYear, term, subject);
    const updatedRows = activeRows.map(row => ({
      ...row,
      isArchived: true,
      archivedAt: new Date().toISOString()
    }));
    this.saveAssessmentsSheet(updatedRows);
  }

  static restoreAssessmentWorksheet(
    className: ClassType,
    academicYear: AcademicYearType,
    term: TermType,
    subject: SubjectType
  ): void {
    const activeRows = this.getAssessmentsSheet(className, academicYear, term, subject, true);
    const updatedRows = activeRows.map(row => {
      const { isArchived, archivedAt, ...rest } = row;
      return {
        ...rest,
        isArchived: false
      };
    });
    this.saveAssessmentsSheet(updatedRows);
  }

  static getArchivedWorksheets(): { className: ClassType; academicYear: AcademicYearType; term: TermType; subject: SubjectType; archivedAt: string }[] {
    const all = this.getAssessments(true);
    const archivedMap = new Map<string, { className: ClassType; academicYear: AcademicYearType; term: TermType; subject: SubjectType; archivedAt: string }>();
    
    all.forEach(item => {
      if (item.isArchived) {
        const key = `${item.class}_${item.academicYear}_${item.term}_${item.subject}`;
        if (!archivedMap.has(key)) {
          archivedMap.set(key, {
            className: item.class as ClassType,
            academicYear: item.academicYear as AcademicYearType,
            term: item.term as TermType,
            subject: item.subject as SubjectType,
            archivedAt: item.archivedAt || new Date().toISOString()
          });
        }
      }
    });
    
    return Array.from(archivedMap.values());
  }

  // Get report cards for an individual student across multiple subjects for a given term
  static getStudentTermReportCard(
    studentId: string,
    academicYear: AcademicYearType,
    term: TermType
  ) {
    this.getAssessments(); // ensures _assessmentsByStudent is populated
    this.getStudents(); // ensures _studentsByClass is populated
    
    const student = this.getStudents().find(s => s.id === studentId);
    if (!student) return null;

    // Find all assessment entries for this student, year, and term using index
    const studentAssessments = this._assessmentsByStudent.get(studentId) || [];
    const explicitGrades = studentAssessments.filter(
      a => a.academicYear === academicYear && a.term === term
    );

    // We only use explicit assessment grades entered with data
    const studentGrades = explicitGrades;

    // Calculate general average score
    const totalScoreSum = studentGrades.reduce((sum, item) => sum + item.totalScore, 0);
    const averageScore = studentGrades.length > 0 
      ? parseFloat((totalScoreSum / studentGrades.length).toFixed(2)) 
      : 0;

    const attStats = this.getStudentAttendanceStats(studentId);

    // Compute dynamic rank inside the student's primary academic class using index
    const targetClass = student.class;
    const classStudents = this._studentsByClass.get(targetClass) || [];
    const rankings = classStudents.map(cs => {
      const csAssessments = this._assessmentsByStudent.get(cs.id) || [];
      const gList = csAssessments.filter(
        a => a.academicYear === academicYear && a.term === term
      );
      const sum = gList.reduce((acc, item) => acc + item.totalScore, 0);
      const avg = gList.length > 0 ? parseFloat((sum / gList.length).toFixed(2)) : 0;
      return {
        studentId: cs.id,
        average: avg,
        hasGrades: gList.length > 0
      };
    });

    const studentMetric = rankings.find(r => r.studentId === studentId);
    let classRankStr = "N/A";
    let gradedClassCount = 0;
    if (studentMetric && studentMetric.hasGrades) {
      const strictlyHigherCount = rankings.filter(r => r.hasGrades && r.average > studentMetric.average).length;
      gradedClassCount = rankings.filter(r => r.hasGrades).length;
      classRankStr = `${strictlyHigherCount + 1} of ${gradedClassCount}`;
    }

    return {
      student,
      grades: studentGrades,
      averageScore,
      totalSubjects: studentGrades.length,
      attendancePresent: attStats.present,
      schoolOpenDays: attStats.schoolOpen,
      classRank: classRankStr,
      gradedCount: gradedClassCount
    };
  }

  // -------------------------
  // SCHOOL FEES MANAGEMENT
  // -------------------------
  static getStudentFeeBills(): StudentFeeBill[] {
    if (this._cache[STORAGE_KEYS.FEES]) {
      return this._cache[STORAGE_KEYS.FEES];
    }
    const list = getStorageItem<StudentFeeBill[]>(STORAGE_KEYS.FEES, []);
    this._cache[STORAGE_KEYS.FEES] = list;
    return list;
  }

  static saveStudentFeeBill(bill: StudentFeeBill): void {
    const bills = this.getStudentFeeBills();
    const idx = bills.findIndex(b => b.id === bill.id);
    if (idx >= 0) {
      bills[idx] = bill;
    } else {
      bills.push(bill);
    }
    setStorageItem(STORAGE_KEYS.FEES, bills);
    this._cache[STORAGE_KEYS.FEES] = bills;
    this.performFirestoreWrite('fees', bill.id, 'set', bill);
  }

  static deleteStudentFeeBill(billId: string): void {
    const bills = this.getStudentFeeBills();
    const filtered = bills.filter(b => b.id !== billId);
    setStorageItem(STORAGE_KEYS.FEES, filtered);
    this._cache[STORAGE_KEYS.FEES] = filtered;
    this.performFirestoreWrite('fees', billId, 'delete');
  }

  static clearAllStudentFeeBills(): void {
    const bills = this.getStudentFeeBills();
    this.performFirestoreWriteBatch('fees', bills.filter(b => !!b.id).map(b => ({
      id: b.id,
      type: 'delete'
    })));
    setStorageItem(STORAGE_KEYS.FEES, []);
    this._cache[STORAGE_KEYS.FEES] = [];
    localStorage.removeItem('school_fees_bills');
  }

  // -------------------------
  // PAYSTACK TRANSACTIONS MANAGEMENT
  // -------------------------
  static async getPaystackPaymentsAsync(): Promise<PaystackPayment[]> {
    if (isFirebaseActive && firestoreDb) {
      try {
        const currentUser = this.getCurrentUser();
        const uid = firebaseAuth?.currentUser?.uid || currentUser?.uid;
        if (!uid) {
          return this.getLocalPaystackPayments();
        }
        const qSnap = await getDocs(query(collection(firestoreDb, 'paystack_payments'), where('ownerId', '==', uid)));
        const list = qSnap.docs.map(doc => {
          const d = doc.data();
          return {
            id: d.id || doc.id,
            reference: d.reference || d.id || doc.id,
            studentId: d.studentId || '',
            studentName: d.studentName || '',
            billId: d.billId || '',
            component: d.component || 'School Fees',
            amount: typeof d.amount === 'number' ? d.amount : (d.amount?.doubleValue || Number(d.amount) || 0),
            academicYear: d.academicYear || '',
            term: d.term || '',
            status: d.status || 'ongoing',
            paidAt: d.paidAt || '',
            createdAt: d.createdAt || ''
          } as PaystackPayment;
        });
        setStorageItem(STORAGE_KEYS.PAYSTACK_LOGS, list);
        this._cache[STORAGE_KEYS.PAYSTACK_LOGS] = list;
        return list;
      } catch (error) {
        console.warn("Could not fetch Paystack logs from Firestore:", error);
      }
    }
    return this.getLocalPaystackPayments();
  }

  static getLocalPaystackPayments(): PaystackPayment[] {
    if (this._cache[STORAGE_KEYS.PAYSTACK_LOGS]) {
      return this._cache[STORAGE_KEYS.PAYSTACK_LOGS];
    }
    const list = getStorageItem<PaystackPayment[]>(STORAGE_KEYS.PAYSTACK_LOGS, []);
    this._cache[STORAGE_KEYS.PAYSTACK_LOGS] = list;
    return list;
  }

  static savePaystackPayment(payment: PaystackPayment): void {
    const list = this.getLocalPaystackPayments();
    const idx = list.findIndex(p => p.id === payment.id);
    if (idx >= 0) {
      list[idx] = payment;
    } else {
      list.push(payment);
    }
    setStorageItem(STORAGE_KEYS.PAYSTACK_LOGS, list);
    this._cache[STORAGE_KEYS.PAYSTACK_LOGS] = list;
    this.performFirestoreWrite('paystack_payments', payment.id, 'set', payment);
  }

  static deletePaystackPayment(paymentId: string): void {
    const list = this.getLocalPaystackPayments();
    const filtered = list.filter(p => p.id !== paymentId);
    setStorageItem(STORAGE_KEYS.PAYSTACK_LOGS, filtered);
    this._cache[STORAGE_KEYS.PAYSTACK_LOGS] = filtered;
    this.performFirestoreWrite('paystack_payments', paymentId, 'delete');
  }

  static clearAllPaystackPayments(): void {
    const payments = this.getLocalPaystackPayments();
    this.performFirestoreWriteBatch('paystack_payments', payments.filter(p => !!p.id).map(p => ({
      id: p.id,
      type: 'delete'
    })));
    setStorageItem(STORAGE_KEYS.PAYSTACK_LOGS, []);
    this._cache[STORAGE_KEYS.PAYSTACK_LOGS] = [];
  }

  // System settings customization
  static getSystemSettings() {
    if (this._cache[STORAGE_KEYS.SETTINGS]) {
      return this._cache[STORAGE_KEYS.SETTINGS];
    }
    const settings = getStorageItem(STORAGE_KEYS.SETTINGS, {
      theme: 'Classic' as ThemeType,
      autoSave: true,
      term: 'Term 1' as TermType,
      academicYear: '2026/2027' as AcademicYearType,
      schoolSystemName: 'GEETECH SMS & ASSESSMENT CENTER',
      idleLogoutTimer: 30 // Default 30 minutes
    });
    this._cache[STORAGE_KEYS.SETTINGS] = settings;
    return settings;
  }

  static saveSystemSettings(settings: any) {
    setStorageItem(STORAGE_KEYS.SETTINGS, settings);
    this._cache[STORAGE_KEYS.SETTINGS] = settings;
    this.performFirestoreWrite('settings', 'system_settings', 'set', settings).catch(err => {
      console.warn("Could not sync system settings to Firestore:", err);
    });
  }

  // -------------------------
  // AUTOMATIC DATABASE BACKUPS
  // -------------------------
  static getAutoBackupConfig(): AutoBackupConfig {
    const cached = this._cache[STORAGE_KEYS.AUTO_BACKUP_CONFIG];
    if (cached) return cached;

    const config = getStorageItem<AutoBackupConfig>(STORAGE_KEYS.AUTO_BACKUP_CONFIG, {
      enabled: false,
      frequency: 'weekly',
      lastBackupTime: null
    });
    this._cache[STORAGE_KEYS.AUTO_BACKUP_CONFIG] = config;
    return config;
  }

  static saveAutoBackupConfig(config: AutoBackupConfig) {
    setStorageItem(STORAGE_KEYS.AUTO_BACKUP_CONFIG, config);
    this._cache[STORAGE_KEYS.AUTO_BACKUP_CONFIG] = config;
    this.performFirestoreWrite('settings', 'auto_backup_config', 'set', config).catch(err => {
      console.warn("Could not sync auto backup config to Firestore:", err);
    });
  }

  static getAutoBackups(): AutoBackupEntry[] {
    const cached = this._cache[STORAGE_KEYS.AUTO_BACKUPS];
    if (cached) return cached;

    const backups = getStorageItem<AutoBackupEntry[]>(STORAGE_KEYS.AUTO_BACKUPS, []);
    this._cache[STORAGE_KEYS.AUTO_BACKUPS] = backups;
    return backups;
  }

  static getFirebaseConfig() {
    return {
      active: isFirebaseActive,
      projectId: resolvedFirebaseConfig.projectId,
      authDomain: resolvedFirebaseConfig.authDomain || (resolvedFirebaseConfig.projectId ? `${resolvedFirebaseConfig.projectId}.firebaseapp.com` : '')
    };
  }

  static saveAutoBackups(backups: AutoBackupEntry[]) {
    setStorageItem(STORAGE_KEYS.AUTO_BACKUPS, backups);
    this._cache[STORAGE_KEYS.AUTO_BACKUPS] = backups;
  }

  static performAutoBackup(): { success: boolean; timestamp: string } {
    const data = this.exportAllData();
    const timestamp = new Date().toISOString();
    const entry: AutoBackupEntry = {
      id: `auto_${Date.now()}`,
      timestamp,
      size: new Blob([data]).size,
      data
    };

    let backups = this.getAutoBackups();
    backups = [entry, ...backups];

    // FIFO rotation: Keep last 5 backups
    if (backups.length > 5) {
      backups = backups.slice(0, 5);
    }

    this.saveAutoBackups(backups);

    // Update config lastBackupTime
    const config = this.getAutoBackupConfig();
    config.lastBackupTime = timestamp;
    this.saveAutoBackupConfig(config);

    // Write activity log
    this.writeActivityLog(
      'Automatic Database Backup',
      `Auto-backup successfully executed. Backup size: ${(entry.size / 1024).toFixed(2)} KB.`,
      'info'
    );

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: {
          text: `Auto-Backup Completed: Local database snapshot saved (${(entry.size / 1024).toFixed(1)} KB)`,
          type: 'success'
        }
      }));
    }

    return { success: true, timestamp };
  }

  static deleteAutoBackup(id: string) {
    let backups = this.getAutoBackups();
    backups = backups.filter(b => b.id !== id);
    this.saveAutoBackups(backups);
  }

  static getCloudSyncConfig(): CloudSyncConfig {
    const cached = this._cache[STORAGE_KEYS.CLOUD_SYNC_CONFIG];
    if (cached) return cached;

    const config = getStorageItem<CloudSyncConfig>(STORAGE_KEYS.CLOUD_SYNC_CONFIG, {
      enabled: false,
      provider: 'Firebase Cloud Storage',
      interval: 'daily',
      lastSyncTime: null,
      status: 'idle'
    });
    this._cache[STORAGE_KEYS.CLOUD_SYNC_CONFIG] = config;
    return config;
  }

  static saveCloudSyncConfig(config: CloudSyncConfig) {
    setStorageItem(STORAGE_KEYS.CLOUD_SYNC_CONFIG, config);
    this._cache[STORAGE_KEYS.CLOUD_SYNC_CONFIG] = config;
    this.performFirestoreWrite('settings', 'cloud_sync_config', 'set', config).catch(err => {
      console.warn("Could not sync cloud sync config to Firestore:", err);
    });
  }

  static async performCloudSync(): Promise<{ success: boolean; error?: string }> {
    const config = this.getCloudSyncConfig();
    const timestamp = new Date().toISOString();
    const data = this.exportAllData();
    const currentUser = this.getCurrentUser();
    const schoolId = currentUser?.schoolId || currentUser?.uid || 'anonymous';
    
    // Use a fixed filename to "overwrite" and keep data updated as requested
    const fileName = `school_data_snapshot.json`;

    config.status = 'syncing';
    this.saveCloudSyncConfig(config);

    try {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (!isOnline) throw new Error("No internet connection. Please connect to the internet and try again.");

      if (config.provider === 'Firebase Cloud Storage') {
        if (!isFirebaseActive) throw new Error("Firebase Cloud services are not active. Ensure your API keys are configured correctly.");
        const storage = getStorage(firebaseApp);
        
        // Use a short timeout of 15 seconds to fail fast if the Storage Bucket is not enabled/configured
        storage.maxUploadRetryTime = 15000;
        storage.maxOperationRetryTime = 15000;
        
        const path = `schools/${schoolId}/backups/${fileName}`;
        const storageRef = ref(storage, path);
        
        // Use uploadBytes with a Blob for more stable transfer of potentially large JSON data
        const blob = new Blob([data], { type: 'application/json' });
        
        await uploadBytes(storageRef, blob, { 
          contentType: 'application/json',
          customMetadata: {
            'timestamp': timestamp,
            'schoolId': schoolId,
            'version': '1.1'
          }
        });
      } else if (config.provider === 'Google Drive') {
        const token = localStorage.getItem('google_access_token');
        if (!token) {
          throw new Error("No Google Drive access token found. Please sign in via Google login to authorize Google Drive.");
        }

        const driveFileName = `geetech_sms_backup_${schoolId}.json`;

        // Check if file already exists in Google Drive to overwrite
        let existingFileId: string | null = null;
        try {
          const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name%3D'${encodeURIComponent(driveFileName)}'%20and%20trashed%3Dfalse`;
          const searchRes = await fetch(searchUrl, {
            headers: { 'Authorization': 'Bearer ' + token }
          });
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            if (searchData.files && searchData.files.length > 0) {
              existingFileId = searchData.files[0].id;
            }
          }
        } catch (searchErr) {
          console.warn("Google Drive search for existing backup failed, proceeding with post creation:", searchErr);
        }

        // Create standard multipart body
        const metadata = {
          name: driveFileName,
          mimeType: 'application/json',
          description: `Cloud backup snapshot for School ID: ${schoolId}. Overwritten on: ${timestamp}`
        };

        const boundary = 'drive_backup_boundary_s8du92';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";

        const multipartRequestBody =
          delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          'Content-Type: application/json\r\n\r\n' +
          data +
          close_delim;

        const endpoint = existingFileId
          ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
          : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

        const method = existingFileId ? 'PATCH' : 'POST';

        const driveResponse = await fetch(endpoint, {
          method: method,
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'multipart/related; boundary=' + boundary,
          },
          body: multipartRequestBody
        });

        if (!driveResponse.ok) {
          const driveErrText = await driveResponse.text();
          if (driveResponse.status === 401) {
            throw new Error("Google Drive authorization expired. Please sign out and sign in again via Google login to re-authorize.");
          }
          throw new Error(`Google Drive upload failed: ${driveResponse.status} ${driveResponse.statusText} - ${driveErrText}`);
        }
      }

      config.status = 'success';
      config.lastSyncTime = timestamp;
      config.error = undefined;
      this.saveCloudSyncConfig(config);

      this.writeActivityLog(
        'Cloud Database Sync',
        `Database successfully updated on ${config.provider}. Destination: ${schoolId}/${fileName}`,
        'info'
      );

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app-toast', {
          detail: {
            text: `Cloud Backup Completed: All system data securely synced to ${config.provider}`,
            type: 'success'
          }
        }));
      }

      return { success: true };
    } catch (e: any) {
      config.status = 'failed';
      let errorMessage = e.message || String(e);
      
      // Handle specific Firebase Storage errors with user-friendly messages
      if (errorMessage.includes('storage/retry-limit-exceeded') || errorMessage.includes('retry-limit-exceeded')) {
        errorMessage = "Cloud Sync Timeout: No response from Firebase. Please ensure you have activated 'Storage' in your Firebase Console (Build > Storage > Get Started) and set up the default bucket.";
      } else if (errorMessage.includes('storage/unauthorized') || errorMessage.includes('unauthorized')) {
        errorMessage = "Cloud Sync Permission Denied: Your account doesn't have permission to write to this storage bucket. Please ensure you have activated 'Storage' in your Firebase Console and default security rules are configured.";
      } else if (errorMessage.includes('storage/invalid-default-bucket')) {
        errorMessage = "Cloud Sync Failed: Invalid default Storage Bucket configured. Please check your firebase-applet-config.json file.";
      }
      
      config.error = errorMessage;
      this.saveCloudSyncConfig(config);
      
      this.writeActivityLog(
        'Cloud Database Sync Failed',
        `Failed to sync to ${config.provider}: ${config.error}`,
        'high'
      );

      return { success: false, error: config.error };
    }
  }

  static async saveToGoogleDrive(): Promise<{ success: boolean; folderName?: string; fileName?: string; error?: string }> {
    try {
      const token = localStorage.getItem('google_access_token');
      if (!token) {
        throw new Error("No Google Drive access token found. Please authenticate with Google first.");
      }

      const timestamp = new Date().toISOString();
      const currentUser = this.getCurrentUser();
      const schoolId = currentUser?.schoolId || currentUser?.uid || 'anonymous';
      const data = this.exportAllData();
      
      // 1. Search for 'GEETECH-Backups' folder on Google Drive
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent("name='GEETECH-Backups' and mimeType='application/vnd.google-apps.folder' and trashed=false")}`;
      const searchRes = await fetch(searchUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!searchRes.ok) {
        if (searchRes.status === 401) {
          throw new Error("Google Drive authorization expired. Please sign in again via Google login to re-authorize.");
        }
        throw new Error(`Failed to search for Google Drive folder: ${searchRes.statusText}`);
      }
      
      const searchData = await searchRes.json();
      let folderId = '';
      if (searchData.files && searchData.files.length > 0) {
        folderId = searchData.files[0].id;
      } else {
        // Create the folder 'GEETECH-Backups'
        const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: 'GEETECH-Backups',
            mimeType: 'application/vnd.google-apps.folder'
          })
        });
        if (!createRes.ok) {
          throw new Error(`Failed to create 'GEETECH-Backups' folder on Google Drive: ${createRes.statusText}`);
        }
        const folderData = await createRes.json();
        folderId = folderData.id;
      }

      // 2. Upload the file to that folder
      const driveFileName = `geetech_sms_backup_${schoolId}_${timestamp.replace(/[:.]/g, '-')}.json`;
      const metadata = {
        name: driveFileName,
        mimeType: 'application/json',
        description: `Cloud backup snapshot for School ID: ${schoolId}. Generated on: ${timestamp}`,
        parents: [folderId]
      };

      const boundary = 'drive_backup_boundary_s8du92';
      const delimiter = "\r\n--" + boundary + "\r\n";
      const close_delim = "\r\n--" + boundary + "--";

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        data +
        close_delim;

      const driveResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'multipart/related; boundary=' + boundary,
        },
        body: multipartRequestBody
      });

      if (!driveResponse.ok) {
        const driveErrText = await driveResponse.text();
        if (driveResponse.status === 401) {
          throw new Error("Google Drive authorization expired. Please sign in again via Google login to re-authorize.");
        }
        throw new Error(`Google Drive upload failed: ${driveResponse.status} ${driveResponse.statusText} - ${driveErrText}`);
      }

      this.writeActivityLog(
        'Manual Google Drive Backup',
        `Database backup successfully saved to Google Drive folder 'GEETECH-Backups' as: ${driveFileName}`,
        'info'
      );

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app-toast', {
          detail: {
            text: `Google Drive Backup Completed: Saved to GEETECH-Backups/${driveFileName}`,
            type: 'success'
          }
        }));
      }

      return { 
        success: true, 
        folderName: 'GEETECH-Backups', 
        fileName: driveFileName 
      };
    } catch (e: any) {
      this.writeActivityLog(
        'Google Drive Backup Failed',
        `Failed to save backup to Google Drive: ${e.message || String(e)}`,
        'high'
      );
      return { success: false, error: e.message || String(e) };
    }
  }

  static performScheduledBackupCheck(): boolean {
    let backupPerformed = false;

    // 1. Local Auto Backup
    const config = this.getAutoBackupConfig();
    if (config.enabled) {
      const now = new Date();
      if (!config.lastBackupTime) {
        this.performAutoBackup();
        backupPerformed = true;
      } else {
        const last = new Date(config.lastBackupTime);
        const diffMs = now.getTime() - last.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        const thresholdHours = config.frequency === 'daily' ? 24 : 168;

        if (diffHours >= thresholdHours) {
          this.performAutoBackup();
          backupPerformed = true;
        }
      }
    }

    // 2. Cloud Sync
    const cloudConfig = this.getCloudSyncConfig();
    if (cloudConfig.enabled && cloudConfig.status !== 'syncing') {
      const now = new Date();
      if (!cloudConfig.lastSyncTime) {
        this.performCloudSync();
        backupPerformed = true;
      } else {
        const last = new Date(cloudConfig.lastSyncTime);
        const diffMs = now.getTime() - last.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        
        let thresholdHours = 24;
        if (cloudConfig.interval === 'weekly') thresholdHours = 168;
        else if (cloudConfig.interval === 'monthly') thresholdHours = 720;

        if (diffHours >= thresholdHours) {
          this.performCloudSync();
          backupPerformed = true;
        }
      }
    }

    return backupPerformed;
  }

  // -------------------------
  // BACKUP & RESTORE
  // -------------------------
  static exportAllData(): string {
    const backup = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      school_info: getStorageItem<SchoolInfo | null>(STORAGE_KEYS.SCHOOL, null),
      students: getStorageItem<Student[]>(STORAGE_KEYS.STUDENTS, []),
      teachers: getStorageItem<Teacher[]>(STORAGE_KEYS.TEACHERS, []),
      attendance: getStorageItem<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []),
      staff_attendance: getStorageItem<StaffAttendanceRecord[]>(STORAGE_KEYS.STAFF_ATTENDANCE, []),
      assessments: getStorageItem<StudentAssessment[]>(STORAGE_KEYS.ASSESSMENTS, []),
      assessment_templates: getStorageItem<AssessmentTemplate[]>(STORAGE_KEYS.ASSESSMENT_TEMPLATES, []),
      fees: getStorageItem<StudentFeeBill[]>(STORAGE_KEYS.FEES, []),
      settings: getStorageItem<any>(STORAGE_KEYS.SETTINGS, null),
      calendar: getStorageItem<any>(STORAGE_KEYS.CALENDAR, null),
      emis_reports: getStorageItem<EmisData[]>(STORAGE_KEYS.EMIS, []),
      users_list: getStorageItem<UserAccount[]>(STORAGE_KEYS.USERS_LIST, []),
      behavioral_remarks: getStorageItem<BehavioralRemark[]>(STORAGE_KEYS.BEHAVIORAL_REMARKS, []),
      teacher_reflections: getStorageItem<TeacherReflection[]>(STORAGE_KEYS.TEACHER_REFLECTIONS, []),
      duty_roster: getStorageItem<DutyAssignment[]>(STORAGE_KEYS.DUTY_ROSTER, []),
      staff_handbook: getStorageItem<StaffHandbookDocument[]>(STORAGE_KEYS.STAFF_HANDBOOK, []),
      leave_requests: getStorageItem<LeaveRequest[]>(STORAGE_KEYS.LEAVE_REQUESTS, []),
      paystack_logs: getStorageItem<PaystackPayment[]>(STORAGE_KEYS.PAYSTACK_LOGS, []),
      webauthn_credentials: getStorageItem<WebAuthnCredential[]>(STORAGE_KEYS.WEBAUTHN_CREDENTIALS, []),
      activity_logs: getStorageItem<ActivityLog[]>(STORAGE_KEYS.ACTIVITY_LOGS, []),
      auto_backup_config: getStorageItem<AutoBackupConfig | null>(STORAGE_KEYS.AUTO_BACKUP_CONFIG, null),
      cloud_sync_config: getStorageItem<CloudSyncConfig | null>(STORAGE_KEYS.CLOUD_SYNC_CONFIG, null),
      tasks: getStorageItem<CustomTask[]>(STORAGE_KEYS.TASKS, []),
      quick_notes: getStorageItem<QuickNote[]>(STORAGE_KEYS.QUICK_NOTES, [])
    };
    return JSON.stringify(backup, null, 2);
  }

  static importAllData(jsonString: string): { success: boolean; error?: string } {
    try {
      this.clearCache();
      const data = JSON.parse(jsonString);
      if (!data) {
        throw new Error("Invalid or empty backup data file.");
      }
      
      // We validate that at least one recognizable core array exists or school info
      const hasStudents = Array.isArray(data.students);
      const hasTeachers = Array.isArray(data.teachers);
      const hasAttendance = Array.isArray(data.attendance);
      const hasAssessments = Array.isArray(data.assessments);
      const hasFees = Array.isArray(data.fees);
      const hasEmis = Array.isArray(data.emis_reports);
      const hasSchool = typeof data.school_info === 'object' && data.school_info !== null;

      if (!hasStudents && !hasTeachers && !hasAttendance && !hasAssessments && !hasFees && !hasSchool && !hasEmis) {
        throw new Error("The selected file is not a valid backup of this application system database.");
      }

      // Restore elements: OVERWRITE completely with values from JSON or defaults to ensure full state replacement
      setStorageItem(STORAGE_KEYS.SCHOOL, data.school_info || null);
      setStorageItem(STORAGE_KEYS.STUDENTS, data.students || []);
      setStorageItem(STORAGE_KEYS.TEACHERS, data.teachers || []);
      setStorageItem(STORAGE_KEYS.ATTENDANCE, data.attendance || []);
      setStorageItem(STORAGE_KEYS.STAFF_ATTENDANCE, data.staff_attendance || []);
      setStorageItem(STORAGE_KEYS.ASSESSMENTS, data.assessments || []);
      setStorageItem(STORAGE_KEYS.ASSESSMENT_TEMPLATES, data.assessment_templates || []);
      setStorageItem(STORAGE_KEYS.SETTINGS, data.settings || null);
      setStorageItem(STORAGE_KEYS.FEES, data.fees || []);
      setStorageItem(STORAGE_KEYS.CALENDAR, data.calendar || null);
      setStorageItem(STORAGE_KEYS.EMIS, data.emis_reports || []);
      setStorageItem(STORAGE_KEYS.PAYSTACK_LOGS, data.paystack_logs || []);
      setStorageItem(STORAGE_KEYS.WEBAUTHN_CREDENTIALS, data.webauthn_credentials || []);
      setStorageItem(STORAGE_KEYS.ACTIVITY_LOGS, data.activity_logs || []);
      setStorageItem(STORAGE_KEYS.BEHAVIORAL_REMARKS, data.behavioral_remarks || []);
      setStorageItem(STORAGE_KEYS.TEACHER_REFLECTIONS, data.teacher_reflections || []);
      setStorageItem(STORAGE_KEYS.DUTY_ROSTER, data.duty_roster || []);
      setStorageItem(STORAGE_KEYS.STAFF_HANDBOOK, data.staff_handbook || []);
      setStorageItem(STORAGE_KEYS.LEAVE_REQUESTS, data.leave_requests || []);
      setStorageItem(STORAGE_KEYS.TASKS, data.tasks || []);
      setStorageItem(STORAGE_KEYS.QUICK_NOTES, data.quick_notes || []);
      
      if (data.users_list) {
        setStorageItem(STORAGE_KEYS.USERS_LIST, data.users_list);
      }
      if (data.auto_backup_config) {
        setStorageItem(STORAGE_KEYS.AUTO_BACKUP_CONFIG, data.auto_backup_config);
      }
      if (data.cloud_sync_config) {
        setStorageItem(STORAGE_KEYS.CLOUD_SYNC_CONFIG, data.cloud_sync_config);
      }
      if (data.auto_backups) {
        setStorageItem(STORAGE_KEYS.AUTO_BACKUPS, data.auto_backups);
      }

      // Perform selective background replication to Firebase if active
      if (isFirebaseActive && firestoreDb) {
        if (data.calendar) {
          setDoc(doc(firestoreDb, 'settings', 'academic_calendar'), data.calendar).catch(e => console.error("Firebase Sync settings error:", e));
        }
        if (hasSchool && data.school_info.id) {
          setDoc(doc(firestoreDb, 'schools', data.school_info.id), data.school_info).catch(e => console.error("Firebase Sync error:", e));
        }
        if (hasStudents) {
          data.students.forEach((st: Student) => {
            if (st.id) setDoc(doc(firestoreDb, 'students', st.id), st).catch(e => console.error(e));
          });
        }
        if (hasTeachers) {
          data.teachers.forEach((t: Teacher) => {
            if (t.id) setDoc(doc(firestoreDb, 'teachers', t.id), t).catch(e => console.error(e));
          });
        }
        if (hasAttendance) {
          data.attendance.forEach((r: AttendanceRecord) => {
            if (r.id) setDoc(doc(firestoreDb, 'attendance', r.id), r).catch(e => console.error(e));
          });
        }
        if (hasAssessments) {
          data.assessments.forEach((item: StudentAssessment) => {
            if (item.id) {
              const safeId = item.id.replace(/\//g, '-');
              setDoc(doc(firestoreDb, 'assessments', safeId), { ...item, id: safeId }).catch(e => console.error(e));
            }
          });
        }
        if (hasFees) {
          data.fees.forEach((f: StudentFeeBill) => {
            if (f.id) {
              setDoc(doc(firestoreDb, 'fees', f.id), f).catch(e => console.error(e));
            }
          });
        }
        if (hasEmis) {
          data.emis_reports.forEach((e: EmisData) => {
            if (e.id) {
              setDoc(doc(firestoreDb, 'emis', e.id), e).catch(err => console.error("Firebase Sync EMIS error:", err));
            }
          });
        }
        if (Array.isArray(data.behavioral_remarks)) {
          data.behavioral_remarks.forEach((r: BehavioralRemark) => {
            if (r.id) {
              setDoc(doc(firestoreDb, 'behavioral_remarks', r.id), r).catch(err => console.error("Firebase Sync Remark error:", err));
            }
          });
        }
        if (Array.isArray(data.teacher_reflections)) {
          data.teacher_reflections.forEach((r: TeacherReflection) => {
            if (r.id) {
              setDoc(doc(firestoreDb, 'teacher_reflections', r.id), r).catch(err => console.error("Firebase Sync Reflection error:", err));
            }
          });
        }
        if (Array.isArray(data.duty_roster)) {
          data.duty_roster.forEach((r: DutyAssignment) => {
            if (r.id) {
              setDoc(doc(firestoreDb, 'duty_roster', r.id), r).catch(err => console.error("Firebase Sync Duty error:", err));
            }
          });
        }
        if (Array.isArray(data.staff_handbook)) {
          data.staff_handbook.forEach((r: StaffHandbookDocument) => {
            if (r.id) {
              setDoc(doc(firestoreDb, 'staff_handbook', r.id), r).catch(err => console.error("Firebase Sync Handbook error:", err));
            }
          });
        }
        if (Array.isArray(data.leave_requests)) {
          data.leave_requests.forEach((r: LeaveRequest) => {
            if (r.id) {
              setDoc(doc(firestoreDb, 'leave_requests', r.id), r).catch(err => console.error("Firebase Sync Leave request error:", err));
            }
          });
        }
      }

      this.clearCache();
      return { success: true };
    } catch (e: any) {
      this.clearCache();
      return { success: false, error: e.message || String(e) };
    }
  }

  static clearAllStudents(): void {
    const students = this.getStudents();
    this.performFirestoreWriteBatch('students', students.map(s => ({
      id: s.id,
      type: 'delete'
    })));
    setStorageItem(STORAGE_KEYS.STUDENTS, []);
    this._cache[STORAGE_KEYS.STUDENTS] = [];
    this._studentsByClass.clear();
    
    // Clean all storage keys and IndexedDB
    try {
      localStorage.removeItem(STORAGE_KEYS.STUDENTS);
      localStorage.removeItem('school_students');
      sessionStorage.removeItem(STORAGE_KEYS.STUDENTS);
      IndexedDbEngine.removeItem(STORAGE_KEYS.STUDENTS);
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith(`${STORAGE_KEYS.STUDENTS}_`)) localStorage.removeItem(k);
      });
      Object.keys(sessionStorage).forEach(k => {
        if (k.startsWith(`${STORAGE_KEYS.STUDENTS}_`)) sessionStorage.removeItem(k);
      });
    } catch (e) {}

    // Also clear all behavioral remarks
    try {
      const remarks = this.getBehavioralRemarks();
      remarks.forEach(r => {
        this.performFirestoreWrite('behavioral_remarks', r.id, 'delete').catch(e => console.error(e));
      });
    } catch (e) {
      console.warn(e);
    }
    setStorageItem(STORAGE_KEYS.BEHAVIORAL_REMARKS, []);
    this._cache[STORAGE_KEYS.BEHAVIORAL_REMARKS] = [];
    this.broadcastSyncEvent('all-cleared', { target: 'students' });
  }

  static clearAllTeachers(): void {
    const teachers = this.getTeachers();
    this.performFirestoreWriteBatch('teachers', teachers.map(t => ({
      id: t.id,
      type: 'delete'
    })));
    setStorageItem(STORAGE_KEYS.TEACHERS, []);
    this._cache[STORAGE_KEYS.TEACHERS] = [];
    
    try {
      localStorage.removeItem(STORAGE_KEYS.TEACHERS);
      localStorage.removeItem('school_teachers');
      sessionStorage.removeItem(STORAGE_KEYS.TEACHERS);
      IndexedDbEngine.removeItem(STORAGE_KEYS.TEACHERS);
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith(`${STORAGE_KEYS.TEACHERS}_`)) localStorage.removeItem(k);
      });
      Object.keys(sessionStorage).forEach(k => {
        if (k.startsWith(`${STORAGE_KEYS.TEACHERS}_`)) sessionStorage.removeItem(k);
      });
    } catch (e) {}

    this.broadcastSyncEvent('all-cleared', { target: 'teachers' });
  }

  static clearAllAssessments(): void {
    const assessments = this.getAssessments();
    this.performFirestoreWriteBatch('assessments', assessments.filter(a => !!a.id).map(a => ({
      id: a.id,
      type: 'delete'
    })));
    setStorageItem(STORAGE_KEYS.ASSESSMENTS, []);
    this._cache[STORAGE_KEYS.ASSESSMENTS] = [];
    this._assessmentsByStudent.clear();

    try {
      localStorage.removeItem(STORAGE_KEYS.ASSESSMENTS);
      localStorage.removeItem('school_assessments');
      sessionStorage.removeItem(STORAGE_KEYS.ASSESSMENTS);
      IndexedDbEngine.removeItem(STORAGE_KEYS.ASSESSMENTS);
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith(`${STORAGE_KEYS.ASSESSMENTS}_`)) localStorage.removeItem(k);
      });
      Object.keys(sessionStorage).forEach(k => {
        if (k.startsWith(`${STORAGE_KEYS.ASSESSMENTS}_`)) sessionStorage.removeItem(k);
      });
    } catch (e) {}

    this.broadcastSyncEvent('all-cleared', { target: 'assessments' });
  }

  static clearAllAttendance(): void {
    const records = this.getAllAttendance();
    this.performFirestoreWriteBatch('attendance', records.filter(r => !!r.id).map(r => ({
      id: r.id,
      type: 'delete'
    })));
    setStorageItem(STORAGE_KEYS.ATTENDANCE, []);
    this._cache[STORAGE_KEYS.ATTENDANCE] = [];

    try {
      localStorage.removeItem(STORAGE_KEYS.ATTENDANCE);
      sessionStorage.removeItem(STORAGE_KEYS.ATTENDANCE);
      IndexedDbEngine.removeItem(STORAGE_KEYS.ATTENDANCE);
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith(`${STORAGE_KEYS.ATTENDANCE}_`)) localStorage.removeItem(k);
      });
    } catch (e) {}

    this.broadcastSyncEvent('all-cleared', { target: 'attendance' });
  }

  static clearAllStaffAttendance(): void {
    const records = getStorageItem<StaffAttendanceRecord[]>(STORAGE_KEYS.STAFF_ATTENDANCE, []);
    this.performFirestoreWriteBatch('staff_attendance', records.filter(r => !!r.id).map(r => ({
      id: r.id,
      type: 'delete'
    })));
    setStorageItem(STORAGE_KEYS.STAFF_ATTENDANCE, []);
    this._cache[STORAGE_KEYS.STAFF_ATTENDANCE] = [];

    try {
      localStorage.removeItem(STORAGE_KEYS.STAFF_ATTENDANCE);
      sessionStorage.removeItem(STORAGE_KEYS.STAFF_ATTENDANCE);
      IndexedDbEngine.removeItem(STORAGE_KEYS.STAFF_ATTENDANCE);
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith(`${STORAGE_KEYS.STAFF_ATTENDANCE}_`)) localStorage.removeItem(k);
      });
    } catch (e) {}

    this.broadcastSyncEvent('all-cleared', { target: 'staff_attendance' });
  }

  static clearBusinessDataOnly(): void {
    setStorageItem(STORAGE_KEYS.STUDENTS, []);
    this._cache[STORAGE_KEYS.STUDENTS] = [];
    this._studentsByClass.clear();

    setStorageItem(STORAGE_KEYS.TEACHERS, []);
    this._cache[STORAGE_KEYS.TEACHERS] = [];

    setStorageItem(STORAGE_KEYS.ATTENDANCE, []);
    this._cache[STORAGE_KEYS.ATTENDANCE] = [];

    setStorageItem(STORAGE_KEYS.STAFF_ATTENDANCE, []);
    this._cache[STORAGE_KEYS.STAFF_ATTENDANCE] = [];

    setStorageItem(STORAGE_KEYS.ASSESSMENTS, []);
    this._cache[STORAGE_KEYS.ASSESSMENTS] = [];
    this._assessmentsByStudent.clear();

    setStorageItem(STORAGE_KEYS.FEES, []);
    this._cache[STORAGE_KEYS.FEES] = [];

    setStorageItem(STORAGE_KEYS.EMIS, []);
    this._cache[STORAGE_KEYS.EMIS] = [];

    setStorageItem(STORAGE_KEYS.CALENDAR, DEFAULT_CALENDAR);
    this._cache[STORAGE_KEYS.CALENDAR] = DEFAULT_CALENDAR;

    setStorageItem(STORAGE_KEYS.BEHAVIORAL_REMARKS, []);
    this._cache[STORAGE_KEYS.BEHAVIORAL_REMARKS] = [];

    setStorageItem(STORAGE_KEYS.PAYSTACK_LOGS, []);
    this._cache[STORAGE_KEYS.PAYSTACK_LOGS] = [];

    setStorageItem(STORAGE_KEYS.QUICK_NOTES, []);
    this._cache[STORAGE_KEYS.QUICK_NOTES] = [];

    setStorageItem(STORAGE_KEYS.TASKS, []);
    this._cache[STORAGE_KEYS.TASKS] = [];

    setStorageItem(STORAGE_KEYS.DUTY_ROSTER, []);
    this._cache[STORAGE_KEYS.DUTY_ROSTER] = [];

    setStorageItem(STORAGE_KEYS.TEACHER_REFLECTIONS, []);
    this._cache[STORAGE_KEYS.TEACHER_REFLECTIONS] = [];

    try {
      const keys = Object.keys(localStorage);
      keys.forEach(k => {
        if (k.startsWith('sms_') || k.startsWith('school_')) {
          if (k !== 'sms_user' && k !== 'sms_users_list') {
            localStorage.removeItem(k);
          }
        }
      });
      IndexedDbEngine.clearAll().catch(e => console.warn("Failed to clear IDB in clearBusinessDataOnly:", e));
    } catch (e) {
      console.warn(e);
    }

    const blankSchool: SchoolInfo = { ...DEFAULT_SCHOOL_INFO };
    setStorageItem(STORAGE_KEYS.SCHOOL, blankSchool);
    this._cache[STORAGE_KEYS.SCHOOL] = blankSchool;
    this.broadcastSyncEvent('all-cleared', { target: 'business_data' });
  }

  static getLeaveRequests(): LeaveRequest[] {
    return getStorageItem<LeaveRequest[]>(STORAGE_KEYS.LEAVE_REQUESTS, []);
  }

  static saveLeaveRequest(request: LeaveRequest) {
    if (!request.schoolId) {
      request.schoolId = this.resolveActiveSchoolId();
    }
    const requests = this.getLeaveRequests();
    const index = requests.findIndex(r => r.id === request.id);
    if (index >= 0) {
      requests[index] = request;
    } else {
      requests.push(request);
    }
    setStorageItem(STORAGE_KEYS.LEAVE_REQUESTS, requests);
    this._cache[STORAGE_KEYS.LEAVE_REQUESTS] = requests;
    this.performFirestoreWrite('leave_requests', request.id, 'set', request);
  }

  static deleteLeaveRequest(id: string) {
    const requests = this.getLeaveRequests().filter(r => r.id !== id);
    setStorageItem(STORAGE_KEYS.LEAVE_REQUESTS, requests);
    this._cache[STORAGE_KEYS.LEAVE_REQUESTS] = requests;
    this.performFirestoreWrite('leave_requests', id, 'delete');
  }

  static getTasks(): CustomTask[] {
    return getStorageItem<CustomTask[]>(STORAGE_KEYS.TASKS, []);
  }

  static getQuickNotes(): QuickNote[] {
    const cached = this._cache[STORAGE_KEYS.QUICK_NOTES];
    if (cached) return cached;
    const notes = getStorageItem<QuickNote[]>(STORAGE_KEYS.QUICK_NOTES, []);
    this._cache[STORAGE_KEYS.QUICK_NOTES] = notes;
    return notes;
  }

  static saveQuickNote(note: QuickNote): void {
    if (!note.schoolId) {
      note.schoolId = this.resolveActiveSchoolId();
    }
    const notes = this.getQuickNotes();
    const index = notes.findIndex(n => n.id === note.id);
    if (index >= 0) {
      notes[index] = note;
    } else {
      notes.unshift(note);
    }
    setStorageItem(STORAGE_KEYS.QUICK_NOTES, notes);
    this._cache[STORAGE_KEYS.QUICK_NOTES] = notes;
    this.broadcastSyncEvent('quick-notes-updated', notes);
    this.performFirestoreWrite('quick_notes', note.id, 'set', note);
  }

  static deleteQuickNote(id: string): void {
    const notes = this.getQuickNotes().filter(n => n.id !== id);
    setStorageItem(STORAGE_KEYS.QUICK_NOTES, notes);
    this._cache[STORAGE_KEYS.QUICK_NOTES] = notes;
    this.broadcastSyncEvent('quick-notes-updated', notes);
    this.performFirestoreWrite('quick_notes', id, 'delete');
  }

  static saveTask(task: CustomTask): void {
    const tasks = this.getTasks();
    const index = tasks.findIndex(t => t.id === task.id);
    if (index >= 0) {
      tasks[index] = task;
    } else {
      tasks.push(task);
    }
    setStorageItem(STORAGE_KEYS.TASKS, tasks);
    this._cache[STORAGE_KEYS.TASKS] = tasks;
    this.performFirestoreWrite('tasks', task.id, 'set', task);
  }

  static deleteTask(id: string): void {
    const tasks = this.getTasks().filter(t => t.id !== id);
    setStorageItem(STORAGE_KEYS.TASKS, tasks);
    this._cache[STORAGE_KEYS.TASKS] = tasks;
    this.performFirestoreWrite('tasks', id, 'delete');
  }

  static getCommunicationTemplates(): CommunicationTemplate[] {
    const cached = this._cache[STORAGE_KEYS.COMM_TEMPLATES];
    if (cached) return cached;
    const templates = getStorageItem<CommunicationTemplate[]>(STORAGE_KEYS.COMM_TEMPLATES, []);
    this._cache[STORAGE_KEYS.COMM_TEMPLATES] = templates;
    return templates;
  }

  static saveCommunicationTemplate(template: CommunicationTemplate): void {
    const templates = this.getCommunicationTemplates();
    const index = templates.findIndex(t => t.id === template.id);
    if (index >= 0) {
      templates[index] = template;
    } else {
      templates.push(template);
    }
    setStorageItem(STORAGE_KEYS.COMM_TEMPLATES, templates);
    this._cache[STORAGE_KEYS.COMM_TEMPLATES] = templates;
    this.performFirestoreWrite('communication_templates', template.id, 'set', template);
  }

  static deleteCommunicationTemplate(id: string): void {
    const templates = this.getCommunicationTemplates().filter(t => t.id !== id);
    setStorageItem(STORAGE_KEYS.COMM_TEMPLATES, templates);
    this._cache[STORAGE_KEYS.COMM_TEMPLATES] = templates;
    this.performFirestoreWrite('communication_templates', id, 'delete');
  }

  // ==========================================
  // FINANCES: TRANSPORTATION
  // ==========================================
  // ==========================================
  // FINANCES: TRANSPORTATION
  // ==========================================
  static getTransportRoutes(): TransportRoute[] {
    const cached = this._cache[STORAGE_KEYS.TRANSPORT_ROUTES];
    if (cached) return cached;
    const routes = getStorageItem<TransportRoute[]>(STORAGE_KEYS.TRANSPORT_ROUTES, []);
    this._cache[STORAGE_KEYS.TRANSPORT_ROUTES] = routes;
    return routes;
  }

  static saveTransportRoute(route: TransportRoute): void {
    const routes = this.getTransportRoutes();
    const idx = routes.findIndex(r => r.id === route.id);
    if (idx >= 0) routes[idx] = route;
    else routes.push(route);
    setStorageItem(STORAGE_KEYS.TRANSPORT_ROUTES, routes);
    this._cache[STORAGE_KEYS.TRANSPORT_ROUTES] = routes;
    this.performFirestoreWrite('transport_routes', route.id, 'set', route);
  }

  static deleteTransportRoute(id: string): void {
    const routes = this.getTransportRoutes().filter(r => r.id !== id);
    setStorageItem(STORAGE_KEYS.TRANSPORT_ROUTES, routes);
    this._cache[STORAGE_KEYS.TRANSPORT_ROUTES] = routes;
    this.performFirestoreWrite('transport_routes', id, 'delete');
  }

  static getTransportRecords(): StudentTransportRecord[] {
    const cached = this._cache[STORAGE_KEYS.TRANSPORT_RECORDS];
    if (cached) return cached;
    const records = getStorageItem<StudentTransportRecord[]>(STORAGE_KEYS.TRANSPORT_RECORDS, []);
    this._cache[STORAGE_KEYS.TRANSPORT_RECORDS] = records;
    return records;
  }

  static saveTransportRecord(record: StudentTransportRecord): void {
    const records = this.getTransportRecords();
    const idx = records.findIndex(r => r.id === record.id);
    if (idx >= 0) records[idx] = record;
    else records.push(record);
    setStorageItem(STORAGE_KEYS.TRANSPORT_RECORDS, records);
    this._cache[STORAGE_KEYS.TRANSPORT_RECORDS] = records;
    this.performFirestoreWrite('transport_records', record.id, 'set', record);
  }

  static deleteTransportRecord(id: string): void {
    const records = this.getTransportRecords().filter(r => r.id !== id);
    setStorageItem(STORAGE_KEYS.TRANSPORT_RECORDS, records);
    this._cache[STORAGE_KEYS.TRANSPORT_RECORDS] = records;
    this.performFirestoreWrite('transport_records', id, 'delete');
  }

  // ==========================================
  // FINANCES: CANTEEN & FEEDING FEES
  // ==========================================
  static getCanteenPlans(): CanteenPlan[] {
    const cached = this._cache[STORAGE_KEYS.CANTEEN_PLANS];
    if (cached) return cached;
    const plans = getStorageItem<CanteenPlan[]>(STORAGE_KEYS.CANTEEN_PLANS, []);
    this._cache[STORAGE_KEYS.CANTEEN_PLANS] = plans;
    return plans;
  }

  static saveCanteenPlan(plan: CanteenPlan): void {
    const plans = this.getCanteenPlans();
    const idx = plans.findIndex(p => p.id === plan.id);
    if (idx >= 0) plans[idx] = plan;
    else plans.push(plan);
    setStorageItem(STORAGE_KEYS.CANTEEN_PLANS, plans);
    this._cache[STORAGE_KEYS.CANTEEN_PLANS] = plans;
    this.performFirestoreWrite('canteen_plans', plan.id, 'set', plan);
  }

  static deleteCanteenPlan(id: string): void {
    const plans = this.getCanteenPlans().filter(p => p.id !== id);
    setStorageItem(STORAGE_KEYS.CANTEEN_PLANS, plans);
    this._cache[STORAGE_KEYS.CANTEEN_PLANS] = plans;
    this.performFirestoreWrite('canteen_plans', id, 'delete');
  }

  static getCanteenPayments(): CanteenPaymentRecord[] {
    const cached = this._cache[STORAGE_KEYS.CANTEEN_PAYMENTS];
    if (cached) return cached;
    const payments = getStorageItem<CanteenPaymentRecord[]>(STORAGE_KEYS.CANTEEN_PAYMENTS, []);
    this._cache[STORAGE_KEYS.CANTEEN_PAYMENTS] = payments;
    return payments;
  }

  static saveCanteenPayment(record: CanteenPaymentRecord): void {
    const records = this.getCanteenPayments();
    const idx = records.findIndex(r => r.id === record.id);
    if (idx >= 0) records[idx] = record;
    else records.push(record);
    setStorageItem(STORAGE_KEYS.CANTEEN_PAYMENTS, records);
    this._cache[STORAGE_KEYS.CANTEEN_PAYMENTS] = records;
    this.performFirestoreWrite('canteen_payments', record.id, 'set', record);
  }

  static deleteCanteenPayment(id: string): void {
    const records = this.getCanteenPayments().filter(r => r.id !== id);
    setStorageItem(STORAGE_KEYS.CANTEEN_PAYMENTS, records);
    this._cache[STORAGE_KEYS.CANTEEN_PAYMENTS] = records;
    this.performFirestoreWrite('canteen_payments', id, 'delete');
  }

  // ==========================================
  // FINANCES: EXCURSIONS & TRIPS
  // ==========================================
  static getExcursions(): SchoolExcursion[] {
    const cached = this._cache[STORAGE_KEYS.EXCURSIONS];
    if (cached) return cached;
    const excursions = getStorageItem<SchoolExcursion[]>(STORAGE_KEYS.EXCURSIONS, []);
    this._cache[STORAGE_KEYS.EXCURSIONS] = excursions;
    return excursions;
  }

  static saveExcursion(excursion: SchoolExcursion): void {
    const excursions = this.getExcursions();
    const idx = excursions.findIndex(e => e.id === excursion.id);
    if (idx >= 0) excursions[idx] = excursion;
    else excursions.push(excursion);
    setStorageItem(STORAGE_KEYS.EXCURSIONS, excursions);
    this._cache[STORAGE_KEYS.EXCURSIONS] = excursions;
    this.performFirestoreWrite('excursions', excursion.id, 'set', excursion);
  }

  static deleteExcursion(id: string): void {
    const excursions = this.getExcursions().filter(e => e.id !== id);
    setStorageItem(STORAGE_KEYS.EXCURSIONS, excursions);
    this._cache[STORAGE_KEYS.EXCURSIONS] = excursions;
    this.performFirestoreWrite('excursions', id, 'delete');
  }

  static getExcursionParticipants(): ExcursionParticipant[] {
    const cached = this._cache[STORAGE_KEYS.EXCURSION_PARTICIPANTS];
    if (cached) return cached;
    const list = getStorageItem<ExcursionParticipant[]>(STORAGE_KEYS.EXCURSION_PARTICIPANTS, []);
    this._cache[STORAGE_KEYS.EXCURSION_PARTICIPANTS] = list;
    return list;
  }

  static saveExcursionParticipant(participant: ExcursionParticipant): void {
    const list = this.getExcursionParticipants();
    const idx = list.findIndex(p => p.id === participant.id);
    if (idx >= 0) list[idx] = participant;
    else list.push(participant);
    setStorageItem(STORAGE_KEYS.EXCURSION_PARTICIPANTS, list);
    this._cache[STORAGE_KEYS.EXCURSION_PARTICIPANTS] = list;
    this.performFirestoreWrite('excursion_participants', participant.id, 'set', participant);
  }

  static deleteExcursionParticipant(id: string): void {
    const list = this.getExcursionParticipants().filter(p => p.id !== id);
    setStorageItem(STORAGE_KEYS.EXCURSION_PARTICIPANTS, list);
    this._cache[STORAGE_KEYS.EXCURSION_PARTICIPANTS] = list;
    this.performFirestoreWrite('excursion_participants', id, 'delete');
  }

  // ==========================================
  // FINANCES: SPORTS & CO-CURRICULAR
  // ==========================================
  static getSportsActivities(): SportsActivity[] {
    const cached = this._cache[STORAGE_KEYS.SPORTS_ACTIVITIES];
    if (cached) return cached;
    const activities = getStorageItem<SportsActivity[]>(STORAGE_KEYS.SPORTS_ACTIVITIES, []);
    this._cache[STORAGE_KEYS.SPORTS_ACTIVITIES] = activities;
    return activities;
  }

  static saveSportsActivity(activity: SportsActivity): void {
    const activities = this.getSportsActivities();
    const idx = activities.findIndex(a => a.id === activity.id);
    if (idx >= 0) activities[idx] = activity;
    else activities.push(activity);
    setStorageItem(STORAGE_KEYS.SPORTS_ACTIVITIES, activities);
    this._cache[STORAGE_KEYS.SPORTS_ACTIVITIES] = activities;
    this.performFirestoreWrite('sports_activities', activity.id, 'set', activity);
  }

  static deleteSportsActivity(id: string): void {
    const activities = this.getSportsActivities().filter(a => a.id !== id);
    setStorageItem(STORAGE_KEYS.SPORTS_ACTIVITIES, activities);
    this._cache[STORAGE_KEYS.SPORTS_ACTIVITIES] = activities;
    this.performFirestoreWrite('sports_activities', id, 'delete');
  }

  static getSportsRecords(): StudentSportsRecord[] {
    const cached = this._cache[STORAGE_KEYS.SPORTS_RECORDS];
    if (cached) return cached;
    const list = getStorageItem<StudentSportsRecord[]>(STORAGE_KEYS.SPORTS_RECORDS, []);
    this._cache[STORAGE_KEYS.SPORTS_RECORDS] = list;
    return list;
  }

  static saveSportsRecord(record: StudentSportsRecord): void {
    const list = this.getSportsRecords();
    const idx = list.findIndex(r => r.id === record.id);
    if (idx >= 0) list[idx] = record;
    else list.push(record);
    setStorageItem(STORAGE_KEYS.SPORTS_RECORDS, list);
    this._cache[STORAGE_KEYS.SPORTS_RECORDS] = list;
    this.performFirestoreWrite('sports_records', record.id, 'set', record);
  }

  static deleteSportsRecord(id: string): void {
    const list = this.getSportsRecords().filter(r => r.id !== id);
    setStorageItem(STORAGE_KEYS.SPORTS_RECORDS, list);
    this._cache[STORAGE_KEYS.SPORTS_RECORDS] = list;
    this.performFirestoreWrite('sports_records', id, 'delete');
  }

  // ==========================================
  // FINANCES: TEXTBOOKS & LEARNING MATERIALS
  // ==========================================
  static getTextbooks(): TextbookItem[] {
    const cached = this._cache[STORAGE_KEYS.TEXTBOOKS];
    if (cached) return cached;
    const books = getStorageItem<TextbookItem[]>(STORAGE_KEYS.TEXTBOOKS, []);
    this._cache[STORAGE_KEYS.TEXTBOOKS] = books;
    return books;
  }

  static saveTextbook(book: TextbookItem): void {
    const books = this.getTextbooks();
    const idx = books.findIndex(b => b.id === book.id);
    if (idx >= 0) books[idx] = book;
    else books.push(book);
    setStorageItem(STORAGE_KEYS.TEXTBOOKS, books);
    this._cache[STORAGE_KEYS.TEXTBOOKS] = books;
    this.performFirestoreWrite('textbooks', book.id, 'set', book);
  }

  static deleteTextbook(id: string): void {
    const books = this.getTextbooks().filter(b => b.id !== id);
    setStorageItem(STORAGE_KEYS.TEXTBOOKS, books);
    this._cache[STORAGE_KEYS.TEXTBOOKS] = books;
    this.performFirestoreWrite('textbooks', id, 'delete');
  }

  static getTextbookTransactions(): StudentTextbookTransaction[] {
    const cached = this._cache[STORAGE_KEYS.TEXTBOOK_TRANSACTIONS];
    if (cached) return cached;
    const list = getStorageItem<StudentTextbookTransaction[]>(STORAGE_KEYS.TEXTBOOK_TRANSACTIONS, []);
    this._cache[STORAGE_KEYS.TEXTBOOK_TRANSACTIONS] = list;
    return list;
  }

  static saveTextbookTransaction(tx: StudentTextbookTransaction): void {
    const list = this.getTextbookTransactions();
    const idx = list.findIndex(t => t.id === tx.id);
    if (idx >= 0) list[idx] = tx;
    else list.push(tx);
    setStorageItem(STORAGE_KEYS.TEXTBOOK_TRANSACTIONS, list);
    this._cache[STORAGE_KEYS.TEXTBOOK_TRANSACTIONS] = list;
    this.performFirestoreWrite('textbook_transactions', tx.id, 'set', tx);
  }

  static deleteTextbookTransaction(id: string): void {
    const list = this.getTextbookTransactions().filter(t => t.id !== id);
    setStorageItem(STORAGE_KEYS.TEXTBOOK_TRANSACTIONS, list);
    this._cache[STORAGE_KEYS.TEXTBOOK_TRANSACTIONS] = list;
    this.performFirestoreWrite('textbook_transactions', id, 'delete');
  }

  // ==========================================
  // FINANCES: OPERATIONAL EXPENSES & AUDIT
  // ==========================================
  static getExpenses(): SchoolExpense[] {
    const cached = this._cache[STORAGE_KEYS.EXPENSES];
    if (cached) return cached;
    const expenses = getStorageItem<SchoolExpense[]>(STORAGE_KEYS.EXPENSES, []);
    this._cache[STORAGE_KEYS.EXPENSES] = expenses;
    return expenses;
  }

  static saveExpense(expense: SchoolExpense, auditUser?: { name: string; role: string }): void {
    const expenses = this.getExpenses();
    const idx = expenses.findIndex(e => e.id === expense.id);
    const isNew = idx < 0;
    
    // Ensure default approval status
    if (!expense.approvalStatus) {
      expense.approvalStatus = 'Pending Approval';
    }

    if (!isNew) expenses[idx] = expense;
    else expenses.push(expense);
    
    setStorageItem(STORAGE_KEYS.EXPENSES, expenses);
    this._cache[STORAGE_KEYS.EXPENSES] = expenses;
    this.performFirestoreWrite('expenses', expense.id, 'set', expense);

    // Record audit entry
    this.recordFinancialAudit({
      action: isNew ? 'CREATE_EXPENSE' : 'UPDATE_EXPENSE',
      entityId: expense.id,
      entityType: 'expense',
      entityTitle: `${expense.voucherNumber}: ${expense.title}`,
      performedBy: auditUser?.name || expense.preparedBy || 'Accounts Staff',
      role: auditUser?.role || 'Bursar',
      details: `${isNew ? 'Logged new expenditure voucher' : 'Updated expenditure details'} for GH₵ ${expense.amount.toFixed(2)} (${expense.category}) attributed to ${expense.billComponentName || 'General School Account'}. Status: ${expense.approvalStatus}.`,
      amount: expense.amount
    });
  }

  static deleteExpense(id: string, auditUser?: { name: string; role: string }): void {
    const current = this.getExpenses().find(e => e.id === id);
    const expenses = this.getExpenses().filter(e => e.id !== id);
    setStorageItem(STORAGE_KEYS.EXPENSES, expenses);
    this._cache[STORAGE_KEYS.EXPENSES] = expenses;
    this.performFirestoreWrite('expenses', id, 'delete');

    if (current) {
      this.recordFinancialAudit({
        action: 'DELETE_EXPENSE',
        entityId: id,
        entityType: 'expense',
        entityTitle: `${current.voucherNumber}: ${current.title}`,
        performedBy: auditUser?.name || 'Administrator',
        role: auditUser?.role || 'Admin',
        details: `Deleted expenditure voucher ${current.voucherNumber} (${current.title}) amounting to GH₵ ${current.amount.toFixed(2)}.`,
        amount: current.amount
      });
    }
  }

  static updateExpenseApprovalStatus(
    id: string, 
    status: VoucherApprovalStatus, 
    approverName: string, 
    role: string, 
    remarks?: string
  ): void {
    const expenses = this.getExpenses();
    const idx = expenses.findIndex(e => e.id === id);
    if (idx >= 0) {
      const exp = { ...expenses[idx] };
      const prevStatus = exp.approvalStatus || 'Draft';
      exp.approvalStatus = status;
      const today = new Date().toISOString().split('T')[0];
      
      if (status === 'Approved') {
        exp.approvedBy = approverName;
        exp.approvalDate = today;
      } else if (status === 'Disbursed') {
        exp.disbursedDate = today;
      }

      expenses[idx] = exp;
      setStorageItem(STORAGE_KEYS.EXPENSES, expenses);
      this._cache[STORAGE_KEYS.EXPENSES] = expenses;
      this.performFirestoreWrite('expenses', id, 'set', exp);

      let action: FinancialAuditLog['action'] = 'UPDATE_EXPENSE';
      if (status === 'Approved') action = 'APPROVE_EXPENSE';
      else if (status === 'Disbursed') action = 'DISBURSE_EXPENSE';
      else if (status === 'Rejected') action = 'REJECT_EXPENSE';

      this.recordFinancialAudit({
        action,
        entityId: id,
        entityType: 'expense',
        entityTitle: `${exp.voucherNumber}: ${exp.title}`,
        performedBy: approverName,
        role: role,
        details: `Voucher status changed from ${prevStatus} to ${status}. Amount: GH₵ ${exp.amount.toFixed(2)}. ${remarks ? `Remarks: "${remarks}"` : ''}`,
        amount: exp.amount
      });
    }
  }

  // ==========================================
  // FINANCES: FINANCIAL AUDIT TRAIL
  // ==========================================
  static getFinancialAuditLogs(): FinancialAuditLog[] {
    const cached = this._cache[STORAGE_KEYS.FINANCIAL_AUDIT_LOGS];
    if (cached) return cached;
    const logs = getStorageItem<FinancialAuditLog[]>(STORAGE_KEYS.FINANCIAL_AUDIT_LOGS, []);
    this._cache[STORAGE_KEYS.FINANCIAL_AUDIT_LOGS] = logs;
    return logs;
  }

  static recordFinancialAudit(logData: Omit<FinancialAuditLog, 'id' | 'timestamp'>): void {
    const logs = this.getFinancialAuditLogs();
    const entry: FinancialAuditLog = {
      ...logData,
      id: 'fa-log-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      timestamp: Date.now()
    };
    logs.unshift(entry);
    // Keep last 300 logs
    const trimmed = logs.slice(0, 300);
    setStorageItem(STORAGE_KEYS.FINANCIAL_AUDIT_LOGS, trimmed);
    this._cache[STORAGE_KEYS.FINANCIAL_AUDIT_LOGS] = trimmed;
    this.performFirestoreWrite('financial_audit_logs', entry.id, 'set', entry);
  }

  // ==========================================
  // FINANCES: CUSTOM BILL COMPONENTS (HEADTEACHER CUSTOMIZER)
  // ==========================================
  static getCustomBillComponents(): CustomBillComponent[] {
    const cached = this._cache[STORAGE_KEYS.CUSTOM_BILL_COMPONENTS];
    if (cached) return cached;
    const list = getStorageItem<CustomBillComponent[]>(STORAGE_KEYS.CUSTOM_BILL_COMPONENTS, []);
    this._cache[STORAGE_KEYS.CUSTOM_BILL_COMPONENTS] = list;
    return list;
  }

  static saveCustomBillComponent(comp: CustomBillComponent): void {
    const list = this.getCustomBillComponents();
    const idx = list.findIndex(c => c.id === comp.id);
    if (idx >= 0) list[idx] = comp;
    else list.push(comp);
    setStorageItem(STORAGE_KEYS.CUSTOM_BILL_COMPONENTS, list);
    this._cache[STORAGE_KEYS.CUSTOM_BILL_COMPONENTS] = list;
    this.performFirestoreWrite('custom_bill_components', comp.id, 'set', comp);
    this.broadcastSyncEvent('bill-components-updated', { componentId: comp.id });
  }

  static deleteCustomBillComponent(id: string): void {
    const list = this.getCustomBillComponents().filter(c => c.id !== id);
    setStorageItem(STORAGE_KEYS.CUSTOM_BILL_COMPONENTS, list);
    this._cache[STORAGE_KEYS.CUSTOM_BILL_COMPONENTS] = list;
    this.performFirestoreWrite('custom_bill_components', id, 'delete');
    this.broadcastSyncEvent('bill-components-updated', { componentId: id, deleted: true });
  }

  static getCustomBillCategories(): string[] {
    const defaultCategories = [
      'Academic',
      'Facilities & Utilities',
      'Welfare & Feeding',
      'Extra-Curricular',
      'Logistics & Transport',
      'Materials & Books',
      'Special Projects'
    ];
    const custom = getStorageItem<string[]>(STORAGE_KEYS.CUSTOM_BILL_CATEGORIES, []);
    const comps = this.getCustomBillComponents();
    const compCategories = comps.map(c => c.category).filter(Boolean);
    const set = new Set([...defaultCategories, ...custom, ...compCategories]);
    return Array.from(set);
  }

  static saveCustomBillCategory(categoryName: string): void {
    const trimmed = categoryName.trim();
    if (!trimmed) return;
    const current = getStorageItem<string[]>(STORAGE_KEYS.CUSTOM_BILL_CATEGORIES, []);
    if (!current.includes(trimmed)) {
      const updated = [...current, trimmed];
      setStorageItem(STORAGE_KEYS.CUSTOM_BILL_CATEGORIES, updated);
      this._cache[STORAGE_KEYS.CUSTOM_BILL_CATEGORIES] = updated;
      this.performFirestoreWrite('custom_bill_categories', 'all', 'set', { categories: updated });
      this.broadcastSyncEvent('bill-categories-updated', { category: trimmed });
    }
  }

  static deleteCustomBillCategory(categoryName: string): void {
    const trimmed = categoryName.trim();
    const current = getStorageItem<string[]>(STORAGE_KEYS.CUSTOM_BILL_CATEGORIES, []);
    const updated = current.filter(c => c !== trimmed);
    setStorageItem(STORAGE_KEYS.CUSTOM_BILL_CATEGORIES, updated);
    this._cache[STORAGE_KEYS.CUSTOM_BILL_CATEGORIES] = updated;
    this.performFirestoreWrite('custom_bill_categories', 'all', 'set', { categories: updated });
    this.broadcastSyncEvent('bill-categories-updated', { category: trimmed, deleted: true });
  }

  // ==========================================
  // CUSTOM & EXISTING SECTION ASSIGNMENTS
  // ==========================================
  private static readonly DEFAULT_INITIAL_SECTIONS = ['None', 'Faith', 'Harmony', 'Humility', 'Peace'];

  static getSections(): string[] {
    const cached = this._cache[STORAGE_KEYS.CUSTOM_SECTIONS];
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return this.sanitizeSectionsList(cached);
    }

    const stored = getStorageItem<string[] | null>(STORAGE_KEYS.CUSTOM_SECTIONS, null as any);
    let list: string[];
    if (stored && Array.isArray(stored) && stored.length > 0) {
      list = stored;
    } else if (stored && Array.isArray(stored) && stored.length === 0) {
      // User explicitly cleared/removed all custom sections
      list = ['None'];
    } else {
      // First-time initialization: start with standard defaults
      list = [...this.DEFAULT_INITIAL_SECTIONS];
      setStorageItem(STORAGE_KEYS.CUSTOM_SECTIONS, list);
    }

    const sanitized = this.sanitizeSectionsList(list);
    this._cache[STORAGE_KEYS.CUSTOM_SECTIONS] = sanitized;
    return sanitized;
  }

  private static sanitizeSectionsList(sections: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = ['None'];
    seen.add('none');

    sections.forEach(s => {
      const trimmed = (s || '').trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        result.push(trimmed);
      }
    });

    return result;
  }

  static saveCustomSection(sectionName: string): string[] {
    const trimmed = (sectionName || '').trim();
    if (!trimmed || trimmed.toLowerCase() === 'none') {
      return this.getSections();
    }

    const current = this.getSections();
    if (!current.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      const updated = this.sanitizeSectionsList([...current, trimmed]);
      setStorageItem(STORAGE_KEYS.CUSTOM_SECTIONS, updated);
      this._cache[STORAGE_KEYS.CUSTOM_SECTIONS] = updated;
      this.performFirestoreWrite('custom_sections', 'all', 'set', { sections: updated });
      this.broadcastSyncEvent('sections-updated', { section: trimmed, sections: updated });
      return updated;
    }
    return current;
  }

  static deleteCustomSection(sectionName: string): string[] {
    const trimmed = (sectionName || '').trim();
    if (!trimmed || trimmed.toLowerCase() === 'none') {
      return this.getSections();
    }

    const current = this.getSections();
    const filtered = current.filter(s => s.toLowerCase() !== trimmed.toLowerCase());
    const updated = this.sanitizeSectionsList(filtered);
    setStorageItem(STORAGE_KEYS.CUSTOM_SECTIONS, updated);
    this._cache[STORAGE_KEYS.CUSTOM_SECTIONS] = updated;
    this.performFirestoreWrite('custom_sections', 'all', 'set', { sections: updated });
    this.broadcastSyncEvent('sections-updated', { section: trimmed, deleted: true, sections: updated });
    return updated;
  }

  // ==========================================
  // FINANCES: STAFF PAYSLIPS & PAYROLL ENGINE
  // ==========================================
  static getStaffPayslips(filters?: { month?: string; academicYear?: string; term?: string }): StaffPayslip[] {
    const cached = this._cache[STORAGE_KEYS.STAFF_PAYSLIPS];
    let list: StaffPayslip[];
    if (cached) {
      list = cached;
    } else {
      list = getStorageItem<StaffPayslip[]>(STORAGE_KEYS.STAFF_PAYSLIPS, []);
      this._cache[STORAGE_KEYS.STAFF_PAYSLIPS] = list;
    }

    if (!filters) return list;

    return list.filter(item => {
      if (filters.month && item.month !== filters.month) return false;
      if (filters.academicYear && item.academicYear !== filters.academicYear) return false;
      if (filters.term && item.term !== filters.term) return false;
      return true;
    });
  }

  static saveStaffPayslip(payslip: StaffPayslip): void {
    const list = this.getStaffPayslips();
    const idx = list.findIndex(p => p.id === payslip.id);
    if (idx >= 0) {
      list[idx] = payslip;
    } else {
      list.push(payslip);
    }
    setStorageItem(STORAGE_KEYS.STAFF_PAYSLIPS, list);
    this._cache[STORAGE_KEYS.STAFF_PAYSLIPS] = list;
    this.performFirestoreWrite('staff_payslips', payslip.id, 'set', payslip);
    this.broadcastSyncEvent('staff-payslips-updated', { payslipId: payslip.id });
  }

  static saveStaffPayslipsBatch(payslips: StaffPayslip[]): void {
    const list = this.getStaffPayslips();
    payslips.forEach(ps => {
      const idx = list.findIndex(p => p.id === ps.id);
      if (idx >= 0) list[idx] = ps;
      else list.push(ps);
    });
    this.performFirestoreWriteBatch('staff_payslips', payslips.map(ps => ({
      id: ps.id,
      type: 'set',
      data: ps
    })));
    setStorageItem(STORAGE_KEYS.STAFF_PAYSLIPS, list);
    this._cache[STORAGE_KEYS.STAFF_PAYSLIPS] = list;
    this.broadcastSyncEvent('staff-payslips-updated', { count: payslips.length });
  }

  static deleteStaffPayslip(id: string): void {
    const list = this.getStaffPayslips().filter(p => p.id !== id);
    setStorageItem(STORAGE_KEYS.STAFF_PAYSLIPS, list);
    this._cache[STORAGE_KEYS.STAFF_PAYSLIPS] = list;
    this.performFirestoreWrite('staff_payslips', id, 'delete');
    this.broadcastSyncEvent('staff-payslips-updated', { payslipId: id, deleted: true });
  }

  /**
   * Disburses approved payslips and writes an official consolidated expenditure voucher
   * directly into the Expenses ledger for seamless profit & loss accounting.
   */
  static disbursePayrollToExpenses(
    payslipIds: string[], 
    session: { academicYear: any; term: any; month: string }
  ): { expense: SchoolExpense; updatedPayslips: StaffPayslip[] } {
    const allPayslips = this.getStaffPayslips();
    const targetSlips = allPayslips.filter(p => payslipIds.includes(p.id));
    
    if (targetSlips.length === 0) {
      throw new Error('No valid payslips found for disbursement.');
    }

    const totalNetDisbursed = targetSlips.reduce((sum, p) => sum + (Number(p.netSalary) || 0), 0);
    const totalSsnitEmployer = targetSlips.reduce((sum, p) => sum + (Number(p.employerSsnitTier1) || 0), 0);
    const today = new Date().toISOString().split('T')[0];
    const monthSanitized = session.month.replace(/\s+/g, '-').toUpperCase();
    const voucherNo = `PV-SAL-${monthSanitized}-${Math.floor(1000 + Math.random() * 9000)}`;
    const expenseId = `exp_sal_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    // Create official expense record in the school finance accounts
    const expenseRecord: SchoolExpense = {
      id: expenseId,
      voucherNumber: voucherNo,
      title: `Staff Salary Payroll Disbursement (${session.month}) - ${targetSlips.length} Staff`,
      category: 'Salaries & Staff Allowances',
      amount: totalNetDisbursed,
      payee: `Consolidated Staff Payroll Account (${targetSlips.length} Staff Members)`,
      paymentMethod: 'Bank Transfer',
      paymentDate: today,
      term: session.term,
      academicYear: session.academicYear,
      approvedBy: 'Headteacher',
      approvalStatus: 'Approved',
      preparedBy: 'Accounts Officer / Bursar',
      description: `Official monthly staff payroll batch payment for ${session.month}. Total Net Salary: GH₵ ${totalNetDisbursed.toFixed(2)}. Total Employer SSNIT (13%): GH₵ ${totalSsnitEmployer.toFixed(2)}. Individual payslips generated and archived in Payroll register.`,
      billComponentId: 'fees',
      billComponentName: 'Tuition / School Fees',
      disbursedDate: today,
      approvalDate: today
    };

    // Save expense into general accounts
    this.saveExpense(expenseRecord);

    // Update payslips with status 'Disbursed' and link expenseId
    const updatedPayslips: StaffPayslip[] = [];
    targetSlips.forEach(p => {
      const updated: StaffPayslip = {
        ...p,
        paymentStatus: 'Disbursed',
        disbursedDate: today,
        voucherNumber: voucherNo,
        expenseId: expenseId,
        updatedAt: new Date().toISOString()
      };
      this.saveStaffPayslip(updated);
      updatedPayslips.push(updated);
    });

    // Record audit entry
    this.recordFinancialAudit({
      action: 'DISBURSE_EXPENSE',
      entityId: expenseId,
      entityType: 'expense',
      entityTitle: expenseRecord.title,
      performedBy: 'Accounts Officer',
      role: 'Accountant',
      details: `Disbursed monthly staff payroll for ${session.month} totaling GH₵ ${totalNetDisbursed.toFixed(2)} across ${targetSlips.length} employees.`,
      amount: totalNetDisbursed
    });

    return { expense: expenseRecord, updatedPayslips };
  }

  // ==========================================
  // FINANCES: CUSTOM EXPENSE CATEGORIES ENGINE
  // ==========================================
  static getDefaultExpenseCategories(): CustomExpenseCategory[] {
    const now = '2026-09-01T00:00:00.000Z';
    return [
      {
        id: 'cat_salaries',
        name: 'Salaries & Staff Allowances',
        code: 'SAL',
        description: 'Teaching staff, administration, auxiliary workers, and security wages & allowances.',
        budgetCap: 28000,
        color: '#10b981',
        iconName: 'Banknote',
        isSystem: true,
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'cat_maintenance',
        name: 'Maintenance & Repairs',
        code: 'MAINT',
        description: 'Classrooms painting, masonry, plumbing, electrical fixtures, desks, and structural repairs.',
        budgetCap: 6000,
        color: '#f59e0b',
        iconName: 'Wrench',
        isSystem: true,
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'cat_supplies',
        name: 'Teaching & Learning Materials',
        code: 'SUPPLIES',
        description: 'Chalk, whiteboards, markers, printing papers, register books, science chemicals, and exam sheets.',
        budgetCap: 4500,
        color: '#6366f1',
        iconName: 'BookOpen',
        isSystem: true,
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'cat_utilities',
        name: 'Utilities (Electricity / Water / Internet)',
        code: 'UTIL',
        description: 'ECG electricity prepaid credit, Ghana Water bills, and high-speed campus broadband access.',
        budgetCap: 4000,
        color: '#06b6d4',
        iconName: 'Zap',
        isSystem: true,
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'cat_transport',
        name: 'Vehicle Fuel & Transportation Logistics',
        code: 'TRANS',
        description: 'School bus diesel/petrol fueling, driver maintenance allowances, and route operations.',
        budgetCap: 3500,
        color: '#8b5cf6',
        iconName: 'Bus',
        isSystem: true,
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'cat_canteen',
        name: 'Kitchen & Canteen Supplies',
        code: 'CANTEEN',
        description: 'Bulk foodstuff, rice, cooking oil, LPG gas refills, and daily student feeding preparation.',
        budgetCap: 7500,
        color: '#f97316',
        iconName: 'Utensils',
        isSystem: true,
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'cat_sanitation',
        name: 'Sanitation & Health Supplies',
        code: 'HEALTH',
        description: 'Liquid soaps, disinfectants, sick bay first-aid medicines, and waste management disposal dues.',
        budgetCap: 2000,
        color: '#14b8a6',
        iconName: 'ShieldCheck',
        isSystem: true,
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'cat_sports',
        name: 'Sports & Co-Curricular',
        code: 'SPORTS',
        description: 'Inter-schools athletics logistics, jerseys, footballs, trophies, and tournament transport.',
        budgetCap: 2500,
        color: '#ec4899',
        iconName: 'Trophy',
        isSystem: true,
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'cat_events',
        name: 'Events & Excursions',
        code: 'EVENTS',
        description: 'Speech & Prize-Giving Day, Graduation ceremonies, educational field trips, and PTA seminars.',
        budgetCap: 3000,
        color: '#a855f7',
        iconName: 'Compass',
        isSystem: true,
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'cat_admin',
        name: 'Administrative & Bank Charges',
        code: 'ADMIN',
        description: 'Corporate bank transaction commissions, audit dues, statutory licensing, and legal retainers.',
        budgetCap: 1500,
        color: '#64748b',
        iconName: 'Receipt',
        isSystem: true,
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'cat_ict',
        name: 'ICT & Software Licensing',
        code: 'ICT',
        description: 'Computer lab hardware servicing, domain renewal, SMS gateway recharge, and OS licenses.',
        budgetCap: 3200,
        color: '#3b82f6',
        iconName: 'Cpu',
        isSystem: true,
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'cat_other',
        name: 'Other Operations',
        code: 'OTHER',
        description: 'Contingency emergency disbursements and miscellaneous school operational overheads.',
        budgetCap: 1200,
        color: '#94a3b8',
        iconName: 'MoreHorizontal',
        isSystem: true,
        isActive: true,
        createdAt: now,
        updatedAt: now
      }
    ];
  }

  static getExpenseCategories(): CustomExpenseCategory[] {
    const cached = this._cache[STORAGE_KEYS.CUSTOM_EXPENSE_CATEGORIES];
    if (cached) return cached;
    const defaults = this.getDefaultExpenseCategories();
    const list = getStorageItem<CustomExpenseCategory[]>(STORAGE_KEYS.CUSTOM_EXPENSE_CATEGORIES, defaults);
    this._cache[STORAGE_KEYS.CUSTOM_EXPENSE_CATEGORIES] = list;
    return list;
  }

  static getExpenseCategoryNames(): string[] {
    const categories = this.getExpenseCategories().filter(c => c.isActive);
    return categories.map(c => c.name);
  }

  static saveExpenseCategory(category: CustomExpenseCategory): void {
    const list = this.getExpenseCategories();
    const idx = list.findIndex(c => c.id === category.id || c.name.toLowerCase().trim() === category.name.toLowerCase().trim());
    if (idx >= 0) {
      list[idx] = category;
    } else {
      list.push(category);
    }
    setStorageItem(STORAGE_KEYS.CUSTOM_EXPENSE_CATEGORIES, list);
    this._cache[STORAGE_KEYS.CUSTOM_EXPENSE_CATEGORIES] = list;
    this.performFirestoreWrite('custom_expense_categories', category.id, 'set', category);
    this.broadcastSyncEvent('expense-categories-updated', { categoryId: category.id });
  }

  static deleteExpenseCategory(id: string): void {
    const list = this.getExpenseCategories().filter(c => c.id !== id);
    setStorageItem(STORAGE_KEYS.CUSTOM_EXPENSE_CATEGORIES, list);
    this._cache[STORAGE_KEYS.CUSTOM_EXPENSE_CATEGORIES] = list;
    this.performFirestoreWrite('custom_expense_categories', id, 'delete');
    this.broadcastSyncEvent('expense-categories-updated', { categoryId: id, deleted: true });
  }

  static getDutyAssignments(): DutyAssignment[] {
    return getStorageItem<DutyAssignment[]>(STORAGE_KEYS.DUTY_ROSTER, []);
  }

  static saveDutyAssignment(assignment: DutyAssignment) {
    const assignments = this.getDutyAssignments();
    const index = assignments.findIndex(a => a.id === assignment.id);
    if (index >= 0) {
      assignments[index] = assignment;
    } else {
      assignments.push(assignment);
    }
    setStorageItem(STORAGE_KEYS.DUTY_ROSTER, assignments);
    this._cache[STORAGE_KEYS.DUTY_ROSTER] = assignments;
  }

  static saveDutyAssignments(newAssignments: DutyAssignment[]) {
    const assignments = this.getDutyAssignments();
    newAssignments.forEach(na => {
      const idx = assignments.findIndex(a => a.id === na.id);
      if (idx >= 0) {
        assignments[idx] = na;
      } else {
        assignments.push(na);
      }
    });
    setStorageItem(STORAGE_KEYS.DUTY_ROSTER, assignments);
    this._cache[STORAGE_KEYS.DUTY_ROSTER] = assignments;
  }

  static deleteDutyAssignment(id: string) {
    const assignments = this.getDutyAssignments().filter(a => a.id !== id);
    setStorageItem(STORAGE_KEYS.DUTY_ROSTER, assignments);
    this._cache[STORAGE_KEYS.DUTY_ROSTER] = assignments;
  }

  static getStaffHandbook(): StaffHandbookDocument[] {
    return getStorageItem<StaffHandbookDocument[]>(STORAGE_KEYS.STAFF_HANDBOOK, []);
  }

  static saveStaffHandbookDocument(doc: StaffHandbookDocument) {
    const docs = this.getStaffHandbook();
    const existingIndex = docs.findIndex(d => d.id === doc.id);
    if (existingIndex !== -1) {
      docs[existingIndex] = doc;
    } else {
      docs.push(doc);
    }
    setStorageItem(STORAGE_KEYS.STAFF_HANDBOOK, docs);
    this._cache[STORAGE_KEYS.STAFF_HANDBOOK] = docs;
  }

  static deleteStaffHandbookDocument(id: string) {
    const docs = this.getStaffHandbook().filter(d => d.id !== id);
    setStorageItem(STORAGE_KEYS.STAFF_HANDBOOK, docs);
    this._cache[STORAGE_KEYS.STAFF_HANDBOOK] = docs;
  }

  static async clearAllData(): Promise<void> {
    // 1. If Firebase is active, cleanly clear active Firestore records
    if (isFirebaseActive && firestoreDb) {
      try {
        const deletePromises: Promise<any>[] = [];

        // We use a batch size or limit to avoid overwhelming the network
        const safeDelete = async (col: string, id: string) => {
          try {
            await deleteDoc(doc(firestoreDb, col, id));
          } catch (e) {
            console.warn(`[Wipe] Failed to delete ${col}/${id}:`, e);
          }
        };

        const currentUser = this.getCurrentUser();
        const uid = firebaseAuth?.currentUser?.uid || currentUser?.uid;

        const schoolIdsToWipe = Array.from(new Set([
          currentUser?.schoolId,
          this.getSchoolInfo()?.schoolId,
          'SMS-P8U4F22L',
          'school_default',
          uid ? `school_${uid}` : null
        ].filter(Boolean))) as string[];

        const collectionsToWipe = [
          'students',
          'teachers',
          'attendance',
          'staff_attendance',
          'assessments',
          'assessment_templates',
          'fees',
          'settings',
          'emis',
          'behavioral_remarks',
          'paystack_payments',
          'activity_logs',
          'duty_roster',
          'teacher_reflections',
          'staff_handbook',
          'leave_requests',
          'quick_notes',
          'tasks',
          'communication_templates',
          'transport_routes',
          'transport_records',
          'canteen_plans',
          'canteen_payments',
          'excursions',
          'excursion_participants',
          'sports_activities',
          'sports_records',
          'textbooks',
          'textbook_transactions',
          'expenses',
          'custom_bill_components',
          'custom_bill_categories',
          'staff_payslips',
          'custom_expense_categories',
          'financial_audit_logs'
        ];

        // Wipe school-partitioned subcollections
        for (const sId of schoolIdsToWipe) {
          for (const colName of collectionsToWipe) {
            try {
              const snap = await getDocs(collection(firestoreDb, 'schools', sId, colName));
              for (const docObj of snap.docs) {
                deletePromises.push(safeDelete(`schools/${sId}/${colName}`, docObj.id));
              }
            } catch (colErr) {
              console.warn(`[Wipe] Failed to query schools/${sId}/${colName}:`, colErr);
            }
          }
          // Also delete school info document
          deletePromises.push(safeDelete('schools', sId));
        }

        if (uid) {
          for (const colName of collectionsToWipe) {
            try {
              const q = query(collection(firestoreDb, colName), where('ownerId', '==', uid));
              const snap = await getDocs(q);
              for (const docObj of snap.docs) {
                deletePromises.push(safeDelete(colName, docObj.id));
              }
            } catch (colErr) {
              console.warn(`[Wipe] Failed to query collection ${colName} for deletion:`, colErr);
            }
          }

          // Delete user-specific school & secrets documents
          deletePromises.push(safeDelete('schools', `school_${uid}`));
          deletePromises.push(safeDelete('schools', `secrets_${uid}`));
        }

        // Also delete default/legacy records just in case
        const students = this.getStudents();
        const teachers = this.getTeachers();
        const attendance = getStorageItem<any[]>(STORAGE_KEYS.ATTENDANCE, []);
        const staffAttendance = getStorageItem<any[]>(STORAGE_KEYS.STAFF_ATTENDANCE, []);
        const assessments = getStorageItem<any[]>(STORAGE_KEYS.ASSESSMENTS, []);
        const fees = getStorageItem<any[]>(STORAGE_KEYS.FEES, []);
        const emis = getStorageItem<any[]>(STORAGE_KEYS.EMIS, []);
        const remarks = getStorageItem<any[]>(STORAGE_KEYS.BEHAVIORAL_REMARKS, []);
        const expenses = getStorageItem<any[]>(STORAGE_KEYS.EXPENSES, []);
        const billComps = getStorageItem<any[]>(STORAGE_KEYS.CUSTOM_BILL_COMPONENTS, []);
        const payslips = getStorageItem<any[]>(STORAGE_KEYS.STAFF_PAYSLIPS, []);
        const expCats = getStorageItem<any[]>(STORAGE_KEYS.CUSTOM_EXPENSE_CATEGORIES, []);
        const finLogs = getStorageItem<any[]>(STORAGE_KEYS.FINANCIAL_AUDIT_LOGS, []);

        students.forEach(s => deletePromises.push(safeDelete('students', s.id)));
        teachers.forEach(t => deletePromises.push(safeDelete('teachers', t.id)));
        attendance.forEach(a => { if (a.id) deletePromises.push(safeDelete('attendance', a.id)); });
        staffAttendance.forEach(sa => { if (sa.id) deletePromises.push(safeDelete('staff_attendance', sa.id)); });
        assessments.forEach(ass => { if (ass.id) deletePromises.push(safeDelete('assessments', ass.id)); });
        fees.forEach(f => { if (f.id) deletePromises.push(safeDelete('fees', f.id)); });
        emis.forEach(e => { if (e.id) deletePromises.push(safeDelete('emis', e.id)); });
        remarks.forEach(r => { if (r.id) deletePromises.push(safeDelete('behavioral_remarks', r.id)); });
        expenses.forEach(e => { if (e.id) deletePromises.push(safeDelete('expenses', e.id)); });
        billComps.forEach(bc => { if (bc.id) deletePromises.push(safeDelete('custom_bill_components', bc.id)); });
        payslips.forEach(p => { if (p.id) deletePromises.push(safeDelete('staff_payslips', p.id)); });
        expCats.forEach(ec => { if (ec.id) deletePromises.push(safeDelete('custom_expense_categories', ec.id)); });
        finLogs.forEach(fl => { if (fl.id) deletePromises.push(safeDelete('financial_audit_logs', fl.id)); });

        // Clear school doc on firestore as well
        deletePromises.push(setDoc(doc(firestoreDb, 'schools', 'school_default'), DEFAULT_SCHOOL_INFO));

        // Await all deletions with a timeout to prevent hanging the whole app
        await Promise.allSettled(deletePromises);
      } catch (err) {
        console.error("Error clearing Cloud Firestore data during format:", err);
      }
    }

    // 2. Erase IndexedDB shadow persistent storage cleanly
    try {
      await IndexedDbEngine.clearAll();
    } catch (idbErr) {
      console.warn("Failed to clear IndexedDB store:", idbErr);
    }

    // 3. Erase all cache & registry records from LocalStorage & SessionStorage
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('sms_') || key.startsWith('school_') || key === 'users_list') {
          localStorage.removeItem(key);
        }
      });
      
      const sessionKeys = Object.keys(sessionStorage);
      sessionKeys.forEach(key => {
        if (key.startsWith('sms_') || key.startsWith('school_') || key === 'users_list') {
          sessionStorage.removeItem(key);
        }
      });
      
      // Explicitly remove legacy or session specific keys
      localStorage.removeItem('users_list');
      localStorage.removeItem('school_students');
      localStorage.removeItem('school_teachers');
      localStorage.removeItem('school_assessments');
      localStorage.removeItem('school_fees_bills');
      localStorage.removeItem('sms_system_cleared_june_30_v2');
      localStorage.removeItem('sms_offline_queue');
      localStorage.removeItem('sms_user');
      sessionStorage.removeItem('sms_user');
      
      // Write fully blank templates so any session starts completely clean
      setStorageItem(STORAGE_KEYS.STUDENTS, []);
      setStorageItem(STORAGE_KEYS.TEACHERS, []);
      setStorageItem(STORAGE_KEYS.ATTENDANCE, []);
      setStorageItem(STORAGE_KEYS.STAFF_ATTENDANCE, []);
      setStorageItem(STORAGE_KEYS.ASSESSMENTS, []);
      setStorageItem(STORAGE_KEYS.ASSESSMENT_TEMPLATES, []);
      setStorageItem(STORAGE_KEYS.FEES, []);
      setStorageItem(STORAGE_KEYS.EMIS, []);
      setStorageItem(STORAGE_KEYS.BEHAVIORAL_REMARKS, []);
      setStorageItem(STORAGE_KEYS.PAYSTACK_LOGS, []);
      setStorageItem(STORAGE_KEYS.QUICK_NOTES, []);
      setStorageItem(STORAGE_KEYS.TASKS, []);
      setStorageItem(STORAGE_KEYS.DUTY_ROSTER, []);
      setStorageItem(STORAGE_KEYS.TEACHER_REFLECTIONS, []);
      setStorageItem(STORAGE_KEYS.STAFF_HANDBOOK, []);
      setStorageItem(STORAGE_KEYS.LEAVE_REQUESTS, []);
      setStorageItem(STORAGE_KEYS.ACTIVITY_LOGS, []);
      setStorageItem(STORAGE_KEYS.AUTO_BACKUPS, []);
      setStorageItem(STORAGE_KEYS.COMM_TEMPLATES, []);
      setStorageItem(STORAGE_KEYS.TRANSPORT_ROUTES, []);
      setStorageItem(STORAGE_KEYS.TRANSPORT_RECORDS, []);
      setStorageItem(STORAGE_KEYS.CANTEEN_PLANS, []);
      setStorageItem(STORAGE_KEYS.CANTEEN_PAYMENTS, []);
      setStorageItem(STORAGE_KEYS.EXCURSIONS, []);
      setStorageItem(STORAGE_KEYS.EXCURSION_PARTICIPANTS, []);
      setStorageItem(STORAGE_KEYS.SPORTS_ACTIVITIES, []);
      setStorageItem(STORAGE_KEYS.SPORTS_RECORDS, []);
      setStorageItem(STORAGE_KEYS.TEXTBOOKS, []);
      setStorageItem(STORAGE_KEYS.TEXTBOOK_TRANSACTIONS, []);
      setStorageItem(STORAGE_KEYS.EXPENSES, []);
      setStorageItem(STORAGE_KEYS.CUSTOM_BILL_COMPONENTS, []);
      setStorageItem(STORAGE_KEYS.CUSTOM_BILL_CATEGORIES, []);
      setStorageItem(STORAGE_KEYS.STAFF_PAYSLIPS, []);
      setStorageItem(STORAGE_KEYS.CUSTOM_EXPENSE_CATEGORIES, []);
      setStorageItem(STORAGE_KEYS.FINANCIAL_AUDIT_LOGS, []);
      setStorageItem(STORAGE_KEYS.CUSTOM_SECTIONS, []);
      setStorageItem(STORAGE_KEYS.WEBAUTHN_CREDENTIALS, []);
      setStorageItem(STORAGE_KEYS.USED_ACTIVATION_CODES, []);
      setStorageItem(STORAGE_KEYS.SCHOOL, DEFAULT_SCHOOL_INFO);
    } catch (e) {
      console.error("Error clearing local storage:", e);
    }

    this.clearCache();
    _lastSessionUid = null;
    this.broadcastSyncEvent('all-cleared', { target: 'all' });
  }
}
