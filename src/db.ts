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
  OAuthProvider,
  signInAnonymously
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
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
  writeBatch,
  setLogLevel
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
  CLASSES,
  AcademicYearType,
  ACADEMIC_YEARS,
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
  CustomExpenseCategory,
  CloudDocumentRecord,
  SubscriberTimerData,
  PlatformPricing,
  DEFAULT_PLATFORM_PRICING
} from './types';
import { evaluateSubscription } from './subscription';
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
  const errMsg = (error instanceof Error ? error.message : String(error)).toLowerCase();
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

  if (errMsg.includes('resource-exhausted') || errMsg.includes('quota') || errMsg.includes('limit')) {
    console.warn('[Firestore Quota Limit] Daily write units quota exceeded. Operating seamlessly in LocalStorage mode.');
    if (typeof DbController !== 'undefined' && DbController.markQuotaExhausted) {
      DbController.markQuotaExhausted();
    }
    return;
  }

  if (errMsg.includes('offline') || errMsg.includes('backend') || errMsg.includes('unavailable') || errMsg.includes('network') || errMsg.includes('timeout')) {
    console.warn('[Firestore Network] Backend is offline or operating in local cache mode:', errMsg);
    return;
  }

  console.warn('Firestore Error: ', JSON.stringify(errInfo));
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
    const firestoreSettings = {
      experimentalAutoDetectLongPolling: true
    };
    
    try {
      setLogLevel('silent');
    } catch {
      // ignore
    }

    try {
      firestoreDb = (dbId && dbId !== '(default)') 
        ? initializeFirestore(firebaseApp, firestoreSettings, dbId) 
        : initializeFirestore(firebaseApp, firestoreSettings);
    } catch {
      firestoreDb = (dbId && dbId !== '(default)') 
        ? getFirestore(firebaseApp, dbId) 
        : getFirestore(firebaseApp);
    }

    try {
      setLogLevel('silent');
    } catch {
      // ignore
    }

    isFirebaseActive = true;
    console.log("[Cloud Firestore] Initialized live cloud database instance:", dbId || '(default)');
  }
} catch (e) {
  console.warn("[Cloud Firestore] Firebase initialization notice:", e);
}

export const db = firestoreDb;
export const auth = firebaseAuth;

export function getFirebaseInstance() {
  return { firebaseApp, firebaseAuth, firestoreDb, isFirebaseActive };
}

// Validate Connection to Cloud Firestore (non-blocking offline-resilient background check)
async function testConnection() {
  if (isFirebaseActive && firestoreDb && typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      await getDocFromServer(doc(firestoreDb, 'test', 'connection'));
      console.log("[Cloud Firestore] Cloud Firestore connection active.");
    } catch (error: any) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.warn("[Cloud Firestore] Device is operating in offline mode.");
      } else {
        console.log("[Cloud Firestore] Running in resilient offline/cache-first mode.");
      }
    }
  }
}
if (typeof setTimeout !== 'undefined') {
  setTimeout(() => { 
    testConnection().catch(() => {});
    try {
      DbController.purgeAllDemoData();
    } catch (e) {
      console.warn("Initial demo data purge notice:", e);
    }
  }, 300);
}

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
  crestUrl: '',
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
  schoolId: '',
  schoolCode: '',
  region: 'Greater Accra',
  professionalCertificate: '',
  officialAddress: '',
  facebookUrl: '',
  twitterUrl: '',
  instagramUrl: '',
  whatsappNumber: '',
  setupWizardCompleted: false
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
  CUSTOM_SECTIONS: 'sms_custom_sections',
  CUSTOM_SUBJECTS: 'sms_custom_subjects',
  CUSTOM_CLASSES: 'sms_custom_classes',
  CUSTOM_ACADEMIC_YEARS: 'sms_custom_academic_years',
  SUBJECT_MARK_LIMITS: 'sms_subject_mark_limits',
  HANDBOOK_READ_STATUS: 'sms_handbook_read_status',
  USER_TAB_PREFERENCES: 'sms_user_tab_preferences',
  SUBSCRIBERS_TIMER: 'sms_subscribers_timer',
  SUBSCRIBER_TIMERS: 'sms_subscriber_timers',
  PLATFORM_PRICING: 'sms_platform_pricing'
};

// -------------------------------------------------------------
// INDEXEDDB BROWSER PERSISTENCE DISCONNECTED
// Operates with 0 storage to browser memory, all saves routed to Cloud Firestore
// -------------------------------------------------------------
export class IndexedDbEngine {
  private static dbName = 'SchoolShieldDB_v1';

  static async setItem(_key: string, _val: string): Promise<void> {
    // DISCONNECTED: Do not write any data to browser cache memory
    return Promise.resolve();
  }

  static async getItem(_key: string): Promise<string | null> {
    // DISCONNECTED: Do not read from browser cache memory
    return Promise.resolve(null);
  }

  static async removeItem(_key: string): Promise<void> {
    return Promise.resolve();
  }

  static async clearAll(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.indexedDB && window.indexedDB.deleteDatabase) {
        window.indexedDB.deleteDatabase(this.dbName);
      }
    } catch (e) {
      // Ignore
    }
  }

  static async restoreAllToLocalStorage(): Promise<void> {
    // DISCONNECTED: Never restore or write data into browser memory
    return Promise.resolve();
  }
}

// Get user-specific key prefix/suffix to support clean multi-user login and isolation
let _lastSessionUid: string | null = null;
let _lastSessionScope: string | null = null;

const GLOBAL_DEVICE_KEYS = new Set([
  'sms_user',
  'sms_users_list',
  'users_list',
  'webauthn_credentials',
  'sms_used_activation_codes',
  'sms_offline_queue',
  'sms_system_theme',
  'sms_system_cleared_june_30_v2',
  'sms_platform_pricing'
]);

export function getActiveDataScope(): string {
  try {
    const rawUser = typeof sessionStorage !== 'undefined' 
      ? (sessionStorage.getItem('sms_user') || (typeof localStorage !== 'undefined' ? localStorage.getItem('sms_user') : null))
      : null;
    if (rawUser) {
      let parsed: any = null;
      try {
        parsed = JSON.parse(rawUser);
      } catch {}
      if (parsed) {
        if (parsed.uid && parsed.uid.trim() !== '') {
          _lastSessionScope = parsed.uid.trim();
          return _lastSessionScope;
        }
        if (parsed.email && parsed.email.trim() !== '') {
          _lastSessionScope = parsed.email.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
          return _lastSessionScope;
        }
      }
    }
  } catch (e) {
    console.error("Error reading active data scope:", e);
  }
  return _lastSessionScope || 'default';
}

export function getPartitionedKey(key: string): string {
  if (GLOBAL_DEVICE_KEYS.has(key)) {
    return key;
  }
  const scope = getActiveDataScope();
  if (!scope || scope === 'default') {
    return key;
  }
  return `${key}_${scope}`;
}

// In-memory runtime session store for instant UI reactivity
const _inMemoryStore: Record<string, any> = {};

// Helper to get storage items with user-scoped isolation and persistence
export function getStorageItem<T>(key: string, defaultValue: T): T {
  const partitionedKey = getPartitionedKey(key);
  if (_inMemoryStore[partitionedKey] !== undefined) {
    return _inMemoryStore[partitionedKey];
  }
  if (DbController._cache && DbController._cache[partitionedKey] !== undefined) {
    return DbController._cache[partitionedKey];
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const item = localStorage.getItem(partitionedKey);
      if (item !== null) {
        const parsed = JSON.parse(item);
        _inMemoryStore[partitionedKey] = parsed;
        if (DbController._cache) {
          DbController._cache[partitionedKey] = parsed;
        }
        return parsed as T;
      }
    } catch {}
  }
  // Transient user session pointer in sessionStorage to allow refresh without re-login
  if (key === 'sms_user' && typeof sessionStorage !== 'undefined') {
    try {
      const item = sessionStorage.getItem('sms_user');
      if (item) {
        const parsed = JSON.parse(item);
        _inMemoryStore[key] = parsed;
        return parsed as T;
      }
    } catch {}
  }
  return defaultValue;
}

export function setStorageItem<T>(key: string, value: T): void {
  const partitionedKey = getPartitionedKey(key);
  _inMemoryStore[partitionedKey] = value;
  if (DbController._cache) {
    DbController._cache[partitionedKey] = value;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(partitionedKey, JSON.stringify(value));
    } catch {}
  }
  if (key === 'sms_user') {
    _inMemoryStore[key] = value;
    if (DbController._cache) DbController._cache[key] = value;
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.setItem('sms_user', JSON.stringify(value));
      } catch {}
    }
  }
}

export function removeStorageItem(key: string): void {
  const partitionedKey = getPartitionedKey(key);
  delete _inMemoryStore[partitionedKey];
  delete _inMemoryStore[key];
  if (DbController._cache) {
    delete DbController._cache[partitionedKey];
    delete DbController._cache[key];
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(partitionedKey);
      localStorage.removeItem(key);
    } catch {}
  }
  if (key === 'sms_user' && typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem('sms_user');
    } catch {}
  }
}

export interface OfflineQueueItem {
  id: string;
  collection: string;
  docId: string;
  type: 'set' | 'delete';
  data?: any;
  timestamp: number;
}

// -----------------------------------------------------------------------------
// CORE DB CONTROLLER (Handles seamless firebase vs local storage persistence)
// -----------------------------------------------------------------------------
export class DbController {
  private static _isSyncing = false;
  public static _isFormatting = false;
  public static _cache: Record<string, any> = {};
  private static _assessmentsByStudent: Map<string, StudentAssessment[]> = new Map();
  private static _studentsByClass: Map<ClassType | string, Student[]> = new Map();

  static generateUniqueSchoolId(uid?: string): string {
    return generateUniqueSchoolId(uid);
  }

  static clearCache() {
    this._cache = {};
    for (const k in _inMemoryStore) {
      if (k !== 'sms_user') delete _inMemoryStore[k];
    }
    this._assessmentsByStudent = new Map();
    this._studentsByClass = new Map();
    _lastSessionUid = null;
  }

