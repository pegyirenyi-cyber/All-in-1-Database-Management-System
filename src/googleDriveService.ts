import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const resolvedFirebaseConfig = {
  projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId || '',
  appId: (import.meta as any).env.VITE_FIREBASE_APP_ID || firebaseConfig.appId || '',
  apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey || '',
  authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain || ((import.meta as any).env.VITE_FIREBASE_PROJECT_ID ? `${(import.meta as any).env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com` : firebaseConfig.projectId ? `${firebaseConfig.projectId}.firebaseapp.com` : ''),
  storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket || '',
  messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId || '',
  measurementId: (import.meta as any).env.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfig.measurementId || ''
};

const configWithAuthDomain = resolvedFirebaseConfig.projectId ? {
  ...resolvedFirebaseConfig,
  authDomain: resolvedFirebaseConfig.authDomain || `${resolvedFirebaseConfig.projectId}.firebaseapp.com`
} : resolvedFirebaseConfig;

const app = getApps().length === 0 ? initializeApp(configWithAuthDomain) : getApp();
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/gmail.send');
provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
provider.addScope('https://www.googleapis.com/auth/gmail.compose');
provider.addScope('https://www.googleapis.com/auth/gmail.modify');
provider.addScope('https://mail.google.com/');

let isSigningIn = false;
let cachedAccessToken: string | null = (typeof window !== 'undefined') ? localStorage.getItem('google_drive_access_token') : null;
let currentGoogleUser: User | null = null;

// Track state listeners
const authStateListeners: ((user: User | null, token: string | null) => void)[] = [];

// Call on startup
export const initGoogleAuth = (
  onAuthChanged?: (user: User | null, token: string | null) => void
) => {
  if (onAuthChanged) {
    if (!authStateListeners.includes(onAuthChanged)) {
      authStateListeners.push(onAuthChanged);
    }
    // Call immediately with existing values
    onAuthChanged(currentGoogleUser, cachedAccessToken);
  }

  return onAuthStateChanged(auth, async (user) => {
    currentGoogleUser = user;
    if (!user) {
      cachedAccessToken = null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('google_drive_access_token');
      }
    } else {
      const storedToken = (typeof window !== 'undefined') ? localStorage.getItem('google_drive_access_token') : null;
      if (storedToken) {
        cachedAccessToken = storedToken;
      }
    }
    authStateListeners.forEach(listener => {
      try {
        listener(currentGoogleUser, cachedAccessToken);
      } catch (err) {
        console.error('Error in auth listener:', err);
      }
    });
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (isSigningIn) {
    console.warn('Google sign-in is already in progress. Ignoring redundant trigger.');
    return null;
  }
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google Auth');
    }

    cachedAccessToken = credential.accessToken;
    currentGoogleUser = result.user;
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('google_drive_access_token', credential.accessToken);
    }
    
    // Notify list
    authStateListeners.forEach(listener => {
      try {
        listener(currentGoogleUser, cachedAccessToken);
      } catch (err) {
        console.error('Error in auth listener:', err);
      }
    });

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Google Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const googleSignOut = async () => {
  try {
    await auth.signOut();
  } catch (error) {
    console.error('Firebase Auth signOut error:', error);
  }
  cachedAccessToken = null;
  currentGoogleUser = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('google_drive_access_token');
  }
  authStateListeners.forEach(listener => {
    try {
      listener(null, null);
    } catch (err) {
      console.error('Error in auth listener custom trigger:', err);
    }
  });
};

export const getGoogleAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const isGoogleAuthenticated = (): boolean => {
  return !!cachedAccessToken && !!auth.currentUser;
};

/**
 * Upload a PDF blob to Google Drive
 */
export const uploadPdfToDrive = async (filename: string, pdfBlob: Blob): Promise<string> => {
  const token = getGoogleAccessToken();
  if (!token) {
    throw new Error('User is not authenticated with Google Drive.');
  }

  // 1. Create file metadata
  const metadataResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: filename,
      mimeType: 'application/pdf',
    }),
  });

  if (!metadataResponse.ok) {
    const errText = await metadataResponse.text();
    console.error('Failed metadata response:', errText);
    throw new Error(`Failed to create file metadata: ${metadataResponse.statusText}`);
  }

  const file = await metadataResponse.json();
  const fileId = file.id;

  // 2. Upload file media content
  const mediaResponse = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/pdf',
    },
    body: pdfBlob,
  });

  if (!mediaResponse.ok) {
    const errText = await mediaResponse.text();
    console.error('Failed media response:', errText);
    throw new Error(`Failed to upload file content: ${mediaResponse.statusText}`);
  }

  return fileId;
};

/**
 * Send an email via Gmail API
 */
export const sendGmailMessage = async (
  to: string,
  subject: string,
  bodyHtml: string
): Promise<{ id: string } | null> => {
  const token = getGoogleAccessToken();
  if (!token) {
    throw new Error('User is not authenticated with Gmail.');
  }

  // Create the email content
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const emailParts = [
    `To: ${to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${utf8Subject}`,
    '',
    bodyHtml
  ];
  const email = emailParts.join('\r\n');

  // Base64url encode the email
  const base64Safe = (str: string) => {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };

  const raw = base64Safe(email);

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: raw
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Failed to send email:', errText);
    throw new Error(`Gmail Send Error: ${response.statusText} (${errText})`);
  }

  return await response.json();
};

let pickerApiLoaded = false;

export const loadPickerApi = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (pickerApiLoaded) {
      resolve();
      return;
    }

    if (!(window as any).gapi) {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        (window as any).gapi.load('picker', {
          callback: () => {
            pickerApiLoaded = true;
            resolve();
          },
          onerror: () => {
            reject(new Error('Failed to load Google Picker extension.'));
          }
        });
      };
      script.onerror = () => {
        reject(new Error('Failed to load gapi script.'));
      };
      document.body.appendChild(script);
    } else {
      (window as any).gapi.load('picker', {
        callback: () => {
          pickerApiLoaded = true;
          resolve();
        },
        onerror: () => {
          reject(new Error('Failed to load Google Picker extension.'));
        }
      });
    }
  });
};

export interface PickerFile {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  sizeBytes?: number;
  lastModified?: number;
}

export const showGooglePicker = async (
  onPicked: (file: PickerFile) => void,
  onCancel?: () => void
): Promise<void> => {
  const token = getGoogleAccessToken();
  if (!token) {
    throw new Error('User is not authenticated with Google Drive/Picker.');
  }

  await loadPickerApi();

  const pickerOrigin =
    window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0
      ? window.location.ancestorOrigins[window.location.ancestorOrigins.length - 1]
      : window.location.origin;

  const google = (window as any).google;
  if (!google || !google.picker) {
    throw new Error('Google Picker API is not fully loaded.');
  }

  const pickerCallback = (data: any) => {
    if (data.action === google.picker.Action.PICKED) {
      const doc = data.docs[0];
      onPicked({
        id: doc.id,
        name: doc.name,
        mimeType: doc.mimeType,
        url: doc.url,
        sizeBytes: doc.sizeBytes,
        lastModified: doc.lastEditedUtc
      });
    } else if (data.action === google.picker.Action.CANCEL) {
      if (onCancel) onCancel();
    }
  };

  const picker = new google.picker.PickerBuilder()
    .addView(google.picker.ViewId.DOCS)
    .setOAuthToken(token)
    .setCallback(pickerCallback)
    .setOrigin(pickerOrigin)
    .build();

  picker.setVisible(true);
};

