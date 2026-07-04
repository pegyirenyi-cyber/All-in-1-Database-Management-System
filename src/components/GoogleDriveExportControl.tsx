import { useState, useEffect } from 'react';
import { 
  FileDown, Cloud, CloudLightning, RefreshCw, CheckCircle2, AlertCircle, LogOut 
} from 'lucide-react';
import { 
  initGoogleAuth, googleSignIn, googleSignOut, uploadPdfToDrive 
} from '../googleDriveService';
import { 
  generatePdfFromHtml, downloadBlobLocally 
} from '../pdfHelper';
import { User } from 'firebase/auth';

interface GoogleDriveExportControlProps {
  elementId: string;
  defaultFilename: string;
  isLandscape?: boolean;
}

export default function GoogleDriveExportControl({ 
  elementId, 
  defaultFilename, 
  isLandscape = false 
}: GoogleDriveExportControlProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<'idle' | 'generating' | 'uploading' | 'success' | 'failed'>('idle');
  const [feedback, setFeedback] = useState<string>('');
  const [customFilename, setCustomFilename] = useState<string>(defaultFilename);

  // Initialize Auth state
  useEffect(() => {
    const unsub = initGoogleAuth((user, token) => {
      setIsAuthenticated(!!token && !!user);
      setGoogleUser(user);
    });
    return () => unsub();
  }, []);

  const handleLocalDownload = async () => {
    setIsLoading(true);
    setStatus('generating');
    setFeedback('Compiling page elements into PDF document...');
    try {
      const result = await generatePdfFromHtml(elementId, customFilename, isLandscape);
      downloadBlobLocally(result.blob, result.filename);
      setStatus('success');
      setFeedback('Successfully saved to Local Drive!');
      setTimeout(() => setStatus('idle'), 4000);
    } catch (error: any) {
      console.error(error);
      setStatus('failed');
      setFeedback(error.message || 'Failed to generate PDF document.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignInClick = async () => {
    try {
      setIsLoading(true);
      setStatus('idle');
      await googleSignIn();
    } catch (error: any) {
      console.error(error);
      setStatus('failed');
      setFeedback('Google authentication failed. Please open the app in a new tab to bypass iframe popup restrictions.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignOutClick = async () => {
    try {
      await googleSignOut();
    } catch (error) {
      console.error(error);
    }
  };

  const handleSaveToDrive = async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setStatus('generating');
    setFeedback('Compiling page elements into PDF...');
    try {
      const pdfResult = await generatePdfFromHtml(elementId, customFilename, isLandscape);
      setStatus('uploading');
      setFeedback('Uploading high-fidelity PDF to your Google Drive account...');
      
      await uploadPdfToDrive(pdfResult.filename, pdfResult.blob);
      
      setStatus('success');
      setFeedback('PDF saved successfully to Google Drive!');
      setTimeout(() => setStatus('idle'), 5000);
    } catch (error: any) {
      console.error(error);
      setStatus('failed');
      setFeedback(error.message || 'Upload to Google Drive failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4.5 space-y-4 text-xs font-sans">
      <div className="flex flex-col gap-1 text-left">
        <label className="text-[11px] font-bold text-slate-700">Document Filename</label>
        <input 
          type="text"
          value={customFilename}
          onChange={(e) => setCustomFilename(e.target.value)}
          placeholder="e.g. Report.pdf"
          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-indigo-500 font-medium"
        />
      </div>

      {/* Primary Local Download Trigger */}
      <div className="space-y-2 text-left">
        <button
          type="button"
          onClick={handleLocalDownload}
          disabled={isLoading}
          className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold shadow-xs transition flex items-center justify-center gap-2 cursor-pointer active:translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none"
        >
          <FileDown size={14} /> Download to Local Storage
        </button>
      </div>

      <div className="border-t border-slate-200/60 pt-3 space-y-3 text-left">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
            <Cloud size={13} className="text-indigo-600" /> Google Drive Cloud Storage
          </span>
          <span className="text-[10px] font-mono opacity-80">
            {isAuthenticated ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {isAuthenticated ? (
          <div className="space-y-2">
            <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-100 flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-indigo-950 truncate text-[10px]">{googleUser?.email}</p>
                <p className="text-[9px] text-indigo-600">Active cloud credentials</p>
              </div>
              <button
                type="button"
                onClick={handleGoogleSignOutClick}
                className="p-1 text-slate-400 hover:text-red-500 rounded-md hover:bg-white transition cursor-pointer"
                title="Disconnect Google Drive"
              >
                <LogOut size={13} />
              </button>
            </div>

            <button
              type="button"
              onClick={handleSaveToDrive}
              disabled={isLoading}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs transition flex items-center justify-center gap-2 cursor-pointer active:translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none"
            >
              <CloudLightning size={14} /> Upload PDF to Google Drive
            </button>
          </div>
        ) : (
          <div className="space-y-2.5 text-center">
            <p className="text-[10px] text-slate-500 leading-normal text-left">
              Connect Google Drive to seamlessly save school rosters, report cards, and register sheets online in your personal cloud.
            </p>
            <button
              type="button"
              onClick={handleGoogleSignInClick}
              disabled={isLoading}
              className="w-full py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-bold shadow-xs transition flex items-center justify-center gap-2.5 cursor-pointer active:translate-y-0.5"
            >
              {/* Material Design Google Icon */}
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4 flex-shrink-0">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              </svg>
              <span>Connect Google Drive</span>
            </button>
          </div>
        )}
      </div>

      {/* Progress & Feedback Monitor */}
      {status !== 'idle' && (
        <div className={`mt-3 p-2.5 rounded-lg border text-[10px] leading-relaxed transition-all flex items-center gap-2 ${
          status === 'success' 
            ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
            : status === 'failed' 
            ? 'bg-rose-50 border-rose-100 text-rose-800' 
            : 'bg-indigo-50 border-indigo-100 text-indigo-800 animate-pulse'
        }`}>
          {status === 'success' && <CheckCircle2 size={13} className="text-emerald-600 flex-shrink-0" />}
          {status === 'failed' && <AlertCircle size={13} className="text-rose-600 flex-shrink-0" />}
          {(status === 'generating' || status === 'uploading') && <RefreshCw size={13} className="animate-spin text-indigo-600 flex-shrink-0" />}
          <p className="font-mono">{feedback}</p>
        </div>
      )}
    </div>
  );
}
