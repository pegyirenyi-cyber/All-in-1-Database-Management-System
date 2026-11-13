import React, { useState, useRef, ChangeEvent, FormEvent, useMemo, useEffect } from 'react';
import { Teacher, TeacherRank, TEACHER_RANKS, CLASSES, ClassType, SUBJECTS, SubjectType, DutyAssignment, DutyType, SchoolInfo } from '../types';
import { DbController } from '../db';
import { formatIdentifiableFilename } from '../utils';
import { compressImage, getWatermarkHtml, triggerToast } from '../utils';
import { ThemeStyles } from './ThemeWrapper';
import { 
  Plus, Search, Edit2, Trash2, Printer, Upload, X, Check, Save, UserCheck, User, Briefcase, Award, GraduationCap, Calendar, FileDown, ShieldAlert, RotateCcw, Eraser, Eye, FileSpreadsheet,
  ChevronLeft, ChevronRight, ChevronDown, Camera, Info, LayoutDashboard, BarChart2, AlertCircle, Users, ClipboardList, BookOpen, QrCode, IdCard, CalendarRange, Mic,
  Cake, Gift, Landmark, ShieldCheck, Key, Copy
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import CameraCapture from './CameraCapture';
import BatchTeacherCameraCaptureModal from './BatchTeacherCameraCaptureModal';
import GoogleDriveExportControl from './GoogleDriveExportControl';
import DutyRoster from './DutyRoster';
import StaffHandbook from './StaffHandbook';
import LeaveTracker from './LeaveTracker';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, LineChart, Line, AreaChart, Area } from 'recharts';

const GHANA_CREST_SVG_SIMPLE = `
<svg viewBox="0 0 100 100" width="100%" height="100%" style="width: 250px; height: 250px; color: #000;">
  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 1.5" />
  <circle cx="50" cy="50" r="41" fill="none" stroke="currentColor" stroke-width="0.6" />
  <path d="M 32,32 L 68,32 C 68,32 68,58 50,74 C 32,58 32,32 32,32 Z" fill="none" stroke="currentColor" stroke-width="1.2" />
  <path d="M 50,32 L 50,74" stroke="currentColor" stroke-width="0.6" />
  <path d="M 32,50 L 68,50" stroke="currentColor" stroke-width="0.6" />
  <polygon points="50,45 52,49 57,49 53,52 55,56 50,54 45,56 47,52 43,49 48,49" fill="currentColor" opacity="0.6" />
  <path d="M 53,36 L 65,36 L 65,46 L 53,46 Z" fill="none" stroke="currentColor" stroke-width="0.6" />
  <path d="M 53,41 L 65,41" stroke="currentColor" stroke-width="0.4" />
  <line x1="41" y1="36" x2="41" y2="46" stroke="currentColor" stroke-width="1.2" />
  <circle cx="41" cy="35" r="1.2" fill="currentColor" />
  <path d="M 23,35 C 19,48 19,63 34,74" fill="none" stroke="currentColor" stroke-width="0.6" />
  <path d="M 77,35 C 81,48 81,63 66,74" fill="none" stroke="currentColor" stroke-width="0.6" />
  <path d="M 25,79 L 75,79 C 75,79 65,85 50,85 C 35,85 25,79 25,79 Z" fill="none" stroke="currentColor" stroke-width="0.6" />
</svg>
`;

interface Props {
  theme: ThemeStyles;
  teachers: Teacher[];
  schoolInfo?: SchoolInfo;
  onRefresh: () => void;
  isAutoSave: boolean;
  onManualSave: () => void;
  onSaveAll?: () => Promise<void>;
  isManualSaving?: boolean;
  userRole?: string;
  onNavigate?: (tab: string) => void;
}

const INITIAL_FORM: Partial<Teacher> = {
  firstName: '',
  middleName: '',
  lastName: '',
  gender: 'Male',
  dateOfBirth: '',
  placeOfBirth: '',
  subjectsTaught: '',
  professionalQualifications: '',
  highestAcademicQualifications: '',
  rank: 'Not applicable',
  dateOfFirstAppointment: '',
  dateOfPostingToCurrentStation: '',
  staffId: '',
  tinNumber: '',
  ntcNumber: '',
  ssnitNumber: '',
  district: '',
  circuit: '',
  photoUrl: '',
  email: '',
  schoolId: '',
  schoolCode: '',
  subjectSpecialization: '',
  assignedClass: 'None',
  assignedClasses: [],
  assignedSubjects: [],
  permissions: {
    canAccessStudents: true,
    canAccessAttendance: true,
    canAccessAssessments: true,
    canAccessSystemControl: true,
    canEditStudents: true,
    canApproveAttendance: true,
    canEditGrades: true,
    canExportReports: true
  }
};

