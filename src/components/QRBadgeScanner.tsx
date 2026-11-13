import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Camera, X, RefreshCw, AlertCircle, UserCheck, QrCode, 
  Search, ShieldCheck, ArrowRight, ArrowLeft, CheckCircle2, Lock, 
  User, ShieldAlert, Upload, FileText
} from 'lucide-react';
import jsQR from 'jsqr';
import { DbController } from '../db';
import { Teacher, SchoolInfo } from '../types';
import { evaluateSubscription } from '../subscription';

declare const pdfjsLib: any;

interface QRBadgeScannerProps {
  onScanSuccess: (decodedValue: string, expectedTeacherId?: string) => void;
  onClose: () => void;
  isSubscriptionLocked?: boolean;
  isLoginMode?: boolean;
}

export default function QRBadgeScanner({ onScanSuccess, onClose, isSubscriptionLocked: propIsLocked, isLoginMode = false }: QRBadgeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastScanTimeRef = useRef<number>(0);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // Workflow steps: 'verify_school_id' -> 'select_teacher' -> 'confirm_teacher' -> 'scanning_badge'
  const [step, setStep] = useState<'verify_school_id' | 'select_teacher' | 'confirm_teacher' | 'scanning_badge'>(() => {
    if (isLoginMode) return 'scanning_badge';
    const user = DbController.getCurrentUser();
    if (user) return 'select_teacher';
    return 'verify_school_id';
  });
  const [inputSchoolId, setInputSchoolId] = useState('');
  const [schoolIdError, setSchoolIdError] = useState<string | null>(null);
  const [verifiedSchoolCode, setVerifiedSchoolCode] = useState<string | null>(() => {
    const user = DbController.getCurrentUser();
    if (user?.schoolId) return user.schoolId;
    const info = DbController.getSchoolInfo();
    return info?.schoolId || null;
  });

  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);

  const currentUser = DbController.getCurrentUser();
  const subStatus = currentUser ? evaluateSubscription(currentUser) : null;
  const isSubscriptionLocked = propIsLocked !== undefined ? propIsLocked : (subStatus?.isLocked || false);

  // Load registered teachers filtered by active Headteacher's school ID
  useEffect(() => {
    const loadSchoolAndTeachers = () => {
      try {
        const info = DbController.getSchoolInfo();
        setSchoolInfo(info);

        const allTeachers = DbController.getTeachers();
        setTeachers(allTeachers || []);
      } catch (err) {
        console.error("Error loading teachers for QR scanner:", err);
      }
    };

    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }

    loadSchoolAndTeachers();
    window.addEventListener('storage', loadSchoolAndTeachers);
    window.addEventListener('school-system-sync', loadSchoolAndTeachers);

    // Close modal on Escape key press
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stopCamera();
        if (typeof document !== 'undefined') {
          document.body.style.overflow = '';
          document.documentElement.style.overflow = '';
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('storage', loadSchoolAndTeachers);
      window.removeEventListener('school-system-sync', loadSchoolAndTeachers);
      window.removeEventListener('keydown', handleKeyDown);
      stopCamera();
      // Explicitly restore the CSS 'overflow' property on document body and html root to prevent frozen sidebar
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }
    };
  }, [onClose]);

  const handleModalClose = () => {
    stopCamera();
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    onClose();
  };

  // Handle Headteacher School ID Code verification
  const handleVerifySchoolId = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSchoolIdError(null);

    const rawCode = inputSchoolId.trim();
    const cleanCode = rawCode.toUpperCase();

    if (!cleanCode) {
      setSchoolIdError("Please enter Headteacher's School ID code to proceed.");
      playBeep(false);
      return;
    }

    // Pre-sync enrolled staff list for this School Code from Cloud Firestore if online
    await DbController.preSyncSchoolDirectoryForLogin(rawCode);
    const refreshedInfo = DbController.getSchoolInfo();
    const refreshedTeachers = DbController.getTeachers();
    setSchoolInfo(refreshedInfo);
    setTeachers(refreshedTeachers);

    const info = refreshedInfo || schoolInfo;
    const currentSchoolId = (info?.schoolId || DbController.resolveActiveSchoolId() || '').trim().toUpperCase();
    
    const registeredUsers = DbController.getRegisteredUsers();
    const validUserSchoolIds = registeredUsers
      .map(u => (u.schoolId || u.schoolCode || u.uid || '').trim().toUpperCase())
      .filter(Boolean);

    const teacherSchoolIds = (refreshedTeachers || [])
      .map(t => (t.schoolId || t.schoolCode || '').trim().toUpperCase())
      .filter(Boolean);

    // Accept match against current school ID, user accounts, or registered teachers
    const isMatch = (
      cleanCode === currentSchoolId ||
      cleanCode === "SCHOOL_DEFAULT" ||
      validUserSchoolIds.includes(cleanCode) ||
      teacherSchoolIds.includes(cleanCode) ||
      cleanCode === (info?.schoolNumber || '').trim().toUpperCase() ||
      cleanCode === (info?.emisCode || '').trim().toUpperCase()
    );

    if (isMatch) {
      playBeep(true);
      setVerifiedSchoolCode(rawCode);
      setStep('select_teacher');
      setSchoolIdError(null);
    } else {
      playBeep(false);
      setSchoolIdError(`Invalid School ID code "${cleanCode}". Please verify the code with your Headteacher or Administrator.`);
    }
  };

  // Whenever stream changes, attach it to videoRef.current
  useEffect(() => {
    if (videoRef.current) {
      if (stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.warn("Video play error:", e));
      } else {
        videoRef.current.srcObject = null;
      }
    }
  }, [stream]);

  // Manage camera lifecycle when step changes or component unmounts
  useEffect(() => {
    if (step === 'scanning_badge') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [step]);

  const startCamera = async () => {
    setScanError(null);
    setScanSuccess(null);

    if (isSubscriptionLocked) {
      setScanError("Scan QR Badge feature is inactive for expired accounts. Please renew license to reactivate.");
      setIsScanning(false);
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setScanError("Camera access is not supported or is restricted in this browser window. Please upload an image or PDF of the badge below.");
      setIsScanning(false);
      return;
    }

    setIsScanning(true);

    let mediaStream: MediaStream | null = null;

    try {
      // Primary attempt: rear/environment camera with 640x480 resolution target
      mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: { ideal: 'environment' },
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      });
    } catch (primaryErr) {
      console.warn("Primary camera request failed, trying fallback:", primaryErr);
      try {
        // Fallback: any available camera with ideal bounds
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        });
      } catch (fallbackErr: any) {
        console.error("Camera access denied or unequipped:", fallbackErr);
        setScanError("Unable to open live camera. Please grant camera permission or use 'Upload Printed Badge Photo' below.");
        setIsScanning(false);
        return;
      }
    }

    if (mediaStream) {
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(e => console.warn("Video play error:", e));
      }
      animationFrameRef.current = requestAnimationFrame(scanLoop);
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsScanning(false);
  };

  const playBeep = (isSuccess = true) => {
    // 1. Mobile Haptic Vibration Feedback
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        if (isSuccess) {
          // Double pulse haptic feedback for success
          navigator.vibrate([90, 50, 120]);
        } else {
          // Warning pattern for mismatch/error
          navigator.vibrate([150, 80, 150]);
        }
      }
    } catch (vibrErr) {
      console.warn("Haptic vibration unavailable:", vibrErr);
    }

    // 2. High-Quality Web Audio Feedback Chime
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      if (isSuccess) {
        // Ascending two-tone success chime (D5 -> A5)
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';

        osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc2.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.12); // A5

        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioCtx.destination);

        osc1.start(audioCtx.currentTime);
        osc1.stop(audioCtx.currentTime + 0.12);
        osc2.start(audioCtx.currentTime + 0.12);
        osc2.stop(audioCtx.currentTime + 0.35);
      } else {
        // Warning buzz for error/mismatch
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);

        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      }
    } catch (err) {
      console.warn("Audio feedback error:", err);
    }
  };

  // Frame Scanning Loop (downscaled to max 480px to prevent CPU freezes)
  const scanLoop = () => {
    if (!isScanning) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      const now = Date.now();
      if (now - lastScanTimeRef.current >= 200) {
        lastScanTimeRef.current = now;

        try {
          // Downscale to max 480px on the longest dimension so jsQR operates in < 5ms without freezing the main thread
          const maxDim = 480;
          let targetW = video.videoWidth;
          let targetH = video.videoHeight;
          if (targetW > maxDim || targetH > maxDim) {
            const scale = Math.min(maxDim / targetW, maxDim / targetH);
            targetW = Math.max(1, Math.round(targetW * scale));
            targetH = Math.max(1, Math.round(targetH * scale));
          }

          if (canvas.width !== targetW) canvas.width = targetW;
          if (canvas.height !== targetH) canvas.height = targetH;

          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, targetW, targetH);

            const imageData = ctx.getImageData(0, 0, targetW, targetH);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "dontInvert",
            });

            if (code && code.data) {
              verifyAndProcessScan(code.data);
              return;
            }
          }
        } catch (frameErr) {
          console.warn("Scan frame evaluation skipped:", frameErr);
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(scanLoop);
  };

  // Image & PDF File Upload Handler as fallback for hardcopy printed badges
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isSubscriptionLocked) {
      setScanError("Scan QR Badge feature is inactive for expired accounts. Please renew license to reactivate.");
      return;
    }

    setScanError(null);
    setScanSuccess(null);

    const fileName = file.name.toLowerCase();
    const isPdf = file.type === 'application/pdf' || fileName.endsWith('.pdf');

    if (isPdf) {
      await processPdfFile(file);
    } else {
      processImageFile(file);
    }

    if (e.target) e.target.value = '';
  };

  const processImageFile = (file: File) => {
    setIsProcessingFile(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 800;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            const scale = Math.min(maxDim / w, maxDim / h);
            w = Math.max(1, Math.round(w * scale));
            h = Math.max(1, Math.round(h * scale));
          }

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const imageData = ctx.getImageData(0, 0, w, h);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "dontInvert",
            });
            setIsProcessingFile(false);
            if (code && code.data) {
              verifyAndProcessScan(code.data);
            } else {
              playBeep(false);
              setScanError("No valid QR code detected in the uploaded image. Please ensure the printed badge photo is clear and well lit.");
            }
          } else {
            setIsProcessingFile(false);
          }
        } catch (imgErr) {
          console.error("Image processing error:", imgErr);
          setIsProcessingFile(false);
          playBeep(false);
          setScanError("Error reading image. Please ensure the image is clear and try again.");
        }
      };
      img.onerror = () => {
        setIsProcessingFile(false);
        playBeep(false);
        setScanError("Failed to read image file. Please upload a clear photo or PDF badge.");
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const processPdfFile = async (file: File) => {
    setIsProcessingFile(true);
    try {
      const pdfLib = typeof window !== 'undefined' ? (window as any).pdfjsLib : null;
      if (!pdfLib) {
        setIsProcessingFile(false);
        playBeep(false);
        setScanError("PDF parser is not active in this browser. Please upload an image file (PNG/JPG) of the printed badge.");
        return;
      }

      const arrayBuffer = await file.arrayBuffer();
      const pdfData = new Uint8Array(arrayBuffer);

      if (!pdfLib.GlobalWorkerOptions?.workerSrc) {
        pdfLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfLib.version || '4.10.38'}/pdf.worker.min.mjs`;
      }

      const loadingTask = pdfLib.getDocument({ data: pdfData });
      const pdf = await loadingTask.promise;

      let scannedCode: string | null = null;

      // Scan up to first 5 pages for a QR code
      for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 5); pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (code && code.data) {
            scannedCode = code.data;
            break;
          }
        }
      }

      setIsProcessingFile(false);

      if (scannedCode) {
        verifyAndProcessScan(scannedCode);
      } else {
        playBeep(false);
        setScanError("No valid QR code detected in the uploaded PDF document. Please ensure the printed QR badge is clearly visible.");
      }
    } catch (err: any) {
      console.error("PDF QR parsing error:", err);
      setIsProcessingFile(false);
      playBeep(false);
      setScanError("Unable to read PDF document. Please ensure it contains a valid QR badge or upload a clear photo.");
    }
  };

  // VERIFICATION ENGINE: Verifies scanned QR code matches the selected teacher profile!
  const verifyAndProcessScan = (scannedData: string) => {
    if (isLoginMode) {
      if (!scannedData || scannedData.trim().length === 0) {
        playBeep(false);
        setScanError("Invalid or empty QR code detected. Please try scanning again.");
        return;
      }

      playBeep(true);
      stopCamera();
      setScanError(null);
      setScanSuccess(`QR Code scanned successfully! Logging in to Teachers Portal...`);

      setTimeout(() => {
        onScanSuccess(scannedData);
      }, 600);
      return;
    }

    if (!selectedTeacher) {
      setScanError("Please select a teacher profile first.");
      return;
    }

    let scannedEmail = '';
    let scannedStaffId = '';

    try {
      const parsed = JSON.parse(scannedData);
      scannedEmail = (parsed.email || parsed.Email || '').toLowerCase().trim();
      scannedStaffId = (parsed.staffId || parsed.StaffId || parsed.id || '').toLowerCase().trim();
    } catch (e) {
      const clean = scannedData.trim().toLowerCase();
      if (clean.includes('@')) scannedEmail = clean;
      else scannedStaffId = clean;
    }

    const expectedStaffId = (selectedTeacher.staffId || selectedTeacher.id || '').toLowerCase().trim();
    const expectedEmail = (selectedTeacher.email || '').toLowerCase().trim();

    // Check match against staff ID, email, or raw text content
    const isMatch = (
      (scannedStaffId && (scannedStaffId === expectedStaffId || scannedStaffId === selectedTeacher.id?.toLowerCase())) ||
      (scannedEmail && scannedEmail === expectedEmail) ||
      (scannedData.toLowerCase().includes(expectedStaffId) && expectedStaffId.length > 2) ||
      (scannedData.toLowerCase().includes(expectedEmail) && expectedEmail.length > 3)
    );

    if (!isMatch) {
      playBeep(false);
      setScanError(`SECURITY VIOLATION: Scanned QR badge does NOT match ${selectedTeacher.firstName} ${selectedTeacher.lastName} (Staff ID: ${selectedTeacher.staffId || 'N/A'}). Access Denied.`);
      setScanSuccess(null);
      // Resume camera scanning after delay if in live camera mode
      setTimeout(() => {
        if (step === 'scanning_badge') {
          animationFrameRef.current = requestAnimationFrame(scanLoop);
        }
      }, 1500);
      return;
    }

    // MATCH VALIDATED!
    playBeep(true);
    stopCamera();
    setScanError(null);
    setScanSuccess(`Identity Verified! Welcome, ${selectedTeacher.firstName} ${selectedTeacher.lastName}.`);

    setTimeout(() => {
      onScanSuccess(scannedData, selectedTeacher.id);
    }, 600);
  };

  const filteredTeachers = teachers.filter(t => {
    const query = searchQuery.toLowerCase().trim();
    const fullName = `${t.firstName} ${t.lastName}`.toLowerCase();
    const sId = (t.staffId || '').toLowerCase();
    const cls = (t.assignedClass || '').toLowerCase();
    const matchesQuery = !query || fullName.includes(query) || sId.includes(query) || cls.includes(query);

    if (!verifiedSchoolCode) return matchesQuery;
    const tSchool = (t.schoolId || '').toUpperCase();
    const matchesSchool = !tSchool || tSchool === verifiedSchoolCode || verifiedSchoolCode === 'SCHOOL_DEFAULT' || tSchool === (schoolInfo?.schoolId || DbController.resolveActiveSchoolId() || '').toUpperCase();

    return matchesQuery && matchesSchool;
  });

  const activeSchoolId = schoolInfo?.schoolId || DbController.resolveActiveSchoolId();
  const activeSchoolName = schoolInfo?.name || "Central GES Model School";

  return (
    <div 
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-[500] p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleModalClose();
        }
      }}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.94, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 14 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 max-h-[95vh] flex flex-col justify-between"
      >
        
        {/* Hidden Canvas & File Input (Accepts image/* and PDF files) */}
        <canvas ref={canvasRef} className="hidden" />
        <input 
          type="file" 
          ref={fileInputRef} 
          accept="image/*,application/pdf,.pdf" 
          onChange={handleFileUpload} 
          className="hidden" 
        />

        {/* Top Header */}
        <div className="flex justify-between items-center shrink-0 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
              <QrCode size={20} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm tracking-tight">
                  {isLoginMode ? "Quick QR Badge Login" : "Teacher Badge Verification"}
                </h3>
                {!isLoginMode && (
                  <span className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold rounded-md border border-emerald-200/50 dark:border-emerald-800/50 font-mono">
                    {verifiedSchoolCode ? `Verified ID: ${verifiedSchoolCode}` : `School ID: ${activeSchoolId}`}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 font-medium truncate max-w-[260px]">
                {isLoginMode ? "Scan physical school ID QR card badge to login" : activeSchoolName}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={handleModalClose} 
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer transition"
            title="Close Badge Verification"
          >
            <X size={18} />
          </button>
        </div>

        {/* STEP 1: VERIFY HEADTEACHER SCHOOL ID CODE */}
        {step === 'verify_school_id' && (
          <div className="flex-1 flex flex-col justify-center space-y-4 py-2">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-950/80 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shadow-md">
                <Lock size={28} />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  Headteacher Verification
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                  Please enter your Headteacher's School ID Code to verify authorization before viewing assigned teachers and scanning teacher QR badges.
                </p>
              </div>
            </div>

            <form onSubmit={handleVerifySchoolId} className="space-y-3 max-w-sm mx-auto w-full">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Headteacher's School ID Code <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3.5 top-3 text-indigo-500" size={16} />
                  <input
                    type="text"
                    value={inputSchoolId}
                    onChange={(e) => {
                      setInputSchoolId(e.target.value);
                      if (schoolIdError) setSchoolIdError(null);
                    }}
                    placeholder="e.g. SCH-ABCD-1234"
                    className="w-full pl-10 pr-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition"
                    autoFocus
                  />
                </div>
              </div>

              {schoolIdError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <ShieldAlert size={16} className="shrink-0 text-rose-500" />
                  <span className="font-medium text-[11px] leading-snug">{schoolIdError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 cursor-pointer transition active:scale-[0.98]"
              >
                <span>Verify Code & Access Teachers</span>
                <ArrowRight size={16} />
              </button>

              <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 rounded-xl text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed flex items-start gap-2">
                <AlertCircle size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-700 dark:text-slate-300">Need your School ID Code?</span> Contact your Headteacher or School Administrator for your unique School ID. Current Code: <code className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1 py-0.5 rounded border border-indigo-200 dark:border-indigo-900">{schoolInfo?.schoolId || DbController.resolveActiveSchoolId()}</code>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* STEP 2: SELECT ASSIGNED TEACHER */}
        {step === 'select_teacher' && (
          <div className="flex-1 flex flex-col min-h-[320px] space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Assigned Faculty Directory</h4>
                  <button
                    onClick={() => {
                      setStep('verify_school_id');
                      setVerifiedSchoolCode(null);
                    }}
                    className="text-[9px] font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    (Change School ID)
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">Select your teacher profile to proceed to scan printed badge</p>
              </div>
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-900">
                {filteredTeachers.length} Faculty Members
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search teacher by name, staff ID, or class..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            {/* Teacher Cards List */}
            <div className="flex-1 overflow-y-auto max-h-[280px] space-y-2 pr-1">
              {filteredTeachers.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-2">
                  <UserCheck size={28} className="text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">No assigned teachers found</p>
                  <p className="text-[10px] text-slate-400">No registered faculty match School ID: <span className="font-mono text-indigo-500">{activeSchoolId}</span></p>
                </div>
              ) : (
                filteredTeachers.map(tea => (
                  <button
                    key={tea.id}
                    onClick={() => {
                      setSelectedTeacher(tea);
                      setStep('confirm_teacher');
                      setScanError(null);
                    }}
                    className="w-full p-3 bg-slate-50 hover:bg-indigo-50/60 dark:bg-slate-950/40 dark:hover:bg-indigo-950/40 border border-slate-200/80 hover:border-indigo-300 dark:border-slate-800 dark:hover:border-indigo-800 rounded-2xl text-left flex items-center gap-3 transition-all group cursor-pointer active:scale-[0.99]"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center border border-slate-300/50 dark:border-slate-700">
                      {tea.photoUrl ? (
                        <img src={tea.photoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User size={20} className="text-slate-400 group-hover:text-indigo-500 transition" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                          {tea.firstName} {tea.lastName}
                        </h5>
                        <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded">
                          {tea.staffId || 'NO-ID'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        Class: <span className="font-semibold text-slate-600 dark:text-slate-300">{tea.assignedClass || 'Unassigned'}</span> • {tea.email}
                      </p>
                    </div>
                    <div className="shrink-0 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      <ArrowRight size={16} />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* STEP 2: CONFIRM SELECTED TEACHER DETAILS */}
        {step === 'confirm_teacher' && selectedTeacher && (
          <div className="flex-1 flex flex-col space-y-4">
            
            {/* Header / Back */}
            <div className="flex justify-between items-center">
              <button
                onClick={() => {
                  setStep('select_teacher');
                  setSelectedTeacher(null);
                  setScanError(null);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-indigo-600 cursor-pointer"
              >
                <ArrowLeft size={14} /> Back to Faculty Directory
              </button>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900">
                Profile Selected
              </span>
            </div>

            {/* Teacher Details Card */}
            <div className="bg-gradient-to-br from-indigo-50/70 via-slate-50 to-purple-50/50 dark:from-indigo-950/30 dark:via-slate-950 dark:to-purple-950/20 border border-indigo-200/80 dark:border-indigo-900/50 rounded-2xl p-4 space-y-3 relative overflow-hidden">
              <div className="flex items-start gap-3">
                <div className="relative w-14 h-14 rounded-2xl bg-slate-200 dark:bg-slate-800 overflow-hidden shrink-0 border-2 border-indigo-500 shadow-md flex items-center justify-center">
                  {selectedTeacher.photoUrl ? (
                    <img src={selectedTeacher.photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User size={28} className="text-slate-400 m-auto" />
                  )}
                  <div className="absolute bottom-0 right-0 p-0.5 bg-emerald-500 text-white rounded-tl-md">
                    <ShieldCheck size={10} />
                  </div>
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tight">
                      {selectedTeacher.firstName} {selectedTeacher.lastName}
                    </h4>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="font-mono font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md">
                      Staff ID: {selectedTeacher.staffId || 'STAFF-001'}
                    </span>
                    <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md font-semibold">
                      Class: {selectedTeacher.assignedClass || 'General'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
                    {selectedTeacher.email}
                  </p>
                </div>
              </div>

              {/* Security Instruction Box */}
              <div className="p-3 bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] text-slate-600 dark:text-slate-300 space-y-1 leading-relaxed">
                <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider text-[9.5px]">
                  <Lock size={12} /> Security Validation Check
                </div>
                <p>
                  To complete login, please scan your <strong className="text-indigo-600 dark:text-indigo-400">printed hardcopy QR badge</strong> using your camera or upload a photo of your badge.
                </p>
              </div>
            </div>

            {scanError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <ShieldAlert size={16} className="shrink-0" />
                <span className="font-medium">{scanError}</span>
              </div>
            )}

            {/* Expired License Inactive Alert */}
            {isSubscriptionLocked && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
                <ShieldAlert size={20} className="text-rose-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold text-[11px] uppercase tracking-wider block text-rose-800 dark:text-rose-200">Scan QR Badge Inactive (License Expired)</span>
                  <p className="text-[10.5px] leading-snug">
                    Your school database subscription has expired. QR badge scanning features are currently inactive. Please contact system admin or renew license to regain full access.
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  if (isSubscriptionLocked) {
                    setScanError("Scan QR Badge is inactive for expired users. Please renew subscription.");
                    return;
                  }
                  setStep('scanning_badge');
                }}
                disabled={isProcessingFile || isSubscriptionLocked}
                className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition ${
                  isSubscriptionLocked
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 border border-slate-300 dark:border-slate-700 opacity-60 cursor-not-allowed'
                    : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg shadow-indigo-500/20 cursor-pointer active:scale-[0.98]'
                }`}
              >
                <Camera size={16} /> {isSubscriptionLocked ? 'Scan QR Badge Inactive (Expired)' : 'Open Camera to Scan Printed QR Badge'}
              </button>

              <button
                onClick={() => {
                  if (isSubscriptionLocked) {
                    setScanError("Upload badge is inactive for expired users. Please renew subscription.");
                    return;
                  }
                  fileInputRef.current?.click();
                }}
                disabled={isProcessingFile || isSubscriptionLocked}
                className={`w-full py-2 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition border ${
                  isSubscriptionLocked
                    ? 'bg-slate-100 dark:bg-slate-800/40 text-slate-400 border-slate-200 dark:border-slate-800 opacity-50 cursor-not-allowed'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 cursor-pointer'
                }`}
              >
                {isProcessingFile ? (
                  <>
                    <RefreshCw size={13} className="text-indigo-500 animate-spin" />
                    <span>Processing PDF / Badge File...</span>
                  </>
                ) : (
                  <>
                    <Upload size={13} className={isSubscriptionLocked ? "text-slate-400" : "text-indigo-500"} />
                    <span>{isSubscriptionLocked ? "Upload Printed Badge (Inactive)" : "Upload Printed Badge (Photo or PDF)"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: LIVE CAMERA SCANNER */}
        {step === 'scanning_badge' && (isLoginMode || selectedTeacher) && (
          <div className="flex-1 flex flex-col space-y-3 min-h-[320px]">
            
            {/* Top Bar showing verifying identity */}
            {isLoginMode ? (
              <div className="flex justify-between items-center bg-indigo-50 dark:bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                <div className="flex items-center gap-2 min-w-0">
                  <QrCode size={16} className="text-indigo-600 dark:text-indigo-400 animate-pulse shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold text-slate-800 dark:text-slate-100 truncate">
                      QR Badge Login Mode
                    </p>
                    <p className="text-[9px] font-medium text-slate-500 dark:text-slate-400">
                      Hold physical card QR badge in front of camera
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center bg-indigo-50 dark:bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {selectedTeacher ? selectedTeacher.firstName[0] : ''}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold text-slate-800 dark:text-slate-100 truncate">
                      Verifying: {selectedTeacher ? `${selectedTeacher.firstName} ${selectedTeacher.lastName}` : ''}
                    </p>
                    <p className="text-[9px] font-mono text-indigo-600 dark:text-indigo-400">
                      Staff ID: {selectedTeacher ? (selectedTeacher.staffId || 'N/A') : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    stopCamera();
                    setStep('confirm_teacher');
                  }}
                  className="text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer"
                >
                  Back to Card
                </button>
              </div>
            )}

            {/* Scan Area */}
            <div className="relative flex-1 min-h-[220px] max-h-[280px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex flex-col items-center justify-center">
              
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                className="w-full h-full object-cover" 
              />

              {/* Scanning reticle */}
              {isScanning && !scanSuccess && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none overflow-hidden">
                  <div className="w-48 h-48 border-2 border-indigo-500/80 rounded-2xl relative flex items-center justify-center shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] bg-indigo-500/5">
                    {/* Moving Laser Scan Bar */}
                    <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#22d3ee] animate-[scanBar_2s_ease-in-out_infinite]" />
                    
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-cyan-400 rounded-tl-md shadow-[0_0_8px_#22d3ee]" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-cyan-400 rounded-tr-md shadow-[0_0_8px_#22d3ee]" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-cyan-400 rounded-bl-md shadow-[0_0_8px_#22d3ee]" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-cyan-400 rounded-br-md shadow-[0_0_8px_#22d3ee]" />
                  </div>
                  <div className="mt-3 px-3 py-1 bg-slate-900/90 border border-indigo-500/40 rounded-full flex items-center gap-2 backdrop-blur-md shadow-lg">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <p className="text-[10px] font-mono tracking-widest text-cyan-300 uppercase">
                      {isLoginMode ? "Scanning in Progress..." : `Scanning ${selectedTeacher ? DbController.formatTeacherFullName(selectedTeacher) : 'Teacher'}'s Badge...`}
                    </p>
                  </div>
                </div>
              )}

              {/* Scan Error Alert Overlay */}
              {scanError && (
                <div className="absolute inset-x-2 bottom-2 p-3 bg-red-950/90 border border-red-500/50 rounded-xl text-center space-y-1 z-20 backdrop-blur-md">
                  <AlertCircle size={20} className="text-red-400 mx-auto" />
                  <p className="text-[10px] text-red-200 leading-snug font-bold">{scanError}</p>
                </div>
              )}

              {/* Scan Success Overlay */}
              {scanSuccess && (
                <div className="absolute inset-0 bg-slate-950/90 z-20 flex flex-col items-center justify-center p-4 text-center space-y-2">
                  <CheckCircle2 size={36} className="text-emerald-400 animate-bounce" />
                  <p className="text-xs font-bold text-emerald-400">{scanSuccess}</p>
                </div>
              )}
            </div>

            {/* Fallback Option */}
            <div className="shrink-0 flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingFile}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[10px] uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition border border-slate-200 dark:border-slate-700 disabled:opacity-50"
              >
                {isProcessingFile ? (
                  <>
                    <RefreshCw size={12} className="text-indigo-500 animate-spin" />
                    <span>Processing File...</span>
                  </>
                ) : (
                  <>
                    <Upload size={12} className="text-indigo-500" />
                    <span>Upload Printed Badge (Photo or PDF)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </motion.div>
    </div>
  );
}
