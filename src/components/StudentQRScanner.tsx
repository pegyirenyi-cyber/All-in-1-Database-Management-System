import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, AlertCircle, UserCheck, QrCode, Users, Trash2, ShieldAlert } from 'lucide-react';
import jsQR from 'jsqr';
import { DbController } from '../db';
import { Student, ClassType, AttendanceStatus } from '../types';
import { ThemeStyles } from './ThemeWrapper';
import { evaluateSubscription } from '../subscription';

interface StudentQRScannerProps {
  selectedClass: ClassType;
  onScanSuccess: (studentId: string) => void;
  onBatchScanSuccess?: (studentIds: string[]) => void;
  onClose: () => void;
  theme: ThemeStyles;
  isSubscriptionLocked?: boolean;
}

export default function StudentQRScanner({ 
  selectedClass, 
  onScanSuccess, 
  onBatchScanSuccess, 
  onClose, 
  theme,
  isSubscriptionLocked: propIsLocked
}: StudentQRScannerProps) {
  const currentUser = DbController.getCurrentUser();
  const subStatus = currentUser ? evaluateSubscription(currentUser) : null;
  const isLocked = propIsLocked !== undefined ? propIsLocked : (subStatus?.isLocked || false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(!isLocked);
  const [studentsInClass, setStudentsInClass] = useState<Student[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // Batch scan specific state
  const [isBatchMode, setIsBatchMode] = useState<boolean>(false);
  const [scannedIds, setScannedIds] = useState<string[]>([]);
  const [lastScannedName, setLastScannedName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load students in the currently selected class for interactive simulation
  useEffect(() => {
    try {
      const allStudents = DbController.getStudents();
      const filtered = allStudents.filter(s => s.class === selectedClass);
      setStudentsInClass(filtered);
    } catch (err) {
      console.error("Error loading students for QR scanner:", err);
    }
  }, [selectedClass]);

  // Start camera and setup cleanup
  useEffect(() => {
    if (!isLocked) {
      startCamera();
    } else {
      setScanError("Scan QR badge feature is inactive for expired users. Please renew license to reactivate.");
    }
    return () => {
      stopCamera();
    };
  }, [isLocked]);

  const startCamera = async () => {
    try {
      setScanError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStream(mediaStream);
      setIsScanning(true);
      animationFrameRef.current = requestAnimationFrame(scanLoop);
    } catch (err: any) {
      console.warn("Camera access denied or failed for student scanner:", err);
      setScanError("Unable to access camera. Use the Interactive Simulated Roster deck below to test scanning.");
      setIsScanning(false);
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
  };

  const playBeep = () => {
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([90, 50, 120]);
      }
    } catch (e) {
      console.warn("Haptic feedback unavailable:", e);
    }

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // Quick pleasant beep
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.15);
      oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (err) {
      console.warn("Could not play scan audio feedback:", err);
    }
  };

  // Extract student ID from scanned content (handles raw ID or URL query parameters)
  const extractStudentId = (scannedValue: string): string => {
    const trimmed = scannedValue.trim();
    
    // Check if it's a URL
    if (trimmed.includes('studentId=')) {
      try {
        const match = trimmed.match(/[?&]studentId=([^&]+)/);
        if (match && match[1]) {
          return decodeURIComponent(match[1]);
        }
      } catch (e) {
        console.warn("Regex matching failed for URL:", e);
      }
    }
    return trimmed;
  };

  const handleScan = (studentId: string) => {
    const allStudents = DbController.getStudents();
    const student = allStudents.find(s => s.id === studentId);

    if (!student) {
      setErrorMessage(`Student with ID "${studentId}" not found in system.`);
      setLastScannedName(null);
      return;
    }

    if (student.class !== selectedClass) {
      setErrorMessage(`${student.firstName} ${student.lastName} belongs to ${student.class} (Selected: ${selectedClass}).`);
      setLastScannedName(null);
      return;
    }

    setErrorMessage(null);
    if (isBatchMode) {
      if (scannedIds.includes(studentId)) {
        setErrorMessage(`${student.firstName} ${student.lastName} is already in the batch.`);
        setLastScannedName(null);
      } else {
        setScannedIds(prev => [...prev, studentId]);
        setLastScannedName(`${student.firstName} ${student.lastName}`);
      }
    } else {
      // Single Scan Mode
      onScanSuccess(studentId);
    }
  };

  const scanLoop = () => {
    if (!videoRef.current || !canvasRef.current || !isScanning) {
      animationFrameRef.current = requestAnimationFrame(scanLoop);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (ctx && video.readyState === video.HAVE_CURRENT_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code) {
        setIsScanning(false);
        playBeep();
        const studentId = extractStudentId(code.data);
        handleScan(studentId);
        
        // Cooldown of 1.5s before resuming scan to prevent duplicate immediate scans of the same code
        setTimeout(() => {
          setIsScanning(true);
        }, 1500);
        return;
      }
    }

    animationFrameRef.current = requestAnimationFrame(scanLoop);
  };

  const handleSimulateScan = (student: Student) => {
    playBeep();
    handleScan(student.id);
  };

  const handleSubmitBatch = () => {
    if (scannedIds.length === 0) return;
    if (onBatchScanSuccess) {
      onBatchScanSuccess(scannedIds);
    } else {
      scannedIds.forEach(id => onScanSuccess(id));
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[500] p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5 max-h-[95vh] flex flex-col justify-between text-left">
        
        {/* Header */}
        <div className="flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <div className={`p-2 ${isLocked ? 'bg-amber-100 text-amber-600' : 'bg-indigo-50 text-indigo-600'} rounded-xl`}>
              <QrCode size={20} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-slate-900 text-sm tracking-tight">Student QR Code Scanner</h3>
                {isLocked && (
                  <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 font-mono text-[9px] font-bold rounded-md uppercase">
                    Scan Inactive
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400">Class: <span className="font-bold text-slate-700">{selectedClass}</span> • Align QR badge to register presence</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Expired User Inactive Alert */}
        {isLocked && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl flex items-start gap-3 shrink-0">
            <ShieldAlert size={20} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5">
              <div className="font-extrabold uppercase tracking-wide text-[11px] text-rose-800">Scan QR Badge Inactive</div>
              <p className="text-[10.5px] text-rose-700 leading-snug">
                Your school subscription/license has expired. Scanning student QR badges is currently inactive. Please top up or renew your license to unlock scanning.
              </p>
            </div>
          </div>
        )}

        {/* Batch Scan Mode Toggle */}
        <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/80 rounded-2xl shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl transition-all ${isBatchMode ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-200 text-slate-500'}`}>
              <Users size={16} />
            </div>
            <div>
              <span className="text-[11px] font-extrabold text-slate-800 block uppercase tracking-wider">Batch Scan Mode</span>
              <span className="text-[9px] text-slate-400">Scan multiple students consecutively before saving</span>
            </div>
          </div>
          <button
            onClick={() => {
              setIsBatchMode(!isBatchMode);
              setScannedIds([]);
              setLastScannedName(null);
              setErrorMessage(null);
            }}
            className="focus:outline-none cursor-pointer transition relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent"
          >
            {isBatchMode ? (
              <div className="w-10 h-6 bg-indigo-600 rounded-full p-1 transition-colors duration-200 ease-in-out flex items-center justify-end">
                <div className="w-4 h-4 bg-white rounded-full shadow-md" />
              </div>
            ) : (
              <div className="w-10 h-6 bg-slate-300 rounded-full p-1 transition-colors duration-200 ease-in-out flex items-center justify-start">
                <div className="w-4 h-4 bg-white rounded-full shadow-md" />
              </div>
            )}
          </button>
        </div>

        {/* Scan Camera Area */}
        <div className="relative flex-1 min-h-[220px] max-h-[300px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 flex flex-col items-center justify-center">
          
          {/* Active Camera Feed */}
          {stream && (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="absolute inset-0 w-full h-full object-cover" 
            />
          )}

          {/* Hidden Analysis Canvas */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Scanner Overlay */}
          {stream && isScanning && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
              <div className="w-48 h-48 border-2 border-indigo-500 rounded-2xl relative flex items-center justify-center shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]">
                {/* Sweep lines */}
                <div className="absolute w-full h-0.5 bg-indigo-400 shadow-[0_0_8px_#818cf8] animate-[bounce_2s_infinite]" />
                
                {/* Corner brackets */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-indigo-400 rounded-tl-md" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-indigo-400 rounded-tr-md" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-indigo-400 rounded-bl-md" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-indigo-400 rounded-br-md" />
              </div>
              <p className="text-[10px] font-mono tracking-widest text-indigo-300 uppercase mt-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                Align Student QR Code
              </p>
            </div>
          )}

          {/* Error / Fallback State */}
          {scanError && (
            <div className="p-6 text-center space-y-3 z-10 max-w-sm">
              <AlertCircle size={32} className="text-amber-500 mx-auto" />
              <p className="text-xs text-slate-300 leading-relaxed font-medium">{scanError}</p>
              <button 
                onClick={startCamera} 
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl cursor-pointer transition shadow-lg"
              >
                <RefreshCw size={11} /> Retry Camera
              </button>
            </div>
          )}
        </div>

        {/* Visual Scan Feedback */}
        {(lastScannedName || errorMessage) && (
          <div className="shrink-0 animate-fade-in">
            {lastScannedName ? (
              <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-850 rounded-xl text-[10px] font-bold">
                <span className="flex-1">✓ Scanned: <span className="font-extrabold text-emerald-900">{lastScannedName}</span> successfully!</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2.5 bg-rose-50 border border-rose-250 text-rose-800 rounded-xl text-[10px] font-bold">
                <span className="flex-1">⚠ {errorMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* Scanned Batch List */}
        {isBatchMode && scannedIds.length > 0 && (
          <div className="shrink-0 space-y-2 border-t border-slate-100 pt-3 animate-scale-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">Scanned Batch</span>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] font-black rounded-full">{scannedIds.length}</span>
              </div>
              <button 
                onClick={() => {
                  setScannedIds([]);
                  setLastScannedName(null);
                  setErrorMessage(null);
                }}
                className="text-[9px] font-bold text-rose-600 hover:text-rose-850 flex items-center gap-0.5 cursor-pointer hover:underline"
              >
                Clear Batch
              </button>
            </div>
            
            <div className="flex flex-wrap gap-1.5 max-h-[85px] overflow-y-auto pr-1 py-1">
              {scannedIds.map(id => {
                const s = studentsInClass.find(std => std.id === id);
                return (
                  <div key={id} className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-lg text-[10px] font-bold animate-scale-up shadow-3xs">
                    <span className="truncate max-w-[120px]">{s ? `${s.firstName} ${s.lastName}` : id}</span>
                    <button
                      onClick={() => {
                        setScannedIds(prev => prev.filter(item => item !== id));
                        if (lastScannedName && s && `${s.firstName} ${s.lastName}` === lastScannedName) {
                          setLastScannedName(null);
                        }
                      }}
                      className="p-0.5 text-emerald-600 hover:text-rose-600 hover:bg-emerald-100/50 rounded transition cursor-pointer"
                    >
                      <X size={10} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Submit Batch Button */}
            <button
              onClick={handleSubmitBatch}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer shadow-md text-center flex items-center justify-center gap-1.5 active:scale-[0.99]"
            >
              <UserCheck size={14} />
              Submit Batch Attendance ({scannedIds.length})
            </button>
          </div>
        )}

        {/* Live Roster Deck for Quick Attendance Scanning */}
        <div className="shrink-0 space-y-2 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-1.5 text-slate-800">
            <Users size={13} className="text-indigo-600" />
            <span className="text-[10px] font-black uppercase tracking-wider">Live Class Roster (Click-to-Scan Attendance)</span>
          </div>
          
          {studentsInClass.length === 0 ? (
            <div className="text-center py-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <p className="text-[10px] text-slate-400">No active students in {selectedClass} found.</p>
              <p className="text-[9px] text-slate-400 mt-0.5">Please enroll students in {selectedClass} first.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1">
              {studentsInClass.map(student => {
                const isScannedInBatch = isBatchMode && scannedIds.includes(student.id);
                return (
                  <button
                    key={student.id}
                    disabled={isScannedInBatch}
                    onClick={() => handleSimulateScan(student)}
                    className={`flex items-center gap-2 p-2 border rounded-xl text-left cursor-pointer transition-all active:scale-[0.98] group ${
                      isScannedInBatch 
                        ? 'bg-emerald-50/55 border-emerald-150 text-emerald-700 opacity-60 cursor-not-allowed' 
                        : 'bg-slate-50 hover:bg-indigo-50/50 border-slate-200/60 hover:border-indigo-200/50'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg overflow-hidden shrink-0 flex items-center justify-center font-bold text-[10px] font-mono ${
                      isScannedInBatch ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      {isScannedInBatch ? '✓' : `${student.firstName[0]}${student.lastName[0]}`}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[10px] font-bold truncate ${
                        isScannedInBatch ? 'text-emerald-700 line-through' : 'text-slate-800 group-hover:text-indigo-600'
                      }`}>
                        {student.firstName} {student.lastName}
                      </p>
                      <p className="text-[8px] font-mono text-slate-400 truncate">
                        ID: {student.id}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
