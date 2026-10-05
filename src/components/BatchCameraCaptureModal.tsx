import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Camera, X, RefreshCw, Search, Check, ChevronRight, ChevronLeft, User, Eye, FlipHorizontal, ArrowRight } from 'lucide-react';
import { Student, ClassType, CLASSES } from '../types';
import { compressImage, triggerToast } from '../utils';

interface BatchCameraCaptureModalProps {
  students: Student[];
  onPhotoCaptured: (studentId: string, photoUrl: string) => void;
  onClose: () => void;
  theme: any;
}

export default function BatchCameraCaptureModal({
  students,
  onPhotoCaptured,
  onClose,
  theme
}: BatchCameraCaptureModalProps) {
  const [selectedClass, setSelectedClass] = useState<ClassType | 'All'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [hideWithPhotos, setHideWithPhotos] = useState(true);
  const [activeStudentId, setActiveStudentId] = useState<string>('');
  
  // Camera State
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isMirrored, setIsMirrored] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  // Session stats & log
  const [sessionCaptured, setSessionCaptured] = useState<Record<string, string>>({}); // studentId -> base64 photo
  const [sessionLog, setSessionLog] = useState<string[]>([]); // list of studentIds captured in this modal session

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      // Class filter
      if (selectedClass !== 'All' && student.class !== selectedClass) return false;
      
      // Photos filter
      const hasPhoto = !!student.photoUrl || !!sessionCaptured[student.id];
      if (hideWithPhotos && hasPhoto) return false;

      // Search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
        const studentId = (student.id || '').toLowerCase();
        if (!fullName.includes(term) && !studentId.includes(term)) {
          return false;
        }
      }
      return true;
    });
  }, [students, selectedClass, hideWithPhotos, searchTerm, sessionCaptured]);

  // Active student selection
  const activeStudent = useMemo(() => {
    return students.find(s => s.id === activeStudentId) || filteredStudents[0] || null;
  }, [students, activeStudentId, filteredStudents]);

  // Set first student as active initially or when list changes
  useEffect(() => {
    if (filteredStudents.length > 0 && (!activeStudentId || !students.some(s => s.id === activeStudentId))) {
      setActiveStudentId(filteredStudents[0].id);
    }
  }, [filteredStudents, activeStudentId, students]);

  // Enumerate cameras
  useEffect(() => {
    async function getCameras() {
      try {
        const devicesInfo = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devicesInfo.filter(device => device.kind === 'videoinput');
        setDevices(videoDevices);
        if (videoDevices.length > 0) {
          setSelectedDeviceId(videoDevices[0].deviceId);
        }
      } catch (err) {
        console.error("Error enumerating devices:", err);
      }
    }
    getCameras();
  }, []);

  // Control camera
  useEffect(() => {
    if (cameraActive) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [cameraActive, selectedDeviceId]);

  const startCamera = async () => {
    stopCamera();
    try {
      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId 
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStream(mediaStream);
      setCameraActive(true);
    } catch (err) {
      console.error("Error starting camera:", err);
      triggerToast("Could not access selected camera. Please check camera permissions.", "error");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  // Keyboard controls (Spacebar/Enter to capture, Arrow down/up to navigate)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if focus is not in search input
      if (document.activeElement?.tagName === 'INPUT' && document.activeElement?.id === 'student-search-input') {
        return;
      }

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        capturePhoto();
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        navigateStudent(1);
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        navigateStudent(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeStudent, cameraActive, filteredStudents, stream]);

  const capturePhoto = async () => {
    if (!activeStudent) {
      triggerToast("Please select a student to capture photo for.", "info");
      return;
    }
    if (!stream || !videoRef.current || !canvasRef.current) {
      triggerToast("Camera is not active. Press 'Start Camera' first.", "info");
      return;
    }

    setIsCapturing(true);
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        // Match aspect ratio or crop to square passport photo (1:1 aspect ratio)
        const size = Math.min(video.videoWidth, video.videoHeight);
        const startX = (video.videoWidth - size) / 2;
        const startY = (video.videoHeight - size) / 2;
        
        canvas.width = 400; // Passport dimensions standard
        canvas.height = 400;

        if (isMirrored) {
          // Flip horizontal
          context.translate(400, 0);
          context.scale(-1, 1);
        }

        context.drawImage(
          video,
          startX, startY, size, size, // Source rect
          0, 0, 400, 400 // Destination rect
        );

        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const compressed = await compressImage(dataUrl);

        // Assign
        onPhotoCaptured(activeStudent.id, compressed);
        
        // Update session tracking
        setSessionCaptured(prev => ({ ...prev, [activeStudent.id]: compressed }));
        setSessionLog(prev => {
          const filtered = prev.filter(id => id !== activeStudent.id);
          return [activeStudent.id, ...filtered];
        });

        triggerToast(`Passport photo captured & assigned for ${activeStudent.firstName} ${activeStudent.lastName}!`, "success");

        // Auto-advance to the next student who needs a photo
        const currentIndex = filteredStudents.findIndex(s => s.id === activeStudent.id);
        if (currentIndex !== -1 && currentIndex < filteredStudents.length - 1) {
          const nextStudent = filteredStudents[currentIndex + 1];
          setActiveStudentId(nextStudent.id);
        } else if (filteredStudents.length > 1) {
          // Wrap around or trigger message
          triggerToast("Finished batch cycle or reached end of current list.", "info");
        }
      }
    } catch (err) {
      console.error("Error capturing photo:", err);
      triggerToast("Failed to capture image.", "error");
    } finally {
      setIsCapturing(false);
    }
  };

  const navigateStudent = (direction: number) => {
    if (filteredStudents.length === 0) return;
    const currentIndex = filteredStudents.findIndex(s => s.id === (activeStudent?.id || ''));
    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = filteredStudents.length - 1;
    if (nextIndex >= filteredStudents.length) nextIndex = 0;
    
    const nextStudent = filteredStudents[nextIndex];
    if (nextStudent) {
      setActiveStudentId(nextStudent.id);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-5 no-print animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl h-[90vh] md:h-[85vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <Camera size={20} />
            </div>
            <div>
              <h2 className="font-black text-slate-800 text-base md:text-lg uppercase tracking-tight flex items-center gap-2">
                Batch Passport Camera 
                <span className="text-[10px] bg-indigo-600 text-white font-mono px-2 py-0.5 rounded-full uppercase font-bold tracking-widest">
                  Live Mode
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Align camera, press <kbd className="bg-slate-200 px-1.5 py-0.5 rounded font-mono text-[9px] font-bold text-slate-700">Space</kbd> or <kbd className="bg-slate-200 px-1.5 py-0.5 rounded font-mono text-[9px] font-bold text-slate-700">Enter</kbd> to save and auto-advance.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-xl transition cursor-pointer"
            title="Close camera modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Split View */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Left Panel: Students List Drawer */}
          <div className="w-full md:w-80 border-r border-slate-200 flex flex-col bg-slate-50/50 shrink-0 h-48 md:h-full">
            {/* Filter controls */}
            <div className="p-3 border-b border-slate-100 bg-white space-y-2.5 shrink-0">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                <input
                  id="student-search-input"
                  type="text"
                  placeholder="Search name or student ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Class Filter & Switch */}
              <div className="flex items-center gap-2 justify-between">
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value as ClassType | 'All')}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-[11px] font-bold text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 w-1/2"
                >
                  <option value="All">All Classes</option>
                  {CLASSES.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>

                <label className="flex items-center gap-1.5 cursor-pointer text-[10.5px] font-semibold text-slate-600 select-none">
                  <input
                    type="checkbox"
                    checked={hideWithPhotos}
                    onChange={(e) => setHideWithPhotos(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                  />
                  <span>No photo only</span>
                </label>
              </div>
            </div>

            {/* List Header / Progress summary */}
            <div className="px-3.5 py-2 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between text-[10px] font-mono text-slate-500 shrink-0">
              <span>Matching: <strong>{filteredStudents.length}</strong> students</span>
              <span>Session: <strong>{Object.keys(sessionCaptured).length}</strong> saved</span>
            </div>

            {/* Scrollable Student Cards List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {filteredStudents.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  <User size={24} className="mx-auto mb-2 opacity-40 text-slate-400" />
                  <p className="font-semibold">No students found</p>
                  <p className="text-[10px] mt-0.5 text-slate-400">Try changing your search filters</p>
                </div>
              ) : (
                filteredStudents.map(student => {
                  const isSavedThisSession = !!sessionCaptured[student.id];
                  const hasPhoto = !!student.photoUrl || isSavedThisSession;
                  const isActive = student.id === activeStudent?.id;
                  const photoPreview = sessionCaptured[student.id] || student.photoUrl;

                  return (
                    <button
                      key={student.id}
                      onClick={() => setActiveStudentId(student.id)}
                      className={`w-full text-left p-2 rounded-xl transition flex items-center gap-2.5 cursor-pointer border ${
                        isActive 
                          ? 'bg-indigo-50/90 border-indigo-200/80 shadow-xs' 
                          : 'bg-white hover:bg-slate-50 border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      {/* Photo Thumbnail */}
                      <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        {photoPreview ? (
                          <img src={photoPreview} alt="Student avatar" className="w-full h-full object-cover" />
                        ) : (
                          <User size={16} className="text-slate-400" />
                        )}
                      </div>

                      {/* Info details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-black text-slate-800 truncate leading-tight">
                            {student.firstName} {student.lastName}
                          </p>
                          {isSavedThisSession && (
                            <span className="text-[8px] bg-emerald-500 text-white font-black px-1 py-0.5 rounded-sm shrink-0 font-mono scale-90 uppercase">
                              Saved
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-sm leading-none shrink-0 uppercase">
                            {student.class}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400 truncate">
                            ID: {student.id.substring(0, 8).toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* Status indicator */}
                      <div className="shrink-0">
                        {hasPhoto ? (
                          <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center border border-emerald-200">
                            <Check size={10} strokeWidth={3} />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center" title="No photo assigned">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Panel: Camera Capture Station */}
          <div className="flex-1 bg-slate-900 text-white p-4 md:p-6 flex flex-col justify-between overflow-y-auto min-w-0">
            
            {/* Active Student Info Display */}
            {activeStudent ? (
              <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-700/80 border border-slate-600 overflow-hidden flex items-center justify-center shrink-0">
                    {(sessionCaptured[activeStudent.id] || activeStudent.photoUrl) ? (
                      <img 
                        src={sessionCaptured[activeStudent.id] || activeStudent.photoUrl} 
                        alt="Current passport" 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <User size={20} className="text-slate-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-black text-white text-base leading-tight uppercase font-mono tracking-tight">
                      {activeStudent.firstName} {activeStudent.lastName}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-black uppercase font-mono px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800/60 rounded-md">
                        CLASS: {activeStudent.class}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        STU-ID: {activeStudent.id.substring(0, 8).toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {(sessionCaptured[activeStudent.id] || activeStudent.photoUrl) ? (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-wider font-mono flex items-center gap-1">
                      <Check size={11} strokeWidth={3} /> Passport Assigned
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-wider font-mono flex items-center gap-1 animate-pulse">
                      Waiting for Capture
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-800 p-4 rounded-2xl text-center text-slate-400 text-xs shrink-0">
                Please select or enroll a student to begin capture.
              </div>
            )}

            {/* Live Camera Feed Viewport */}
            <div className="flex-1 my-4 flex flex-col items-center justify-center relative min-h-[220px]">
              
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-square max-w-[340px] md:max-w-[360px] w-full shadow-2xl border border-slate-700 flex items-center justify-center">
                
                {/* Canvas hidden (for capturing snapshots) */}
                <canvas ref={canvasRef} className="hidden" />

                {cameraActive ? (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className={`w-full h-full object-cover ${isMirrored ? 'transform -scale-x-100' : ''}`}
                    />

                    {/* Passport Alignment Guide Overlay */}
                    <div className="absolute inset-0 border-2 border-dashed border-indigo-500/30 pointer-events-none flex items-center justify-center">
                      {/* Translucent oval mask overlay */}
                      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full text-slate-950/60">
                        <defs>
                          <mask id="oval-mask">
                            <rect width="100" height="100" fill="white" />
                            <ellipse cx="50" cy="46" rx="28" ry="36" fill="black" />
                          </mask>
                        </defs>
                        <rect width="100" height="100" fill="currentColor" mask="url(#oval-mask)" />
                        {/* Oval Outline */}
                        <ellipse cx="50" cy="46" rx="28" ry="36" fill="none" stroke="#6366f1" strokeWidth="0.8" strokeDasharray="2 1.5" className="opacity-90" />
                      </svg>

                      {/* Text instructions on overlay */}
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md px-3 py-1 rounded-full border border-slate-700/50 text-white/95 text-[9.5px] font-black uppercase tracking-wider font-mono">
                        Center face inside oval
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-4 bg-slate-950/50">
                    <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                      <Camera size={28} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-200 uppercase tracking-wide">Camera Offline</h4>
                      <p className="text-[10px] text-slate-400 max-w-xs mt-1">
                        Turn on your camera to capture high-quality passport photographs.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCameraActive(true)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <RefreshCw size={12} />
                      Start Camera feed
                    </button>
                  </div>
                )}

                {/* Mirroring / Video controls */}
                {cameraActive && (
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsMirrored(prev => !prev)}
                      className="p-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-900 text-white/90 border border-slate-700/80 transition cursor-pointer"
                      title="Flip camera mirroring"
                    >
                      <FlipHorizontal size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="p-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-900 text-white/90 border border-slate-700/80 transition cursor-pointer"
                      title="Refresh stream"
                    >
                      <RefreshCw size={14} className={isCapturing ? 'animate-spin' : ''} />
                    </button>
                  </div>
                )}
              </div>

              {/* Camera device switcher */}
              {cameraActive && devices.length > 1 && (
                <div className="mt-3 flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-slate-400">Source:</span>
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-0.5 text-[10px] text-slate-300 font-mono focus:outline-hidden"
                  >
                    {devices.map((device, i) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        Camera {i + 1} ({device.label.substring(0, 15) || 'Video Input'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Bottom Controls Bar */}
            <div className="space-y-4 shrink-0">
              <div className="flex items-center justify-between gap-3 bg-slate-950/40 p-2.5 rounded-2xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => navigateStudent(-1)}
                  disabled={filteredStudents.length <= 1}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-black uppercase font-mono tracking-wide flex items-center gap-1 border border-slate-700 transition cursor-pointer active:scale-95 shrink-0"
                >
                  <ChevronLeft size={14} /> Prev
                </button>

                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={!cameraActive || !activeStudent || isCapturing}
                  className="flex-1 max-w-sm py-3 bg-amber-400 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 border border-amber-500 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider font-mono flex items-center justify-center gap-2 shadow-lg active:scale-95 transition cursor-pointer"
                >
                  <Camera size={16} className="text-slate-950" />
                  <span>Capture & Auto-Assign</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigateStudent(1)}
                  disabled={filteredStudents.length <= 1}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-black uppercase font-mono tracking-wide flex items-center gap-1 border border-slate-700 transition cursor-pointer active:scale-95 shrink-0"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>

              {/* Session History Log Thumbnails */}
              {sessionLog.length > 0 && (
                <div className="bg-slate-950/30 p-2.5 rounded-2xl border border-slate-800/60">
                  <div className="text-[9.5px] font-black uppercase tracking-wider font-mono text-slate-500 mb-2 flex items-center justify-between">
                    <span>Recently Captured In This Session</span>
                    <span className="text-emerald-400 font-bold">{sessionLog.length} Students</span>
                  </div>
                  <div className="flex flex-wrap gap-2 overflow-x-auto py-0.5">
                    {sessionLog.slice(0, 5).map(id => {
                      const s = students.find(item => item.id === id);
                      const base64 = sessionCaptured[id];
                      if (!s || !base64) return null;

                      return (
                        <div 
                          key={id} 
                          onClick={() => setActiveStudentId(id)}
                          className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-800/60 border border-slate-700/80 hover:border-indigo-500 cursor-pointer transition select-none"
                        >
                          <div className="w-6 h-6 rounded bg-slate-900 border border-slate-700 overflow-hidden shrink-0">
                            <img src={base64} alt={s.firstName} className="w-full h-full object-cover" />
                          </div>
                          <span className="text-[10px] font-black truncate max-w-[80px] pr-1">
                            {s.lastName}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