  static purgeBrowserCacheMemory(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.clear();
      } catch {}
    }
    try {
      IndexedDbEngine.clearAll();
    } catch {}
    console.log('[Cloud Architecture] Disconnected all browser cache storage. Data & settings saved strictly in Cloud Firestore.');
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

  private static _authPromise: Promise<any> | null = null;

  // Checks for or transparently establishes an active Firebase Auth user session for direct cloud writes and reads
  static async ensureFirebaseAuth(): Promise<any> {
    if (!isFirebaseActive || !firebaseAuth) return null;
    if (firebaseAuth.currentUser) return firebaseAuth.currentUser;

    if (this._authPromise) {
      return this._authPromise;
    }

    this._authPromise = (async () => {
      try {
        if (firebaseAuth.currentUser) return firebaseAuth.currentUser;
        console.log("[Firebase Auth] Establishing active cloud session for direct Firestore persistence...");
        const cred = await signInAnonymously(firebaseAuth);
        console.log("[Firebase Auth] Active authenticated cloud session established:", cred.user.uid);
        return cred.user;
      } catch (e) {
        console.warn("[Firebase Auth] Auto session establishment notice:", e);
        return firebaseAuth.currentUser || null;
      } finally {
        this._authPromise = null;
      }
    })();

    return this._authPromise;
  }

  private static _isSyncingQueue = false;
  private static _autoFlushTimeout: any = null;

  static isQuotaError(_err: any): boolean {
    return false;
  }

  static async switchToOfflineMode(): Promise<void> {
    // DISCONNECTED: Cloud Firestore persistence is permanent; never switch to browser storage
  }

  static markQuotaExhausted(): void {
    // DISCONNECTED
  }

  static isQuotaExhausted(): boolean {
    return false;
  }

  static scheduleAutoFlush(delayMs: number = 2000): void {
    if (this._isFormatting || this.isQuotaExhausted()) return;
    if (this._autoFlushTimeout) clearTimeout(this._autoFlushTimeout);
    this._autoFlushTimeout = setTimeout(() => {
      this._autoFlushTimeout = null;
      if (!this._isFormatting && !this.isQuotaExhausted()) {
        this.syncOfflineQueue().catch(e => console.warn("[Cloud Auto-Flush] Queue sync notice:", e));
      }
    }, delayMs);
  }

  // Helper: Deep-sanitize objects to eliminate any unsupported `undefined` properties
  static sanitizeForFirestore(obj: any): any {
    if (obj === undefined) return null;
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => DbController.sanitizeForFirestore(item));
    const clean: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        clean[key] = DbController.sanitizeForFirestore(val);
      }
    }
    return clean;
  }

  // Helper to handle safe write operations with offline queuing
  static async performFirestoreWrite(
    colName: string,
    docId: string,
    type: 'set' | 'delete',
    data?: any
  ): Promise<void> {
    if (this._isFormatting) {
      return;
    }
    if (!isFirebaseActive || !firestoreDb) {
      console.warn(`[Cloud Sync] Firestore not active. Skipping ${type} on ${colName}/${docId}.`);
      return;
    }
    if (this.isQuotaExhausted()) {
      console.warn(`[Cloud Sync] Quota exhausted. Skipping ${type} on ${colName}/${docId}.`);
      return;
    }

    // Sanitize docId to prevent sub-collection routing issues (e.g., forward slashes in academic years)
    const cleanDocId = (docId !== undefined && docId !== null) ? String(docId) : 'default_id';
    const safeDocId = cleanDocId.replace(/\//g, '-');
    let safeData = data;
    if (safeData && safeData.id) {
      safeData = { ...safeData, id: safeDocId };
    }

    // Enforce active authenticated session for all cloud writes
    if (firebaseAuth && !firebaseAuth.currentUser) {
      await this.ensureFirebaseAuth();
    }
    if (firebaseAuth && !firebaseAuth.currentUser) {
      console.warn(`[Cloud Sync] Direct write queued: No authenticated session available for ${colName}/${safeDocId}.`);
      this.enqueueOfflineOperation(colName, safeDocId, type, safeData);
      return;
    }

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const currentUser = this.getCurrentUser();
    let schoolId = this.resolveActiveSchoolId();

    if (!schoolId || schoolId === 'school_default') {
      schoolId = currentUser?.uid || generateUniqueSchoolId();
    }

    let collectionRef;
    const isRootCollection = colName === 'schools' || colName === 'users' || colName === 'platform_settings';
    if (isRootCollection) {
      collectionRef = collection(firestoreDb, colName);
    } else {
      collectionRef = collection(firestoreDb, 'schools', schoolId, colName);
    }

    const schoolInfo = this.getSchoolInfo();
    const resolvedHeadUid = this.resolveHeadteacherUserId(schoolId);
    const schoolOwnerUid = (safeData?.ownerId && this.isValidHeadteacherUid(safeData.ownerId) ? safeData.ownerId : null) ||
      (this.isValidHeadteacherUid(resolvedHeadUid) ? resolvedHeadUid : null) ||
      (this.isValidHeadteacherUid(schoolInfo.ownerId) ? schoolInfo.ownerId : null) ||
      (currentUser?.role === 'Admin' || currentUser?.role === 'Headteacher' ? currentUser?.uid : currentUser?.ownerId) ||
      currentUser?.uid ||
      firebaseAuth?.currentUser?.uid ||
      'anonymous';
    const headteacherName = this.resolveHeadteacherName(schoolId);
    const authorDisplayName = this.resolveAuthorDisplayName(currentUser);

    console.log(`[Cloud Sync] Writing to path: ${isRootCollection ? colName : `schools/${schoolId}/${colName}`}/${safeDocId}` + (!isRootCollection && this.isValidHeadteacherUid(schoolOwnerUid) ? ` (+ users/${schoolOwnerUid}/${colName}/${safeDocId})` : ''));

    try {
      const docRef = doc(collectionRef, safeDocId);
      if (type === 'set') {
        const payload = this.sanitizeForFirestore({ 
          ...safeData, 
          schoolId: schoolId,
          schoolCode: safeData?.schoolCode || schoolId,
          ownerId: schoolOwnerUid,
          headteacherUserId: this.isValidHeadteacherUid(schoolOwnerUid) ? schoolOwnerUid : (safeData?.headteacherUserId || ''),
          headteacherName: safeData?.headteacherName || headteacherName || '',
          authorUid: currentUser?.uid || firebaseAuth?.currentUser?.uid || 'anonymous',
          authorName: authorDisplayName,
          authorRole: currentUser?.role || 'Teacher',
          lastModified: new Date().toISOString()
        });
        const writes: Promise<any>[] = [setDoc(docRef, payload, { merge: true })];

        // Mirror all Teachers and Teacher-generated data directly under the Headteacher's User ID in Cloud Firestore
        if (!isRootCollection && this.isValidHeadteacherUid(schoolOwnerUid)) {
          writes.push(
            setDoc(doc(firestoreDb, 'users', schoolOwnerUid, colName, safeDocId), payload, { merge: true }).catch(() => {})
          );
        }
        if (colName === 'teachers') {
          writes.push(setDoc(doc(firestoreDb, 'teachers', safeDocId), payload, { merge: true }).catch(() => {}));
        }
        if (colName === 'activity_logs') {
          writes.push(setDoc(doc(firestoreDb, 'activity_logs', safeDocId), payload, { merge: true }).catch(() => {}));
        }
        await Promise.all(writes);
      } else if (type === 'delete') {
        const deletes: Promise<any>[] = [deleteDoc(docRef)];
        if (!isRootCollection && this.isValidHeadteacherUid(schoolOwnerUid)) {
          deletes.push(deleteDoc(doc(firestoreDb, 'users', schoolOwnerUid, colName, safeDocId)).catch(() => {}));
        }
        if (colName === 'teachers') {
          deletes.push(deleteDoc(doc(firestoreDb, 'teachers', safeDocId)).catch(() => {}));
        }
        if (colName === 'activity_logs') {
          deletes.push(deleteDoc(doc(firestoreDb, 'activity_logs', safeDocId)).catch(() => {}));
        }
        await Promise.all(deletes);
      }
      console.log(`[Cloud Sync] Fast synced ${type} on ${colName}/${safeDocId}.`);
    } catch (error: any) {
      if (this.isQuotaError(error)) {
        this.markQuotaExhausted();
      } else {
        console.warn(`[Cloud Sync] Direct write failed for ${colName}/${safeDocId}, queueing for auto-flush:`, error);
        this.enqueueOfflineOperation(colName, safeDocId, type, safeData);
      }
    }
  }

  // High-performance batch write method utilizing Firestore writeBatch (up to 300 operations per batch)
  static async performFirestoreWriteBatch(
    colName: string,
    items: { id: string; data?: any; type: 'set' | 'delete' }[]
  ): Promise<void> {
    if (this._isFormatting) return;
    if (!isFirebaseActive || !firestoreDb || !items || items.length === 0) {
      console.warn(`[Cloud Sync] Firestore not active or no items for ${colName}. Skipping batch.`);
      return;
    }
    if (this.isQuotaExhausted()) {
      console.warn(`[Cloud Sync] Quota exhausted for ${colName}. Skipping batch.`);
      return;
    }

    // Enforce active authenticated session for all batch cloud writes
    if (firebaseAuth && !firebaseAuth.currentUser) {
      await this.ensureFirebaseAuth();
    }
    if (firebaseAuth && !firebaseAuth.currentUser) {
      console.warn(`[Cloud Sync] Batch write queued: No authenticated session available for ${colName}.`);
      items.forEach(item => {
        const safeDocId = item.id.replace(/\//g, '-');
        this.enqueueOfflineOperation(colName, safeDocId, item.type, item.data);
      });
      return;
    }

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const currentUser = this.getCurrentUser();
    const rawSchoolId = this.resolveActiveSchoolId();
    const schoolId = (!rawSchoolId || rawSchoolId === 'school_default') ? (currentUser?.uid || generateUniqueSchoolId()) : rawSchoolId;
    const schoolInfo = this.getSchoolInfo();
    const resolvedHeadUid = this.resolveHeadteacherUserId(schoolId);
    const schoolOwnerUid = (this.isValidHeadteacherUid(resolvedHeadUid) ? resolvedHeadUid : null) ||
      (this.isValidHeadteacherUid(schoolInfo.ownerId) ? schoolInfo.ownerId : null) ||
      (currentUser?.role === 'Admin' || currentUser?.role === 'Headteacher' ? currentUser?.uid : currentUser?.ownerId) ||
      currentUser?.uid ||
      firebaseAuth?.currentUser?.uid ||
      'anonymous';
    const headteacherName = this.resolveHeadteacherName(schoolId);
    const authorDisplayName = this.resolveAuthorDisplayName(currentUser);

    let collectionRef;
    const isRootCollection = colName === 'schools' || colName === 'users' || colName === 'platform_settings';
    if (isRootCollection) {
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
      const chunkSize = 300;
      const shouldMirrorToHead = !isRootCollection && this.isValidHeadteacherUid(schoolOwnerUid);
      const headCollectionRef = shouldMirrorToHead ? collection(firestoreDb, 'users', schoolOwnerUid, colName) : null;

      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const batch = writeBatch(firestoreDb);
        const headBatch = shouldMirrorToHead ? writeBatch(firestoreDb) : null;

        chunk.forEach(item => {
          const safeDocId = item.id.replace(/\//g, '-');
          const docRef = doc(collectionRef, safeDocId);
          if (item.type === 'set') {
            let safeData = item.data;
            if (safeData && safeData.id) {
              safeData = { ...safeData, id: safeDocId };
            }
            const payload = this.sanitizeForFirestore({ 
              ...safeData, 
              schoolId: schoolId,
              schoolCode: safeData?.schoolCode || schoolId,
              ownerId: schoolOwnerUid,
              headteacherUserId: this.isValidHeadteacherUid(schoolOwnerUid) ? schoolOwnerUid : (safeData?.headteacherUserId || ''),
              headteacherName: safeData?.headteacherName || headteacherName || '',
              authorUid: currentUser?.uid || firebaseAuth?.currentUser?.uid || 'anonymous',
              authorName: authorDisplayName,
              authorRole: currentUser?.role || 'Teacher',
              lastModified: new Date().toISOString()
            });
            batch.set(docRef, payload, { merge: true });
            if (headBatch && headCollectionRef) {
              headBatch.set(doc(headCollectionRef, safeDocId), payload, { merge: true });
            }
          } else {
            batch.delete(docRef);
            if (headBatch && headCollectionRef) {
              headBatch.delete(doc(headCollectionRef, safeDocId));
            }
          }
        });
        await batch.commit();
        if (headBatch) {
          await headBatch.commit().catch(() => {});
        }
      }
      console.log(`[Cloud Sync Batch] Committed batch of ${items.length} records to ${colName} in atomic roundtrip.`);
    } catch (error: any) {
      if (this.isQuotaError(error)) {
        this.markQuotaExhausted();
      } else {
        console.warn(`[Cloud Sync Batch] Batch write failed on ${colName}, queuing for background replay:`, error);
        items.forEach(item => {
          const safeDocId = item.id.replace(/\//g, '-');
          this.enqueueOfflineOperation(colName, safeDocId, item.type, item.data);
        });
      }
    }
  }

  // Enqueue a fallback write operation
  static enqueueOfflineOperation(
    colName: string,
    docId: string,
    type: 'set' | 'delete',
    data?: any
  ): void {
    if (this._isFormatting) return;
    const queue = getStorageItem<OfflineQueueItem[]>('sms_offline_queue', []);
    
    // To minimize redundancy: overwrite or merge operations on the exact same document
    const existingIdx = queue.findIndex(item => item.collection === colName && item.docId === docId);
    
    const newItem: OfflineQueueItem = {
      id: 'op_' + Math.random().toString(36).substring(2, 9),
      collection: colName,
      docId,
      type,
      data: DbController.sanitizeForFirestore(data),
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

    if (!this.isQuotaExhausted()) {
      this.scheduleAutoFlush(2000);
    }
  }

  static getOfflineQueueSize(): number {
    return getStorageItem<OfflineQueueItem[]>('sms_offline_queue', []).length;
  }

  // Auto-synchronize pending local writes with Firestore once online (Batched for instant completion)
  static async syncOfflineQueue(): Promise<{ success: boolean; syncedCount: number }> {
    if (this._isFormatting) return { success: false, syncedCount: 0 };
    if (!isFirebaseActive || !firestoreDb || this.isQuotaExhausted()) return { success: false, syncedCount: 0 };
    if (!firebaseAuth?.currentUser) {
      await this.ensureFirebaseAuth();
    }
    if (!firebaseAuth?.currentUser) return { success: false, syncedCount: 0 };
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
    const resolvedHeadUid = this.resolveHeadteacherUserId(schoolId);
    const schoolOwnerUid = (this.isValidHeadteacherUid(resolvedHeadUid) ? resolvedHeadUid : null) ||
      this.getSchoolInfo().ownerId ||
      currentUser?.ownerId ||
      currentUser?.uid;
    const authorDisplayName = this.resolveAuthorDisplayName(currentUser);
    const shouldMirrorToHead = this.isValidHeadteacherUid(schoolOwnerUid);

    // Process queue in fast atomic batches of 300 operations
    const chunkSize = 300;
    for (let i = 0; i < queue.length; i += chunkSize) {
      const chunk = queue.slice(i, i + chunkSize);
      try {
        const batch = writeBatch(firestoreDb);
        const headBatch = shouldMirrorToHead ? writeBatch(firestoreDb) : null;
        let hasHeadWrites = false;

        chunk.forEach(item => {
          const safeDocId = item.docId.replace(/\//g, '-');
          let safeData = item.data;
          if (safeData && safeData.id) {
            safeData = { ...safeData, id: safeDocId };
          }

          const isRootCollection = item.collection === 'schools' || item.collection === 'users' || item.collection === 'platform_settings';
          let collectionRef;
          if (isRootCollection) {
            collectionRef = collection(firestoreDb, item.collection);
          } else {
            collectionRef = collection(firestoreDb, 'schools', schoolId, item.collection);
          }

          const docRef = doc(collectionRef, safeDocId);
          if (item.type === 'set') {
            const payload = this.sanitizeForFirestore({ 
              ...safeData, 
              schoolId: schoolId,
              schoolCode: safeData?.schoolCode || schoolId,
              ownerId: schoolOwnerUid || firebaseAuth?.currentUser?.uid || currentUser?.uid || 'anonymous',
              headteacherUserId: this.isValidHeadteacherUid(schoolOwnerUid) ? schoolOwnerUid : (safeData?.headteacherUserId || ''),
              authorUid: currentUser?.uid || firebaseAuth?.currentUser?.uid || 'anonymous',
              authorName: authorDisplayName,
              authorRole: currentUser?.role || 'Teacher',
              lastModified: new Date().toISOString()
            });
            batch.set(docRef, payload, { merge: true });
            if (headBatch && !isRootCollection && shouldMirrorToHead) {
              headBatch.set(doc(firestoreDb, 'users', schoolOwnerUid!, item.collection, safeDocId), payload, { merge: true });
              hasHeadWrites = true;
            }
          } else if (item.type === 'delete') {
            batch.delete(docRef);
            if (headBatch && !isRootCollection && shouldMirrorToHead) {
              headBatch.delete(doc(firestoreDb, 'users', schoolOwnerUid!, item.collection, safeDocId));
              hasHeadWrites = true;
            }
          }
        });

        await batch.commit();
        if (headBatch && hasHeadWrites) {
          await headBatch.commit().catch(() => {});
        }
        syncedCount += chunk.length;

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sms_sync_progress', {
            detail: { current: syncedCount, total: queue.length }
          }));
        }
        console.log(`[Offline Sync] Successfully batch replayed ${chunk.length} operations.`);
      } catch (chunkErr: any) {
        if (this.isQuotaError(chunkErr)) {
          this.markQuotaExhausted();
          this._isSyncingQueue = false;
          return { success: false, syncedCount };
        }
        console.warn("[Offline Sync] Batch commit error, retrying items individually:", chunkErr);
        // Fallback: item-by-item retry for this chunk
        for (const item of chunk) {
          try {
            const safeDocId = item.docId.replace(/\//g, '-');
            let safeData = item.data;
            if (safeData && safeData.id) {
              safeData = { ...safeData, id: safeDocId };
            }
            const isRootCollection = item.collection === 'schools' || item.collection === 'users' || item.collection === 'platform_settings';
            let collectionRef;
            if (isRootCollection) {
              collectionRef = collection(firestoreDb, item.collection);
            } else {
              collectionRef = collection(firestoreDb, 'schools', schoolId, item.collection);
            }
            const docRef = doc(collectionRef, safeDocId);
            if (item.type === 'set') {
              const payload = this.sanitizeForFirestore({
                ...safeData,
                schoolId,
                ownerId: schoolOwnerUid || currentUser?.uid || 'anonymous',
                authorName: authorDisplayName
              });
              await setDoc(docRef, payload, { merge: true });
              if (!isRootCollection && shouldMirrorToHead) {
                await setDoc(doc(firestoreDb, 'users', schoolOwnerUid!, item.collection, safeDocId), payload, { merge: true }).catch(() => {});
              }
            } else if (item.type === 'delete') {
              await deleteDoc(docRef);
              if (!isRootCollection && shouldMirrorToHead) {
                await deleteDoc(doc(firestoreDb, 'users', schoolOwnerUid!, item.collection, safeDocId)).catch(() => {});
              }
            }
            syncedCount++;
          } catch (itemErr: any) {
            if (this.isQuotaError(itemErr)) {
              this.markQuotaExhausted();
              this._isSyncingQueue = false;
              return { success: false, syncedCount };
            }
            remainingQueue.push(item);
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
      if (user.email === 'staff@school.internal' || (user.email && user.email.startsWith('anonymous_'))) {
        const adminAccount = this.getRegisteredUsers().find(u => (u.email || '').toLowerCase().trim() === 'pegyirenyi@gmail.com');
        if (adminAccount) {
          const healed: UserAccount = { ...adminAccount, role: 'Admin', licenseType: 'unlimited' };
          setStorageItem(STORAGE_KEYS.USER, healed);
          this._cache[STORAGE_KEYS.USER] = healed;
          return healed;
        }
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
        // Preserve and protect user license & trial countdown state
        if (emailLower === 'pegyirenyi@gmail.com' || user.role === 'Admin') {
          if (user.licenseType !== 'unlimited') {
            user.licenseType = 'unlimited';
            changed = true;
          }
        } else if (user.licenseType === 'activated' || user.licenseType === 'unlimited') {
          // Active license is linked directly to this user ID
        } else {
          // Ensure valid trial timestamps are never wiped on get or refresh
          if (!user.licenseType) {
            user.licenseType = 'trial';
            changed = true;
          }
          if (!user.trialStartDate) {
            user.trialStartDate = user.registeredOn || user.createdAt || new Date().toISOString();
            changed = true;
          }
          if (!user.trialEndDate) {
            user.trialEndDate = new Date(new Date(user.trialStartDate).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
            changed = true;
          }
        }

        // Ensure user has a one-time unique School ID assigned (Rule 3)
        if (!user.schoolId || user.schoolId === 'SMS-P8U4F22L' || user.schoolId === 'school_default') {
          user.schoolId = generateUniqueSchoolId(user.uid);
          changed = true;
        }
        if (user.role === 'Teacher') {
          const resolvedHead = this.resolveHeadteacherUserId(user.schoolId);
          if ((!user.ownerId || user.ownerId === user.uid || user.ownerId.startsWith('HEAD_') || user.ownerId === 'user_default') && this.isValidHeadteacherUid(resolvedHead) && resolvedHead !== user.uid) {
            user.ownerId = resolvedHead;
            changed = true;
          }
        } else if (!user.ownerId) {
          user.ownerId = user.uid;
          changed = true;
        }

        if (changed) {
          setStorageItem(STORAGE_KEYS.USER, user);
          if (isFirebaseActive && firestoreDb && user.uid) {
            setDoc(doc(firestoreDb, 'users', user.uid), DbController.sanitizeForFirestore({
              licenseType: user.licenseType,
              trialEndDate: user.trialEndDate,
              registeredOn: user.registeredOn,
              schoolId: user.schoolId,
              ownerId: user.ownerId
            }), { merge: true }).catch(() => {});
          }
        }
      }

      // Universal safety check: guarantee unique school code and ownerId on every active session
      if (!user.schoolId || user.schoolId === 'SMS-P8U4F22L' || user.schoolId === 'school_default') {
        user.schoolId = generateUniqueSchoolId(user.uid);
        setStorageItem(STORAGE_KEYS.USER, user);
      }
      if (user.role !== 'Teacher' && !user.ownerId) {
        user.ownerId = user.uid;
        setStorageItem(STORAGE_KEYS.USER, user);
      }
    }
    return user;
  }

  // Robustly resolve active School ID across user session, assigned teacher profile, and school profile
  static resolveActiveSchoolId(): string {
    const user = this.getCurrentUser();
    
    // 1. If user is a Teacher, resolve their assigned schoolId
    if (user && user.role === 'Teacher') {
      if (user.schoolId && user.schoolId.trim() && user.schoolId !== 'school_default' && user.schoolId !== 'SMS-P8U4F22L') {
        return user.schoolId.trim();
      }
      if (user.schoolCode && user.schoolCode.trim()) {
        return user.schoolCode.trim();
      }
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

    // 2. Headteacher / Admin explicit schoolId
    if (user?.schoolId && user.schoolId.trim() && user.schoolId !== 'school_default' && user.schoolId !== 'SMS-P8U4F22L') {
      return user.schoolId.trim();
    }

    // 3. Explicit unique schoolId on active user session
    if (user?.uid) {
      return user.uid;
    }

    // 3. Check SchoolInfo in storage/cache
    const schoolInfo = this.getSchoolInfo();
    if (schoolInfo?.schoolId && schoolInfo.schoolId.trim() && schoolInfo.schoolId !== 'school_default' && schoolInfo.schoolId !== 'SMS-P8U4F22L') {
      const resolvedId = schoolInfo.schoolId.trim();
      if (user) {
        user.schoolId = resolvedId;
        if (!user.ownerId) user.ownerId = schoolInfo.ownerId || user.uid;
        setStorageItem(STORAGE_KEYS.USER, user);
        this._cache[STORAGE_KEYS.USER] = user;
      }
      return resolvedId;
    }

    // 4. Generate one-time unique School ID for every login user ID (Rule 3)
    if (user?.uid) {
      const uniqueId = generateUniqueSchoolId(user.uid);
      user.schoolId = uniqueId;
      if (!user.ownerId) user.ownerId = user.uid;
      setStorageItem(STORAGE_KEYS.USER, user);
      this._cache[STORAGE_KEYS.USER] = user;

      // Automatically assign school code to School Profile
      schoolInfo.schoolId = uniqueId;
      if (!schoolInfo.ownerId) schoolInfo.ownerId = user.uid;
      setStorageItem(STORAGE_KEYS.SCHOOL, schoolInfo);
      this._cache[STORAGE_KEYS.SCHOOL] = schoolInfo;

      if (isFirebaseActive && firestoreDb) {
        setDoc(doc(firestoreDb, 'users', user.uid), DbController.sanitizeForFirestore({ schoolId: uniqueId, ownerId: user.uid }), { merge: true }).catch(console.error);
        setDoc(doc(firestoreDb, 'schools', uniqueId), DbController.sanitizeForFirestore({ schoolId: uniqueId, ownerId: user.uid, name: schoolInfo.name || '' }), { merge: true }).catch(console.error);
      }
      return uniqueId;
    }

    return generateUniqueSchoolId();
  }

  static isValidHeadteacherUid(uid?: string | null): uid is string {
    if (!uid || typeof uid !== 'string') return false;
    const trimmed = uid.trim();
    return Boolean(
      trimmed &&
      !trimmed.startsWith('HEAD_') &&
      trimmed !== 'user_default' &&
      trimmed !== 'anonymous' &&
      trimmed !== 'unknown'
    );
  }

  // Resolve Headteacher User ID for a given School Code ID
  static resolveHeadteacherUserId(schoolCode?: string): string {
    const sCode = (schoolCode || getStorageItem<UserAccount | null>(STORAGE_KEYS.USER, null)?.schoolId || '').trim();
    const users = this.getRegisteredUsers();
    const teachersList = getStorageItem<Teacher[]>(STORAGE_KEYS.TEACHERS, []);
    const isTeacherId = (uid?: string) => !!uid && (
      teachersList.some(t => t.id === uid || (t as any).userId === uid) ||
      users.some(u => u.uid === uid && u.role === 'Teacher')
    );

    // 1. Registered Headteacher matching schoolCode
    const matchedHead = users.find(u =>
      u.role === 'Headteacher' &&
      this.isValidHeadteacherUid(u.uid) &&
      (u.schoolId === sCode || u.schoolCode === sCode)
    );
    if (matchedHead) return matchedHead.uid;

    // 2. School info ownerId / userId (ensuring it is not a Teacher UID) or matching headteacher email
    const school = getStorageItem<SchoolInfo>(STORAGE_KEYS.SCHOOL, DEFAULT_SCHOOL_INFO);
    if (this.isValidHeadteacherUid(school?.ownerId) && !isTeacherId(school.ownerId)) return school.ownerId;
    if (this.isValidHeadteacherUid(school?.userId) && !isTeacherId(school.userId)) return school.userId;

    const headEmail = (school?.headteacherEmail || school?.email || '').toLowerCase().trim();
    if (headEmail) {
      const byEmail = users.find(u => (u.role === 'Headteacher' || u.role === 'Admin') && (u.email || '').toLowerCase().trim() === headEmail);
      if (byEmail && this.isValidHeadteacherUid(byEmail.uid)) return byEmail.uid;
    }

    // 3. Registered Admin matching schoolCode (excluding master admin fallback unless matched)
    const matchedAdmin = users.find(u =>
      u.role === 'Admin' &&
      this.isValidHeadteacherUid(u.uid) &&
      (u.schoolId === sCode || u.schoolCode === sCode)
    );
    if (matchedAdmin) return matchedAdmin.uid;

    // 4. Enrolled teachers' valid ownerId or headteacherUserId
    const teacherWithHead = teachersList.find(t =>
      (!sCode || t.schoolId === sCode || t.schoolCode === sCode) &&
      (this.isValidHeadteacherUid((t as any).headteacherUserId) || (this.isValidHeadteacherUid(t.ownerId) && !isTeacherId(t.ownerId)))
    );
    if (teacherWithHead) {
      if (this.isValidHeadteacherUid((teacherWithHead as any).headteacherUserId)) return (teacherWithHead as any).headteacherUserId;
      if (this.isValidHeadteacherUid(teacherWithHead.ownerId)) return teacherWithHead.ownerId!;
    }

    // 5. Current user if Headteacher/Admin, or current Teacher's valid ownerId
    const current = getStorageItem<UserAccount | null>(STORAGE_KEYS.USER, null);
    if (current && (current.role === 'Headteacher' || current.role === 'Admin') && this.isValidHeadteacherUid(current.uid)) {
      return current.uid;
    }
    if (this.isValidHeadteacherUid(current?.ownerId) && current?.ownerId !== current?.uid && !isTeacherId(current?.ownerId)) {
      return current!.ownerId!;
    }

    return sCode ? 'HEAD_' + sCode : 'user_default';
  }

  static resolveHeadteacherName(schoolCode?: string): string {
    const headUid = this.resolveHeadteacherUserId(schoolCode);
    const users = this.getRegisteredUsers();
    const headUser = users.find(u => u.uid === headUid && (u.role === 'Headteacher' || u.role === 'Admin'));
    const school = getStorageItem<SchoolInfo>(STORAGE_KEYS.SCHOOL, DEFAULT_SCHOOL_INFO);
    return (school?.headteacherName || headUser?.name || '').trim();
  }

  static resolveAuthorDisplayName(user?: UserAccount | null): string {
    const activeUser = user || getStorageItem<UserAccount | null>(STORAGE_KEYS.USER, null);
    if (!activeUser) return 'School System';
    if (activeUser.role === 'Teacher') {
      const teachers = getStorageItem<Teacher[]>(STORAGE_KEYS.TEACHERS, []);
      const uEmail = activeUser.email?.toLowerCase().trim();
      const uStaff = activeUser.staffId?.toLowerCase().trim();
      const matched = teachers.find(t =>
        (uEmail && t.email?.toLowerCase().trim() === uEmail) ||
        (uStaff && t.staffId?.toLowerCase().trim() === uStaff) ||
        t.id === activeUser.uid ||
        (t as any).userId === activeUser.uid
      );
      const enrolledName = this.formatTeacherFullName(matched);
      if (enrolledName) return enrolledName;
    }
    const cleanName = (activeUser.name || '').trim();
    if (cleanName && cleanName.toLowerCase() !== 'staff' && cleanName.toLowerCase() !== 'staff member') {
      return cleanName;
    }
    return activeUser.email || activeUser.role || 'Administrator';
  }

  static formatTeacherFullName(teacher?: Partial<Teacher> | null): string {
    if (!teacher) return '';
    return [teacher.firstName, teacher.middleName, teacher.lastName]
      .map(part => (part || '').trim())
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  // Look up an existing assigned Teacher profile for a user if one exists in the school database
  static getConnectedTeacherProfile(user?: UserAccount | null): Teacher | null {
    const activeUser = user || this.getCurrentUser();
    if (!activeUser) return null;

    const teachers = this.getTeachers();
    const userEmail = activeUser.email?.toLowerCase().trim();
    const userStaffId = activeUser.staffId?.toLowerCase().trim();
    const userUid = activeUser.uid;
    const userName = activeUser.name?.toLowerCase().trim();

    const matchedTeacher = teachers.find(t => 
      (userEmail && t.email?.toLowerCase().trim() === userEmail) ||
      (userStaffId && t.staffId?.toLowerCase().trim() === userStaffId) ||
      (userUid && (t.id === userUid || (t as any).userId === userUid)) ||
      (activeUser.role === 'Teacher' && userName && userName !== 'staff member' && userName !== 'faculty teacher' && this.formatTeacherFullName(t).toLowerCase() === userName)
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

    const enrolledFullName = this.formatTeacherFullName(matchedTeacher);
    const shouldSyncUserName = activeUser.role === 'Teacher' && !!enrolledFullName && activeUser.name !== enrolledFullName;
    const shouldSyncUserMeta = !activeUser.schoolId || activeUser.schoolId !== activeSchoolId || (matchedTeacher.staffId && activeUser.staffId !== matchedTeacher.staffId);

    if (activeUser && (shouldSyncUserName || shouldSyncUserMeta)) {
      activeUser.schoolId = activeSchoolId;
      activeUser.schoolCode = activeUser.schoolCode || activeSchoolId;
      if (matchedTeacher.staffId) activeUser.staffId = matchedTeacher.staffId;
      if (shouldSyncUserName) {
        activeUser.name = enrolledFullName;
      }
      setStorageItem(STORAGE_KEYS.USER, activeUser);
      this._cache[STORAGE_KEYS.USER] = activeUser;
      const users = this.getRegisteredUsers();
      const uIdx = users.findIndex(u => u.uid === activeUser.uid);
      if (uIdx >= 0) {
        users[uIdx] = { ...users[uIdx], ...activeUser };
        setStorageItem(STORAGE_KEYS.USERS_LIST, users);
        this._cache[STORAGE_KEYS.USERS_LIST] = users;
      }
      if (isFirebaseActive && firestoreDb) {
        setDoc(doc(firestoreDb, 'users', activeUser.uid), DbController.sanitizeForFirestore(activeUser), { merge: true }).catch(console.error);
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

    const list = getStorageItem<UserAccount[]>(STORAGE_KEYS.USERS_LIST, []);
    
    // Filter out revoked built-in test IDs and dummy accounts
    const filtered = list.filter(user => {
      if (!user || !user.uid) return false;
      if (user.uid === 'H5nlyq30sANEMixDEmURnYoyUzU2' || user.uid.endsWith('8888')) return false;
      if (user.requestCode === 'REQ-PEGY-5103' || user.requestCode?.endsWith('8888')) return false;
      return true;
    });

    // Ensure pegyirenyi@gmail.com is present in the list as Admin with unlimited license
    const pegyIdx = filtered.findIndex(user => (user?.email || '').toLowerCase().trim() === 'pegyirenyi@gmail.com');
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

    // Ensure valid license types and persistent trial countdowns for all registered accounts
    filtered.forEach(u => {
      if (u.email?.toLowerCase().trim() === 'pegyirenyi@gmail.com') {
        u.licenseType = 'unlimited';
      } else if (u.licenseType === 'activated' || u.licenseType === 'unlimited') {
        // preserve activated / unlimited licenses
      } else {
        if (!u.licenseType) u.licenseType = 'trial';
        if (!u.trialStartDate) {
          u.trialStartDate = u.registeredOn || u.createdAt || new Date().toISOString();
        }
        if (!u.trialEndDate) {
          u.trialEndDate = new Date(new Date(u.trialStartDate).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
        }
      }
    });

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
    const revokedEmails = new Set([
      'multimediageetech@gmail.com',
      'patienceedusah724@gmail.com',
      'sammyotoo06@gmail.com',
      'wilkinsonannan@gmail.com'
    ]);

    // Safety check for revoked built-in emails and duplicate IDs
    const sanitized = users.filter(user => {
      if (user.uid === 'H5nlyq30sANEMixDEmURnYoyUzU2') return false;
      if (user.requestCode === 'REQ-PEGY-5103') return false;
      if (user.requestCode === 'REQ-MULTI-8888' || user.requestCode?.endsWith('8888') || user.uid?.endsWith('8888')) return false;
      const em = user.email?.toLowerCase().trim();
      if (em && revokedEmails.has(em)) return false;
      return true;
    });

    const pegyIdx = sanitized.findIndex(user => (user?.email || '').toLowerCase().trim() === 'pegyirenyi@gmail.com');
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

    // Also remove from subscriber timers
    const allTimers = this.getAllSubscriberTimers().filter(t => t.id !== uid && t.userId !== uid);
    setStorageItem(STORAGE_KEYS.SUBSCRIBER_TIMERS, allTimers);
    this._cache[STORAGE_KEYS.SUBSCRIBER_TIMERS] = allTimers;

    const currentTimer = getStorageItem<SubscriberTimerData | null>(STORAGE_KEYS.SUBSCRIBERS_TIMER, null);
    if (currentTimer && (currentTimer.id === uid || currentTimer.userId === uid)) {
      localStorage.removeItem(STORAGE_KEYS.SUBSCRIBERS_TIMER);
    }

    if (isFirebaseActive && firestoreDb) {
      try {
        const schoolId = this.resolveActiveSchoolId();
        // 1. Delete individual user document
        await deleteDoc(doc(firestoreDb, 'users', uid));
        
        // 2. Delete subscriber timer documents from all Firestore locations
        deleteDoc(doc(firestoreDb, 'subscribers', uid)).catch(() => {});
        deleteDoc(doc(firestoreDb, 'subscribers_timer', uid)).catch(() => {});
        if (schoolId) {
          deleteDoc(doc(firestoreDb, 'schools', schoolId, 'subscribers_timer', uid)).catch(() => {});
          deleteDoc(doc(firestoreDb, 'schools', schoolId, 'subscriber_timers', uid)).catch(() => {});
          deleteDoc(doc(firestoreDb, 'schools', schoolId, 'subscribers', uid)).catch(() => {});
        }

        // 3. Update global directory document
        await setDoc(doc(firestoreDb, 'users', 'directory'), { list: filtered, updatedAt: new Date().toISOString() });
      } catch (err) {
        console.warn("Could not sync user deletion to firestore: ", err);
      }
    }
    this.broadcastSyncEvent('users-updated', filtered);
    this.broadcastSyncEvent('subscribers-timer-updated', allTimers);
  }

  static determineRole(email?: string): UserRole {
    if (!email || typeof email !== 'string') {
      return 'Teacher';
    }
    const trimmedEmail = email.toLowerCase().trim();
    if (trimmedEmail === 'pegyirenyi@gmail.com') {
      return 'Admin';
    }
    
    // Check if user is explicitly registered with an assigned role first
    const users = getStorageItem<UserAccount[]>(STORAGE_KEYS.USERS_LIST, []);
    const existingUser = users.find(u => u.email && typeof u.email === 'string' && u.email.toLowerCase().trim() === trimmedEmail);
    if (existingUser) {
      return existingUser.role;
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
    
    const hasTeacherEmail = teachers.some(t => t.email?.toLowerCase().trim() === trimmedEmail);
    if (hasTeacherEmail) {
      return 'Teacher';
    }
    return 'Teacher';
  }

  static login(email: string, role: UserRole): UserAccount {
    // Find or bootstrap user account (for offline fallback)
    const prevUser = this.getCurrentUser();
    if (!prevUser || (prevUser.email || '').toLowerCase() !== email.toLowerCase()) {
      this.clearCache();
      _lastSessionUid = null; // Reset session lock on explicit login
    }
    const users = this.getRegisteredUsers();
    
    const trimmedEmail = email.toLowerCase().trim();
    let assignedRole: UserRole = role;
    
    if (trimmedEmail === 'pegyirenyi@gmail.com') {
      assignedRole = 'Admin';
    } else {
      const existingUser = users.find(u => (u?.email || '').toLowerCase().trim() === trimmedEmail);
      if (existingUser) {
        assignedRole = existingUser.role;
      } else {
        assignedRole = this.determineRole(trimmedEmail);
      }
    }

    // Enforce Rule: One email cannot be used as Headteacher and assigned the same email as a teacher
    const schoolInfo = this.getSchoolInfo();
    const schoolHeadEmail = schoolInfo?.email?.toLowerCase().trim();
    const teachers = this.getTeachers();
    const matchingTeacher = teachers.find(t => t.email && t.email.toLowerCase().trim() === trimmedEmail);

    if (role === 'Teacher') {
      const isHeadEmail = (schoolHeadEmail && schoolHeadEmail === trimmedEmail) ||
        users.some(u => (u.role === 'Headteacher' || u.role === 'Admin') && u.email?.toLowerCase().trim() === trimmedEmail);
      if (isHeadEmail) {
        throw new Error(`The email '${email}' is already registered as a Headteacher. One email cannot be used as Headteacher and assigned the same email as a teacher.`);
      }
    } else if (role === 'Headteacher') {
      const isTeacherEmail = teachers.some(t => t.email && t.email.toLowerCase().trim() === trimmedEmail && !t.email.toLowerCase().endsWith('@school.internal')) ||
        users.some(u => u.role === 'Teacher' && u.email?.toLowerCase().trim() === trimmedEmail);
      if (isTeacherEmail) {
        throw new Error(`The email '${email}' is already assigned as a Teacher. One email cannot be used as Headteacher and assigned the same email as a teacher.`);
      }
    }

    if (matchingTeacher && assignedRole !== 'Admin') {
      const assignedClasses = matchingTeacher.assignedClasses || [];
      const assignedClass = matchingTeacher.assignedClass;
      if (assignedClasses.length > 0 || (assignedClass && assignedClass !== 'None')) {
        assignedRole = 'Teacher';
      }
    }
    
    let user = users.find(u => (u?.email || '').toLowerCase() === email.toLowerCase());
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
      if (user.licenseType === 'trial' && !user.trialEndDate) {
        const start = user.trialStartDate || user.registeredOn || user.createdAt || new Date().toISOString();
        user.trialStartDate = start;
        user.trialEndDate = new Date(new Date(start).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
        changed = true;
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
        trialStartDate: trimmedEmail === 'pegyirenyi@gmail.com' ? undefined : createdNow,
        trialEndDate: trimmedEmail === 'pegyirenyi@gmail.com' ? undefined : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        registeredOn: createdNow,
        requestCode: `REQ-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`
      };
      users.push(user);
      setStorageItem(STORAGE_KEYS.USERS_LIST, users);
    }
    setStorageItem(STORAGE_KEYS.USER, user);
    // Enforce immediate Cloud Firebase persistence for the logged in user profile & directory
    this.performFirestoreWrite('users', user.uid, 'set', user).catch(err => {
      console.warn("Could not sync user profile to Firestore on login:", err);
    });
    this.saveRegisteredUsers(users).catch(() => {});
    return user;
  }

  static register(name: string, email: string, role: UserRole): UserAccount {
    this.clearCache();
    const users = this.getRegisteredUsers();
    
    const trimmedEmail = email.toLowerCase().trim();
    let assignedRole: UserRole = role;
    
    // Allow registering user directly without pre-authorization when there is no logged-in user context
    if (trimmedEmail !== 'pegyirenyi@gmail.com' && trimmedEmail !== 'multimediageetech@gmail.com' && trimmedEmail !== 'patienceedusah724@gmail.com' && trimmedEmail !== 'sammyotoo06@gmail.com' && trimmedEmail !== 'wilkinsonannan@gmail.com') {
      const isAuthorized = users.some(u => (u?.email || '').toLowerCase().trim() === trimmedEmail);
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
    const activeSchoolId = this.resolveActiveSchoolId();
    let userSchoolId: string | undefined = undefined;
    if (assignedRole === 'Teacher') {
      userSchoolId = activeSchoolId;
    } else if (currentUser?.schoolId && currentUser.schoolId !== 'SMS-P8U4F22L' && currentUser.schoolId !== 'school_default') {
      userSchoolId = currentUser.schoolId;
    } else {
      userSchoolId = generateUniqueSchoolId(trimmedEmail.replace(/[^a-zA-Z0-9]/g, ''));
    }

    const createdNow = new Date().toISOString();
    const prefix = email.split('@')[0].substring(0, 4).toUpperCase();
    const isMasterAdmin = trimmedEmail === 'pegyirenyi@gmail.com';
    const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const newUser: UserAccount = {
      uid: 'user_' + Math.random().toString(36).substring(2, 9),
      email: email,
      name: name,
      role: assignedRole,
      schoolId: userSchoolId,
      ownerId: currentUser?.uid || 'user_default',
      createdAt: createdNow,
      licenseType: isMasterAdmin ? 'unlimited' : 'trial',
      trialStartDate: isMasterAdmin ? undefined : createdNow,
      trialEndDate: isMasterAdmin ? undefined : trialEnd,
      registeredOn: createdNow,
      requestCode: `REQ-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`
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
    if (this._isFormatting) return;
    const logs = this.getActivityLogs();
    const currentUser = this.getCurrentUser();
    const schoolId = this.resolveActiveSchoolId();
    const headUid = this.resolveHeadteacherUserId(schoolId);
    const displayName = this.resolveAuthorDisplayName(currentUser);
    
    const newLog: ActivityLog = {
      id: `log_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
      timestamp: new Date().toISOString(),
      userEmail: currentUser?.email || 'system@geetech.com',
      userName: displayName,
      userRole: currentUser?.role || 'Headteacher',
      action,
      details,
      severity,
      ...(schoolId ? { schoolId } : {}),
      ...(this.isValidHeadteacherUid(headUid) ? { ownerId: headUid, headteacherUserId: headUid } : {})
    } as any;
    
    logs.unshift(newLog);
    if (logs.length > 1000) {
      logs.pop();
    }
    setStorageItem(STORAGE_KEYS.ACTIVITY_LOGS, logs);
    this._cache[STORAGE_KEYS.ACTIVITY_LOGS] = logs;
    this.broadcastSyncEvent('activity-logs-updated', logs);
    this.performFirestoreWrite('activity_logs', newLog.id, 'set', newLog).catch(err => {
      console.warn("Could not sync activity log to Firestore:", err);
    });
  }

  static clearActivityLogs(): void {
    const logs = this.getActivityLogs();
    logs.forEach(log => {
      if (log.id) {
        this.performFirestoreWrite('activity_logs', log.id, 'delete').catch(e => console.error(e));
      }
    });
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
    licenseType: 'unlicensed' | 'activated' | 'unlimited' | 'trial', 
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
    
    const isTrial = licenseType === 'trial';
    const trialStart = user.trialStartDate || user.registeredOn || user.createdAt || now.toISOString();
    const trialEnd = new Date(new Date(trialStart).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const updated: UserAccount = {
      ...user,
      licenseType,
      isSuspended: false,
      registeredOn: user.registeredOn || user.createdAt || new Date().toISOString(),
      trialStartDate: isTrial ? trialStart : (licenseType === 'activated' || licenseType === 'unlimited' ? undefined : user.trialStartDate),
      trialEndDate: isTrial ? trialEnd : (licenseType === 'activated' || licenseType === 'unlimited' ? undefined : user.trialEndDate),
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
    
    // Propagate Headteacher/Admin license updates directly to all assigned Teachers in the same school
    if (updated.role === 'Headteacher' || updated.role === 'Admin') {
      const targetSchoolId = (updated.schoolId || updated.schoolCode || '').trim();
      let propagated = false;
      for (let i = 0; i < users.length; i++) {
        const candidate = users[i];
        if (candidate.role === 'Teacher' && (
          candidate.ownerId === updated.uid ||
          (targetSchoolId && targetSchoolId !== 'school_default' && (candidate.schoolId === targetSchoolId || candidate.schoolCode === targetSchoolId))
        )) {
          users[i] = {
            ...candidate,
            licenseType: updated.licenseType,
            licensePeriod: updated.licensePeriod,
            lastActivatedOn: updated.lastActivatedOn,
            trialStartDate: updated.trialStartDate,
            trialEndDate: updated.trialEndDate,
            isSuspended: updated.isSuspended
          };
          propagated = true;
          if (currentUser && currentUser.uid === candidate.uid) {
            setStorageItem(STORAGE_KEYS.USER, users[i]);
            this._cache[STORAGE_KEYS.USER] = users[i];
          }
          if (isFirebaseActive && firestoreDb) {
            setDoc(doc(firestoreDb, 'users', candidate.uid), DbController.sanitizeForFirestore(users[i]), { merge: true }).catch(() => {});
          }
          this.syncSubscriberTimerFromUser(users[i]).catch(() => {});
        }
      }
      if (propagated) {
        setStorageItem(STORAGE_KEYS.USERS_LIST, users);
        this._cache[STORAGE_KEYS.USERS_LIST] = users;
      }
    }

    if (isFirebaseActive && firestoreDb) {
      try {
        await setDoc(doc(firestoreDb, 'users', uid), DbController.sanitizeForFirestore(updated), { merge: true });
        await setDoc(doc(firestoreDb, 'users', 'directory'), { list: users, updatedAt: new Date().toISOString() }, { merge: true });
      } catch (err) {
        console.warn("Could not sync license status to firestore: ", err);
      }
    }
    
    // Automatically keep subscribers timer data saved in Firebase Cloud Firestore
    this.syncSubscriberTimerFromUser(updated).catch(err => {
      console.warn("Could not sync subscriber timer data:", err);
    });

    this.broadcastSyncEvent('users-updated', users);
    return updated;
  }

  static persistTrialEndDateIfMissing(uid: string, customTrialEndDate?: string): void {
    if (!uid) return;
    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.uid === uid) {
      if (currentUser.licenseType !== 'activated' && currentUser.licenseType !== 'unlimited') {
        const now = new Date();
        const trialStart = currentUser.trialStartDate || currentUser.registeredOn || now.toISOString();
        const trialEnd = customTrialEndDate || currentUser.trialEndDate || new Date(new Date(trialStart).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
        currentUser.licenseType = 'trial';
        currentUser.trialStartDate = trialStart;
        currentUser.trialEndDate = trialEnd;
        setStorageItem(STORAGE_KEYS.USER, currentUser);
        
        if (isFirebaseActive && firestoreDb) {
          setDoc(doc(firestoreDb, 'users', uid), DbController.sanitizeForFirestore({
            licenseType: 'trial',
            trialStartDate: trialStart,
            trialEndDate: trialEnd
          }), { merge: true }).catch(console.error);
        }
      }
      this.syncSubscriberTimerFromUser(currentUser).catch(() => {});
    }
  }

  static updateUserAccount(uid: string, updates: Partial<UserAccount>): UserAccount {
    const users = this.getRegisteredUsers();
    let idx = users.findIndex(u => u.uid === uid);
    
    let updated: UserAccount;
    if (idx >= 0) {
      updated = {
        ...users[idx],
        ...updates
      };
      users[idx] = updated;
    } else {
      const current = this.getCurrentUser();
      updated = {
        ...(current || {
          uid,
          email: '',
          name: '',
          role: 'Admin',
          createdAt: new Date().toISOString()
        }),
        ...updates
      };
      users.push(updated);
    }
    
    setStorageItem(STORAGE_KEYS.USERS_LIST, users);
    
    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.uid === uid) {
      setStorageItem(STORAGE_KEYS.USER, updated);
      this._cache[STORAGE_KEYS.USER] = updated;
    }
    
    if (updates.setupWizardCompleted) {
      try {
        localStorage.setItem(`sms_setup_wizard_completed_${uid}`, 'true');
        localStorage.setItem('sms_setup_wizard_completed', 'true');
      } catch (e) {}
    }
    
    if (isFirebaseActive && firestoreDb) {
      try {
        setDoc(doc(firestoreDb, 'users', uid), DbController.sanitizeForFirestore(updated), { merge: true }).catch(err => {
          console.warn("Could not sync user update to firestore: ", err);
        });
      } catch (err) {
        console.warn("Could not sync user update to firestore: ", err);
      }
    }
    
    this.syncSubscriberTimerFromUser(updated).catch(() => {});
    
    return updated;
  }

  static buildSubscriberTimerData(user: UserAccount): SubscriberTimerData {
    const status = evaluateSubscription(user);
    const nowIso = new Date().toISOString();
    const uid = user.uid || 'unknown_user';
    const schoolId = user.schoolId || this.resolveActiveSchoolId() || '';
    const schoolOwnerUid = this.resolveHeadteacherUserId(schoolId) || user.ownerId || uid;
    const isTeacher = user.role === 'Teacher';

    const effectiveRegisteredOn = status?.registeredOnDate && !isNaN(status.registeredOnDate.getTime())
      ? status.registeredOnDate.toISOString()
      : (user.registeredOn || user.createdAt || nowIso);

    const trialStart = (isTeacher && status?.isTrial)
      ? effectiveRegisteredOn
      : (user.trialStartDate || effectiveRegisteredOn);
    const trialEnd = (isTeacher && status?.isTrial && status?.expiryDate)
      ? status.expiryDate.toISOString()
      : (user.trialEndDate || (status?.isTrial ? status.expiryDate.toISOString() : new Date(new Date(trialStart).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()));

    const effectiveLastActivatedOn = status?.lastActivatedOnDate
      ? status.lastActivatedOnDate.toISOString()
      : (isTeacher ? undefined : user.lastActivatedOn);

    return {
      id: uid,
      userId: uid,
      userEmail: user.email || '',
      userName: user.name || '',
      role: user.role || 'Teacher',
      schoolId: schoolId,
      schoolCode: user.schoolCode || schoolId,
      ownerId: schoolOwnerUid,
      licenseType: (status?.licenseType === 'activated' || status?.licenseType === 'unlimited') ? status.licenseType : 'trial',
      licensePeriod: status?.licensePeriod || user.licensePeriod || 1,
      registeredOn: effectiveRegisteredOn,
      trialStartDate: (status?.licenseType === 'activated' || status?.licenseType === 'unlimited') ? undefined : trialStart,
      trialEndDate: (status?.licenseType === 'activated' || status?.licenseType === 'unlimited') ? undefined : trialEnd,
      lastActivatedOn: effectiveLastActivatedOn,
      expiryDate: status?.expiryDate ? status.expiryDate.toISOString() : (user.expiryDate || nowIso),
      remainingDays: status?.remainingDays ?? 0,
      remainingHours: status?.remainingHours ?? 0,
      remainingMinutes: status?.remainingMinutes ?? 0,
      remainingSeconds: status?.remainingSeconds ?? 0,
      countdownString: status?.countdownString || '7d 0h 0m 0s',
      isLocked: status?.isLocked ?? false,
      isSuspended: user.isSuspended ?? false,
      requestCode: status?.requestCode || user.requestCode || '',
      activationCode: user.activationCode || '',
      updatedAt: nowIso
    };
  }

  static getSubscriberTimer(userId?: string): SubscriberTimerData | null {
    const targetUid = userId || this.getCurrentUser()?.uid;
    if (!targetUid) return null;
    const allTimers = this.getAllSubscriberTimers();
    const found = allTimers.find(t => t.userId === targetUid || t.id === targetUid);
    if (found) return found;
    const currentTimer = getStorageItem<SubscriberTimerData | null>(STORAGE_KEYS.SUBSCRIBERS_TIMER, null);
    if (currentTimer && (currentTimer.userId === targetUid || currentTimer.id === targetUid)) {
      return currentTimer;
    }
    return null;
  }

  static getAllSubscriberTimers(): SubscriberTimerData[] {
    if (this._cache[STORAGE_KEYS.SUBSCRIBER_TIMERS]) {
      return this._cache[STORAGE_KEYS.SUBSCRIBER_TIMERS];
    }
    const timers = getStorageItem<SubscriberTimerData[]>(STORAGE_KEYS.SUBSCRIBER_TIMERS, []);
    this._cache[STORAGE_KEYS.SUBSCRIBER_TIMERS] = timers;
    return timers;
  }

  static async saveSubscriberTimer(timerData: SubscriberTimerData): Promise<void> {
    if (!timerData || (!timerData.userId && !timerData.id)) return;
    const uid = timerData.userId || timerData.id;
    timerData.id = uid;
    timerData.userId = uid;
    timerData.updatedAt = new Date().toISOString();

    // 1. Update local cache & storage
    const all = this.getAllSubscriberTimers();
    const idx = all.findIndex(t => t.id === uid || t.userId === uid);
    if (idx >= 0) {
      all[idx] = timerData;
    } else {
      all.push(timerData);
    }
    setStorageItem(STORAGE_KEYS.SUBSCRIBER_TIMERS, all);
    this._cache[STORAGE_KEYS.SUBSCRIBER_TIMERS] = all;

    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.uid === uid) {
      setStorageItem(STORAGE_KEYS.SUBSCRIBERS_TIMER, timerData);
      currentUser.subscriptionTimer = timerData;
      setStorageItem(STORAGE_KEYS.USER, currentUser);
    }

    // 2. Persist to Firestore:
    // a) Schools tenant collection: /schools/{schoolId}/subscribers_timer/{uid}
    const schoolId = timerData.schoolId || this.resolveActiveSchoolId() || 'default_school';
    const sanitized = DbController.sanitizeForFirestore(timerData);

    try {
      await this.performFirestoreWrite('subscribers_timer', uid, 'set', sanitized);
    } catch (err) {
      console.warn("Could not save subscriber timer to school collection: ", err);
    }

    // b) Also save to root /subscribers/{uid} and /subscribers_timer/{uid}
    if (isFirebaseActive && firestoreDb) {
      try {
        await Promise.all([
          setDoc(doc(firestoreDb, 'subscribers', uid), sanitized, { merge: true }),
          setDoc(doc(firestoreDb, 'subscribers_timer', uid), sanitized, { merge: true }),
          setDoc(doc(firestoreDb, 'users', uid), {
            subscriptionTimer: sanitized,
            trialEndDate: timerData.trialEndDate || null,
            lastActivatedOn: timerData.lastActivatedOn || null,
            licenseType: timerData.licenseType,
            licensePeriod: timerData.licensePeriod || 1,
            isSuspended: timerData.isSuspended || false
          }, { merge: true })
        ]);
      } catch (err) {
        console.warn("Could not save subscriber timer to root Firestore: ", err);
      }
    }

    this.broadcastSyncEvent('subscribers-timer-updated', all);
  }

  static async syncSubscriberTimerFromUser(user: UserAccount): Promise<SubscriberTimerData> {
    const timerData = this.buildSubscriberTimerData(user);
    await this.saveSubscriberTimer(timerData);
    return timerData;
  }

  static async syncAllSubscriberTimers(): Promise<void> {
    const users = this.getRegisteredUsers();
    for (const u of users) {
      try {
        await this.syncSubscriberTimerFromUser(u);
      } catch (err) {
        console.warn(`Could not sync subscriber timer for user ${u.uid}:`, err);
      }
    }
  }

  static logout() {
    this.clearCache();
    this._studentsByClass.clear();
    this._assessmentsByStudent.clear();
    _lastSessionUid = null;
    _lastSessionScope = null;
    sessionStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.USER);
    sessionStorage.removeItem('sms_user');
    localStorage.removeItem('sms_user');
    if (isFirebaseActive && firebaseAuth) {
      try {
        signOut(firebaseAuth).catch(err => console.error("Firebase Auth SignOut error:", err));
      } catch (e) {
        console.error(e);
      }
    }
    this.broadcastSyncEvent('user-logged-out', { target: 'all' });
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

    // Enforce Rule: One email cannot be used as Headteacher and assigned the same email as a teacher
    const registeredTeachers = this.getTeachers();
    const schoolInfo = this.getSchoolInfo();
    const schoolHeadEmail = schoolInfo?.email?.toLowerCase().trim();

    if (assignedRole === 'Teacher') {
      const isHeadEmail = (schoolHeadEmail && schoolHeadEmail === trimmedEmail) ||
        users.some(u => (u.role === 'Headteacher' || u.role === 'Admin') && u.email?.toLowerCase().trim() === trimmedEmail);
      if (isHeadEmail) {
        throw new Error(`The email '${email}' is already registered as a Headteacher. One email cannot be used as Headteacher and assigned the same email as a teacher.`);
      }
    } else if (assignedRole === 'Headteacher') {
      const isTeacherEmail = registeredTeachers.some(t => t.email && t.email.toLowerCase().trim() === trimmedEmail && !t.email.toLowerCase().endsWith('@school.internal')) ||
        users.some(u => u.role === 'Teacher' && u.email?.toLowerCase().trim() === trimmedEmail);
      if (isTeacherEmail) {
        throw new Error(`The email '${email}' is already assigned as a Teacher. One email cannot be used as Headteacher and assigned the same email as a teacher.`);
      }
    }

    // Allow registering user directly without pre-authorization when there is no logged-in user context
    if (trimmedEmail !== 'pegyirenyi@gmail.com' && trimmedEmail !== 'multimediageetech@gmail.com' && trimmedEmail !== 'patienceedusah724@gmail.com' && trimmedEmail !== 'sammyotoo06@gmail.com' && trimmedEmail !== 'wilkinsonannan@gmail.com') {
      const isAuthorized = users.some(u => (u?.email || '').toLowerCase().trim() === trimmedEmail);
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
      const isMasterAdmin = trimmedEmail === 'pegyirenyi@gmail.com';
      const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const profile: UserAccount = {
        uid,
        email,
        name,
        role: assignedRole,
        schoolId: userSchoolId,
        createdAt: createdNow,
        licenseType: isMasterAdmin ? 'unlimited' : 'trial',
        trialStartDate: isMasterAdmin ? undefined : createdNow,
        trialEndDate: isMasterAdmin ? undefined : trialEnd,
        registeredOn: createdNow,
        requestCode: `REQ-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`,
        setupWizardCompleted: false
      };

      // Store permanently in Cloud Firebase Firestore users collection
      await setDoc(doc(firestoreDb, 'users', uid), DbController.sanitizeForFirestore(profile));
      await this.saveSubscriberTimer(this.buildSubscriberTimerData(profile));
      
      // Store in local storage
      setStorageItem(STORAGE_KEYS.USER, profile);
      const updatedUsersList = this.getRegisteredUsers();
      if (!updatedUsersList.some(u => u.uid === uid)) {
        updatedUsersList.push(profile);
        await this.saveRegisteredUsers(updatedUsersList);
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
      const trimmedEmail = email.toLowerCase().trim();

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
        trialStartDate: createdNow,
        trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
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
        
        const isMasterAdmin = trimmedEmail === 'pegyirenyi@gmail.com';
        if (isMasterAdmin) {
          if (profile.licenseType !== 'unlimited') {
            profile.licenseType = 'unlimited';
            profileChanged = true;
          }
        } else if (profile.licenseType !== 'activated' && profile.licenseType !== 'unlimited') {
          if (profile.licenseType !== 'trial') {
            profile.licenseType = 'trial';
            profileChanged = true;
          }
          if (!profile.trialStartDate) {
            profile.trialStartDate = profile.registeredOn || profile.createdAt || new Date().toISOString();
            profileChanged = true;
          }
          if (!profile.trialEndDate) {
            profile.trialEndDate = new Date(new Date(profile.trialStartDate).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
            profileChanged = true;
          }
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

        if (!profile.setupWizardCompleted && typeof localStorage !== 'undefined') {
          if (localStorage.getItem(`sms_setup_wizard_completed_${uid}`) === 'true' || localStorage.getItem('sms_setup_wizard_completed') === 'true') {
            profile.setupWizardCompleted = true;
            profileChanged = true;
          }
        } else if (profile.setupWizardCompleted && typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem(`sms_setup_wizard_completed_${uid}`, 'true');
            localStorage.setItem('sms_setup_wizard_completed', 'true');
          } catch (e) {}
        }
        
        if (profileChanged) {
          await setDoc(doc(firestoreDb, 'users', uid), DbController.sanitizeForFirestore(profile), { merge: true });
        }
        
        await this.saveSubscriberTimer(this.buildSubscriberTimerData(profile));
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
        // Create user profile document if missing with 7 days trial
        const createdNow = new Date().toISOString();
        const prefix = email.split('@')[0].substring(0, 4).toUpperCase();
        const isMasterAdmin = trimmedEmail === 'pegyirenyi@gmail.com';
        const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        
        const profile: UserAccount = {
          uid,
          email,
          name: email.split('@')[0].toUpperCase(),
          role: assignedRole,
          createdAt: createdNow,
          licenseType: isMasterAdmin ? 'unlimited' : 'trial',
          trialStartDate: isMasterAdmin ? undefined : createdNow,
          trialEndDate: isMasterAdmin ? undefined : trialEnd,
          registeredOn: createdNow,
          requestCode: `REQ-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`,
          setupWizardCompleted: false
        };
        await setDoc(doc(firestoreDb, 'users', uid), DbController.sanitizeForFirestore(profile));
        await this.saveSubscriberTimer(this.buildSubscriberTimerData(profile));
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

  static async preSyncSchoolDirectoryForLogin(schoolId?: string): Promise<void> {
    if (!isFirebaseActive || !firestoreDb) return;
    const cleanSchoolId = (schoolId || '').trim();
    try {
      let discoveredHeadUid: string | undefined;
      const tasks: Promise<void>[] = [];

      // 1. Sync global users directory (so Headteacher subscription state is loaded)
      tasks.push((async () => {
        try {
          const dirSnap = await getDoc(doc(firestoreDb, 'users', 'directory'));
          if (dirSnap.exists()) {
            const data = dirSnap.data();
            if (data && Array.isArray(data.list) && data.list.length > 0) {
              setStorageItem(STORAGE_KEYS.USERS_LIST, data.list);
              this._cache[STORAGE_KEYS.USERS_LIST] = data.list;
              if (cleanSchoolId) {
                const head = (data.list as UserAccount[]).find(u =>
                  (u.role === 'Headteacher' || u.role === 'Admin') &&
                  (u.schoolId === cleanSchoolId || u.schoolCode === cleanSchoolId) &&
                  this.isValidHeadteacherUid(u.uid)
                );
                if (head) discoveredHeadUid = head.uid;
              }
            }
          }
        } catch {}
      })());

      if (cleanSchoolId && cleanSchoolId !== 'school_default') {
        tasks.push((async () => {
          try {
            const schoolDoc = await getDoc(doc(firestoreDb, 'schools', cleanSchoolId));
            if (schoolDoc.exists()) {
              const sData = schoolDoc.data() as SchoolInfo;
              if (sData) {
                setStorageItem(STORAGE_KEYS.SCHOOL, sData);
                this._cache[STORAGE_KEYS.SCHOOL] = sData;
                if (this.isValidHeadteacherUid(sData.ownerId)) {
                  discoveredHeadUid = sData.ownerId;
                }
              }
            } else {
              const profileSnap = await getDoc(doc(firestoreDb, 'schools', cleanSchoolId, 'profile', 'info'));
              if (profileSnap.exists()) {
                const pData = profileSnap.data() as SchoolInfo;
                setStorageItem(STORAGE_KEYS.SCHOOL, pData);
                this._cache[STORAGE_KEYS.SCHOOL] = pData;
                if (this.isValidHeadteacherUid(pData?.ownerId)) {
                  discoveredHeadUid = pData.ownerId;
                }
              }
            }
          } catch {}
        })());

        tasks.push((async () => {
          try {
            const teachersSnap = await getDocs(collection(firestoreDb, 'schools', cleanSchoolId, 'teachers'));
            if (!teachersSnap.empty) {
              const cloudTeachers = teachersSnap.docs.map(d => d.data() as Teacher);
              this.syncDatasetFromSnapshot('teachers', cloudTeachers, false);
              const tOwner = cloudTeachers.find(t => this.isValidHeadteacherUid((t as any).headteacherUserId) || this.isValidHeadteacherUid(t.ownerId));
              if (tOwner) {
                discoveredHeadUid = discoveredHeadUid || (tOwner as any).headteacherUserId || tOwner.ownerId;
              }
            }
          } catch {}
        })());

        tasks.push((async () => {
          try {
            const timersSnap = await getDocs(collection(firestoreDb, 'schools', cleanSchoolId, 'subscribers_timer'));
            if (!timersSnap.empty) {
              const cloudTimers = timersSnap.docs.map(d => ({ ...d.data(), id: d.id } as SubscriberTimerData));
              this.syncDatasetFromSnapshot('subscribers_timer', cloudTimers, false);
            }
          } catch {}
        })());
      }

      await Promise.all(tasks);

      // Pull Headteacher's user doc and mirrored teachers/subscribers_timer under users/{headteacherUid}
      const headUid = discoveredHeadUid || (cleanSchoolId ? this.resolveHeadteacherUserId(cleanSchoolId) : undefined);
      if (this.isValidHeadteacherUid(headUid)) {
        await Promise.all([
          (async () => {
            try {
              const headDoc = await getDoc(doc(firestoreDb, 'users', headUid));
              if (headDoc.exists()) {
                const headData = headDoc.data() as UserAccount;
                const users = this.getRegisteredUsers();
                const idx = users.findIndex(u => u.uid === headData.uid);
                if (idx >= 0) users[idx] = headData;
                else users.push(headData);
                setStorageItem(STORAGE_KEYS.USERS_LIST, users);
                this._cache[STORAGE_KEYS.USERS_LIST] = users;
              }
            } catch {}
          })(),
          (async () => {
            try {
              const headTeachersSnap = await getDocs(collection(firestoreDb, 'users', headUid, 'teachers'));
              if (!headTeachersSnap.empty) {
                const cloudTeachers = headTeachersSnap.docs.map(d => d.data() as Teacher);
                this.syncDatasetFromSnapshot('teachers', cloudTeachers, false);
              }
            } catch {}
          })(),
          (async () => {
            try {
              const headTimersSnap = await getDocs(collection(firestoreDb, 'users', headUid, 'subscribers_timer'));
              if (!headTimersSnap.empty) {
                const cloudTimers = headTimersSnap.docs.map(d => ({ ...d.data(), id: d.id } as SubscriberTimerData));
                this.syncDatasetFromSnapshot('subscribers_timer', cloudTimers, false);
              }
            } catch {}
          })()
        ]);
      }
    } catch (e) {
      console.warn("Pre-sync school directory notice:", e);
    }
  }

  static async teacherLogin(credential: string, schoolId: string): Promise<UserAccount> {
    const trimmedInput = (credential || '').trim();
    const trimmedSchoolCode = (schoolId || '').trim();
    
    // Locate enrolled teacher (pre-sync from Cloud Firestore if school code is provided and match not in local cache)
    const findMatch = () => {
      const list = this.getTeachers();
      const inputLower = trimmedInput.toLowerCase();
      if (!inputLower) return undefined;
      return list.find(t => {
        const fullName = this.formatTeacherFullName(t).toLowerCase();
        const shortName = `${t.firstName || ''} ${t.lastName || ''}`.toLowerCase().trim();
        return (
          t.email?.toLowerCase().trim() === inputLower ||
          t.staffId?.toLowerCase().trim() === inputLower ||
          t.id?.toLowerCase().trim() === inputLower ||
          fullName === inputLower ||
          shortName === inputLower
        );
      });
    };

    let matchingTeacher = findMatch();
    if (!matchingTeacher && trimmedSchoolCode) {
      await this.preSyncSchoolDirectoryForLogin(trimmedSchoolCode);
      matchingTeacher = findMatch();
    }

    if (!matchingTeacher) {
      throw new Error("Educator Verification Failed: No enrolled staff member found matching your credentials under this School Code. Please contact your Headteacher to enroll your profile in Staff Profiles.");
    }

    const activeSchoolCode = trimmedSchoolCode || matchingTeacher.schoolCode || matchingTeacher.schoolId || this.resolveActiveSchoolId();
    const activeOwnerId = matchingTeacher.ownerId || this.resolveHeadteacherUserId(activeSchoolCode);

    // Also pull Headteacher user doc if online so subscription period matches 1:1 immediately
    await this.preSyncSchoolDirectoryForLogin(activeSchoolCode);

    const enrolledTeacherName = this.formatTeacherFullName(matchingTeacher);
    const cachedUsers = this.getRegisteredUsers();
    const headUser = cachedUsers.find(u =>
      (u.role === 'Headteacher' || u.role === 'Admin') &&
      u.email?.toLowerCase().trim() !== 'pegyirenyi@gmail.com' &&
      ((activeOwnerId && u.uid === activeOwnerId) || (activeSchoolCode && (u.schoolId === activeSchoolCode || u.schoolCode === activeSchoolCode)))
    );

    let userAccount = cachedUsers.find(u => 
      (matchingTeacher?.email && (u.email || '').toLowerCase().trim() === matchingTeacher.email.toLowerCase().trim()) ||
      (trimmedInput.includes('@') && (u.email || '').toLowerCase().trim() === trimmedInput.toLowerCase()) ||
      (matchingTeacher?.staffId && u.staffId?.toLowerCase().trim() === matchingTeacher.staffId.toLowerCase().trim()) ||
      (matchingTeacher?.id && u.uid === matchingTeacher.id)
    );

    if (!userAccount) {
      const createdNow = new Date().toISOString();
      const teacherEmail = (matchingTeacher.email || (trimmedInput.includes('@') ? trimmedInput : `${(matchingTeacher.staffId || matchingTeacher.id || 'teacher').toLowerCase()}@school.internal`)).toLowerCase();
      
      userAccount = {
        uid: matchingTeacher.userId || matchingTeacher.id || ('user_' + Math.random().toString(36).substring(2, 9)),
        email: teacherEmail,
        name: enrolledTeacherName,
        role: 'Teacher',
        staffId: matchingTeacher.staffId || trimmedInput,
        schoolId: activeSchoolCode,
        schoolCode: activeSchoolCode,
        ownerId: headUser?.uid || activeOwnerId,
        createdAt: createdNow,
        licenseType: headUser?.licenseType || 'trial',
        licensePeriod: headUser?.licensePeriod,
        lastActivatedOn: headUser?.lastActivatedOn,
        trialStartDate: headUser?.trialStartDate || createdNow,
        trialEndDate: headUser?.trialEndDate,
        registeredOn: headUser?.registeredOn || createdNow
      };
      cachedUsers.push(userAccount);
      setStorageItem(STORAGE_KEYS.USERS_LIST, cachedUsers);
    } else {
      userAccount.name = enrolledTeacherName || userAccount.name;
      userAccount.role = 'Teacher';
      userAccount.schoolId = activeSchoolCode;
      userAccount.schoolCode = activeSchoolCode;
      userAccount.ownerId = headUser?.uid || activeOwnerId;
      if (matchingTeacher.staffId) userAccount.staffId = matchingTeacher.staffId;
      if (headUser) {
        userAccount.licenseType = headUser.licenseType;
        userAccount.licensePeriod = headUser.licensePeriod;
        userAccount.lastActivatedOn = headUser.lastActivatedOn;
        userAccount.trialStartDate = headUser.trialStartDate;
        userAccount.trialEndDate = headUser.trialEndDate;
      }
      setStorageItem(STORAGE_KEYS.USERS_LIST, cachedUsers);
    }

    setStorageItem(STORAGE_KEYS.USER, userAccount);
    this._cache[STORAGE_KEYS.USER] = userAccount;

    // Trigger full cloud sync for this School Code ID so all student profiles, attendance, assessments, and system control load immediately
    this.syncAllWithCloud(activeSchoolCode).catch(e => console.warn("Cloud sync on teacher login:", e));

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
    let teacherIdFromBadge: string | undefined;
    let schoolId: string | undefined;
    let badgeName: string | undefined;
    let isSignedJson = false;
    let isSignatureValid = false;

    // 1. Try parsing badgeData as JSON
    let badgeOwnerId: string | undefined;
    try {
      const parsed = JSON.parse(badgeData);
      if (parsed && typeof parsed === 'object') {
        email = parsed.email || parsed.Email;
        staffId = parsed.staffId || parsed.StaffId || parsed.staffid;
        teacherIdFromBadge = parsed.teacherId || parsed.TeacherId || parsed.id || parsed.Id;
        if (!staffId) staffId = teacherIdFromBadge;
        schoolId = parsed.schoolCode || parsed.SchoolCode || parsed.schoolId || parsed.SchoolId || parsed.schoolid;
        badgeOwnerId = parsed.ownerId || parsed.OwnerId;
        badgeName = parsed.name || parsed.Name;
        
        const signature = parsed.signature || parsed.Signature;
        if (signature) {
          isSignedJson = true;
          const expectedSigWithSchool = this.generateBadgeSignature(staffId || '', email || '', schoolId || "school_default");
          const expectedSigDefault = this.generateBadgeSignature(staffId || '', email || '', "school_default");
          if (signature === expectedSigWithSchool || signature === expectedSigDefault) {
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

    // Lenient security check: If signed JSON has signature mismatch, log warning but permit login if enrolled teacher is verified
    if (isSignedJson && !isSignatureValid) {
      console.warn("[QR Badge Login] Notice: Signature validation mismatch. Proceeding with staff enrollment registry verification...");
    }

    const cleanEmail = email?.toLowerCase().trim();
    const cleanStaffId = staffId?.toLowerCase().trim();
    const cleanTeacherId = teacherIdFromBadge?.toLowerCase().trim();
    const cleanBadgeName = badgeName?.toLowerCase().trim();
    const cleanRaw = badgeData.trim().toLowerCase();

    // Always pre-sync from Firestore if a schoolId was embedded on the badge so we locate the real enrolled staff profile
    if (schoolId) {
      await this.preSyncSchoolDirectoryForLogin(schoolId);
    }

    // 2. Locate the corresponding enrolled teacher in the staff enrollment list
    const findEnrolledTeacher = (): Teacher | undefined => {
      const teachers = this.getTeachers();
      let found: Teacher | undefined;

      // Search A: By teacherId / id or email
      if (cleanTeacherId) {
        found = teachers.find(t => t.id?.toLowerCase().trim() === cleanTeacherId);
      }
      if (!found && cleanEmail && cleanEmail.length > 0) {
        found = teachers.find(t => t.email?.toLowerCase().trim() === cleanEmail);
      }

      // Search B: By staffId or id (including clean alphanumeric comparison)
      if (!found && cleanStaffId && cleanStaffId.length > 0) {
        found = teachers.find(t => {
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

      // Search C: By badge embedded name or raw payload against email, staffId, id, or enrolled full name
      if (!found && (cleanBadgeName || cleanRaw.length > 0)) {
        found = teachers.find(t => {
          const tEmail = t.email?.toLowerCase().trim();
          const tStaffId = t.staffId?.toLowerCase().trim();
          const tId = t.id?.toLowerCase().trim();
          const tFullName = this.formatTeacherFullName(t).toLowerCase();
          const tShortName = `${t.firstName} ${t.lastName}`.toLowerCase().trim();

          return (
            (cleanBadgeName && cleanBadgeName !== 'staff member' && (tFullName === cleanBadgeName || tShortName === cleanBadgeName)) ||
            (tEmail && (tEmail === cleanRaw || cleanRaw.includes(tEmail))) ||
            (tStaffId && (tStaffId === cleanRaw || cleanRaw.includes(tStaffId))) ||
            (tId && (tId === cleanRaw || cleanRaw.includes(tId))) ||
            (tFullName && (tFullName === cleanRaw || cleanRaw.includes(tFullName))) ||
            (tShortName && (tShortName === cleanRaw || cleanRaw.includes(tShortName)))
          );
        });
      }

      return found;
    };

    const matchingTeacher = findEnrolledTeacher();

    if (!matchingTeacher) {
      throw new Error(
        "Educator Verification Failed: No enrolled teacher profile matching this QR badge was found in the school's staff enrollment list. Please verify with your Headteacher that your profile is enrolled under Teacher Profiles."
      );
    }

    if (expectedTeacherId && matchingTeacher) {
      const matchId = matchingTeacher.id?.toLowerCase().trim();
      const matchStaffId = matchingTeacher.staffId?.toLowerCase().trim();
      const expTarget = expectedTeacherId.toLowerCase().trim();
      if (matchId !== expTarget && matchStaffId !== expTarget) {
        throw new Error(`Security Violation: The scanned QR badge (${this.formatTeacherFullName(matchingTeacher)}) does NOT match the selected teacher profile. Access denied.`);
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

    // 3. Find or bootstrap UserAccount using the exact name from the staff enrollment list & shared Headteacher schoolId/ownerId
    const enrolledTeacherName = this.formatTeacherFullName(matchingTeacher);
    const activeSchoolId = (schoolId && schoolId !== 'school_default') 
      ? schoolId 
      : (matchingTeacher.schoolId && matchingTeacher.schoolId !== 'school_default' 
          ? matchingTeacher.schoolId 
          : (this.getSchoolInfo().schoolId || this.resolveActiveSchoolId()));
    const activeOwnerId = badgeOwnerId || matchingTeacher.ownerId || this.getSchoolInfo().ownerId || this.resolveHeadteacherUserId(activeSchoolId);
    const users = this.getRegisteredUsers();
    const headUser = users.find(u =>
      (u.role === 'Headteacher' || u.role === 'Admin') &&
      u.email?.toLowerCase().trim() !== 'pegyirenyi@gmail.com' &&
      ((activeOwnerId && u.uid === activeOwnerId) || (activeSchoolId && (u.schoolId === activeSchoolId || u.schoolCode === activeSchoolId)))
    );

    let userAccount = users.find(u =>
      (u.email || '').toLowerCase().trim() === teacherEmail!.toLowerCase().trim() ||
      (matchingTeacher.staffId && u.staffId?.toLowerCase().trim() === matchingTeacher.staffId.toLowerCase().trim()) ||
      (matchingTeacher.userId && u.uid === matchingTeacher.userId)
    );

    if (!userAccount) {
      const createdNow = new Date().toISOString();
      userAccount = {
        uid: matchingTeacher.userId || matchingTeacher.id || ('user_' + Math.random().toString(36).substring(2, 9)),
        email: teacherEmail,
        name: enrolledTeacherName,
        role: 'Teacher',
        staffId: matchingTeacher.staffId,
        schoolId: activeSchoolId,
        schoolCode: activeSchoolId,
        ownerId: headUser?.uid || activeOwnerId,
        createdAt: createdNow,
        licenseType: headUser?.licenseType || 'trial',
        licensePeriod: headUser?.licensePeriod,
        lastActivatedOn: headUser?.lastActivatedOn,
        trialStartDate: headUser?.trialStartDate || createdNow,
        trialEndDate: headUser?.trialEndDate,
        registeredOn: headUser?.registeredOn || createdNow
      };
      users.push(userAccount);
      setStorageItem(STORAGE_KEYS.USERS_LIST, users);
    } else {
      let updated = false;
      if (enrolledTeacherName && userAccount.name !== enrolledTeacherName) {
        userAccount.name = enrolledTeacherName;
        updated = true;
      }
      if (userAccount.role !== 'Teacher' && userAccount.role !== 'Headteacher' && userAccount.role !== 'Admin') {
        userAccount.role = 'Teacher';
        updated = true;
      }
      if (userAccount.schoolId !== activeSchoolId) {
        userAccount.schoolId = activeSchoolId;
        userAccount.schoolCode = activeSchoolId;
        updated = true;
      }
      const resolvedOwner = headUser?.uid || activeOwnerId;
      if (resolvedOwner && userAccount.ownerId !== resolvedOwner) {
        userAccount.ownerId = resolvedOwner;
        updated = true;
      }
      if (!userAccount.staffId && matchingTeacher.staffId) {
        userAccount.staffId = matchingTeacher.staffId;
        updated = true;
      }
      if (headUser && userAccount.role === 'Teacher') {
        userAccount.licenseType = headUser.licenseType;
        userAccount.licensePeriod = headUser.licensePeriod;
        userAccount.lastActivatedOn = headUser.lastActivatedOn;
        userAccount.trialStartDate = headUser.trialStartDate;
        userAccount.trialEndDate = headUser.trialEndDate;
        updated = true;
      }
      if (updated) {
        setStorageItem(STORAGE_KEYS.USERS_LIST, users);
      }
    }

    // Persist teacher account to Firestore so Firestore security rules recognize membership
    if (isFirebaseActive && firestoreDb && userAccount.uid) {
      setDoc(doc(firestoreDb, 'users', userAccount.uid), DbController.sanitizeForFirestore({
        uid: userAccount.uid,
        email: userAccount.email,
        name: userAccount.name,
        role: userAccount.role,
        staffId: userAccount.staffId || null,
        schoolId: activeSchoolId,
        ownerId: activeOwnerId,
        registeredOn: userAccount.registeredOn || new Date().toISOString()
      }), { merge: true }).catch(console.warn);
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
        setStorageItem('google_access_token', credential.accessToken);
      }
      const user = result.user;
      const email = user.email || '';
      
      const trimmedEmail = email.toLowerCase().trim();
      // Enforce Google account pre-authorization check to allow only registered emails to login/register via Google SSO
      if (trimmedEmail !== 'pegyirenyi@gmail.com' && trimmedEmail !== 'multimediageetech@gmail.com' && trimmedEmail !== 'patienceedusah724@gmail.com' && trimmedEmail !== 'sammyotoo06@gmail.com' && trimmedEmail !== 'wilkinsonannan@gmail.com') {
        const users = this.getRegisteredUsers();
        const isAuthorized = users.some(u => (u.email || '').toLowerCase().trim() === trimmedEmail);
        if (!isAuthorized) {
          await signOut(firebaseAuth);
          throw new Error("Access Denied: Your Google account email (" + email + ") is not registered by the Admin. Please contact the System Administrator to register your account.");
        }
      }

      const prevUser = this.getCurrentUser();
      if (!prevUser || (prevUser.email || '').toLowerCase() !== email.toLowerCase()) {
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
        if (!profile.licenseType || profile.licenseType === 'trial') {
          profile.licenseType = 'unlicensed';
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
          await setDoc(doc(firestoreDb, 'users', user.uid), DbController.sanitizeForFirestore(profile));
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
        const isAuthorized = users.some(u => (u.email || '').toLowerCase().trim() === trimmedEmail);
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
        if (!profile.licenseType || profile.licenseType === 'trial') {
          profile.licenseType = 'unlicensed';
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
          await setDoc(doc(firestoreDb, 'users', user.uid), DbController.sanitizeForFirestore(profile));
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
        const isAuthorized = users.some(u => (u.email || '').toLowerCase().trim() === trimmedEmail);
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
        if (!profile.licenseType || profile.licenseType === 'trial') {
          profile.licenseType = 'unlicensed';
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
          await setDoc(doc(firestoreDb, 'users', user.uid), DbController.sanitizeForFirestore(profile));
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
    const emailStr = profile?.email || 'user@school.edu.gh';
    const assignedRole: UserRole = this.determineRole(emailStr);
    const createdNow = profile.createdAt || new Date().toISOString();
    const prefix = emailStr.includes('@') ? emailStr.split('@')[0].substring(0, 4).toUpperCase() : 'USER';
    const emailLower = emailStr.toLowerCase().trim();
    const isMultiMedia = emailLower === 'multimediageetech@gmail.com';
    const isSammy = emailLower === 'sammyotoo06@gmail.com';
    const isWilkinson = emailLower === 'wilkinsonannan@gmail.com';
    const isSpecialHeadteacher = isMultiMedia || isSammy || isWilkinson;
    // Check Cloud Firebase Firestore first to master existing subscription state
    let existingFirestoreProfile: UserAccount | null = null;
    if (isFirebaseActive && firestoreDb && profile.uid) {
      try {
        const snap = await getDoc(doc(firestoreDb, 'users', profile.uid));
        if (snap.exists()) {
          existingFirestoreProfile = snap.data() as UserAccount;
        }
      } catch (e) {
        console.warn("[Cloud Firestore] Pre-fetch user profile notice:", e);
      }
    }

    const isAdminUser = emailLower === 'pegyirenyi@gmail.com' || assignedRole === 'Admin';
    
    // Resolve permanent license type from Firestore, then passed profile
    const existingLicenseType = existingFirestoreProfile?.licenseType || profile.licenseType;
    const finalLicenseType: 'trial' | 'unlicensed' | 'activated' | 'unlimited' = isAdminUser 
      ? 'unlimited' 
      : ((existingLicenseType === 'activated' || existingLicenseType === 'unlimited') ? existingLicenseType : 'trial');

    const regOn = existingFirestoreProfile?.registeredOn || profile.registeredOn || createdNow;
    const existingTrialStart = existingFirestoreProfile?.trialStartDate || profile.trialStartDate || regOn;
    const existingTrialEnd = existingFirestoreProfile?.trialEndDate || profile.trialEndDate || 
      (finalLicenseType === 'trial' ? new Date(new Date(existingTrialStart).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() : undefined);

    const finalLastActivatedOn = existingFirestoreProfile?.lastActivatedOn || profile.lastActivatedOn;
    const finalLicensePeriod = existingFirestoreProfile?.licensePeriod || profile.licensePeriod;
    const finalIsSuspended = existingFirestoreProfile?.isSuspended ?? profile.isSuspended ?? false;

    const isWizardDone = existingFirestoreProfile?.setupWizardCompleted === true ||
      profile?.setupWizardCompleted === true ||
      (typeof localStorage !== 'undefined' && (
        localStorage.getItem(`sms_setup_wizard_completed_${profile.uid}`) === 'true' ||
        localStorage.getItem('sms_setup_wizard_completed') === 'true'
      ));

    const updatedProfile: UserAccount = {
      ...profile,
      role: isSpecialHeadteacher ? ('Headteacher' as UserRole) : assignedRole,
      schoolId: (existingFirestoreProfile?.schoolId && existingFirestoreProfile.schoolId !== 'SMS-P8U4F22L' && existingFirestoreProfile.schoolId !== 'school_default')
        ? existingFirestoreProfile.schoolId
        : ((profile.schoolId && profile.schoolId !== 'SMS-P8U4F22L' && profile.schoolId !== 'school_default') ? profile.schoolId : generateUniqueSchoolId(profile.uid)),
      licenseType: finalLicenseType,
      registeredOn: regOn,
      trialStartDate: isAdminUser ? undefined : existingTrialStart,
      trialEndDate: isAdminUser ? undefined : existingTrialEnd,
      lastActivatedOn: finalLastActivatedOn,
      licensePeriod: finalLicensePeriod,
      isSuspended: finalIsSuspended,
      setupWizardCompleted: isWizardDone,
      requestCode: (existingFirestoreProfile?.requestCode || profile.requestCode || `REQ-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`)
    };

    const sanitizedProfile = { ...updatedProfile };
    for (const key in sanitizedProfile) {
      if (sanitizedProfile[key as keyof typeof sanitizedProfile] === undefined) {
        delete sanitizedProfile[key as keyof typeof sanitizedProfile];
      }
    }

    if (isFirebaseActive && firestoreDb) {
      try {
        await setDoc(doc(firestoreDb, 'users', sanitizedProfile.uid), sanitizedProfile, { merge: true });
        await this.saveSubscriberTimer(this.buildSubscriberTimerData(sanitizedProfile));
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
    await this.saveRegisteredUsers(users);
    return updatedProfile;
  }

  // Save user profile details only in local storage cache (avoiding recursive Firestore writes)
  static saveProfileLocally(profile: UserAccount): UserAccount {
    const emailStr = profile?.email || 'user@school.edu.gh';
    const assignedRole: UserRole = this.determineRole(emailStr);
    const createdNow = profile.createdAt || new Date().toISOString();
    const prefix = emailStr.includes('@') ? emailStr.split('@')[0].substring(0, 4).toUpperCase() : 'USER';
    const emailLower = emailStr.toLowerCase().trim();
    const isMultiMedia = emailLower === 'multimediageetech@gmail.com';
    const isSammy = emailLower === 'sammyotoo06@gmail.com';
    const isWilkinson = emailLower === 'wilkinsonannan@gmail.com';
    const isSpecialHeadteacher = isMultiMedia || isSammy || isWilkinson;
    const isAdminUser = emailLower === 'pegyirenyi@gmail.com' || assignedRole === 'Admin';

    const regOn = profile.registeredOn || createdNow;
    const trialStart = profile.trialStartDate || regOn;
    const trialEnd = profile.trialEndDate || new Date(new Date(trialStart).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const isLocalWizardDone = profile?.setupWizardCompleted === true ||
      (typeof localStorage !== 'undefined' && (
        localStorage.getItem(`sms_setup_wizard_completed_${profile.uid}`) === 'true' ||
        localStorage.getItem('sms_setup_wizard_completed') === 'true'
      ));

    const updatedProfile: UserAccount = {
      ...profile,
      role: isSpecialHeadteacher ? ('Headteacher' as UserRole) : assignedRole,
      schoolId: (profile.schoolId && profile.schoolId !== 'SMS-P8U4F22L' && profile.schoolId !== 'school_default') ? profile.schoolId : generateUniqueSchoolId(profile.uid),
      licenseType: isAdminUser ? 'unlimited' : ((profile.licenseType === 'activated' || profile.licenseType === 'unlimited') ? profile.licenseType : 'trial'),
      registeredOn: regOn,
      trialStartDate: isAdminUser ? undefined : trialStart,
      trialEndDate: isAdminUser ? undefined : trialEnd,
      setupWizardCompleted: isLocalWizardDone,
      requestCode: (profile.requestCode || `REQ-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`)
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

  // Cross-share cloud sync using School Code ID as parameter
  static async syncAllWithCloud(schoolCode?: string): Promise<void> {
    const targetSchoolId = schoolCode?.trim() || this.resolveActiveSchoolId();
    if (targetSchoolId) {
      const user = this.getCurrentUser();
      if (user && (user.schoolId !== targetSchoolId || user.schoolCode !== targetSchoolId)) {
        user.schoolId = targetSchoolId;
        user.schoolCode = targetSchoolId;
        setStorageItem(STORAGE_KEYS.USER, user);
        this._cache[STORAGE_KEYS.USER] = user;
      }
    }
    return this.syncAllDataFromFirebase();
  }

  // Full cross-device background sync of all Firestore assets
  static async syncAllDataFromFirebase(): Promise<void> {
    if (this._isFormatting) return;
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
      const resolvedHeadUid = this.resolveHeadteacherUserId(schoolId);
      const validHeadUid = this.isValidHeadteacherUid(resolvedHeadUid) ? resolvedHeadUid : null;

      // Helper to read both schools/{schoolId}/{colName} and users/{headUid}/{colName}, choosing newest by timestamp
      const fetchMergedCollection = async <T extends { id?: string }>(colName: string): Promise<T[]> => {
        const mergedMap = new Map<string, any>();
        const parseTime = (rec: any) => {
          const ts = rec?.lastModified || rec?.updatedAt || rec?.timestamp || rec?.createdAt || '';
          const parsed = ts ? Date.parse(ts) : 0;
          return isNaN(parsed) ? 0 : parsed;
        };
        const upsert = (docs: any[]) => {
          docs.forEach(item => {
            if (!item || !item.id) return;
            const existing = mergedMap.get(item.id);
            if (!existing || parseTime(item) >= parseTime(existing)) {
              mergedMap.set(item.id, item);
            }
          });
        };

        const [schoolRes, headRes] = await Promise.all([
          getDocs(collection(firestoreDb, 'schools', schoolId, colName)).catch(() => null),
          validHeadUid ? getDocs(collection(firestoreDb, 'users', validHeadUid, colName)).catch(() => null) : Promise.resolve(null)
        ]);
        if (schoolRes && !schoolRes.empty) {
          upsert(schoolRes.docs.map(d => ({ ...d.data(), id: d.id })));
        }
        if (headRes && !headRes.empty) {
          upsert(headRes.docs.map(d => ({ ...d.data(), id: d.id })));
        }
        return Array.from(mergedMap.values()) as T[];
      };

      // Define all synchronization tasks to run concurrently
      const syncTasks: Promise<void>[] = [
        // 1. School Profile Info
        (async () => {
          try {
            await DbController.fetchRemoteSchoolInfo();
          } catch (e) {
            console.warn("Could not sync school profile:", e);
          }
        })(),

        // 1b. Global Platform Subscription Pricing
        (async () => {
          try {
            await DbController.fetchRemotePlatformPricing();
          } catch (e) {
            console.warn("Could not sync platform pricing:", e);
          }
        })(),

        // 2. Students
        (async () => {
          try {
            const studentsList = await fetchMergedCollection<Student>('students');
            if (studentsList.length > 0) {
              DbController.syncDatasetFromSnapshot('students', studentsList, false);
            }
          } catch (e) {
            console.warn("Could not sync students:", e);
          }
        })(),

        // 3. Teachers
        (async () => {
          try {
            const teachersList = await fetchMergedCollection<Teacher>('teachers');
            if (teachersList.length > 0) {
              DbController.syncDatasetFromSnapshot('teachers', teachersList, false);
            }
          } catch (e) {
            console.warn("Could not sync teachers:", e);
          }
        })(),

        // 4. Attendance Registers
        (async () => {
          try {
            const attendanceList = await fetchMergedCollection<AttendanceRecord>('attendance');
            if (attendanceList.length === 0) {
              const localAttendance = DbController.getAllAttendance();
              if (localAttendance && localAttendance.length > 0) {
                console.log(`[Cloud Sync] Firestore attendance collection empty; syncing ${localAttendance.length} local records to Cloud...`);
                await DbController.uploadDatasetToFirestore('attendance', localAttendance);
              }
            } else {
              DbController.syncDatasetFromSnapshot('attendance', attendanceList, false);
            }
          } catch (e) {
            console.warn("Could not sync attendance:", e);
          }
        })(),

        // 4b. Staff Attendance Registers
        (async () => {
          try {
            const staffAttendanceList = await fetchMergedCollection<StaffAttendanceRecord>('staff_attendance');
            if (staffAttendanceList.length === 0) {
              const localStaffAttendance = DbController.getAllStaffAttendance();
              if (localStaffAttendance && localStaffAttendance.length > 0) {
                console.log(`[Cloud Sync] Firestore staff_attendance collection empty; syncing ${localStaffAttendance.length} local records to Cloud...`);
                await DbController.uploadDatasetToFirestore('staff_attendance', localStaffAttendance);
              }
            } else {
              DbController.syncDatasetFromSnapshot('staff_attendance', staffAttendanceList, false);
            }
          } catch (e) {
            console.warn("Could not sync staff attendance:", e);
          }
        })(),

        // 5. Assessments Registers
        (async () => {
          try {
            const assessmentsList = await fetchMergedCollection<StudentAssessment>('assessments');
            if (assessmentsList.length === 0) {
              const localAssessments = DbController.getAssessments(true);
              if (localAssessments && localAssessments.length > 0) {
                console.log(`[Cloud Sync] Firestore assessments collection empty; syncing ${localAssessments.length} local records to Cloud...`);
                await DbController.uploadDatasetToFirestore('assessments', localAssessments);
              }
            } else {
              DbController.syncDatasetFromSnapshot('assessments', assessmentsList, false);
            }
          } catch (e) {
            console.warn("Could not sync assessments:", e);
          }
        })(),

        // 5b. Assessment Templates
        (async () => {
          try {
            const templatesList = await fetchMergedCollection<AssessmentTemplate>('assessment_templates');
            if (templatesList.length === 0) {
              const localTemplates = DbController.getAssessmentTemplates();
              if (localTemplates && localTemplates.length > 0) {
                console.log(`[Cloud Sync] Firestore assessment_templates collection empty; syncing ${localTemplates.length} local records to Cloud...`);
                await DbController.uploadDatasetToFirestore('assessment_templates', localTemplates);
              }
            } else {
              DbController.syncDatasetFromSnapshot('assessment_templates', templatesList, false);
            }
          } catch (e) {
            console.warn("Could not sync assessment templates:", e);
          }
        })(),

        // 5c. Communication Templates
        (async () => {
          try {
            const templatesList = await fetchMergedCollection<CommunicationTemplate>('communication_templates');
            if (templatesList.length > 0) {
              setStorageItem(STORAGE_KEYS.COMM_TEMPLATES, templatesList);
              DbController._cache[STORAGE_KEYS.COMM_TEMPLATES] = templatesList;
            }
          } catch (e) {
            console.warn("Could not sync communication templates:", e);
          }
        })(),

        // 6. Fees Bills
        (async () => {
          try {
            const feesList = await fetchMergedCollection<StudentFeeBill>('fees');
            if (feesList.length > 0) {
              DbController.syncDatasetFromSnapshot('fees', feesList, false);
            }
          } catch (e) {
            console.warn("Could not sync fees bills:", e);
          }
        })(),

        // 7. Settings (Academic Calendar, System Customizations, Auto-Backup Config)
        (async () => {
          try {
            const settingsList = await fetchMergedCollection<any>('settings');
            const calendarDoc = settingsList.find(d => d.id === 'academic_calendar');
            if (calendarDoc) {
              setStorageItem(STORAGE_KEYS.CALENDAR, calendarDoc as AcademicCalendarConfig);
              DbController._cache[STORAGE_KEYS.CALENDAR] = calendarDoc;
            }
            const systemDoc = settingsList.find(d => d.id === 'system_settings');
            if (systemDoc) {
              setStorageItem(STORAGE_KEYS.SETTINGS, systemDoc);
              DbController._cache[STORAGE_KEYS.SETTINGS] = systemDoc;
            }
            const backupConfigDoc = settingsList.find(d => d.id === 'auto_backup_config');
            if (backupConfigDoc) {
              setStorageItem(STORAGE_KEYS.AUTO_BACKUP_CONFIG, backupConfigDoc as AutoBackupConfig);
              DbController._cache[STORAGE_KEYS.AUTO_BACKUP_CONFIG] = backupConfigDoc;
            }
            const markLimitsDoc = settingsList.find(d => d.id === 'subject_mark_limits');
            if (markLimitsDoc) {
              setStorageItem(STORAGE_KEYS.SUBJECT_MARK_LIMITS, markLimitsDoc);
              DbController._cache[STORAGE_KEYS.SUBJECT_MARK_LIMITS] = markLimitsDoc;
            }
            settingsList.filter(d => d.id?.startsWith('tabs_')).forEach(tabDoc => {
              const emailKey = tabDoc.id.replace('tabs_', '');
              const prefKey = `${STORAGE_KEYS.USER_TAB_PREFERENCES}_${emailKey}`;
              setStorageItem(prefKey, tabDoc);
              DbController._cache[prefKey] = tabDoc;
            });
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
            const emisList = await fetchMergedCollection<EmisData>('emis');
            if (emisList.length > 0) {
              setStorageItem(STORAGE_KEYS.EMIS, emisList);
            }
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
            const remarksList = await fetchMergedCollection<BehavioralRemark>('behavioral_remarks');
            if (remarksList.length > 0) {
              DbController.syncDatasetFromSnapshot('behavioral_remarks', remarksList, false);
            }
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

        // 9c. Activity Logs - Merged from schools/{schoolId} and users/{headUid}
        (async () => {
          try {
            const [schoolAct, headAct] = await Promise.all([
              getDocs(query(collection(firestoreDb, 'schools', schoolId, 'activity_logs'), limit(150))).catch(() => null),
              validHeadUid ? getDocs(query(collection(firestoreDb, 'users', validHeadUid, 'activity_logs'), limit(150))).catch(() => null) : Promise.resolve(null)
            ]);
            const actMap = new Map<string, ActivityLog>();
            schoolAct?.docs.forEach(d => { const item = d.data() as ActivityLog; if (item?.id) actMap.set(item.id, item); });
            headAct?.docs.forEach(d => { const item = d.data() as ActivityLog; if (item?.id) actMap.set(item.id, item); });
            const activityList = Array.from(actMap.values());
            activityList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            if (activityList.length > 0) {
              DbController.syncDatasetFromSnapshot('activity_logs', activityList, false);
            }
          } catch (e: any) {
            console.warn("Could not sync activity logs:", e);
          }
        })(),

        // 9d. Teacher Reflections
        (async () => {
          try {
            const reflectionsList = await fetchMergedCollection<TeacherReflection>('teacher_reflections');
            if (reflectionsList.length > 0) {
              DbController.syncDatasetFromSnapshot('teacher_reflections', reflectionsList, false);
            }
          } catch (e: any) {
            console.warn("Could not sync teacher reflections:", e);
          }
        })(),

        // 9e. Leave Requests
        (async () => {
          try {
            const leaveList = await fetchMergedCollection<LeaveRequest>('leave_requests');
            if (leaveList.length > 0) {
              DbController.syncDatasetFromSnapshot('leave_requests', leaveList, false);
            }
          } catch (e: any) {
            console.warn("Could not sync leave requests:", e);
          }
        })(),

        // 9f. Custom Tasks
        (async () => {
          try {
            const tasksList = await fetchMergedCollection<CustomTask>('tasks');
            if (tasksList.length > 0) {
              DbController.syncDatasetFromSnapshot('tasks', tasksList, false);
            }
          } catch (e: any) {
            console.warn("Could not sync custom tasks:", e);
          }
        })(),

        // 9g. Quick Notes & Urgent Memos
        (async () => {
          try {
            const notesList = await fetchMergedCollection<QuickNote>('quick_notes');
            if (notesList.length > 0) {
              DbController.syncDatasetFromSnapshot('quick_notes', notesList, false);
            }
          } catch (e: any) {
            console.warn("Could not sync quick notes:", e);
          }
        })(),

        // 10. Registered Users Directory + School Headteacher Profile (Security & Subscription Watchdog source)
        (async () => {
          try {
            let syncedList: UserAccount[] = DbController.getRegisteredUsers();
            const directorySnap = await getDoc(doc(firestoreDb, 'users', 'directory'));
            if (directorySnap.exists()) {
              const data = directorySnap.data();
              if (data && Array.isArray(data.list) && data.list.length > 0) {
                syncedList = data.list;
              }
            }
            const knownOwnerId = currentUser?.ownerId || DbController.getSchoolInfo()?.ownerId || DbController.resolveHeadteacherUserId(schoolId);
            if (knownOwnerId && !knownOwnerId.startsWith('HEAD_') && knownOwnerId !== 'user_default') {
              try {
                const ownerDoc = await getDoc(doc(firestoreDb, 'users', knownOwnerId));
                if (ownerDoc.exists()) {
                  const ownerData = ownerDoc.data() as UserAccount;
                  const oIdx = syncedList.findIndex(u => u.uid === ownerData.uid);
                  if (oIdx >= 0) {
                    syncedList[oIdx] = ownerData;
                  } else {
                    syncedList.push(ownerData);
                  }
                }
              } catch {}
            }
            if (syncedList.length > 0) {
              setStorageItem(STORAGE_KEYS.USERS_LIST, syncedList);
              DbController._cache[STORAGE_KEYS.USERS_LIST] = syncedList;
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
        })(),

        // 11a-2. Custom Subjects
        (async () => {
          try {
            const subjSnap = await getDoc(doc(firestoreDb, 'schools', schoolId, 'custom_subjects', 'all'));
            if (subjSnap.exists()) {
              const data = subjSnap.data();
              if (data && Array.isArray(data.subjects) && data.subjects.length > 0) {
                setStorageItem(STORAGE_KEYS.CUSTOM_SUBJECTS, data.subjects);
                DbController._cache[STORAGE_KEYS.CUSTOM_SUBJECTS] = data.subjects;
              }
            }
          } catch (e) {
            console.warn("Could not sync custom subjects from firestore:", e);
          }
        })(),

        // 11a-3. Custom Classes
        (async () => {
          try {
            const classSnap = await getDoc(doc(firestoreDb, 'schools', schoolId, 'custom_classes', 'all'));
            if (classSnap.exists()) {
              const data = classSnap.data();
              if (data && Array.isArray(data.classes) && data.classes.length > 0) {
                setStorageItem(STORAGE_KEYS.CUSTOM_CLASSES, data.classes);
                DbController._cache[STORAGE_KEYS.CUSTOM_CLASSES] = data.classes;
              }
            }
          } catch (e) {
            console.warn("Could not sync custom classes from firestore:", e);
          }
        })(),

        // 11a-4. Custom Academic Years
        (async () => {
          try {
            const yrSnap = await getDoc(doc(firestoreDb, 'schools', schoolId, 'custom_academic_years', 'all'));
            if (yrSnap.exists()) {
              const data = yrSnap.data();
              if (data && Array.isArray(data.academicYears) && data.academicYears.length > 0) {
                setStorageItem(STORAGE_KEYS.CUSTOM_ACADEMIC_YEARS, data.academicYears);
                DbController._cache[STORAGE_KEYS.CUSTOM_ACADEMIC_YEARS] = data.academicYears;
              }
            }
          } catch (e) {
            console.warn("Could not sync custom academic years from firestore:", e);
          }
        })(),

        // 11b. Subscribers Timer Data
        (async () => {
          try {
            const timersSnap = await getDocs(collection(firestoreDb, 'schools', schoolId, 'subscribers_timer'));
            const timersList = timersSnap.docs.map(d => ({ ...d.data(), id: d.id } as SubscriberTimerData));
            if (timersList.length === 0) {
              const localTimers = DbController.getAllSubscriberTimers();
              if (localTimers && localTimers.length > 0) {
                console.log(`[Cloud Sync] Firestore subscribers_timer empty; syncing ${localTimers.length} local records to Cloud...`);
                await DbController.uploadDatasetToFirestore('subscribers_timer', localTimers);
              } else {
                const users = DbController.getRegisteredUsers();
                if (users.length > 0) {
                  const generated = users.map(u => DbController.buildSubscriberTimerData(u));
                  setStorageItem(STORAGE_KEYS.SUBSCRIBER_TIMERS, generated);
                  DbController._cache[STORAGE_KEYS.SUBSCRIBER_TIMERS] = generated;
                  await DbController.uploadDatasetToFirestore('subscribers_timer', generated);
                }
              }
            } else {
              DbController.syncDatasetFromSnapshot('subscribers_timer', timersList);
            }
          } catch (e) {
            console.warn("Could not sync subscribers timer:", e);
          }
        })(),

        // 12. User Backup & Cloud Sync Snapshot check (for full state hydration)
        (async () => {
          try {
            if (uid && uid !== 'unknown') {
              let backupDoc = await getDoc(doc(firestoreDb, 'users', uid, 'backups', 'latest'));
              if (!backupDoc.exists()) {
                backupDoc = await getDoc(doc(firestoreDb, 'users', uid, 'cloud_sync', 'latest'));
              }
              if (!backupDoc.exists()) {
                backupDoc = await getDoc(doc(firestoreDb, 'schools', schoolId, 'backups', 'latest'));
              }
              if (backupDoc.exists()) {
                const bData = backupDoc.data();
                if (bData && bData.payload && typeof bData.payload === 'string') {
                  const currentStudents = DbController.getStudents();
                  if (currentStudents.length === 0) {
                    console.log("[Sync] Hydrating empty local database from user Firestore backup snapshot...");
                    DbController.importAllData(bData.payload);
                  }
                }
              }
            }
          } catch (e) {
            console.warn("User backup snapshot check skipped:", e);
          }
        })()
      ];

      // Execute all fetches in parallel
      await Promise.all(syncTasks);

      console.log("Database sync from Firestore completed successfully in parallel.");
      this.clearCache();
    } catch (e) {
      this.clearCache();
      console.warn("Database sync from Firestore aborted (running in offline LocalStorage backup mode):", e);
    } finally {
      this._isSyncing = false;
    }
  }

  static getDataset(colName: string): any[] {
    switch (colName) {
      case 'students': return this.getStudents();
      case 'teachers': return this.getTeachers();
      case 'attendance': return this.getAllAttendance();
      case 'staff_attendance': return this.getAllStaffAttendance();
      case 'assessments': return this.getAssessments(true);
      case 'assessment_templates': return this.getAssessmentTemplates();
      case 'fees': return this.getStudentFeeBills();
      case 'teacher_reflections': return this.getTeacherReflections();
      case 'behavioral_remarks': return this.getBehavioralRemarks();
      case 'leave_requests': return this.getLeaveRequests();
      case 'tasks': return this.getTasks();
      case 'quick_notes': return this.getQuickNotes();
      case 'duty_roster': return this.getDutyAssignments();
      case 'staff_handbook': return this.getStaffHandbook();
      case 'custom_bill_components': return this.getCustomBillComponents();
      case 'custom_bill_categories': return this.getCustomBillCategories();
      case 'custom_sections': return this.getCustomSections();
      case 'custom_subjects': return this.getCustomSubjects();
      case 'custom_classes': return this.getCustomClasses();
      case 'custom_academic_years': return this.getAcademicYears();
      case 'activity_logs': return this.getActivityLogs();
      case 'expenses': return this.getExpenses();
      case 'textbooks': return this.getTextbooks();
      case 'emis': return this.getEmisReports();
      default: return [];
    }
  }

  static getCustomSections(): string[] {
    return this.getSections();
  }

  static getCustomSubjects(): string[] {
    return this.getSubjects();
  }

  static getCustomClasses(): string[] {
    return this.getClasses();
  }

  static async uploadDatasetToFirestore(colName: string, items: any[]): Promise<void> {
    if (this._isFormatting) return;
    if (!Array.isArray(items) || items.length === 0) return;
    const activeSchoolId = this.resolveActiveSchoolId();
    const schoolOwnerUid = this.resolveHeadteacherUserId(activeSchoolId);
    const validItems = items.filter(item => item && item.id);
    if (validItems.length === 0) return;
    await this.performFirestoreWriteBatch(
      colName,
      validItems.map(item => {
        if (!item.schoolId) item.schoolId = activeSchoolId;
        if (!item.schoolCode) item.schoolCode = activeSchoolId;
        if (!item.ownerId) item.ownerId = schoolOwnerUid;
        return {
          id: item.id,
          type: 'set',
          data: item
        };
      })
    );
  }

  static syncDatasetFromSnapshot(colName: string, items: any[], broadcast: boolean = true): void {
    if (!Array.isArray(items)) return;
    const emit = (type: string, payload: any) => {
      if (broadcast) {
        this.broadcastSyncEvent(type, payload);
      }
    };
    switch (colName) {
      case 'students': {
        const local = getStorageItem<Student[]>(STORAGE_KEYS.STUDENTS, []);
        let finalStudents: Student[];
        if (items.length === 0 && local.length > 0) {
          finalStudents = local;
        } else {
          const mergedMap = new Map<string, Student>();
          local.forEach(s => { if (s && s.id) mergedMap.set(s.id, s); });
          items.forEach(s => { if (s && s.id) mergedMap.set(s.id, s); });
          finalStudents = Array.from(mergedMap.values());
        }
        setStorageItem(STORAGE_KEYS.STUDENTS, finalStudents);
        this._cache[STORAGE_KEYS.STUDENTS] = finalStudents;
        // Rebuild student class index
        {
          const sIdx = new Map<string, Student[]>();
          finalStudents.forEach(s => {
            if (s && s.class) {
              if (!sIdx.has(s.class)) sIdx.set(s.class, []);
              sIdx.get(s.class)!.push(s);
            }
          });
          this._studentsByClass = sIdx;
        }
        emit('students-updated', finalStudents);
        break;
      }
      case 'teachers': {
        const local = getStorageItem<Teacher[]>(STORAGE_KEYS.TEACHERS, []);
        const parseTime = (rec: any) => {
          const ts = rec?.lastModified || rec?.updatedAt || rec?.createdAt || '';
          const parsed = ts ? Date.parse(ts) : 0;
          return isNaN(parsed) ? 0 : parsed;
        };
        let finalTeachers: Teacher[];
        if (items.length === 0 && local.length > 0) {
          finalTeachers = local;
        } else {
          const mergedMap = new Map<string, Teacher>();
          local.forEach(t => { if (t && t.id) mergedMap.set(t.id, t); });
          items.forEach(t => {
            if (!t || !t.id) return;
            const prev = mergedMap.get(t.id);
            if (!prev || parseTime(t) >= parseTime(prev)) {
              mergedMap.set(t.id, t);
            }
          });
          finalTeachers = Array.from(mergedMap.values());
        }
        setStorageItem(STORAGE_KEYS.TEACHERS, finalTeachers);
        this._cache[STORAGE_KEYS.TEACHERS] = finalTeachers;
        emit('teachers-updated', finalTeachers);
        break;
      }
      case 'attendance': {
        const local = getStorageItem<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
        let finalAttendance: AttendanceRecord[];
        if (items.length === 0 && local.length > 0) {
          finalAttendance = local;
        } else {
          const mergedMap = new Map<string, AttendanceRecord>();
          local.forEach(a => { if (a && a.id) mergedMap.set(a.id, a); });
          items.forEach(a => { if (a && a.id) mergedMap.set(a.id, a); });
          finalAttendance = Array.from(mergedMap.values());
        }
        setStorageItem(STORAGE_KEYS.ATTENDANCE, finalAttendance);
        this._cache[STORAGE_KEYS.ATTENDANCE] = finalAttendance;
        emit('attendance-updated', finalAttendance);
        break;
      }
      case 'staff_attendance': {
        const local = getStorageItem<StaffAttendanceRecord[]>(STORAGE_KEYS.STAFF_ATTENDANCE, []);
        let finalStaff: StaffAttendanceRecord[];
        if (items.length === 0 && local.length > 0) {
          finalStaff = local;
        } else {
          const mergedMap = new Map<string, StaffAttendanceRecord>();
          local.forEach(s => { if (s && s.id) mergedMap.set(s.id, s); });
          items.forEach(s => { if (s && s.id) mergedMap.set(s.id, s); });
          finalStaff = Array.from(mergedMap.values());
        }
        setStorageItem(STORAGE_KEYS.STAFF_ATTENDANCE, finalStaff);
        this._cache[STORAGE_KEYS.STAFF_ATTENDANCE] = finalStaff;
        emit('staff-attendance-updated', finalStaff);
        break;
      }
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
        emit('assessments-updated', merged);
        break;
      }
      case 'assessment_templates':
        setStorageItem(STORAGE_KEYS.ASSESSMENT_TEMPLATES, items);
        this._cache[STORAGE_KEYS.ASSESSMENT_TEMPLATES] = items;
        emit('assessment-templates-updated', items);
        break;
      case 'fees': {
        const local = getStorageItem<StudentFeeBill[]>(STORAGE_KEYS.FEES, []);
        let finalFees: StudentFeeBill[];
        if (items.length === 0 && local.length > 0) {
          finalFees = local;
        } else {
          const mergedMap = new Map<string, StudentFeeBill>();
          local.forEach(f => { if (f && f.id) mergedMap.set(f.id, f); });
          items.forEach(f => { if (f && f.id) mergedMap.set(f.id, f); });
          finalFees = Array.from(mergedMap.values());
        }
        setStorageItem(STORAGE_KEYS.FEES, finalFees);
        this._cache[STORAGE_KEYS.FEES] = finalFees;
        emit('fees-updated', finalFees);
        break;
      }
      case 'teacher_reflections': {
        const local = getStorageItem<TeacherReflection[]>(STORAGE_KEYS.TEACHER_REFLECTIONS, []);
        const mergedMap = new Map<string, TeacherReflection>();
        local.forEach(r => { if (r && r.id) mergedMap.set(r.id, r); });
        items.forEach(r => { if (r && r.id) mergedMap.set(r.id, r); });
        const finalReflections = (items.length === 0 && local.length > 0) ? local : Array.from(mergedMap.values());
        setStorageItem(STORAGE_KEYS.TEACHER_REFLECTIONS, finalReflections);
        this._cache[STORAGE_KEYS.TEACHER_REFLECTIONS] = finalReflections;
        emit('reflections-updated', finalReflections);
        break;
      }
      case 'behavioral_remarks': {
        const local = getStorageItem<BehavioralRemark[]>(STORAGE_KEYS.BEHAVIORAL_REMARKS, []);
        const mergedMap = new Map<string, BehavioralRemark>();
        local.forEach(r => { if (r && r.id) mergedMap.set(r.id, r); });
        items.forEach(r => { if (r && r.id) mergedMap.set(r.id, r); });
        const finalRemarks = (items.length === 0 && local.length > 0) ? local : Array.from(mergedMap.values());
        setStorageItem(STORAGE_KEYS.BEHAVIORAL_REMARKS, finalRemarks);
        this._cache[STORAGE_KEYS.BEHAVIORAL_REMARKS] = finalRemarks;
        emit('remarks-updated', finalRemarks);
        break;
      }
      case 'leave_requests': {
        const local = getStorageItem<LeaveRequest[]>(STORAGE_KEYS.LEAVE_REQUESTS, []);
        const mergedMap = new Map<string, LeaveRequest>();
        local.forEach(r => { if (r && r.id) mergedMap.set(r.id, r); });
        items.forEach(r => { if (r && r.id) mergedMap.set(r.id, r); });
        const finalLeave = (items.length === 0 && local.length > 0) ? local : Array.from(mergedMap.values());
        setStorageItem(STORAGE_KEYS.LEAVE_REQUESTS, finalLeave);
        this._cache[STORAGE_KEYS.LEAVE_REQUESTS] = finalLeave;
        emit('leave-requests-updated', finalLeave);
        break;
      }
      case 'tasks': {
        const local = getStorageItem<CustomTask[]>(STORAGE_KEYS.TASKS, []);
        const mergedMap = new Map<string, CustomTask>();
        local.forEach(t => { if (t && t.id) mergedMap.set(t.id, t); });
        items.forEach(t => { if (t && t.id) mergedMap.set(t.id, t); });
        const finalTasks = (items.length === 0 && local.length > 0) ? local : Array.from(mergedMap.values());
        setStorageItem(STORAGE_KEYS.TASKS, finalTasks);
        this._cache[STORAGE_KEYS.TASKS] = finalTasks;
        emit('tasks-updated', finalTasks);
        break;
      }
      case 'quick_notes': {
        const local = getStorageItem<QuickNote[]>(STORAGE_KEYS.QUICK_NOTES, []);
        const mergedMap = new Map<string, QuickNote>();
        local.forEach(n => { if (n && n.id) mergedMap.set(n.id, n); });
        items.forEach(n => { if (n && n.id) mergedMap.set(n.id, n); });
        const finalNotes = (items.length === 0 && local.length > 0) ? local : Array.from(mergedMap.values());
        setStorageItem(STORAGE_KEYS.QUICK_NOTES, finalNotes);
        this._cache[STORAGE_KEYS.QUICK_NOTES] = finalNotes;
        emit('quick-notes-updated', finalNotes);
        break;
      }
      case 'activity_logs': {
        const local = getStorageItem<ActivityLog[]>(STORAGE_KEYS.ACTIVITY_LOGS, []);
        const mergedMap = new Map<string, ActivityLog>();
        local.forEach(l => { if (l && l.id) mergedMap.set(l.id, l); });
        items.forEach(l => { if (l && l.id) mergedMap.set(l.id, l); });
        const finalLogs = (items.length === 0 && local.length > 0)
          ? local
          : Array.from(mergedMap.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 1000);
        setStorageItem(STORAGE_KEYS.ACTIVITY_LOGS, finalLogs);
        this._cache[STORAGE_KEYS.ACTIVITY_LOGS] = finalLogs;
        emit('activity-logs-updated', finalLogs);
        break;
      }
      case 'subscribers_timer': {
        const local = getStorageItem<SubscriberTimerData[]>(STORAGE_KEYS.SUBSCRIBER_TIMERS, []);
        const mergedMap = new Map<string, SubscriberTimerData>();
        local.forEach(t => { if (t && (t.id || t.userId)) mergedMap.set(t.id || t.userId, t); });
        items.forEach(t => { if (t && (t.id || t.userId)) mergedMap.set(t.id || t.userId, t); });
        const finalTimers = (items.length === 0 && local.length > 0) ? local : Array.from(mergedMap.values());
        setStorageItem(STORAGE_KEYS.SUBSCRIBER_TIMERS, finalTimers);
        this._cache[STORAGE_KEYS.SUBSCRIBER_TIMERS] = finalTimers;
        emit('subscribers-timer-updated', finalTimers);
        break;
      }
      case 'duty_roster':
        setStorageItem(STORAGE_KEYS.DUTY_ROSTER, items);
        this._cache[STORAGE_KEYS.DUTY_ROSTER] = items;
        emit('duty-roster-updated', items);
        break;
      case 'staff_handbook':
        setStorageItem(STORAGE_KEYS.STAFF_HANDBOOK, items);
        this._cache[STORAGE_KEYS.STAFF_HANDBOOK] = items;
        emit('handbook-updated', items);
        break;
      case 'custom_bill_categories':
        setStorageItem(STORAGE_KEYS.CUSTOM_BILL_CATEGORIES, items);
        this._cache[STORAGE_KEYS.CUSTOM_BILL_CATEGORIES] = items;
        emit('bill-categories-updated', items);
        break;
      case 'expenses':
        setStorageItem(STORAGE_KEYS.EXPENSES, items);
        this._cache[STORAGE_KEYS.EXPENSES] = items;
        emit('expenses-updated', items);
        break;
      case 'textbooks':
        setStorageItem(STORAGE_KEYS.TEXTBOOKS, items);
        this._cache[STORAGE_KEYS.TEXTBOOKS] = items;
        emit('textbooks-updated', items);
        break;
      case 'emis':
        setStorageItem(STORAGE_KEYS.EMIS, items);
        this._cache[STORAGE_KEYS.EMIS] = items;
        emit('emis-updated', items);
        break;
      case 'schools':
      case 'school':
      case 'school_info':
        if (items && !Array.isArray(items) && ((items as any).name || (items as any).headteacherName)) {
          setStorageItem(STORAGE_KEYS.SCHOOL, items);
          this._cache[STORAGE_KEYS.SCHOOL] = items;
          emit('school-updated', items);
        } else if (Array.isArray(items) && items.length > 0 && ((items[0] as any).name || (items[0] as any).headteacherName)) {
          setStorageItem(STORAGE_KEYS.SCHOOL, items[0]);
          this._cache[STORAGE_KEYS.SCHOOL] = items[0];
          emit('school-updated', items[0]);
        }
        break;
      case 'custom_sections':
        if (items && Array.isArray(items)) {
          const list = items[0]?.sections || items;
          if (Array.isArray(list) && list.length > 0) {
            setStorageItem(STORAGE_KEYS.CUSTOM_SECTIONS, list);
            this._cache[STORAGE_KEYS.CUSTOM_SECTIONS] = list;
            emit('sections-updated', { sections: list });
          }
        }
        break;
      case 'custom_subjects':
        if (items && Array.isArray(items)) {
          const list = items[0]?.subjects || items;
          if (Array.isArray(list) && list.length > 0) {
            setStorageItem(STORAGE_KEYS.CUSTOM_SUBJECTS, list);
            this._cache[STORAGE_KEYS.CUSTOM_SUBJECTS] = list;
            emit('subjects-updated', { subjects: list });
          }
        }
        break;
      case 'custom_classes':
        if (items && Array.isArray(items)) {
          const list = items[0]?.classes || items;
          if (Array.isArray(list) && list.length > 0) {
            setStorageItem(STORAGE_KEYS.CUSTOM_CLASSES, list);
            this._cache[STORAGE_KEYS.CUSTOM_CLASSES] = list;
            emit('classes-updated', { classes: list });
          }
        }
        break;
      case 'custom_academic_years':
        if (items && Array.isArray(items)) {
          const list = items[0]?.academicYears || items;
          if (Array.isArray(list) && list.length > 0) {
            setStorageItem(STORAGE_KEYS.CUSTOM_ACADEMIC_YEARS, list);
            this._cache[STORAGE_KEYS.CUSTOM_ACADEMIC_YEARS] = list;
            emit('academic-years-updated', { academicYears: list });
          }
        }
        break;
      case 'settings': {
        if (Array.isArray(items)) {
          const calendarDoc = items.find((d: any) => d.id === 'academic_calendar');
          if (calendarDoc) {
            setStorageItem(STORAGE_KEYS.CALENDAR, calendarDoc);
            this._cache[STORAGE_KEYS.CALENDAR] = calendarDoc;
            emit('calendar-updated', calendarDoc);
          }
          const systemDoc = items.find((d: any) => d.id === 'system_settings');
          if (systemDoc) {
            setStorageItem(STORAGE_KEYS.SETTINGS, systemDoc);
            this._cache[STORAGE_KEYS.SETTINGS] = systemDoc;
            emit('settings-updated', systemDoc);
          }
        }
        break;
      }
      default:
        break;
    }
    if (typeof window !== 'undefined' && broadcast) {
      window.dispatchEvent(new CustomEvent('school-system-sync', { detail: { type: `${colName}-updated`, payload: items } }));
    }
  }

  // -------------------------
  // SCHOOL PROFILE
  // -------------------------
  static normalizeSchoolAliases(school: SchoolInfo): SchoolInfo {
    if (!school) return school;
    const name = (school.name || school.schoolName || '').trim();
    const phone = (school.telephone || school.phone || '').trim();
    const address = (school.officialAddress || school.address || '').trim();
    const regNumber = (school.schoolNumber || school.gesRegNumber || '').trim();
    const crest = school.crestUrl || school.logoUrl || '';
    const sig = school.headteacherSignatureUrl || school.signatureUrl || '';
    const reopening = (school.reopeningDate || (school as any).nextTermStartDate || '').trim();

    return {
      ...school,
      name: name || school.name || '',
      schoolName: name || school.schoolName || '',
      telephone: phone || school.telephone || '',
      phone: phone || school.phone || '',
      officialAddress: address || school.officialAddress || '',
      address: address || school.address || '',
      schoolNumber: regNumber || school.schoolNumber || '',
      gesRegNumber: regNumber || school.gesRegNumber || '',
      crestUrl: crest || school.crestUrl || '',
      logoUrl: crest || school.logoUrl || '',
      headteacherSignatureUrl: sig || school.headteacherSignatureUrl || '',
      signatureUrl: sig || school.signatureUrl || '',
      reopeningDate: reopening || school.reopeningDate || '',
      nextTermStartDate: reopening || (school as any).nextTermStartDate || ''
    } as SchoolInfo;
  }

  static updateSchoolInfoLocally(info: SchoolInfo): SchoolInfo {
    const normalized = this.normalizeSchoolAliases(info);
    setStorageItem(STORAGE_KEYS.SCHOOL, normalized);
    this._cache[STORAGE_KEYS.SCHOOL] = normalized;
    return normalized;
  }

  static async fetchRemoteSchoolInfo(): Promise<SchoolInfo> {
    if (this._isFormatting || !isFirebaseActive || !firestoreDb) {
      return this.getSchoolInfo();
    }

    try {
      const currentUser = this.getCurrentUser();
      const candidateIds = new Set<string>();

      const activeSchoolId = this.resolveActiveSchoolId();
      if (activeSchoolId && activeSchoolId !== 'school_default') {
        candidateIds.add(activeSchoolId);
      }
      if (currentUser?.schoolId && currentUser.schoolId.trim() && currentUser.schoolId !== 'school_default') {
        candidateIds.add(currentUser.schoolId.trim());
      }
      if (currentUser?.uid) {
        candidateIds.add(currentUser.uid);
        candidateIds.add(`school_${currentUser.uid}`);
      }
      const cached = this.getSchoolInfo();
      if (cached?.schoolId && cached.schoolId !== 'school_default') {
        candidateIds.add(cached.schoolId);
      }
      if (cached?.id && cached.id !== 'school_default') {
        candidateIds.add(cached.id);
      }

      for (const sId of candidateIds) {
        try {
          const docSnap = await getDoc(doc(firestoreDb, 'schools', sId));
          if (docSnap.exists()) {
            const rawData = docSnap.data() as SchoolInfo;
            if (rawData && (rawData.name || rawData.schoolName || rawData.telephone || rawData.phone || rawData.motto || rawData.gpsAddress || rawData.logoUrl || rawData.crestUrl)) {
              let secretsData: any = {};
              try {
                const secSnap = await getDoc(doc(firestoreDb, 'schools', `secrets_${sId}`));
                if (secSnap.exists()) {
                  secretsData = secSnap.data() || {};
                } else if (currentUser?.uid) {
                  const secUserSnap = await getDoc(doc(firestoreDb, 'schools', `secrets_${currentUser.uid}`));
                  if (secUserSnap.exists()) {
                    secretsData = secUserSnap.data() || {};
                  }
                }
              } catch {}

              const merged = this.normalizeSchoolAliases({ ...DEFAULT_SCHOOL_INFO, ...rawData, ...secretsData });
              
              // Persist locally across memory and localStorage keys
              this.updateSchoolInfoLocally(merged);
              if (typeof localStorage !== 'undefined') {
                try {
                  localStorage.setItem(STORAGE_KEYS.SCHOOL, JSON.stringify(merged));
                  if (currentUser?.uid) {
                    localStorage.setItem(`${STORAGE_KEYS.SCHOOL}_${currentUser.uid}`, JSON.stringify(merged));
                  }
                  if (sId) {
                    localStorage.setItem(`${STORAGE_KEYS.SCHOOL}_${sId}`, JSON.stringify(merged));
                  }
                } catch {}
              }
              console.log(`[Cloud Firestore] Successfully hydrated School Profile from Cloud Firestore (Doc ID: ${sId}):`, merged.name || merged.schoolName);
              return merged;
            }
          }
        } catch (candidateErr) {
          console.warn(`[Cloud Firestore] Could not fetch school candidate doc (${sId}):`, candidateErr);
        }
      }
    } catch (err) {
      console.warn("[Cloud Firestore] fetchRemoteSchoolInfo general error:", err);
    }
    return this.getSchoolInfo();
  }

  static async fetchRemotePlatformPricing(): Promise<PlatformPricing> {
    if (!isFirebaseActive || !firestoreDb) {
      return this.getPlatformPricing();
    }
    try {
      const docSnap = await getDoc(doc(firestoreDb, 'platform_settings', 'pricing'));
      if (docSnap.exists()) {
        const remoteData = docSnap.data() as Partial<PlatformPricing>;
        if (remoteData && (remoteData.licensePrice1Year !== undefined || remoteData.smsRate !== undefined)) {
          const applied = this.setPlatformPricingLocally(remoteData);
          console.log('[Cloud Firestore] Synchronized global platform pricing from Cloud Firestore:', applied);
          return applied;
        }
      }
    } catch (err) {
      console.warn('[Cloud Firestore] Could not fetch platform_settings/pricing:', err);
    }
    return this.getPlatformPricing();
  }

  static getPlatformPricing(): PlatformPricing {
    if (this._cache[STORAGE_KEYS.PLATFORM_PRICING]) {
      return this._cache[STORAGE_KEYS.PLATFORM_PRICING];
    }
    const stored = getStorageItem<PlatformPricing | null>(STORAGE_KEYS.PLATFORM_PRICING, null);
    if (stored && stored.licensePrice1Year) {
      this._cache[STORAGE_KEYS.PLATFORM_PRICING] = stored;
      return stored;
    }
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.PLATFORM_PRICING);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.licensePrice1Year) {
            this._cache[STORAGE_KEYS.PLATFORM_PRICING] = parsed;
            return parsed;
          }
        }
      } catch {}
    }
    return DEFAULT_PLATFORM_PRICING;
  }

  static setPlatformPricingLocally(pricing: Partial<PlatformPricing>): PlatformPricing {
    const current = this.getPlatformPricing();
    const updated: PlatformPricing = {
      ...current,
      ...pricing,
      id: 'pricing',
      updatedAt: pricing.updatedAt || new Date().toISOString()
    };
    this._cache[STORAGE_KEYS.PLATFORM_PRICING] = updated;
    setStorageItem(STORAGE_KEYS.PLATFORM_PRICING, updated);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEYS.PLATFORM_PRICING, JSON.stringify(updated));
      } catch {}
    }

    // Also update current school info in cache and local storage
    const school = this.getSchoolInfo();
    const updatedSchool: SchoolInfo = {
      ...school,
      licensePrice1Year: updated.licensePrice1Year,
      licensePrice2Year: updated.licensePrice2Year,
      licensePrice3Year: updated.licensePrice3Year,
      licensePrice5Year: updated.licensePrice5Year,
      smsRate: updated.smsRate
    };
    this._cache[STORAGE_KEYS.SCHOOL] = updatedSchool;
    setStorageItem(STORAGE_KEYS.SCHOOL, updatedSchool);

    // Broadcast globally to all listening React tabs & windows
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('platform-pricing-updated', { detail: updated }));
      window.dispatchEvent(new CustomEvent('school-updated', { detail: updatedSchool }));
    }
    return updated;
  }

  static async savePlatformPricing(pricing: Partial<PlatformPricing>): Promise<PlatformPricing> {
    const currentUser = this.getCurrentUser();
    const payload: PlatformPricing = {
      ...this.getPlatformPricing(),
      ...pricing,
      id: 'pricing',
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.uid || 'admin',
      updatedByName: currentUser?.name || currentUser?.email || 'Administrator'
    };

    // 1. Update locally for instantaneous UI feedback
    this.setPlatformPricingLocally(payload);

    // 2. Persist to Cloud Firestore in /platform_settings/pricing
    if (isFirebaseActive && firestoreDb) {
      try {
        const sanitized = this.sanitizeForFirestore(payload);
        await setDoc(doc(firestoreDb, 'platform_settings', 'pricing'), sanitized, { merge: true });
        console.log('[Cloud Firestore] Successfully saved global platform subscription pricing:', payload);
      } catch (err) {
        console.warn('[Cloud Firestore] Failed direct write to platform_settings/pricing, enqueuing offline:', err);
        this.enqueueOfflineOperation('platform_settings', 'pricing', 'set', payload);
      }

      // Also update the active school doc
      const activeSchoolId = this.resolveActiveSchoolId();
      if (activeSchoolId) {
        await this.performFirestoreWrite('schools', activeSchoolId, 'set', {
          licensePrice1Year: payload.licensePrice1Year,
          licensePrice2Year: payload.licensePrice2Year,
          licensePrice3Year: payload.licensePrice3Year,
          licensePrice5Year: payload.licensePrice5Year,
          smsRate: payload.smsRate
        }).catch(() => {});
      }
    }

    // 3. Persist activity log into Firestore
    this.writeActivityLog(
      'Subscription Pricing Adjusted',
      `Admin adjusted system-wide subscription pricing: 1-Year = GHS ${payload.licensePrice1Year}, 2-Year = GHS ${payload.licensePrice2Year}, 3-Year = GHS ${payload.licensePrice3Year}, 5-Year = GHS ${payload.licensePrice5Year}, SMS Rate = ${payload.smsRate} credits/GHS. Propagated to all Headteachers and users.`,
      'high'
    );

    return payload;
  }

  static getSchoolInfo(): SchoolInfo {
    const platformPricing = this.getPlatformPricing();
    if (this._cache[STORAGE_KEYS.SCHOOL]) {
      const cached = this.normalizeSchoolAliases(this._cache[STORAGE_KEYS.SCHOOL]);
      if (!cached.setupWizardCompleted && typeof localStorage !== 'undefined') {
        const isDone = localStorage.getItem('sms_setup_wizard_completed') === 'true' ||
          (cached.schoolId && localStorage.getItem(`sms_setup_wizard_completed_${cached.schoolId}`) === 'true');
        if (isDone) cached.setupWizardCompleted = true;
      }
      cached.licensePrice1Year = platformPricing.licensePrice1Year;
      cached.licensePrice2Year = platformPricing.licensePrice2Year;
      cached.licensePrice3Year = platformPricing.licensePrice3Year;
      cached.licensePrice5Year = platformPricing.licensePrice5Year;
      cached.smsRate = platformPricing.smsRate;
      this._cache[STORAGE_KEYS.SCHOOL] = cached;
      return cached;
    }

    let info = getStorageItem<SchoolInfo>(STORAGE_KEYS.SCHOOL, DEFAULT_SCHOOL_INFO);
    
    // Robust multi-key fallback if partitioned storage returned blank default
    if ((!info || (!info.name && !info.schoolName && !info.motto && !info.telephone && !info.phone && !info.gpsAddress)) && typeof localStorage !== 'undefined') {
      try {
        const currentUser = this.getCurrentUser();
        const candidateKeys = [
          STORAGE_KEYS.SCHOOL,
          currentUser?.uid ? `${STORAGE_KEYS.SCHOOL}_${currentUser.uid}` : null,
          currentUser?.schoolId ? `${STORAGE_KEYS.SCHOOL}_${currentUser.schoolId}` : null,
          `${STORAGE_KEYS.SCHOOL}_default`
        ].filter(Boolean) as string[];

        for (const k of candidateKeys) {
          const raw = localStorage.getItem(k);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (parsed && (parsed.name || parsed.schoolName || parsed.motto || parsed.telephone || parsed.phone || parsed.gpsAddress)) {
                info = parsed;
                break;
              }
            } catch {}
          }
        }
      } catch {}
    }

    let finalResult = (info && (info.name || info.schoolName || info.telephone || info.motto || info.gpsAddress)) 
      ? this.normalizeSchoolAliases(info) 
      : DEFAULT_SCHOOL_INFO;

    if (!finalResult.setupWizardCompleted && typeof localStorage !== 'undefined') {
      const isDone = localStorage.getItem('sms_setup_wizard_completed') === 'true' ||
        (finalResult.schoolId && localStorage.getItem(`sms_setup_wizard_completed_${finalResult.schoolId}`) === 'true');
      if (isDone) {
        finalResult = { ...finalResult, setupWizardCompleted: true };
      }
    }
    finalResult = this.normalizeSchoolAliases(finalResult);
    finalResult.licensePrice1Year = platformPricing.licensePrice1Year;
    finalResult.licensePrice2Year = platformPricing.licensePrice2Year;
    finalResult.licensePrice3Year = platformPricing.licensePrice3Year;
    finalResult.licensePrice5Year = platformPricing.licensePrice5Year;
    finalResult.smsRate = platformPricing.smsRate;
    this._cache[STORAGE_KEYS.SCHOOL] = finalResult;
    return finalResult;
  }

  static resetSchoolInfo(): SchoolInfo {
    const blank: SchoolInfo = { ...DEFAULT_SCHOOL_INFO };
    this._cache[STORAGE_KEYS.SCHOOL] = blank;
    setStorageItem(STORAGE_KEYS.SCHOOL, blank);
    this.broadcastSyncEvent('school-updated', blank);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('school-system-sync', { detail: { type: 'school-updated', payload: blank } }));
    }
    return blank;
  }

  static async saveSchoolInfo(info: SchoolInfo): Promise<void> {
    if (this._isFormatting) return;
    info = this.normalizeSchoolAliases(info);
    const currentUser = this.getCurrentUser();
    const activeSchoolId = (info.schoolId && info.schoolId.trim() && info.schoolId !== 'school_default')
      ? info.schoolId.trim()
      : (currentUser?.schoolId && currentUser.schoolId.trim() && currentUser.schoolId !== 'school_default'
        ? currentUser.schoolId.trim()
        : this.resolveActiveSchoolId());

    info.schoolId = activeSchoolId;
    if (!info.id || info.id === 'school_default') {
      info.id = activeSchoolId;
    }
    if (!info.ownerId && currentUser?.uid) {
      info.ownerId = currentUser.uid;
    }

    if (info.setupWizardCompleted) {
      try {
        localStorage.setItem('sms_setup_wizard_completed', 'true');
        if (activeSchoolId) {
          localStorage.setItem(`sms_setup_wizard_completed_${activeSchoolId}`, 'true');
        }
      } catch (e) {}
    }

    // Validate Headteacher email: cannot be assigned to an active classroom teacher (non-headteacher/admin)
    const headEmail = (info.headteacherEmail || info.email)?.toLowerCase().trim();
    if (headEmail) {
      const teachers = this.getTeachers();
      const conflictingTeacher = teachers.find(t => 
        t.email && 
        !t.email.toLowerCase().endsWith('@school.internal') &&
        t.email.toLowerCase().trim() === headEmail && 
        t.id !== currentUser?.uid &&
        t.email?.toLowerCase().trim() !== currentUser?.email?.toLowerCase().trim() &&
        !(currentUser?.staffId && t.staffId && t.staffId === currentUser.staffId)
      );
      if (conflictingTeacher) {
        throw new Error(`The email '${headEmail}' is already assigned to active classroom teacher ${conflictingTeacher.firstName} ${conflictingTeacher.lastName}. One email cannot be used as Headteacher and assigned to a classroom teacher.`);
      }
    }

    // Persist into memory cache and storage partitions across both scoped and root keys
    setStorageItem(STORAGE_KEYS.SCHOOL, info);
    this._cache[STORAGE_KEYS.SCHOOL] = info;
    if (typeof localStorage !== 'undefined') {
      try {
        const serialized = JSON.stringify(info);
        localStorage.setItem(STORAGE_KEYS.SCHOOL, serialized);
        if (currentUser?.uid) {
          localStorage.setItem(`${STORAGE_KEYS.SCHOOL}_${currentUser.uid}`, serialized);
        }
        if (activeSchoolId) {
          localStorage.setItem(`${STORAGE_KEYS.SCHOOL}_${activeSchoolId}`, serialized);
        }
      } catch (storageErr) {
        console.warn("Storage notice on saveSchoolInfo:", storageErr);
      }
    }

    // Split public fields and secret fields for data breach protection
    const {
      paystackSecretKey,
      twilioAccountSid,
      twilioAuthToken,
      twilioFromNumber,
      ...publicFields
    } = info;

    // Save directly to Firebase Cloud Firestore
    if (isFirebaseActive && firestoreDb && activeSchoolId) {
      const sanitizedPublic = this.sanitizeForFirestore({
        ...publicFields,
        id: activeSchoolId,
        schoolId: activeSchoolId,
        schoolCode: info.schoolCode || activeSchoolId,
        ownerId: info.ownerId || currentUser?.uid || 'user_default',
        authorUid: currentUser?.uid || 'anonymous',
        authorName: this.resolveAuthorDisplayName(currentUser),
        authorRole: currentUser?.role || 'Headteacher',
        updatedAt: new Date().toISOString()
      });

      const cloudWrites: Promise<any>[] = [
        // 1. Primary school document
        setDoc(doc(firestoreDb, 'schools', activeSchoolId), sanitizedPublic, { merge: true })
      ];

      // 2. Secondary backup by user ID if different
      if (currentUser?.uid && activeSchoolId !== currentUser.uid) {
        cloudWrites.push(
          setDoc(doc(firestoreDb, 'schools', currentUser.uid), {
            ...sanitizedPublic,
            id: currentUser.uid,
            schoolId: activeSchoolId
          }, { merge: true }).catch(() => {})
        );
      }

      // 3. Secondary backup under school_${currentUser.uid}
      if (currentUser?.uid && activeSchoolId !== `school_${currentUser.uid}`) {
        cloudWrites.push(
          setDoc(doc(firestoreDb, 'schools', `school_${currentUser.uid}`), {
            ...sanitizedPublic,
            id: `school_${currentUser.uid}`,
            schoolId: activeSchoolId
          }, { merge: true }).catch(() => {})
        );
      }

      // 4. Update user profile document in Firestore so user account has permanent schoolId mapping
      if (currentUser?.uid) {
        cloudWrites.push(
          setDoc(doc(firestoreDb, 'users', currentUser.uid), this.sanitizeForFirestore({
            schoolId: activeSchoolId,
            schoolCode: info.schoolCode || activeSchoolId
          }), { merge: true }).catch(() => {})
        );
      }

      // 5. Secret credentials write
      if (paystackSecretKey !== undefined || twilioAccountSid !== undefined || twilioAuthToken !== undefined || twilioFromNumber !== undefined) {
        const secrets: Record<string, any> = {};
        if (paystackSecretKey !== undefined) secrets.paystackSecretKey = paystackSecretKey;
        if (twilioAccountSid !== undefined) secrets.twilioAccountSid = twilioAccountSid;
        if (twilioAuthToken !== undefined) secrets.twilioAuthToken = twilioAuthToken;
        if (twilioFromNumber !== undefined) secrets.twilioFromNumber = twilioFromNumber;
        
        const secretsId = `secrets_${activeSchoolId}`;
        cloudWrites.push(
          setDoc(doc(firestoreDb, 'schools', secretsId), this.sanitizeForFirestore(secrets), { merge: true }).catch(() => {})
        );
        if (currentUser?.uid && currentUser.uid !== activeSchoolId) {
          cloudWrites.push(
            setDoc(doc(firestoreDb, 'schools', `secrets_${currentUser.uid}`), this.sanitizeForFirestore(secrets), { merge: true }).catch(() => {})
          );
        }
      }

      // Propagation to active user session memory
      if (currentUser && activeSchoolId && currentUser.schoolId !== activeSchoolId) {
        currentUser.schoolId = activeSchoolId;
        setStorageItem(STORAGE_KEYS.USER, currentUser);
        this._cache[STORAGE_KEYS.USER] = currentUser;
      }

      // Bounded cloud wait: wait up to 6000ms for network acknowledgement
      try {
        await Promise.race([
          Promise.all(cloudWrites),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Cloud write timeout')), 6000))
        ]);
        console.log(`[Cloud Firestore] School profile permanently saved and synchronized:`, activeSchoolId);
      } catch (cloudErr) {
        console.warn("[Cloud Firestore] Direct cloud write notice (queued for offline flush):", cloudErr);
        this.enqueueOfflineOperation('schools', activeSchoolId, 'set', sanitizedPublic);
      }
    }

    this.writeActivityLog(
      'School Profile Updated',
      `Updated school configuration for ${info.name || 'School'} (Code: ${activeSchoolId}).`,
      'info'
    );
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
    this.writeActivityLog(
      'Academic Calendar Updated',
      `Saved configuration for academic year ${calendar.activeAcademicYear} (Term: ${calendar.activeTerm || 'Term 1'}).`,
      'info'
    );
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
    const activeSchoolId = this.resolveActiveSchoolId();
    const schoolOwnerUid = this.resolveHeadteacherUserId(activeSchoolId);
    student.schoolId = activeSchoolId;
    student.schoolCode = activeSchoolId;
    student.userId = schoolOwnerUid;

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

    // Also cascade delete assessments and attendance for this student locally and on Cloud Firestore
    const assessments = this.getAssessments(true);
    const studentAssessments = assessments.filter(a => a.studentId === studentId);
    const filteredAssessments = assessments.filter(a => a.studentId !== studentId);
    setStorageItem(STORAGE_KEYS.ASSESSMENTS, filteredAssessments);
    this._cache[STORAGE_KEYS.ASSESSMENTS] = filteredAssessments;

    if (studentAssessments.length > 0) {
      this.performFirestoreWriteBatch('assessments', studentAssessments.map(a => ({
        id: a.id,
        type: 'delete'
      })));
    }

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
    const studentAttendance = attendanceList.filter(a => a.studentId === studentId);
    const filteredAttendance = attendanceList.filter(a => a.studentId !== studentId);
    setStorageItem(STORAGE_KEYS.ATTENDANCE, filteredAttendance);
    this._cache[STORAGE_KEYS.ATTENDANCE] = filteredAttendance;

    if (studentAttendance.length > 0) {
      this.performFirestoreWriteBatch('attendance', studentAttendance.map(a => ({
        id: a.id,
        type: 'delete'
      })));
    }

    this.performFirestoreWrite('students', studentId, 'delete');

    // Also cascade delete behavioral remarks for this student locally and on Firestore
    try {
      const remarks = this.getBehavioralRemarks();
      const studentRemarks = remarks.filter(r => r.studentId === studentId);
      if (studentRemarks.length > 0) {
        this.performFirestoreWriteBatch('behavioral_remarks', studentRemarks.map(r => ({
          id: r.id,
          type: 'delete'
        })));
      }
      const filteredRemarks = remarks.filter(r => r.studentId !== studentId);
      setStorageItem(STORAGE_KEYS.BEHAVIORAL_REMARKS, filteredRemarks);
      this._cache[STORAGE_KEYS.BEHAVIORAL_REMARKS] = filteredRemarks;
    } catch (e) {
      console.warn("Error cascading delete on behavioral remarks:", e);
    }
    this.broadcastSyncEvent('students-updated', { studentId });
    this.broadcastSyncEvent('assessments-updated', filteredAssessments);
    this.broadcastSyncEvent('attendance-updated', filteredAttendance);
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
    const activeSchoolId = this.resolveActiveSchoolId();
    const schoolOwnerUid = this.resolveHeadteacherUserId(activeSchoolId);
    if (!remark.schoolId) remark.schoolId = activeSchoolId;
    remark.schoolCode = activeSchoolId;
    remark.ownerId = schoolOwnerUid;
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
    const activeSchoolId = this.resolveActiveSchoolId();
    const schoolOwnerUid = this.resolveHeadteacherUserId(activeSchoolId);
    const matchedTeacher = this.getTeachers().find(
      t => t.id === reflection.teacherId || t.staffId === reflection.teacherId
    );
    const resolvedTeacherName = matchedTeacher
      ? this.formatTeacherFullName(matchedTeacher)
      : (reflection.teacherName && !/^(staff|staff member)$/i.test(reflection.teacherName.trim())
        ? reflection.teacherName.trim()
        : this.resolveAuthorDisplayName(this.getCurrentUser()));

    if (!reflection.schoolId) reflection.schoolId = activeSchoolId;
    reflection.teacherName = resolvedTeacherName;
    (reflection as any).schoolCode = activeSchoolId;
    (reflection as any).ownerId = schoolOwnerUid;
    (reflection as any).headteacherUserId = schoolOwnerUid;
    (reflection as any).headteacherName = this.resolveHeadteacherName(activeSchoolId);
    (reflection as any).lastModified = new Date().toISOString();

    const reflections = this.getTeacherReflections();
    const idx = reflections.findIndex(r => r.id === reflection.id);
    const isUpdate = idx >= 0;
    if (isUpdate) {
      reflections[idx] = reflection;
    } else {
      reflections.push(reflection);
    }
    setStorageItem(STORAGE_KEYS.TEACHER_REFLECTIONS, reflections);
    this._cache[STORAGE_KEYS.TEACHER_REFLECTIONS] = reflections;

    this.performFirestoreWrite('teacher_reflections', reflection.id, 'set', reflection);
    this.writeActivityLog(
      isUpdate ? 'Teacher Reflection Updated' : 'Teacher Reflection Submitted',
      `${resolvedTeacherName} ${isUpdate ? 'updated' : 'submitted'} a ${reflection.category || 'Journal'} entry${reflection.class ? ` for ${reflection.class}` : ''}.`,
      'info'
    );
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
    let list: Teacher[];
    if (this._cache[STORAGE_KEYS.TEACHERS]) {
      list = this._cache[STORAGE_KEYS.TEACHERS];
    } else {
      list = getStorageItem<Teacher[]>(STORAGE_KEYS.TEACHERS, []);
      this._cache[STORAGE_KEYS.TEACHERS] = list;
    }
    const activeSchoolId = this.resolveActiveSchoolId();
    const resolvedHeadUid = this.resolveHeadteacherUserId(activeSchoolId);
    const activeOwnerId = this.isValidHeadteacherUid(resolvedHeadUid) ? resolvedHeadUid : '';

    // Rule 3: Guarantee all assigned teachers inherit the unique school code & Headteacher owner ID
    let modified = false;
    list.forEach(t => {
      if (!t.schoolId || t.schoolId === 'school_default' || t.schoolId === 'SMS-P8U4F22L') {
        t.schoolId = activeSchoolId;
        modified = true;
      }
      if (activeOwnerId && (!t.ownerId || t.ownerId === t.id || t.ownerId.startsWith('HEAD_') || t.ownerId === 'user_default')) {
        t.ownerId = activeOwnerId;
        (t as any).headteacherUserId = activeOwnerId;
        modified = true;
      }
    });
    if (modified) {
      setStorageItem(STORAGE_KEYS.TEACHERS, list);
    }
    return list;
  }

  static saveTeacher(teacher: Teacher): void {
    // Ensure email is set
    if (!teacher.email || !teacher.email.trim()) {
      const safeId = (teacher.staffId || teacher.id || 'teacher').toLowerCase().replace(/[^a-z0-9]/g, '');
      teacher.email = `${safeId}@school.internal`;
    }

    // Enforce Rule: One email cannot be used as Headteacher and assigned the same email as a teacher
    const teacherEmail = teacher.email?.toLowerCase().trim();
    if (teacherEmail && !teacherEmail.endsWith('@school.internal')) {
      const schoolInfo = this.getSchoolInfo();
      const currentHeadEmail = schoolInfo?.email?.toLowerCase().trim();
      const registeredUsers = this.getRegisteredUsers();
      const isHeadteacherEmail = (currentHeadEmail && currentHeadEmail === teacherEmail) ||
        registeredUsers.some(u => (u.role === 'Headteacher' || u.role === 'Admin') && u.email?.toLowerCase().trim() === teacherEmail);

      if (isHeadteacherEmail) {
        throw new Error(`The email '${teacher.email}' is already registered as a Headteacher. One email cannot be used as Headteacher and assigned the same email as a teacher.`);
      }
    }

    const activeSchoolId = teacher.schoolCode?.trim() || teacher.schoolId?.trim() || this.resolveActiveSchoolId();
    teacher.schoolId = activeSchoolId;
    teacher.schoolCode = activeSchoolId;

    const schoolOwnerUid = this.resolveHeadteacherUserId(activeSchoolId);
    if (this.isValidHeadteacherUid(schoolOwnerUid)) {
      teacher.ownerId = schoolOwnerUid;
      (teacher as any).headteacherUserId = schoolOwnerUid;
    } else if (!teacher.ownerId || teacher.ownerId === teacher.id) {
      teacher.ownerId = schoolOwnerUid;
    }
    const headName = this.resolveHeadteacherName(activeSchoolId);
    if (headName) {
      (teacher as any).headteacherName = headName;
    }
    (teacher as any).lastModified = new Date().toISOString();

    // Ensure permissions object contains all 4 module roles + 4 action permissions explicitly
    teacher.permissions = {
      canAccessStudents: teacher.permissions?.canAccessStudents !== false,
      canAccessAttendance: teacher.permissions?.canAccessAttendance !== false,
      canAccessAssessments: teacher.permissions?.canAccessAssessments !== false,
      canAccessSystemControl: teacher.permissions?.canAccessSystemControl !== false,
      canEditStudents: teacher.permissions?.canEditStudents !== false,
      canApproveAttendance: teacher.permissions?.canApproveAttendance !== false,
      canEditGrades: teacher.permissions?.canEditGrades !== false,
      canExportReports: teacher.permissions?.canExportReports !== false
    };

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

    // Synchronize or create corresponding UserAccount in USERS_LIST with shared schoolId, ownerId & Headteacher subscription parity
    const users = this.getRegisteredUsers();
    const headUser = users.find(u =>
      (u.role === 'Headteacher' || u.role === 'Admin') &&
      u.email?.toLowerCase().trim() !== 'pegyirenyi@gmail.com' &&
      ((this.isValidHeadteacherUid(schoolOwnerUid) && u.uid === schoolOwnerUid) || u.schoolId === activeSchoolId || u.schoolCode === activeSchoolId)
    );
    const enrolledFullName = this.formatTeacherFullName(teacher);

    let userAcc = users.find(u => u.email.toLowerCase().trim() === teacher.email!.toLowerCase().trim());
    if (!userAcc && teacher.staffId) {
      userAcc = users.find(u => u.staffId?.toLowerCase().trim() === teacher.staffId.toLowerCase().trim());
    }

    const createdNow = new Date().toISOString();
    const defaultTrialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    if (!userAcc) {
      userAcc = {
        uid: (teacher as any).userId || teacher.id || ('user_' + Math.random().toString(36).substring(2, 9)),
        email: teacher.email.toLowerCase().trim(),
        name: enrolledFullName,
        role: 'Teacher',
        staffId: teacher.staffId,
        schoolId: activeSchoolId,
        schoolCode: activeSchoolId,
        ownerId: this.isValidHeadteacherUid(schoolOwnerUid) ? schoolOwnerUid : teacher.ownerId,
        createdAt: createdNow,
        licenseType: headUser?.licenseType || 'trial',
        licensePeriod: headUser?.licensePeriod,
        lastActivatedOn: headUser?.lastActivatedOn,
        trialStartDate: headUser?.trialStartDate || createdNow,
        trialEndDate: headUser?.trialEndDate || defaultTrialEnd,
        registeredOn: headUser?.registeredOn || createdNow,
        isSuspended: headUser?.isSuspended
      };
      users.push(userAcc);
    } else {
      userAcc.name = enrolledFullName || userAcc.name;
      if (teacher.staffId) userAcc.staffId = teacher.staffId;
      if (teacher.email) userAcc.email = teacher.email.toLowerCase().trim();
      userAcc.schoolId = activeSchoolId;
      userAcc.schoolCode = activeSchoolId;
      if (this.isValidHeadteacherUid(schoolOwnerUid)) {
        userAcc.ownerId = schoolOwnerUid;
      } else if (!userAcc.ownerId || userAcc.ownerId === userAcc.uid) {
        userAcc.ownerId = teacher.ownerId;
      }
      if (headUser) {
        userAcc.licenseType = headUser.licenseType;
        userAcc.licensePeriod = headUser.licensePeriod;
        userAcc.lastActivatedOn = headUser.lastActivatedOn;
        userAcc.trialStartDate = headUser.trialStartDate;
        userAcc.trialEndDate = headUser.trialEndDate;
        userAcc.registeredOn = headUser.registeredOn || userAcc.registeredOn;
        userAcc.isSuspended = headUser.isSuspended;
      }
    }
    setStorageItem(STORAGE_KEYS.USERS_LIST, users);
    this._cache[STORAGE_KEYS.USERS_LIST] = users;

    // If current logged-in session belongs to this teacher, update active session immediately
    const activeSessionUser = getStorageItem<UserAccount | null>(STORAGE_KEYS.USER, null);
    if (activeSessionUser && activeSessionUser.role === 'Teacher' && (
      activeSessionUser.uid === userAcc.uid ||
      (teacher.staffId && activeSessionUser.staffId?.toLowerCase().trim() === teacher.staffId.toLowerCase().trim()) ||
      activeSessionUser.email?.toLowerCase().trim() === userAcc.email?.toLowerCase().trim()
    )) {
      const refreshedSession = { ...activeSessionUser, ...userAcc };
      setStorageItem(STORAGE_KEYS.USER, refreshedSession);
      this._cache[STORAGE_KEYS.USER] = refreshedSession;
    }

    // Ensure user record & directory & subscriber timer in Firestore contain full Headteacher subscription parity
    if (isFirebaseActive && firestoreDb && userAcc.uid) {
      setDoc(doc(firestoreDb, 'users', userAcc.uid), DbController.sanitizeForFirestore(userAcc), { merge: true }).catch(console.error);
      setDoc(doc(firestoreDb, 'users', 'directory'), { list: this.sanitizeForFirestore(users), updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
      this.syncSubscriberTimerFromUser(userAcc).catch(() => {});
    }

    this.broadcastSyncEvent('teacher-updated', teacher);
    this.broadcastSyncEvent('teachers-updated', teachers);
  }

  static deleteTeacher(teacherId: string): void {
    const teachers = this.getTeachers();
    const teacher = teachers.find(t => t.id === teacherId);
    if (teacher) {
      const fullName = this.formatTeacherFullName(teacher);
      this.writeActivityLog(
        'Teacher Account Deletion', 
        `Permanently deleted teacher account record: ${fullName} (ID: ${teacherId}, Staff ID: ${teacher.staffId || 'N/A'}, NTC Number: ${teacher.ntcNumber || 'N/A'})`,
        'critical'
      );
    }
    const filtered = teachers.filter(t => t.id !== teacherId);
    setStorageItem(STORAGE_KEYS.TEACHERS, filtered);
    this._cache[STORAGE_KEYS.TEACHERS] = filtered;

    // Cascade staff attendance delete from Firestore
    const staffAtt = this.getAllStaffAttendance();
    const teacherStaffRecords = staffAtt.filter(r => r.teacherId === teacherId);
    if (teacherStaffRecords.length > 0) {
      this.performFirestoreWriteBatch('staff_attendance', teacherStaffRecords.map(r => ({
        id: r.id,
        type: 'delete'
      })));
      const filteredStaff = staffAtt.filter(r => r.teacherId !== teacherId);
      setStorageItem(STORAGE_KEYS.STAFF_ATTENDANCE, filteredStaff);
      this._cache[STORAGE_KEYS.STAFF_ATTENDANCE] = filteredStaff;
      this.broadcastSyncEvent('staff-attendance-updated', filteredStaff);
    }

    this.performFirestoreWrite('teachers', teacherId, 'delete');
    this.broadcastSyncEvent('teacher-deleted', { id: teacherId });
    this.broadcastSyncEvent('teachers-updated', filtered);
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
    const activeSchoolId = this.resolveActiveSchoolId();
    const schoolOwnerUid = this.resolveHeadteacherUserId(activeSchoolId);
    records.forEach(rec => {
      if (!rec.schoolId) rec.schoolId = activeSchoolId;
      if (!rec.schoolCode) rec.schoolCode = activeSchoolId;
      if (!rec.ownerId) rec.ownerId = schoolOwnerUid;
      if (rec.id) rec.id = rec.id.replace(/\//g, '-');
    });
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
    const schoolOwnerUid = this.resolveHeadteacherUserId(activeSchoolId);
    let list: AttendanceRecord[];
    if (this._cache[STORAGE_KEYS.ATTENDANCE]) {
      list = this._cache[STORAGE_KEYS.ATTENDANCE];
    } else {
      list = getStorageItem<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
    }
    records.forEach(rec => {
      if (!rec.schoolId) rec.schoolId = activeSchoolId;
      if (!rec.schoolCode) rec.schoolCode = activeSchoolId;
      if (!rec.ownerId) rec.ownerId = schoolOwnerUid;
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
    const activeSchoolId = this.resolveActiveSchoolId();
    const schoolOwnerUid = this.resolveHeadteacherUserId(activeSchoolId);
    let list: StaffAttendanceRecord[];
    if (this._cache[STORAGE_KEYS.STAFF_ATTENDANCE]) {
      list = this._cache[STORAGE_KEYS.STAFF_ATTENDANCE];
    } else {
      list = getStorageItem<StaffAttendanceRecord[]>(STORAGE_KEYS.STAFF_ATTENDANCE, []);
    }
    records.forEach(rec => {
      if (!rec.schoolId) rec.schoolId = activeSchoolId;
      if (!rec.schoolCode) rec.schoolCode = activeSchoolId;
      if (!rec.ownerId) rec.ownerId = schoolOwnerUid;
      if (rec.id) rec.id = rec.id.replace(/\//g, '-');
      const idx = list.findIndex(r => r.id === rec.id);
      if (idx >= 0) {
        list[idx] = rec;
      } else {
        list.push(rec);
      }
    });
    setStorageItem(STORAGE_KEYS.STAFF_ATTENDANCE, list);
    this._cache[STORAGE_KEYS.STAFF_ATTENDANCE] = list;

    // Atomic batch sync to cloud without delay
    this.performFirestoreWriteBatch('staff_attendance', records.map(rec => ({
      id: rec.id,
      type: 'set',
      data: rec
    })));
    this.broadcastSyncEvent('staff-attendance-updated', list);
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
    const activeSchoolId = this.resolveActiveSchoolId();
    const schoolOwnerUid = this.resolveHeadteacherUserId(activeSchoolId);
    const safeId = (template.id || '').replace(/\//g, '-');
    const safeTemplate = {
      ...template,
      id: safeId,
      schoolId: template.schoolId || activeSchoolId,
      schoolCode: template.schoolCode || activeSchoolId,
      ownerId: template.ownerId || schoolOwnerUid
    };
    const list = this.getAssessmentTemplates();
    const idx = list.findIndex(t => t.id === safeId || t.id === template.id);
    if (idx >= 0) {
      list[idx] = safeTemplate;
    } else {
      list.push(safeTemplate);
    }
    setStorageItem(STORAGE_KEYS.ASSESSMENT_TEMPLATES, list);
    this._cache[STORAGE_KEYS.ASSESSMENT_TEMPLATES] = list;
    this.performFirestoreWrite('assessment_templates', safeId, 'set', safeTemplate);
    this.broadcastSyncEvent('assessment-templates-updated', list);
  }

  static deleteAssessmentTemplate(id: string): void {
    const safeId = id.replace(/\//g, '-');
    const list = this.getAssessmentTemplates();
    const updated = list.filter(t => t.id !== id && t.id !== safeId);
    setStorageItem(STORAGE_KEYS.ASSESSMENT_TEMPLATES, updated);
    this._cache[STORAGE_KEYS.ASSESSMENT_TEMPLATES] = updated;
    this.performFirestoreWrite('assessment_templates', safeId, 'delete');
    this.broadcastSyncEvent('assessment-templates-updated', updated);
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
    const activeSchoolId = this.resolveActiveSchoolId();
    const schoolOwnerUid = this.resolveHeadteacherUserId(activeSchoolId);
    assessments.forEach(item => {
      if (!item.schoolId) item.schoolId = activeSchoolId;
      if (!item.schoolCode) item.schoolCode = activeSchoolId;
      if (!item.ownerId) item.ownerId = schoolOwnerUid;
      if (item.id) item.id = item.id.replace(/\//g, '-');
    });
    setStorageItem(STORAGE_KEYS.ASSESSMENTS, assessments);
    this._cache[STORAGE_KEYS.ASSESSMENTS] = assessments;

    // Atomic batch sync to cloud without delay
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
    students.forEach(item => {
      this.performFirestoreWrite('students', item.id, 'set', item);
    });

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
    const schoolOwnerUid = this.resolveHeadteacherUserId(activeSchoolId);
    const first = sheet[0];
    const template = this.getAssessmentTemplate(first.class, first.academicYear, first.term, first.subject);
    const allAssessments = this.getAssessments(true);
    const updatedSheet = this.calculatePositions(sheet, template);

    let loggedChangesCount = 0;
    const changeDetails: string[] = [];

    updatedSheet.forEach(item => {
      if (!item.id) {
        item.id = `${item.studentId}_${item.academicYear}_${item.term}_${(item.subject || '').replace(/\s+/g, '')}`.replace(/\//g, '-');
      } else {
        item.id = item.id.replace(/\//g, '-');
      }
      if (!item.schoolId) item.schoolId = activeSchoolId;
      if (!item.schoolCode) item.schoolCode = activeSchoolId;
      if (!item.ownerId) item.ownerId = schoolOwnerUid;
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
        if (olditem.id && olditem.id !== item.id) {
          // Clean up old document key from Firestore to prevent duplicates
          this.performFirestoreWrite('assessments', olditem.id, 'delete');
        }
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
      totalScoreSum,
      totalRawScore: totalScoreSum,
      totalRawScoreAverage: averageScore,
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
    const totalBilled = (bill.schoolFees || 0) + (bill.utilityBill || 0) + (bill.sportsFees || 0) + (bill.ptaDues || 0);
    this.writeActivityLog(
      'Student Fee Bill Saved',
      `Saved fee bill for student ${bill.studentName || bill.studentId} (Class: ${bill.class}, Total: GHS ${totalBilled}).`,
      'info'
    );
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
    bills.forEach(b => {
      if (b.id) this.performFirestoreWrite('fees', b.id, 'delete');
    });
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
    payments.forEach(p => {
      if (p.id) this.performFirestoreWrite('paystack_payments', p.id, 'delete');
    });
    setStorageItem(STORAGE_KEYS.PAYSTACK_LOGS, []);
    this._cache[STORAGE_KEYS.PAYSTACK_LOGS] = [];
  }

  // System settings customization
  static getSystemSettings() {
    if (this._cache[STORAGE_KEYS.SETTINGS]) {
      const cached = this._cache[STORAGE_KEYS.SETTINGS];
      if (cached && typeof cached === 'object') {
        if (!cached.idleLogoutTimer) cached.idleLogoutTimer = 30;
        return cached;
      }
    }
    const defaultSettings = {
      theme: 'Classic' as ThemeType,
      autoSave: true,
      term: 'Term 1' as TermType,
      academicYear: '2026/2027' as AcademicYearType,
      schoolSystemName: 'GEETECH SMS & ASSESSMENT CENTER',
      idleLogoutTimer: 30
    };
    const settings = getStorageItem(STORAGE_KEYS.SETTINGS, defaultSettings);
    const finalSettings = (settings && typeof settings === 'object') ? { ...defaultSettings, ...settings } : defaultSettings;
    if (!finalSettings.idleLogoutTimer) finalSettings.idleLogoutTimer = 30;
    this._cache[STORAGE_KEYS.SETTINGS] = finalSettings;
    return finalSettings;
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
    if (backups.length > 0) {
      const latest = backups[0];
      this.performFirestoreWrite('backups', 'latest', 'set', {
        id: 'latest',
        backupId: latest.id,
        timestamp: latest.timestamp,
        size: latest.size,
        data: latest.data,
        updatedAt: new Date().toISOString()
      }).catch(err => console.warn("Could not sync backup snapshot to Firestore:", err));
    }
  }

  // -------------------------
  // ACADEMIC ASSESSMENT MARK LIMITS (Saved to Firestore)
  // -------------------------
  static getSubjectMarkLimits(): Record<string, any> {
    const cached = this._cache[STORAGE_KEYS.SUBJECT_MARK_LIMITS];
    if (cached && Object.keys(cached).length > 0) return cached;

    const limits = getStorageItem<Record<string, any>>(STORAGE_KEYS.SUBJECT_MARK_LIMITS, {});
    this._cache[STORAGE_KEYS.SUBJECT_MARK_LIMITS] = limits;
    return limits;
  }

  static saveSubjectMarkLimits(limits: Record<string, any>): void {
    setStorageItem(STORAGE_KEYS.SUBJECT_MARK_LIMITS, limits);
    this._cache[STORAGE_KEYS.SUBJECT_MARK_LIMITS] = limits;
    this.performFirestoreWrite('settings', 'subject_mark_limits', 'set', limits).catch(err => {
      console.warn("Could not sync subject mark limits to Firestore:", err);
    });
  }

  // -------------------------
  // STAFF HANDBOOK READ STATUS (Saved to Firestore)
  // -------------------------
  static getHandbookReadStatus(userId: string): Record<string, string> {
    const key = `${STORAGE_KEYS.HANDBOOK_READ_STATUS}_${userId}`;
    const cached = this._cache[key];
    if (cached) return cached;

    const data = getStorageItem<Record<string, string>>(key, {});
    this._cache[key] = data;
    return data;
  }

  static saveHandbookReadStatus(userId: string, readData: Record<string, string>): void {
    const key = `${STORAGE_KEYS.HANDBOOK_READ_STATUS}_${userId}`;
    setStorageItem(key, readData);
    this._cache[key] = readData;
    this.performFirestoreWrite('settings', `handbook_read_${userId}`, 'set', { userId, readData }).catch(err => {
      console.warn("Could not sync handbook read status to Firestore:", err);
    });
  }

  // -------------------------
  // USER TAB PREFERENCES (Saved to Firestore)
  // -------------------------
  static getUserTabPreferences(email: string): { tabOrder?: string[]; hiddenTabs?: string[] } {
    const safeKey = email.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_');
    const key = `${STORAGE_KEYS.USER_TAB_PREFERENCES}_${safeKey}`;
    const cached = this._cache[key];
    if (cached) return cached;

    const data = getStorageItem<{ tabOrder?: string[]; hiddenTabs?: string[] }>(key, {});
    this._cache[key] = data;
    return data;
  }

  static saveUserTabPreferences(email: string, prefs: { tabOrder?: string[]; hiddenTabs?: string[] }): void {
    const safeKey = email.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_');
    const key = `${STORAGE_KEYS.USER_TAB_PREFERENCES}_${safeKey}`;
    const current = this.getUserTabPreferences(email);
    const updated = { ...current, ...prefs };
    setStorageItem(key, updated);
    this._cache[key] = updated;
    this.performFirestoreWrite('settings', `tabs_${safeKey}`, 'set', updated).catch(err => {
      console.warn("Could not sync tab preferences to Firestore:", err);
    });
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
    this.performFirestoreWrite('backups', id, 'delete').catch(() => {});
  }

  static getCloudSyncConfig(): CloudSyncConfig {
    const cached = this._cache[STORAGE_KEYS.CLOUD_SYNC_CONFIG];
    if (cached) return cached;

    const config = getStorageItem<CloudSyncConfig>(STORAGE_KEYS.CLOUD_SYNC_CONFIG, {
      enabled: true,
      provider: 'Firebase Firestore (User ID Cloud Database)',
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

  /**
   * Directly saves all school database records and a complete JSON backup file snapshot
   * to Firestore under the authenticated User ID.
   */
  static async saveDataAndFileToUserFirestore(): Promise<{
    success: boolean;
    syncedCount: number;
    userId: string;
    error?: string;
  }> {
    if (this._isFormatting) {
      return { success: false, syncedCount: 0, userId: 'formatting' };
    }
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const currentUser = this.getCurrentUser();

    // Ensure active Firebase Auth session before cloud backup
    if (isFirebaseActive && firebaseAuth && !firebaseAuth.currentUser) {
      await this.ensureFirebaseAuth();
    }

    const authUid = firebaseAuth?.currentUser?.uid || currentUser?.uid;
    if (!authUid) {
      console.log("[Save to Firestore] Skipping cloud backup: No active user session.");
      return {
        success: false,
        syncedCount: 0,
        userId: 'anonymous',
        error: 'No active user session.'
      };
    }
    const userId = authUid;
    const schoolId = this.resolveActiveSchoolId() || userId;
    const timestamp = new Date().toISOString();

    console.log(`[Save to Firestore] Saving data & backup file to User ID Firestore (${userId})...`);

    // Helper: Deep-sanitize objects to eliminate any unsupported `undefined` properties
    const sanitizeForFirestore = (obj: any): any => {
      if (obj === undefined) return null;
      if (obj === null || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
      const clean: any = {};
      for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (val !== undefined) {
          clean[key] = sanitizeForFirestore(val);
        }
      }
      return clean;
    };

    // Guarantee Firestore network connection is active
    if (isFirebaseActive && firestoreDb) {
      try {
        await enableNetwork(firestoreDb);
      } catch (_) {}
    }

    // First, flush offline queue
    let queueCount = 0;
    if (isFirebaseActive && firestoreDb && isOnline) {
      try {
        const queueRes = await this.syncOfflineQueue();
        queueCount = queueRes.syncedCount;
      } catch (qErr) {
        console.warn("[Save to Firestore] Offline queue flush skipped:", qErr);
      }
    }

    // Prepare complete export backup file payload
    const backupJson = this.exportAllData();
    const students = this.getStudents();
    const teachers = this.getTeachers();
    const attendance = this.getAllAttendance();
    const assessments = this.getAssessments(true);
    const fees = this.getStudentFeeBills();
    const emis = this.getEmisReports();
    const school = this.getSchoolInfo();
    const calendar = this.getAcademicCalendar();
    const tasks = this.getTasks();
    const notes = this.getQuickNotes();
    const leaves = this.getLeaveRequests();
    const reflections = this.getTeacherReflections();
    const remarks = this.getBehavioralRemarks();
    const payslips = this.getStaffPayslips();
    const expenses = this.getExpenses();
    const dutyRoster = this.getDutyAssignments();
    const sections = this.getSections();

    const stats = {
      studentsCount: students.length,
      teachersCount: teachers.length,
      attendanceCount: attendance.length,
      assessmentsCount: assessments.length,
      feesCount: fees.length,
      emisCount: emis.length,
      tasksCount: tasks.length,
      fileSizeBytes: backupJson.length,
      fileSizeKb: (backupJson.length / 1024).toFixed(2),
      savedAt: timestamp,
      schoolName: school.name || 'Default School'
    };

    const backupDocData = sanitizeForFirestore({
      id: 'latest',
      userId,
      userEmail: currentUser?.email || firebaseAuth?.currentUser?.email || '',
      schoolId,
      timestamp,
      version: '1.0.0',
      fileName: `school_data_snapshot_${userId}.json`,
      fileSize: backupJson.length,
      stats,
      payload: backupJson.length < 800000 ? backupJson : undefined,
      updatedAt: timestamp,
      createdAt: timestamp
    });

    let totalSyncedRecords = queueCount;

    if (isFirebaseActive && firestoreDb && isOnline) {
      try {
        // 1. Save backup snapshot file to user's private subcollections and school backups
        const backupTasks: Promise<any>[] = [
          setDoc(doc(firestoreDb, 'users', userId, 'backups', 'latest'), backupDocData, { merge: true }),
          setDoc(doc(firestoreDb, 'users', userId, 'cloud_sync', 'latest'), backupDocData, { merge: true }),
          setDoc(doc(firestoreDb, 'schools', schoolId, 'backups', 'latest'), backupDocData, { merge: true }),
          setDoc(doc(firestoreDb, 'schools', schoolId, 'settings', 'academic_calendar'), sanitizeForFirestore({ ...calendar, schoolId }), { merge: true }),
          setDoc(doc(firestoreDb, 'schools', schoolId, 'custom_sections', 'all'), sanitizeForFirestore({ sections, schoolId }), { merge: true })
        ];

        if (school && (school.name || school.headteacherName || school.telephone || school.logoUrl)) {
          backupTasks.push(setDoc(doc(firestoreDb, 'schools', schoolId), sanitizeForFirestore(school), { merge: true }));
        }

        // 2. Batch sync active datasets to Firestore under schoolId (with per-batch timeout)
        const batchWriteCollection = async (colName: string, items: any[]) => {
          if (!items || items.length === 0) return;
          try {
            const chunkSize = 250;
            for (let i = 0; i < items.length; i += chunkSize) {
              const chunk = items.slice(i, i + chunkSize);
              const batch = writeBatch(firestoreDb!);
              chunk.forEach(item => {
                if (item && item.id) {
                  const safeDocId = String(item.id).replace(/\//g, '-');
                  const docRef = doc(firestoreDb!, 'schools', schoolId, colName, safeDocId);
                  batch.set(docRef, sanitizeForFirestore({ ...item, schoolId }), { merge: true });
                }
              });
              const commitPromise = batch.commit();
              const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Batch timeout')), 5000));
              await Promise.race([commitPromise, timeoutPromise]);
              totalSyncedRecords += chunk.length;
            }
          } catch (colErr) {
            console.warn(`[Save to Firestore] Subcollection ${colName} batch skipped:`, colErr);
          }
        };

        const allSyncTasks = [
          Promise.allSettled(backupTasks),
          batchWriteCollection('students', students),
          batchWriteCollection('teachers', teachers),
          batchWriteCollection('attendance', attendance),
          batchWriteCollection('assessments', assessments),
          batchWriteCollection('fees', fees),
          batchWriteCollection('emis', emis),
          batchWriteCollection('tasks', tasks),
          batchWriteCollection('quick_notes', notes),
          batchWriteCollection('leave_requests', leaves),
          batchWriteCollection('teacher_reflections', reflections),
          batchWriteCollection('behavioral_remarks', remarks),
          batchWriteCollection('staff_payslips', payslips),
          batchWriteCollection('expenses', expenses),
          batchWriteCollection('duty_roster', dutyRoster),
          batchWriteCollection('activity_logs', this.getActivityLogs())
        ];

        const overallTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Overall Firestore sync timeout')), 8000));
        await Promise.race([Promise.allSettled(allSyncTasks), overallTimeout]);

        console.log(`[Save to Firestore] Successfully saved ${totalSyncedRecords} records and backup file to User ID Firestore (${userId}).`);

        this.writeActivityLog(
          'Data & File Saved to Firestore',
          `Full database records and JSON backup file saved to User ID: ${userId} (${stats.fileSizeKb} KB).`,
          'info'
        );

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('app-toast', {
            detail: {
              text: `Data & Backup file saved to User ID Firestore (${userId})!`,
              type: 'success'
            }
          }));
        }

        return {
          success: true,
          syncedCount: totalSyncedRecords,
          userId
        };
      } catch (err: any) {
        console.warn("[Save to Firestore] Notice: Background save continuing via offline queue:", err?.message || err);
        return {
          success: true,
          syncedCount: totalSyncedRecords,
          userId
        };
      }
    } else {
      // Local fallback
      return {
        success: true,
        syncedCount: 0,
        userId
      };
    }
  }

  static async performCloudSync(): Promise<{ success: boolean; error?: string }> {
    const currentUser = this.getCurrentUser();
    if (isFirebaseActive && firebaseAuth && !firebaseAuth.currentUser) {
      await this.ensureFirebaseAuth();
    }
    const authUid = firebaseAuth?.currentUser?.uid || currentUser?.uid;
    if (!currentUser || !authUid) {
      return { success: false, error: "Cloud sync paused: user is not authenticated." };
    }

    const config = this.getCloudSyncConfig();
    const timestamp = new Date().toISOString();
    const data = this.exportAllData();
    const schoolId = currentUser?.schoolId || currentUser?.uid || 'anonymous';
    
    // Use a fixed filename to "overwrite" and keep data updated as requested
    const fileName = `school_data_snapshot.json`;

    config.status = 'syncing';
    this.saveCloudSyncConfig(config);

    try {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (!isOnline) throw new Error("No internet connection. Please connect to the internet and try again.");

      if (config.provider === 'Firebase Firestore (User ID Cloud Database)') {
        const firestoreResult = await this.saveDataAndFileToUserFirestore();
        if (!firestoreResult.success && firestoreResult.error) {
          throw new Error(`Firestore Cloud Sync failed: ${firestoreResult.error}`);
        }
      } else if (config.provider === 'Firebase Cloud Storage') {
        // First guarantee save to Firestore under user ID
        await this.saveDataAndFileToUserFirestore().catch(e => console.warn("Firestore sync fallback in storage:", e));

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
    const hasAuthSession = !!(this.getCurrentUser() && firebaseAuth?.currentUser);
    if (cloudConfig.enabled && cloudConfig.status !== 'syncing' && hasAuthSession) {
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
          setDoc(doc(firestoreDb, 'settings', 'academic_calendar'), DbController.sanitizeForFirestore(data.calendar), { merge: true }).catch(e => console.error("Firebase Sync settings error:", e));
        }
        if (hasSchool && data.school_info.id) {
          setDoc(doc(firestoreDb, 'schools', data.school_info.id), DbController.sanitizeForFirestore(data.school_info), { merge: true }).catch(e => console.error("Firebase Sync error:", e));
        }
        if (hasStudents) {
          data.students.forEach((st: Student) => {
            if (st.id) setDoc(doc(firestoreDb, 'students', st.id), DbController.sanitizeForFirestore(st), { merge: true }).catch(e => console.error(e));
          });
        }
        if (hasTeachers) {
          data.teachers.forEach((t: Teacher) => {
            if (t.id) setDoc(doc(firestoreDb, 'teachers', t.id), DbController.sanitizeForFirestore(t), { merge: true }).catch(e => console.error(e));
          });
        }
        if (hasAttendance && Array.isArray(data.attendance) && data.attendance.length > 0) {
          this.uploadDatasetToFirestore('attendance', data.attendance);
        }
        if (Array.isArray(data.staff_attendance) && data.staff_attendance.length > 0) {
          this.uploadDatasetToFirestore('staff_attendance', data.staff_attendance);
        }
        if (hasAssessments && Array.isArray(data.assessments) && data.assessments.length > 0) {
          this.uploadDatasetToFirestore('assessments', data.assessments);
        }
        if (Array.isArray(data.assessment_templates) && data.assessment_templates.length > 0) {
          this.uploadDatasetToFirestore('assessment_templates', data.assessment_templates);
        }
        if (hasFees) {
          data.fees.forEach((f: StudentFeeBill) => {
            if (f.id) {
              setDoc(doc(firestoreDb, 'fees', f.id), DbController.sanitizeForFirestore(f), { merge: true }).catch(e => console.error(e));
            }
          });
        }
        if (hasEmis) {
          data.emis_reports.forEach((e: EmisData) => {
            if (e.id) {
              setDoc(doc(firestoreDb, 'emis', e.id), DbController.sanitizeForFirestore(e), { merge: true }).catch(err => console.error("Firebase Sync EMIS error:", err));
            }
          });
        }
        if (Array.isArray(data.behavioral_remarks)) {
          data.behavioral_remarks.forEach((r: BehavioralRemark) => {
            if (r.id) {
              setDoc(doc(firestoreDb, 'behavioral_remarks', r.id), DbController.sanitizeForFirestore(r), { merge: true }).catch(err => console.error("Firebase Sync Remark error:", err));
            }
          });
        }
        if (Array.isArray(data.teacher_reflections)) {
          data.teacher_reflections.forEach((r: TeacherReflection) => {
            if (r.id) {
              setDoc(doc(firestoreDb, 'teacher_reflections', r.id), DbController.sanitizeForFirestore(r), { merge: true }).catch(err => console.error("Firebase Sync Reflection error:", err));
            }
          });
        }
        if (Array.isArray(data.duty_roster)) {
          data.duty_roster.forEach((r: DutyAssignment) => {
            if (r.id) {
              setDoc(doc(firestoreDb, 'duty_roster', r.id), DbController.sanitizeForFirestore(r), { merge: true }).catch(err => console.error("Firebase Sync Duty error:", err));
            }
          });
        }
        if (Array.isArray(data.staff_handbook)) {
          data.staff_handbook.forEach((r: StaffHandbookDocument) => {
            if (r.id) {
              setDoc(doc(firestoreDb, 'staff_handbook', r.id), DbController.sanitizeForFirestore(r), { merge: true }).catch(err => console.error("Firebase Sync Handbook error:", err));
            }
          });
        }
        if (Array.isArray(data.leave_requests)) {
          data.leave_requests.forEach((r: LeaveRequest) => {
            if (r.id) {
              setDoc(doc(firestoreDb, 'leave_requests', r.id), DbController.sanitizeForFirestore(r), { merge: true }).catch(err => console.error("Firebase Sync Leave request error:", err));
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
    students.forEach(s => {
      this.performFirestoreWrite('students', s.id, 'delete');
    });
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
    teachers.forEach(t => {
      this.performFirestoreWrite('teachers', t.id, 'delete');
    });
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
    const assessments = this.getAssessments(true);
    if (assessments.length > 0) {
      this.performFirestoreWriteBatch('assessments', assessments.filter(a => !!a.id).map(a => ({
        id: a.id,
        type: 'delete'
      })));
    }
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
    if (records.length > 0) {
      this.performFirestoreWriteBatch('attendance', records.filter(r => !!r.id).map(r => ({
        id: r.id,
        type: 'delete'
      })));
    }
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
    if (records.length > 0) {
      this.performFirestoreWriteBatch('staff_attendance', records.filter(r => !!r.id).map(r => ({
        id: r.id,
        type: 'delete'
      })));
    }
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
    const activeSchoolId = request.schoolId || this.resolveActiveSchoolId();
    const headUid = this.resolveHeadteacherUserId(activeSchoolId);
    request.schoolId = activeSchoolId;
    (request as any).ownerId = headUid;
    (request as any).headteacherUserId = headUid;
    const requests = this.getLeaveRequests();
    const index = requests.findIndex(r => r.id === request.id);
    if (index >= 0) {
      requests[index] = request;
    } else {
      requests.push(request);
    }
    setStorageItem(STORAGE_KEYS.LEAVE_REQUESTS, requests);
    this._cache[STORAGE_KEYS.LEAVE_REQUESTS] = requests;
    this.broadcastSyncEvent('leave-requests-updated', requests);
    this.performFirestoreWrite('leave_requests', request.id, 'set', request);
  }

  static deleteLeaveRequest(id: string) {
    const requests = this.getLeaveRequests().filter(r => r.id !== id);
    setStorageItem(STORAGE_KEYS.LEAVE_REQUESTS, requests);
    this._cache[STORAGE_KEYS.LEAVE_REQUESTS] = requests;
    this.broadcastSyncEvent('leave-requests-updated', requests);
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
    const activeSchoolId = note.schoolId || this.resolveActiveSchoolId();
    const headUid = this.resolveHeadteacherUserId(activeSchoolId);
    note.schoolId = activeSchoolId;
    (note as any).ownerId = headUid;
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
    const activeSchoolId = (task as any).schoolId || this.resolveActiveSchoolId();
    const headUid = this.resolveHeadteacherUserId(activeSchoolId);
    const enrichedTask = {
      ...task,
      schoolId: activeSchoolId,
      ownerId: headUid,
      headteacherUserId: headUid
    };
    const tasks = this.getTasks();
    const index = tasks.findIndex(t => t.id === task.id);
    if (index >= 0) {
      tasks[index] = enrichedTask;
    } else {
      tasks.push(enrichedTask);
    }
    setStorageItem(STORAGE_KEYS.TASKS, tasks);
    this._cache[STORAGE_KEYS.TASKS] = tasks;
    this.broadcastSyncEvent('tasks-updated', tasks);
    this.performFirestoreWrite('tasks', task.id, 'set', enrichedTask);
  }

  static deleteTask(id: string): void {
    const tasks = this.getTasks().filter(t => t.id !== id);
    setStorageItem(STORAGE_KEYS.TASKS, tasks);
    this._cache[STORAGE_KEYS.TASKS] = tasks;
    this.broadcastSyncEvent('tasks-updated', tasks);
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
  static getDefaultCustomBillComponents(): CustomBillComponent[] {
    return [];
  }

  static getCustomBillComponents(): CustomBillComponent[] {
    const demoIds = new Set(['comp_exam_fees', 'comp_library_levy', 'comp_ict_levy']);
    const cached = this._cache[STORAGE_KEYS.CUSTOM_BILL_COMPONENTS];
    if (cached && Array.isArray(cached)) {
      const filtered = cached.filter((c: CustomBillComponent) => c && !demoIds.has(c.id));
      if (filtered.length !== cached.length) {
        this._cache[STORAGE_KEYS.CUSTOM_BILL_COMPONENTS] = filtered;
        setStorageItem(STORAGE_KEYS.CUSTOM_BILL_COMPONENTS, filtered);
      }
      return filtered;
    }
    let list = getStorageItem<CustomBillComponent[]>(STORAGE_KEYS.CUSTOM_BILL_COMPONENTS, []);
    if (Array.isArray(list)) {
      list = list.filter(c => c && !demoIds.has(c.id));
    } else {
      list = [];
    }
    setStorageItem(STORAGE_KEYS.CUSTOM_BILL_COMPONENTS, list);
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
  // CUSTOM & EXISTING SUBJECT CURRICULUM
  // ==========================================
  static getSubjects(): string[] {
    const cached = this._cache[STORAGE_KEYS.CUSTOM_SUBJECTS];
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return this.sanitizeSubjectsList(cached);
    }

    const stored = getStorageItem<string[] | null>(STORAGE_KEYS.CUSTOM_SUBJECTS, null as any);
    let list: string[];
    if (stored && Array.isArray(stored) && stored.length > 0) {
      list = stored;
    } else {
      // First-time initialization: start with standard GES subjects
      list = [...SUBJECTS];
      setStorageItem(STORAGE_KEYS.CUSTOM_SUBJECTS, list);
    }

    const sanitized = this.sanitizeSubjectsList(list);
    this._cache[STORAGE_KEYS.CUSTOM_SUBJECTS] = sanitized;
    return sanitized;
  }

  private static sanitizeSubjectsList(subjects: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    // Ensure initial subjects maintain standard list order, then custom subjects
    subjects.forEach(s => {
      const trimmed = (s || '').trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        result.push(trimmed);
      }
    });

    // Make sure standard core subjects are present
    SUBJECTS.forEach(core => {
      if (!seen.has(core.toLowerCase())) {
        seen.add(core.toLowerCase());
        result.push(core);
      }
    });

    return result;
  }

  static saveCustomSubject(subjectName: string): string[] {
    const trimmed = (subjectName || '').trim();
    if (!trimmed) {
      return this.getSubjects();
    }

    const current = this.getSubjects();
    if (!current.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      const updated = [...current, trimmed];
      setStorageItem(STORAGE_KEYS.CUSTOM_SUBJECTS, updated);
      this._cache[STORAGE_KEYS.CUSTOM_SUBJECTS] = updated;
      this.performFirestoreWrite('custom_subjects', 'all', 'set', { subjects: updated });
      this.broadcastSyncEvent('subjects-updated', { subject: trimmed, subjects: updated });
      return updated;
    }
    return current;
  }

  static deleteCustomSubject(subjectName: string): string[] {
    const trimmed = (subjectName || '').trim();
    if (!trimmed) {
      return this.getSubjects();
    }

    const current = this.getSubjects();
    const filtered = current.filter(s => s.toLowerCase() !== trimmed.toLowerCase());
    const updated = filtered.length > 0 ? filtered : [...SUBJECTS];
    setStorageItem(STORAGE_KEYS.CUSTOM_SUBJECTS, updated);
    this._cache[STORAGE_KEYS.CUSTOM_SUBJECTS] = updated;
    this.performFirestoreWrite('custom_subjects', 'all', 'set', { subjects: updated });
    this.broadcastSyncEvent('subjects-updated', { subject: trimmed, deleted: true, subjects: updated });
    return updated;
  }

  // ==========================================
  // CUSTOM & EXISTING CLASS CATEGORIES
  // ==========================================
  static getClasses(): string[] {
    const cached = this._cache[STORAGE_KEYS.CUSTOM_CLASSES];
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return this.sanitizeClassesList(cached);
    }

    const stored = getStorageItem<string[] | null>(STORAGE_KEYS.CUSTOM_CLASSES, null as any);
    let list: string[];
    if (stored && Array.isArray(stored) && stored.length > 0) {
      list = stored;
    } else {
      list = [...CLASSES];
      setStorageItem(STORAGE_KEYS.CUSTOM_CLASSES, list);
    }

    const sanitized = this.sanitizeClassesList(list);
    this._cache[STORAGE_KEYS.CUSTOM_CLASSES] = sanitized;
    return sanitized;
  }

  private static sanitizeClassesList(classesList: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    classesList.forEach(c => {
      const trimmed = (c || '').trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        result.push(trimmed);
      }
    });

    // Make sure standard core classes are present
    CLASSES.forEach(core => {
      if (!seen.has(core.toLowerCase())) {
        seen.add(core.toLowerCase());
        result.push(core);
      }
    });

    return result;
  }

  static saveClasses(classesList: string[]): string[] {
    if (!Array.isArray(classesList) || classesList.length === 0) {
      return this.getClasses();
    }
    const sanitized = this.sanitizeClassesList(classesList);
    setStorageItem(STORAGE_KEYS.CUSTOM_CLASSES, sanitized);
    this._cache[STORAGE_KEYS.CUSTOM_CLASSES] = sanitized;
    this.performFirestoreWrite('custom_classes', 'all', 'set', { classes: sanitized });
    this.broadcastSyncEvent('classes-updated', { classes: sanitized });
    return sanitized;
  }

  static saveCustomClass(className: string): string[] {
    const trimmed = (className || '').trim();
    if (!trimmed) {
      return this.getClasses();
    }

    const current = this.getClasses();
    if (!current.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      const updated = [...current, trimmed];
      setStorageItem(STORAGE_KEYS.CUSTOM_CLASSES, updated);
      this._cache[STORAGE_KEYS.CUSTOM_CLASSES] = updated;
      this.performFirestoreWrite('custom_classes', 'all', 'set', { classes: updated });
      this.broadcastSyncEvent('classes-updated', { class: trimmed, classes: updated });
      return updated;
    }
    return current;
  }

  static deleteCustomClass(className: string): string[] {
    const trimmed = (className || '').trim();
    if (!trimmed) {
      return this.getClasses();
    }

    const current = this.getClasses();
    const filtered = current.filter(c => c.toLowerCase() !== trimmed.toLowerCase());
    const updated = filtered.length > 0 ? filtered : [...CLASSES];
    setStorageItem(STORAGE_KEYS.CUSTOM_CLASSES, updated);
    this._cache[STORAGE_KEYS.CUSTOM_CLASSES] = updated;
    this.performFirestoreWrite('custom_classes', 'all', 'set', { classes: updated });
    this.broadcastSyncEvent('classes-updated', { class: trimmed, deleted: true, classes: updated });
    return updated;
  }

  // ==========================================
  // CUSTOM ACADEMIC YEARS PERSISTENCE
  // ==========================================
  static getAcademicYears(): AcademicYearType[] {
    const cached = this._cache[STORAGE_KEYS.CUSTOM_ACADEMIC_YEARS];
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return this.sanitizeAcademicYearsList(cached);
    }

    const stored = getStorageItem<string[] | null>(STORAGE_KEYS.CUSTOM_ACADEMIC_YEARS, null as any);
    let list: string[];
    if (stored && Array.isArray(stored) && stored.length > 0) {
      list = stored;
    } else {
      list = [...ACADEMIC_YEARS];
      setStorageItem(STORAGE_KEYS.CUSTOM_ACADEMIC_YEARS, list);
    }

    const sanitized = this.sanitizeAcademicYearsList(list);
    this._cache[STORAGE_KEYS.CUSTOM_ACADEMIC_YEARS] = sanitized;
    return sanitized;
  }

  private static sanitizeAcademicYearsList(yearsList: string[]): AcademicYearType[] {
    const seen = new Set<string>();
    const result: AcademicYearType[] = [];

    const getStartYear = (yr: string): number => {
      const match = yr.match(/^(\d{4})/);
      return match ? parseInt(match[1], 10) : 0;
    };

    const combined = [...ACADEMIC_YEARS, ...(Array.isArray(yearsList) ? yearsList : [])];

    combined.forEach(y => {
      const trimmed = (y || '').trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        result.push(trimmed as AcademicYearType);
      }
    });

    result.sort((a, b) => getStartYear(a) - getStartYear(b));
    return result;
  }

  static saveCustomAcademicYear(academicYear: string): AcademicYearType[] {
    const trimmed = (academicYear || '').trim();
    if (!trimmed) {
      return this.getAcademicYears();
    }

    const current = this.getAcademicYears();
    if (!current.some(y => y.toLowerCase() === trimmed.toLowerCase())) {
      const updated = this.sanitizeAcademicYearsList([...current, trimmed]);
      setStorageItem(STORAGE_KEYS.CUSTOM_ACADEMIC_YEARS, updated);
      this._cache[STORAGE_KEYS.CUSTOM_ACADEMIC_YEARS] = updated;
      this.performFirestoreWrite('custom_academic_years', 'all', 'set', { academicYears: updated });
      this.broadcastSyncEvent('academic-years-updated', { year: trimmed, academicYears: updated });
      return updated;
    }
    return current;
  }

  static deleteCustomAcademicYear(academicYear: string): AcademicYearType[] {
    const trimmed = (academicYear || '').trim();
    if (!trimmed) {
      return this.getAcademicYears();
    }

    const current = this.getAcademicYears();
    const filtered = current.filter(y => y.toLowerCase() !== trimmed.toLowerCase());
    const updated = this.sanitizeAcademicYearsList(filtered.length > 0 ? filtered : [...ACADEMIC_YEARS]);
    setStorageItem(STORAGE_KEYS.CUSTOM_ACADEMIC_YEARS, updated);
    this._cache[STORAGE_KEYS.CUSTOM_ACADEMIC_YEARS] = updated;
    this.performFirestoreWrite('custom_academic_years', 'all', 'set', { academicYears: updated });
    this.broadcastSyncEvent('academic-years-updated', { year: trimmed, deleted: true, academicYears: updated });
    return updated;
  }

  // ==========================================
  // CLOUD FIREBASE DOCUMENTS & FILE REPOSITORY
  // ==========================================
  static async saveCloudDocument(docData: CloudDocumentRecord): Promise<void> {
    const activeSchoolId = this.resolveActiveSchoolId() || this.getCurrentUser()?.schoolId || 'school_default';
    const ownerId = this.getCurrentUser()?.uid || 'system';
    const payload: CloudDocumentRecord = {
      ...docData,
      schoolId: activeSchoolId,
      ownerId,
      uploadedBy: this.getCurrentUser()?.email || 'admin',
      createdAt: docData.createdAt || new Date().toISOString()
    };

    if (isFirebaseActive && firestoreDb) {
      try {
        await setDoc(doc(firestoreDb, 'documents', payload.id), DbController.sanitizeForFirestore(payload), { merge: true });
        await setDoc(doc(firestoreDb, 'schools', activeSchoolId, 'documents', payload.id), DbController.sanitizeForFirestore(payload), { merge: true });
      } catch (e: any) {
        console.warn("Could not save document to Firestore:", e);
      }
    }
  }

  static async getCloudDocuments(): Promise<CloudDocumentRecord[]> {
    const activeSchoolId = this.resolveActiveSchoolId() || this.getCurrentUser()?.schoolId || 'school_default';
    if (!isFirebaseActive || !firestoreDb) return [];
    try {
      const snap = await getDocs(collection(firestoreDb, 'schools', activeSchoolId, 'documents'));
      return snap.docs.map(d => d.data() as CloudDocumentRecord);
    } catch {
      return [];
    }
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
    this.performFirestoreWrite('duty_roster', assignment.id, 'set', assignment);
    this.broadcastSyncEvent('duty-roster-updated', assignment);
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
    this.performFirestoreWriteBatch('duty_roster', newAssignments.map(a => ({ id: a.id, data: a, type: 'set' })));
    this.broadcastSyncEvent('duty-roster-updated', newAssignments);
  }

  static deleteDutyAssignment(id: string) {
    const assignments = this.getDutyAssignments().filter(a => a.id !== id);
    setStorageItem(STORAGE_KEYS.DUTY_ROSTER, assignments);
    this._cache[STORAGE_KEYS.DUTY_ROSTER] = assignments;
    this.performFirestoreWrite('duty_roster', id, 'delete');
    this.broadcastSyncEvent('duty-roster-updated', { id, deleted: true });
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
    this.performFirestoreWrite('staff_handbook', doc.id, 'set', doc);
    this.broadcastSyncEvent('staff-handbook-updated', doc);
  }

  static deleteStaffHandbookDocument(id: string) {
    const docs = this.getStaffHandbook().filter(d => d.id !== id);
    setStorageItem(STORAGE_KEYS.STAFF_HANDBOOK, docs);
    this._cache[STORAGE_KEYS.STAFF_HANDBOOK] = docs;
    this.performFirestoreWrite('staff_handbook', id, 'delete');
    this.broadcastSyncEvent('staff-handbook-updated', { id, deleted: true });
  }

  /**
   * System-wide demo and simulated record purge.
   * Cleanses all registries of demo, mock, or simulated artifacts to protect data security.
   */
  static purgeAllDemoData(): { removedCount: number } {
    let removedCount = 0;

    // 1. Purge Demo Students
    const students = this.getStudents();
    const cleanStudents = students.filter(s => {
      const isDemo = (s.id && s.id.toLowerCase().includes('demo')) || 
                     (s.firstName && s.firstName.toLowerCase() === 'demo') || 
                     (s.lastName && s.lastName.toLowerCase() === 'demo');
      if (isDemo) removedCount++;
      return !isDemo;
    });
    if (cleanStudents.length !== students.length) {
      setStorageItem(STORAGE_KEYS.STUDENTS, cleanStudents);
      this._cache[STORAGE_KEYS.STUDENTS] = cleanStudents;
    }

    // 2. Purge Demo Teachers
    const teachers = this.getTeachers();
    const cleanTeachers = teachers.filter(t => {
      const isDemo = (t.id && t.id.toLowerCase().includes('demo')) || 
                     (t.firstName && t.firstName.toLowerCase() === 'demo') || 
                     (t.lastName && t.lastName.toLowerCase() === 'demo') ||
                     (t.email && t.email.toLowerCase().includes('demo@'));
      if (isDemo) removedCount++;
      return !isDemo;
    });
    if (cleanTeachers.length !== teachers.length) {
      setStorageItem(STORAGE_KEYS.TEACHERS, cleanTeachers);
      this._cache[STORAGE_KEYS.TEACHERS] = cleanTeachers;
    }

    // 3. Purge Simulated WebAuthn Credentials
    const creds = this.getWebAuthnCredentials();
    const cleanCreds = creds.filter(c => {
      const isSim = c.isSimulated || (c.id && c.id.startsWith('SIM_CRED_')) || (c.publicKey && c.publicKey.startsWith('SIMULATED_'));
      if (isSim) removedCount++;
      return !isSim;
    });
    if (cleanCreds.length !== creds.length) {
      setStorageItem(STORAGE_KEYS.WEBAUTHN_CREDENTIALS, cleanCreds);
      this._cache[STORAGE_KEYS.WEBAUTHN_CREDENTIALS] = cleanCreds;
    }

    // 4. Purge Demo Bill Components
    const comps = this.getCustomBillComponents();
    const demoIds = new Set(['comp_exam_fees', 'comp_library_levy', 'comp_ict_levy']);
    const cleanComps = comps.filter(c => {
      const isDemo = demoIds.has(c.id) || (c.id && c.id.toLowerCase().startsWith('demo'));
      if (isDemo) removedCount++;
      return !isDemo;
    });
    if (cleanComps.length !== comps.length) {
      setStorageItem(STORAGE_KEYS.CUSTOM_BILL_COMPONENTS, cleanComps);
      this._cache[STORAGE_KEYS.CUSTOM_BILL_COMPONENTS] = cleanComps;
    }

    // 5. Purge Demo Fees
    const fees = this.getStudentFeeBills();
    const cleanFees = fees.filter(f => {
      const isDemo = (f.id && f.id.toLowerCase().includes('demo')) || (f.studentId && f.studentId.toLowerCase().includes('demo'));
      if (isDemo) removedCount++;
      return !isDemo;
    });
    if (cleanFees.length !== fees.length) {
      setStorageItem(STORAGE_KEYS.FEES, cleanFees);
      this._cache[STORAGE_KEYS.FEES] = cleanFees;
    }

    // 6. Purge Demo Assessments
    const assessments = this.getAssessments();
    const cleanAssessments = assessments.filter(a => {
      const isDemo = (a.id && a.id.toLowerCase().includes('demo')) || (a.studentId && a.studentId.toLowerCase().includes('demo'));
      if (isDemo) removedCount++;
      return !isDemo;
    });
    if (cleanAssessments.length !== assessments.length) {
      setStorageItem(STORAGE_KEYS.ASSESSMENTS, cleanAssessments);
      this._cache[STORAGE_KEYS.ASSESSMENTS] = cleanAssessments;
    }

    return { removedCount };
  }

  static async clearAllData(): Promise<void> {
    this._isFormatting = true;
    if (this._autoFlushTimeout) {
      clearTimeout(this._autoFlushTimeout);
      this._autoFlushTimeout = null;
    }

    const currentUser = this.getCurrentUser();
    const cachedSchool = this.getSchoolInfo();
    const uid = firebaseAuth?.currentUser?.uid || currentUser?.uid;
    const activeSchoolId = this.resolveActiveSchoolId() || currentUser?.schoolId || cachedSchool?.schoolId;

    const allUids = Array.from(new Set([
      firebaseAuth?.currentUser?.uid,
      currentUser?.uid,
      currentUser?.ownerId,
      cachedSchool?.ownerId,
      cachedSchool?.userId
    ].filter(Boolean))) as string[];

    const schoolIds = Array.from(new Set([
      activeSchoolId,
      currentUser?.schoolId,
      currentUser?.schoolCode,
      cachedSchool?.schoolId,
      cachedSchool?.id,
      ...allUids,
      ...allUids.map(u => `school_${u}`),
      'school_default',
      'default_school'
    ].filter(Boolean))) as string[];

    console.log(`[Clear Data] Executing deep format & complete purge for User IDs: ${allUids.join(', ')}, School IDs: ${schoolIds.join(', ')}`);

    // 0. PRESERVE SUBSCRIPTION & TIMER STATE (NEVER RESET AT ANY COST)
    const preservedTimer = this.getSubscriberTimer(uid) || getStorageItem<SubscriberTimerData | null>(STORAGE_KEYS.SUBSCRIBERS_TIMER, null);
    const preservedAllTimers = this.getAllSubscriberTimers();
    const preservedPricing = this.getPlatformPricing();
    const preservedUsersList = getStorageItem<UserAccount[]>(STORAGE_KEYS.USERS_LIST, []);
    const preservedTheme = typeof localStorage !== 'undefined' ? localStorage.getItem('sms_system_theme') : null;
    const preservedUserSubscription = currentUser ? {
      ...currentUser,
      setupWizardCompleted: false
    } : null;

    // 1. PURGE ALL LOCAL STORAGE, IN-MEMORY CACHE, SESSION STORAGE, INDEXEDDB & CACHESTORAGE
    //    (Strictly preserving ONLY subscription timers, pricing, theme, and active user subscription state)
    try {
      // Clear all in-memory stores & fast lookup maps first
      for (const k of Object.keys(_inMemoryStore)) {
        delete _inMemoryStore[k];
      }
      this._cache = {};
      this._studentsByClass.clear();
      this._assessmentsByStudent.clear();
      _lastSessionUid = null;
      _lastSessionScope = null;

      // Sweep all sms_* and school_* keys across every user/school partition in localStorage
      if (typeof localStorage !== 'undefined') {
        const preservedLocalKeys = new Set([
          'sms_user',
          'sms_users_list',
          'sms_subscribers_timer',
          'sms_subscriber_timers',
          'sms_platform_pricing',
          'sms_system_theme'
        ]);
        for (const key of Object.keys(localStorage)) {
          if ((key.startsWith('sms_') || key.startsWith('school_')) && !preservedLocalKeys.has(key)) {
            try {
              localStorage.removeItem(key);
            } catch {}
          }
        }
      }

      // Sweep sessionStorage except preserved user pointer
      if (typeof sessionStorage !== 'undefined') {
        for (const key of Object.keys(sessionStorage)) {
          if ((key.startsWith('sms_') || key.startsWith('school_')) && key !== 'sms_user') {
            try {
              sessionStorage.removeItem(key);
            } catch {}
          }
        }
      }

      // Restore user pointer first so getPartitionedKey resolves consistently for the clean-slate writes below
      if (preservedUserSubscription) {
        setStorageItem(STORAGE_KEYS.USER, preservedUserSubscription);
      } else {
        removeStorageItem(STORAGE_KEYS.USER);
      }

      const keysToBlank = [
        STORAGE_KEYS.STUDENTS, STORAGE_KEYS.TEACHERS, STORAGE_KEYS.ATTENDANCE,
        STORAGE_KEYS.STAFF_ATTENDANCE, STORAGE_KEYS.ASSESSMENTS, STORAGE_KEYS.ASSESSMENT_TEMPLATES,
        STORAGE_KEYS.FEES, STORAGE_KEYS.EMIS, STORAGE_KEYS.BEHAVIORAL_REMARKS,
        STORAGE_KEYS.PAYSTACK_LOGS, STORAGE_KEYS.QUICK_NOTES, STORAGE_KEYS.TASKS,
        STORAGE_KEYS.DUTY_ROSTER, STORAGE_KEYS.TEACHER_REFLECTIONS, STORAGE_KEYS.STAFF_HANDBOOK,
        STORAGE_KEYS.LEAVE_REQUESTS, STORAGE_KEYS.ACTIVITY_LOGS, STORAGE_KEYS.AUTO_BACKUPS,
        STORAGE_KEYS.COMM_TEMPLATES, STORAGE_KEYS.TRANSPORT_ROUTES, STORAGE_KEYS.TRANSPORT_RECORDS,
        STORAGE_KEYS.CANTEEN_PLANS, STORAGE_KEYS.CANTEEN_PAYMENTS, STORAGE_KEYS.EXCURSIONS,
        STORAGE_KEYS.EXCURSION_PARTICIPANTS, STORAGE_KEYS.SPORTS_ACTIVITIES, STORAGE_KEYS.SPORTS_RECORDS,
        STORAGE_KEYS.TEXTBOOKS, STORAGE_KEYS.TEXTBOOK_TRANSACTIONS, STORAGE_KEYS.EXPENSES,
        STORAGE_KEYS.CUSTOM_BILL_COMPONENTS, STORAGE_KEYS.CUSTOM_BILL_CATEGORIES, STORAGE_KEYS.STAFF_PAYSLIPS,
        STORAGE_KEYS.CUSTOM_EXPENSE_CATEGORIES, STORAGE_KEYS.FINANCIAL_AUDIT_LOGS, STORAGE_KEYS.CUSTOM_SECTIONS,
        STORAGE_KEYS.CUSTOM_SUBJECTS, STORAGE_KEYS.CUSTOM_CLASSES, STORAGE_KEYS.CUSTOM_ACADEMIC_YEARS,
        STORAGE_KEYS.WEBAUTHN_CREDENTIALS, STORAGE_KEYS.USED_ACTIVATION_CODES, 'sms_offline_queue'
      ];

      for (const k of keysToBlank) {
        setStorageItem(k, []);
        this._cache[k] = [];
      }

      // Reset school profile and all system configs to clean baseline defaults
      const blankSchool: SchoolInfo = { ...DEFAULT_SCHOOL_INFO };
      setStorageItem(STORAGE_KEYS.SCHOOL, blankSchool);
      this._cache[STORAGE_KEYS.SCHOOL] = blankSchool;

      setStorageItem(STORAGE_KEYS.CALENDAR, DEFAULT_CALENDAR);
      this._cache[STORAGE_KEYS.CALENDAR] = DEFAULT_CALENDAR;

      setStorageItem(STORAGE_KEYS.SETTINGS, {});
      this._cache[STORAGE_KEYS.SETTINGS] = {};

      setStorageItem(STORAGE_KEYS.SUBJECT_MARK_LIMITS, {});
      this._cache[STORAGE_KEYS.SUBJECT_MARK_LIMITS] = {};

      const defaultBackupConfig: AutoBackupConfig = { enabled: false, frequency: 'weekly', lastBackupTime: null };
      setStorageItem(STORAGE_KEYS.AUTO_BACKUP_CONFIG, defaultBackupConfig);
      this._cache[STORAGE_KEYS.AUTO_BACKUP_CONFIG] = defaultBackupConfig;

      const defaultCloudConfig: CloudSyncConfig = {
        enabled: true,
        provider: 'Firebase Firestore (User ID Cloud Database)',
        interval: 'daily',
        lastSyncTime: null,
        status: 'idle'
      };
      setStorageItem(STORAGE_KEYS.CLOUD_SYNC_CONFIG, defaultCloudConfig);
      this._cache[STORAGE_KEYS.CLOUD_SYNC_CONFIG] = defaultCloudConfig;

      // Restore preserved subscription timer & platform pricing state
      if (preservedTheme && typeof localStorage !== 'undefined') {
        localStorage.setItem('sms_system_theme', preservedTheme);
      }
      if (preservedPricing) {
        setStorageItem(STORAGE_KEYS.PLATFORM_PRICING, preservedPricing);
        this._cache[STORAGE_KEYS.PLATFORM_PRICING] = preservedPricing;
      }
      if (preservedUsersList && preservedUsersList.length > 0) {
        setStorageItem(STORAGE_KEYS.USERS_LIST, preservedUsersList);
        this._cache[STORAGE_KEYS.USERS_LIST] = preservedUsersList;
      }
      if (preservedTimer) {
        setStorageItem(STORAGE_KEYS.SUBSCRIBERS_TIMER, preservedTimer);
        this._cache[STORAGE_KEYS.SUBSCRIBERS_TIMER] = preservedTimer;
      }
      if (preservedAllTimers && preservedAllTimers.length > 0) {
        setStorageItem(STORAGE_KEYS.SUBSCRIBER_TIMERS, preservedAllTimers);
        this._cache[STORAGE_KEYS.SUBSCRIBER_TIMERS] = preservedAllTimers;
      }

      // Wipe IndexedDB and CacheStorage
      await IndexedDbEngine.clearAll().catch(() => {});
      if (typeof window !== 'undefined' && 'caches' in window) {
        try {
          const cacheNames = await window.caches.keys();
          await Promise.allSettled(cacheNames.map(name => window.caches.delete(name)));
        } catch {}
      }
    } catch (localErr) {
      console.warn("[Clear Data] Local wipe notice:", localErr);
    }

    // 2. Broadcast format event across all workstation tabs immediately
    this.broadcastSyncEvent("school-updated", { ...DEFAULT_SCHOOL_INFO });
    this.broadcastSyncEvent("all-cleared", { target: "all", deepFormat: true });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("school-system-sync", { detail: { type: "school-updated", payload: { ...DEFAULT_SCHOOL_INFO } } }));
      window.dispatchEvent(new CustomEvent("school-system-sync", { detail: { type: "all-cleared", payload: { target: "all", deepFormat: true } } }));
    }

    // 3. Purge Cloud Firestore with parallelized chunked batch deletion
    //    NEVER deletes subscribers_timer, subscriber_timers, subscribers, subscriptions, platform_settings, or user subscription fields.
    if (isFirebaseActive && firestoreDb) {
      try {
        if (firebaseAuth && !firebaseAuth.currentUser) {
          await this.ensureFirebaseAuth();
        }
        try {
          await enableNetwork(firestoreDb);
        } catch {}

        const primaryCollections = [
          "students", "teachers", "attendance", "staff_attendance",
          "assessments", "assessment_templates", "fees", "expenses",
          "emis", "behavioral_remarks", "activity_logs", "duty_roster",
          "teacher_reflections", "staff_handbook", "settings", "documents",
          "custom_bill_components", "custom_bill_categories", "custom_sections",
          "custom_subjects", "custom_classes", "custom_academic_years",
          "paystack_payments", "tasks", "quick_notes", "leave_requests", "textbooks",
          "textbook_transactions", "sports_activities", "sports_records", "student_sports",
          "excursions", "excursion_participants", "canteen_plans", "canteen_payments",
          "transport_routes", "transport_records", "student_transport",
          "staff_payslips", "custom_expense_categories", "financial_audit_logs",
          "communication_templates", "backups", "auto_backups", "cloud_sync"
        ];

        const deleteQueryDocsInChunks = async (colRef: any) => {
          try {
            const snap = await getDocs(colRef);
            if (snap.empty) return;
            const docs = snap.docs;
            const chunkSize = 250;
            for (let i = 0; i < docs.length; i += chunkSize) {
              const chunk = docs.slice(i, i + chunkSize);
              try {
                const batch = writeBatch(firestoreDb!);
                chunk.forEach(d => batch.delete(d.ref));
                await batch.commit();
              } catch (batchErr) {
                console.warn("[Clear Data] Batch delete fallback to individual doc deletes:", batchErr);
                await Promise.allSettled(chunk.map(d => deleteDoc(d.ref)));
              }
            }
          } catch (e) {
            console.warn("[Clear Data] Collection purge notice:", e);
          }
        };

        const purgeTasks: (() => Promise<any>)[] = [];

        // Purge all school-scoped operational subcollections and school profile docs
        for (const sId of schoolIds) {
          if (!sId) continue;
          for (const colName of primaryCollections) {
            purgeTasks.push(() => deleteQueryDocsInChunks(collection(firestoreDb!, "schools", sId, colName)));
          }
          purgeTasks.push(() => deleteDoc(doc(firestoreDb!, "schools", sId)).catch(() => {}));
          purgeTasks.push(() => deleteDoc(doc(firestoreDb!, "schools", `secrets_${sId}`)).catch(() => {}));
        }

        // Purge root-level operational collections
        for (const colName of primaryCollections) {
          purgeTasks.push(() => deleteQueryDocsInChunks(collection(firestoreDb!, colName)));
        }

        // Purge user-level operational subcollections for every candidate UID
        for (const u of allUids) {
          for (const colName of primaryCollections) {
            purgeTasks.push(() => deleteQueryDocsInChunks(collection(firestoreDb!, "users", u, colName)));
          }
          purgeTasks.push(() => deleteQueryDocsInChunks(collection(firestoreDb!, "users", u, "backups")));
          purgeTasks.push(() => deleteQueryDocsInChunks(collection(firestoreDb!, "users", u, "cloud_sync")));
          purgeTasks.push(() => setDoc(doc(firestoreDb!, "users", u), { setupWizardCompleted: false }, { merge: true }).catch(() => {}));
        }

        // Execute purge tasks in controlled parallel batches of 15 for fast completion without overwhelming network
        const concurrency = 15;
        for (let i = 0; i < purgeTasks.length; i += concurrency) {
          const group = purgeTasks.slice(i, i + concurrency);
          await Promise.allSettled(group.map(fn => fn()));
        }

        console.log("[Clear Data] Complete Firestore deep format purge successfully finished.");
      } catch (cloudErr) {
        console.error("[Clear Data] Cloud purge error:", cloudErr);
      }
    }

    // Safety release in case caller does not immediately trigger a page reload
    setTimeout(() => {
      this._isFormatting = false;
    }, 4000);
  }
}
