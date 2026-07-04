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
  enableIndexedDbPersistence
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadString,
  getDownloadURL
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
  StaffHandbookDocument
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
  firestoreDatabaseId: (import.meta as any).env.VITE_FIREBASE_DATABASE_ID || (firebaseConfig as any).firestoreDatabaseId || 'ai-studio-a2d8d304-855b-466a-8f1a-47e69bbb165b'
};

const AES_SECRET_KEY = (import.meta as any).env.VITE_AES_SECRET_KEY || 'school_shield_default_secret_key_98234710';

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
    firestoreDb = initializeFirestore(firebaseApp, {
      experimentalForceLongPolling: true
    }, dbId);
    isFirebaseActive = true;
    console.log("Firebase initialized successfully with live database ID:", dbId);
    
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
          reject(new Error("Firestore connection handshake timed out after 3000ms"));
        }, 3000)
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
  STAFF_HANDBOOK: 'sms_staff_handbook'
};

// Get user-specific key prefix/suffix to support clean multi-user login and cross-device syncing
let _lastSessionUid: string | null = null;

export function getPartitionedKey(key: string): string {
  if (key === 'sms_user' || key === 'sms_users_list' || key === 'users_list' || key === 'webauthn_credentials') {
    return key;
  }
  
  try {
    const rawUser = sessionStorage.getItem('sms_user');
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
        if (!_lastSessionUid) _lastSessionUid = parsed.uid;
        // Lock the partition key to the UID established at the start of this session/tab 
        // to prevent data leakage into another account's partition if the user is switched 
        // in another tab. The App layer reloads on user change to eventually catch up.
        return `${key}_${_lastSessionUid}`;
      }
    }
  } catch (e) {
    console.error("Error reading user suffix for key partition:", e);
  }
  return `${key}_guest`;
}

// Helper helper to deep copy or get storage with client-side AES encryption/decryption
export function getStorageItem<T>(key: string, defaultValue: T): T {
  const partitionedKey = getPartitionedKey(key);
  const storage = key === 'sms_user' ? sessionStorage : localStorage;
  const item = storage.getItem(partitionedKey);
  if (!item) return defaultValue;
  try {
    // Try raw JSON parse first
    return JSON.parse(item) as T;
  } catch {
    // If not raw JSON, try decryption
    try {
      const bytes = CryptoJS.AES.decrypt(item, AES_SECRET_KEY);
      const parsedText = bytes.toString(CryptoJS.enc.Utf8);
      return JSON.parse(parsedText) as T;
    } catch (err) {
      console.warn(`[Client-side] Failed to get storage item for key "${partitionedKey}", falling back to default value:`, err);
      return defaultValue;
    }
  }
}

export function setStorageItem<T>(key: string, value: T): void {
  if (key === 'sms_user') {
    DbController.clearCache();
  }
  const partitionedKey = getPartitionedKey(key);
  const storage = key === 'sms_user' ? sessionStorage : localStorage;
  try {
    const rawString = JSON.stringify(value);
    const encrypted = CryptoJS.AES.encrypt(rawString, AES_SECRET_KEY).toString();
    try {
      storage.setItem(partitionedKey, encrypted);
    } catch (storageErr) {
      console.error(`[Storage] Direct write failed for key "${partitionedKey}" (likely quota exceeded):`, storageErr);
    }
  } catch (err) {
    console.error(`[Client-side AES] Encryption failed for key "${partitionedKey}":`, err);
    try {
      storage.setItem(partitionedKey, JSON.stringify(value));
    } catch (storageErr) {
      console.error(`[Storage] Fallback write failed for key "${partitionedKey}":`, storageErr);
    }
  }
}

