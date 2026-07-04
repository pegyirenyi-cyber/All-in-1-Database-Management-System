import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, AlertCircle, Sparkles, UserCheck, QrCode } from 'lucide-react';
import jsQR from 'jsqr';
import { DbController } from '../db';
import { Teacher } from '../types';

interface QRBadgeScannerProps {
  onScanSuccess: (decodedValue: string) => void;
  onClose: () => void;
}

export default function QRBadgeScanner({ onScanSuccess, onClose }: QRBadgeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // Load registered teachers for the interactive demo simulation panel
  useEffect(() => {
    try {
      const allTeachers = DbController.getTeachers();
      setTeachers(allTeachers);
    } catch (err) {
      console.error("Error loading teachers for QR scanner:", err);
    }
  }, []);

  // Initialize camera and start scanning loop
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

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
      // Start the canvas rendering and QR analysis loop
      animationFrameRef.current = requestAnimationFrame(scanLoop);
    } catch (err: any) {
      console.warn("Camera access denied or failed:", err);
      setScanError("Unable to access system camera. You can still test this feature fully using the Simulated Badge Login deck below.");
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

  // Sound generator for a successful scan beep
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitched friendly beep
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

      oscillator.start();
      // Fade out quickly
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.15);
      oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (err) {
      console.warn("Could not play scan audio feedback:", err);
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
        stopCamera();
        onScanSuccess(code.data);
        return;
      }
    }

    animationFrameRef.current = requestAnimationFrame(scanLoop);
  };

  const handleSimulateScan = (teacher: Teacher) => {
    playBeep();
    stopCamera();
    // Simulate badge data payload: JSON containing staff credentials
    const badgePayload = JSON.stringify({
      staffId: teacher.staffId,
      email: teacher.email,
      schoolId: teacher.schoolId || DbController.getSchoolInfo().schoolId || "school_default"
    });
    onScanSuccess(badgePayload);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6 max-h-[95vh] flex flex-col justify-between">
        
        {/* Header */}
        <div className="flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400">
              <QrCode size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm tracking-tight">Teacher Badge Scanner</h3>
              <p className="text-[10px] text-slate-400">Scan school-assigned credentials to sign in</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scan Camera Area */}
        <div className="relative flex-1 min-h-[220px] max-h-[300px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center">
          
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

          {/* Scanner Overlay / Aim Guide */}
          {stream && isScanning && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
              {/* Outer scanning reticle */}
              <div className="w-48 h-48 border-2 border-indigo-500 rounded-2xl relative flex items-center justify-center shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]">
                {/* Scanning sweep line */}
                <div className="absolute w-full h-0.5 bg-indigo-400 shadow-[0_0_8px_#818cf8] animate-[bounce_2s_infinite]" />
                
                {/* Corner bracket markers */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-indigo-400 rounded-tl-md" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-indigo-400 rounded-tr-md" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-indigo-400 rounded-bl-md" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-indigo-400 rounded-br-md" />
              </div>
              <p className="text-[10px] font-mono tracking-widest text-indigo-300 uppercase mt-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                Align Badge QR Code
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

        {/* Simulated Badges Deck for Testing / Demo */}
        <div className="shrink-0 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
          <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
            <Sparkles size={13} className="text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-wider">Simulated Badges Panel (Interactive Testing)</span>
          </div>
          
          {teachers.length === 0 ? (
            <div className="text-center py-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl">
              <p className="text-[10px] text-slate-400">No registered teachers found in the system yet.</p>
              <p className="text-[9px] text-slate-400 mt-0.5">Log in as Admin first to add faculty and generate badges.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1">
              {teachers.map(tea => (
                <button
                  key={tea.id}
                  onClick={() => handleSimulateScan(tea)}
                  className="flex items-center gap-2 p-2 bg-slate-50 hover:bg-indigo-50/50 dark:bg-slate-950/40 dark:hover:bg-indigo-950/30 border border-slate-200/60 hover:border-indigo-200/50 dark:border-slate-800 dark:hover:border-indigo-900/50 rounded-xl text-left cursor-pointer transition-all active:scale-[0.98] group"
                >
                  <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                    {tea.photoUrl ? (
                      <img src={tea.photoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <UserCheck size={14} className="text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      {tea.firstName} {tea.lastName}
                    </p>
                    <p className="text-[8px] font-mono text-slate-400 truncate">
                      ID: {tea.staffId || "N/A"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