export default function TeachersTab({ theme, teachers, schoolInfo: propSchoolInfo, onRefresh, isAutoSave, onManualSave, onSaveAll, isManualSaving, userRole, onNavigate }: Props) {
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>(() => propSchoolInfo || DbController.getSchoolInfo());

  useEffect(() => {
    if (propSchoolInfo) {
      setSchoolInfo(propSchoolInfo);
    }
  }, [propSchoolInfo]);

  useEffect(() => {
    const handleSchoolSync = () => {
      setSchoolInfo(DbController.getSchoolInfo());
    };
    window.addEventListener('school-system-sync', handleSchoolSync);
    window.addEventListener('school-updated', handleSchoolSync);
    return () => {
      window.removeEventListener('school-system-sync', handleSchoolSync);
      window.removeEventListener('school-updated', handleSchoolSync);
    };
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Success feedback states
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showJsonSuccess, setShowJsonSuccess] = useState(false);
  const prevIsSaving = useRef(isManualSaving);

  // Monitor save progress for success feedback
  useEffect(() => {
    if (prevIsSaving.current && !isManualSaving) {
      // Transitioned from saving to idle
      setShowSaveSuccess(true);
      const timer = setTimeout(() => setShowSaveSuccess(false), 2500);
      return () => clearTimeout(timer);
    }
    prevIsSaving.current = isManualSaving;
  }, [isManualSaving]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  const startListening = () => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      triggerToast('Speech recognition not supported in this browser.', 'info');
      return;
    }

    try {
      const rec = new SpeechRecognitionAPI();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        triggerToast('Listening... Speak now', 'info');
      };

      rec.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        if (text) {
          const cleanedText = text.trim().replace(/\.$/, '');
          setSearchTerm(cleanedText);
          triggerToast(`Dictated: "${cleanedText}"`, 'success');
        }
      };

      rec.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          triggerToast('Microphone access denied. Please allow microphone permissions.', 'error');
        } else {
          triggerToast(`Voice search error: ${event.error}`, 'error');
        }
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.error("Failed to start speech recognition", err);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };
  
  // Sort order state (defaults to name A-Z)
  const [teacherSortBy, setTeacherSortBy] = useState<'name-asc' | 'name-desc' | 'id-asc'>('name-asc');

  // Pagination states
  const [teacherPage, setTeacherPage] = useState(1);
  const [teacherPageSize, setTeacherPageSize] = useState(12);
  const [directoryView, setDirectoryView] = useState<'grid' | 'table'>('table');
  const [showAnalyticsHub, setShowAnalyticsHub] = useState(false);
  const [showBulkQrModal, setShowBulkQrModal] = useState(false);
  const [selectedBulkTeachers, setSelectedBulkTeachers] = useState<string[]>([]);
  const [bulkQrCols, setBulkQrCols] = useState<2 | 3 | 4>(3);
  const [bulkQrFormat, setBulkQrFormat] = useState<'id_card' | 'qr_only'>('qr_only');

  // Bulk selection states
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('All');

  const handleRemoveTeacherSubject = (teacherId: string, subToRemove: string) => {
    const tea = teachers.find(t => t.id === teacherId);
    if (!tea) return;
    const updatedSubjects = (tea.assignedSubjects || []).filter(s => s !== subToRemove);
    const updatedTeacher = { ...tea, assignedSubjects: updatedSubjects, subjectsTaught: updatedSubjects.join(', ') };
    DbController.saveTeacher(updatedTeacher);
    onRefresh();
    showToast(`Removed subject "${subToRemove}" from ${tea.firstName} ${tea.lastName}`);
  };

  // Reset bulk selection on filter change
  useEffect(() => {
    setSelectedTeacherIds([]);
  }, [searchTerm, teacherPage, teacherPageSize, teacherSortBy, selectedSubjectFilter]);

  // Reset page when search or filters change
  useEffect(() => {
    setTeacherPage(1);
  }, [searchTerm, teacherSortBy, selectedSubjectFilter]);
  
  // Registration Dialog and Form controllers
  const [isEditing, setIsEditing] = useState(false);
  const [formState, setFormState] = useState<Partial<Teacher>>({ ...INITIAL_FORM });
  const [formIdMode, setFormIdMode] = useState<'staffId' | 'tinNumber'>('staffId');

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

  // Check if current logged-in user is a Headteacher
  const isHeadteacherLoggedIn = useMemo(() => {
    const activeRole = userRole || DbController.getCurrentUser()?.role;
    return activeRole === 'Headteacher';
  }, [userRole]);

  const isAdmin = useMemo(() => {
    const user = DbController.getCurrentUser();
    const activeRole = userRole || user?.role;
    return activeRole === 'Admin' || user?.email?.toLowerCase().trim() === 'pegyirenyi@gmail.com';
  }, [userRole]);

  // Check if target edited teacher is NOT a Class Teacher (role is Headteacher or Admin)
  const isTargetNotClassTeacher = useMemo(() => {
    if (!formState?.email) return false;
    const registeredUsers = DbController.getRegisteredUsers();
    const targetUser = registeredUsers.find(u => (u.email || '').toLowerCase().trim() === formState.email?.toLowerCase().trim());
    return targetUser && (targetUser.role === 'Admin' || targetUser.role === 'Headteacher');
  }, [formState?.email]);

  const targetUserRole = useMemo(() => {
    if (!formState?.email) return 'Teacher';
    const registeredUsers = DbController.getRegisteredUsers();
    const targetUser = registeredUsers.find(u => (u.email || '').toLowerCase().trim() === formState.email?.toLowerCase().trim());
    return targetUser ? targetUser.role : 'Teacher';
  }, [formState?.email]);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showImageLinkModal, setShowImageLinkModal] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState('');
  const [selectedIdCardTeacher, setSelectedIdCardTeacher] = useState<Teacher | null>(null);
  const [selectedIdCardFormat, setSelectedIdCardFormat] = useState<'id_card' | 'qr_only'>('id_card');

  const renderTeacherIdCardContent = (teacher: Teacher, keyPrefix: string) => {
    const activeSchoolCode = teacher.schoolId || schoolInfo.schoolId || DbController.resolveActiveSchoolId();
    const activeOwnerId = teacher.ownerId || schoolInfo.ownerId || DbController.getCurrentUser()?.uid;
    const badgeSignature = DbController.generateBadgeSignature(
      teacher.staffId || '',
      teacher.email || '',
      activeSchoolCode
    );

    return (
      <div 
        key={`${keyPrefix}-${teacher.id}`}
        className="id-card-print-item relative flex flex-col justify-between p-4"
      >
        {/* Card Header Wave / Banner */}
        <div className="bg-teal-900 text-white p-3 pt-4 text-center relative overflow-hidden flex flex-col items-center justify-center min-h-[78px] rounded-t-xl -m-4 mb-4">
          <div className="absolute inset-0 bg-gradient-to-tr from-teal-950 to-teal-800 opacity-90"></div>
          
          <div className="relative z-10 flex items-center gap-2 max-w-[90%] justify-center">
            {schoolInfo.logoUrl ? (
              <img 
                src={schoolInfo.logoUrl} 
                alt="School Logo" 
                className="w-7 h-7 object-contain rounded-full bg-white p-0.5"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold text-white">SCH</div>
            )}
            
            <div className="text-left flex-1 min-w-0">
              <h4 className="text-[9px] font-black uppercase tracking-wide truncate leading-tight">
                {schoolInfo.name}
              </h4>
              <p className="text-[6.5px] italic font-mono text-teal-200 truncate leading-none mt-0.5">
                "{schoolInfo.motto}"
              </p>
              <div className="text-[7px] font-mono font-black text-amber-300 tracking-wider mt-0.5">
                CODE: {activeSchoolCode}
              </div>
            </div>
          </div>
          
          {/* ID Card label tab */}
          <div className="absolute bottom-0 right-0 left-0 bg-amber-500 text-[6.5px] font-extrabold uppercase tracking-widest py-0.5 text-center text-slate-950 z-10 flex items-center justify-center gap-1.5">
            <span>Faculty Credential Badge</span>
            <span>•</span>
            <span className="font-mono">ID: {activeSchoolCode}</span>
          </div>
        </div>

        {/* Card Body - Photo & Credentials & QR */}
        <div className="flex-1 flex flex-col items-center justify-between relative z-10 py-1 bg-radial from-white to-slate-50/50">
          {/* Watermark Logo/Badge */}
          {schoolInfo.logoUrl && (
            <img 
              src={schoolInfo.logoUrl} 
              alt="Watermark" 
              className="absolute inset-0 m-auto w-32 h-32 object-contain opacity-[0.03] pointer-events-none select-none"
              referrerPolicy="no-referrer"
            />
          )}

          {/* Teacher Details & Photo */}
          <div className="flex flex-col items-center space-y-2">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-2 border-teal-900 overflow-hidden bg-slate-100 flex items-center justify-center shadow-md">
                {teacher.photoUrl ? (
                  <img 
                    src={teacher.photoUrl} 
                    alt={`${teacher.firstName} Photo`} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User size={36} className="text-slate-400" />
                )}
              </div>
            </div>

            <div className="text-center animate-none">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                {teacher.firstName} {teacher.lastName}
              </h3>
              <p className="text-[9px] font-extrabold text-teal-800 uppercase tracking-widest mt-0.5">
                {teacher.rank}
              </p>
              <div className="mt-1 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono text-[7.5px] font-black inline-flex items-center gap-1">
                <span>🏫 School ID:</span> <span>{activeSchoolCode}</span>
              </div>
            </div>
          </div>

          {/* QR Code and Credentials block with embedded School Code */}
          <div className="flex flex-col items-center space-y-1.5 w-full mt-1 pb-1">
            {/* Embedded QR Code containing unique School Code, Staff ID, and User ID link */}
            <div className="bg-white p-1.5 rounded-xl border border-slate-200/80 shadow-xs">
              <QRCodeSVG 
                value={JSON.stringify({
                  schoolCode: activeSchoolCode,
                  schoolId: activeSchoolCode,
                  ownerId: activeOwnerId,
                  teacherId: teacher.id,
                  staffId: teacher.staffId,
                  name: `${teacher.firstName} ${teacher.lastName}`.trim(),
                  email: teacher.email,
                  role: 'Teacher',
                  signature: badgeSignature
                })}
                size={100}
                level="M"
                includeMargin={false}
                className="animate-none"
              />
            </div>
            <p className="text-[7px] font-mono font-bold uppercase tracking-widest text-slate-400">
              Scan QR Badge to Sign In
            </p>
          </div>
        </div>

        {/* Card Footer / School info */}
        <div className="border-t border-slate-100 pt-2 text-center text-[7px] font-mono text-slate-500 space-y-0.5 shrink-0">
          <div className="font-bold text-slate-700">STAFF ID: {teacher.staffId || "N/A"} • SCHOOL CODE: {activeSchoolCode}</div>
          <div>REGISTERED: {teacher.dateOfFirstAppointment || "N/A"}</div>
          <div className="text-[6.5px] text-teal-800 font-bold uppercase tracking-wider">Ghana Education Service</div>
        </div>
      </div>
    );
  };

  const renderTeacherQrOnlyContent = (teacher: Teacher, keyPrefix: string) => {
    const activeSchoolCode = teacher.schoolId || schoolInfo.schoolId || DbController.resolveActiveSchoolId();
    const activeOwnerId = teacher.ownerId || schoolInfo.ownerId || DbController.getCurrentUser()?.uid;
    const badgeSignature = DbController.generateBadgeSignature(
      teacher.staffId || '',
      teacher.email || '',
      activeSchoolCode
    );

    return (
      <div 
        key={`${keyPrefix}-qr-${teacher.id}`}
        className="qr-print-item flex flex-col items-center justify-center p-6 border border-slate-100 rounded-2xl bg-white shadow-sm"
      >
        <div className="text-center mb-3">
          <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-wider truncate max-w-[150px]">
            {teacher.firstName} {teacher.lastName}
          </h4>
          <p className="text-[8px] font-mono font-bold text-slate-400 mt-0.5">
            STAFF ID: {teacher.staffId || "N/A"}
          </p>
          <div className="mt-1 px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono text-[7.5px] font-black inline-block">
            SCHOOL CODE: {activeSchoolCode}
          </div>
        </div>

        <div className="bg-white p-3 rounded-2xl border-2 border-slate-100 shadow-sm mb-3">
          <QRCodeSVG 
            value={JSON.stringify({
              schoolCode: activeSchoolCode,
              schoolId: activeSchoolCode,
              ownerId: activeOwnerId,
              teacherId: teacher.id,
              staffId: teacher.staffId,
              name: `${teacher.firstName} ${teacher.lastName}`.trim(),
              email: teacher.email,
              role: 'Teacher',
              signature: badgeSignature
            })}
            size={140}
            level="H"
            includeMargin={true}
          />
        </div>

        <div className="text-center">
          <p className="text-[7.5px] font-black text-indigo-600 uppercase tracking-widest">
            Faculty Access Pass
          </p>
          <div className="flex items-center gap-1 justify-center mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[6.5px] font-bold text-slate-500 uppercase tracking-tight">Verified • School {activeSchoolCode}</span>
          </div>
        </div>
      </div>
    );
  };
  const [teacherToDelete, setTeacherToDelete] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isBatchCameraOpen, setIsBatchCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Enrollment confirmation & toast notice states
  const [pendingTeacher, setPendingTeacher] = useState<Teacher | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Bulk import states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [parsedTeachers, setParsedTeachers] = useState<{ teacher: Partial<Teacher>; errors: string[] }[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [showLoadDashboard, setShowLoadDashboard] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Aggregated data for Subject Load Dashboard
  const workloadData = useMemo(() => {
    return teachers.map(t => {
      const classCount = (t.assignedClasses || []).length;
      const subjectCount = (t.assignedSubjects || []).length;
      const totalLoad = classCount + (subjectCount * 0.5); // Weighted load: classes count more than subjects
      return {
        name: `${t.firstName} ${t.lastName.charAt(0)}.`,
        fullName: `${t.firstName} ${t.lastName}`,
        classes: classCount,
        subjects: subjectCount,
        totalLoad,
        isOverloaded: totalLoad > 8,
        isUnderloaded: totalLoad < 2
      };
    }).sort((a, b) => b.totalLoad - a.totalLoad);
  }, [teachers]);

  const performanceData = useMemo(() => {
    // This is a simulated join between teachers and assessments
    // In a real app, this would be a backend query
    const allAssessments = DbController.getAssessments();
    
    return teachers.map(t => {
      // Find assessments for classes and subjects assigned to this teacher
      const teacherAssessments = allAssessments.filter(a => 
        (t.assignedSubjects || []).includes(a.subject as any) && 
        (t.assignedClasses || []).includes(a.class as any)
      );

      const scores = teacherAssessments.map(a => a.totalScore || 0);
      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      
      return {
        teacherId: t.id,
        name: `${t.firstName} ${t.lastName.charAt(0)}.`,
        fullName: `${t.firstName} ${t.lastName}`,
        avgScore: Number(avgScore.toFixed(1)),
        assessmentCount: scores.length,
        rank: t.rank,
        isHighPerformer: avgScore > 75,
        isLowPerformer: avgScore > 0 && avgScore < 45
      };
    }).filter(t => t.assessmentCount > 0).sort((a, b) => b.avgScore - a.avgScore);
  }, [teachers]);

  const classCoverage = useMemo(() => {
    const coverage: Record<string, { teachers: string[], primary?: string }> = {};
    CLASSES.forEach(cls => {
      coverage[cls] = { teachers: [] };
    });

    teachers.forEach(t => {
      if (t.assignedClass && t.assignedClass !== 'None') {
        if (coverage[t.assignedClass]) {
          coverage[t.assignedClass].primary = `${t.firstName} ${t.lastName}`;
        }
      }
      (t.assignedClasses || []).forEach(cls => {
        if (coverage[cls]) {
          coverage[cls].teachers.push(`${t.firstName} ${t.lastName}`);
        }
      });
    });

    return coverage;
  }, [teachers]);

  // Parse CSV utility which handles quotes and double quotes escapes properly
  const parseCSV = (text: string): string[][] => {
    const result: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            cell += '"';
            i++; // skip next char
          } else {
            inQuotes = false;
          }
        } else {
          cell += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          row.push(cell.trim());
          cell = '';
        } else if (char === '\n' || char === '\r') {
          row.push(cell.trim());
          cell = '';
          if (row.length > 0 && (row.length > 1 || row[0] !== '')) {
            result.push(row);
          }
          row = [];
          if (char === '\r' && nextChar === '\n') {
            i++;
          }
        } else {
          cell += char;
        }
      }
    }

    if (row.length > 0 || cell !== '') {
      row.push(cell.trim());
      if (row.length > 1 || row[0] !== '') {
        result.push(row);
      }
    }

    return result;
  };

  // Maps raw CSV cells to structured Teacher records with inline warnings & default fallbacks
  const mapCSVRowsToTeachers = (rows: string[][]): { teacher: Partial<Teacher>; errors: string[] }[] => {
    if (rows.length < 2) return [];

    const rawHeaders = rows[0].map(h => h.trim().toLowerCase());
    const dataRows = rows.slice(1);

    // Dynamic, flexible index matching
    const findIndex = (aliases: string[]) => {
      return rawHeaders.findIndex(header => 
        aliases.some(alias => header === alias || header.replace(/[\s_-]/g, '') === alias.replace(/[\s_-]/g, ''))
      );
    };

    const idIdx = findIndex(['id', 'teacherid', 'teacher id']);
    const firstNameIdx = findIndex(['firstname', 'first name', 'fname']);
    const middleNameIdx = findIndex(['middlename', 'middle name', 'mname']);
    const lastNameIdx = findIndex(['lastname', 'last name', 'lname']);
    const genderIdx = findIndex(['gender', 'sex']);
    const dobIdx = findIndex(['dateofbirth', 'date of birth', 'dob', 'birthdate']);
    const placeOfBirthIdx = findIndex(['placeofbirth', 'place of birth']);
    const subjectsIdx = findIndex(['subjects', 'subject', 'subjectstaught', 'subjects taught', 'taught', 'class taught', 'classroom']);
    const profQualIdx = findIndex(['professionalqualifications', 'professional qualifications', 'professional qualification', 'prof qual']);
    const acadQualIdx = findIndex(['highestacademicqualifications', 'highest academic qualifications', 'academic qualification', 'academic qualifications', 'acad qual']);
    const rankIdx = findIndex(['rank', 'professionalrank', 'professional rank']);
    const firstApptIdx = findIndex(['dateoffirstappointment', 'date of first appointment', 'first appointment', 'appt date', 'first appt']);
    const postingIdx = findIndex(['dateofposting', 'date of posting', 'posting date', 'posting']);
    const staffIdIdx = findIndex(['staffid', 'staff id', 'staffidnumber', 'staff id number']);
    const ntcIdx = findIndex(['ntcnumber', 'ntc number', 'ntc']);
    const ssnitIdx = findIndex(['ssnitnumber', 'ssnit number', 'ssnit']);
    const districtIdx = findIndex(['district', 'academic district']);
    const circuitIdx = findIndex(['circuit', 'educational circuit']);

    return dataRows.map((row) => {
      const getValue = (idx: number) => (idx >= 0 && idx < row.length ? row[idx].trim() : '');
      const errors: string[] = [];

      // Required fields checks
      const firstName = getValue(firstNameIdx);
      if (!firstName) {
        errors.push("Missing First Name *");
      }

      const lastName = getValue(lastNameIdx);
      if (!lastName) {
        errors.push("Missing Last Name *");
      }

      const staffId = getValue(staffIdIdx);
      // Staff ID is optional like NTC number

      // Gender normalization
      let gender: 'Male' | 'Female' = 'Male';
      const rawGender = getValue(genderIdx);
      if (rawGender) {
        const gLower = rawGender.toLowerCase();
        if (gLower === 'male' || gLower === 'm') {
          gender = 'Male';
        } else if (gLower === 'female' || gLower === 'f') {
          gender = 'Female';
        } else {
          errors.push(`Invalid Gender value: "${rawGender}". Must specify "Male" or "Female"`);
        }
      }

      // Birthdate formatting checks if present
      const dateOfBirth = getValue(dobIdx);
      if (dateOfBirth) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateOfBirth)) {
          errors.push(`Invalid Date of Birth format: "${dateOfBirth}". Use absolute YYYY-MM-DD`);
        }
      }

      // First appointment date formatting checks if present
      const firstAppt = getValue(firstApptIdx);
      if (firstAppt) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(firstAppt)) {
          errors.push(`Invalid First Appointment Date: "${firstAppt}". Use YYYY-MM-DD`);
        }
      }

      // Posting date formatting checks if present
      const postingDate = getValue(postingIdx);
      if (postingDate) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(postingDate)) {
          errors.push(`Invalid Posting Date: "${postingDate}". Use YYYY-MM-DD`);
        }
      }

      // Professional Rank check & alignments
      let rank: TeacherRank = 'Not applicable';
      const rawRank = getValue(rankIdx);
      if (rawRank) {
        const foundRank = TEACHER_RANKS.find(r => 
          r.toLowerCase() === rawRank.toLowerCase() || 
          r.replace(/\s+/g, '').toLowerCase() === rawRank.replace(/\s+/g, '').toLowerCase()
        );
        if (foundRank) {
          rank = foundRank;
        } else {
          // If not matching but has content, raise an error pointing to options
          errors.push(`Invalid Professional Rank: "${rawRank}". Expected one of: ${TEACHER_RANKS.join(', ')}`);
        }
      }

      const rawId = getValue(idIdx);
      const id = rawId || 'T' + Math.floor(1000 + Math.random() * 9000);
      const currentUser = DbController.getCurrentUser();

      const teacher: Partial<Teacher> = {
        id,
        firstName,
        middleName: getValue(middleNameIdx),
        lastName,
        gender,
        dateOfBirth: dateOfBirth || '',
        placeOfBirth: getValue(placeOfBirthIdx),
        subjectsTaught: getValue(subjectsIdx),
        professionalQualifications: getValue(profQualIdx),
        highestAcademicQualifications: getValue(acadQualIdx),
        rank,
        dateOfFirstAppointment: firstAppt || '',
        dateOfPostingToCurrentStation: postingDate || '',
        staffId,
        ntcNumber: getValue(ntcIdx),
        ssnitNumber: getValue(ssnitIdx),
        district: getValue(districtIdx),
        circuit: getValue(circuitIdx),
        schoolId: currentUser?.schoolId || '',
        photoUrl: '', // Default blank on bulk uploading
        createdAt: new Date().toISOString()
      };

      return { teacher, errors };
    });
  };

  const processFile = (file: File) => {
    setImportFile(file);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const rows = parseCSV(text);
        if (rows.length < 2) {
          setImportError("CSV contains insufficient rows. Please include a header row followed by data.");
          setParsedTeachers([]);
          return;
        }
        const mapped = mapCSVRowsToTeachers(rows);
        setParsedTeachers(mapped);
      } catch (err) {
        console.error(err);
        setImportError("Encountered filesystem read or encoding error parsing the CSV.");
        setParsedTeachers([]);
      }
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.name.endsWith('.csv')) {
        processFile(file);
      } else {
        setImportError("The dropped file is not a supported CSV spreadsheet. Please upload a .csv file.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.name.endsWith('.csv')) {
        processFile(file);
      } else {
        setImportError("The selected file must be a structured CSV spreadsheet format (.csv).");
      }
    }
  };

  const handleDownloadTemplate = () => {
    const headers = [
      'First Name', 'Middle Name', 'Last Name', 'Gender', 'Date of Birth',
      'Place of Birth', 'Subjects Taught', 'Professional Qualifications',
      'Highest Academic Qualifications', 'Rank', 'Date of First Appointment',
      'Date of Posting', 'Staff ID', 'NTC Number', 'SSNIT Number',
      'District', 'Circuit'
    ];
    const examples = [
      ['Mary', 'Ama', 'Annan', 'Female', '1988-05-15', 'Accra', 'English Language', 'Licensed Teacher (NTC Certified)', 'Bachelor of Education (B.Ed)', 'Senior Superintendent I', '2010-09-01', '2018-01-15', 'GES-T10294', 'NTC-90291', 'SSNIT-2019A', 'Kumasi Metropolitan', 'Asokonyi Circuit'],
      ['Emmanuel', '', 'Kofi', 'Male', '1990-11-23', 'Cape Coast', 'Mathematics / Science', 'Professional Teacher (Diploma/Degree in Education)', 'Master of Education / Arts / Science (M.Ed / M.A / M.Sc)', 'Principal Superintendent', '2012-10-10', '2020-03-01', 'GES-T39021', 'NTC-81923', 'SSNIT-89201', 'Cape Coast District', 'Central Circuit']
    ];

    const csvContent = [
      headers.join(','),
      ...examples.map(ex => ex.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Staff_Bulk_Import_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExecuteImport = () => {
    const validRows = parsedTeachers.filter(p => p.errors.length === 0);
    if (validRows.length === 0) {
      alert("No valid rows available to import. Correct validation issues and try again.");
      return;
    }

    validRows.forEach(row => {
      DbController.saveTeacher(row.teacher as Teacher);
    });

    onRefresh();
    setShowImportModal(false);
    setImportFile(null);
    setParsedTeachers([]);
    alert(`Successfully populated ${validRows.length} new teacher records to Cloud Firestore.`);
  };

  // Filter & auto-sort teachers dynamically with default alphabetical sorting
  const filteredTeachers = useMemo(() => {
    const term = searchTerm?.toLowerCase() || '';
    const filtered = teachers.filter(tea => {
      if (!tea) return false;
      const fullName = `${tea.firstName || ''} ${tea.middleName || ''} ${tea.lastName || ''}`.toLowerCase();
      const matchesSearch = fullName.includes(term) || (tea.staffId?.toLowerCase() || '').includes(term);
      const matchesSubject = selectedSubjectFilter === 'All' || (tea.assignedSubjects || []).includes(selectedSubjectFilter as any);
      return matchesSearch && matchesSubject;
    });

    // Default alphabetical sorting by name (A-Z)
    return filtered.sort((a, b) => {
      if (teacherSortBy === 'name-desc') {
        const nameA = `${a.firstName || ''} ${a.middleName || ''} ${a.lastName || ''}`.trim().toLowerCase();
        const nameB = `${b.firstName || ''} ${b.middleName || ''} ${b.lastName || ''}`.trim().toLowerCase();
        return nameB.localeCompare(nameA);
      }
      if (teacherSortBy === 'id-asc') {
        return (a.staffId || a.id || '').localeCompare(b.staffId || b.id || '');
      }
      // Default: 'name-asc' (Name A-Z)
      const nameA = `${a.firstName || ''} ${a.middleName || ''} ${a.lastName || ''}`.trim().toLowerCase();
      const nameB = `${b.firstName || ''} ${b.middleName || ''} ${b.lastName || ''}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [teachers, searchTerm, teacherSortBy, selectedSubjectFilter]);

  // Paginated teachers slice for desktop UI performance with high-performance memoization
  const totalTeachersCount = filteredTeachers.length;
  const totalTeacherPages = useMemo(() => Math.ceil(totalTeachersCount / teacherPageSize), [totalTeachersCount, teacherPageSize]);
  const activeTeacherPage = Math.min(Math.max(1, teacherPage), totalTeacherPages || 1);
  
  const paginatedTeachers = useMemo(() => {
    return filteredTeachers.slice((activeTeacherPage - 1) * teacherPageSize, activeTeacherPage * teacherPageSize);
  }, [filteredTeachers, activeTeacherPage, teacherPageSize]);

  const isAllSelected = paginatedTeachers.length > 0 && paginatedTeachers.every(t => selectedTeacherIds.includes(t.id));
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedTeacherIds(prev => prev.filter(id => !paginatedTeachers.some(t => t.id === id)));
    } else {
      setSelectedTeacherIds(prev => {
        const union = new Set([...prev, ...paginatedTeachers.map(t => t.id)]);
        return Array.from(union);
      });
    }
  };

  const handlePrintBulkQrCodes = () => {
    if (selectedBulkTeachers.length === 0) {
      alert("Please select at least one teacher to generate QR codes.");
      return;
    }
    const printArea = document.getElementById('bulk-teacher-qr-print-area');
    if (!printArea) return;
    
    try {
      window.print();
    } catch (e) {
      console.warn("Direct print restricted inside sandbox iframe:", e);
      triggerToast("Your browser is blocking printing from within the iframe. Please click 'Open in a new tab' at the top right of your workspace to print.", 'error');
    }
  };

  const handleBulkDeleteTeachers = () => {
    if (selectedTeacherIds.length === 0) return;
    
    setConfirmModal({
      isOpen: true,
      title: "CRITICAL: Bulk Delete Selected Teachers?",
      message: `Are you absolutely sure you want to delete the ${selectedTeacherIds.length} selected teacher profiles? This is a system-wide deletion that is completely irreversible.`,
      confirmText: `Delete ${selectedTeacherIds.length} Record${selectedTeacherIds.length > 1 ? 's' : ''}`,
      danger: true,
      onConfirm: () => {
        selectedTeacherIds.forEach(id => {
          DbController.deleteTeacher(id);
        });
        setSelectedTeacherIds([]);
        onRefresh();
        triggerToast(`Successfully bulk-deleted ${selectedTeacherIds.length} teacher records.`, "success");
      }
    });
  };

  const handleExportCSV = () => {
    const headers = [
      'Teacher ID', 'First Name', 'Middle Name', 'Last Name', 'Gender', 'Date of Birth',
      'Place of Birth', 'Subjects/Class Taught', 'Professional Qualifications',
      'Highest Academic Qualifications', 'Rank', 'Date of First Appointment',
      'Date of Posting to Current Station', 'Staff ID', 'TIN Number', 'NTC Number', 'SSNIT Number',
      'District', 'Circuit', 'Created At'
    ];
    
    const csvRows = [headers.join(',')];
    
    for (const t of filteredTeachers) {
      const values = [
        t.id,
        t.firstName,
        t.middleName || '',
        t.lastName,
        t.gender,
        t.dateOfBirth,
        t.placeOfBirth,
        t.subjectsTaught,
        t.professionalQualifications,
        t.highestAcademicQualifications,
        t.rank,
        t.dateOfFirstAppointment,
        t.dateOfPostingToCurrentStation,
        t.staffId,
        t.tinNumber || '',
        t.ntcNumber,
        t.ssnitNumber,
        t.district,
        t.circuit,
        t.createdAt
      ].map(val => {
        const escaped = ('' + (val || '')).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }
    
    const blob = new Blob([csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Staff_Database_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    try {
      const dataStr = DbController.exportAllData();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const formatedDate = new Date().toISOString().split('T')[0];
      const exportFileDefaultName = formatIdentifiableFilename({
        docType: 'School System Backup',
        date: formatedDate,
        extension: 'json'
      });
      
      const linkElement = document.createElement('a');
      linkElement.href = url;
      linkElement.download = exportFileDefaultName;
      document.body.appendChild(linkElement);
      linkElement.click();
      document.body.removeChild(linkElement);
      URL.revokeObjectURL(url);
      
      setShowJsonSuccess(true);
      setTimeout(() => setShowJsonSuccess(false), 2500);
      triggerToast("Full database JSON snapshot exported successfully.", "success");
    } catch (e: any) {
      triggerToast("Failed to export JSON: " + e.message, "error");
    }
  };

  const handleOpenAdd = () => {
    const currentUser = DbController.getCurrentUser();
    const activeCode = schoolInfo.schoolCode || schoolInfo.schoolId || currentUser?.schoolId || DbController.resolveActiveSchoolId();
    setFormState({ 
      ...INITIAL_FORM, 
      id: 'T' + Math.floor(1000 + Math.random() * 9000),
      schoolId: activeCode,
      schoolCode: activeCode
    });
    setIsEditing(false);
    setShowFormModal(true);
  };

  const handleOpenEdit = (teacher: Teacher) => {
    // Robust parsing for legacy records and multi-assignment support
    const parsedClasses = Array.isArray(teacher.assignedClasses) 
      ? teacher.assignedClasses 
      : (teacher.assignedClass && teacher.assignedClass !== 'None' ? [teacher.assignedClass] as ClassType[] : []);

    const parsedSubjects = Array.isArray(teacher.assignedSubjects)
      ? teacher.assignedSubjects
      : (typeof teacher.subjectsTaught === 'string'
        ? teacher.subjectsTaught.split(/[,/|;]+/).map(s => s.trim() as SubjectType).filter(s => DbController.getSubjects().includes(s))
        : []);
    
    setFormState({ 
      ...INITIAL_FORM,
      ...teacher, 
      assignedClasses: parsedClasses,
      assignedSubjects: parsedSubjects,
      permissions: {
        ...INITIAL_FORM.permissions,
        ...(teacher.permissions || {})
      }
    });
    setIsEditing(true);
    setShowFormModal(true);
  };

  const handleDelete = (teacherId: string) => {
    setTeacherToDelete(teacherId);
    setShowConfirmModal(true);
  };

  const confirmDelete = () => {
    if (teacherToDelete) {
      DbController.deleteTeacher(teacherToDelete);
      onRefresh();
      setShowConfirmModal(false);
      setTeacherToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowConfirmModal(false);
    setTeacherToDelete(null);
  };

  const handleClearInputs = () => {
    setFormState({ ...INITIAL_FORM });
    alert("Teacher Profile input form fields cleared.");
  };

  const handleDeleteActiveSelection = () => {
    if (formState.id) {
      setConfirmModal({
        isOpen: true,
        title: "Delete Teacher Profile?",
        message: `Are you sure you want to delete the active selected teacher "${formState.firstName} ${formState.lastName}"? This will remove all their profile data and associated records from the system.`,
        confirmText: "Delete Teacher",
        danger: true,
        onConfirm: () => {
          DbController.deleteTeacher(formState.id!);
          setFormState({ ...INITIAL_FORM });
          setIsEditing(false);
          setShowFormModal(false);
          onRefresh();
          triggerToast('Teacher deleted successfully.', 'success');
        }
      });
    } else if (teachers.length > 0) {
      const first = teachers[0];
      setConfirmModal({
        isOpen: true,
        title: "Delete First Teacher?",
        message: `No active form selection loaded. Do you want to delete the first teacher in the list (${first.firstName} ${first.lastName})?`,
        confirmText: "Delete First",
        danger: true,
        onConfirm: () => {
          DbController.deleteTeacher(first.id);
          onRefresh();
          triggerToast('Teacher deleted successfully.', 'success');
        }
      });
    } else {
      triggerToast("No teachers exist to delete.", "error");
    }
  };

  const handleDeleteAllTeachers = () => {
    setConfirmModal({
      isOpen: true,
      title: "CRITICAL: Delete All Teachers?",
      message: "CRITICAL WARNING: Are you sure you want to delete ALL teacher records? This action is irreversible and will purge the entire faculty database. Please authorize carefully.",
      confirmText: "Purge All Teachers",
      danger: true,
      onConfirm: () => {
        DbController.clearAllTeachers();
        onRefresh();
        triggerToast("Successfully purged all teacher records.", "success");
      }
    });
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const compressed = await compressImage(base64);
        setFormState(prev => ({ ...prev, photoUrl: compressed }));
      } catch (err) {
        console.error("Image compression error:", err);
        setFormState(prev => ({ ...prev, photoUrl: base64 }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUrlImage = () => {
    setTempImageUrl(formState.photoUrl || '');
    setShowImageLinkModal(true);
  };

  const suggestedClasses = useMemo(() => {
    const subs = formState.assignedSubjects || [];
    const specialization = formState.subjectSpecialization || '';
    
    if (subs.length === 0 && !specialization) return [];
    
    const suggestions = new Set<ClassType>();
    
    // Logic for suggesting classes based on subjects (specializations)
    const jhsSubjects = ['Integrated Science', 'Social Studies', 'Computing', 'Career Technology', 'Creative Arts And Design'];
    const primarySubjects = ['Our World Our People', 'History', 'Literacy', 'Numeracy', 'Writing', 'Drawing', 'Colouring', 'Environmental Studies'];
    
    // Combine assigned subjects and specialization keywords for broader matching
    const allInterestKeys = [...subs.map(s => String(s).toLowerCase())];
    if (specialization) {
      specialization.split(/[,/|;]+/).forEach(s => {
        const trimmed = s.trim().toLowerCase();
        if (trimmed) allInterestKeys.push(trimmed);
      });
    }

    if (allInterestKeys.some(key => jhsSubjects.some(js => js.toLowerCase().includes(key) || key.includes(js.toLowerCase())))) {
      ['Basic 7', 'Basic 8', 'Basic 9'].forEach(c => suggestions.add(c as ClassType));
    }
    
    if (allInterestKeys.some(key => primarySubjects.some(ps => ps.toLowerCase().includes(key) || key.includes(ps.toLowerCase())))) {
      ['Basic 1', 'Basic 2', 'Basic 3', 'Basic 4', 'Basic 5', 'Basic 6'].forEach(c => suggestions.add(c as ClassType));
    }

    // Return suggestions that aren't already selected
    return Array.from(suggestions).filter(c => !(formState.assignedClasses || []).includes(c));
  }, [formState.assignedSubjects, formState.assignedClasses, formState.subjectSpecialization]);

  const handleToggleClass = (cls: ClassType) => {
    if (isHeadteacherLoggedIn && isTargetNotClassTeacher) {
      alert(`Headteachers can only assign classes to Class Teachers. This user is registered as a ${targetUserRole}.`);
      return;
    }
    const current = formState.assignedClasses || [];
    const updated = current.includes(cls)
      ? current.filter(c => c !== cls)
      : [...current, cls];
    
    setFormState(prev => {
      let primary = prev.assignedClass;
      if (primary && primary !== 'None' && !updated.includes(primary as ClassType)) {
        primary = updated.length > 0 ? updated[0] : 'None';
      } else if (!primary || primary === 'None') {
        primary = updated.length > 0 ? updated[0] : 'None';
      }
      return { ...prev, assignedClasses: updated, assignedClass: primary };
    });
  };

  const handleToggleSubject = (sub: SubjectType) => {
    const current = formState.assignedSubjects || [];
    const updated = current.includes(sub)
      ? current.filter(s => s !== sub)
      : [...current, sub];
    
    setFormState(prev => ({
      ...prev,
      assignedSubjects: updated,
      subjectsTaught: updated.join(', ')
    }));
  };

  const handleApplySuggestions = () => {
    if (suggestedClasses.length === 0) return;
    if (isHeadteacherLoggedIn && isTargetNotClassTeacher) {
      alert(`Headteachers can only assign classes to Class Teachers. This user is registered as a ${targetUserRole}.`);
      return;
    }
    
    const current = formState.assignedClasses || [];
    const updated = [...new Set([...current, ...suggestedClasses])];
    
    setFormState(prev => {
      let primary = prev.assignedClass;
      if (!primary || primary === 'None') {
        primary = updated[0];
      }
      return { ...prev, assignedClasses: updated, assignedClass: primary };
    });
    
    triggerToast(`Added ${suggestedClasses.length} suggested classes based on subjects`, "success");
  };

  const handleSaveSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formState.firstName || !formState.lastName || !formState.rank) {
      alert("Please populate all required fields (*)");
      return;
    }

    // Check if current user is Headteacher trying to edit/assign classes to non-Class Teachers
    if (isHeadteacherLoggedIn) {
      if (isTargetNotClassTeacher) {
        const finalAssignedClasses = formState.assignedClasses || [];
        const hasClasses = finalAssignedClasses.length > 0 || (formState.assignedClass && formState.assignedClass !== 'None');
        if (hasClasses) {
          alert(`Headteachers can only assign classes to Class Teachers. This user is registered as a ${targetUserRole}.`);
          return;
        }
      }
    }

    const finalAssignedClasses = formState.assignedClasses || [];
    const finalAssignedSubjects = formState.assignedSubjects || [];
    
    // Auto-sync legacy fields for backward-compatibility with rest of system
    const finalAssignedClass = formState.assignedClass && formState.assignedClass !== 'None'
      ? (formState.assignedClass as ClassType)
      : (finalAssignedClasses.length > 0 ? finalAssignedClasses[0] : 'None');

    const finalSubjectsTaught = finalAssignedSubjects.length > 0 
      ? finalAssignedSubjects.join(', ') 
      : (formState.subjectsTaught || '');

    const payload: Teacher = {
      id: formState.id || 'T' + Math.floor(1000 + Math.random() * 9000),
      firstName: formState.firstName,
      middleName: formState.middleName || '',
      lastName: formState.lastName,
      gender: formState.gender as 'Male' | 'Female',
      dateOfBirth: formState.dateOfBirth || '',
      placeOfBirth: formState.placeOfBirth || '',
      subjectsTaught: finalSubjectsTaught,
      professionalQualifications: formState.professionalQualifications || '',
      highestAcademicQualifications: formState.highestAcademicQualifications || '',
      rank: formState.rank as TeacherRank,
      dateOfFirstAppointment: formState.dateOfFirstAppointment || '',
      dateOfPostingToCurrentStation: formState.dateOfPostingToCurrentStation || '',
      staffId: formState.staffId,
      tinNumber: formState.tinNumber || '',
      ntcNumber: formState.ntcNumber || '',
      ssnitNumber: formState.ssnitNumber || '',
      schoolId: formState.schoolCode || formState.schoolId || schoolInfo.schoolCode || schoolInfo.schoolId || DbController.resolveActiveSchoolId(),
      schoolCode: formState.schoolCode || formState.schoolId || schoolInfo.schoolCode || schoolInfo.schoolId || DbController.resolveActiveSchoolId(),
      ownerId: schoolInfo.ownerId || schoolInfo.userId || DbController.getCurrentUser()?.uid,
      district: formState.district || '',
      circuit: formState.circuit || '',
      photoUrl: formState.photoUrl || '',
      email: formState.email || '',
      assignedClass: finalAssignedClass,
      assignedClasses: finalAssignedClasses,
      assignedSubjects: finalAssignedSubjects,
      permissions: {
        canAccessStudents: formState.permissions?.canAccessStudents !== false,
        canAccessAttendance: formState.permissions?.canAccessAttendance !== false,
        canAccessAssessments: formState.permissions?.canAccessAssessments !== false,
        canAccessSystemControl: formState.permissions?.canAccessSystemControl !== false,
        canEditStudents: formState.permissions?.canEditStudents !== false,
        canApproveAttendance: formState.permissions?.canApproveAttendance !== false,
        canEditGrades: formState.permissions?.canEditGrades !== false,
        canExportReports: formState.permissions?.canExportReports !== false
      },
      createdAt: formState.createdAt || new Date().toISOString()
    };

    // Validate that teacher email does not conflict with Headteacher
    const teacherEmail = (payload.email || '').toLowerCase().trim();
    if (teacherEmail && !teacherEmail.endsWith('@school.internal')) {
      const currentHeadEmail = (schoolInfo.email || '').toLowerCase().trim();
      const currentHeadUser = DbController.getCurrentUser();
      const isCurrentUserHead = currentHeadUser && (currentHeadUser.role === 'Headteacher' || currentHeadUser.role === 'Admin');
      const currentUserEmail = (currentHeadUser?.email || '').toLowerCase().trim();
      const registeredUsers = DbController.getRegisteredUsers();
      const isHeadteacherEmail = (currentHeadEmail && currentHeadEmail === teacherEmail) ||
        (isCurrentUserHead && currentUserEmail === teacherEmail) ||
        registeredUsers.some(u => (u.role === 'Headteacher' || u.role === 'Admin') && u.email?.toLowerCase().trim() === teacherEmail);

      if (isHeadteacherEmail) {
        triggerToast(`Cannot assign this email: The email '${payload.email}' is already registered as a Headteacher. One email cannot be used as Headteacher and assigned as a teacher.`, "error");
        return;
      }
    }

    const payloadFullName = DbController.formatTeacherFullName(payload);
    try {
      // Save immediately as requested
      DbController.saveTeacher(payload);
      DbController.writeActivityLog(
        isEditing ? 'Faculty Record Updated' : 'Faculty Member Enrolled',
        `${isEditing ? 'Updated' : 'Enrolled'} faculty member ${payloadFullName} (Rank: ${payload.rank || 'Teacher'}, Staff ID: ${payload.staffId || payload.id}).`,
        'info'
      );
    } catch (saveErr: any) {
      triggerToast(saveErr?.message || "Failed to save teacher", "error");
      return;
    }
    onRefresh();
    triggerToast(isEditing ? `Successfully updated record for faculty member ${payloadFullName} in Cloud Firestore.` : `Successfully enrolled faculty member ${payloadFullName} in Cloud Firestore.`, "success");
    setPendingTeacher(null);
    setShowFormModal(false);
  };

  const handleConfirmSave = () => {
    // This is now integrated into handleSaveSubmit for immediate action
    if (!pendingTeacher) return;
    const pendingFullName = DbController.formatTeacherFullName(pendingTeacher);
    DbController.saveTeacher(pendingTeacher);
    DbController.writeActivityLog(
      isEditing ? 'Faculty Record Updated' : 'Faculty Member Enrolled',
      `${isEditing ? 'Updated' : 'Enrolled'} faculty member ${pendingFullName} (Rank: ${pendingTeacher.rank || 'Teacher'}, Staff ID: ${pendingTeacher.staffId || pendingTeacher.id}).`,
      'info'
    );
    onRefresh();
    setShowFormModal(false);
    showToast(isEditing ? `Successfully updated record for faculty member ${pendingFullName} in Cloud Firestore.` : `Successfully enrolled faculty member ${pendingFullName} in Cloud Firestore.`, "success");
    setPendingTeacher(null);
  };

  const [printBlocked, setPrintBlocked] = useState(false);
  const [showPdfGuide, setShowPdfGuide] = useState(false);

  const handlePrintRegistry = () => {
    try {
      window.print();
    } catch (e) {
      console.warn("Direct print restricted inside sandbox iframe:", e);
      setPrintBlocked(true);
    }
  };

  const [teachersSubTab, setTeachersSubTab] = useState<'directory' | 'analytics' | 'duty-roster' | 'handbook' | 'leave-requests'>('directory');
  const [handbookVersion, setHandbookVersion] = useState(0);

  const unreadCount = useMemo(() => {
    const user = DbController.getCurrentUser();
    const userId = user?.uid || user?.email || 'anonymous';
    const readMap = DbController.getHandbookReadStatus(userId);

    const docs = DbController.getStaffHandbook();
    return docs.filter(doc => {
      const readTime = readMap[doc.id];
      return !readTime || new Date(doc.lastUpdated).getTime() > new Date(readTime).getTime();
    }).length;
  }, [handbookVersion, teachersSubTab]);

  const staffStats = useMemo(() => {
    const male = teachers.filter(t => t.gender === 'Male').length;
    const female = teachers.filter(t => t.gender === 'Female').length;
    const classTeachers = teachers.filter(t => t.assignedClass && t.assignedClass !== 'None').length;
    const avgLoad = workloadData.length > 0 
      ? (workloadData.reduce((sum, w) => sum + w.totalLoad, 0) / workloadData.length).toFixed(1)
      : '0';

    return { male, female, classTeachers, avgLoad };
  }, [teachers, workloadData]);

  return (
    <div className="space-y-6 fade-in pb-12">
      {/* Strict Access Guard for Teachers */}
      {userRole === 'Teacher' && !isAdmin && !isHeadteacherLoggedIn && (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-200 shadow-sm text-center space-y-4">
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center">
            <ShieldAlert size={32} />
          </div>
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight font-sans">Access Restricted</h3>
          <p className="text-sm text-slate-500 max-w-md font-sans">
            Standard teacher accounts are not permitted to access the central faculty directory or view other teacher profiles for privacy and data protection reasons.
          </p>
          <p className="text-[10px] text-slate-400 font-mono">Your profile details are managed exclusively by the School Administration.</p>
        </div>
      )}

      {/* Main Content (Only visible to Authorized Roles) */}
      {(isAdmin || isHeadteacherLoggedIn) && (
        <>
          {/* Modernized Sub-tab Navigation */}
      <div className="bg-white px-2 py-1.5 rounded-2xl border border-slate-200 shadow-sm no-print flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => setTeachersSubTab('directory')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              teachersSubTab === 'directory' 
                ? 'bg-slate-900 text-white shadow-md' 
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Users size={15} />
            Registry
          </button>
          <button
            onClick={() => setTeachersSubTab('analytics')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              teachersSubTab === 'analytics' 
                ? 'bg-slate-900 text-white shadow-md' 
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <BarChart2 size={15} />
            Performance & Insights
          </button>
        </div>

        <div className="h-6 w-px bg-slate-200 hidden md:block" />

        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => setTeachersSubTab('duty-roster')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              teachersSubTab === 'duty-roster' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <ClipboardList size={15} />
            Duty Roster
          </button>
          <button
            onClick={() => setTeachersSubTab('leave-requests')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              teachersSubTab === 'leave-requests' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <CalendarRange size={15} />
            Leave Tracker
          </button>
          <button
            onClick={() => setTeachersSubTab('handbook')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              teachersSubTab === 'handbook' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2 relative">
              <BookOpen size={15} />
              Staff Handbook
              {unreadCount > 0 && (
                <span className="flex items-center justify-center w-4 h-4 text-[9px] font-extrabold text-white bg-rose-500 rounded-full animate-pulse shadow-sm">
                  {unreadCount}
                </span>
              )}
            </div>
          </button>
        </div>
      </div>

      {teachersSubTab === 'directory' && (
        <>
      {/* Summary Dashboard Ribbons */}
      <div className="flex flex-col lg:flex-row gap-6 no-print">
        <div className="flex-1 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between h-28 relative overflow-hidden group hover:border-indigo-300 transition-colors">
            <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
              <UserCheck size={48} />
            </div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Faculty</div>
            <div className="text-3xl font-black text-slate-900 leading-none">{teachers.length}</div>
            <div className="text-[9px] text-slate-500 font-medium">Registered staff accounts</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between h-28 relative overflow-hidden group hover:border-emerald-300 transition-colors">
            <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
              <LayoutDashboard size={48} />
            </div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Class Leads</div>
            <div className="text-3xl font-black text-emerald-600 leading-none">{staffStats.classTeachers}</div>
            <div className="text-[9px] text-slate-500 font-medium">Active class supervisors</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between h-28 relative overflow-hidden group hover:border-amber-300 transition-colors">
            <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
              <BarChart2 size={48} />
            </div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg Load</div>
            <div className="text-3xl font-black text-amber-600 leading-none">{staffStats.avgLoad}</div>
            <div className="text-[9px] text-slate-500 font-medium">Weighted teaching units</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between h-28 relative overflow-hidden group hover:border-indigo-300 transition-colors">
             <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Gender Split</div>
             <div className="flex-1 flex flex-col justify-center gap-2">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-indigo-600">{staffStats.male}M</span>
                  <span className="text-rose-500">{staffStats.female}F</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  <div 
                    className="h-full bg-indigo-500" 
                    style={{ width: `${(staffStats.male / (teachers.length || 1)) * 100}%` }} 
                  />
                  <div 
                    className="h-full bg-rose-400" 
                    style={{ width: `${(staffStats.female / (teachers.length || 1)) * 100}%` }} 
                  />
                </div>
             </div>
          </div>
        </div>

        {/* Top Performers Quick Insight */}
        {performanceData.length > 0 && (
          <div className="lg:w-80 bg-slate-900 text-white p-5 rounded-2xl shadow-lg border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Elite Educators</div>
              <Award size={14} className="text-amber-400" />
            </div>
            <div className="space-y-3">
              {performanceData.slice(0, 3).map((p, idx) => (
                <div key={p.teacherId} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-indigo-200">
                      #{idx + 1}
                    </div>
                    <div className="truncate text-[12px] font-bold text-slate-200 group-hover:text-white transition-colors">{p.fullName}</div>
                  </div>
                  <div className="text-[11px] font-black text-emerald-400 font-mono">{p.avgScore}%</div>
                </div>
              ))}
            </div>
            <button 
              onClick={() => setTeachersSubTab('analytics')}
              className="mt-4 w-full py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-colors border border-white/10"
            >
              View Full Insights
            </button>
          </div>
        )}
      </div>

      {/* Collapsible Faculty Insights & Performance Hub */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden no-print">
        <button
          type="button"
          onClick={() => setShowAnalyticsHub(!showAnalyticsHub)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50/80 transition-all cursor-pointer border-none bg-transparent"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <BarChart2 size={18} />
            </div>
            <div className="text-left">
              <h4 className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-2">
                Faculty Insights & Performance Hub
                <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded-full font-bold">Analytics</span>
              </h4>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">Interactive performance tracking, class supervision coverage, and teaching load heatmaps</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-indigo-600 font-black tracking-wider uppercase">
              {showAnalyticsHub ? 'Minimize Hub' : 'Expand Hub'}
            </span>
            <ChevronDown size={16} className={`text-slate-400 transition-transform duration-300 ${showAnalyticsHub ? 'rotate-180' : ''}`} />
          </div>
        </button>

        <AnimatePresence>
          {showAnalyticsHub && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="border-t border-slate-100 bg-slate-50/30 overflow-hidden"
            >
              <div className="p-6 space-y-6">
                {/* Metrics ribbon inside hub */}
                <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-3xs">
                    <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Average Teaching Score</div>
                    <div className="text-xl font-black text-slate-900 leading-none mt-1">
                      {(performanceData.reduce((a, b) => a + b.avgScore, 0) / (performanceData.length || 1)).toFixed(1)}%
                    </div>
                    <div className="text-[8px] text-slate-500 font-medium mt-1">Based on {performanceData.reduce((a, b) => a + b.assessmentCount, 0)} assessments</div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-3xs">
                    <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Elite Instructors</div>
                    <div className="text-xl font-black text-emerald-600 leading-none mt-1">
                      {performanceData.filter(p => p.isHighPerformer).length}
                    </div>
                    <div className="text-[8px] text-slate-500 font-medium mt-1">Averages above 75% score</div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-3xs">
                    <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Optimal Staffing</div>
                    <div className="text-xl font-black text-indigo-600 leading-none mt-1">
                      {((workloadData.filter(w => !w.isUnderloaded).length / (teachers.length || 1)) * 100).toFixed(0)}%
                    </div>
                    <div className="text-[8px] text-slate-500 font-medium mt-1">Staff with optimal workload balance</div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-3xs">
                    <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Unassigned Classes</div>
                    <div className="text-xl font-black text-rose-500 leading-none mt-1">
                      {Object.values(classCoverage).filter((c: any) => !c.primary).length}
                    </div>
                    <div className="text-[8px] text-slate-500 font-medium mt-1">Vacant class teacher slots</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Academic Performance AreaChart */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs space-y-4">
                    <div className="flex items-center justify-between">
                      <h5 className="text-[11px] uppercase font-extrabold text-slate-700 flex items-center gap-2">
                        <Award size={14} className="text-amber-500 animate-pulse" /> Academic Performance Benchmark
                      </h5>
                      <span className="text-[9px] text-slate-400 font-mono italic">Sorted by Average GPA</span>
                    </div>
                    <div className="h-[240px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={performanceData.slice(0, 10)}>
                          <defs>
                            <linearGradient id="hubColorAvg" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" fontSize={9} tick={{ fill: '#94a3b8', fontWeight: 'semibold' }} axisLine={false} tickLine={false} />
                          <YAxis domain={[0, 100]} fontSize={9} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                            labelStyle={{ fontWeight: 'bold' }}
                          />
                          <Area type="monotone" dataKey="avgScore" name="Avg Score (%)" stroke="#6366f1" fillOpacity={1} fill="url(#hubColorAvg)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Workload Distribution BarChart */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs space-y-4">
                    <h5 className="text-[11px] uppercase font-extrabold text-slate-700 flex items-center gap-2">
                      <BarChart2 size={14} className="text-indigo-500" /> Instructional Workload Index
                    </h5>
                    <div className="h-[240px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={workloadData.slice(0, 10)}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" fontSize={9} tick={{ fill: '#94a3b8', fontWeight: 'semibold' }} axisLine={false} tickLine={false} />
                          <YAxis fontSize={9} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                          <Bar dataKey="totalLoad" name="Weighted Load" fill="#4f46e5" radius={[4, 4, 0, 0]}>
                            {workloadData.slice(0, 10).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.isOverloaded ? '#ef4444' : entry.isUnderloaded ? '#f59e0b' : '#6366f1'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Rank Seniority BarChart */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs space-y-4">
                     <h5 className="text-[11px] uppercase font-extrabold text-slate-700 flex items-center gap-2">
                       <Briefcase size={14} className="text-slate-400" /> Seniority & Distribution
                     </h5>
                     <div className="h-[200px]">
                       {(() => {
                         const rankCounts: Record<string, number> = {};
                         teachers.forEach(t => { rankCounts[t.rank] = (rankCounts[t.rank] || 0) + 1; });
                         const rankData = Object.entries(rankCounts).map(([name, value]) => ({ name, value }));
                         return (
                           <ResponsiveContainer width="100%" height="100%">
                             <BarChart data={rankData} layout="vertical" margin={{ left: 10 }}>
                               <XAxis type="number" hide />
                               <YAxis dataKey="name" type="category" fontSize={8} width={75} axisLine={false} tickLine={false} />
                               <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none' }} />
                               <Bar dataKey="value" name="Count" fill="#818cf8" radius={[0, 4, 4, 0]} />
                             </BarChart>
                           </ResponsiveContainer>
                         );
                       })()}
                     </div>
                  </div>

                  {/* Supervision Heatmap */}
                  <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs">
                    <h5 className="text-[11px] uppercase font-extrabold text-slate-700 mb-4 flex items-center gap-2">
                      <ShieldAlert size={14} className="text-teal-600" /> Class Supervision Coverage Heatmap
                    </h5>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {CLASSES.map(cls => {
                        const coverage = classCoverage[cls];
                        const isUnassigned = !coverage?.primary;
                        return (
                          <div key={cls} className={`p-2 rounded-xl border transition ${isUnassigned ? 'bg-rose-50/30 border-rose-100' : 'bg-slate-50/40 border-slate-100'}`}>
                            <div className="flex justify-between items-start mb-0.5">
                              <div className="text-[9px] font-black text-slate-800">{cls}</div>
                              {isUnassigned ? <AlertCircle size={10} className="text-rose-500" /> : <Check size={10} className="text-emerald-500" />}
                            </div>
                            <div className="text-[8px] text-slate-500 font-bold truncate leading-none">
                              {isUnassigned ? <span className="text-rose-600">VACANT</span> : coverage.primary}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm no-print">
        <div className="relative w-full md:w-auto flex-grow max-w-md">
          <Search className="absolute left-2.5 top-2.5 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search teacher by name or staff ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-8 pr-10 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
          />
          <button
            type="button"
            onClick={toggleListening}
            className={`absolute right-2 top-1.5 p-1 rounded-md transition-all ${
              isListening 
                ? 'text-rose-500 bg-rose-50 animate-pulse hover:bg-rose-100' 
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
            title={isListening ? "Stop listening" : "Start voice-to-text dictation"}
          >
            <Mic size={14} className={isListening ? "animate-bounce" : ""} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
          <select
            value={teacherSortBy}
            onChange={(e) => setTeacherSortBy(e.target.value as any)}
            className="text-xs px-2.5 py-2 border border-slate-200 rounded-lg bg-white font-medium text-slate-700 cursor-pointer"
            title="Sort teachers list table"
          >
            <option value="name-asc">Sort: Name (A-Z)</option>
            <option value="name-desc">Sort: Name (Z-A)</option>
            <option value="id-asc">Sort: Staff ID</option>
          </select>

          <select
            value={selectedSubjectFilter}
            onChange={(e) => setSelectedSubjectFilter(e.target.value)}
            className="text-xs px-2.5 py-2 border border-slate-200 rounded-lg bg-white font-medium text-slate-700 cursor-pointer"
            title="Filter teachers by assigned subject"
          >
            <option value="All">All Subjects</option>
            {DbController.getSubjects().map(subj => (
              <option key={subj} value={subj}>{subj}</option>
            ))}
          </select>

          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setDirectoryView('grid')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                directoryView === 'grid'
                  ? 'bg-white text-slate-850 shadow-2xs border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-850'
              }`}
            >
              <Users size={12} /> Cards View
            </button>
            <button
              type="button"
              onClick={() => setDirectoryView('table')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                directoryView === 'table'
                  ? 'bg-white text-slate-850 shadow-2xs border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-850'
              }`}
            >
              <FileSpreadsheet size={12} /> Table View
            </button>
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 border border-emerald-600 text-white hover:bg-emerald-700 active:translate-y-0.5 transition text-xs font-semibold rounded-lg cursor-pointer shadow-xs"
            title="Export filtered/all records to a CSV spreadsheet"
          >
            <FileSpreadsheet size={15} />
            <span className="hidden sm:inline">Export to CSV</span>
            <span className="sm:hidden">Export</span>
          </button>
          {(isAdmin || isHeadteacherLoggedIn) && (
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 border border-blue-600 text-white hover:bg-blue-700 active:translate-y-0.5 transition text-xs font-semibold rounded-lg cursor-pointer shadow-xs"
              title="Import teacher records from a formatted CSV file"
            >
              <Upload size={15} />
              <span className="hidden sm:inline">Bulk Import CSV</span>
              <span className="sm:hidden">Import</span>
            </button>
          )}
          <button
            onClick={() => setIsBatchCameraOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 border border-indigo-600 text-white hover:bg-indigo-700 active:translate-y-0.5 transition text-xs font-semibold rounded-lg cursor-pointer shadow-xs"
            title="Open batch camera capture station to snap and assign passport photos quickly"
          >
            <Camera size={15} />
            <span className="hidden sm:inline">Batch Camera</span>
            <span className="sm:hidden">Camera</span>
          </button>
          <button
            onClick={() => setShowPdfGuide(!showPdfGuide)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-900 text-white hover:bg-slate-800 active:translate-y-0.5 transition text-xs font-semibold rounded-lg cursor-pointer"
          >
            <Eye size={15} />
            <span className="hidden sm:inline">Toggle Preview Mode</span>
            <span className="sm:hidden">Preview</span>
          </button>
          {(isAdmin || isHeadteacherLoggedIn) && (
            <button
              onClick={handleOpenAdd}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer active:translate-y-0.5 transition ${theme.btnColors}`}
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Add Teacher Record</span>
              <span className="sm:hidden">Add Staff</span>
            </button>
          )}
        </div>
      </div>

      {/* MODERN FLOATING SELECTION BAR */}
      <AnimatePresence>
        {selectedTeacherIds.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 z-[60] w-[calc(100vw-1.5rem)] max-w-2xl no-print"
          >
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex flex-col xs:flex-row items-center justify-between gap-3 backdrop-blur-md">
              <div className="flex items-center justify-between xs:justify-start w-full xs:w-auto gap-3 pl-2">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Teachers Selected</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-white font-mono">{selectedTeacherIds.length}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedTeacherIds(filteredTeachers.map(t => t.id))}
                      className={`text-[9px] font-bold uppercase tracking-tighter px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition cursor-pointer ${selectedTeacherIds.length === filteredTeachers.length ? 'hidden' : ''}`}
                    >
                      All {filteredTeachers.length}
                    </button>
                  </div>
                </div>
                
                <button
                  onClick={() => setSelectedTeacherIds([])}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition cursor-pointer xs:hidden"
                  title="Clear Selection"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex items-center justify-end w-full xs:w-auto gap-2">
                <div className="h-8 w-px bg-slate-800 mx-1 hidden xs:block"></div>
                
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setSelectedBulkTeachers([...selectedTeacherIds]);
                      setBulkQrFormat('id_card');
                      setShowBulkQrModal(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold px-2.5 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-emerald-900/20 active:scale-95"
                  >
                    <IdCard size={14} />
                    <span className="hidden sm:inline">ID Cards</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedBulkTeachers([...selectedTeacherIds]);
                      setBulkQrFormat('qr_only');
                      setShowBulkQrModal(true);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold px-2.5 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-indigo-900/20 active:scale-95"
                  >
                    <QrCode size={14} />
                    <span className="hidden sm:inline">QR Codes</span>
                  </button>

                  <button
                    onClick={handleBulkDeleteTeachers}
                    className="bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold px-2.5 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-rose-900/20 active:scale-95"
                  >
                    <Trash2 size={14} />
                    <span className="hidden sm:inline">Delete</span>
                  </button>

                  <div className="h-8 w-px bg-slate-800 mx-1 hidden xs:block"></div>

                  <button
                    onClick={() => setSelectedTeacherIds([])}
                    className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition cursor-pointer hidden xs:block"
                    title="Clear Selection"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {(isAdmin || isHeadteacherLoggedIn) && paginatedTeachers.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 no-print">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="bulk-select-teachers-checkbox"
              checked={isAllSelected}
              onChange={toggleSelectAll}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
            />
            <label htmlFor="bulk-select-teachers-checkbox" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
              Select All on Current Page ({paginatedTeachers.length})
            </label>
            {selectedTeacherIds.length > 0 && (
              <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-150 px-2 py-0.5 rounded-full font-bold font-mono">
                {selectedTeacherIds.length} Selected
              </span>
            )}
          </div>
        </div>
      )}

      {/* Grid or Table container of teacher profiles */}
      <div className={`${
        directoryView === 'table' ? 'block' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
      } no-print`}>
        {paginatedTeachers.length === 0 ? (
          <div className="col-span-full bg-slate-50 border-2 border-dashed border-slate-200 p-12 text-center rounded-xl">
            <Briefcase size={36} className="text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-slate-700">No Teacher Profiles Registered</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Create records of your academic faculty to manage class teachers, assign grades, and populate official report cards.</p>
            {(isAdmin || isHeadteacherLoggedIn) && (
              <button
                onClick={handleOpenAdd}
                className={`mt-4 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${theme.btnColors}`}
              >
                <Plus size={14} /> Add First Teacher
              </button>
            )}
          </div>
        ) : directoryView === 'table' ? (
          <div className="col-span-full bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-x-auto no-print">
            {/* Mobile Swipe Guidance Indicator */}
            <div className="md:hidden flex items-center justify-center gap-1.5 text-center text-[10px] text-slate-400 font-mono py-2 border-b border-slate-100 bg-slate-50/50">
              <span>← Swipe horizontally to see full column details →</span>
            </div>
            <table className="w-full text-left border-collapse text-xs font-sans min-w-[1000px]">
              <thead className="bg-slate-50/75 border-b border-slate-200">
                <tr className="text-slate-500 font-mono text-[10px] uppercase tracking-wider">
                  {(isAdmin || isHeadteacherLoggedIn) && (
                    <th className="py-4 px-5 w-12 text-center select-none">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        title="Select / deselect all current teachers"
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer transition"
                      />
                    </th>
                  )}
                  <th className="py-4 px-5 font-bold">
                    <span>Staff ID / TIN</span>
                  </th>
                  <th className="py-4 px-5 font-bold">Faculty Member</th>
                  <th className="py-4 px-5 font-bold">Rank & Performance</th>
                  <th className="py-4 px-5 font-bold">Status</th>
                  <th className="py-4 px-5 font-bold">Gender</th>
                  <th className="py-4 px-5 font-bold">Contact & Login</th>
                  <th className="py-4 px-5 font-bold text-right pr-8">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedTeachers.map((tea, idx) => {
                  const isSelected = selectedTeacherIds.includes(tea.id);
                  return (
                    <tr 
                      key={tea.id} 
                      className={`hover:bg-slate-50/50 transition duration-150 ${
                        isSelected ? 'bg-indigo-50/15' : ''
                      }`}
                    >
                      {(isAdmin || isHeadteacherLoggedIn) && (
                        <td className="py-3 px-5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedTeacherIds(prev =>
                                prev.includes(tea.id)
                                  ? prev.filter(id => id !== tea.id)
                                  : [...prev, tea.id]
                              );
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer transition"
                          />
                        </td>
                      )}
                      <td className="py-3 px-5">
                        <div className="space-y-0.5">
                          <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200/60 rounded font-mono font-bold text-[10px]">
                            {tea.staffId || tea.id}
                          </span>
                          {tea.tinNumber && (
                            <span className="block text-[9px] font-mono text-indigo-600 truncate max-w-[130px]" title={`TIN: ${tea.tinNumber}`}>
                              TIN: {tea.tinNumber}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden shrink-0 shadow-2xs">
                            {tea.photoUrl ? (
                              <img src={tea.photoUrl} alt={tea.firstName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-500">
                                <UserCheck size={18} />
                              </div>
                            )}
                            <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white ${
                              tea.status === 'Active' ? 'bg-emerald-500' :
                              tea.status === 'On Leave' ? 'bg-amber-500' : 'bg-rose-500'
                            }`} />
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 text-[13px] tracking-tight flex items-center gap-1.5 flex-wrap">
                              {tea.title} {tea.firstName} {tea.lastName}
                              {schoolInfo.assignedTeacherId === tea.id && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 text-[8px] font-black uppercase tracking-wider">
                                  <ShieldCheck size={10} className="text-indigo-600 shrink-0" /> Headteacher
                                </span>
                              )}
                            </div>
                            {tea.isClassTeacher ? (
                              <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-bold uppercase tracking-wider">
                                <Award size={10} className="text-emerald-500 shrink-0" /> Class Teacher: {tea.classTeacherOf} {tea.sectionTeacherOf ? `(${tea.sectionTeacherOf})` : ''}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-mono">Faculty Staff</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="font-semibold text-slate-700 text-[12px]">{tea.rank || 'N/A'}</div>
                            {performanceData.find(p => p.teacherId === tea.id) && (
                              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded text-[9px] font-black uppercase">
                                {performanceData.find(p => p.teacherId === tea.id)?.avgScore}%
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                            <GraduationCap size={11} className="text-slate-400 shrink-0" /> {tea.highestAcademicQualifications || 'No Qualification Listed'}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          tea.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          tea.status === 'On Leave' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            tea.status === 'Active' ? 'bg-emerald-500' :
                            tea.status === 'On Leave' ? 'bg-amber-500' : 'bg-rose-500'
                          }`} />
                          {tea.status}
                        </span>
                      </td>
                      <td className="py-3 px-5">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-50 border border-slate-200 text-slate-600">
                          {tea.gender}
                        </span>
                      </td>
                      <td className="py-3 px-5">
                        <div className="space-y-0.5">
                          {tea.phone && <div className="text-slate-700 font-semibold text-[11px]">{tea.phone}</div>}
                          {tea.email && <div className="text-slate-400 font-mono text-[10px] truncate max-w-[180px]" title={tea.email}>{tea.email}</div>}
                        </div>
                      </td>
                      <td className="py-3 px-5 text-right pr-8">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedIdCardTeacher(tea)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-150 rounded-lg transition-all cursor-pointer"
                            title="Print ID Card / Badge"
                          >
                            <IdCard size={15} />
                          </button>
                          {(isAdmin || isHeadteacherLoggedIn) && (
                            <>
                              <button
                                onClick={() => handleOpenEdit(tea)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-150 rounded-lg transition-all cursor-pointer"
                                title="Edit profile"
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                onClick={() => handleDelete(tea.id)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-150 rounded-lg transition-all cursor-pointer"
                                title="Delete profile"
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          paginatedTeachers.map(tea => (
            <motion.div 
              key={tea.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className={`bg-white border rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between ${
                selectedTeacherIds.includes(tea.id) 
                  ? 'border-indigo-400 bg-indigo-50/5' 
                  : 'border-slate-200/85 hover:border-indigo-200'
              }`}
            >
              <div className="relative p-4 sm:p-5 pb-4 border-b border-slate-100/80">
                {/* Visual status top-strip */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${
                  tea.status === 'Active' ? 'bg-emerald-500' :
                  tea.status === 'On Leave' ? 'bg-amber-500' : 'bg-rose-500'
                }`} />

                <div className="flex gap-4">
                  {(isAdmin || isHeadteacherLoggedIn) && (
                    <div className="absolute top-4 right-4 z-10">
                      <input
                        type="checkbox"
                        checked={selectedTeacherIds.includes(tea.id)}
                        onChange={() => {
                          setSelectedTeacherIds(prev =>
                            prev.includes(tea.id)
                              ? prev.filter(id => id !== tea.id)
                              : [...prev, tea.id]
                          );
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer transition shadow-2xs"
                      />
                    </div>
                  )}

                  {/* Profile Image Container */}
                  <div className="relative w-16 h-16 rounded-xl bg-slate-50 border border-slate-200/80 overflow-hidden shrink-0 shadow-2xs flex items-center justify-center">
                    {tea.photoUrl ? (
                      <img src={tea.photoUrl} alt={tea.firstName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-500">
                        <UserCheck size={26} />
                      </div>
                    )}
                    <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white shadow-2xs ${
                      tea.status === 'Active' ? 'bg-emerald-500' :
                      tea.status === 'On Leave' ? 'bg-amber-500' : 'bg-rose-500'
                    }`} />
                  </div>

                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-block px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-slate-100 text-slate-700 border border-slate-200/50">
                        {tea.rank || 'Faculty Staff'}
                      </span>
                      <span className="inline-block px-2 py-0.5 text-[9px] font-bold tracking-wider rounded bg-amber-50 text-amber-800 border border-amber-200/80 font-mono" title="Code linking assigned teacher to their page">
                        School Code ID: {tea.schoolCode || tea.schoolId || schoolInfo.schoolCode || schoolInfo.schoolId || DbController.resolveActiveSchoolId()}
                      </span>
                      {performanceData.find(p => p.teacherId === tea.id) && (
                        <span className={`inline-block px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded border ${
                          (performanceData.find(p => p.teacherId === tea.id)?.avgScore ?? 0) >= 75 
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                            : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                        }`}>
                          {performanceData.find(p => p.teacherId === tea.id)?.avgScore}% Avg
                        </span>
                      )}
                    </div>
                    <h4 className="text-[14px] font-bold text-slate-800 leading-tight tracking-tight truncate mt-1 flex items-center gap-1 flex-wrap">
                      {tea.title} {tea.firstName} {tea.lastName}
                      {schoolInfo.assignedTeacherId === tea.id && (
                        <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-indigo-100 text-indigo-800 border border-indigo-200 text-[8px] font-black uppercase tracking-wider">
                          Headteacher
                        </span>
                      )}
                    </h4>
                    <div className="font-mono text-[10px] text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                      <span>
                        Staff ID: <strong className="text-slate-700 font-bold">{tea.staffId || tea.id}</strong>
                      </span>
                      {tea.tinNumber && (
                        <>
                          <span>•</span>
                          <span title={`TIN: ${tea.tinNumber}`}>TIN: <strong className="text-indigo-600 font-semibold">{tea.tinNumber}</strong></span>
                        </>
                      )}
                      <span>•</span>
                      <span className="capitalize">{tea.gender}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 sm:p-5 pt-4 space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-3.5 text-xs">
                  {/* Subjects */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1">
                        <BookOpen size={11} className="text-slate-400 shrink-0" /> Assigned Subjects
                      </div>
                      {(isAdmin || isHeadteacherLoggedIn) && (
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(tea)}
                          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                          title="Reassign or edit subjects"
                        >
                          Reassign
                        </button>
                      )}
                    </div>
                    {tea.assignedSubjects && tea.assignedSubjects.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {tea.assignedSubjects.map(sub => (
                          <span key={sub} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold tracking-wide">
                            <span>{sub}</span>
                            {(isAdmin || isHeadteacherLoggedIn) && (
                              <button
                                type="button"
                                onClick={() => handleRemoveTeacherSubject(tea.id, sub)}
                                className="text-emerald-700 hover:text-rose-600 font-extrabold ml-0.5 cursor-pointer"
                                title={`Remove ${sub}`}
                              >
                                ×
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 italic pl-1 flex items-center justify-between">
                        <span>No subjects assigned</span>
                        {(isAdmin || isHeadteacherLoggedIn) && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(tea)}
                            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                          >
                            Assign Subjects
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Classes */}
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono flex items-center gap-1">
                      <GraduationCap size={11} className="text-slate-400 shrink-0" /> Academic Classes
                    </div>
                    {tea.assignedClasses && tea.assignedClasses.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {tea.assignedClasses.map(cls => {
                          const isPrimary = tea.assignedClass === cls;
                          return (
                            <span
                              key={cls}
                              className={`px-2 py-0.5 rounded border text-[10px] font-bold transition-all ${
                                isPrimary
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-2xs'
                                  : 'bg-slate-50 text-slate-600 border-slate-200'
                              }`}
                              title={isPrimary ? "Primary Class Teacher" : "Assigned Class"}
                            >
                              {cls} {isPrimary && '★'}
                            </span>
                          );
                        })}
                      </div>
                    ) : tea.assignedClass && tea.assignedClass !== 'None' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-[10px] uppercase tracking-wider">
                        Class Teacher: {tea.assignedClass}
                      </span>
                    ) : (
                      <div className="text-[11px] text-slate-500 italic pl-1">No classes assigned</div>
                    )}
                  </div>

                  {/* Two Column Grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-3 border-t border-slate-100 text-[11px]">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-400 block uppercase font-mono tracking-wider">Qualification</span>
                      <span className="font-medium text-slate-700 truncate block" title={tea.highestAcademicQualifications}>
                        {tea.highestAcademicQualifications || 'N/A'}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-400 block uppercase font-mono tracking-wider">Appointment</span>
                      <span className="font-medium text-slate-700 block">
                        {tea.dateOfFirstAppointment || 'N/A'}
                      </span>
                    </div>
                    {tea.email && (
                      <div className="col-span-2 space-y-0.5 pt-1.5 border-t border-dashed border-slate-100">
                        <span className="text-[10px] text-slate-400 block uppercase font-mono tracking-wider">Login / Contact Email</span>
                        <span className="font-mono text-[10.5px] text-slate-600 truncate block" title={tea.email}>
                          {tea.email}
                        </span>
                      </div>
                    )}
                    {tea.phone && (
                      <div className="col-span-2 space-y-0.5">
                        <span className="text-[10px] text-slate-400 block uppercase font-mono tracking-wider">Telephone Line</span>
                        <span className="font-semibold text-slate-700 block">
                          {tea.phone}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Action Bar */}
                <div className="bg-slate-50 -mx-4 -mb-4 px-4 py-3 sm:-mx-5 sm:-mb-5 sm:px-5 sm:py-3.5 border-t border-slate-100/80 mt-5 flex flex-wrap gap-2.5 items-center justify-between text-[10.5px]">
                  <div className="font-mono text-slate-400 font-semibold">NTC: {tea.ntcNumber || 'N/A'}</div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setSelectedIdCardTeacher(tea)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 border border-indigo-150 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-all cursor-pointer font-bold"
                      title="Print Badge/ID Card"
                    >
                      <QrCode size={12} />
                      <span>Badge</span>
                    </button>
                    {(isAdmin || isHeadteacherLoggedIn) && (
                      <>
                        <button
                          onClick={() => handleOpenEdit(tea)}
                          className="p-1.5 bg-white border border-slate-200 hover:bg-slate-100 hover:border-slate-300 rounded-lg text-slate-600 hover:text-slate-800 transition-all cursor-pointer"
                          title="Edit profile"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(tea.id)}
                          className="p-1.5 bg-rose-50 border border-rose-150 hover:bg-rose-100 rounded-lg text-rose-600 hover:text-rose-850 transition-all cursor-pointer"
                          title="Delete profile"
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Teacher pagination controls */}
      {filteredTeachers.length > 0 && (
        <div id="teacher-pagination-bar" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 mt-2 bg-white border border-slate-200 rounded-xl no-print shadow-2xs">
          <div className="text-xs text-slate-500 font-sans">
            Showing <span className="font-semibold text-slate-700">{(activeTeacherPage - 1) * teacherPageSize + 1}</span> to{' '}
            <span className="font-semibold text-slate-700">{Math.min(activeTeacherPage * teacherPageSize, totalTeachersCount)}</span> of{' '}
            <span className="font-semibold text-slate-700">{totalTeachersCount}</span> staff records
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Show</span>
              <select
                value={teacherPageSize}
                onChange={(e) => {
                  setTeacherPageSize(Number(e.target.value));
                  setTeacherPage(1);
                }}
                className="bg-white border border-slate-200 rounded px-1.5 py-1 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 cursor-pointer"
              >
                {[6, 12, 24, 48, 100].map(sz => (
                  <option key={sz} value={sz}>{sz}</option>
                ))}
              </select>
              <span>records</span>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setTeacherPage(1)}
                disabled={activeTeacherPage === 1}
                className="p-1 px-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition text-xs font-semibold cursor-pointer disabled:cursor-not-allowed"
                title="First Page"
              >
                First
              </button>
              <button
                type="button"
                onClick={() => setTeacherPage(p => Math.max(1, p - 1))}
                disabled={activeTeacherPage === 1}
                className="p-1 px-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14} />
                <span>Prev</span>
              </button>
              
              {/* Numeric Page indicators */}
              {(() => {
                const pageRange = [];
                const maxButtons = 5;
                let startPage = Math.max(1, activeTeacherPage - 2);
                let endPage = Math.min(totalTeacherPages, startPage + maxButtons - 1);
                if (endPage - startPage < maxButtons - 1) {
                  startPage = Math.max(1, endPage - maxButtons + 1);
                }
                for (let i = startPage; i <= endPage; i++) {
                  pageRange.push(i);
                }
                return pageRange.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setTeacherPage(p)}
                    className={`w-7 h-7 flex items-center justify-center text-xs font-bold rounded-lg border transition cursor-pointer ${p === activeTeacherPage ? `${theme.primaryBg || 'bg-slate-900'} text-white border-transparent` : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    {p}
                  </button>
                ));
              })()}
              
              <button
                type="button"
                onClick={() => setTeacherPage(p => Math.min(totalTeacherPages, p + 1))}
                disabled={activeTeacherPage === totalTeacherPages}
                className="p-1 px-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                onClick={() => setTeacherPage(totalTeacherPages)}
                disabled={activeTeacherPage === totalTeacherPages}
                className="p-1 px-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition text-xs font-semibold cursor-pointer disabled:cursor-not-allowed"
                title="Last Page"
              >
                Last
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT-ONLY STAFF DIRECTORY REGISTER SHEET */}
      <div className="hidden print:block font-sans max-w-6xl mx-auto p-4 bg-white text-black relative">
        <div className="absolute inset-0 z-0 pointer-events-none" dangerouslySetInnerHTML={{ __html: getWatermarkHtml(schoolInfo.crestUrl) }} />
        
        <div className="text-center pb-6 border-b-2 border-slate-900 mb-6">
          <h1 className="text-2xl font-bold uppercase tracking-wide">
            {schoolInfo.name}
          </h1>
          <p className="text-xs font-mono mt-1 italic">
            Motto: "{schoolInfo.motto}" | Official Staff Directory List
          </p>
          <div className="text-[10px] text-slate-600 font-mono mt-2">
            Generated on: {new Date().toLocaleDateString()} | Active Personnel Registers
          </div>
        </div>

        <div id="teacher-registry-print-area" className="w-full">
        <h3 className="text-lg font-bold uppercase text-center mb-4 tracking-wider">
          Academic Faculty & Administrative Staff Register
        </h3>

        <table className="w-full text-left border-collapse text-[11px] font-sans">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-800">
              <th className="py-2 px-1 border border-slate-300 font-bold">Staff ID</th>
              <th className="py-2 px-1 border border-slate-300 font-bold">Full Name</th>
              <th className="py-2 px-1 border border-slate-300 font-bold">Gender</th>
              <th className="py-2 px-1 border border-slate-300 font-bold font-mono">NTC Registration</th>
              <th className="py-2 px-1 border border-slate-300 font-bold font-mono">SSNIT NO</th>
              <th className="py-2 px-1 border border-slate-300 font-bold">Academic Ranks</th>
              <th className="py-2 px-1 border border-slate-300 font-bold">Assignment Area</th>
              <th className="py-2 px-1 border border-slate-300 font-bold font-sans">Appointment Date</th>
              <th className="py-2 px-1 border border-slate-300 font-bold">District & Circuit</th>
            </tr>
          </thead>
          <tbody>
            {filteredTeachers.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-4 text-slate-500">No active staff profiles are currently saved in this directory registry.</td>
              </tr>
            ) : (
              filteredTeachers.map(tea => (
                <tr key={tea.id} className="border-b border-slate-200">
                  <td className="py-1 px-1 border border-slate-200 font-mono font-semibold">{tea.staffId}</td>
                  <td className="py-1 px-1 border border-slate-200 font-semibold">{tea.firstName} {tea.middleName ? tea.middleName + ' ' : ''}{tea.lastName}</td>
                  <td className="py-1 px-1 border border-slate-200">{tea.gender}</td>
                  <td className="py-1 px-1 border border-slate-200 font-mono">{tea.ntcNumber || 'N/A'}</td>
                  <td className="py-1 px-1 border border-slate-200 font-mono">{tea.ssnitNumber || 'N/A'}</td>
                  <td className="py-1 px-1 border border-slate-200 text-[10px] font-medium">{tea.rank}</td>
                  <td className="py-1 px-1 border border-slate-200">{tea.subjectsTaught}</td>
                  <td className="py-1 px-1 border border-slate-200 font-mono">{tea.dateOfFirstAppointment || 'N/A'}</td>
                  <td className="py-1 px-1 border border-slate-200 text-[10px]">{tea.district} / {tea.circuit}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Aggregate details footer */}
        <div className="mt-8 text-xs font-mono pt-4 border-t border-slate-300 text-center">
          Total Faculty Strength: <strong className="text-slate-900">{filteredTeachers.length} Registered Educators</strong>
        </div>
      </div>
    </div>
    </>
    )}

    {teachersSubTab === 'analytics' && (
        <div className="animate-fade-in space-y-6">
          {/* Analytics Header */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <BarChart2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 leading-tight">Faculty Intelligence Dashboard</h3>
                <p className="text-xs text-slate-500 font-medium tracking-tight uppercase font-mono">Real-time performance metrics, workload distribution & staff insights</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold border border-emerald-100">
                LIVE DATA SYNC
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
             <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Avg Teaching Score</div>
                <div className="text-2xl font-black text-slate-900 leading-none">
                  {(performanceData.reduce((a, b) => a + b.avgScore, 0) / (performanceData.length || 1)).toFixed(1)}%
                </div>
                <div className="mt-2 text-[9px] text-slate-500 font-medium">Based on {performanceData.reduce((a, b) => a + b.assessmentCount, 0)} assessments</div>
             </div>
             <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">High Performers</div>
                <div className="text-2xl font-black text-emerald-600 leading-none">
                  {performanceData.filter(p => p.isHighPerformer).length}
                </div>
                <div className="mt-2 text-[9px] text-slate-500 font-medium">Scoring above 75% average</div>
             </div>
             <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Staff Utilization</div>
                <div className="text-2xl font-black text-indigo-600 leading-none">
                  {((workloadData.filter(w => !w.isUnderloaded).length / teachers.length) * 100).toFixed(0)}%
                </div>
                <div className="mt-2 text-[9px] text-slate-500 font-medium">Percentage of staff with optimal load</div>
             </div>
             <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Coverage Gap</div>
                <div className="text-2xl font-black text-rose-500 leading-none">
                  {Object.values(classCoverage).filter((c: any) => !c.primary).length}
                </div>
                <div className="mt-2 text-[9px] text-slate-500 font-medium">Classes without primary supervisors</div>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Academic Performance Chart */}
            <div className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Award size={16} className="text-amber-500" /> Academic Impact per Faculty
                </h4>
                <div className="text-[9px] text-slate-400 font-mono italic">Sorted by Avg Score</div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performanceData.slice(0, 10)}>
                    <defs>
                      <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" fontSize={9} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} fontSize={9} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                    />
                    <Area type="monotone" dataKey="avgScore" name="Avg Score (%)" stroke="#10b981" fillOpacity={1} fill="url(#colorAvg)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Workload Distribution */}
            <div className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-xs space-y-4">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <BarChart2 size={16} className="text-indigo-500" /> Teaching Load Distribution
              </h4>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workloadData.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" fontSize={9} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis fontSize={9} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="totalLoad" name="Weighted Load" fill="#6366f1" radius={[6, 6, 0, 0]}>
                      {workloadData.slice(0, 10).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.isOverloaded ? '#ef4444' : entry.isUnderloaded ? '#f59e0b' : '#6366f1'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500" /> Overloaded</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500" /> Optimal</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500" /> Underloaded</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Rank Seniority */}
            <div className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-xs space-y-4">
               <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                 <Briefcase size={16} className="text-slate-400" /> Rank Seniority
               </h4>
               <div className="h-[250px]">
                 {(() => {
                   const rankCounts: Record<string, number> = {};
                   teachers.forEach(t => { rankCounts[t.rank] = (rankCounts[t.rank] || 0) + 1; });
                   const rankData = Object.entries(rankCounts).map(([name, value]) => ({ name, value }));
                   return (
                     <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={rankData} layout="vertical" margin={{ left: 20 }}>
                         <XAxis type="number" hide />
                         <YAxis dataKey="name" type="category" fontSize={8} width={80} axisLine={false} tickLine={false} />
                         <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                         <Bar dataKey="value" name="Count" fill="#94a3b8" radius={[0, 4, 4, 0]} />
                       </BarChart>
                     </ResponsiveContainer>
                   );
                 })()}
               </div>
            </div>

            {/* Coverage Detailed Overview */}
            <div className="lg:col-span-2 bg-white p-6 rounded-[24px] border border-slate-200 shadow-xs">
              <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <ShieldAlert size={16} className="text-blue-500" /> Supervision Coverage Heatmap
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {CLASSES.map(cls => {
                  const coverage = classCoverage[cls];
                  const isUnassigned = !coverage?.primary;
                  return (
                    <div key={cls} className={`p-2.5 rounded-xl border transition ${isUnassigned ? 'bg-rose-50/40 border-rose-100 shadow-sm shadow-rose-100/50' : 'bg-white border-slate-100'}`}>
                      <div className="flex justify-between items-start mb-1">
                        <div className="text-[10px] font-black text-slate-900">{cls}</div>
                        {isUnassigned ? <AlertCircle size={10} className="text-rose-500" /> : <Check size={10} className="text-emerald-500" />}
                      </div>
                      <div className="text-[9px] text-slate-500 font-medium truncate">
                        {isUnassigned ? <span className="text-rose-600 font-bold">VACANT</span> : coverage.primary}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {teachersSubTab === 'duty-roster' && (
        <DutyRoster 
          theme={theme} 
          teachers={teachers} 
          onRefresh={onRefresh} 
          isAdminOrHead={isAdmin || isHeadteacherLoggedIn} 
        />
      )}

      {teachersSubTab === 'handbook' && (
        <StaffHandbook 
          theme={theme} 
          userRole={userRole} 
          onReadUpdate={() => setHandbookVersion(v => v + 1)}
        />
      )}

      {teachersSubTab === 'leave-requests' && (
        <LeaveTracker 
          theme={theme} 
          teachers={teachers} 
          onRefresh={onRefresh} 
          isAdminOrHead={isAdmin || isHeadteacherLoggedIn} 
        />
      )}

      {/* RICH EDIT / ADD MODAL PANEL (NO-PRINT) */}
      <AnimatePresence>
        {showBulkQrModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[110] p-4 no-print animate-fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-50 w-full max-w-6xl h-full max-h-[90vh] rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col md:flex-row relative"
            >
              <button
                onClick={() => setShowBulkQrModal(false)}
                className="absolute top-4 right-4 z-50 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-full transition cursor-pointer"
              >
                <X size={20} />
              </button>

              {/* Left Config Panel */}
              <div className="w-full md:w-80 bg-white border-r border-slate-200 p-6 flex flex-col justify-between shrink-0 overflow-y-auto">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight font-sans">
                      Bulk ID Generator
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">
                      Configure and generate batch ID credentials for your staff.
                    </p>
                  </div>

                  {/* Print Parameters */}
                  <div className="space-y-4">
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Print Options</span>
                    
                    {/* Format Selection */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700">Document Format</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setBulkQrFormat('id_card')}
                          className={`py-2 px-3 rounded-xl border text-[10px] font-bold transition flex items-center justify-center gap-2 ${bulkQrFormat === 'id_card' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        >
                          <IdCard size={14} /> ID Cards
                        </button>
                        <button
                          type="button"
                          onClick={() => setBulkQrFormat('qr_only')}
                          className={`py-2 px-3 rounded-xl border text-[10px] font-bold transition flex items-center justify-center gap-2 ${bulkQrFormat === 'qr_only' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        >
                          <QrCode size={14} /> QR Only
                        </button>
                      </div>
                    </div>

                    {/* Grid Columns */}
                    <div className="flex justify-between items-center bg-slate-50/50 p-3 rounded-xl border border-slate-150">
                      <span className="text-xs font-semibold text-slate-700">Cards/Columns per Row</span>
                      <select
                        value={bulkQrCols}
                        onChange={(e) => setBulkQrCols(Number(e.target.value) as 2|3|4)}
                        className="text-xs px-2 py-1 border border-slate-200 rounded-lg bg-white font-bold text-slate-800"
                      >
                        <option value={2}>2 Columns</option>
                        <option value={3}>3 Columns</option>
                        <option value={4}>4 Columns</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-6 border-t border-slate-100 mt-6">
                  <div className="text-center">
                    <span className="text-[10px] font-bold text-indigo-600">
                      {selectedBulkTeachers.length} of {teachers.length} Selected
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handlePrintBulkQrCodes}
                    disabled={selectedBulkTeachers.length === 0}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold font-sans text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                  >
                    <Printer size={16} />
                    Print Selected {bulkQrFormat === 'id_card' ? 'ID Cards' : 'QR Codes'}
                  </button>
                </div>
              </div>

              {/* Right Selection & Preview Layout */}
              <div className="flex-1 p-6 overflow-y-auto flex flex-col justify-between max-h-[90vh]">
                <div className="space-y-6">
                  {/* Select Actions header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Select Profiles ({teachers.length})</h4>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedBulkTeachers(teachers.map(s => s.id))}
                        className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 px-2.5 py-1 rounded-lg border border-indigo-150 transition cursor-pointer bg-white"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedBulkTeachers([])}
                        className="text-[10px] font-black text-slate-500 hover:text-slate-600 hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 transition cursor-pointer bg-white"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  {/* Checklist of teachers */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[220px] overflow-y-auto p-3 border border-slate-200/60 bg-white rounded-2xl shadow-inner">
                    {teachers.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center col-span-full py-6">No matching staff found.</p>
                    ) : (
                      teachers.map(teacher => {
                        const isChecked = selectedBulkTeachers.includes(teacher.id);
                        return (
                          <label 
                            key={teacher.id} 
                            className={`flex items-start gap-2 p-2 rounded-xl border cursor-pointer select-none transition ${isChecked ? 'bg-indigo-50/30 border-indigo-200 ring-1 ring-indigo-200/50' : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50'}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedBulkTeachers(prev => prev.filter(id => id !== teacher.id));
                                } else {
                                  setSelectedBulkTeachers(prev => [...prev, teacher.id]);
                                }
                              }}
                              className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-[10.5px] font-black text-slate-800 leading-tight truncate">{teacher.firstName} {teacher.lastName}</p>
                              <p className="text-[8.5px] font-mono font-medium text-slate-400 truncate mt-0.5">ID: {teacher.staffId}</p>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>

                  {/* Print Preview Canvas */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Live Print Canvas Preview</span>
                      <span className="text-[10px] font-bold text-slate-400 italic">Portrait A4 Orientation Suggested</span>
                    </div>
                    
                    <div className="border border-slate-250 bg-slate-200 rounded-3xl p-6 shadow-inner max-h-[350px] overflow-y-auto">
                      <div 
                        id="bulk-teacher-qr-print-area" 
                        className="grid gap-6 bg-white p-8 rounded-2xl w-full text-slate-900 font-sans print-page"
                        style={{
                          gridTemplateColumns: `repeat(${bulkQrCols}, minmax(0, 1fr))`
                        }}
                      >
                        {teachers.filter(s => selectedBulkTeachers.includes(s.id)).map(teacher => (
                          bulkQrFormat === 'id_card' 
                            ? renderTeacherIdCardContent(teacher, `bulk-id-${teacher.id}`)
                            : renderTeacherQrOnlyContent(teacher, `bulk-qr-${teacher.id}`)
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
        {showFormModal && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowFormModal(false);
            }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto no-print cursor-pointer"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ ease: "easeOut", duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-50/50 rounded-[24px] border border-slate-200/90 max-w-4xl w-full shadow-2xl max-h-[90vh] overflow-hidden flex flex-col cursor-default md:my-8"
            >
            
            <div className="p-6 pb-4 bg-white border-b border-slate-200/80 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-display flex items-center gap-2 leading-none">
                  <GraduationCap className="text-emerald-600" size={20} />
                  {isEditing ? 'Modify Teacher Record Enrolment' : 'New Teacher Academic Registration'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-1">Specify employment bio details, qualifications, and class assignments</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowFormModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs bg-slate-100/50">
              
              {/* Card 1: Personal Identity & Photograph */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden transition-all hover:shadow-md">
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-4 flex items-center justify-between border-b border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
                      <User size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold font-display uppercase tracking-wider text-white">
                          1. Personal Identity & Photograph
                        </h4>
                        <span className="bg-indigo-500/30 text-indigo-200 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border border-indigo-400/30">
                          Bio Particulars
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300/80">Personal bio details, profile photograph, and birth record</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  {/* Photo Upload area */}
                  <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50/80 p-4 rounded-xl border border-slate-200/80">
                    <div className="w-18 h-18 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
                      {formState.photoUrl ? (
                        <img src={formState.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <User size={28} className="text-slate-300" />
                      )}
                    </div>
                    <div className="space-y-1.5 text-center sm:text-left grow">
                      <div className="font-semibold text-slate-800 text-xs">Teacher Profile Photograph</div>
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Upload size={13} /> Select Local Drive
                        </button>
                        <button
                          type="button"
                          onClick={handleUrlImage}
                          className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                        >
                          Use Image Link
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCameraOpen(true)}
                          className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Camera size={13} /> Take Live Photo
                        </button>
                        {formState.photoUrl && (
                          <button
                            type="button"
                            onClick={() => setFormState(prev => ({ ...prev, photoUrl: '' }))}
                            className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        accept="image/*"
                        className="hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        First Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formState.firstName}
                        onChange={(e) => setFormState(prev => ({ ...prev, firstName: e.target.value }))}
                        className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50 hover:bg-white transition"
                        placeholder="e.g. Paul"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Middle Name</label>
                      <input
                        type="text"
                        value={formState.middleName}
                        onChange={(e) => setFormState(prev => ({ ...prev, middleName: e.target.value }))}
                        className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50 hover:bg-white transition"
                        placeholder="Optional"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Last Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formState.lastName}
                        onChange={(e) => setFormState(prev => ({ ...prev, lastName: e.target.value }))}
                        className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50 hover:bg-white transition"
                        placeholder="e.g. Egyirenyi"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Gender <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formState.gender}
                        onChange={(e) => setFormState(prev => ({ ...prev, gender: e.target.value as 'Male' | 'Female' }))}
                        className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 font-medium"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Birth</label>
                      <input
                        type="date"
                        value={formState.dateOfBirth}
                        onChange={(e) => setFormState(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                        className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white focus:outline-none font-mono text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Place of Birth</label>
                      <input
                        type="text"
                        value={formState.placeOfBirth}
                        onChange={(e) => setFormState(prev => ({ ...prev, placeOfBirth: e.target.value }))}
                        className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50/50 hover:bg-white transition"
                        placeholder="e.g. Kumasi"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Administrative Credentials & Identifiers */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden transition-all hover:shadow-md">
                <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 text-white px-6 py-4 flex items-center justify-between border-b border-indigo-700/50">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-indigo-200 shrink-0">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold font-display uppercase tracking-wider text-white">
                          2. Administrative & Employment Credentials
                        </h4>
                        <span className="bg-white/20 text-indigo-100 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border border-white/20">
                          Credentials
                        </span>
                      </div>
                      <p className="text-[11px] text-indigo-200/80">GES Staff ID, TIN Number, NTC License, SSNIT Number, and Rank</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  <div className="p-4 bg-indigo-50/40 rounded-xl border border-indigo-100 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <span className="text-xs font-bold text-indigo-950 font-display">
                        {formIdMode === 'staffId' ? 'Staff ID Number' : 'TIN Number (Taxpayer ID)'}
                      </span>
                      <div className="flex items-center gap-3 bg-white px-3 py-1 rounded-lg border border-indigo-200 w-fit">
                        <label className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer text-slate-700">
                          <input
                            type="radio"
                            name="teacherProfileIdSwitcher"
                            value="staffId"
                            checked={formIdMode === 'staffId'}
                            onChange={() => setFormIdMode('staffId')}
                            className="w-3.5 h-3.5 cursor-pointer accent-indigo-600"
                          />
                          <span>Staff ID</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer text-slate-700">
                          <input
                            type="radio"
                            name="teacherProfileIdSwitcher"
                            value="tinNumber"
                            checked={formIdMode === 'tinNumber'}
                            onChange={() => setFormIdMode('tinNumber')}
                            className="w-3.5 h-3.5 cursor-pointer accent-indigo-600"
                          />
                          <span>TIN Number</span>
                        </label>
                      </div>
                    </div>

                    {formIdMode === 'staffId' ? (
                      <div>
                        <input
                          type="text"
                          value={formState.staffId || ''}
                          onChange={(e) => setFormState(prev => ({ ...prev, staffId: e.target.value }))}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono text-xs"
                          placeholder="e.g. GES-T89045"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">Official Ghana Education Service (GES) or school staff ID.</p>
                      </div>
                    ) : (
                      <div>
                        <input
                          type="text"
                          value={formState.tinNumber || ''}
                          onChange={(e) => setFormState(prev => ({ ...prev, tinNumber: e.target.value }))}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono text-xs"
                          placeholder="e.g. P0001234567 or C0009876543"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">Ghana Revenue Authority (GRA) Taxpayer Identification Number.</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">NTC Number (Licence)</label>
                      <input
                        type="text"
                        value={formState.ntcNumber}
                        onChange={(e) => setFormState(prev => ({ ...prev, ntcNumber: e.target.value }))}
                        className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50/50 hover:bg-white font-mono"
                        placeholder="National Teaching Council No"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">SSNIT Number</label>
                      <input
                        type="text"
                        value={formState.ssnitNumber}
                        onChange={(e) => setFormState(prev => ({ ...prev, ssnitNumber: e.target.value }))}
                        className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50/50 hover:bg-white font-mono"
                        placeholder="Social Security No"
                      />
                    </div>
                  </div>

                  {/* School Code ID: Access & Link Key */}
                  <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200/90 space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <label className="block text-xs font-bold text-amber-950 flex items-center gap-1.5">
                        <Key size={14} className="text-amber-600" />
                        <span>School Code ID (Page Access & Link Parameter)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const activeCode = schoolInfo.schoolCode || schoolInfo.schoolId || DbController.resolveActiveSchoolId();
                          setFormState(prev => ({ ...prev, schoolId: activeCode, schoolCode: activeCode }));
                          triggerToast(`Linked active School Code ID: ${activeCode}`, 'info');
                        }}
                        className="text-[10px] font-bold text-amber-800 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded border border-amber-300 transition cursor-pointer"
                        title="Auto-fill active School Code ID"
                      >
                        Auto-Link School Code
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={formState.schoolCode || formState.schoolId || ''}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase().trim();
                          setFormState(prev => ({ ...prev, schoolId: val, schoolCode: val }));
                        }}
                        className="flex-1 text-xs px-3.5 py-2.5 border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 bg-white font-mono font-bold text-slate-900 tracking-wider shadow-2xs"
                        placeholder="e.g. SCH-XXXXX"
                        required
                      />
                      {(formState.schoolCode || formState.schoolId) && (
                        <button
                          type="button"
                          onClick={() => {
                            const code = formState.schoolCode || formState.schoolId || '';
                            navigator.clipboard.writeText(code);
                            triggerToast(`School Code ID ${code} copied!`, 'success');
                          }}
                          className="px-3 py-2.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1 shrink-0 shadow-2xs"
                          title="Copy School Code ID"
                        >
                          <Copy size={13} />
                          <span>Copy</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[10.5px] text-amber-800 leading-relaxed font-sans">
                      This <strong>School Code ID</strong> is the primary access parameter that links this assigned teacher to their teacher page. All student profiles in assigned classes, class attendance roster entries, and academic assessments will cross-share directly with the Headteacher using this School Code ID parameter.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Professional Rank <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formState.rank}
                        onChange={(e) => setFormState(prev => ({ ...prev, rank: e.target.value as TeacherRank }))}
                        className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 font-medium"
                      >
                        {TEACHER_RANKS.map(rk => (
                          <option key={rk} value={rk}>{rk}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Login Email Address</label>
                      <input
                        type="email"
                        value={formState.email || ''}
                        onChange={(e) => setFormState(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50/50 hover:bg-white transition"
                        placeholder="teacher.email@school.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Subject Specialization</label>
                    <input
                      type="text"
                      value={formState.subjectSpecialization || ''}
                      onChange={(e) => setFormState(prev => ({ ...prev, subjectSpecialization: e.target.value }))}
                      className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-200 focus:outline-none font-semibold bg-amber-50/30"
                      placeholder="e.g. Science, Mathematics"
                    />
                  </div>
                </div>
              </div>

              {/* Card 3: Class & Subject Workload Assignments */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden transition-all hover:shadow-md">
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-4 flex items-center justify-between border-b border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0">
                      <Briefcase size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold font-display uppercase tracking-wider text-white">
                          3. Academic Workload & Subject Assignments
                        </h4>
                        <span className="bg-emerald-500/30 text-emerald-200 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-400/30">
                          Class Workload
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300/80">Classes assigned, subject coverage, and primary class teacher duty</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-4">
                    <div className="flex items-center justify-between gap-4 pb-2 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                          <LayoutDashboard size={18} />
                        </div>
                        <div>
                          <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Teacher Workload Analytics</h5>
                          <p className="text-[10px] text-slate-500 font-medium italic">Monitor class distribution and booking matrix</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowLoadDashboard(!showLoadDashboard)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer ${
                          showLoadDashboard 
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                            : 'bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50'
                        }`}
                      >
                        <BarChart2 size={14} />
                        {showLoadDashboard ? 'Hide Analytics' : 'View Load Dashboard'}
                      </button>
                    </div>

                    <AnimatePresence>
                      {showLoadDashboard && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                              <div className="flex items-center justify-between mb-3">
                                <h6 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Load Distribution</h6>
                              </div>
                              <div className="h-48 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={workloadData.slice(0, 10)}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis dataKey="name" fontSize={9} tickLine={false} axisLine={false} />
                                    <YAxis fontSize={9} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '10px' }} />
                                    <Bar dataKey="totalLoad" radius={[4, 4, 0, 0]}>
                                      {workloadData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.isOverloaded ? '#ef4444' : entry.isUnderloaded ? '#f59e0b' : '#6366f1'} />
                                      ))}
                                    </Bar>
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm overflow-hidden flex flex-col">
                              <div className="flex items-center justify-between mb-3">
                                <h6 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Class Coverage Matrix</h6>
                              </div>
                              <div className="flex-1 overflow-y-auto pr-1 max-h-48 space-y-1.5">
                                {CLASSES.map(cls => {
                                  const cov = classCoverage[cls];
                                  const noPrimary = !cov?.primary;
                                  return (
                                    <div key={cls} className="flex items-center justify-between p-1.5 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                                      <span className="w-12 text-[10px] font-bold text-slate-700">{cls}</span>
                                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${noPrimary ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                        {noPrimary ? 'No Supervisor' : cov.primary?.split(' ')[0]}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Classes Selection */}
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <label className="block text-slate-700 font-bold text-xs uppercase tracking-wider">
                          Assigned Classes
                        </label>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setFormState(prev => ({ ...prev, assignedClasses: [...CLASSES], assignedClass: CLASSES[0] }))}
                            className="px-2 py-1 bg-white border border-slate-200 hover:border-slate-300 rounded font-semibold text-slate-600 transition shadow-2xs cursor-pointer"
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormState(prev => ({ ...prev, assignedClasses: [], assignedClass: 'None' }))}
                            className="px-2 py-1 bg-white border border-slate-200 hover:border-red-200 hover:text-red-600 rounded font-semibold text-slate-600 transition shadow-2xs cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-1.5 mb-3">
                        {CLASSES.map(cls => {
                          const isSelected = (formState.assignedClasses || []).includes(cls);
                          return (
                            <button
                              type="button"
                              key={cls}
                              onClick={() => handleToggleClass(cls)}
                              className={`px-2 py-1.5 text-[10px] font-bold rounded-lg border transition text-center cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                                  : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/30'
                              }`}
                            >
                              {cls}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Subjects Selection */}
                    <div className="pt-3 border-t border-slate-200/60">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <label className="block text-slate-700 font-bold text-xs uppercase tracking-wider">
                          Assigned Subjects
                        </label>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setFormState(prev => {
                              const updated = [...DbController.getSubjects()];
                              return { ...prev, assignedSubjects: updated, subjectsTaught: updated.join(', ') };
                            })}
                            className="px-2 py-1 bg-white border border-slate-200 hover:border-slate-300 rounded font-semibold text-slate-600 transition shadow-2xs cursor-pointer"
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormState(prev => ({ ...prev, assignedSubjects: [], subjectsTaught: '' }))}
                            className="px-2 py-1 bg-white border border-slate-200 hover:border-red-200 hover:text-red-600 rounded font-semibold text-slate-600 transition shadow-2xs cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 border border-slate-200 rounded-xl bg-white shadow-2xs">
                        {DbController.getSubjects().map(sub => {
                          const isSelected = (formState.assignedSubjects || []).includes(sub);
                          return (
                            <button
                              type="button"
                              key={sub}
                              onClick={() => handleToggleSubject(sub)}
                              className={`px-2.5 py-1 text-[10px] font-semibold rounded-full border transition cursor-pointer ${
                                isSelected
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-emerald-600 hover:border-emerald-200'
                              }`}
                            >
                              {sub}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-200/60">
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1 text-xs uppercase tracking-tight">Primary Class Duty</label>
                        <select
                          value={formState.assignedClass || 'None'}
                          onChange={(e) => setFormState(prev => ({ ...prev, assignedClass: e.target.value as ClassType | 'None' }))}
                          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-white text-xs font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition shadow-2xs"
                        >
                          <option value="None">None / Subject Teacher Only</option>
                          {(formState.assignedClasses || []).map(cls => (
                            <option key={cls} value={cls}>{cls} (Class Teacher)</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-700 font-semibold mb-1 text-xs uppercase tracking-tight">Additional Details</label>
                        <input
                          type="text"
                          value={formState.subjectsTaught || ''}
                          onChange={(e) => setFormState(prev => ({ ...prev, subjectsTaught: e.target.value }))}
                          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:outline-none text-xs font-medium bg-white shadow-2xs"
                          placeholder="e.g. Specializes in Literacy development"
                        />
                      </div>
                    </div>

                    {/* Assigned Roles & System Privileges */}
                    <div className="pt-4 border-t border-slate-200/70 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <label className="block text-slate-800 font-bold text-xs uppercase tracking-wider">
                            Assigned Teacher Roles &amp; Workspace Modules
                          </label>
                          <p className="text-[10px] text-slate-500">
                            Select which core modules this Teacher can access after signing in
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setFormState(prev => ({
                              ...prev,
                              permissions: {
                                canAccessStudents: true,
                                canAccessAttendance: true,
                                canAccessAssessments: true,
                                canAccessSystemControl: true,
                                canEditStudents: true,
                                canApproveAttendance: true,
                                canEditGrades: true,
                                canExportReports: true
                              }
                            }))}
                            className="px-2 py-1 bg-white border border-slate-200 hover:border-emerald-300 rounded font-semibold text-emerald-700 transition shadow-2xs cursor-pointer"
                          >
                            Enable All Roles
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                        {[
                          { key: 'canAccessStudents' as const, label: 'Student Profiles', desc: 'View & manage assigned class roster' },
                          { key: 'canAccessAttendance' as const, label: 'Class Attendance Roster', desc: 'Access daily attendance register' },
                          { key: 'canAccessAssessments' as const, label: 'Academic Assessment', desc: 'View & enter terminal assessment' },
                          { key: 'canAccessSystemControl' as const, label: 'System Control', desc: 'Theme, sync & workstation controls' },
                        ].map(roleItem => {
                          const enabled = formState.permissions?.[roleItem.key] !== false;
                          return (
                            <button
                              key={roleItem.key}
                              type="button"
                              onClick={() => setFormState(prev => ({
                                ...prev,
                                permissions: {
                                  ...(prev.permissions || {}),
                                  [roleItem.key]: !enabled
                                }
                              }))}
                              className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-start justify-between gap-2 ${
                                enabled
                                  ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 shadow-2xs'
                                  : 'bg-slate-50 border-slate-200 text-slate-500'
                              }`}
                            >
                              <div className="space-y-0.5">
                                <span className="text-[11px] font-bold block">{roleItem.label}</span>
                                <span className="text-[9px] opacity-80 block leading-snug">{roleItem.desc}</span>
                              </div>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${
                                enabled ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'
                              }`}>
                                {enabled ? 'ON' : 'OFF'}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        {[
                          { key: 'canEditStudents' as const, label: 'Edit Student Profiles' },
                          { key: 'canApproveAttendance' as const, label: 'Mark Attendance' },
                          { key: 'canEditGrades' as const, label: 'Edit Assessment Grades' },
                          { key: 'canExportReports' as const, label: 'Export & Print Reports' },
                        ].map(permItem => {
                          const enabled = formState.permissions?.[permItem.key] !== false;
                          return (
                            <label
                              key={permItem.key}
                              className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-white text-[10.5px] font-semibold text-slate-700 cursor-pointer hover:bg-slate-50"
                            >
                              <input
                                type="checkbox"
                                checked={enabled}
                                onChange={() => setFormState(prev => ({
                                  ...prev,
                                  permissions: {
                                    ...(prev.permissions || {}),
                                    [permItem.key]: !enabled
                                  }
                                }))}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                              <span>{permItem.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 4: Academic Qualifications & Service Dates */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden transition-all hover:shadow-md">
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-4 flex items-center justify-between border-b border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
                      <Award size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold font-display uppercase tracking-wider text-white">
                          4. Academic Qualifications & Service Dates
                        </h4>
                        <span className="bg-amber-500/30 text-amber-200 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border border-amber-400/30">
                          Degrees & Dates
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300/80">Degrees, certifications, appointment date, and station posting dates</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Highest Academic Qualification</label>
                      <select
                        value={formState.highestAcademicQualifications}
                        onChange={(e) => setFormState(prev => ({ ...prev, highestAcademicQualifications: e.target.value }))}
                        className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50/50 hover:bg-white text-slate-800 font-medium"
                      >
                        <option value="">-- Select Academic Qualification --</option>
                        <option value="Not applicable">Not applicable (N/A)</option>
                        <option value="Ph.D. / Doctorate">Ph.D. / Doctorate</option>
                        <option value="Master of Philosophy (M.Phil)">Master of Philosophy (M.Phil)</option>
                        <option value="Master of Education / Arts / Science (M.Ed / M.A / M.Sc)">Master of Education / Arts / Science (M.Ed / M.A / M.Sc)</option>
                        <option value="Bachelor of Education (B.Ed)">Bachelor of Education (B.Ed)</option>
                        <option value="Bachelor of Arts / Science (B.A / B.Sc)">Bachelor of Arts / Science (B.A / B.Sc)</option>
                        <option value="Post Graduate Diploma in Education (PGDE)">Post Graduate Diploma in Education (PGDE)</option>
                        <option value="Diploma in Basic Education (DBE)">Diploma in Basic Education (DBE)</option>
                        <option value="Diploma (Non-Education / Tertiary)">Diploma (Non-Education / Tertiary)</option>
                        <option value="Teacher Cert 'A'">Teacher Cert 'A'</option>
                        <option value="WASSCE / SHS Graduate">WASSCE / SHS Graduate</option>
                        <option value="Other">Other Academic Qualification</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Professional Licensing Qualifications</label>
                      <select
                        value={formState.professionalQualifications}
                        onChange={(e) => setFormState(prev => ({ ...prev, professionalQualifications: e.target.value }))}
                        className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50/50 hover:bg-white text-slate-800 font-medium"
                      >
                        <option value="">-- Select Professional Qualifications --</option>
                        <option value="Not applicable">Not applicable (N/A)</option>
                        <option value="Licensed Teacher (NTC Certified)">Licensed Teacher (NTC Certified)</option>
                        <option value="Professional Teacher (Diploma/Degree in Education)">Professional Teacher (Diploma/Degree in Education)</option>
                        <option value="Provisional Licence Holder">Provisional Licence Holder</option>
                        <option value="Student / Intern License">Student / Intern License</option>
                        <option value="Non-Professional Teacher">Non-Professional Teacher</option>
                        <option value="Other">Other Professional Certificate</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Date of First Appointment</label>
                      <input
                        type="date"
                        value={formState.dateOfFirstAppointment}
                        onChange={(e) => setFormState(prev => ({ ...prev, dateOfFirstAppointment: e.target.value }))}
                        className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white font-mono text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Date Posted to Current Station</label>
                      <input
                        type="date"
                        value={formState.dateOfPostingToCurrentStation}
                        onChange={(e) => setFormState(prev => ({ ...prev, dateOfPostingToCurrentStation: e.target.value }))}
                        className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white font-mono text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Administrative District</label>
                      <input
                        type="text"
                        value={formState.district}
                        onChange={(e) => setFormState(prev => ({ ...prev, district: e.target.value }))}
                        className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50/50 hover:bg-white transition"
                        placeholder="e.g. Kumasi Metropolitan"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Educational Circuit Assigned</label>
                      <input
                        type="text"
                        value={formState.circuit}
                        onChange={(e) => setFormState(prev => ({ ...prev, circuit: e.target.value }))}
                        className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50/50 hover:bg-white transition"
                        placeholder="e.g. Asokonyi Circuit"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 bg-transparent shrink-0">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-5 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition cursor-pointer text-xs bg-white shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-6 py-2.5 bg-[#059669] hover:bg-[#047857] text-white font-bold rounded-xl shadow-xs transition cursor-pointer text-xs active:translate-y-0.5"
                >
                  <Check size={16} /> {isEditing ? 'Save Profile Changes' : 'Save & Enrol Faculty'}
                </button>
              </div>

            </form>

          </motion.div>
        </div>
      )}
    </AnimatePresence>

      {/* SANDBOX PRINT CAPTURE ALERT OVERLAY */}
      {printBlocked && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 no-print">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full text-center space-y-4 text-slate-800">
            <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 mx-auto">
              <Printer size={24} />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-sm font-bold text-slate-950 font-display">Print Dialog Intercepted</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Your browser blocks direct print triggers from inside the preview iframe. To print this roster, please click the <strong className="text-slate-800 font-bold">"Open in a new tab" ↗</strong> button at the top right of the application workspace first.
              </p>
            </div>
            <button
              onClick={() => setPrintBlocked(false)}
              className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer active:translate-y-0.5 transition"
            >
              Recognized, Dismiss
            </button>
          </div>
        </div>
      )}

      {/* COMPREHENSIVE PDF GENERATION / PRINTING MANUAL OVERLAY WITH LIVE INTERACTIVE VISUAL PRINT PREVIEW */}
      <AnimatePresence>
        {showPdfGuide && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowPdfGuide(false);
            }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 no-print overflow-y-auto cursor-pointer"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ ease: "easeOut", duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-100 rounded-[24px] border border-slate-200/50 shadow-2xl max-w-5xl w-full flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200/80 overflow-hidden my-8 max-h-[90vh] cursor-default"
            >
            
            {/* Left: Document Live Preview */}
            <div className="flex-1 p-6 overflow-y-auto bg-slate-700 flex flex-col justify-between items-center space-y-4">
              <div className="text-center space-y-1 select-none">
                <span className="text-amber-400 text-xs font-black tracking-wider uppercase block font-sans">
                  Print Preview & Document Layout Align
                </span>
                <span className="text-white/60 text-[9px] font-sans block max-w-md">
                  Optimize margins, branding, and paper size before submitting to printer
                </span>
              </div>
              
              <div id="teachers-roster-preview-card" className="relative w-full max-w-[650px] min-h-[460px] bg-white p-6 text-black border shadow-2xl text-[8px] space-y-3 font-sans rounded-none overflow-y-auto">
                {/* Transparent School Crest Watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.045] z-0">
                  {schoolInfo.crestUrl ? (
                    <img src={schoolInfo.crestUrl} className="w-[280px] h-[280px] object-contain" alt="Watermark Crest" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-[280px] h-[280px]" dangerouslySetInnerHTML={{ __html: GHANA_CREST_SVG_SIMPLE }} />
                  )}
                </div>

                <div className="relative z-10 text-center pb-3 border-b-2 border-slate-800 mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-stone-900">
                    {schoolInfo.name}
                  </h3>
                  <p className="text-[8px] font-mono mt-0.5 italic text-stone-600">
                    Motto: "{schoolInfo.motto}" | Official Staff Directory List
                  </p>
                  <div className="text-[7px] text-slate-500 font-mono mt-1">
                    Generated on: {new Date().toLocaleDateString()} | Active Personnel Registers
                  </div>
                </div>

                <h4 className="text-[9px] font-bold uppercase text-center mb-2 tracking-wider text-stone-900">
                  Academic Faculty & Administrative Staff Register (Landscape)
                </h4>

                <table className="w-full text-left border-collapse text-[7px] font-sans">
                  <thead>
                    <tr className="bg-stone-100 border-b border-stone-800">
                      <th className="py-1 px-0.5 border border-stone-300 font-bold">Staff ID</th>
                      <th className="py-1 px-0.5 border border-stone-300 font-bold">Full Name</th>
                      <th className="py-1 px-0.5 border border-stone-300 font-bold">Gender</th>
                      <th className="py-1 px-0.5 border border-stone-300 font-bold font-mono">NTC Reg</th>
                      <th className="py-1 px-0.5 border border-stone-300 font-bold font-mono">SSNIT NO</th>
                      <th className="py-1 px-0.5 border border-stone-300 font-bold">Academic Ranks</th>
                      <th className="py-1 px-0.5 border border-stone-300 font-bold">Assignment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTeachers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-2 text-stone-400">No active staff profiles are currently saved.</td>
                      </tr>
                    ) : (
                      filteredTeachers.slice(0, 5).map(tea => (
                        <tr key={tea.id} className="border-b border-stone-200">
                          <td className="py-1 px-0.5 border border-stone-200 font-mono font-semibold">{tea.staffId}</td>
                          <td className="py-1 px-0.5 border border-stone-200 font-semibold">{tea.firstName} {tea.lastName}</td>
                          <td className="py-1 px-0.5 border border-stone-200">{tea.gender}</td>
                          <td className="py-1 px-0.5 border border-stone-200 font-mono">{tea.ntcNumber || 'N/A'}</td>
                          <td className="py-1 px-0.5 border border-stone-200 font-mono">{tea.ssnitNumber || 'N/A'}</td>
                          <td className="py-1 px-0.5 border border-stone-200 text-[6.5px] font-medium">{tea.rank}</td>
                          <td className="py-1 px-0.5 border border-stone-200">{tea.subjectsTaught}</td>
                        </tr>
                      ))
                    )}
                    {filteredTeachers.length > 5 && (
                      <tr>
                        <td colSpan={7} className="text-center py-1 bg-stone-50 text-[7px] text-indigo-600 font-mono italic">
                          ... and {filteredTeachers.length - 5} more staff credentials printed within high-fidelity PDF output stream ...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <div className="mt-4 grid grid-cols-2 gap-2 text-[8px] font-mono pt-2 border-t border-stone-300 text-center text-stone-700">
                  <div>Roster Total Staff: <strong className="text-stone-950">{filteredTeachers.length}</strong></div>
                  <div>NTC Certified: <strong>{filteredTeachers.filter(t => !!t.ntcNumber).length}</strong></div>
                </div>
              </div>
              
              <span className="text-[10px] text-slate-300 font-mono tracking-wide">Standard Landscape A4 Format Draft Miniature</span>
            </div>

            {/* Right: Setup Manual & Control */}
            <div className="w-full md:w-[400px] p-6 bg-white flex flex-col justify-between overflow-y-auto max-h-none md:max-h-[90vh] no-print">
              <div className="space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 flex-shrink-0">
                    <Eye size={22} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-950">Toggle Preview Mode & Print Controller</h4>
                    <p className="text-[10px] text-slate-400">Review staff directory print parameters</p>
                  </div>
                </div>

                <GoogleDriveExportControl 
                  elementId="teachers-roster-preview-card" 
                  defaultFilename="Faculty_Staff_Directory.pdf"
                  isLandscape={true} 
                />

                <div className="p-3 bg-indigo-50 border border-indigo-100/70 rounded-xl space-y-1 text-indigo-950 text-[11px]">
                  <span className="font-bold">🌐 Recommended: Landscape Layout</span>
                  <p className="text-[10px] text-indigo-800/90 leading-relaxed">
                    Faculty files are outputted in landscape grids. Set the print orientation setting to <strong>Landscape</strong> inside the native configuration dialog box.
                  </p>
                </div>

                <div className="space-y-3 text-xs text-slate-700 font-sans">
                  <span className="font-bold text-slate-900 border-b border-slate-100 pb-1 block">How to Export to PDF Checklist:</span>
                  
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <div className="font-bold text-[10px] text-slate-600 bg-slate-100 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">1</div>
                      <p className="text-[11px] leading-relaxed">
                        Click the <strong className="text-indigo-600 font-bold">Trigger Print Engine</strong> button down below to configure layout.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <div className="font-bold text-[10px] text-slate-600 bg-slate-100 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">2</div>
                      <p className="text-[11px] leading-relaxed">
                        Under the <strong>Destination</strong> list selector, switch to <strong className="text-slate-900 font-bold">Save as PDF</strong> as your target.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <div className="font-bold text-[10px] text-slate-600 bg-slate-100 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">3</div>
                      <p className="text-[11px] leading-relaxed">
                        Set orientation layout to <strong className="text-indigo-600 font-bold">Landscape</strong>, paper size to <strong>A4</strong>, tick <strong>Background Graphics</strong>, and disable headers.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-6 border-t border-slate-100 mt-6 font-sans">
                <button
                  type="button"
                  onClick={() => setShowPdfGuide(false)}
                  className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 font-semibold rounded-xl transition cursor-pointer text-[12px] flex-shrink-0"
                >
                  Close Preview
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handlePrintRegistry();
                  }}
                  className="flex-1 px-5 py-2.5 bg-[#059669] hover:bg-[#047857] text-white font-semibold rounded-xl shadow-xs transition cursor-pointer text-[12px] text-center flex items-center justify-center gap-1.5 active:translate-y-0.5"
                >
                  <Printer size={14} /> Trigger Print Engine
                </button>
              </div>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>

      {/* DELETION CONFIRMATION MODAL */}
      <AnimatePresence>
        {showConfirmModal && teacherToDelete && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowConfirmModal(false);
            }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 no-print cursor-pointer"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-slate-900 font-sans cursor-default"
              id="teacher-delete-confirmation-modal"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                {/* Visual warning indicator with pulse effect */}
                <div className="relative w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-600">
                  <span className="absolute inset-0 rounded-full bg-rose-400/20 animate-ping"></span>
                  <ShieldAlert size={32} className="relative z-10" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-base font-black text-slate-950 uppercase tracking-wide">
                    Confirm Permanent Deletion
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    You are about to irreversibly purge the following teacher profile and credentials from the system database:
                  </p>
                </div>

                {/* Identity Card Block */}
                {teachers.find(t => t.id === teacherToDelete) && (
                  <div className="w-full bg-slate-50 p-4 rounded-xl border border-slate-200 text-left font-mono space-y-2.5">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-[11px]">
                      <div className="col-span-2 border-b border-slate-100 pb-1.5">
                        <span className="text-[9px] text-slate-400 block uppercase font-sans">Full Instructor Name</span>
                        <strong className="text-slate-900 font-bold">
                          {(() => {
                            const t = teachers.find(x => x.id === teacherToDelete)!;
                            return `${t.firstName} ${t.middleName ? t.middleName + ' ' : ''}${t.lastName}`;
                          })()}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block uppercase font-sans">Staff ID Number</span>
                        <strong className="text-slate-950 font-bold">{teachers.find(x => x.id === teacherToDelete)!.staffId}</strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block uppercase font-sans">Professional Rank</span>
                        <strong className="text-slate-950 font-bold">{teachers.find(x => x.id === teacherToDelete)!.rank}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Warning message */}
                <div className="bg-rose-50 border border-rose-100/80 p-3.5 rounded-xl text-left text-rose-950 text-[11px] leading-relaxed space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-rose-800">
                    ⚠️ Deletion Policy Warning:
                  </p>
                  <p>
                    Retiring/deleting an active teacher profile does not delete class records, but will disassociate them as lead instructors. Make sure class handovers are handled properly before retiring staff. This action cannot be reverted.
                  </p>
                </div>

                {/* Controls */}
                <div className="w-full flex flex-col sm:flex-row gap-2 pt-2">
                  <button
                    type="button"
                    onClick={cancelDelete}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition text-center"
                    id="cancel-teacher-deletion"
                  >
                    Cancel, Keep Profile
                  </button>
                  <button
                    type="button"
                    onClick={confirmDelete}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white rounded-xl text-xs font-black shadow-md shadow-rose-600/10 cursor-pointer transition text-center"
                    id="confirm-teacher-deletion"
                  >
                    Yes, Purge Permanently
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TEACHER CREDENTIAL ID CARD MODAL */}
      <AnimatePresence>
        {selectedIdCardTeacher && (
          <div 
            onClick={() => setSelectedIdCardTeacher(null)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 no-print cursor-pointer overflow-y-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ ease: "easeOut", duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-100 dark:bg-slate-900 rounded-[24px] border border-slate-200/50 dark:border-slate-800/80 shadow-2xl max-w-4xl w-full flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200/80 dark:divide-slate-800 overflow-hidden my-8 max-h-[90vh] cursor-default"
            >
              
              {/* Left Column: ID Card Live Preview */}
              <div className="flex-1 p-6 overflow-y-auto bg-slate-700 dark:bg-slate-950 flex flex-col justify-between items-center space-y-4">
                <span className="text-white text-xs font-mono tracking-widest uppercase opacity-70">
                  Teacher {selectedIdCardFormat === 'id_card' ? 'ID Card' : 'QR Pass'} Print Preview
                </span>
                
                <div id="teacher-id-card-print-area" className="print-area-wrapper">
                  {selectedIdCardFormat === 'id_card' ? (
                    <div className="w-[300px] h-[460px] bg-white text-slate-950 rounded-2xl border border-slate-350 shadow-2xl relative overflow-hidden flex flex-col justify-between font-sans select-none">
                      {renderTeacherIdCardContent(selectedIdCardTeacher, 'single-preview')}
                    </div>
                  ) : (
                    <div className="w-[300px] h-[300px] bg-white text-slate-950 rounded-2xl border border-slate-350 shadow-2xl relative overflow-hidden flex flex-col justify-center items-center font-sans select-none p-4">
                      {renderTeacherQrOnlyContent(selectedIdCardTeacher, 'single-preview-qr')}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Information & Export Options */}
              <div className="flex-1 p-6 bg-white dark:bg-slate-900 flex flex-col justify-between max-h-[90vh] overflow-y-auto no-print">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-teal-50 dark:bg-teal-950/40 rounded-xl text-teal-600 dark:text-teal-400">
                      <IdCard size={22} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-950 dark:text-slate-100">Identity Badge Generator</h4>
                      <p className="text-[10px] text-slate-400">Generate, export or print teacher credentials</p>
                    </div>
                  </div>

                  {/* Format Selection */}
                  <div className="space-y-2 pt-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Select Document Format</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedIdCardFormat('id_card')}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${selectedIdCardFormat === 'id_card' ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-50'}`}
                      >
                        <IdCard size={14} /> ID Card
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedIdCardFormat('qr_only')}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${selectedIdCardFormat === 'qr_only' ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-50'}`}
                      >
                        <QrCode size={14} /> QR Pass
                      </button>
                    </div>
                  </div>

                  {/* Cloud Drive PDF Export Trigger Integration */}
                  <GoogleDriveExportControl 
                    elementId="teacher-id-card-print-area" 
                    defaultFilename={`${selectedIdCardTeacher.firstName}_${selectedIdCardTeacher.lastName}_Credential_Badge.pdf`}
                    isLandscape={true} 
                  />

                  <div className="p-3 bg-teal-50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 rounded-xl space-y-1 text-teal-950 dark:text-teal-200 text-[11px]">
                    <span className="font-bold">🖨️ Professional Printing Checklist</span>
                    <p className="text-[10px] text-teal-800/90 dark:text-teal-400 leading-relaxed">
                      To achieve standard physical ID badge dimensions, ensure your printing settings conform to the parameters detailed below.
                    </p>
                  </div>

                  <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300 font-sans">
                    <span className="font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-1 block">Setup Instructions Checklist:</span>
                    
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <div className="font-bold text-[10px] text-slate-600 bg-slate-100 dark:bg-slate-800 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">1</div>
                        <p className="text-[11px] leading-relaxed">
                          Click the <strong className="text-teal-600 font-bold">Trigger Badge Printer</strong> button to open printer controls.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <div className="font-bold text-[10px] text-slate-600 bg-slate-100 dark:bg-slate-800 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">2</div>
                        <p className="text-[11px] leading-relaxed">
                          Set <strong>Destination</strong> to <strong className="text-slate-900 dark:text-white font-bold">Save as PDF</strong> or select your connected desktop card printer.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <div className="font-bold text-[10px] text-slate-600 bg-slate-100 dark:bg-slate-800 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">3</div>
                        <p className="text-[11px] leading-relaxed">
                          Under <strong>More Settings</strong>, set Margin to <strong>None</strong> and enable <strong>Background Graphics</strong> to preserve the colors.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-slate-100 dark:border-slate-800 mt-6 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedIdCardTeacher(null)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold cursor-pointer transition text-center"
                  >
                    Close Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      window.print();
                    }}
                    className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black shadow-md shadow-teal-600/10 cursor-pointer transition flex items-center justify-center gap-1.5"
                  >
                    <Printer size={13} />
                    <span>Trigger Badge Printer</span>
                  </button>
                </div>

              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TEACHERS CSV BULK IMPORT MODAL */}
      <AnimatePresence>
        {showImportModal && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowImportModal(false);
                setImportFile(null);
                setParsedTeachers([]);
                setImportError(null);
              }
            }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto no-print cursor-pointer"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl border border-slate-200 max-w-4xl w-full shadow-2xl max-h-[90vh] overflow-hidden flex flex-col cursor-default font-sans text-xs my-4"
            >
              {/* Header */}
              <div className="p-6 pb-4 bg-white border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 leading-none">
                    <FileSpreadsheet className="text-indigo-600" size={18} />
                    Bulk Upload & Import Teacher Records
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1">Upload multiple teacher profiles at once using a formatted CSV spreadsheet</p>
                </div>
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                    setParsedTeachers([]);
                    setImportError(null);
                  }}
                  className="p-1 px-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Instruction Banner */}
                <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-50 text-[10px] text-indigo-700 font-bold">i</span>
                      Formatting Instruction Guide:
                    </h4>
                    <p className="text-[10px] text-slate-500 leading-normal max-w-2xl">
                      Make sure your spreadsheet includes headers such as: <code className="font-mono bg-slate-200 px-1 py-0.5 rounded text-amber-800">First Name</code>, <code className="font-mono bg-slate-200 px-1 py-0.5 rounded text-amber-800">Last Name</code>, <code className="font-mono bg-slate-200 px-1 py-0.5 rounded text-amber-800">Staff ID</code> (unique), <code className="font-mono bg-slate-200 px-1 py-0.5 rounded text-amber-800">Gender</code>, <code className="font-mono bg-slate-200 px-1 py-0.5 rounded text-amber-800">Professional Rank</code>, and <code className="font-mono bg-slate-200 px-1 py-0.5 rounded text-amber-800">Subjects Taught</code>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-250 hover:bg-slate-100 rounded-lg text-[11px] font-bold text-slate-700 transition cursor-pointer self-start md:self-auto flex-shrink-0"
                  >
                    <FileDown size={14} className="text-slate-500" />
                    Download CSV Template
                  </button>
                </div>

                {/* Upload & Drag State */}
                {!importFile ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => importFileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3 ${
                      dragActive 
                        ? 'border-indigo-505 bg-indigo-50/50' 
                        : 'border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50/20'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shadow-xs">
                      <Upload size={22} className={dragActive ? 'animate-bounce text-indigo-600' : ''} />
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-slate-700 text-xs">Drag and drop your staff roster CSV file here</p>
                      <p className="text-[10px] text-slate-400">or click to browse your desktop storage library</p>
                    </div>
                    <input
                      type="file"
                      ref={importFileInputRef}
                      onChange={handleFileChange}
                      accept=".csv"
                      className="hidden"
                    />
                    <div className="pt-2 text-[9px] text-slate-400 max-w-md mx-auto">
                      Only structured <strong className="text-slate-600">CSV spreadsheet format files (.csv)</strong> are accepted. Maximum size 3MB.
                    </div>
                  </div>
                ) : (
                  /* File Info & Parsing Metrics Area */
                  <div className="space-y-4">
                    <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                          <FileSpreadsheet size={16} />
                        </div>
                        <div>
                          <strong className="block text-xs font-bold text-slate-800">{importFile.name}</strong>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {(importFile.size / 1024).toFixed(1)} KB • {parsedTeachers.length} rows loaded
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setImportFile(null);
                          setParsedTeachers([]);
                          setImportError(null);
                        }}
                        className="px-2.5 py-1 text-red-650 hover:bg-red-50 hover:text-red-700 rounded font-bold transition text-[10px] cursor-pointer"
                      >
                        Reset / Choose Another
                      </button>
                    </div>

                    {/* Parser Error Alert */}
                    {importError && (
                      <div className="bg-red-50 border border-red-150 p-4 rounded-xl text-red-900 space-y-1 text-xs">
                        <h5 className="font-bold flex items-center gap-1.5 text-red-800">
                          ⚠️ Parsing Failure Alert:
                        </h5>
                        <p>{importError}</p>
                      </div>
                    )}

                    {/* Roster Spreadsheet Preview Table */}
                    {!importError && parsedTeachers.length > 0 && (
                      <div className="space-y-2">
                        {/* Summary metrics header */}
                        <div className="flex items-center justify-between text-[11px] font-sans pb-1">
                          <span className="text-slate-500">
                            Spreadsheet breakdown preview summary:
                          </span>
                          <div className="flex gap-2.5">
                            <span className="bg-indigo-50 text-indigo-750 font-bold px-2 py-0.5 rounded-full border border-indigo-100">
                              Total: {parsedTeachers.length} rows
                            </span>
                            <span className="bg-emerald-50 text-emerald-750 font-bold px-2 py-0.5 rounded-full border border-emerald-100">
                              Ready: {parsedTeachers.filter(p => p.errors.length === 0).length} valid
                            </span>
                            {parsedTeachers.filter(p => p.errors.length > 0).length > 0 && (
                              <span className="bg-rose-50 text-rose-750 font-bold px-2 py-0.5 rounded-full border border-rose-100">
                                Issues: {parsedTeachers.filter(p => p.errors.length > 0).length} flagged
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Scrolling scrollbar grid preview container */}
                        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto overflow-x-auto shadow-xs">
                          <table className="w-full text-left border-collapse text-[11px] min-w-[900px]">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                              <tr>
                                <th className="py-2.5 px-3 text-[10px] font-bold text-slate-400 tracking-wider font-mono uppercase">Row</th>
                                <th className="py-2.5 px-3 font-semibold text-slate-700">Full Name</th>
                                <th className="py-2.5 px-3 font-semibold text-slate-700">Gender</th>
                                <th className="py-2.5 px-3 font-semibold text-slate-700 font-mono">Staff ID</th>
                                <th className="py-2.5 px-3 font-semibold text-slate-700">Professional Rank</th>
                                <th className="py-2.5 px-3 font-semibold text-slate-700">Assignment</th>
                                <th className="py-2.5 px-3 font-semibold text-slate-700">Credentials</th>
                                <th className="py-2.5 px-3 text-right font-semibold text-slate-700 pr-4">Status / Feedbacks</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {parsedTeachers.map((rowVal, idx) => {
                                const { teacher, errors } = rowVal;
                                const hasErrors = errors.length > 0;
                                return (
                                  <tr key={idx} className={hasErrors ? 'bg-rose-50/20' : 'hover:bg-slate-50/30'}>
                                    <td className="py-2 px-3 font-mono font-bold text-slate-400">{idx + 2}</td>
                                    <td className="py-2 px-3 font-semibold text-slate-800">
                                      {teacher.firstName || <span className="text-red-500 italic">[Empty]</span>} {teacher.middleName ? teacher.middleName + ' ' : ''}{teacher.lastName || <span className="text-red-500 italic">[Empty]</span>}
                                    </td>
                                    <td className="py-2 px-3 text-slate-600">{teacher.gender}</td>
                                    <td className="py-2 px-3 font-mono font-semibold text-stone-700">{teacher.staffId || <span className="text-red-500 italic">[Empty]</span>}</td>
                                    <td className="py-2 px-3">
                                      <span className="font-semibold text-amber-800 bg-amber-50 rounded px-1.5 py-0.5 border border-amber-100">{teacher.rank}</span>
                                    </td>
                                    <td className="py-2 px-3 font-medium text-slate-700">{teacher.subjectsTaught || 'Not specified'}</td>
                                    <td className="py-2 px-3 text-slate-500 truncate max-w-[150px]">
                                      {teacher.highestAcademicQualifications || 'N/A'}{teacher.professionalQualifications && ` | ${teacher.professionalQualifications}`}
                                    </td>
                                    <td className="py-2 px-3 text-right pr-4">
                                      {hasErrors ? (
                                        <div className="inline-flex flex-col items-end gap-0.5">
                                          {errors.map((err, eIdx) => (
                                            <span key={eIdx} className="text-[9px] font-semibold text-red-600 bg-red-100/50 px-1.5 py-0.5 rounded">
                                              ⚠️ {err}
                                            </span>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100/50 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                          <Check size={10} /> Ready
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Verification Notice warning/success footer */}
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 flex items-center justify-between text-[10px] text-slate-400">
                          <span>
                            * Complete validation check: Rows with issues (⚠️) are skipped on execution. Correct your sheet and revalidate if necessary.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-150 flex items-center justify-between">
                <div className="text-[10px] text-slate-400 italic">
                  * Dynamic auto ID codes will generate format `TXXXX` if ID column isn't provided.
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportModal(false);
                      setImportFile(null);
                      setParsedTeachers([]);
                      setImportError(null);
                    }}
                    className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 font-semibold rounded-xl cursor-pointer transition text-xs shadow-2xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    disabled={!importFile || parsedTeachers.length === 0 || parsedTeachers.filter(p => p.errors.length === 0).length === 0}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none text-white font-bold rounded-xl cursor-pointer transition text-xs shadow-md shadow-indigo-600/10 inline-flex items-center gap-1.5"
                  >
                    <Check size={14} /> Execute Import ({parsedTeachers.filter(p => p.errors.length === 0).length} valid rosters)
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SECTION DATA CONTROLS */}
      {(isAdmin || isHeadteacherLoggedIn) && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3 no-print">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldAlert className="text-indigo-500" size={14} /> Section Teacher Controls
          </h4>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            Manage local instructor profile states, erase database inputs, and process personnel purge states for this module.
          </p>
          <div className="flex flex-wrap gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleClearInputs}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-850 hover:bg-slate-100 rounded-xl font-bold font-sans transition text-xs cursor-pointer shadow-xs"
            >
              <Eraser size={13} /> Clear All Inputs
            </button>
            <button
              type="button"
              onClick={handleDeleteActiveSelection}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 hover:text-amber-850 hover:bg-amber-100 rounded-xl font-bold font-sans transition text-xs cursor-pointer shadow-xs"
            >
              <RotateCcw size={13} /> Delete Active / Selected Teacher
            </button>
            <button
              type="button"
              onClick={handleDeleteAllTeachers}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 hover:text-rose-850 hover:bg-rose-100 rounded-xl font-bold font-sans transition text-xs cursor-pointer shadow-xs sm:ml-auto"
            >
              <Trash2 size={13} /> Delete All Section Data
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Feedback Toast */}
      <AnimatePresence>
        {toastMessage && (
          <div className={`fixed bottom-4 right-4 sm:bottom-5 sm:right-5 left-4 sm:left-auto max-w-sm z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl text-white transition-all duration-300 transform translate-y-0 ${
            toastMessage.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}>
            <Check className="h-5 w-5 shrink-0" />
            <span className="text-sm font-medium">{toastMessage.text}</span>
          </div>
        )}
      </AnimatePresence>

      {/* FACULTY ENROLLMENT/SAVE CONFIRMATION MODAL */}
      <AnimatePresence>
        {pendingTeacher && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) setPendingTeacher(null);
            }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 no-print cursor-pointer"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-slate-900 font-sans cursor-default space-y-4"
              id="faculty-enrollment-confirmation-modal"
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                  <UserCheck size={28} />
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                    {isEditing ? "Confirm Faculty Updates" : "Confirm Faculty Enrollment"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isEditing ? "Verify and confirm updates to this faculty profile:" : "Please verify the teacher registration information below before finalizing:"}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2.5 text-xs">
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500 font-medium">Full Name</span>
                  <span className="text-slate-800 font-semibold">{pendingTeacher.firstName} {pendingTeacher.middleName ? pendingTeacher.middleName + ' ' : ''}{pendingTeacher.lastName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500 font-medium">Professional Rank</span>
                  <span className="text-slate-800 font-semibold">{pendingTeacher.rank}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500 font-medium">Class Appointed</span>
                  <span className="text-slate-800 font-semibold">{pendingTeacher.assignedClass}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Email Address</span>
                  <span className="text-slate-800 font-semibold">{pendingTeacher.email || 'N/A'}</span>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100 text-center">
                🛡️ This faculty record is synced automatically with the central Cloud Database.
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPendingTeacher(null)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-bold font-sans text-xs transition cursor-pointer text-center bg-white"
                >
                  Go Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSave}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold font-sans text-xs transition cursor-pointer text-center"
                >
                  Confirm & Save
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {isCameraOpen && (
        <CameraCapture 
          onCapture={(url) => setFormState(prev => ({ ...prev, photoUrl: url }))} 
          onClose={() => setIsCameraOpen(false)} 
        />
      )}

      {isBatchCameraOpen && (
        <BatchTeacherCameraCaptureModal
          teachers={teachers}
          onPhotoCaptured={(teacherId, photoUrl) => {
            const teacherToUpdate = teachers.find(t => t.id === teacherId);
            if (teacherToUpdate) {
              const updated = { ...teacherToUpdate, photoUrl };
              DbController.saveTeacher(updated);
              onRefresh();
            }
          }}
          onClose={() => setIsBatchCameraOpen(false)}
          theme={theme}
        />
      )}

      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[110] p-4 no-print animate-fade-in">
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

      {showImageLinkModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[120] p-4 no-print animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden text-left p-6 space-y-4 animate-scale-up">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl shrink-0 bg-indigo-50 text-indigo-600">
                <User size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900 font-sans tracking-tight">
                  Enter Profile Image URL
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Provide a direct web link to the teacher's profile photo:
                </p>
                <div className="mt-3">
                  <input
                    type="url"
                    value={tempImageUrl}
                    onChange={(e) => setTempImageUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-800 font-semibold text-xs animate-scale-up"
                    placeholder="https://example.com/photo.jpg"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowImageLinkModal(false)}
                className="flex-1 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer select-none text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormState(prev => ({ ...prev, photoUrl: tempImageUrl }));
                  setShowImageLinkModal(false);
                }}
                className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition cursor-pointer select-none text-center"
              >
                Apply Image
              </button>
            </div>
          </div>
        </div>
      )}

        </>
      )}

      {/* Hidden single teacher print target. Visible only during @media print */}
      <div 
        id="teacher-id-card-print-area" 
        className="hidden print:block print:w-[297mm]"
      >
        {selectedIdCardTeacher && (
          <div className="id-cards-landscape-page">
            {Array.from({ length: 8 }).map((_, idx) => (
              renderTeacherIdCardContent(selectedIdCardTeacher, `single-teacher-print-${idx}`)
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