export function removeStorageItem(key: string): void {
  const partitionedKey = getPartitionedKey(key);
  const storage = key === 'sms_user' ? sessionStorage : localStorage;
  storage.removeItem(partitionedKey);
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
  private static _cache: Record<string, any> = {};
  private static _assessmentsByStudent: Map<string, StudentAssessment[]> = new Map();
  private static _studentsByClass: Map<ClassType | string, Student[]> = new Map();

  static clearCache() {
    this._cache = {};
    this._assessmentsByStudent = new Map();
    this._studentsByClass = new Map();
  }

  static broadcastSyncEvent(type: string, payload: any) {
    try {
      // 1. Dispatch custom event for the current window/tab
      const event = new CustomEvent('school-system-sync', { detail: { type, payload } });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(event);
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
    
    // Inject ownerId for multi-tenancy if logged in and not the users collection
    const currentUser = this.getCurrentUser();
    
    // Determine the root collection path based on School ID (multi-tenancy)
    let collectionRef;
    if (currentUser && colName !== 'users' && colName !== 'settings') {
      const schoolId = currentUser.schoolId || currentUser.uid;
      collectionRef = collection(firestoreDb, 'schools', schoolId, colName);
    } else {
      collectionRef = collection(firestoreDb, colName);
    }

    if (!isOnline) {
      this.enqueueOfflineOperation(colName, safeDocId, type, safeData);
      return;
    }

    try {
      if (type === 'set') {
        const docRef = doc(collectionRef, safeDocId);
        await setDoc(docRef, { ...safeData, ownerId: currentUser?.uid });
      } else if (type === 'delete') {
        const docRef = doc(collectionRef, safeDocId);
        await deleteDoc(docRef);
      }
      console.log(`[Offline Sync] Successfully synced ${type} on ${colName}/${safeDocId} with Firestore.`);
    } catch (error) {
      console.warn(`[Offline Sync] Firestore write failed for ${colName}/${safeDocId}, queueing offline:`, error);
      this.enqueueOfflineOperation(colName, safeDocId, type, safeData);
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
    console.log(`[Offline Sync] Enqueued ${type} operation for offline document ${colName}/${docId}. Queue size: ${queue.length}`);
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sms_sync_status_changed'));
    }
  }

  static getOfflineQueueSize(): number {
    return getStorageItem<OfflineQueueItem[]>('sms_offline_queue', []).length;
  }

  // Auto-synchronize pending local writes with Firestore once online
  static async syncOfflineQueue(): Promise<{ success: boolean; syncedCount: number }> {
    if (!isFirebaseActive || !firestoreDb) return { success: false, syncedCount: 0 };
    if (this._isSyncing) return { success: false, syncedCount: 0 };
    
    const queue = getStorageItem<OfflineQueueItem[]>('sms_offline_queue', []);
    if (queue.length === 0) return { success: true, syncedCount: 0 };

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isOnline) {
      return { success: false, syncedCount: 0 };
    }

    this._isSyncing = true;
    console.log(`[Offline Sync] Active. Replaying ${queue.length} pending writes on Firestore...`);
    
    const remainingQueue: OfflineQueueItem[] = [];
    let syncedCount = 0;

    for (const item of queue) {
      try {
        const safeDocId = item.docId.replace(/\//g, '-');
        let safeData = item.data;
        if (safeData && safeData.id) {
          safeData = { ...safeData, id: safeDocId };
        }

        if (item.type === 'set') {
          const docRef = doc(firestoreDb, item.collection, safeDocId);
          await setDoc(docRef, safeData);
        } else if (item.type === 'delete') {
          const docRef = doc(firestoreDb, item.collection, safeDocId);
          await deleteDoc(docRef);
        }
        syncedCount++;
        console.log(`[Offline Sync] Replay success: ${item.type} on ${item.collection}/${safeDocId}`);
      } catch (e) {
        console.error(`[Offline Sync] Replay failed for item ${item.id}:`, e);
        remainingQueue.push(item);
      }
    }

    setStorageItem('sms_offline_queue', remainingQueue);
    this._isSyncing = false;
    
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
    return getStorageItem<UserAccount | null>(STORAGE_KEYS.USER, null);
  }

  static getRegisteredUsers(): UserAccount[] {
    // One-time system clear for new entry
    if (typeof window !== 'undefined') {
      const isCleared = localStorage.getItem('sms_system_cleared_june_30_v2');
      if (!isCleared) {
        localStorage.removeItem(STORAGE_KEYS.USERS_LIST);
        localStorage.setItem('sms_system_cleared_june_30_v2', 'true');
      }
    }

    const list = getStorageItem<UserAccount[]>(STORAGE_KEYS.USERS_LIST, []);
    
    // Filter out all Admin accounts except for pegyirenyi@gmail.com and filter out specific revoked duplicate ID
    const filtered = list.filter(user => {
      if (user.requestCode === 'REQ-PEGY-5103') return false;
      const isPegyirenyi = user.email.toLowerCase().trim() === 'pegyirenyi@gmail.com';
      if (isPegyirenyi) return true;
      return user.role !== 'Admin';
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
        requestCode: 'REQ-PEGY-9999'
      };
      filtered.push(newAdmin);
      setStorageItem(STORAGE_KEYS.USERS_LIST, filtered);
    }

    // Ensure sammyotoo06@gmail.com is present in the list as Headteacher
    const sammyIdx = filtered.findIndex(user => user.email.toLowerCase().trim() === 'sammyotoo06@gmail.com');
    if (sammyIdx >= 0) {
      let changed = false;
      if (filtered[sammyIdx].role !== 'Headteacher') {
        filtered[sammyIdx].role = 'Headteacher';
        changed = true;
      }
      if (!filtered[sammyIdx].schoolId) {
        filtered[sammyIdx].schoolId = this.getSchoolInfo().schoolId || 'school_default';
        changed = true;
      }
      if (changed) {
        setStorageItem(STORAGE_KEYS.USERS_LIST, filtered);
      }
    } else {
      const newHeadteacher: UserAccount = {
        uid: 'user_sammyotoo_headteacher',
        email: 'sammyotoo06@gmail.com',
        name: 'SAMMY OTOO',
        role: 'Headteacher',
        createdAt: createdNow,
        licenseType: 'unlimited',
        registeredOn: createdNow,
        requestCode: 'REQ-SAMY-8888',
        schoolId: this.getSchoolInfo().schoolId || 'school_default'
      };
      filtered.push(newHeadteacher);
      setStorageItem(STORAGE_KEYS.USERS_LIST, filtered);
    }

    // Persist filtered list if it changed
    if (filtered.length !== list.length) {
      setStorageItem(STORAGE_KEYS.USERS_LIST, filtered);
      this.saveRegisteredUsers(filtered).catch(err => {
        console.warn("Could not sync filtered user list to Firestore: ", err);
      });
    }

    return filtered;
  }

  static async saveRegisteredUsers(users: UserAccount[]): Promise<void> {
    // Safety check to ensure pegyirenyi@gmail.com remains the sole Admin
    const sanitized = users.filter(user => {
      if (user.requestCode === 'REQ-PEGY-5103') return false;
      const isPegyirenyi = user.email.toLowerCase().trim() === 'pegyirenyi@gmail.com';
      if (isPegyirenyi) return true;
      return user.role !== 'Admin';
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

    const sammyIdx = sanitized.findIndex(user => user.email.toLowerCase().trim() === 'sammyotoo06@gmail.com');
    if (sammyIdx >= 0) {
      sanitized[sammyIdx].role = 'Headteacher';
    } else {
      const createdNow = new Date().toISOString();
      sanitized.push({
        uid: 'user_sammyotoo_headteacher',
        email: 'sammyotoo06@gmail.com',
        name: 'SAMMY OTOO',
        role: 'Headteacher',
        createdAt: createdNow,
        licenseType: 'unlimited',
        registeredOn: createdNow,
        requestCode: 'REQ-SAMY-8888',
        schoolId: this.getSchoolInfo().schoolId || 'school_default'
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
          await setDoc(doc(firestoreDb, 'users', user.uid), user);
        }
        // Also update the global directory document for the security watchdog
        await setDoc(doc(firestoreDb, 'users', 'directory'), { list: sanitized, updatedAt: new Date().toISOString() });
      } catch (err) {
        console.warn("Could not sync user list to firestore: ", err);
      }
    }
    this.broadcastSyncEvent('users-updated', sanitized);
  }

  static determineRole(email: string): UserRole {
    const trimmedEmail = email.toLowerCase().trim();
    if (trimmedEmail === 'pegyirenyi@gmail.com') {
      return 'Admin';
    }
    if (trimmedEmail === 'sammyotoo06@gmail.com') {
      return 'Headteacher';
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
      if (existingUser.role === 'Admin') {
        return 'Teacher';
      }
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
    
    // Strict Access Control: No one should be able to sign in directly unless pre-authorized or pegyirenyi@gmail.com
    if (trimmedEmail !== 'pegyirenyi@gmail.com' && trimmedEmail !== 'sammyotoo06@gmail.com') {
      const isAuthorized = users.some(u => u.email.toLowerCase().trim() === trimmedEmail);
      if (!isAuthorized) {
        throw new Error("Access Denied: This email address is not authorized. Please contact the System Administrator (pegyirenyi@gmail.com) to authorize access.");
      }
    }

    if (trimmedEmail === 'pegyirenyi@gmail.com') {
      assignedRole = 'Admin';
    } else if (trimmedEmail === 'sammyotoo06@gmail.com') {
      assignedRole = 'Headteacher';
    } else if (assignedRole === 'Admin') {
      assignedRole = 'Teacher';
    }
    
    const existingUser = users.find(u => u.email.toLowerCase().trim() === trimmedEmail);
    if (existingUser) {
      assignedRole = existingUser.role;
    } else {
      if (trimmedEmail !== 'pegyirenyi@gmail.com') {
        assignedRole = 'Teacher';
      }
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
    return user;
  }

  static register(name: string, email: string, role: UserRole): UserAccount {
    this.clearCache();
    const users = this.getRegisteredUsers();
    
    const trimmedEmail = email.toLowerCase().trim();
    let assignedRole: UserRole = role;
    
    // Check if registering user is already authorized or registering admin
    if (trimmedEmail !== 'pegyirenyi@gmail.com' && trimmedEmail !== 'sammyotoo06@gmail.com') {
      const isAuthorized = users.some(u => u.email.toLowerCase().trim() === trimmedEmail);
      // If NOT authorized and we are NOT logged in as Admin or Headteacher, block registration
      const currentUser = this.getCurrentUser();
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

    if (trimmedEmail === 'pegyirenyi@gmail.com') {
      assignedRole = 'Admin';
    } else if (trimmedEmail === 'sammyotoo06@gmail.com') {
      assignedRole = 'Headteacher';
    } else {
      const currentUser = this.getCurrentUser();
      const isAdmin = currentUser?.role === 'Admin' || currentUser?.email?.toLowerCase().trim() === 'pegyirenyi@gmail.com';
      
      if (assignedRole === 'Headteacher' && !isAdmin) {
        // Enforce: only admin can register Headteachers
        assignedRole = 'Teacher';
      }
      
      // Nobody else can be registered as Admin
      if (assignedRole === 'Admin') {
        assignedRole = 'Teacher';
      }
    }

    const currentUser = this.getCurrentUser();
    let userSchoolId: string | undefined = undefined;
    if (assignedRole === 'Headteacher') {
      userSchoolId = this.generateSpecialSchoolId();
    } else if (assignedRole === 'Teacher' && currentUser?.schoolId) {
      userSchoolId = currentUser.schoolId;
    }

    const createdNow = new Date().toISOString();
    const prefix = email.split('@')[0].substring(0, 4).toUpperCase();
    const newUser: UserAccount = {
      uid: 'user_' + Math.random().toString(36).substring(2, 9),
      email: email,
      name: name,
      role: assignedRole,
      schoolId: userSchoolId,
      createdAt: createdNow,
      licenseType: 'trial',
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
    logs.forEach(log => {
      if (log.id) {
        this.performFirestoreWrite('activity_logs', log.id, 'delete').catch(e => console.error(e));
      }
    });
    setStorageItem(STORAGE_KEYS.ACTIVITY_LOGS, []);
  }

  static async updateUserLicense(
    uid: string, 
    licenseType: 'trial' | 'activated', 
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
    
    const updated = {
      ...users[idx],
      licenseType,
      registeredOn: users[idx].registeredOn || users[idx].createdAt || new Date().toISOString(),
      lastActivatedOn,
      activationCode,
      requestCode,
      licensePeriod: licensePeriod !== undefined ? licensePeriod : (users[idx].licensePeriod || 1)
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

    // Check if registering user is already authorized or registering admin
    if (trimmedEmail !== 'pegyirenyi@gmail.com' && trimmedEmail !== 'sammyotoo06@gmail.com') {
      const isAuthorized = users.some(u => u.email.toLowerCase().trim() === trimmedEmail);
      // If NOT authorized and we are NOT logged in as Admin or Headteacher, block registration
      const currentUser = this.getCurrentUser();
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

    if (trimmedEmail === 'pegyirenyi@gmail.com') {
      assignedRole = 'Admin';
    } else if (trimmedEmail === 'sammyotoo06@gmail.com') {
      assignedRole = 'Headteacher';
    } else {
      const currentUser = this.getCurrentUser();
      const isAdmin = currentUser?.role === 'Admin' || currentUser?.email?.toLowerCase().trim() === 'pegyirenyi@gmail.com';
      
      if (assignedRole === 'Headteacher' && !isAdmin) {
        // Enforce: only admin can register Headteachers
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
      if (assignedRole === 'Headteacher') {
        userSchoolId = this.generateSpecialSchoolId();
      } else if (assignedRole === 'Teacher' && currentUser?.schoolId) {
        userSchoolId = currentUser.schoolId;
      }

      const createdNow = new Date().toISOString();
      const prefix = email.split('@')[0].substring(0, 4).toUpperCase();
      
      const profile: UserAccount = {
        uid,
        email,
        name,
        role: assignedRole,
        schoolId: userSchoolId,
        createdAt: createdNow,
        licenseType: 'trial',
        registeredOn: createdNow,
        requestCode: `REQ-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`
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
      throw new Error("Firebase Authentication is offline. Please verify config or use Local bypass mode.");
    }

    try {
      const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      const uid = userCredential.user.uid;
      const assignedRole: UserRole = this.determineRole(email);

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
      throw new Error("Account not found. Please ensure you are registered.");
    }
    
    if (userAccount.role !== 'Teacher') {
      throw new Error("Access Denied: You are not registered as a Teacher.");
    }
    
    if (userAccount.schoolId !== schoolId) {
      throw new Error("Invalid School ID.");
    }
    
    setStorageItem(STORAGE_KEYS.USER, userAccount);
    return userAccount;
  }

  static async teacherLoginByBadge(badgeData: string): Promise<UserAccount> {
    let email: string | undefined;
    let staffId: string | undefined;
    let schoolId: string | undefined;

    // 1. Try parsing badgeData as JSON
    try {
      const parsed = JSON.parse(badgeData);
      if (parsed && typeof parsed === 'object') {
        email = parsed.email || parsed.Email;
        staffId = parsed.staffId || parsed.StaffId || parsed.staffid || parsed.id;
        schoolId = parsed.schoolId || parsed.SchoolId || parsed.schoolid;
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

    // 2. Locate the corresponding teacher in registry
    const teachers = this.getTeachers();
    let matchingTeacher: Teacher | undefined;

    if (email) {
      matchingTeacher = teachers.find(t => t.email?.toLowerCase().trim() === email?.toLowerCase().trim());
    }
    if (!matchingTeacher && staffId) {
      matchingTeacher = teachers.find(t => t.staffId?.toLowerCase().trim() === staffId?.toLowerCase().trim() || t.id === staffId);
    }

    if (!matchingTeacher) {
      throw new Error(`Access Denied: No registered teacher profile matches badge details "${badgeData.substring(0, 50)}${badgeData.length > 50 ? '...' : ''}". Please register the staff member first.`);
    }

    const teacherEmail = matchingTeacher.email;
    if (!teacherEmail) {
      throw new Error(`Access Denied: Teacher ${matchingTeacher.firstName} ${matchingTeacher.lastName} does not have an email address configured. Please set an email address in the teacher's profile first.`);
    }

    // 3. Find or bootstrap a registered UserAccount
    const users = this.getRegisteredUsers();
    let userAccount = users.find(u => u.email.toLowerCase().trim() === teacherEmail.toLowerCase().trim());

    if (!userAccount) {
      const createdNow = new Date().toISOString();
      const sId = matchingTeacher.schoolId || this.getSchoolInfo().schoolId || "school_default";
      userAccount = {
        uid: 'user_' + Math.random().toString(36).substring(2, 9),
        email: teacherEmail.toLowerCase().trim(),
        name: `${matchingTeacher.firstName} ${matchingTeacher.lastName}`,
        role: 'Teacher',
        schoolId: sId,
        createdAt: createdNow,
        licenseType: 'trial',
        registeredOn: createdNow
      };
      users.push(userAccount);
      setStorageItem(STORAGE_KEYS.USERS_LIST, users);
    }

    // 4. Authenticate using the matching email and school ID
    const targetSchoolId = schoolId || matchingTeacher.schoolId || this.getSchoolInfo().schoolId || "school_default";
    return await this.teacherLogin(teacherEmail, targetSchoolId);
  }

  // Real full-stack Firebase sendPasswordResetEmail method
  static async firebaseSendPasswordResetEmail(email: string): Promise<void> {
    if (!isFirebaseActive || !firebaseAuth) {
      throw new Error("Firebase Authentication is offline. Please verify config or use Local bypass mode.");
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
      const user = result.user;
      const email = user.email || '';
      
      const trimmedEmail = email.toLowerCase().trim();
      if (trimmedEmail !== 'pegyirenyi@gmail.com') {
        const users = this.getRegisteredUsers();
        const isAuthorized = users.some(u => u.email.toLowerCase().trim() === trimmedEmail);
        if (!isAuthorized) {
          await signOut(firebaseAuth);
          throw new Error("Access Denied: Your Google account email (" + email + ") is not authorized. Please contact the System Administrator to register your account.");
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
      try {
        userDocSnapshot = await getDoc(doc(firestoreDb, 'users', user.uid));
      } catch (getDocErr: any) {
        const errMsg = (getDocErr?.message || getDocErr?.code || String(getDocErr)).toLowerCase();
        if (errMsg.includes("offline") || errMsg.includes("unavailable") || errMsg.includes("network") || !navigator.onLine) {
          console.warn("Firestore offline during Google login profile fetch. Falling back to cached local storage profile.");
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
          name: user.displayName || email.split('@')[0] || 'Google User',
          role: assignedRole,
          createdAt: new Date().toISOString()
        };
        setStorageItem(STORAGE_KEYS.USER, tempProfile);
        return { user: tempProfile, isNew: true };
      }

      if (userDocSnapshot && userDocSnapshot.exists()) {
        const profile = userDocSnapshot.data() as UserAccount;
        if (profile.role !== assignedRole) {
          profile.role = assignedRole;
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
      if (trimmedEmail !== 'pegyirenyi@gmail.com') {
        const users = this.getRegisteredUsers();
        const isAuthorized = users.some(u => u.email.toLowerCase().trim() === trimmedEmail);
        if (!isAuthorized) {
          await signOut(firebaseAuth);
          throw new Error("Access Denied: Your Microsoft account email (" + email + ") is not authorized. Please contact the System Administrator to register your account.");
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
        if (profile.role !== assignedRole) {
          profile.role = assignedRole;
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
        if (profile.role !== assignedRole) {
          profile.role = assignedRole;
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
    const updatedProfile = {
      ...profile,
      role: assignedRole,
      licenseType: profile.licenseType || 'trial',
      registeredOn: profile.registeredOn || createdNow,
      requestCode: profile.requestCode || `REQ-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`
    };
    if (isFirebaseActive && firestoreDb) {
      try {
        await setDoc(doc(firestoreDb, 'users', updatedProfile.uid), updatedProfile);
      } catch (e: any) {
        const errMsg = (e?.message || e?.code || String(e)).toLowerCase();
        if (errMsg.includes("offline") || errMsg.includes("unavailable") || errMsg.includes("network") || !navigator.onLine) {
          console.warn("Firestore client is offline. Enqueueing user profile save for later offline sync.");
          this.enqueueOfflineOperation('users', updatedProfile.uid, 'set', updatedProfile);
        } else {
          handleFirestoreError(e, OperationType.WRITE, `users/${updatedProfile.uid}`);
          throw e;
        }
      }
    }
    setStorageItem(STORAGE_KEYS.USER, updatedProfile);
    const users = this.getRegisteredUsers();
    const existingIdx = users.findIndex(u => u.uid === updatedProfile.uid);
    if (existingIdx >= 0) {
      users[existingIdx] = updatedProfile;
    } else {
      users.push(updatedProfile);
    }
    setStorageItem(STORAGE_KEYS.USERS_LIST, users);
    return updatedProfile;
  }

  // Retrieve user profile data by UID directly
  static async getFirebaseUserProfile(uid: string): Promise<UserAccount | null> {
    if (!isFirebaseActive || !firestoreDb) return null;
    try {
      const userDoc = await getDoc(doc(firestoreDb, 'users', uid));
      if (userDoc.exists()) {
        return userDoc.data() as UserAccount;
      }
    } catch (e: any) {
      const errMsg = (e?.message || e?.code || String(e)).toLowerCase();
      if (errMsg.includes("offline") || errMsg.includes("unavailable") || errMsg.includes("network") || !navigator.onLine) {
        console.warn("Firestore client is offline. Resolving user profile from cache/localStorage instead of failing.");
        
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
      console.log("Beginning full database sync from Firestore...");
      // We don't clear the cache immediately to keep the UI snappy while we fetch new data
      
      // 1. School Profile Info
      try {
        const currentUser = this.getCurrentUser();
        const schoolId = currentUser ? `school_${currentUser.uid}` : 'school_default';
        const schoolDocSnap = await getDoc(doc(firestoreDb, 'schools', schoolId));
        if (schoolDocSnap.exists()) {
          const schoolData = schoolDocSnap.data() as SchoolInfo;
          
          // Also fetch secrets if Admin (for editing settings)
          let secretsData = {};
          const isAdmin = currentUser?.role === 'Admin';
          
          if (isAdmin) {
            try {
              const secretsSnap = await getDoc(doc(firestoreDb, 'schools', `secrets_${currentUser.uid}`));
              if (secretsSnap.exists()) {
                secretsData = secretsSnap.data();
              }
            } catch (secErr) {
              console.warn("Could not fetch school secrets:", secErr);
            }
          }
          setStorageItem(STORAGE_KEYS.SCHOOL, { ...schoolData, ...secretsData });
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, 'schools');
        throw e;
      }

      const uid = firebaseAuth.currentUser.uid;

      // 2. Students
      let studentsSnap;
      try {
        studentsSnap = await getDocs(query(collection(firestoreDb, 'students'), where('ownerId', '==', uid)));
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'students');
        throw e;
      }
      const studentsList = studentsSnap.docs.map(d => d.data() as Student);
      setStorageItem(STORAGE_KEYS.STUDENTS, studentsList);

      // 3. Teachers
      let teachersSnap;
      try {
        teachersSnap = await getDocs(query(collection(firestoreDb, 'teachers'), where('ownerId', '==', uid)));
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'teachers');
        throw e;
      }
      const teachersList = teachersSnap.docs.map(d => d.data() as Teacher);
      setStorageItem(STORAGE_KEYS.TEACHERS, teachersList);

      // 4. Attendance Registers
      let attendanceSnap;
      try {
        attendanceSnap = await getDocs(query(collection(firestoreDb, 'attendance'), where('ownerId', '==', uid)));
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'attendance');
        throw e;
      }
      const attendanceList = attendanceSnap.docs.map(d => d.data() as AttendanceRecord);
      setStorageItem(STORAGE_KEYS.ATTENDANCE, attendanceList);

      // 4b. Staff Attendance Registers
      let staffAttendanceSnap;
      try {
        staffAttendanceSnap = await getDocs(query(collection(firestoreDb, 'staff_attendance'), where('ownerId', '==', uid)));
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'staff_attendance');
        throw e;
      }
      const staffAttendanceList = staffAttendanceSnap.docs.map(d => d.data() as StaffAttendanceRecord);
      setStorageItem(STORAGE_KEYS.STAFF_ATTENDANCE, staffAttendanceList);

      // 5. Assessments Registers
      let assessmentsSnap;
      try {
        assessmentsSnap = await getDocs(query(collection(firestoreDb, 'assessments'), where('ownerId', '==', uid)));
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'assessments');
        throw e;
      }
      const assessmentsList = assessmentsSnap.docs.map(d => d.data() as StudentAssessment);
      setStorageItem(STORAGE_KEYS.ASSESSMENTS, assessmentsList);

      // 5b. Assessment Templates
      let templatesSnap;
      try {
        templatesSnap = await getDocs(query(collection(firestoreDb, 'assessment_templates'), where('ownerId', '==', uid)));
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'assessment_templates');
        throw e;
      }
      const templatesList = templatesSnap.docs.map(d => d.data() as AssessmentTemplate);
      setStorageItem(STORAGE_KEYS.ASSESSMENT_TEMPLATES, templatesList);

      // 6. Fees Bills
      let feesSnap;
      try {
        feesSnap = await getDocs(query(collection(firestoreDb, 'fees'), where('ownerId', '==', uid)));
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'fees');
        throw e;
      }
      const feesList = feesSnap.docs.map(d => d.data() as StudentFeeBill);
      setStorageItem(STORAGE_KEYS.FEES, feesList);

      // 7. Settings (Academic Calendar, System Customizations, Auto-Backup Config)
      try {
        const settingsSnap = await getDocs(query(collection(firestoreDb, 'settings'), where('ownerId', '==', uid)));
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

      // 8. EMIS Reports (GES aligned)
      try {
        const emisSnap = await getDocs(query(collection(firestoreDb, 'emis'), where('ownerId', '==', uid)));
        const emisList = emisSnap.docs.map(d => d.data() as EmisData);
        setStorageItem(STORAGE_KEYS.EMIS, emisList);
      } catch (e: any) {
        if (e.message?.includes('offline')) {
          console.log("Offline mode: Using cached EMIS reports.");
        } else {
          console.warn("Could not sync EMIS reports:", e);
        }
      }

      // 9. Behavioral Remarks
      try {
        const remarksSnap = await getDocs(query(collection(firestoreDb, 'behavioral_remarks'), where('ownerId', '==', uid)));
        const remarksList = remarksSnap.docs.map(d => d.data() as BehavioralRemark);
        setStorageItem(STORAGE_KEYS.BEHAVIORAL_REMARKS, remarksList);
      } catch (e: any) {
        if (e.message?.includes('offline')) {
          console.log("Offline mode: Using cached behavioral remarks.");
        } else {
          console.warn("Could not sync behavioral remarks:", e);
        }
      }

      // 9b. Paystack Payments
      try {
        const paystackSnap = await getDocs(query(collection(firestoreDb, 'paystack_payments'), where('ownerId', '==', uid)));
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

      // 9c. Activity Logs
      try {
        const activitySnap = await getDocs(query(collection(firestoreDb, 'activity_logs'), where('ownerId', '==', uid)));
        const activityList = activitySnap.docs.map(d => d.data() as ActivityLog);
        activityList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setStorageItem(STORAGE_KEYS.ACTIVITY_LOGS, activityList.slice(0, 1000));
      } catch (e: any) {
        console.warn("Could not sync activity logs:", e);
      }

      // 10. Registered Users Directory (Security Watchdog source)
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

      console.log("Database sync from Firestore successfully synced.");
      this.clearCache();
    } catch (e) {
      this.clearCache();
      console.warn("Database sync from Firestore aborted (running in offline LocalStorage backup mode):", e);
    } finally {
      this._isSyncing = false;
    }
  }

  // -------------------------
  // SCHOOL PROFILE
  // -------------------------
  static getSchoolInfo(): SchoolInfo {
    if (this._cache[STORAGE_KEYS.SCHOOL]) {
      return this._cache[STORAGE_KEYS.SCHOOL] || DEFAULT_SCHOOL_INFO;
    }
    const info = getStorageItem<SchoolInfo>(STORAGE_KEYS.SCHOOL, DEFAULT_SCHOOL_INFO);
    const resolved = info || DEFAULT_SCHOOL_INFO;
    this._cache[STORAGE_KEYS.SCHOOL] = resolved;
    return resolved;
  }

  static saveSchoolInfo(info: SchoolInfo): void {
    setStorageItem(STORAGE_KEYS.SCHOOL, info);
    this._cache[STORAGE_KEYS.SCHOOL] = info;

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
    const schoolId = info.schoolId || (currentUser ? `school_${currentUser.uid}` : (info.id || 'school_default'));
    this.performFirestoreWrite('schools', schoolId, 'set', publicFields);

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
  }

  static async updateSchoolId(newId: string): Promise<void> {
    const info = this.getSchoolInfo();
    info.schoolId = newId;
    this.saveSchoolInfo(info);

    const user = this.getCurrentUser();
    if (user) {
      user.schoolId = newId;
      setStorageItem(STORAGE_KEYS.USER, user);
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
      return this._cache[STORAGE_KEYS.CALENDAR];
    }
    const calendar = getStorageItem<AcademicCalendarConfig>(STORAGE_KEYS.CALENDAR, DEFAULT_CALENDAR);
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
  }

  static deleteTeacherReflection(id: string): void {
    const reflections = this.getTeacherReflections();
    const filtered = reflections.filter(r => r.id !== id);
    setStorageItem(STORAGE_KEYS.TEACHER_REFLECTIONS, filtered);
    this._cache[STORAGE_KEYS.TEACHER_REFLECTIONS] = filtered;

    this.performFirestoreWrite('teacher_reflections', id, 'delete');
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
    const teachers = this.getTeachers();
    const idx = teachers.findIndex(t => t.id === teacher.id);
    if (idx >= 0) {
      teachers[idx] = teacher;
    } else {
      teachers.push(teacher);
    }
    setStorageItem(STORAGE_KEYS.TEACHERS, teachers);
    this._cache[STORAGE_KEYS.TEACHERS] = teachers;
    this.performFirestoreWrite('teachers', teacher.id, 'set', teacher);
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
    records.forEach(item => {
      this.performFirestoreWrite('attendance', item.id, 'set', item);
    });
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
    let list: AttendanceRecord[];
    if (this._cache[STORAGE_KEYS.ATTENDANCE]) {
      list = this._cache[STORAGE_KEYS.ATTENDANCE];
    } else {
      list = getStorageItem<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
    }
    records.forEach(rec => {
      const idx = list.findIndex(r => r.id === rec.id);
      if (idx >= 0) {
        list[idx] = rec;
      } else {
        list.push(rec);
      }
      this.performFirestoreWrite('attendance', rec.id, 'set', rec);
    });
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
      this.performFirestoreWrite('staff_attendance', rec.id, 'set', rec);
    });
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

  static getAssessments(): StudentAssessment[] {
    if (this._cache[STORAGE_KEYS.ASSESSMENTS]) {
      return this._cache[STORAGE_KEYS.ASSESSMENTS];
    }
    const list = getStorageItem<StudentAssessment[]>(STORAGE_KEYS.ASSESSMENTS, []);
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

    // Build assessment look up index
    const index = new Map<string, StudentAssessment[]>();
    sanitized.forEach(item => {
      const studentId = item.studentId;
      if (!index.has(studentId)) {
        index.set(studentId, []);
      }
      index.get(studentId)!.push(item);
    });
    this._assessmentsByStudent = index;

    return sanitized;
  }

  static saveAllAssessments(assessments: StudentAssessment[]): void {
    setStorageItem(STORAGE_KEYS.ASSESSMENTS, assessments);
    this._cache[STORAGE_KEYS.ASSESSMENTS] = assessments;
    assessments.forEach(item => {
      this.performFirestoreWrite('assessments', item.id, 'set', item);
    });

    // Rebuild assessment lookup index
    const index = new Map<string, StudentAssessment[]>();
    assessments.forEach(item => {
      const studentId = item.studentId;
      if (!index.has(studentId)) {
        index.set(studentId, []);
      }
      index.get(studentId)!.push(item);
    });
    this._assessmentsByStudent = index;
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
      if (!index.has(cls)) {
        index.set(cls, []);
      }
      index.get(cls)!.push(s);
    });
    this._studentsByClass = index;
  }

  // Load or construct assessment sheets for a class, year, term, and subject
  static getAssessmentsSheet(
    className: ClassType,
    academicYear: AcademicYearType,
    term: TermType,
    subject: SubjectType
  ): StudentAssessment[] {
    const allAssessments = this.getAssessments(); // guaranteed to populate _assessmentsByStudent
    this.getStudents(); // guaranteed to populate _studentsByClass
    const students = this._studentsByClass.get(className) || [];
    
    const template = this.getAssessmentTemplate(className, academicYear, term, subject);

    // Build assessment row for each student
    const sheet = students.map(st => {
      const compoundId = `${st.id}_${academicYear}_${term}_${subject.replace(/\s+/g, '')}`.replace(/\//g, '-');
      const studentAssessments = this._assessmentsByStudent.get(st.id) || [];
      const found = studentAssessments.find(a => a.id === compoundId);
      
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
  static calculatePositions(sheet: StudentAssessment[]): StudentAssessment[] {
    const rawScores = sheet.map(s => this.calculateScoreDetails(s));
    
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
    const allAssessments = this.getAssessments();
    const updatedSheet = this.calculatePositions(sheet);

    let loggedChangesCount = 0;
    const changeDetails: string[] = [];

    updatedSheet.forEach(item => {
      const idx = allAssessments.findIndex(a => a.id === item.id);
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
      this.performFirestoreWrite('assessments', item.id, 'set', item);
    });

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
      if (config.provider === 'Firebase Cloud Storage') {
        if (!isFirebaseActive) throw new Error("Firebase is not active.");
        const storage = getStorage(firebaseApp);
        const path = `schools/${schoolId}/backups/${fileName}`;
        const storageRef = ref(storage, path);
        await uploadString(storageRef, data);
      } else if (config.provider === 'Google Drive') {
        throw new Error("Google Drive sync requires an active authorized session. Please sync manually from the Settings tab.");
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

      return { success: true };
    } catch (e: any) {
      config.status = 'failed';
      config.error = e.message || String(e);
      this.saveCloudSyncConfig(config);
      
      this.writeActivityLog(
        'Cloud Database Sync Failed',
        `Failed to sync to ${config.provider}: ${config.error}`,
        'high'
      );

      return { success: false, error: config.error };
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
      assessments: getStorageItem<StudentAssessment[]>(STORAGE_KEYS.ASSESSMENTS, []),
      fees: getStorageItem<StudentFeeBill[]>(STORAGE_KEYS.FEES, []),
      settings: getStorageItem<any>(STORAGE_KEYS.SETTINGS, null),
      calendar: getStorageItem<any>(STORAGE_KEYS.CALENDAR, null),
      emis_reports: getStorageItem<EmisData[]>(STORAGE_KEYS.EMIS, []),
      users_list: getStorageItem<UserAccount[]>(STORAGE_KEYS.USERS_LIST, []),
      behavioral_remarks: getStorageItem<BehavioralRemark[]>(STORAGE_KEYS.BEHAVIORAL_REMARKS, [])
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

      // Restore elements selectively if present
      if (hasSchool) setStorageItem(STORAGE_KEYS.SCHOOL, data.school_info);
      if (hasStudents) setStorageItem(STORAGE_KEYS.STUDENTS, data.students);
      if (hasTeachers) setStorageItem(STORAGE_KEYS.TEACHERS, data.teachers);
      if (hasAttendance) setStorageItem(STORAGE_KEYS.ATTENDANCE, data.attendance);
      if (hasAssessments) setStorageItem(STORAGE_KEYS.ASSESSMENTS, data.assessments);
      if (hasFees) setStorageItem(STORAGE_KEYS.FEES, data.fees);
      if (hasEmis) setStorageItem(STORAGE_KEYS.EMIS, data.emis_reports);
      if (Array.isArray(data.behavioral_remarks)) setStorageItem(STORAGE_KEYS.BEHAVIORAL_REMARKS, data.behavioral_remarks);
      if (data.settings) setStorageItem(STORAGE_KEYS.SETTINGS, data.settings);
      if (data.calendar) setStorageItem(STORAGE_KEYS.CALENDAR, data.calendar);
      if (Array.isArray(data.users_list)) setStorageItem(STORAGE_KEYS.USERS_LIST, data.users_list);

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
    localStorage.removeItem('school_students');

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
  }

  static clearAllTeachers(): void {
    const teachers = this.getTeachers();
    teachers.forEach(t => {
      this.performFirestoreWrite('teachers', t.id, 'delete');
    });
    setStorageItem(STORAGE_KEYS.TEACHERS, []);
    this._cache[STORAGE_KEYS.TEACHERS] = [];
    localStorage.removeItem('school_teachers');
  }

  static clearAllAssessments(): void {
    const assessments = this.getAssessments();
    assessments.forEach(a => {
      if (a.id) this.performFirestoreWrite('assessments', a.id, 'delete');
    });
    setStorageItem(STORAGE_KEYS.ASSESSMENTS, []);
    this._cache[STORAGE_KEYS.ASSESSMENTS] = [];
    this._assessmentsByStudent.clear();
    localStorage.removeItem('school_assessments');
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

    localStorage.removeItem('sms_offline_queue');
    localStorage.removeItem('school_students');
    localStorage.removeItem('school_teachers');
    localStorage.removeItem('school_assessments');
    localStorage.removeItem('school_fees_bills');

    const blankSchool: SchoolInfo = {
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
      smsRate: 20,
      crestUrl: ''
    };
    setStorageItem(STORAGE_KEYS.SCHOOL, blankSchool);
    this._cache[STORAGE_KEYS.SCHOOL] = blankSchool;
    this.clearCache();
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
        const students = this.getStudents();
        const teachers = this.getTeachers();
        const attendance = getStorageItem<any[]>(STORAGE_KEYS.ATTENDANCE, []);
        const staffAttendance = getStorageItem<any[]>(STORAGE_KEYS.STAFF_ATTENDANCE, []);
        const assessments = getStorageItem<any[]>(STORAGE_KEYS.ASSESSMENTS, []);
        const fees = getStorageItem<any[]>(STORAGE_KEYS.FEES, []);
        const emis = getStorageItem<any[]>(STORAGE_KEYS.EMIS, []);
        const remarks = getStorageItem<any[]>(STORAGE_KEYS.BEHAVIORAL_REMARKS, []);

        const deletePromises: Promise<any>[] = [];

        // We use a batch size or limit to avoid overwhelming the network
        const safeDelete = async (col: string, id: string) => {
          try {
            await deleteDoc(doc(firestoreDb, col, id));
          } catch (e) {
            console.warn(`[Wipe] Failed to delete ${col}/${id}:`, e);
          }
        };

        students.forEach(s => {
          deletePromises.push(safeDelete('students', s.id));
        });

        teachers.forEach(t => {
          deletePromises.push(safeDelete('teachers', t.id));
        });

        attendance.forEach(a => {
          if (a.id) deletePromises.push(safeDelete('attendance', a.id));
        });

        staffAttendance.forEach(sa => {
          if (sa.id) deletePromises.push(safeDelete('staff_attendance', sa.id));
        });

        assessments.forEach(ass => {
          if (ass.id) deletePromises.push(safeDelete('assessments', ass.id));
        });

        fees.forEach(f => {
          if (f.id) deletePromises.push(safeDelete('fees', f.id));
        });

        emis.forEach(e => {
          if (e.id) deletePromises.push(safeDelete('emis', e.id));
        });

        remarks.forEach(r => {
          if (r.id) deletePromises.push(safeDelete('behavioral_remarks', r.id));
        });

        // Clear school doc on firestore as well
        deletePromises.push(setDoc(doc(firestoreDb, 'schools', 'school_default'), DEFAULT_SCHOOL_INFO));

        // Await all deletions with a timeout to prevent hanging the whole app
        await Promise.allSettled(deletePromises);
      } catch (err) {
        console.error("Error clearing Cloud Firestore data during format:", err);
      }
    }

    // 2. Erase all cache & registry records from LocalStorage
    // Instead of just looping through STORAGE_KEYS, we should clear ALL keys in localStorage
    // that start with "sms_" to catch all partitioned data.
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('sms_')) {
          localStorage.removeItem(key);
        }
      });
      
      // Also clear sessionStorage for this app
      const sessionKeys = Object.keys(sessionStorage);
      sessionKeys.forEach(key => {
        if (key.startsWith('sms_')) {
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
      
      // Write a fully blank SchoolInfo template so that any new login starts with completely blank input data
      setStorageItem(STORAGE_KEYS.SCHOOL, DEFAULT_SCHOOL_INFO);
    } catch (e) {
      console.error("Error clearing local storage:", e);
    }

    this.clearCache();
    _lastSessionUid = null;
  }
}
