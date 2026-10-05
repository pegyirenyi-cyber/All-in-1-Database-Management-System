import React, { useState, useRef, ChangeEvent, FormEvent, useMemo, useEffect } from 'react';
import { 
  Student, ClassType, CLASSES, SectionType, SECTIONS, 
  AcademicYearType, ACADEMIC_YEARS, TermType, TERMS, UserRole,
  BehavioralRemark, SubjectType, COMMON_MEDICAL_CONDITIONS
} from '../types';
import { DbController } from '../db';
import { compressImage } from '../utils';
import { ThemeStyles } from './ThemeWrapper';
import { 
  Plus, Search, Edit2, Trash2, Printer, Upload, X, Check, Save, User, MapPin, PhoneCall, ShieldAlert, BadgeCheck, FileDown, RotateCcw, Eraser, Eye, FileSpreadsheet,
  ChevronLeft, ChevronRight, IdCard, MessageSquare, AlertTriangle, Heart, Award, BookOpen, QrCode, Mail, Camera, Share2, TrendingUp, Calendar, UserCheck, Users, History, Mic, UserPlus,
  RefreshCw, CircleDollarSign, FileText, Languages, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';
import CameraCapture from './CameraCapture';
import BatchCameraCaptureModal from './BatchCameraCaptureModal';
import GoogleDriveExportControl from './GoogleDriveExportControl';
import { PrintPreviewModal } from './PrintPreviewModal';
import { QRCodeSVG } from 'qrcode.react';
import { generateSecureToken, getWatermarkHtml, triggerToast, shareParentPortalWhatsApp, getWhatsAppShareData, WhatsAppTemplate, calculateAgeFromDob } from '../utils';
import SmartTextarea from './SmartTextarea';

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
  students: Student[];
  onRefresh: () => void;
  isAutoSave: boolean;
  onManualSave: () => void;
  selectedYear?: AcademicYearType;
  setSelectedYear?: (yr: AcademicYearType) => void;
  selectedTerm?: TermType;
  setSelectedTerm?: (tm: TermType) => void;
  assignedClass?: ClassType | 'None';
  assignedClasses?: ClassType[];
  assignedSubjects?: SubjectType[];
  userRole?: UserRole;
}

const TRANSCRIPT_DICTIONARY = {
  en: {
    officialTranscript: "Official Student Transcript",
    academicRecord: "Comprehensive Academic Achievement Record",
    transcriptId: "Transcript ID",
    studentName: "Student Name",
    studentId: "Student ID",
    classLevel: "Class Level",
    genderStatus: "Gender / Status",
    termAverage: "Term Average",
    subject: "Subject",
    classScore: "Class (50)",
    examScore: "Exam (50)",
    total: "Total (100)",
    grade: "Grade",
    cumulativeAverage: "Cumulative Average",
    overallAttendance: "Overall Attendance",
    principalsSignature: "Principal's Signature",
    schoolStamp: "School Stamp / Date"
  },
  twi: {
    officialTranscript: "Sukuufoɔ Nwoma Mu Kyerɛwtohɔ",
    academicRecord: "Adesua Mu Nkɔsoɔ ne Akatua",
    transcriptId: "Nwoma ID",
    studentName: "Sukuufoɔ Din",
    studentId: "Sukuufoɔ ID",
    classLevel: "Sukuu Dan",
    genderStatus: "Ɔbarima/Ɔbaa • Tebea",
    termAverage: "Term Mu Nkyekyɛmu",
    subject: "Adesua",
    classScore: "Sukuu Dan Mu (50)",
    examScore: "Sɔhwɛ (50)",
    total: "Ne Nyinaa (100)",
    grade: "Nkabɔmu",
    cumulativeAverage: "Adesua Nyinaa Nkyekyɛmu",
    overallAttendance: "Sukuu Kɔ Mu Nkɔsoɔ",
    principalsSignature: "Sukuu Panyin Nsa Hyɛ",
    schoolStamp: "Sukuu Sɔre ne Da"
  }
};

const INITIAL_FORM: Partial<Student> = {
  firstName: '',
  middleName: '',
  lastName: '',
  class: 'Basic 1',
  gender: 'Male',
  dateOfBirth: '',
  placeOfBirth: '',
  status: 'Day',
  section: 'None',
  nationality: 'Ghanaian',
  guardianName: '',
  guardianTelephone: '',
  guardianOccupation: '',
  guardianEmail: '',
  email: '',
  residentialAddress: '',
  ghanaPostGps: '',
  motherName: '',
  motherTelephone: '',
  motherOccupation: '',
  motherStatus: 'Alive',
  fatherName: '',
  fatherTelephone: '',
  fatherOccupation: '',
  fatherStatus: 'Alive',
  photoUrl: '',
  academicYear: '2026/2027',
  term: 'Term 1',
  formerSchool: '',
  medicalCondition: 'None',
  medicalConditionOther: '',
  medicalNotes: ''
};

export default function StudentsTab({ 
  theme, 
  students, 
  onRefresh, 
  isAutoSave, 
  onManualSave,
  selectedYear,
  setSelectedYear,
  selectedTerm,
  setSelectedTerm,
  assignedClasses = [],
  assignedSubjects = [],
  assignedClass,
  userRole
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

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
  const currentUserEmail = DbController.getCurrentUser()?.email?.toLowerCase().trim();
  const isAdminOrHead = userRole === 'Admin' || userRole === 'Headteacher' || currentUserEmail === 'pegyirenyi@gmail.com';
  const canSelectStudents = isAdminOrHead || userRole === 'Teacher';
  const [selectedClass, setSelectedClass] = useState<string>(() => {
    if (userRole === 'Teacher') {
      return assignedClasses.length > 0 ? assignedClasses[0] : (assignedClass || 'None');
    }
    return 'All';
  });
  const [selectedSection, setSelectedSection] = useState<string>('All');
  const [sectionsList, setSectionsList] = useState<string[]>(() => DbController.getSections());
  const [showAddSectionInput, setShowAddSectionInput] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [showSectionManagerModal, setShowSectionManagerModal] = useState(false);
  const [newManagerSectionName, setNewManagerSectionName] = useState('');

  useEffect(() => {
    const handleSyncSections = () => {
      setSectionsList(DbController.getSections());
    };
    window.addEventListener('sections-updated', handleSyncSections);
    return () => window.removeEventListener('sections-updated', handleSyncSections);
  }, []);

  const handleCreateSection = (e?: React.FormEvent, nameOverride?: string) => {
    if (e) e.preventDefault();
    const raw = nameOverride !== undefined ? nameOverride : newSectionName;
    const trimmed = (raw || '').trim();
    if (!trimmed) {
      triggerToast('Please provide a valid section name.', 'info');
      return;
    }
    const updated = DbController.saveCustomSection(trimmed);
    setSectionsList(updated);
    setFormState(prev => ({ ...prev, section: trimmed as SectionType }));
    setNewSectionName('');
    setShowAddSectionInput(false);
    triggerToast(`Section category "${trimmed}" saved and selected!`, 'success');
  };

  const handleAddSectionFromModal = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = (newManagerSectionName || '').trim();
    if (!trimmed) {
      triggerToast('Please type a section name.', 'info');
      return;
    }
    const updated = DbController.saveCustomSection(trimmed);
    setSectionsList(updated);
    setNewManagerSectionName('');
    triggerToast(`Section "${trimmed}" added to school registry!`, 'success');
  };

  const handleDeleteSection = (sectionName: string) => {
    const trimmed = (sectionName || '').trim();
    if (!trimmed || trimmed.toLowerCase() === 'none') {
      triggerToast("The 'None' section category cannot be removed.", "info");
      return;
    }

    const assigned = students.filter(s => (s.section || '').toLowerCase() === trimmed.toLowerCase());
    
    setConfirmModal({
      isOpen: true,
      title: `Remove Section "${trimmed}"?`,
      message: assigned.length > 0 
        ? `Are you sure you want to remove section "${trimmed}"? There are currently ${assigned.length} student(s) assigned to this section. Their section assignment will be automatically set to 'None'.`
        : `Are you sure you want to remove section "${trimmed}" from your school section registry?`,
      confirmText: `Remove "${trimmed}"`,
      danger: true,
      onConfirm: () => {
        const updated = DbController.deleteCustomSection(trimmed);
        setSectionsList(updated);

        // Reassign affected students to 'None'
        if (assigned.length > 0) {
          assigned.forEach(st => {
            DbController.saveStudent({ ...st, section: 'None' });
          });
          onRefresh();
        }

        // Reset in open registration form if selected
        if (formState.section === trimmed) {
          setFormState(prev => ({ ...prev, section: 'None' }));
        }

        // Reset in top filter bar if selected
        if (selectedSection === trimmed) {
          setSelectedSection('All');
        }

        showToast(`Section "${trimmed}" successfully removed from registry.`, "success");
      }
    });
  };

  const [studentsSubTab, setStudentsSubTab] = useState<'roster' | 'overview'>('roster');
  const [directoryView, setDirectoryView] = useState<'grid' | 'table'>('table');

  useEffect(() => {
    if (userRole === 'Teacher') {
      setSelectedClass(assignedClasses.length > 0 ? assignedClasses[0] : (assignedClass || 'None'));
    }
  }, [assignedClass, assignedClasses, userRole]);
  
  // Sort order state (defaults to name A-Z)
  const [studentSortBy, setStudentSortBy] = useState<'name-asc' | 'name-desc' | 'id-asc' | 'class-asc'>('name-asc');

  // Pagination states
  const [studentPage, setStudentPage] = useState(1);
  const [studentPageSize, setStudentPageSize] = useState(12);

  // Reset page when search, filters, or sorting change
  useEffect(() => {
    setStudentPage(1);
  }, [searchTerm, selectedClass, selectedSection, selectedYear, selectedTerm, studentSortBy]);
  
  // Modal/Form toggle states
  const [isEditing, setIsEditing] = useState(false);
  const [formState, setFormState] = useState<Partial<Student>>({ ...INITIAL_FORM });
  const [showFormModal, setShowFormModal] = useState(false);
  const [showImageLinkModal, setShowImageLinkModal] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState('');
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

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

  // Bulk selection states
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Reset bulk selection on filter change
  useEffect(() => {
    setSelectedStudentIds([]);
  }, [searchTerm, selectedClass, selectedSection, selectedYear, selectedTerm, studentPage, studentPageSize]);

  // Bulk Status Update states
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [bulkUpdateStatus, setBulkUpdateStatus] = useState<'Day' | 'Boarder'>('Day');
  const [bulkUpdateClass, setBulkUpdateClass] = useState<ClassType>('Basic 1');
  const [shouldUpdateStatus, setShouldUpdateStatus] = useState(false);
  const [shouldUpdateClass, setShouldUpdateClass] = useState(false);
  const [shouldUpdateAttendance, setShouldUpdateAttendance] = useState(false);
  const [bulkAttendanceStatus, setBulkAttendanceStatus] = useState<'Present' | 'Absent'>('Present');
  const [shouldUpdateFeeStatus, setShouldUpdateFeeStatus] = useState(false);

  const handleBulkStatusUpdate = () => {
    if (selectedStudentIds.length === 0) {
      triggerToast('No students selected for bulk status update.', 'error');
      return;
    }
    if (!shouldUpdateStatus && !shouldUpdateClass && !shouldUpdateAttendance && !shouldUpdateFeeStatus) {
      triggerToast('Please select at least one field to update.', 'error');
      return;
    }

    let count = 0;
    const today = new Date().toISOString().split('T')[0];
    const attendanceRecords: any[] = [];
    
    // Get active calendar for fee/attendance context
    const calendar = DbController.getAcademicCalendar();
    const activeYear = calendar.activeAcademicYear;
    const activeTerm = calendar.activeTerm;

    selectedStudentIds.forEach(id => {
      const student = students.find(s => s.id === id);
      if (student) {
        const updated = { ...student };
        
        // 1. Profile Status/Class
        if (shouldUpdateStatus) {
          updated.status = bulkUpdateStatus;
        }
        if (shouldUpdateClass) {
          updated.class = bulkUpdateClass;
        }
        
        if (shouldUpdateStatus || shouldUpdateClass) {
          DbController.saveStudent(updated);
        }

        // 2. Attendance
        if (shouldUpdateAttendance) {
          attendanceRecords.push({
            id: `${today}_${student.id}`,
            date: today,
            studentId: student.id,
            studentName: `${student.firstName} ${student.lastName}`,
            class: student.class,
            status: bulkAttendanceStatus
          });
        }

        // 3. Fee Status (Marking Tuition as Paid for active term - Restricted from Teachers)
        if (shouldUpdateFeeStatus && userRole !== 'Teacher') {
          const billId = `${student.id}_${activeYear}_${activeTerm}`;
          const existingBills = DbController.getStudentFeeBills();
          const bill = existingBills.find(b => b.id === billId);
          if (bill) {
            // Mark as paid by adding a payment that covers the balance
            const totalBill = bill.schoolFees + bill.utilityBill + bill.sportsFees + bill.ptaDues + bill.transportationBill + bill.otherFee;
            const totalPaid = bill.payments.reduce((sum, p) => sum + p.amount, 0);
            const balance = totalBill - totalPaid;
            
            if (balance > 0) {
              const newPayment = {
                id: 'pay_' + Math.random().toString(36).substring(2, 9),
                amount: balance,
                date: today,
                component: 'School Fees' as any,
                method: 'Cash' as any,
                receiptNo: 'BULK-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
                remarks: 'Bulk status update: Marked as Paid'
              };
              bill.payments.push(newPayment);
              bill.updatedAt = new Date().toISOString();
              DbController.saveStudentFeeBill(bill);
            }
          }
        }
        
        count++;
      }
    });

    if (attendanceRecords.length > 0) {
      DbController.saveAttendanceBatch(attendanceRecords);
    }

    onRefresh();
    setSelectedStudentIds([]);
    setShowBulkUpdateModal(false);
    triggerToast(`Successfully bulk-updated ${count} student records.`, 'success');

    if (!isAutoSave) {
      onManualSave();
    }
  };

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isBatchCameraOpen, setIsBatchCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Enrollment confirmation & toast notice states
  const [pendingStudent, setPendingStudent] = useState<Student | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // QR Code states
  const [selectedQrStudent, setSelectedQrStudent] = useState<Student | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  // Bulk QR states
  const [showBulkQrModal, setShowBulkQrModal] = useState(false);
  const [bulkQrClassFilter, setBulkQrClassFilter] = useState<string>('All');
  const [bulkQrSearch, setBulkQrSearch] = useState<string>('');
  const [selectedBulkStudents, setSelectedBulkStudents] = useState<string[]>([]);
  const [bulkQrFormat, setBulkQrFormat] = useState<'id_card' | 'sticker' | 'avery_label'>('id_card');
  const [bulkQrCols, setBulkQrCols] = useState<number>(3);
  const [includePortalToken, setIncludePortalToken] = useState<boolean>(true);

  const handleOpenBulkQrModal = () => {
    setBulkQrClassFilter('All');
    setBulkQrSearch('');
    setSelectedBulkStudents(students.map(s => s.id));
    setShowBulkQrModal(true);
  };

  // Bulk WhatsApp states
  const [showBulkWhatsAppModal, setShowBulkWhatsAppModal] = useState(false);
  const [bulkWhatsAppClassFilter, setBulkWhatsAppClassFilter] = useState<string>('All');
  const [bulkWhatsAppTemplate, setBulkWhatsAppTemplate] = useState<WhatsAppTemplate>('FEES_REMINDER');
  const [bulkWhatsAppSearch, setBulkWhatsAppSearch] = useState<string>('');
  const [selectedBulkWhatsAppStudents, setSelectedBulkWhatsAppStudents] = useState<string[]>([]);
  
  // Individual WhatsApp states
  const [whatsappShareStudent, setWhatsappShareStudent] = useState<Student | null>(null);
  const [individualWhatsAppTemplate, setIndividualWhatsAppTemplate] = useState<WhatsAppTemplate>('FEES_REMINDER');

  const handleOpenBulkWhatsAppModal = () => {
    setBulkWhatsAppClassFilter(selectedClass || 'All');
    setBulkWhatsAppSearch('');
    const filtered = students.filter(s => selectedClass === 'All' || s.class === (selectedClass || 'All'));
    setSelectedBulkWhatsAppStudents(filtered.map(s => s.id));
    setShowBulkWhatsAppModal(true);
  };

  const filteredBulkWhatsAppStudents = useMemo(() => {
    return students.filter(s => {
      const matchesClass = bulkWhatsAppClassFilter === 'All' || s.class === bulkWhatsAppClassFilter;
      const fullName = `${s.firstName || ''} ${s.middleName || ''} ${s.lastName || ''}`.toLowerCase();
      const matchesSearch = !bulkWhatsAppSearch || 
        fullName.includes(bulkWhatsAppSearch.toLowerCase()) || 
        s.id.toLowerCase().includes(bulkWhatsAppSearch.toLowerCase());
      return matchesClass && matchesSearch;
    });
  }, [students, bulkWhatsAppClassFilter, bulkWhatsAppSearch]);

  const filteredBulkStudents = useMemo(() => {
    return students.filter(s => {
      const matchesClass = bulkQrClassFilter === 'All' || s.class === bulkQrClassFilter;
      const fullName = `${s.firstName || ''} ${s.middleName || ''} ${s.lastName || ''}`.toLowerCase();
      const matchesSearch = !bulkQrSearch || 
        fullName.includes(bulkQrSearch.toLowerCase()) || 
        s.id.toLowerCase().includes(bulkQrSearch.toLowerCase());
      return matchesClass && matchesSearch;
    });
  }, [students, bulkQrClassFilter, bulkQrSearch]);

  const handleSendBulkWhatsApp = async () => {
    const studentsToMessage = filteredBulkWhatsAppStudents.filter(s => selectedBulkWhatsAppStudents.includes(s.id));
    
    if (studentsToMessage.length === 0) {
      triggerToast('No students selected for bulk messaging.', 'error');
      return;
    }

    triggerToast(`Opening ${studentsToMessage.length} WhatsApp links sequentially. Please allow popups.`, 'success');
    
    // We open them sequentially with a small delay to avoid browser blocking too much
    for (let i = 0; i < studentsToMessage.length; i++) {
      const student = studentsToMessage[i];
      const yr = student.academicYear || selectedYear || '2026/2027';
      const tm = student.term || selectedTerm || 'Term 1';
      
      const { whatsappUrl } = getWhatsAppShareData(student, yr, tm, bulkWhatsAppTemplate);
      window.open(whatsappUrl, '_blank');
      
      // Delay to avoid triggering anti-popup/anti-spam filters too aggressively
      if (i < studentsToMessage.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    }
  };

  const handlePrintBulkQrCodes = () => {
    if (selectedBulkStudents.length === 0) {
      alert("Please select at least one student to generate QR codes.");
      return;
    }
    const printArea = document.getElementById('bulk-qr-print-area');
    if (!printArea) return;

    window.print();
  };

  // ID Card states
  const [selectedIdCardStudent, setSelectedIdCardStudent] = useState<Student | null>(null);
  const [showIdCardModal, setShowIdCardModal] = useState(false);
  const [showBulkIdCardModal, setShowBulkIdCardModal] = useState(false);

  const renderStudentIdCardContent = (student: Student, keyPrefix: string) => {
    return (
      <div 
        key={`${keyPrefix}-${student.id}`}
        className="id-card-print-item relative flex flex-col justify-between"
      >
        {/* Card Header Wave / Banner */}
        <div className="bg-indigo-900 text-white p-3 pt-4 text-center relative overflow-hidden flex flex-col items-center justify-center min-h-[75px]">
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-950 to-indigo-800 opacity-90"></div>
          <div className="relative z-10 flex items-center gap-2 max-w-[90%] justify-center">
            {DbController.getSchoolInfo().logoUrl ? (
              <img 
                src={DbController.getSchoolInfo().logoUrl} 
                alt="School Logo" 
                className="w-7 h-7 object-contain rounded-full bg-white p-0.5"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold text-white">SCH</div>
            )}
            <div className="text-left flex-1 min-w-0">
              <h4 className="text-[9px] font-black uppercase tracking-wide truncate leading-tight">
                {DbController.getSchoolInfo().name}
              </h4>
              <p className="text-[6.5px] italic font-mono text-indigo-200 truncate leading-none mt-0.5">
                "{DbController.getSchoolInfo().motto}"
              </p>
            </div>
          </div>
          <div className="absolute bottom-0 right-0 left-0 bg-amber-500 text-[6.5px] font-extrabold uppercase tracking-widest py-0.5 text-center text-slate-950 z-10">
            Student Identity Card
          </div>
        </div>

        {/* Card Body - Photo & Bio details */}
        <div className="flex-1 p-4 flex flex-col items-center justify-center space-y-3.5 relative z-10 bg-radial from-white to-slate-50/50">
          {DbController.getSchoolInfo().logoUrl && (
            <img 
              src={DbController.getSchoolInfo().logoUrl} 
              alt="Watermark" 
              className="absolute inset-0 m-auto w-32 h-32 object-contain opacity-[0.04] pointer-events-none select-none"
              referrerPolicy="no-referrer"
            />
          )}

          {/* Student Photo */}
          <div className="relative">
            <div className="w-24 h-24 rounded-full border-2 border-indigo-900 overflow-hidden bg-slate-100 flex items-center justify-center shadow-md">
              {student.photoUrl ? (
                <img 
                  src={student.photoUrl} 
                  alt={`${student.firstName} Photo`} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <User size={48} className="text-slate-350" />
              )}
            </div>
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-[#059669] text-white text-[6.5px] font-extrabold px-2 py-0.5 rounded-full border border-white shadow-xs tracking-wide whitespace-nowrap uppercase font-sans">
              {student.status === 'Boarder' ? 'BOARDER' : 'DAY STUDENT'}
            </span>
          </div>

          {/* Student Identity Information */}
          <div className="text-center space-y-2.5 w-full">
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight leading-tight uppercase font-display">
                {student.firstName} {student.middleName ? student.middleName + ' ' : ''}{student.lastName}
              </h3>
              <p className="text-[7.5px] font-mono font-bold text-indigo-700 tracking-widest mt-0.5">
                ID: {student.id}
              </p>
            </div>

            {/* Particulars Grid */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 bg-white/70 border border-slate-150 rounded-xl p-2.5 text-left text-[9px] font-medium shadow-2xs">
              <div>
                <span className="text-[6.5px] text-slate-400 block font-bold uppercase leading-none mb-0.5">CLASS LEVEL</span>
                <strong className="text-slate-800 font-bold">{student.class}</strong>
              </div>
              <div>
                <span className="text-[6.5px] text-slate-400 block font-bold uppercase leading-none mb-0.5">SECTION</span>
                <strong className="text-slate-800 font-bold">{student.section}</strong>
              </div>
              <div className="col-span-2 border-t border-slate-100 pt-1 mt-0.5">
                <span className="text-[6.5px] text-slate-400 block font-bold uppercase leading-none mb-0.5">GUARDIAN CONTACT</span>
                <strong className="text-slate-800 font-bold truncate block">
                  {student.guardianTelephone || 'N/A'}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Card Footer - QR Code and Authorized Signature */}
        <div className="p-3 bg-slate-50 border-t border-slate-150 flex items-center justify-between min-h-[85px] relative z-10">
          {/* QR Code */}
          <div className="flex flex-col items-center gap-1">
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                `Student ID: ${student.id}\nName: ${student.firstName} ${student.lastName}\nClass: ${student.class}\nSchool: ${DbController.getSchoolInfo().name}`
              )}`} 
              alt="Profile QR Code" 
              className="w-14 h-14 object-contain border border-slate-200 bg-white p-0.5 rounded-lg shadow-2xs animate-none"
              referrerPolicy="no-referrer"
            />
            <span className="text-[5.5px] font-mono text-slate-400 font-bold uppercase tracking-wider">PROFILE LINK</span>
          </div>

          {/* Authorized Signature Box */}
          <div className="text-right flex flex-col items-end justify-end space-y-1 self-stretch min-w-[110px]">
            <div className="relative w-28 h-8 flex items-center justify-center">
              {DbController.getSchoolInfo().stampUrl && (
                <img 
                  src={DbController.getSchoolInfo().stampUrl} 
                  alt="Stamp" 
                  className="absolute -left-2 w-10 h-10 object-contain opacity-50 pointer-events-none rotate-12 z-0"
                  referrerPolicy="no-referrer"
                />
              )}
              {DbController.getSchoolInfo().signatureUrl ? (
                <img 
                  src={DbController.getSchoolInfo().signatureUrl} 
                  alt="Signature" 
                  className="absolute w-20 h-7 object-contain z-10 bottom-0 select-none pointer-events-none"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="absolute text-[8px] italic text-slate-350 z-10 bottom-1">Headteacher</div>
              )}
            </div>
            <div className="h-[1px] w-24 bg-slate-300"></div>
            <span className="text-[6px] font-black text-slate-800 uppercase tracking-wider block font-sans text-right leading-none">
              {DbController.getSchoolInfo().headteacherName || 'Headteacher Sign'}
            </span>
            <span className="text-[5px] font-bold text-slate-400 block tracking-widest uppercase text-right leading-none">
              AUTHORIZED SIGNATURE
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Behavioral remarks states
  const [selectedRemarkStudent, setSelectedRemarkStudent] = useState<Student | null>(null);
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  const [newRemarkText, setNewRemarkText] = useState('');
  const [newRemarkCategory, setNewRemarkCategory] = useState<BehavioralRemark['category']>('Conduct');

  // Student Overview states
  const [showOverviewModal, setShowOverviewModal] = useState(false);
  const [selectedOverviewStudent, setSelectedOverviewStudent] = useState<Student | null>(null);
  const [overviewTab, setOverviewTab] = useState<'trends' | 'attendance' | 'history'>('trends');

  const [showTranscriptPrint, setShowTranscriptPrint] = useState(false);
  const [transcriptHtml, setTranscriptHtml] = useState('');
  const [transcriptTitle, setTranscriptTitle] = useState('');
  const [transcriptLanguage, setTranscriptLanguage] = useState<'en' | 'twi'>('en');

  // Bulk import states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [parsedStudents, setParsedStudents] = useState<{ student: Partial<Student>; errors: string[] }[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);

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

  // Maps raw CSV cells to structured Student records with inline warnings & default fallbacks
  const mapCSVRowsToStudents = (rows: string[][]): { student: Partial<Student>; errors: string[] }[] => {
    if (rows.length < 2) return [];

    const rawHeaders = rows[0].map(h => h.trim().toLowerCase());
    const dataRows = rows.slice(1);

    // Dynamic, flexible index matching
    const findIndex = (aliases: string[]) => {
      return rawHeaders.findIndex(header => 
        aliases.some(alias => header === alias || header.replace(/[\s_-]/g, '') === alias.replace(/[\s_-]/g, ''))
      );
    };

    const idIdx = findIndex(['id', 'idcode', 'studentid', 'student id']);
    const firstNameIdx = findIndex(['firstname', 'first name', 'fname']);
    const middleNameIdx = findIndex(['middlename', 'middle name', 'mname']);
    const lastNameIdx = findIndex(['lastname', 'last name', 'lname']);
    const classIdx = findIndex(['class', 'classlevel', 'class level', 'grade']);
    const genderIdx = findIndex(['gender', 'sex']);
    const dobIdx = findIndex(['dateofbirth', 'date of birth', 'dob', 'birthdate']);
    const placeOfBirthIdx = findIndex(['placeofbirth', 'place of birth']);
    const statusIdx = findIndex(['status', 'type', 'enrollmentstatus', 'dayboarder']);
    const sectionIdx = findIndex(['section', 'house', 'stream']);
    const nationalityIdx = findIndex(['nationality', 'country']);
    const guardianNameIdx = findIndex(['guardianname', 'guardian name', 'parent', 'parentname']);
    const guardianTelephoneIdx = findIndex(['guardiantelephone', 'guardian telephone', 'guardianphone', 'parentphone', 'phone']);
    const guardianOccupationIdx = findIndex(['guardianoccupation', 'guardian occupation', 'parentoccupation']);
    const residentialAddressIdx = findIndex(['residentialaddress', 'residential address', 'address', 'physical address']);
    const ghanaPostIdx = findIndex(['ghanapostgps', 'ghanapost', 'gpsaddress', 'digitaladdress', 'ghana post address', 'ghana post', 'gps code']);
    const motherNameIdx = findIndex(['mothername', "mother's name", "mothers name", 'mother', 'mother full name']);
    const motherPhoneIdx = findIndex(['mothertelephone', 'motherphone', "mother's phone", "mother contact", 'mother tel']);
    const motherOccIdx = findIndex(['motheroccupation', "mother's occupation", 'mother job']);
    const motherStatusIdx = findIndex(['motherstatus', 'mother status', "mother alive", "mother live/death", "mother livedeath"]);
    const fatherNameIdx = findIndex(['fathername', "father's name", "fathers name", 'father', 'father full name']);
    const fatherPhoneIdx = findIndex(['fathertelephone', 'fatherphone', "father's phone", "father contact", 'father tel']);
    const fatherOccIdx = findIndex(['fatheroccupation', "father's occupation", 'father job']);
    const fatherStatusIdx = findIndex(['fatherstatus', 'father status', "father alive", "father live/death", "father livedeath"]);
    const formerSchoolIdx = findIndex(['formalschool', 'formal school', 'formerschool', 'former school', 'previousschool', 'previous school']);
    const medicalConditionIdx = findIndex(['medicalcondition', 'medical condition', 'medical records', 'medical', 'allergy', 'allergies']);
    const medicalConditionOtherIdx = findIndex(['medicalconditionother', 'medical other', 'state condition', 'other condition']);
    const medicalNotesIdx = findIndex(['medicalnotes', 'medical notes', 'care notes', 'health notes']);

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

      // Class validation & alignment
      let studentClass: ClassType = 'Basic 1';
      const rawClass = getValue(classIdx);
      if (rawClass) {
        const foundClass = CLASSES.find(c => 
          c.toLowerCase() === rawClass.toLowerCase() || 
          c.replace(/\s+/g, '').toLowerCase() === rawClass.replace(/\s+/g, '').toLowerCase()
        );
        if (foundClass) {
          studentClass = foundClass;
        } else {
          errors.push(`Invalid Class: "${rawClass}". Expected one of: ${CLASSES.join(', ')}`);
        }
      } else {
        studentClass = (selectedClass !== 'All' ? selectedClass : 'Class 1') as ClassType;
      }

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

      // Birthdate formatting checks
      const dateOfBirth = getValue(dobIdx);
      if (!dateOfBirth) {
        errors.push("Missing Date of Birth * (YYYY-MM-DD)");
      } else {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateOfBirth)) {
          errors.push(`Invalid Date format: "${dateOfBirth}". Use absolute YYYY-MM-DD`);
        }
      }

      // Boarding/Day registration status
      let status: 'Day' | 'Boarder' = 'Day';
      const rawStatus = getValue(statusIdx);
      if (rawStatus) {
        const sLower = rawStatus.toLowerCase();
        if (sLower === 'day' || sLower === 'd') {
          status = 'Day';
        } else if (sLower === 'boarder' || sLower === 'boarding' || sLower === 'b') {
          status = 'Boarder';
        } else {
          errors.push(`Invalid Status: "${rawStatus}". Use "Day" or "Boarder"`);
        }
      }

      // Admin house/section selection (provides 'None' if school doesn't have sections)
      let section: SectionType = 'None';
      const rawSection = getValue(sectionIdx);
      if (rawSection) {
        const availableSecs = DbController.getSections();
        const foundSec = availableSecs.find(s => s.toLowerCase() === rawSection.toLowerCase());
        if (foundSec) {
          section = foundSec;
        } else {
          DbController.saveCustomSection(rawSection.trim());
          section = rawSection.trim();
        }
      } else {
        section = 'None';
      }

      const rawId = getValue(idIdx);
      const id = rawId || 'ST' + Math.floor(100000 + Math.random() * 90000);

      const student: Partial<Student> = {
        id,
        firstName,
        middleName: getValue(middleNameIdx),
        lastName,
        class: studentClass,
        gender,
        dateOfBirth,
        placeOfBirth: getValue(placeOfBirthIdx),
        status,
        section,
        nationality: getValue(nationalityIdx) || 'Ghanaian',
        guardianName: getValue(guardianNameIdx),
        guardianTelephone: getValue(guardianTelephoneIdx),
        guardianOccupation: getValue(guardianOccupationIdx),
        residentialAddress: getValue(residentialAddressIdx),
        ghanaPostGps: getValue(ghanaPostIdx),
        motherName: getValue(motherNameIdx),
        motherTelephone: getValue(motherPhoneIdx),
        motherOccupation: getValue(motherOccIdx),
        motherStatus: (getValue(motherStatusIdx)?.toLowerCase().includes('dead') || getValue(motherStatusIdx)?.toLowerCase().includes('dec') || getValue(motherStatusIdx)?.toLowerCase().includes('death')) ? 'Death' : 'Alive',
        fatherName: getValue(fatherNameIdx),
        fatherTelephone: getValue(fatherPhoneIdx),
        fatherOccupation: getValue(fatherOccIdx),
        fatherStatus: (getValue(fatherStatusIdx)?.toLowerCase().includes('dead') || getValue(fatherStatusIdx)?.toLowerCase().includes('dec') || getValue(fatherStatusIdx)?.toLowerCase().includes('death')) ? 'Death' : 'Alive',
        photoUrl: '', // Default blank on bulk uploading
        academicYear: selectedYear || '2026/2027',
        term: selectedTerm || 'Term 1',
        createdAt: new Date().toISOString(),
        formerSchool: getValue(formerSchoolIdx) || '',
        medicalCondition: getValue(medicalConditionIdx) || 'None',
        medicalConditionOther: getValue(medicalConditionOtherIdx) || '',
        medicalNotes: getValue(medicalNotesIdx) || ''
      };

      return { student, errors };
    });
  };

  const processFile = (file: File) => {
    setImportFile(file);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        if (file.name.endsWith('.json')) {
          const jsonData = JSON.parse(text);
          if (!Array.isArray(jsonData)) {
            setImportError("JSON must be an array of student records.");
            setParsedStudents([]);
            return;
          }
          const mapped = jsonData.map((item, idx) => {
            const errors: string[] = [];
            if (!item.firstName) errors.push("Missing First Name *");
            if (!item.lastName) errors.push("Missing Last Name *");
            
            // Basic normalization for JSON import
            const student: Partial<Student> = {
              id: item.id || 'ST' + Math.floor(100000 + Math.random() * 90000),
              firstName: item.firstName || '',
              middleName: item.middleName || '',
              lastName: item.lastName || '',
              class: (CLASSES.includes(item.class) ? item.class : (selectedClass !== 'All' ? selectedClass : 'Basic 1')) as ClassType,
              gender: (item.gender === 'Female' ? 'Female' : 'Male'),
              dateOfBirth: item.dateOfBirth || '',
              status: (item.status === 'Boarder' ? 'Boarder' : 'Day'),
              section: (item.section ? item.section : 'None') as SectionType,
              academicYear: selectedYear || '2026/2027',
              term: selectedTerm || 'Term 1',
              createdAt: new Date().toISOString(),
              ...item
            };

            if (student.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(student.dateOfBirth)) {
              errors.push("Invalid Date format. Use YYYY-MM-DD");
            }

            return { student, errors };
          });
          setParsedStudents(mapped);
        } else {
          const rows = parseCSV(text);
          if (rows.length < 2) {
            setImportError("CSV contains insufficient rows. Please include a header row followed by data.");
            setParsedStudents([]);
            return;
          }
          const mapped = mapCSVRowsToStudents(rows);
          setParsedStudents(mapped);
        }
      } catch (err) {
        console.error(err);
        setImportError("Encountered filesystem read or encoding error parsing the file.");
        setParsedStudents([]);
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
      if (file.name.endsWith('.csv') || file.name.endsWith('.json')) {
        processFile(file);
      } else {
        setImportError("The dropped file is not a supported format. Please upload a .csv or .json file.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.name.endsWith('.csv') || file.name.endsWith('.json')) {
        processFile(file);
      } else {
        setImportError("The selected file must be a structured CSV or JSON format (.csv, .json).");
      }
    }
  };

  const handleDownloadJsonTemplate = () => {
    const template = [
      {
        firstName: "Kofi",
        middleName: "Kwadwo",
        lastName: "Mensah",
        class: "Basic 1",
        gender: "Male",
        dateOfBirth: "2016-04-12",
        status: "Day",
        section: "Faith",
        guardianName: "Kwame Mensah",
        guardianTelephone: "0241234567"
      }
    ];
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "student_import_template.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadTemplate = () => {
    const headers = [
      'First Name', 'Middle Name', 'Last Name', 'Class', 'Gender',
      'Date of Birth', 'Place of Birth', 'Status', 'Section', 'Nationality',
      'Residential Address', 'Ghana Post Address',
      "Mother's Name", "Mother's Telephone", "Mother's Occupation", "Mother's Status",
      "Father's Name", "Father's Telephone", "Father's Occupation", "Father's Status",
      'Guardian Name', 'Guardian Telephone', 'Guardian Occupation'
    ];
    const examples = [
      ['Kofi', 'Kwadwo', 'Mensah', 'Class 1', 'Male', '2016-04-12', 'Kumasi', 'Day', 'Faith', 'Ghanaian', '12 Main St Kumasi', 'AK-039-5028', 'Grace Mensah', '0244111222', 'Trader', 'Alive', 'Emmanuel Mensah', '0208111222', 'Engineer', 'Alive', 'Kwame Mensah', '0241234567', 'Trader'],
      ['Ama', 'Osei', 'Sarpong', 'Class 2', 'Female', '2015-08-23', 'Accra', 'Boarder', 'Harmony', 'Ghanaian', 'Plot 45 East Legon', 'GA-183-9024', 'Abena Sarpong', '0209876543', 'Teacher', 'Alive', 'Yaw Sarpong', '0244987654', 'Accountant', 'Alive', 'Abena Sarpong', '0209876543', 'Teacher']
    ];

    const csvContent = [
      headers.join(','),
      ...examples.map(ex => ex.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Student_Bulk_Import_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExecuteImport = () => {
    const validRows = parsedStudents.filter(p => p.errors.length === 0);
    if (validRows.length === 0) {
      alert("No valid rows available to import. Correct validation issues and try again.");
      return;
    }

    validRows.forEach(row => {
      DbController.saveStudent(row.student as Student);
    });

    onRefresh();
    setShowImportModal(false);
    setImportFile(null);
    setParsedStudents([]);
    alert(`Successfully populated ${validRows.length} new student records to roster database.`);

    if (isAutoSave) {
      // Auto save triggered
    } else {
      onManualSave();
    }
  };

  // Filter & auto-sort students dynamically with academicYear, term support, and default alphabetical sorting
  const filteredStudents = useMemo(() => {
    const term = searchTerm?.toLowerCase() || '';
    const filtered = students.filter(std => {
      if (!std) return false;
      const fullName = `${std.firstName || ''} ${std.middleName || ''} ${std.lastName || ''}`.toLowerCase();
      const matchesSearch = fullName.includes(term) || (std.id?.toLowerCase() || '').includes(term);
      
      let matchesClass = false;
      if (userRole === 'Teacher') {
        const teacherClasses = [...assignedClasses];
        if (assignedClass && assignedClass !== 'None' && !teacherClasses.includes(assignedClass)) {
          teacherClasses.push(assignedClass);
        }
        
        if (teacherClasses.length === 0) {
          matchesClass = false; // No access if no assignments
        } else {
          matchesClass = teacherClasses.includes(std.class);
        }
      } else {
        matchesClass = selectedClass === 'All' || std.class === selectedClass;
      }

      const matchesSection = selectedSection === 'All' || std.section === selectedSection;
      const matchesYear = !selectedYear || (std.academicYear || '2026/2027') === selectedYear;
      const matchesTerm = !selectedTerm || (std.term || 'Term 1') === selectedTerm;
      return matchesSearch && matchesClass && matchesSection && matchesYear && matchesTerm;
    });

    // Default alphabetical sorting by name (A-Z)
    return filtered.sort((a, b) => {
      if (studentSortBy === 'name-desc') {
        const nameA = `${a.firstName || ''} ${a.middleName || ''} ${a.lastName || ''}`.trim().toLowerCase();
        const nameB = `${b.firstName || ''} ${b.middleName || ''} ${b.lastName || ''}`.trim().toLowerCase();
        return nameB.localeCompare(nameA);
      }
      if (studentSortBy === 'id-asc') {
        return (a.id || '').localeCompare(b.id || '');
      }
      if (studentSortBy === 'class-asc') {
        return (a.class || '').localeCompare(b.class || '');
      }
      // Default: 'name-asc' (Name A-Z)
      const nameA = `${a.firstName || ''} ${a.middleName || ''} ${a.lastName || ''}`.trim().toLowerCase();
      const nameB = `${b.firstName || ''} ${b.middleName || ''} ${b.lastName || ''}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [students, searchTerm, selectedClass, selectedSection, selectedYear, selectedTerm, userRole, assignedClass, studentSortBy]);

  // Paginated students slice for desktop UI performance with high-performance memoization
  const totalStudentsCount = filteredStudents.length;
  const totalStudentPages = useMemo(() => Math.ceil(totalStudentsCount / studentPageSize), [totalStudentsCount, studentPageSize]);
  const activeStudentPage = Math.min(Math.max(1, studentPage), totalStudentPages || 1);
  
  const paginatedStudents = useMemo(() => {
    return filteredStudents.slice((activeStudentPage - 1) * studentPageSize, activeStudentPage * studentPageSize);
  }, [filteredStudents, activeStudentPage, studentPageSize]);

  // Helper to resolve an attendance date to the matching academic year and term using calendar ranges
  const getTermAndYearForDate = (dateStr: string, cal: any) => {
    const dateTime = new Date(dateStr).getTime();
    if (isNaN(dateTime)) return null;

    for (const yearKey of Object.keys(cal.years) as AcademicYearType[]) {
      const yearConfig = cal.years[yearKey];
      const yearStart = new Date(yearConfig.startDate).getTime();
      const yearEnd = new Date(yearConfig.endDate).getTime();
      
      if (dateTime >= yearStart && dateTime <= yearEnd) {
        for (const termKey of Object.keys(yearConfig.terms) as TermType[]) {
          const termConfig = yearConfig.terms[termKey];
          const termStart = new Date(termConfig.startDate).getTime();
          const termEnd = new Date(termConfig.endDate).getTime();
          if (dateTime >= termStart && dateTime <= termEnd) {
            return { academicYear: yearKey, term: termKey };
          }
        }
        return { academicYear: yearKey, term: 'Term 1' as TermType };
      }
    }

    // Heuristic fallback if not matching any strictly configured ranges
    const date = new Date(dateStr);
    const yearNum = date.getFullYear();
    const monthNum = date.getMonth(); // 0-11
    
    let academicYear: AcademicYearType = '2026/2027';
    let term: TermType = 'Term 1';

    if (monthNum >= 8) { // Sep - Dec
      academicYear = `${yearNum}/${yearNum + 1}` as AcademicYearType;
      term = 'Term 1';
    } else if (monthNum >= 0 && monthNum <= 3) { // Jan - Apr
      academicYear = `${yearNum - 1}/${yearNum}` as AcademicYearType;
      term = 'Term 2';
    } else { // May - Aug
      academicYear = `${yearNum - 1}/${yearNum}` as AcademicYearType;
      term = 'Term 3';
    }

    return { academicYear, term };
  };

  // Chronologically sorted academic terms with all relevant student data aggregated
  const chronologicalTerms = useMemo(() => {
    if (!selectedOverviewStudent) return [];

    const cal = DbController.getAcademicCalendar();
    const assessments = DbController.getStudentAcademicTrends(selectedOverviewStudent.id);
    const attendanceLogs = DbController.getStudentAttendanceHistory(selectedOverviewStudent.id);
    const behavioralRemarks = DbController.getBehavioralRemarksForStudent(selectedOverviewStudent.id);

    const termKeys = new Set<string>();

    assessments.forEach(a => {
      if (a.academicYear && a.term) {
        termKeys.add(`${a.academicYear}||${a.term}`);
      }
    });

    behavioralRemarks.forEach(r => {
      if (r.academicYear && r.term) {
        termKeys.add(`${r.academicYear}||${r.term}`);
      }
    });

    attendanceLogs.forEach(log => {
      const period = getTermAndYearForDate(log.date, cal);
      if (period) {
        termKeys.add(`${period.academicYear}||${period.term}`);
      }
    });

    const parsedPeriods = Array.from(termKeys).map(key => {
      const [academicYear, term] = key.split('||') as [AcademicYearType, TermType];
      return { academicYear, term };
    });

    return parsedPeriods.sort((a, b) => {
      if (a.academicYear !== b.academicYear) {
        return b.academicYear.localeCompare(a.academicYear);
      }
      return b.term.localeCompare(a.term);
    });
  }, [selectedOverviewStudent, showOverviewModal]);

  const isAllSelected = paginatedStudents.length > 0 && paginatedStudents.every(s => selectedStudentIds.includes(s.id));

  const selectedStudentsForIdCards = useMemo(() => {
    return filteredStudents.filter(s => selectedStudentIds.includes(s.id));
  }, [filteredStudents, selectedStudentIds]);
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedStudentIds(prev => prev.filter(id => !paginatedStudents.some(s => s.id === id)));
    } else {
      setSelectedStudentIds(prev => {
        const union = new Set([...prev, ...paginatedStudents.map(s => s.id)]);
        return Array.from(union);
      });
    }
  };

  const handleBulkDeleteStudents = () => {
    if (selectedStudentIds.length === 0) return;
    
    setConfirmModal({
      isOpen: true,
      title: "CRITICAL: Bulk Delete Selected Students?",
      message: `Are you absolutely sure you want to delete the ${selectedStudentIds.length} selected student profiles? This is a system-wide deletion that will also cascade delete all their bills, ledger items, attendance, and grades. This action is irreversible.`,
      confirmText: `Delete ${selectedStudentIds.length} Record${selectedStudentIds.length > 1 ? 's' : ''}`,
      danger: true,
      onConfirm: () => {
        selectedStudentIds.forEach(id => {
          DbController.deleteStudent(id);
        });
        setSelectedStudentIds([]);
        onRefresh();
        showToast(`Successfully bulk-deleted ${selectedStudentIds.length} student records.`, "success");
      }
    });
  };

  const handleExportCSV = () => {
    const headers = [
      'Student ID', 'First Name', 'Middle Name', 'Last Name', 'Class', 'Gender',
      'Date of Birth', 'Place of Birth', 'Status', 'Section', 'Nationality',
      'Residential Address', 'Ghana Post Address',
      "Mother's Full Name", "Mother's Telephone", "Mother's Occupation", "Mother's Vital Status",
      "Father's Full Name", "Father's Telephone", "Father's Occupation", "Father's Vital Status",
      'Guardian Name', 'Guardian Telephone', 'Guardian Occupation', 
      'Formal School', 'Medical Condition', 'Medical Notes',
      'Academic Year', 'Academic Term', 'Created At'
    ];
    
    const csvRows = [headers.join(',')];
    
    for (const std of filteredStudents) {
      const conditionDisplay = std.medicalCondition === 'Other (Specify condition)' 
        ? (std.medicalConditionOther || 'Other') 
        : (std.medicalCondition || 'None');
      const values = [
        std.id,
        std.firstName,
        std.middleName || '',
        std.lastName,
        std.class,
        std.gender,
        std.dateOfBirth,
        std.placeOfBirth,
        std.status,
        std.section || 'None',
        std.nationality,
        std.residentialAddress || '',
        std.ghanaPostGps || '',
        std.motherName || '',
        std.motherTelephone || '',
        std.motherOccupation || '',
        std.motherStatus || 'Living',
        std.fatherName || '',
        std.fatherTelephone || '',
        std.fatherOccupation || '',
        std.fatherStatus || 'Living',
        std.guardianName,
        std.guardianTelephone,
        std.guardianOccupation,
        std.formerSchool || '',
        conditionDisplay,
        std.medicalNotes || '',
        std.academicYear || '2026/2027',
        std.term || 'Term 1',
        std.createdAt
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
    const classSuffix = selectedClass === 'All' ? 'All_Classes' : selectedClass.replace(/\s+/g, '_');
    link.setAttribute("download", `Student_Database_${classSuffix}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenAdd = () => {
    setFormState({ 
      ...INITIAL_FORM, 
      id: 'ST' + Math.floor(100000 + Math.random() * 90000),
      class: userRole === 'Teacher' && assignedClass && assignedClass !== 'None' ? assignedClass : 'Basic 1',
      academicYear: selectedYear || '2026/2027',
      term: selectedTerm || 'Term 1'
    });
    setIsEditing(false);
    setShowFormModal(true);
  };

  const handleOpenEdit = (student: Student) => {
    setFormState({ ...student });
    setIsEditing(true);
    setShowFormModal(true);
  };

  const handleOpenIdCard = (student: Student) => {
    setSelectedIdCardStudent(student);
    setShowIdCardModal(true);
  };

  const handleOpenRemarks = (student: Student) => {
    setSelectedRemarkStudent(student);
    setShowRemarksModal(true);
    setNewRemarkText('');
    setNewRemarkCategory('Conduct');
  };

  const handleOpenOverview = (student: Student) => {
    setSelectedOverviewStudent(student);
    setShowOverviewModal(true);
    setOverviewTab('trends');
  };

  const handleGenerateTranscript = (student: Student, lang: 'en' | 'twi' = transcriptLanguage) => {
    setTranscriptLanguage(lang);
    const dict = TRANSCRIPT_DICTIONARY[lang];
    const assessments = DbController.getStudentAcademicTrends(student.id);
    const schoolInfo = DbController.getSchoolInfo();
    
    if (assessments.length === 0) {
      triggerToast("No academic records found to generate a transcript.", "info");
      return;
    }

    const allAttendance = DbController.getAllAttendance().filter(a => a.studentId === student.id);
    const totalValidDays = allAttendance.filter(a => a.status !== 'Holiday' && a.status !== 'Unmarked').length;
    const presentDays = allAttendance.filter(a => a.status === 'Present').length;
    const attendancePercentage = totalValidDays > 0 ? (presentDays / totalValidDays) * 100 : 100;

    const cumulativeGpa = assessments.reduce((sum: number, a: any) => sum + a.totalScore, 0) / assessments.length;

    // Group assessments by year and term
    const grouped = assessments.reduce((acc: any, curr) => {
      const key = `${curr.academicYear} - ${curr.term}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(curr);
      return acc;
    }, {});

    const sortedTerms = Object.keys(grouped).sort((a, b) => {
        const [yearA, termA] = a.split(' - ');
        const [yearB, termB] = b.split(' - ');
        if (yearA !== yearB) return yearA.localeCompare(yearB);
        return termA.localeCompare(termB);
    });

    let html = `
      <div class="transcript-print-page" style="font-family: 'Inter', sans-serif; color: #1e293b; position: relative;">
        ${getWatermarkHtml(schoolInfo.crestUrl, 420)}
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; position: relative; z-index: 10;">
          <div>
            <h2 style="font-size: 24px; font-weight: 900; margin: 0; color: #0f172a; text-transform: uppercase;">${dict.officialTranscript}</h2>
            <p style="font-size: 14px; color: #64748b; margin: 5px 0 0 0;">${dict.academicRecord}</p>
          </div>
          <div style="text-align: right;">
            <p style="font-size: 11px; font-weight: 700; color: #94a3b8; margin: 0; text-transform: uppercase; letter-spacing: 0.05em;">${dict.transcriptId}</p>
            <p style="font-size: 14px; font-weight: 700; color: #0f172a; margin: 0;">TR-${student.id.split('-').pop()}-${new Date().getFullYear()}</p>
          </div>
        </div>

        <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; border: 1px solid #e2e8f0;">
          <div>
            <p style="font-size: 10px; font-weight: 700; color: #94a3b8; margin: 0; text-transform: uppercase; letter-spacing: 0.05em;">${dict.studentName}</p>
            <p style="font-size: 16px; font-weight: 800; color: #0f172a; margin: 2px 0 0 0;">${student.firstName} ${student.middleName ? student.middleName + ' ' : ''}${student.lastName}</p>
          </div>
          <div>
            <p style="font-size: 10px; font-weight: 700; color: #94a3b8; margin: 0; text-transform: uppercase; letter-spacing: 0.05em;">${dict.studentId}</p>
            <p style="font-size: 16px; font-weight: 800; color: #0f172a; margin: 2px 0 0 0;">${student.id}</p>
          </div>
          <div>
            <p style="font-size: 10px; font-weight: 700; color: #94a3b8; margin: 0; text-transform: uppercase; letter-spacing: 0.05em;">${dict.classLevel}</p>
            <p style="font-size: 14px; font-weight: 700; color: #334155; margin: 2px 0 0 0;">${student.class} (${student.section || 'N/A'})</p>
          </div>
          <div>
            <p style="font-size: 10px; font-weight: 700; color: #94a3b8; margin: 0; text-transform: uppercase; letter-spacing: 0.05em;">${dict.genderStatus}</p>
            <p style="font-size: 14px; font-weight: 700; color: #334155; margin: 2px 0 0 0;">${student.gender} • ${student.status}</p>
          </div>
        </div>

        <div>
          ${sortedTerms.map(termKey => {
            const termAssessments = grouped[termKey];
            const avg = termAssessments.reduce((sum: number, a: any) => sum + a.totalScore, 0) / termAssessments.length;
            
            return `
              <div style="margin-bottom: 35px; page-break-inside: avoid;">
                <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px;">
                  <h3 style="font-size: 16px; font-weight: 800; color: #0f172a; margin: 0;">${termKey}</h3>
                  <p style="font-size: 12px; font-weight: 700; color: #4f46e5; margin: 0;">${dict.termAverage}: ${avg.toFixed(1)}%</p>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                  <thead>
                    <tr style="background-color: #f1f5f9;">
                      <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: left; color: #475569; text-transform: uppercase; letter-spacing: 0.02em;">${dict.subject}</th>
                      <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; color: #475569; text-transform: uppercase; letter-spacing: 0.02em;">${dict.classScore}</th>
                      <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; color: #475569; text-transform: uppercase; letter-spacing: 0.02em;">${dict.examScore}</th>
                      <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; color: #475569; text-transform: uppercase; letter-spacing: 0.02em;">${dict.total}</th>
                      <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; color: #475569; text-transform: uppercase; letter-spacing: 0.02em;">${dict.grade}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${termAssessments.map((a: any) => `
                      <tr>
                        <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: 600; color: #1e293b;">${a.subject}</td>
                        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; color: #475569;">${a.classScore50}</td>
                        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; color: #475569;">${a.examScore50}</td>
                        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: 700; color: #0f172a;">${a.totalScore}%</td>
                        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: 800; color: ${a.totalScore >= 80 ? '#059669' : a.totalScore >= 50 ? '#4f46e5' : '#e11d48'}">${a.gradeLevel}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `;
          }).join('')}
        </div>

        <div style="background-color: #0f172a; color: white; border-radius: 12px; padding: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 20px; margin-top: 40px; margin-bottom: 40px; page-break-inside: avoid;">
          <div style="text-align: center; border-right: 1px solid rgba(255,255,255,0.1);">
            <p style="font-size: 10px; font-weight: 700; color: #94a3b8; margin: 0; text-transform: uppercase; letter-spacing: 0.1em;">${dict.cumulativeAverage}</p>
            <p style="font-size: 24px; font-weight: 900; color: white; margin: 5px 0 0 0;">${cumulativeGpa.toFixed(1)}%</p>
          </div>
          <div style="text-align: center;">
            <p style="font-size: 10px; font-weight: 700; color: #94a3b8; margin: 0; text-transform: uppercase; letter-spacing: 0.1em;">${dict.overallAttendance}</p>
            <p style="font-size: 24px; font-weight: 900; color: white; margin: 5px 0 0 0;">${attendancePercentage.toFixed(1)}%</p>
          </div>
        </div>

        <div style="margin-top: 50px; border-top: 2px solid #0f172a; padding-top: 20px; page-break-inside: avoid;">
          <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 30px;">
             <div style="text-align: center; width: 200px; max-width: 100%;">
                <div style="border-bottom: 1px solid #000; height: 40px; margin-bottom: 5px;"></div>
                <p style="font-size: 10px; font-weight: 700; margin: 0; text-transform: uppercase;">${dict.principalsSignature}</p>
             </div>
             <div style="text-align: center; width: 200px;">
                <div style="border-bottom: 1px solid #000; height: 40px; margin-bottom: 5px;"></div>
                <p style="font-size: 10px; font-weight: 700; margin: 0; text-transform: uppercase;">${dict.schoolStamp}</p>
             </div>
          </div>
        </div>
      </div>
    `;

    DbController.writeActivityLog('Print Transcript Generated', `Generated transcript for student ${student.firstName} ${student.lastName} (ID: ${student.id}).`, 'low');
    setTranscriptHtml(html);
    setTranscriptTitle(`${student.firstName} ${student.lastName} - ${dict.officialTranscript}`);
    setShowTranscriptPrint(true);
  };

  const handleSaveRemark = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedRemarkStudent || !newRemarkText.trim()) return;

    const teacher = DbController.getTeachers().find(t => t.email === DbController.getCurrentUser()?.email);

    const remark: BehavioralRemark = {
      id: 'BR' + Math.floor(100000 + Math.random() * 90000),
      studentId: selectedRemarkStudent.id,
      teacherId: teacher?.id || 'T_SYSTEM',
      teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : (DbController.getCurrentUser()?.name || 'Teacher'),
      category: newRemarkCategory,
      remark: newRemarkText.trim(),
      date: new Date().toISOString(),
      academicYear: selectedRemarkStudent.academicYear || selectedYear || '2026/2027',
      term: selectedRemarkStudent.term || selectedTerm || 'Term 1'
    };

    DbController.saveBehavioralRemark(remark);
    setNewRemarkText('');
    onRefresh();
  };

  const handleDeleteRemark = (remarkId: string) => {
    if (window.confirm("Are you sure you want to delete this behavioral remark entry?")) {
      DbController.deleteBehavioralRemark(remarkId);
      onRefresh();
    }
  };

  const handleDelete = (studentId: string) => {
    setStudentToDelete(studentId);
    setShowConfirmModal(true);
  };

  const confirmDelete = () => {
    if (studentToDelete) {
      DbController.deleteStudent(studentToDelete);
      onRefresh();
      setShowConfirmModal(false);
      setStudentToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowConfirmModal(false);
    setStudentToDelete(null);
  };

  const handleClearInputs = () => {
    setFormState({ ...INITIAL_FORM });
    alert("Student Profile input form fields cleared.");
  };

  const handleDeleteActiveSelection = () => {
    if (formState.id) {
      setConfirmModal({
        isOpen: true,
        title: "Delete Student Profile?",
        message: `Are you sure you want to permanently delete student profile for "${formState.firstName} ${formState.lastName}"? All grades, attendance records and fee history for this student will be lost.`,
        confirmText: "Delete Profile",
        danger: true,
        onConfirm: () => {
          DbController.deleteStudent(formState.id!);
          setFormState({ ...INITIAL_FORM });
          setIsEditing(false);
          setShowFormModal(false);
          onRefresh();
          showToast("Student profile successfully deleted.", "success");
        }
      });
    } else if (students.length > 0) {
      const first = students[0];
      setConfirmModal({
        isOpen: true,
        title: "Delete Student Profile?",
        message: `No active student form is selected. Do you want to delete the first student in the directory: "${first.firstName} ${first.lastName}"?`,
        confirmText: "Delete First Student",
        danger: true,
        onConfirm: () => {
          DbController.deleteStudent(first.id);
          onRefresh();
          showToast(`Deleted ${first.firstName} ${first.lastName} profile.`, "success");
        }
      });
    } else {
      showToast("No students exist to delete.", "error");
    }
  };

  const handleDeleteAllStudents = () => {
    setConfirmModal({
      isOpen: true,
      title: "CRITICAL: Wipe All Student Registers?",
      message: "Are you absolutely sure you want to delete ALL students from the system? This is a system-wide wipe which will also cascade delete all their bills, ledger items, attendance, and grades. This action is irreversible.",
      confirmText: "Wipe All Student Data",
      danger: true,
      onConfirm: () => {
        DbController.clearAllStudents();
        DbController.clearAllAssessments();
        DbController.clearAllStudentFeeBills();
        onRefresh();
        showToast("Successfully purged all student rosters, fee ledgers and grade registry entries.", "success");
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

  const handleSaveSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formState.firstName || !formState.lastName || !formState.class || !formState.dateOfBirth) {
      alert("Please populate all required fields (*)");
      return;
    }

    // If user typed a new section name into the input, auto-save and apply it
    let activeSection = (formState.section || 'None') as SectionType;
    if (newSectionName.trim()) {
      const trimmed = newSectionName.trim();
      const updated = DbController.saveCustomSection(trimmed);
      setSectionsList(updated);
      activeSection = trimmed as SectionType;
      setNewSectionName('');
      setShowAddSectionInput(false);
    }
    if (activeSection === '__CREATE_NEW__' || activeSection === '__MANAGE_SECTIONS__') {
      activeSection = 'None';
    }

    const payload: Student = {
      id: formState.id || 'ST' + Math.floor(100000 + Math.random() * 90000),
      firstName: formState.firstName,
      middleName: formState.middleName || '',
      lastName: formState.lastName,
      class: formState.class as ClassType,
      gender: formState.gender as 'Male' | 'Female',
      dateOfBirth: formState.dateOfBirth,
      placeOfBirth: formState.placeOfBirth || '',
      status: formState.status as 'Day' | 'Boarder',
      section: activeSection,
      nationality: formState.nationality || 'Ghanaian',
      guardianName: formState.guardianName || '',
      guardianTelephone: formState.guardianTelephone || '',
      guardianOccupation: formState.guardianOccupation || '',
      guardianEmail: formState.guardianEmail || '',
      email: formState.email || '',
      residentialAddress: formState.residentialAddress || '',
      ghanaPostGps: formState.ghanaPostGps?.trim() || '',
      motherName: formState.motherName?.trim() || '',
      motherTelephone: formState.motherTelephone?.trim() || '',
      motherOccupation: formState.motherOccupation?.trim() || '',
      motherStatus: formState.motherStatus || 'Alive',
      fatherName: formState.fatherName?.trim() || '',
      fatherTelephone: formState.fatherTelephone?.trim() || '',
      fatherOccupation: formState.fatherOccupation?.trim() || '',
      fatherStatus: formState.fatherStatus || 'Alive',
      photoUrl: formState.photoUrl || '',
      academicYear: formState.academicYear || selectedYear || '2026/2027',
      term: formState.term || selectedTerm || 'Term 1',
      createdAt: formState.createdAt || new Date().toISOString(),
      formerSchool: formState.formerSchool?.trim() || '',
      medicalCondition: formState.medicalCondition || 'None',
      medicalConditionOther: formState.medicalConditionOther?.trim() || '',
      medicalNotes: formState.medicalNotes?.trim() || ''
    };

    // Save immediately as requested
    DbController.saveStudent(payload);
    onRefresh();
    
    if (isAutoSave) {
      // Auto save feedback
    } else {
      onManualSave();
    }

    triggerToast(isEditing ? `Successfully updated student record for ${payload.firstName} ${payload.lastName}.` : `Successfully enrolled student ${payload.firstName} ${payload.lastName} and secured record with client-side AES encryption.`, "success");
    setPendingStudent(null);
    setShowFormModal(false);
  };

  const handleConfirmSave = () => {
    // This is now integrated into handleSaveSubmit for immediate action
    if (!pendingStudent) return;
    DbController.saveStudent(pendingStudent);
    onRefresh();
    setShowFormModal(false);
    
    if (isAutoSave) {
      // Auto save triggered
    } else {
      onManualSave();
    }

    showToast(isEditing ? `Successfully updated student record for ${pendingStudent.firstName} ${pendingStudent.lastName}.` : `Successfully enrolled student ${pendingStudent.firstName} ${pendingStudent.lastName} and secured record with client-side AES encryption.`, "success");
    setPendingStudent(null);
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

  const handlePrintIdCard = () => {
    if (!selectedIdCardStudent) return;
    try {
      window.print();
    } catch (e) {
      console.warn("Direct print restricted inside sandbox iframe:", e);
      setPrintBlocked(true);
    }
  };

  const handlePrintBulkIdCards = () => {
    if (selectedStudentIds.length === 0) return;
    try {
      window.print();
    } catch (e) {
      console.warn("Direct print restricted inside sandbox iframe:", e);
      setPrintBlocked(true);
    }
  };

  const handlePrintQrCode = () => {
    if (!selectedQrStudent) return;
    const qrElement = document.getElementById('student-qr-print-area');
    if (!qrElement) return;

    window.print();
  };

  const handleShareParentLinkWhatsApp = (student: any) => {
    setWhatsappShareStudent(student);
    setIndividualWhatsAppTemplate('FEES_REMINDER');
  };

  const hasAnyAssignment = (assignedClasses.length > 0) || (assignedSubjects.length > 0) || (assignedClass && assignedClass !== 'None');

  if (userRole === 'Teacher' && !hasAnyAssignment) {
    return (
      <div className="bg-amber-50/50 border border-amber-200 text-amber-800 p-8 rounded-2xl text-center space-y-4 max-w-xl mx-auto my-12 shadow-sm">
        <ShieldAlert size={48} className="text-amber-500 mx-auto animate-bounce" />
        <h3 className="font-bold text-lg">No Class Level Assigned</h3>
        <p className="text-sm text-amber-700 leading-relaxed">
          You are authenticated as a school educator, but you have not yet been assigned to a specific class level by the Headteacher.
        </p>
        <p className="text-xs text-amber-600 font-mono">
          Please contact your Headteacher to assign you to a specific class level (e.g. Basic 2 or Basic 8) in the "Teacher Profiles" directory.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      
      {/* Sub-tab Navigation */}
      <div className="flex flex-wrap items-center gap-y-2 gap-x-4 sm:gap-x-6 border-b border-slate-200 no-print">
        <button
          onClick={() => setStudentsSubTab('roster')}
          className={`pb-3 text-[11px] font-bold uppercase tracking-widest border-b-2 transition cursor-pointer ${studentsSubTab === 'roster' ? 'border-slate-800 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          <div className="flex items-center gap-2">
            <Users size={14} />
            Student Directory
          </div>
        </button>
        <button
          onClick={() => setStudentsSubTab('overview')}
          className={`pb-3 text-[11px] font-bold uppercase tracking-widest border-b-2 transition cursor-pointer ${studentsSubTab === 'overview' ? 'border-slate-800 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          <div className="flex items-center gap-2">
            <TrendingUp size={14} />
            Class Analytics Overview
          </div>
        </button>
      </div>

      <AnimatePresence>
        {studentsSubTab === 'roster' ? (
          <motion.div
            key="roster"
            initial={{ opacity: 0, y: 12, scale: 0.995 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.995 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
      {/* Registration Summary Cards */}
      <div className="grid gap-4 mb-4 no-print" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Total Enrollment</p>
            <h3 className="text-2xl font-black text-slate-900">{students.length}</h3>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
            <Users size={20} />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Gender Split</p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="text-sm font-bold text-slate-700">{students.filter(s => s.gender === 'Male').length} M</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-pink-500"></span>
                <span className="text-sm font-bold text-slate-700">{students.filter(s => s.gender === 'Female').length} F</span>
              </div>
            </div>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
            <UserCheck size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Pending Requests</p>
            <h3 className="text-2xl font-black text-slate-900">0</h3>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-full">
            <UserPlus size={20} />
          </div>
        </div>
      </div>

      {/* Control ribbon workspace */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm no-print">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-grow sm:flex-grow-0">
            <Search className="absolute left-2.5 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search student or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-60 text-xs pl-8 pr-10 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
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
          
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            disabled={userRole === 'Teacher'}
            className="text-xs px-2.5 py-2 border border-slate-200 rounded-lg bg-white disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
          >
            {userRole === 'Teacher' ? (
              <option value={assignedClass || 'None'}>{assignedClass || 'None'}</option>
            ) : (
              <>
                <option value="All">All Classes</option>
                {CLASSES.map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </>
            )}
          </select>

          <select
            value={selectedSection}
            onChange={(e) => {
              if (e.target.value === '__MANAGE__') {
                setShowSectionManagerModal(true);
              } else {
                setSelectedSection(e.target.value);
              }
            }}
            className="text-xs px-2.5 py-2 border border-slate-200 rounded-lg bg-white"
          >
            <option value="All">All Sections</option>
            {sectionsList.map(sec => (
              <option key={sec} value={sec}>{sec === 'None' ? 'None (No Section)' : sec}</option>
            ))}
            <option disabled className="text-slate-300">──────────</option>
            <option value="__MANAGE__" className="text-indigo-600 font-bold bg-indigo-50">
              ⚙️ Manage / Remove Sections...
            </option>
          </select>

          {selectedYear && setSelectedYear && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value as AcademicYearType)}
              className="text-xs px-2.5 py-2 border border-slate-200 rounded-lg bg-white font-medium"
            >
              {ACADEMIC_YEARS.map(yr => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          )}

          {selectedTerm && setSelectedTerm && (
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value as TermType)}
              className="text-xs px-2.5 py-2 border border-slate-200 rounded-lg bg-white font-medium"
            >
              {TERMS.map(tm => (
                <option key={tm} value={tm}>{tm}</option>
              ))}
            </select>
          )}

          <select
            value={studentSortBy}
            onChange={(e) => setStudentSortBy(e.target.value as any)}
            className="text-xs px-2.5 py-2 border border-slate-200 rounded-lg bg-white font-medium text-slate-700 cursor-pointer"
            title="Sort student list table"
          >
            <option value="name-asc">Sort: Name (A-Z)</option>
            <option value="name-desc">Sort: Name (Z-A)</option>
            <option value="id-asc">Sort: Student ID</option>
            <option value="class-asc">Sort: Class</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 border border-emerald-600 text-white hover:bg-emerald-700 active:translate-y-0.5 transition text-xs font-semibold rounded-lg cursor-pointer shadow-xs"
            title="Export filtered/all records to a CSV spreadsheet"
          >
            <FileSpreadsheet size={15} />
            <span className="hidden sm:inline">Export to CSV</span>
            <span className="sm:hidden">Export</span>
          </button>
          {isAdminOrHead && (
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 border border-blue-600 text-white hover:bg-blue-700 active:translate-y-0.5 transition text-xs font-semibold rounded-lg cursor-pointer shadow-xs"
              title="Import student records from a formatted CSV or JSON file"
            >
              <Upload size={15} />
              <span className="hidden sm:inline">Bulk Import (CSV/JSON)</span>
              <span className="sm:hidden">Import</span>
            </button>
          )}
          <button
            onClick={handleOpenBulkQrModal}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 border border-indigo-600 text-white hover:bg-indigo-700 active:translate-y-0.5 transition text-xs font-semibold rounded-lg cursor-pointer shadow-xs"
            title="Generate and bulk-print student QR codes"
          >
            <QrCode size={15} />
            <span className="hidden sm:inline">Bulk QR Codes</span>
            <span className="sm:hidden">QR Codes</span>
          </button>
          {(userRole === 'Admin' || userRole === 'Headteacher' || userRole === 'Teacher') && (
            <button
              onClick={handleOpenBulkWhatsAppModal}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 border border-emerald-600 text-white hover:bg-emerald-700 active:translate-y-0.5 transition text-xs font-semibold rounded-lg cursor-pointer shadow-xs"
              title="Send bulk WhatsApp notifications to parents"
            >
              <Share2 size={15} />
              <span className="hidden sm:inline">Bulk WhatsApp</span>
              <span className="sm:hidden">WhatsApp</span>
            </button>
          )}
          <button
            onClick={() => setShowPdfGuide(!showPdfGuide)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-900 text-white hover:bg-slate-800 active:translate-y-0.5 transition text-xs font-semibold rounded-lg cursor-pointer"
          >
            <Eye size={15} />
            <span className="hidden sm:inline">Toggle Preview Mode</span>
            <span className="sm:hidden">Preview</span>
          </button>
          
          <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            <button
              type="button"
              onClick={() => setDirectoryView('grid')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                directoryView === 'grid'
                  ? 'bg-white text-slate-850 shadow-2xs border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-850'
              }`}
            >
              <Users size={12} />
              <span className="hidden sm:inline">Cards View</span>
              <span className="sm:hidden">Cards</span>
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
              <FileSpreadsheet size={12} />
              <span className="hidden sm:inline">Table View</span>
              <span className="sm:hidden">Table</span>
            </button>
          </div>

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
            onClick={handleOpenAdd}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer active:translate-y-0.5 transition ${theme.btnColors}`}
          >
            <Plus size={16} /> Add Student
          </button>
        </div>
      </div>

      {canSelectStudents && paginatedStudents.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 no-print">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="bulk-select-students-checkbox"
              checked={isAllSelected}
              onChange={toggleSelectAll}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
            />
            <label htmlFor="bulk-select-students-checkbox" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
              Select All on Current Page ({paginatedStudents.length})
            </label>
            {selectedStudentIds.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-150 px-2 py-0.5 rounded-full font-bold font-mono">
                  {selectedStudentIds.length} Selected
                </span>
                {selectedStudentIds.length < filteredStudents.length && (
                  <button
                    type="button"
                    onClick={() => setSelectedStudentIds(filteredStudents.map(s => s.id))}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                  >
                    Select all {filteredStudents.length}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grid or Table container of student directory */}
      <div className={`${
        directoryView === 'table' ? 'block' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
      } no-print`}>
        {paginatedStudents.length === 0 ? (
          <div className="col-span-full bg-slate-50 border-2 border-dashed border-slate-200 p-12 text-center rounded-xl">
            <User size={36} className="text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-slate-700">No Student Records Found</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Create student logs to populate indexes, take grades sheets on roll, and create assessment registers.</p>
            <button
              onClick={handleOpenAdd}
              className={`mt-4 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${theme.btnColors}`}
            >
              <Plus size={14} /> Add First Student
            </button>
          </div>
        ) : directoryView === 'table' ? (
          <div className="col-span-full bg-white border border-slate-200 rounded-xl shadow-xs overflow-x-auto no-print">
            <table className="w-full text-left border-collapse text-xs font-sans min-w-[1000px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                  {canSelectStudents && (
                    <th className="py-3.5 px-4 font-bold border-b border-slate-200 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        title="Select / deselect all current students"
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="py-3.5 px-4 font-bold border-b border-slate-200 text-slate-400 text-[10px] uppercase tracking-wider font-mono">Student ID</th>
                  <th className="py-3.5 px-4 font-bold border-b border-slate-200">Full Name</th>
                  <th className="py-3.5 px-4 font-bold border-b border-slate-200">Class</th>
                  <th className="py-3.5 px-4 font-bold border-b border-slate-200">Section</th>
                  <th className="py-3.5 px-4 font-bold border-b border-slate-200">Status</th>
                  <th className="py-3.5 px-4 font-bold border-b border-slate-200">Gender</th>
                  <th className="py-3.5 px-4 font-bold border-b border-slate-200">Date of Birth</th>
                  <th className="py-3.5 px-4 font-bold border-b border-slate-200">Guardian Details</th>
                  <th className="py-3.5 px-4 font-bold border-b border-slate-200 text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedStudents.map((std, idx) => {
                  const isSelected = selectedStudentIds.includes(std.id);
                  return (
                    <tr 
                      key={std.id} 
                      className={`hover:bg-slate-50/50 transition duration-150 ${
                        isSelected ? 'bg-indigo-50/10' : ''
                      }`}
                    >
                      {canSelectStudents && (
                        <td className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedStudentIds(prev =>
                                prev.includes(std.id)
                                  ? prev.filter(id => id !== std.id)
                                  : [...prev, std.id]
                              );
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="py-3 px-4 font-mono font-bold text-slate-500">{std.id}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {std.photoUrl ? (
                              <img src={std.photoUrl} alt={std.firstName} className="w-full h-full object-cover" />
                          ) : (
                            <User size={14} className="text-slate-400" />
                          )}
                        </div>
                        <div>
                          <strong className="text-slate-900 font-semibold block">
                            {std.firstName} {std.middleName ? std.middleName + ' ' : ''}{std.lastName}
                          </strong>
                          {std.formerSchool && (
                            <div className="text-[10px] text-slate-400 truncate max-w-[180px]" title={`Formal School: ${std.formerSchool}`}>
                              Formal: {std.formerSchool}
                            </div>
                          )}
                          {std.medicalCondition && std.medicalCondition !== 'None' && (
                            <span 
                              className="inline-flex items-center gap-1 text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 mt-0.5"
                              title={std.medicalNotes ? `${std.medicalCondition}: ${std.medicalNotes}` : std.medicalCondition}
                            >
                              <Heart size={9} className="text-rose-600 fill-rose-500/30 shrink-0" />
                              <span className="truncate max-w-[130px]">
                                {std.medicalCondition === 'Other (Specify condition)' ? (std.medicalConditionOther || 'Medical Alert') : std.medicalCondition}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded text-[10px]">
                        {std.class}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                        std.section === 'Faith' ? 'bg-blue-50 text-blue-700' :
                        std.section === 'Harmony' ? 'bg-emerald-50 text-emerald-700' :
                        std.section === 'Humility' ? 'bg-amber-50 text-amber-700' :
                        'bg-purple-50 text-purple-700'
                      }`}>
                        {std.section}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        std.status === 'Boarder' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-50 text-slate-600 border border-slate-100'
                      }`}>
                        {std.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{std.gender}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">
                      <div>{std.dateOfBirth || 'N/A'}</div>
                      {std.dateOfBirth && (() => {
                        const ageObj = calculateAgeFromDob(std.dateOfBirth);
                        return ageObj ? <div className="text-[10px] font-sans font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{ageObj.formatted}</div> : null;
                      })()}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      <div className="font-semibold text-slate-800">{std.guardianName || 'N/A'}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{std.guardianTelephone || 'N/A'}</div>
                    </td>
                    <td className="py-3 px-4 text-right pr-6">
                      <div className="flex items-center justify-end gap-1.5">
                        {(userRole === 'Admin' || userRole === 'Headteacher' || userRole === 'Teacher') && (
                          <button
                            onClick={() => handleShareParentLinkWhatsApp(std)}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg cursor-pointer transition border border-emerald-200/60"
                            title="Share Student Profile & Report Link via WhatsApp"
                          >
                            <MessageSquare size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenRemarks(std)}
                          className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-850 rounded-lg cursor-pointer transition"
                          title="Behavioral Remarks"
                        >
                          <MessageSquare size={13} />
                        </button>
                        <button
                          onClick={() => handleOpenOverview(std)}
                          className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-850 rounded-lg cursor-pointer transition"
                          title="Student Performance Overview"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => handleOpenIdCard(std)}
                          className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 text-slate-400 hover:text-slate-850 rounded-lg cursor-pointer transition"
                          title="Generate ID Card"
                        >
                          <IdCard size={13} />
                        </button>
                        {isAdminOrHead && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(std)}
                              className="p-1.5 hover:bg-slate-150 text-blue-600 hover:text-blue-800 rounded-lg cursor-pointer transition"
                              title="Edit profile"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDelete(std.id)}
                              className="p-1.5 hover:bg-rose-50 text-rose-600 hover:text-rose-800 rounded-lg cursor-pointer transition"
                              title="Delete profile"
                            >
                              <Trash2 size={13} />
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
        paginatedStudents.map((std, idx) => (
            <motion.div 
              key={std.id}
              className={`bg-white border rounded-xl overflow-hidden shadow-xs hover:shadow-md transition duration-200 flex flex-col justify-between ${
                selectedStudentIds.includes(std.id) ? 'border-slate-400 bg-slate-50/50' : 'border-slate-200'
              }`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.4), ease: 'easeOut' }}
            >
              <div className="p-4 flex gap-4">
                {canSelectStudents && (
                  <div className="pt-5 shrink-0 flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.includes(std.id)}
                      onChange={() => {
                        setSelectedStudentIds(prev =>
                          prev.includes(std.id)
                            ? prev.filter(id => id !== std.id)
                            : [...prev, std.id]
                        );
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                    />
                  </div>
                )}

                {/* Photo profile container */}
                <div className="w-16 h-16 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {std.photoUrl ? (
                    <img src={std.photoUrl} alt={std.firstName} className="w-full h-full object-cover" />
                  ) : (
                    <User size={24} className="text-slate-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-sm mb-1 ${std.status === 'Boarder' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-50 text-slate-600 border border-slate-100'}`}>
                    {std.status}
                  </span>
                  <h4 className="text-sm font-semibold text-slate-800 truncate">
                    {std.firstName} {std.middleName ? std.middleName + ' ' : ''}{std.lastName}
                  </h4>
                  <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                    ID: {std.id}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full">
                      {std.class}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${std.section === 'Faith' ? 'bg-blue-50 text-blue-700' : std.section === 'Harmony' ? 'bg-emerald-50 text-emerald-700' : std.section === 'Humility' ? 'bg-amber-50 text-amber-700' : 'bg-purple-50 text-purple-700'}`}>
                      {std.section}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-semibold mt-1 font-mono">
                    Session: {std.academicYear || '2026/2027'} • {std.term || 'Term 1'}
                  </div>
                  {std.formerSchool && (
                    <div className="text-[9.5px] text-slate-400 truncate mt-1" title={`Formal School: ${std.formerSchool}`}>
                      <span className="font-semibold text-slate-500">Formal:</span> {std.formerSchool}
                    </div>
                  )}
                  {std.medicalCondition && std.medicalCondition !== 'None' && (
                    <div className="mt-1.5">
                      <span 
                        className="inline-flex items-center gap-1 text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200"
                        title={std.medicalNotes ? `${std.medicalCondition}: ${std.medicalNotes}` : std.medicalCondition}
                      >
                        <Heart size={9} className="text-rose-600 fill-rose-500/30 shrink-0" />
                        <span className="truncate max-w-[140px]">
                          {std.medicalCondition === 'Other (Specify condition)' ? (std.medicalConditionOther || 'Medical Alert') : std.medicalCondition}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Guard details / actions */}
              <div className="bg-slate-50 px-4 py-2 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between items-center">
                <div className="truncate pr-4 flex items-center gap-1">
                  <PhoneCall size={12} className="text-slate-400 flex-shrink-0" />
                  <span className="truncate">{std.guardianName || 'Guardian'}: {std.guardianTelephone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedQrStudent(std);
                      setShowQrModal(true);
                    }}
                    className="p-1 hover:bg-emerald-50 hover:text-emerald-600 rounded text-slate-600 cursor-pointer transition"
                    title="Generate QR Code Portal Link"
                  >
                    <QrCode size={12} />
                  </button>
                  <button
                    onClick={() => handleShareParentLinkWhatsApp(std)}
                    className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded cursor-pointer transition border border-emerald-200/50"
                    title="Share Student Profile & Report Link via WhatsApp"
                  >
                    <MessageSquare size={12} />
                  </button>
                  <button
                    onClick={() => handleOpenRemarks(std)}
                    className="p-1 hover:bg-amber-50 hover:text-amber-600 rounded text-slate-600 cursor-pointer transition"
                    title="Behavioral Remarks"
                  >
                    <MessageSquare size={12} />
                  </button>
                  <button
                    onClick={() => handleOpenOverview(std)}
                    className="p-1 hover:bg-blue-50 hover:text-blue-600 rounded text-slate-600 cursor-pointer transition"
                    title="Student Performance Overview"
                  >
                    <Eye size={12} />
                  </button>
                  <button
                    onClick={() => handleOpenIdCard(std)}
                    className="p-1 hover:bg-indigo-50 hover:text-indigo-600 rounded text-slate-600 cursor-pointer transition"
                    title="Generate ID Card"
                  >
                    <IdCard size={12} />
                  </button>
                  <button
                    onClick={() => handleOpenEdit(std)}
                    className="p-1 hover:bg-slate-200 rounded text-slate-600 cursor-pointer transition"
                    title="Edit profile"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => handleDelete(std.id)}
                    className="p-1 hover:bg-red-50 hover:text-red-600 rounded text-slate-600 cursor-pointer transition"
                    title="Delete profile"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

            </motion.div>
          ))
        )}
      </div>

      {/* Student pagination controls */}
      {filteredStudents.length > 0 && (
        <div id="student-pagination-bar" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 mt-2 bg-white border border-slate-200 rounded-xl no-print shadow-2xs">
          <div className="text-xs text-slate-500 font-sans">
            Showing <span className="font-semibold text-slate-700">{(activeStudentPage - 1) * studentPageSize + 1}</span> to{' '}
            <span className="font-semibold text-slate-700">{Math.min(activeStudentPage * studentPageSize, totalStudentsCount)}</span> of{' '}
            <span className="font-semibold text-slate-700">{totalStudentsCount}</span> student records
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Show</span>
              <select
                value={studentPageSize}
                onChange={(e) => {
                  setStudentPageSize(Number(e.target.value));
                  setStudentPage(1);
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
                onClick={() => setStudentPage(1)}
                disabled={activeStudentPage === 1}
                className="p-1 px-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition text-xs font-semibold cursor-pointer disabled:cursor-not-allowed"
                title="First Page"
              >
                First
              </button>
              <button
                type="button"
                onClick={() => setStudentPage(p => Math.max(1, p - 1))}
                disabled={activeStudentPage === 1}
                className="p-1 px-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14} />
                <span>Prev</span>
              </button>
              
              {/* Numeric Page indicators */}
              {(() => {
                const pageRange = [];
                const maxButtons = 5;
                let startPage = Math.max(1, activeStudentPage - 2);
                let endPage = Math.min(totalStudentPages, startPage + maxButtons - 1);
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
                    onClick={() => setStudentPage(p)}
                    className={`w-7 h-7 flex items-center justify-center text-xs font-bold rounded-lg border transition cursor-pointer ${p === activeStudentPage ? `${theme.primaryBg || 'bg-slate-900'} text-white border-transparent` : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    {p}
                  </button>
                ));
              })()}
              
              <button
                type="button"
                onClick={() => setStudentPage(p => Math.min(totalStudentPages, p + 1))}
                disabled={activeStudentPage === totalStudentPages}
                className="p-1 px-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                onClick={() => setStudentPage(totalStudentPages)}
                disabled={activeStudentPage === totalStudentPages}
                className="p-1 px-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition text-xs font-semibold cursor-pointer disabled:cursor-not-allowed"
                title="Last Page"
              >
                Last
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPACT PRINT-ONLY SHEET (Meets date of birth, section, status print requirements perfectly!) */}
      <div className="hidden print:block font-sans max-w-6xl mx-auto p-4 bg-white text-black relative">
        <div className="absolute inset-0 z-0 pointer-events-none" dangerouslySetInnerHTML={{ __html: getWatermarkHtml(DbController.getSchoolInfo().crestUrl) }} />
        <div className="text-center pb-6 border-b-2 border-slate-900 mb-6 relative z-10">
          <h1 className="text-2xl font-bold uppercase tracking-wide">
            {DbController.getSchoolInfo().name}
          </h1>
          <p className="text-xs font-mono mt-1 italic">
            Motto: "{DbController.getSchoolInfo().motto}" | Registered Enrollment Register
          </p>
          <div className="text-[10px] text-slate-600 font-mono mt-2">
            Filter: {selectedClass === 'All' ? 'All Classes' : `Class: ${selectedClass}`} / {selectedSection === 'All' ? 'All Sections' : `Section: ${selectedSection}`} | Export On: {new Date().toLocaleDateString()}
          </div>
        </div>

        <h3 className="text-lg font-bold uppercase text-center mb-4 tracking-wider">
          Student Enrollment Roster Register
        </h3>

        <table className="w-full text-left border-collapse text-[11px] font-sans">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-800">
              <th className="py-2 px-1 border border-slate-300 font-bold">Student ID</th>
              <th className="py-2 px-1 border border-slate-300 font-bold">Student Full Name</th>
              <th className="py-2 px-1 border border-slate-300 font-bold">Class Level</th>
              <th className="py-2 px-1 border border-slate-300 font-bold">Academic Session</th>
              <th className="py-2 px-1 border border-slate-300 font-bold">Gender</th>
              <th className="py-2 px-1 border border-slate-300 font-bold">Date of Birth</th>
              <th className="py-2 px-1 border border-slate-300 font-bold">Section Assignment</th>
              <th className="py-2 px-1 border border-slate-300 font-bold">Day/Boarder</th>
              <th className="py-2 px-1 border border-slate-300 font-bold">Guardian Details</th>
              <th className="py-2 px-1 border border-slate-300 font-bold">Address</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-4 text-slate-500">No matching student profile logs available for this roster spreadsheet.</td>
              </tr>
            ) : (
              filteredStudents.map(std => (
                <tr key={std.id} className="border-b border-slate-200">
                  <td className="py-1 px-1 border border-slate-200 font-mono font-semibold">{std.id}</td>
                  <td className="py-1 px-1 border border-slate-200 font-semibold">{std.firstName} {std.middleName ? std.middleName + ' ' : ''}{std.lastName}</td>
                  <td className="py-1 px-1 border border-slate-200">{std.class}</td>
                  <td className="py-1 px-1 border border-slate-200 font-semibold font-mono">{std.academicYear || '2026/2027'} - {std.term || 'Term 1'}</td>
                  <td className="py-1 px-1 border border-slate-200">{std.gender}</td>
                  <td className="py-1 px-1 border border-slate-200 font-mono">{std.dateOfBirth}</td>
                  <td className="py-1 px-1 border border-slate-200 font-medium">{std.section}</td>
                  <td className="py-1 px-1 border border-slate-200">{std.status}</td>
                  <td className="py-1 px-1 border border-slate-200 font-sans">{std.guardianName} ({std.guardianTelephone})</td>
                  <td className="py-1 px-1 border border-slate-200 text-[10px] break-all">{std.residentialAddress}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Aggregate details footer */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-xs font-mono pt-4 border-t border-slate-300 text-center">
          <div>Total Listed Students: <strong className="text-slate-900">{filteredStudents.length}</strong></div>
          <div>Day Status: <strong>{filteredStudents.filter(s => s.status === 'Day').length}</strong></div>
          <div>Boarding Status: <strong>{filteredStudents.filter(s => s.status === 'Boarder').length}</strong></div>
        </div>
        </div>
      </motion.div>
      ) : (
        <motion.div
          key="overview"
          initial={{ opacity: 0, y: 12, scale: 0.995 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.995 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-6"
        >
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 leading-tight">Class Analytics Dashboard</h3>
              <p className="text-xs text-slate-500 font-medium">Condensed summary of academic trends & attendance for {selectedClass === 'All' ? 'All Students' : selectedClass}</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Focus Student:</div>
              <select
                value={selectedOverviewStudent?.id || ''}
                onChange={(e) => {
                  const student = students.find(s => s.id === e.target.value);
                  if (student) setSelectedOverviewStudent(student);
                }}
                className="text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 font-bold focus:outline-none focus:ring-1 focus:ring-slate-400 min-w-[200px]"
              >
                {!selectedOverviewStudent && <option value="">Select a student to view trends</option>}
                {filteredStudents.map(s => (
                  <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.id})</option>
                ))}
              </select>
            </div>
          </div>

          {selectedOverviewStudent ? (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {(() => {
                  const trends = DbController.getStudentAcademicTrends(selectedOverviewStudent.id);
                  const avgScore = trends.length > 0 ? (trends.reduce((acc, curr) => acc + curr.totalScore, 0) / trends.length).toFixed(1) : '0';
                  const bestSubject = trends.length > 0 ? [...trends].sort((a, b) => b.totalScore - a.totalScore)[0].subject : 'N/A';
                  const attendanceStats = DbController.getStudentAttendanceStats(selectedOverviewStudent.id);
                  const attendanceRate = attendanceStats.schoolOpen > 0 ? ((attendanceStats.present / attendanceStats.schoolOpen) * 100).toFixed(1) : '0';

                  return (
                    <>
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 mb-3">
                          <TrendingUp size={20} />
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Average Score</div>
                        <div className="text-2xl font-black text-slate-900">{avgScore}%</div>
                      </div>
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mb-3">
                          <Award size={20} />
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Top Subject</div>
                        <div className="text-lg font-bold text-slate-900 truncate">{bestSubject}</div>
                      </div>
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-3">
                          <Calendar size={20} />
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Attendance Rate</div>
                        <div className="text-2xl font-black text-slate-900">{attendanceRate}%</div>
                      </div>
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                        <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 mb-3">
                          <BookOpen size={20} />
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Assessments</div>
                        <div className="text-2xl font-black text-slate-900">{trends.length}</div>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Academic Progress Chart */}
                <div className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-xs space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <TrendingUp size={16} className="text-indigo-500" /> Academic Performance History
                    </h4>
                  </div>
                  <div className="h-[300px] w-full">
                    {(() => {
                      const trends = DbController.getStudentAcademicTrends(selectedOverviewStudent.id);
                      if (trends.length === 0) return <div className="h-full flex items-center justify-center text-slate-400 text-xs">No academic records yet.</div>;
                      
                      const chartData = trends.map(t => ({
                        label: `${t.term.substring(0, 6)} ${t.subject.substring(0, 5)}...`,
                        score: t.totalScore,
                        fullName: `${t.subject} (${t.term})`
                      }));

                      return (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="label" fontSize={9} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                            <YAxis domain={[0, 100]} fontSize={9} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }} />
                          </LineChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </div>
                </div>

                {/* Attendance Distribution Chart */}
                <div className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-xs space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Calendar size={16} className="text-emerald-500" /> Monthly Attendance Patterns
                  </h4>
                  <div className="h-[300px] w-full">
                    {(() => {
                      const history = DbController.getStudentAttendanceHistory(selectedOverviewStudent.id);
                      if (history.length === 0) return <div className="h-full flex items-center justify-center text-slate-400 text-xs">No attendance logs yet.</div>;
                      
                      // Process last 30 logs
                      const last30 = history.slice(-30);
                      const chartData = last30.map(h => ({
                        date: h.date,
                        status: h.status === 'Present' ? 1 : 0
                      }));

                      return (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" fontSize={8} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                            <YAxis domain={[0, 1]} ticks={[0, 1]} fontSize={9} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(val) => val === 1 ? 'P' : 'A'} />
                            <Tooltip />
                            <Bar dataKey="status" fill="#10b981" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-dashed border-slate-300 rounded-[32px] p-20 text-center space-y-4">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mx-auto">
                <Search size={40} />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-800">No Student Selected</h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                  Select a student from the dropdown above to view their graphical academic trends and attendance performance summary.
                </p>
              </div>
            </div>
          )}
        </motion.div>
      )}
      </AnimatePresence>

      {/* RICH EDIT / ADD MODAL PANEL (NO-PRINT) */}
      <AnimatePresence>
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
              className="bg-white rounded-[24px] border border-slate-100 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-hidden flex flex-col cursor-default md:my-8"
            >
            
            <div className="p-6 pb-4 bg-white border-b border-slate-100/85 flex justify-between items-center">
              <div>
                <h3 className="text-[13px] font-bold text-slate-800 uppercase tracking-widest font-sans flex items-center gap-1.5 leading-none">
                  <BadgeCheck className="text-emerald-600" size={18} />
                  {isEditing ? 'Modify Student Profile Enrolment' : 'New Student Academic Registration'}
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">Specify personal bio details and administrative records</p>
              </div>
              <button 
                onClick={() => setShowFormModal(false)}
                className="p-1 px-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSubmit} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 text-xs bg-white">
              
              {/* Photo Upload area */}
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                  {formState.photoUrl ? (
                    <img src={formState.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <User size={24} className="text-slate-300" />
                  )}
                </div>
                <div className="space-y-1.5 text-center sm:text-left">
                  <div className="font-semibold text-slate-700">Student Profile Photo</div>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded font-medium shadow-2xs transition flex items-center gap-1 cursor-pointer"
                    >
                      <Upload size={13} /> Select Local Drive
                    </button>
                    <button
                      type="button"
                      onClick={handleUrlImage}
                      className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded font-medium shadow-2xs transition flex items-center gap-1 cursor-pointer"
                    >
                      Use Image Link
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCameraOpen(true)}
                      className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded font-medium shadow-2xs transition flex items-center gap-1 cursor-pointer"
                    >
                      <Camera size={13} /> Take Live Photo
                    </button>
                    {formState.photoUrl && (
                      <button
                        type="button"
                        onClick={() => setFormState(prev => ({ ...prev, photoUrl: '' }))}
                        className="px-2 py-1 text-red-600 hover:bg-red-50 rounded font-medium transition"
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
                  <div className="text-[10px] text-slate-400">File sizes will compress to client persistent storage.</div>
                </div>
              </div>

              {/* Step 1: Personal Particulars */}
              <div className="space-y-4">
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider pb-1 border-b border-slate-100">Personal Identity Details</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">First Name *</label>
                    <input
                      type="text"
                      value={formState.firstName}
                      onChange={(e) => setFormState(prev => ({ ...prev, firstName: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400"
                      placeholder="e.g. Ama"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Middle Name</label>
                    <input
                      type="text"
                      value={formState.middleName}
                      onChange={(e) => setFormState(prev => ({ ...prev, middleName: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400"
                      placeholder="Optional"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Last Name *</label>
                    <input
                      type="text"
                      value={formState.lastName}
                      onChange={(e) => setFormState(prev => ({ ...prev, lastName: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400"
                      placeholder="e.g. Mensah"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Active Class Level *</label>
                    <select
                      value={formState.class}
                      onChange={(e) => setFormState(prev => ({ ...prev, class: e.target.value as ClassType }))}
                      disabled={userRole === 'Teacher'}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white bg-no-repeat focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                    >
                      {CLASSES.map(cls => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-slate-600 font-medium">Section Assignment</label>
                      <button
                        type="button"
                        onClick={() => setShowSectionManagerModal(true)}
                        className="text-[10px] font-bold text-slate-700 hover:text-slate-950 transition flex items-center gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200 px-2.5 py-0.5 rounded-md border border-slate-200 shadow-2xs"
                        title="Manage or delete section categories"
                      >
                        <span>Manage / Delete</span>
                      </button>
                    </div>

                    <select
                      value={formState.section || 'None'}
                      onChange={(e) => setFormState(prev => ({ ...prev, section: e.target.value as SectionType }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                    >
                      <option value="None">None (No Section Assignment)</option>
                      {sectionsList.filter(sec => sec !== 'None').map(sec => (
                        <option key={sec} value={sec}>{sec}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">
                      If school has no section assignment, select 'None'.
                    </p>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Gender *</label>
                    <select
                      value={formState.gender}
                      onChange={(e) => setFormState(prev => ({ ...prev, gender: e.target.value as 'Male' | 'Female' }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Academic Year *</label>
                    <select
                      value={formState.academicYear || '2026/2027'}
                      onChange={(e) => setFormState(prev => ({ ...prev, academicYear: e.target.value as AcademicYearType }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 font-medium"
                      required
                    >
                      {ACADEMIC_YEARS.map(yr => (
                        <option key={yr} value={yr}>{yr}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Academic Term *</label>
                    <select
                      value={formState.term || 'Term 1'}
                      onChange={(e) => setFormState(prev => ({ ...prev, term: e.target.value as TermType }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 font-medium"
                      required
                    >
                      {TERMS.map(tm => (
                        <option key={tm} value={tm}>{tm}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-slate-600 font-medium">Date of Birth *</label>
                      {formState.dateOfBirth && (() => {
                        const ageObj = calculateAgeFromDob(formState.dateOfBirth);
                        if (!ageObj) return <span className="text-[10px] text-rose-500 font-medium">Future or invalid date</span>;
                        return (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                            <Sparkles size={11} className="text-amber-500 shrink-0" />
                            <span>Age: {ageObj.formatted}</span>
                          </span>
                        );
                      })()}
                    </div>
                    <input
                      type="date"
                      value={formState.dateOfBirth}
                      onChange={(e) => setFormState(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono text-slate-800"
                      required
                    />
                    {formState.dateOfBirth ? (() => {
                      const ageObj = calculateAgeFromDob(formState.dateOfBirth);
                      if (!ageObj) return null;
                      return (
                        <div className="mt-1.5 p-2 bg-indigo-50/80 border border-indigo-100 rounded-lg flex items-center justify-between text-[11px] text-indigo-900">
                          <div className="flex items-center gap-1.5 font-medium">
                            <Calendar size={13} className="text-indigo-600 shrink-0" />
                            <span>Calculated Age: <strong className="font-extrabold text-indigo-950">{ageObj.formatted}</strong></span>
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-indigo-200/70 font-extrabold text-[9.5px] text-indigo-900 uppercase tracking-wider">
                            {ageObj.category}
                          </span>
                        </div>
                      );
                    })() : (
                      <p className="text-[10px] text-slate-400 mt-1 italic">Selecting Date of Birth will automatically calculate exact student age.</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Place of Birth</label>
                    <input
                      type="text"
                      value={formState.placeOfBirth}
                      onChange={(e) => setFormState(prev => ({ ...prev, placeOfBirth: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                      placeholder="e.g. Kumasi"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Nationality & Status</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="text"
                        value={formState.nationality}
                        onChange={(e) => setFormState(prev => ({ ...prev, nationality: e.target.value }))}
                        className="w-full px-2.5 py-2 border border-slate-200 rounded-lg focus:outline-none text-xs"
                        placeholder="e.g. Ghanaian"
                      />
                      <select
                        value={formState.status}
                        onChange={(e) => setFormState(prev => ({ ...prev, status: e.target.value as 'Day' | 'Boarder' }))}
                        className="w-full px-2 py-2 border border-slate-200 rounded-lg bg-white text-xs"
                      >
                        <option value="Day">Day</option>
                        <option value="Boarder">Boarder</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Guardian Details & Parent Information */}
              <div className="space-y-4 pt-1">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Users size={13} className="text-indigo-600" />
                    <span>Guardian / Family Contacts & Parent Info</span>
                  </h4>
                  <span className="text-[10px] text-slate-400">Parent vital status, contact details & residential locator</span>
                </div>

                {/* PARENT INFORMATION (MOTHER & FATHER) */}
                <div className="space-y-3">
                  {/* Mother's Information */}
                  <div className="p-3.5 bg-rose-50/50 rounded-xl border border-rose-100 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-950 flex items-center gap-1.5">
                        <User size={13} className="text-rose-600" />
                        Mother's Information
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setFormState(prev => ({
                            ...prev,
                            guardianName: prev.motherName || prev.guardianName,
                            guardianTelephone: prev.motherTelephone || prev.guardianTelephone,
                            guardianOccupation: prev.motherOccupation || prev.guardianOccupation
                          }));
                          triggerToast("Copied Mother's information to Primary Guardian", "info");
                        }}
                        className="text-[10px] text-rose-700 hover:text-rose-900 font-semibold cursor-pointer underline flex items-center gap-1"
                        title="Set Mother as Primary Guardian"
                      >
                        Copy to Primary Guardian
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-slate-600 text-xs font-medium mb-1">Mother's Full Name</label>
                        <input
                          type="text"
                          value={formState.motherName || ''}
                          onChange={(e) => setFormState(prev => ({ ...prev, motherName: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:outline-none focus:ring-1 focus:ring-rose-400"
                          placeholder="Mother's Full Name"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 text-xs font-medium mb-1">Telephone Contact</label>
                        <input
                          type="tel"
                          value={formState.motherTelephone || ''}
                          onChange={(e) => setFormState(prev => ({ ...prev, motherTelephone: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:outline-none focus:ring-1 focus:ring-rose-400"
                          placeholder="e.g. 0244123456"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 text-xs font-medium mb-1">Occupation</label>
                        <input
                          type="text"
                          value={formState.motherOccupation || ''}
                          onChange={(e) => setFormState(prev => ({ ...prev, motherOccupation: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:outline-none focus:ring-1 focus:ring-rose-400"
                          placeholder="e.g. Trader, Nurse"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 text-xs font-medium mb-1">Alive / Death</label>
                        <select
                          value={formState.motherStatus === 'Death' || formState.motherStatus === 'Deceased' ? 'Death' : 'Alive'}
                          onChange={(e) => setFormState(prev => ({ ...prev, motherStatus: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-rose-400"
                        >
                          <option value="Alive">Alive</option>
                          <option value="Death">Death</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Father's Information */}
                  <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                        <User size={13} className="text-blue-600" />
                        Father's Information
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setFormState(prev => ({
                            ...prev,
                            guardianName: prev.fatherName || prev.guardianName,
                            guardianTelephone: prev.fatherTelephone || prev.guardianTelephone,
                            guardianOccupation: prev.fatherOccupation || prev.guardianOccupation
                          }));
                          triggerToast("Copied Father's information to Primary Guardian", "info");
                        }}
                        className="text-[10px] text-blue-700 hover:text-blue-900 font-semibold cursor-pointer underline flex items-center gap-1"
                        title="Set Father as Primary Guardian"
                      >
                        Copy to Primary Guardian
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-slate-600 text-xs font-medium mb-1">Father's Full Name</label>
                        <input
                          type="text"
                          value={formState.fatherName || ''}
                          onChange={(e) => setFormState(prev => ({ ...prev, fatherName: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                          placeholder="Father's Full Name"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 text-xs font-medium mb-1">Telephone Contact</label>
                        <input
                          type="tel"
                          value={formState.fatherTelephone || ''}
                          onChange={(e) => setFormState(prev => ({ ...prev, fatherTelephone: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                          placeholder="e.g. 0208123456"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 text-xs font-medium mb-1">Occupation</label>
                        <input
                          type="text"
                          value={formState.fatherOccupation || ''}
                          onChange={(e) => setFormState(prev => ({ ...prev, fatherOccupation: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                          placeholder="e.g. Farmer, Engineer"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 text-xs font-medium mb-1">Alive / Death</label>
                        <select
                          value={formState.fatherStatus === 'Death' || formState.fatherStatus === 'Deceased' ? 'Death' : 'Alive'}
                          onChange={(e) => setFormState(prev => ({ ...prev, fatherStatus: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-400"
                        >
                          <option value="Alive">Alive</option>
                          <option value="Death">Death</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Primary Guardian / Emergency Contact */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Primary Guardian / Legal Contact
                    </span>
                    <span className="text-[10px] text-slate-400">Designated emergency contact & SMS recipient</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-slate-600 text-xs font-medium mb-1">Guardian Full Name</label>
                      <input
                        type="text"
                        value={formState.guardianName || ''}
                        onChange={(e) => setFormState(prev => ({ ...prev, guardianName: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none text-xs"
                        placeholder="Parent/Guardian Name"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 text-xs font-medium mb-1">Telephone Contact</label>
                      <input
                        type="tel"
                        value={formState.guardianTelephone || ''}
                        onChange={(e) => setFormState(prev => ({ ...prev, guardianTelephone: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none text-xs"
                        placeholder="Phone digits"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 text-xs font-medium mb-1">Guardian Email</label>
                      <input
                        type="email"
                        value={formState.guardianEmail || ''}
                        onChange={(e) => setFormState(prev => ({ ...prev, guardianEmail: e.target.value, email: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none text-xs"
                        placeholder="e.g. parent@email.com"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 text-xs font-medium mb-1">Occupation</label>
                      <input
                        type="text"
                        value={formState.guardianOccupation || ''}
                        onChange={(e) => setFormState(prev => ({ ...prev, guardianOccupation: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none text-xs"
                        placeholder="e.g. Merchant"
                      />
                    </div>
                  </div>
                </div>

                {/* Residential Address & Ghana Post Address */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-600 text-xs font-medium mb-1">
                      Residential Address <span className="text-[10px] text-slate-400">(Physical / Street)</span>
                    </label>
                    <input
                      type="text"
                      value={formState.residentialAddress || ''}
                      onChange={(e) => setFormState(prev => ({ ...prev, residentialAddress: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none text-xs"
                      placeholder="e.g., PLT 12 BLK B, Kumasi or 15 Independence Ave"
                    />
                    <p className="text-[9.5px] text-slate-400 mt-1">Physical street, neighborhood, town or landmark</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-slate-700 text-xs font-medium flex items-center gap-1">
                        <MapPin size={12} className="text-rose-500" />
                        <span>Ghana Post Address <span className="text-[10px] text-slate-400">(Digital Address)</span></span>
                      </label>
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                        🇬🇭 GhanaPostGPS
                      </span>
                    </div>
                    <input
                      type="text"
                      value={formState.ghanaPostGps || ''}
                      onChange={(e) => setFormState(prev => ({ ...prev, ghanaPostGps: e.target.value.toUpperCase() }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-xs uppercase"
                      placeholder="e.g., GA-183-9024 or AK-039-5028"
                    />
                    <p className="text-[9.5px] text-slate-400 mt-1">Ghana Post digital GPS property code (e.g. GA-183-9024)</p>
                  </div>
                </div>
              </div>

              {/* Step 3: Prior Education & Medical / Health Records */}
              <div className="space-y-4 pt-1">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Heart size={13} className="text-rose-500" />
                    <span>Prior School & Health / Medical Records</span>
                  </h4>
                  <span className="text-[10px] text-slate-400">Institutional health & enrollment history</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Formal School <span className="text-[10px] text-slate-400">(Former / Previous School Attended)</span>
                    </label>
                    <input
                      type="text"
                      value={formState.formerSchool || ''}
                      onChange={(e) => setFormState(prev => ({ ...prev, formerSchool: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 text-xs"
                      placeholder="e.g. Ridge Church Basic School or None"
                    />
                    <p className="text-[9.5px] text-slate-400 mt-1">Specify name of previous formal school or preschool attended</p>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Medical Records / Conditions or Allergies
                    </label>
                    <select
                      value={formState.medicalCondition || 'None'}
                      onChange={(e) => setFormState(prev => ({ ...prev, medicalCondition: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 text-xs font-medium"
                    >
                      {COMMON_MEDICAL_CONDITIONS.map((cond) => (
                        <option key={cond} value={cond}>{cond}</option>
                      ))}
                    </select>
                    <p className="text-[9.5px] text-slate-400 mt-1">Select known condition or choose 'Other' to state specific condition</p>
                  </div>
                </div>

                {/* State condition if not in list / Other */}
                {(formState.medicalCondition === 'Other (Specify condition)' || (formState.medicalCondition && formState.medicalCondition !== 'None' && !COMMON_MEDICAL_CONDITIONS.includes(formState.medicalCondition as any))) && (
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5 animate-fadeIn">
                    <label className="block text-amber-900 font-bold text-xs flex items-center gap-1.5">
                      <AlertTriangle size={13} className="text-amber-600" />
                      <span>State Specific Medical Condition or Allergy *</span>
                    </label>
                    <input
                      type="text"
                      value={formState.medicalConditionOther || ''}
                      onChange={(e) => setFormState(prev => ({ ...prev, medicalConditionOther: e.target.value }))}
                      placeholder="State student's exact medical condition, allergy, or dietary restriction..."
                      required
                      className="w-full px-3 py-2 border border-amber-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/30 text-xs font-semibold text-slate-900"
                    />
                    <p className="text-[10px] text-amber-700">This condition will be recorded in student profile and flagged on rosters.</p>
                  </div>
                )}

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Medical Notes & Emergency Instructions <span className="text-[10px] text-slate-400">(Optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={formState.medicalNotes || ''}
                    onChange={(e) => setFormState(prev => ({ ...prev, medicalNotes: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 text-xs"
                    placeholder="e.g. Inhaler kept in classroom first-aid kit; severe reaction to peanuts; doctor contact details..."
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100 bg-white">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-5 py-2.5 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl font-semibold transition cursor-pointer text-[12px] bg-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-[#059669] hover:bg-[#047857] text-white font-semibold rounded-xl shadow-xs transition cursor-pointer text-[12px]"
                >
                  <Check size={14} /> {isEditing ? 'Confirm Updates' : 'Enrol Student'}
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
                Your browser blocks direct print triggers from inside the preview iframe. To print this roster, please click the <strong className="text-slate-800">"Open in a new tab" ↗</strong> button at the top right of the application workspace first.
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
              
              <div id="students-roster-preview-card" className="relative w-full max-w-[650px] min-h-[460px] bg-white p-6 text-black border shadow-2xl text-[8px] space-y-3 font-sans rounded-none overflow-y-auto">
                {/* Transparent School Crest Watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.045] z-0">
                  {DbController.getSchoolInfo().crestUrl ? (
                    <img src={DbController.getSchoolInfo().crestUrl} className="w-[280px] h-[280px] object-contain" alt="Watermark Crest" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-[280px] h-[280px]" dangerouslySetInnerHTML={{ __html: GHANA_CREST_SVG_SIMPLE }} />
                  )}
                </div>

                <div className="relative z-10 text-center pb-3 border-b-2 border-slate-800 mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-stone-900">
                    {DbController.getSchoolInfo().name}
                  </h3>
                  <p className="text-[8px] font-mono mt-0.5 italic text-stone-600">
                    Motto: "{DbController.getSchoolInfo().motto}" | Registered Enrollment Register
                  </p>
                  <div className="text-[7px] text-slate-500 font-mono mt-1">
                    Filter: {selectedClass === 'All' ? 'All Classes' : `Class: ${selectedClass}`} / {selectedSection === 'All' ? 'All Sections' : `Section: ${selectedSection}`} | Export On: {new Date().toLocaleDateString()}
                  </div>
                </div>

                <h4 className="text-[9px] font-bold uppercase text-center mb-2 tracking-wider text-stone-900">
                  Student Enrollment Roster Register (Landscape)
                </h4>

                <table className="w-full text-left border-collapse text-[7px] font-sans">
                  <thead>
                    <tr className="bg-stone-100 border-b border-stone-800">
                      <th className="py-1 px-0.5 border border-stone-300 font-bold">ID</th>
                      <th className="py-1 px-0.5 border border-stone-300 font-bold">Full Name</th>
                      <th className="py-1 px-0.5 border border-stone-300 font-bold">Class</th>
                      <th className="py-1 px-0.5 border border-stone-300 font-bold">Session</th>
                      <th className="py-1 px-0.5 border border-stone-300 font-bold">Gender</th>
                      <th className="py-1 px-0.5 border border-stone-300 font-bold">Birth Date</th>
                      <th className="py-1 px-0.5 border border-stone-300 font-bold">Section</th>
                      <th className="py-1 px-0.5 border border-stone-300 font-bold">Status</th>
                      <th className="py-1 px-0.5 border border-stone-300 font-bold">Guardian Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-2 text-stone-400">No matching student profile logs available.</td>
                      </tr>
                    ) : (
                      filteredStudents.slice(0, 5).map(std => (
                        <tr key={std.id} className="border-b border-stone-200">
                          <td className="py-1 px-0.5 border border-stone-200 font-mono font-semibold">{std.id}</td>
                          <td className="py-1 px-0.5 border border-stone-200 font-semibold">{std.firstName} {std.lastName}</td>
                          <td className="py-1 px-0.5 border border-stone-200">{std.class}</td>
                          <td className="py-1 px-0.5 border border-stone-200 font-mono font-semibold">{std.academicYear || '2026/2027'} - {std.term || 'Term 1'}</td>
                          <td className="py-1 px-0.5 border border-stone-200">{std.gender}</td>
                          <td className="py-1 px-0.5 border border-stone-200 font-mono">{std.dateOfBirth}</td>
                          <td className="py-1 px-0.5 border border-stone-200 font-medium">{std.section}</td>
                          <td className="py-1 px-0.5 border border-stone-200">{std.status}</td>
                          <td className="py-1 px-0.5 border border-stone-200 font-sans">{std.guardianName} ({std.guardianTelephone})</td>
                        </tr>
                      ))
                    )}
                    {filteredStudents.length > 5 && (
                      <tr>
                        <td colSpan={9} className="text-center py-1 bg-stone-50 text-[7px] text-indigo-600 font-mono italic">
                          ... and {filteredStudents.length - 5} more student entries rendered inside high-fidelity PDF output stream ...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <div className="mt-4 grid grid-cols-3 gap-2 text-[8px] font-mono pt-2 border-t border-stone-300 text-center text-stone-700">
                  <div>List Total: <strong className="text-stone-950">{filteredStudents.length}</strong></div>
                  <div>Day Status: <strong>{filteredStudents.filter(s => s.status === 'Day').length}</strong></div>
                  <div>Boarders: <strong>{filteredStudents.filter(s => s.status === 'Boarder').length}</strong></div>
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
                    <p className="text-[10px] text-slate-400">Review class roster print parameters</p>
                  </div>
                </div>

                <GoogleDriveExportControl 
                  elementId="students-roster-preview-card" 
                  defaultFilename={`${selectedClass.replace(/\s+/g, '_')}_Student_Registry.pdf`}
                  isLandscape={true} 
                />

                <div className="p-3 bg-indigo-50 border border-indigo-100/70 rounded-xl space-y-1 text-indigo-950 text-[11px]">
                  <span className="font-bold">🌐 Recommended: Landscape Layout</span>
                  <p className="text-[10px] text-indigo-800/90 leading-relaxed">
                    Student lists are printed in tabular sheets. In order to fit all details beautifully, <strong>Landscape orientation</strong> in the browser's PDF options is highly recommended.
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
                        Under the <strong>Destination</strong> drop-down menu, choose <strong className="text-slate-900 font-bold">Save as PDF</strong> as your target system printer.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <div className="font-bold text-[10px] text-slate-600 bg-slate-100 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">3</div>
                      <p className="text-[11px] leading-relaxed">
                        Expand <strong>More Settings</strong>, set orientation check to <strong className="text-indigo-600 font-bold">Landscape</strong>, format size <strong>A4</strong>, tick <strong>Background Graphics</strong>, and untick headers/footers.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200/60 text-[10px] text-amber-800 leading-relaxed space-y-1">
                  <strong>💡 Tip for Sandbox Environments:</strong>
                  <p className="leading-normal">
                    Some browsers limit script popups within frame sandboxes. If the trigger fails, please click the <strong className="font-bold">"Open in a new tab" ↗</strong> button on the top right, then trigger print.
                  </p>
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
        {showConfirmModal && studentToDelete && (
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
              id="student-delete-confirmation-modal"
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
                    You are about to irreversibly purge the following student registry listing from the system database:
                  </p>
                </div>

                {/* Identity Card Block */}
                {students.find(s => s.id === studentToDelete) && (
                  <div className="w-full bg-slate-50 p-4 rounded-xl border border-slate-200 text-left font-mono space-y-2.5">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-[11px]">
                      <div className="col-span-2 border-b border-slate-100 pb-1.5">
                        <span className="text-[9px] text-slate-400 block uppercase font-sans">Full Student Name</span>
                        <strong className="text-slate-900 font-bold">
                          {(() => {
                            const s = students.find(x => x.id === studentToDelete)!;
                            return `${s.firstName} ${s.middleName ? s.middleName + ' ' : ''}${s.lastName}`;
                          })()}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block uppercase font-sans">Student ID Code</span>
                        <strong className="text-slate-950 font-bold">{students.find(x => x.id === studentToDelete)!.id}</strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block uppercase font-sans">Class Level</span>
                        <strong className="text-slate-950 font-bold">{students.find(x => x.id === studentToDelete)!.class}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Warning message */}
                <div className="bg-rose-50 border border-rose-100/80 p-3.5 rounded-xl text-left text-rose-950 text-[11px] leading-relaxed space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-rose-800">
                    ⚠️ Cascade Deletion Policy Notice:
                  </p>
                  <p>
                    Proceeding with this action will automatically and permanently cascade delete all terminal scoresheet worksheets, assessment analytics, and active daily attendance registry logs associated with this specific student. This physical database clear cannot be undone.
                  </p>
                </div>

                {/* Controls */}
                <div className="w-full flex flex-col sm:flex-row gap-2 pt-2">
                  <button
                    type="button"
                    onClick={cancelDelete}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition text-center"
                    id="cancel-student-deletion"
                  >
                    Cancel, Keep Profile
                  </button>
                  <button
                    type="button"
                    onClick={confirmDelete}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white rounded-xl text-xs font-black shadow-md shadow-rose-600/10 cursor-pointer transition text-center"
                    id="confirm-student-deletion"
                  >
                    Yes, Purge Permanently
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CSV BULK IMPORT MODAL */}
      <AnimatePresence>
        {showImportModal && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowImportModal(false);
                setImportFile(null);
                setParsedStudents([]);
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
                    Bulk Upload & Import Student Profiles
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1">Upload multiple student profiles at once using a formatted CSV spreadsheet</p>
                </div>
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                    setParsedStudents([]);
                    setImportError(null);
                  }}
                  className="p-1 px-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-650 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Instruction Banner */}
                <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-50 text-[10px] text-indigo-700 font-bold">i</span>
                      Formatting Instruction Guide:
                    </h4>
                    <p className="text-[10px] text-slate-500 leading-normal max-w-2xl">
                      Make sure your spreadsheet includes headers such as: <code className="font-mono bg-slate-200 px-1 py-0.5 rounded text-amber-800">First Name</code>, <code className="font-mono bg-slate-200 px-1 py-0.5 rounded text-amber-800">Last Name</code>, <code className="font-mono bg-slate-200 px-1 py-0.5 rounded text-amber-800">Class</code>, <code className="font-mono bg-slate-200 px-1 py-0.5 rounded text-amber-800">Gender</code>, <code className="font-mono bg-slate-200 px-1 py-0.5 rounded text-amber-800">Date of Birth</code> (formatted as YYYY-MM-DD).
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-250 hover:bg-slate-100 rounded-lg text-[11px] font-bold text-slate-700 transition cursor-pointer self-start md:self-auto flex-shrink-0"
                    >
                      <FileDown size={14} className="text-slate-500" />
                      CSV Template
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadJsonTemplate}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-250 hover:bg-slate-100 rounded-lg text-[11px] font-bold text-slate-700 transition cursor-pointer self-start md:self-auto flex-shrink-0"
                    >
                      <FileDown size={14} className="text-slate-500" />
                      JSON Template
                    </button>
                  </div>
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
                      <p className="font-bold text-slate-700 text-xs">Drag and drop your roster CSV or JSON file here</p>
                      <p className="text-[10px] text-slate-400">or click to browse your desktop storage library</p>
                    </div>
                    <input
                      type="file"
                      ref={importFileInputRef}
                      onChange={handleFileChange}
                      accept=".csv,.json"
                      className="hidden"
                    />
                    <div className="pt-2 text-[9px] text-slate-400 max-w-md mx-auto">
                      Supported formats: <strong className="text-slate-600">CSV spreadsheet (.csv)</strong> or <strong className="text-slate-600">JSON records (.json)</strong>. Maximum size 3MB.
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
                            {(importFile.size / 1024).toFixed(1)} KB • {parsedStudents.length} rows loaded
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setImportFile(null);
                          setParsedStudents([]);
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
                    {!importError && parsedStudents.length > 0 && (
                      <div className="space-y-2">
                        {/* Summary metrics header */}
                        <div className="flex items-center justify-between text-[11px] font-sans pb-1">
                          <span className="text-slate-500">
                            Spreadsheet breakdown preview summary:
                          </span>
                          <div className="flex gap-2.5">
                            <span className="bg-indigo-50 text-indigo-750 font-bold px-2 py-0.5 rounded-full border border-indigo-100">
                              Total: {parsedStudents.length} rows
                            </span>
                            <span className="bg-emerald-50 text-emerald-750 font-bold px-2 py-0.5 rounded-full border border-emerald-100">
                              Ready: {parsedStudents.filter(p => p.errors.length === 0).length} valid
                            </span>
                            {parsedStudents.filter(p => p.errors.length > 0).length > 0 && (
                              <span className="bg-rose-50 text-rose-750 font-bold px-2 py-0.5 rounded-full border border-rose-100">
                                Issues: {parsedStudents.filter(p => p.errors.length > 0).length} flagged
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Scrolling scrollbar grid preview container */}
                        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto overflow-x-auto shadow-xs">
                          <table className="w-full text-left border-collapse text-[11px] min-w-[900px]">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                              <tr>
                                <th className="py-2.5 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Row</th>
                                <th className="py-2.5 px-3 font-semibold text-slate-700">Full Name</th>
                                <th className="py-2.5 px-3 font-semibold text-slate-700">Class</th>
                                <th className="py-2.5 px-3 font-semibold text-slate-700">Gender</th>
                                <th className="py-2.5 px-3 font-semibold text-slate-700">Date of Birth</th>
                                <th className="py-2.5 px-3 font-semibold text-slate-700">Section</th>
                                <th className="py-2.5 px-3 font-semibold text-slate-700">Type</th>
                                <th className="py-2.5 px-3 font-semibold text-slate-700">Guardian Details</th>
                                <th className="py-2.5 px-3 text-right font-semibold text-slate-700 pr-4">Status / Feedbacks</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {parsedStudents.map((rowVal, idx) => {
                                const { student, errors } = rowVal;
                                const hasErrors = errors.length > 0;
                                return (
                                  <tr key={idx} className={hasErrors ? 'bg-rose-50/20' : 'hover:bg-slate-50/30'}>
                                    <td className="py-2 px-3 font-mono font-bold text-slate-400">{idx + 2}</td>
                                    <td className="py-2 px-3 font-semibold text-slate-800">
                                      {student.firstName || <span className="text-red-500 italic">[Empty]</span>} {student.middleName ? student.middleName + ' ' : ''}{student.lastName || <span className="text-red-500 italic">[Empty]</span>}
                                    </td>
                                    <td className="py-2 px-3">
                                      <span className="font-medium">{student.class}</span>
                                    </td>
                                    <td className="py-2 px-3 text-slate-600">{student.gender}</td>
                                    <td className="py-2 px-3 font-mono text-slate-500">
                                      <div>{student.dateOfBirth || <span className="text-red-400 italic">None</span>}</div>
                                      {student.dateOfBirth && (() => {
                                        const ageObj = calculateAgeFromDob(student.dateOfBirth);
                                        return ageObj ? <div className="text-[9.5px] font-sans font-bold text-indigo-600">{ageObj.formatted}</div> : null;
                                      })()}
                                    </td>
                                    <td className="py-2 px-3 font-medium text-slate-700">{student.section}</td>
                                    <td className="py-2 px-3">
                                      <span className={`px-1 rounded-sm text-[9px] font-bold ${student.status === 'Boarder' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>{student.status}</span>
                                    </td>
                                    <td className="py-2 px-3 text-slate-500 truncate max-w-[120px]">
                                      {student.guardianName || 'N/A'} {student.guardianTelephone ? `(${student.guardianTelephone})` : ''}
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
                          <span className="font-mono text-slate-500">
                            Academic Session: {selectedYear || '2026/2027'} • {selectedTerm || 'Term 1'}
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
                  * Dynamic auto ID codes will generate on successfully importing profiles.
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportModal(false);
                      setImportFile(null);
                      setParsedStudents([]);
                      setImportError(null);
                    }}
                    className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 font-semibold rounded-xl cursor-pointer transition text-xs shadow-2xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    disabled={!importFile || parsedStudents.length === 0 || parsedStudents.filter(p => p.errors.length === 0).length === 0}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none text-white font-bold rounded-xl cursor-pointer transition text-xs shadow-md shadow-indigo-600/10 inline-flex items-center gap-1.5"
                  >
                    <Check size={14} /> Execute Import ({parsedStudents.filter(p => p.errors.length === 0).length} valid rosters)
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* STUDENT ID CARD GENERATION MODAL */}
      <AnimatePresence>
        {showIdCardModal && selectedIdCardStudent && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowIdCardModal(false);
            }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 no-print overflow-y-auto cursor-pointer font-sans"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ ease: "easeOut", duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-100 rounded-[24px] border border-slate-200/50 shadow-2xl max-w-4xl w-full flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200/80 overflow-hidden my-8 max-h-[90vh] cursor-default"
            >
              
              {/* Left Column: ID Card Live Preview */}
              <div className="flex-1 p-6 overflow-y-auto bg-slate-700 flex flex-col justify-between items-center space-y-4">
                <span className="text-white text-xs font-mono tracking-widest uppercase opacity-70">Student ID Card Print Preview</span>
                
                {/* ID CARD PORTRAIT COMPONENT WITH STANDARD CR80 PROPORTIONS */}
                <div 
                  id="student-id-card-screen-preview" 
                  className="w-[300px] h-[460px] bg-white text-slate-950 rounded-2xl border border-slate-350 shadow-2xl relative overflow-hidden flex flex-col justify-between font-sans select-none"
                >
                  {/* Card Header Wave / Banner */}
                  <div className="bg-indigo-900 text-white p-3 pt-4 text-center relative overflow-hidden flex flex-col items-center justify-center min-h-[75px]">
                    {/* Background visual highlight */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-indigo-950 to-indigo-800 opacity-90"></div>
                    
                    <div className="relative z-10 flex items-center gap-2 max-w-[90%] justify-center">
                      {DbController.getSchoolInfo().logoUrl ? (
                        <img 
                          src={DbController.getSchoolInfo().logoUrl} 
                          alt="School Logo" 
                          className="w-7 h-7 object-contain rounded-full bg-white p-0.5"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold text-white">SCH</div>
                      )}
                      
                      <div className="text-left flex-1 min-w-0">
                        <h4 className="text-[9px] font-black uppercase tracking-wide truncate leading-tight">
                          {DbController.getSchoolInfo().name}
                        </h4>
                        <p className="text-[6.5px] italic font-mono text-indigo-200 truncate leading-none mt-0.5">
                          "{DbController.getSchoolInfo().motto}"
                        </p>
                      </div>
                    </div>
                    
                    {/* ID Card label tab */}
                    <div className="absolute bottom-0 right-0 left-0 bg-amber-500 text-[6.5px] font-extrabold uppercase tracking-widest py-0.5 text-center text-slate-950 z-10">
                      Student Identity Card
                    </div>
                  </div>

                  {/* Card Body - Photo & Bio details */}
                  <div className="flex-1 p-4 flex flex-col items-center justify-center space-y-3.5 relative z-10 bg-radial from-white to-slate-50/50">
                    {/* Watermark Logo/Badge */}
                    {DbController.getSchoolInfo().logoUrl && (
                      <img 
                        src={DbController.getSchoolInfo().logoUrl} 
                        alt="Watermark" 
                        className="absolute inset-0 m-auto w-32 h-32 object-contain opacity-[0.04] pointer-events-none select-none"
                        referrerPolicy="no-referrer"
                      />
                    )}

                    {/* Student Photo */}
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full border-2 border-indigo-900 overflow-hidden bg-slate-100 flex items-center justify-center shadow-md">
                        {selectedIdCardStudent.photoUrl ? (
                          <img 
                            src={selectedIdCardStudent.photoUrl} 
                            alt={`${selectedIdCardStudent.firstName} Photo`} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <User size={48} className="text-slate-350" />
                        )}
                      </div>
                      
                      {/* Active student check status tag */}
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-[#059669] text-white text-[6.5px] font-extrabold px-2 py-0.5 rounded-full border border-white shadow-xs tracking-wide whitespace-nowrap uppercase">
                        {selectedIdCardStudent.status === 'Boarder' ? 'BOARDER' : 'DAY STUDENT'}
                      </span>
                    </div>

                    {/* Student Identity Information */}
                    <div className="text-center space-y-2.5 w-full">
                      <div>
                        <h3 className="text-sm font-black text-slate-900 tracking-tight leading-tight uppercase font-display">
                          {selectedIdCardStudent.firstName} {selectedIdCardStudent.middleName ? selectedIdCardStudent.middleName + ' ' : ''}{selectedIdCardStudent.lastName}
                        </h3>
                        <p className="text-[7.5px] font-mono font-bold text-indigo-700 tracking-widest mt-0.5">
                          ID: {selectedIdCardStudent.id}
                        </p>
                      </div>

                      {/* Particulars Grid */}
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 bg-white/70 border border-slate-150 rounded-xl p-2.5 text-left text-[9px] font-medium shadow-2xs">
                        <div>
                          <span className="text-[6.5px] text-slate-400 block font-bold uppercase leading-none mb-0.5">CLASS LEVEL</span>
                          <strong className="text-slate-800 font-bold">{selectedIdCardStudent.class}</strong>
                        </div>
                        <div>
                          <span className="text-[6.5px] text-slate-400 block font-bold uppercase leading-none mb-0.5">SECTION</span>
                          <strong className="text-slate-800 font-bold">{selectedIdCardStudent.section}</strong>
                        </div>
                        <div className="col-span-2 border-t border-slate-100 pt-1 mt-0.5">
                          <span className="text-[6.5px] text-slate-400 block font-bold uppercase leading-none mb-0.5">GUARDIAN CONTACT</span>
                          <strong className="text-slate-800 font-bold truncate block">
                            {selectedIdCardStudent.guardianTelephone || 'N/A'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer - QR Code and Authorized Signature */}
                  <div className="p-3 bg-slate-50 border-t border-slate-150 flex items-center justify-between min-h-[85px] relative z-10">
                    {/* QR Code */}
                    <div className="flex flex-col items-center gap-1">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                          `Student ID: ${selectedIdCardStudent.id}\nName: ${selectedIdCardStudent.firstName} ${selectedIdCardStudent.lastName}\nClass: ${selectedIdCardStudent.class}\nSchool: ${DbController.getSchoolInfo().name}`
                        )}`} 
                        alt="Profile QR Code" 
                        className="w-14 h-14 object-contain border border-slate-200 bg-white p-0.5 rounded-lg shadow-2xs"
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-[5.5px] font-mono text-slate-400 font-bold uppercase tracking-wider">PROFILE LINK</span>
                    </div>

                    {/* Authorized Signature Box */}
                    <div className="text-right flex flex-col items-end justify-end space-y-1 self-stretch min-w-[110px]">
                      <div className="relative w-28 h-8 flex items-center justify-center">
                        {/* Stamp overlay if available */}
                        {DbController.getSchoolInfo().stampUrl && (
                          <img 
                            src={DbController.getSchoolInfo().stampUrl} 
                            alt="Stamp" 
                            className="absolute -left-2 w-10 h-10 object-contain opacity-50 pointer-events-none rotate-12 z-0"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        {/* Signature overlay */}
                        {DbController.getSchoolInfo().signatureUrl ? (
                          <img 
                            src={DbController.getSchoolInfo().signatureUrl} 
                            alt="Signature" 
                            className="absolute w-20 h-7 object-contain z-10 bottom-0 select-none pointer-events-none"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="absolute text-[8px] italic text-slate-350 z-10 bottom-1">Headteacher</div>
                        )}
                      </div>
                      
                      <div className="h-[1px] w-24 bg-slate-300"></div>
                      
                      <span className="text-[6px] font-black text-slate-800 uppercase tracking-wider block font-sans text-right leading-none">
                        {DbController.getSchoolInfo().headteacherName || 'Headteacher Sign'}
                      </span>
                      <span className="text-[5px] font-bold text-slate-400 block tracking-widest uppercase text-right leading-none">
                        AUTHORIZED SIGNATURE
                      </span>
                    </div>
                  </div>

                </div>

                <span className="text-[10px] text-slate-300 font-mono tracking-wide">Standard Portrait Credit Card Badge Proportions</span>
              </div>

              {/* Right Column: Setup Manual & Control */}
              <div className="w-full md:w-[400px] p-6 bg-white flex flex-col justify-between overflow-y-auto max-h-none md:max-h-[90vh] no-print">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 flex-shrink-0">
                      <IdCard size={22} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-950">Identity Card Generator</h4>
                      <p className="text-[10px] text-slate-400">Generate, export or print student badges</p>
                    </div>
                  </div>

                  {/* Cloud Drive PDF Export Trigger Integration */}
                  <GoogleDriveExportControl 
                    elementId="student-id-card-print-area" 
                    defaultFilename={`${selectedIdCardStudent.firstName}_${selectedIdCardStudent.lastName}_ID_Card.pdf`}
                    isLandscape={true} 
                  />

                  <div className="p-3 bg-indigo-50 border border-indigo-100/70 rounded-xl space-y-1 text-indigo-950 text-[11px]">
                    <span className="font-bold">🖨️ Professional Printing Checklist</span>
                    <p className="text-[10px] text-indigo-800/90 leading-relaxed">
                      To achieve standard physical ID badge dimensions, ensure your printing settings conform to the parameters detailed below.
                    </p>
                  </div>

                  <div className="space-y-3 text-xs text-slate-700 font-sans">
                    <span className="font-bold text-slate-900 border-b border-slate-100 pb-1 block">Setup Instructions Checklist:</span>
                    
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <div className="font-bold text-[10px] text-slate-600 bg-slate-100 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">1</div>
                        <p className="text-[11px] leading-relaxed">
                          Click the <strong className="text-indigo-600 font-bold">Trigger Badge Printer</strong> button to open printer controls.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <div className="font-bold text-[10px] text-slate-600 bg-slate-100 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">2</div>
                        <p className="text-[11px] leading-relaxed">
                          Set <strong>Destination</strong> to <strong className="text-slate-900 font-bold">Save as PDF</strong> or select your connected desktop card printer.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <div className="font-bold text-[10px] text-slate-600 bg-slate-100 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">3</div>
                        <p className="text-[11px] leading-relaxed">
                          Verify page layout is set to <strong>Portrait</strong>. Toggle on <strong className="text-indigo-600 font-bold">Background Graphics</strong>, and disable default headers & footers.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200/60 text-[10px] text-amber-800 leading-relaxed space-y-1">
                    <strong>💡 Sandbox Printing Tip:</strong>
                    <p className="leading-normal">
                      Direct printing can be blocked inside preview iframes. If clicking the trigger displays an alert, use the <strong className="font-bold">"Open in a new tab" ↗</strong> button at the top right of the application first.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-6 border-t border-slate-100 mt-6 font-sans">
                  <button
                    type="button"
                    onClick={() => setShowIdCardModal(false)}
                    className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 font-semibold rounded-xl transition cursor-pointer text-[12px] flex-shrink-0"
                  >
                    Close Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handlePrintIdCard();
                    }}
                    className="flex-1 px-5 py-2.5 bg-[#059669] hover:bg-[#047857] text-white font-semibold rounded-xl shadow-xs transition cursor-pointer text-[12px] text-center flex items-center justify-center gap-1.5 active:translate-y-0.5"
                  >
                    <Printer size={14} /> Trigger Badge Printer
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BULK STATUS UPDATE MODAL */}
      <AnimatePresence>
        {showBulkUpdateModal && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowBulkUpdateModal(false);
            }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto no-print cursor-pointer"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ ease: "easeOut", duration: 0.15 }}
              onClick={(e) => e.stopPropagation()} 
              className="bg-white rounded-[24px] border border-slate-100 max-w-md w-full shadow-2xl overflow-hidden flex flex-col cursor-default font-sans"
            >
              <div className="p-6 pb-4 bg-white border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <RefreshCw className="text-indigo-650" size={18} />
                    Bulk Status Update
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">Update multiple student profiles in one operation</p>
                </div>
                <button 
                  onClick={() => setShowBulkUpdateModal(false)}
                  className="p-1 px-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-6 bg-white text-xs">
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3.5 text-indigo-800">
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-650 animate-pulse"></span>
                    Target Roster Segment
                  </div>
                  <p className="text-[11px] mt-1 text-indigo-700">
                    You have selected <strong className="font-bold">{selectedStudentIds.length}</strong> student profile{selectedStudentIds.length > 1 ? 's' : ''} to modify. Specify which attributes to bulk-update below:
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Field 1: Enrollment Status */}
                  <div className={`p-4 rounded-xl border transition ${shouldUpdateStatus ? 'border-indigo-200 bg-indigo-50/10' : 'border-slate-200 bg-white'}`}>
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={shouldUpdateStatus}
                        onChange={(e) => setShouldUpdateStatus(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 mt-0.5 cursor-pointer"
                      />
                      <div className="flex-1">
                        <span className="text-xs font-bold text-slate-700 block">Update Enrollment Status</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Toggle boarding or day enrollment class assignments</span>
                      </div>
                    </label>

                    {shouldUpdateStatus && (
                      <div className="mt-3 pl-7">
                        <select
                          value={bulkUpdateStatus}
                          onChange={(e) => setBulkUpdateStatus(e.target.value as 'Day' | 'Boarder')}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        >
                          <option value="Day">Day Student</option>
                          <option value="Boarder">Boarder Student</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Field 2: Grade Level / Class */}
                  <div className={`p-4 rounded-xl border transition ${shouldUpdateClass ? 'border-indigo-200 bg-indigo-50/10' : 'border-slate-200 bg-white'}`}>
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={shouldUpdateClass}
                        onChange={(e) => setShouldUpdateClass(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 mt-0.5 cursor-pointer"
                      />
                      <div className="flex-1">
                        <span className="text-xs font-bold text-slate-700 block">Update Grade Level (Class)</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Promote or reassign selected student rosters to a new class</span>
                      </div>
                    </label>

                    {shouldUpdateClass && (
                      <div className="mt-3 pl-7">
                        <select
                          value={bulkUpdateClass}
                          onChange={(e) => setBulkUpdateClass(e.target.value as ClassType)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        >
                          {CLASSES.map(cls => (
                            <option key={cls} value={cls}>{cls}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Field 3: Attendance Status */}
                  <div className={`p-4 rounded-xl border transition ${shouldUpdateAttendance ? 'border-indigo-200 bg-indigo-50/10' : 'border-slate-200 bg-white'}`}>
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={shouldUpdateAttendance}
                        onChange={(e) => setShouldUpdateAttendance(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 mt-0.5 cursor-pointer"
                      />
                      <div className="flex-1">
                        <span className="text-xs font-bold text-slate-700 block">Mark Attendance (Today)</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Bulk record attendance status for the current session</span>
                      </div>
                    </label>

                    {shouldUpdateAttendance && (
                      <div className="mt-3 pl-7">
                        <select
                          value={bulkAttendanceStatus}
                          onChange={(e) => setBulkAttendanceStatus(e.target.value as 'Present' | 'Absent')}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        >
                          <option value="Present">Present</option>
                          <option value="Absent">Absent</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Field 4: Fee Payment Status (Restricted from Teachers) */}
                  {userRole !== 'Teacher' && (
                    <div className={`p-4 rounded-xl border transition ${shouldUpdateFeeStatus ? 'border-indigo-200 bg-indigo-50/10' : 'border-slate-200 bg-white'}`}>
                      <label className="flex items-start gap-3 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={shouldUpdateFeeStatus}
                          onChange={(e) => setShouldUpdateFeeStatus(e.target.checked)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 mt-0.5 cursor-pointer"
                        />
                        <div className="flex-1">
                          <span className="text-xs font-bold text-slate-700 block">Update Fee Payment Status</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Mark selected students as fully paid for active term bills</span>
                        </div>
                      </label>

                      {shouldUpdateFeeStatus && (
                        <div className="mt-2 pl-7">
                          <div className="text-[10px] text-emerald-600 font-bold bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                            Note: This will automatically record a clearing payment for any outstanding balance on active bills.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowBulkUpdateModal(false)}
                    className="flex-1 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 font-semibold rounded-xl transition cursor-pointer text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkStatusUpdate}
                    className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-xs transition cursor-pointer text-xs flex items-center justify-center gap-1.5 active:translate-y-0.5"
                  >
                    <Check size={14} /> Apply Updates
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BULK STUDENT ID CARD GENERATOR & PRINT MODAL */}
      <AnimatePresence>
        {showBulkIdCardModal && selectedStudentsForIdCards.length > 0 && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowBulkIdCardModal(false);
            }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 no-print overflow-y-auto cursor-pointer font-sans"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ ease: "easeOut", duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-100 rounded-[24px] border border-slate-200/50 shadow-2xl max-w-6xl w-full flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200/80 overflow-hidden my-8 max-h-[90vh] cursor-default"
            >
              
              {/* Left Column: ID Cards Live Preview */}
              <div className="flex-1 p-6 overflow-y-auto bg-slate-700 flex flex-col items-center space-y-4">
                <span className="text-white text-xs font-mono tracking-widest uppercase opacity-70">
                  Bulk Student ID Cards ({selectedStudentsForIdCards.length} Selected) - Print Preview
                </span>
                
                {/* Scrollable layout grid inside preview modal */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full justify-items-center max-h-[70vh] overflow-y-auto p-2">
                  {selectedStudentsForIdCards.map((student) => (
                    <div 
                      key={`preview-${student.id}`}
                      className="w-[300px] h-[460px] bg-white text-slate-950 rounded-2xl border border-slate-350 shadow-lg relative overflow-hidden flex flex-col justify-between font-sans select-none flex-shrink-0"
                    >
                      {/* Card Header Wave / Banner */}
                      <div className="bg-indigo-900 text-white p-3 pt-4 text-center relative overflow-hidden flex flex-col items-center justify-center min-h-[75px]">
                        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-950 to-indigo-800 opacity-90"></div>
                        <div className="relative z-10 flex items-center gap-2 max-w-[90%] justify-center">
                          {DbController.getSchoolInfo().logoUrl ? (
                            <img 
                              src={DbController.getSchoolInfo().logoUrl} 
                              alt="School Logo" 
                              className="w-7 h-7 object-contain rounded-full bg-white p-0.5"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold text-white">SCH</div>
                          )}
                          <div className="text-left flex-1 min-w-0">
                            <h4 className="text-[9px] font-black uppercase tracking-wide truncate leading-tight">
                              {DbController.getSchoolInfo().name}
                            </h4>
                            <p className="text-[6.5px] italic font-mono text-indigo-200 truncate leading-none mt-0.5">
                              "{DbController.getSchoolInfo().motto}"
                            </p>
                          </div>
                        </div>
                        <div className="absolute bottom-0 right-0 left-0 bg-amber-500 text-[6.5px] font-extrabold uppercase tracking-widest py-0.5 text-center text-slate-950 z-10">
                          Student Identity Card
                        </div>
                      </div>

                      {/* Card Body - Photo & Bio details */}
                      <div className="flex-1 p-4 flex flex-col items-center justify-center space-y-3.5 relative z-10 bg-radial from-white to-slate-50/50">
                        {DbController.getSchoolInfo().logoUrl && (
                          <img 
                            src={DbController.getSchoolInfo().logoUrl} 
                            alt="Watermark" 
                            className="absolute inset-0 m-auto w-32 h-32 object-contain opacity-[0.04] pointer-events-none select-none"
                            referrerPolicy="no-referrer"
                          />
                        )}

                        {/* Student Photo */}
                        <div className="relative">
                          <div className="w-24 h-24 rounded-full border-2 border-indigo-900 overflow-hidden bg-slate-100 flex items-center justify-center shadow-md">
                            {student.photoUrl ? (
                              <img 
                                src={student.photoUrl} 
                                alt={`${student.firstName} Photo`} 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <User size={48} className="text-slate-350" />
                            )}
                          </div>
                          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-[#059669] text-white text-[6.5px] font-extrabold px-2 py-0.5 rounded-full border border-white shadow-xs tracking-wide whitespace-nowrap uppercase">
                            {student.status === 'Boarder' ? 'BOARDER' : 'DAY STUDENT'}
                          </span>
                        </div>

                        {/* Student Identity Information */}
                        <div className="text-center space-y-2.5 w-full">
                          <div>
                            <h3 className="text-sm font-black text-slate-900 tracking-tight leading-tight uppercase font-display">
                              {student.firstName} {student.middleName ? student.middleName + ' ' : ''}{student.lastName}
                            </h3>
                            <p className="text-[7.5px] font-mono font-bold text-indigo-700 tracking-widest mt-0.5">
                              ID: {student.id}
                            </p>
                          </div>

                          {/* Particulars Grid */}
                          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 bg-white/70 border border-slate-150 rounded-xl p-2.5 text-left text-[9px] font-medium shadow-2xs">
                            <div>
                              <span className="text-[6.5px] text-slate-400 block font-bold uppercase leading-none mb-0.5">CLASS LEVEL</span>
                              <strong className="text-slate-800 font-bold">{student.class}</strong>
                            </div>
                            <div>
                              <span className="text-[6.5px] text-slate-400 block font-bold uppercase leading-none mb-0.5">SECTION</span>
                              <strong className="text-slate-800 font-bold">{student.section}</strong>
                            </div>
                            <div className="col-span-2 border-t border-slate-100 pt-1 mt-0.5">
                              <span className="text-[6.5px] text-slate-400 block font-bold uppercase leading-none mb-0.5">GUARDIAN CONTACT</span>
                              <strong className="text-slate-800 font-bold truncate block">
                                {student.guardianTelephone || 'N/A'}
                              </strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer - QR Code and Authorized Signature */}
                      <div className="p-3 bg-slate-50 border-t border-slate-150 flex items-center justify-between min-h-[85px] relative z-10">
                        {/* QR Code */}
                        <div className="flex flex-col items-center gap-1">
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                              `Student ID: ${student.id}\nName: ${student.firstName} ${student.lastName}\nClass: ${student.class}\nSchool: ${DbController.getSchoolInfo().name}`
                            )}`} 
                            alt="Profile QR Code" 
                            className="w-14 h-14 object-contain border border-slate-200 bg-white p-0.5 rounded-lg shadow-2xs"
                            referrerPolicy="no-referrer"
                          />
                          <span className="text-[5.5px] font-mono text-slate-400 font-bold uppercase tracking-wider">PROFILE LINK</span>
                        </div>

                        {/* Authorized Signature Box */}
                        <div className="text-right flex flex-col items-end justify-end space-y-1 self-stretch min-w-[110px]">
                          <div className="relative w-28 h-8 flex items-center justify-center">
                            {DbController.getSchoolInfo().stampUrl && (
                              <img 
                                src={DbController.getSchoolInfo().stampUrl} 
                                alt="Stamp" 
                                className="absolute -left-2 w-10 h-10 object-contain opacity-50 pointer-events-none rotate-12 z-0"
                                referrerPolicy="no-referrer"
                              />
                            )}
                            {DbController.getSchoolInfo().signatureUrl ? (
                              <img 
                                src={DbController.getSchoolInfo().signatureUrl} 
                                alt="Signature" 
                                className="absolute w-20 h-7 object-contain z-10 bottom-0 select-none pointer-events-none"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="absolute text-[8px] italic text-slate-350 z-10 bottom-1">Headteacher</div>
                            )}
                          </div>
                          <div className="h-[1px] w-24 bg-slate-300"></div>
                          <span className="text-[6px] font-black text-slate-800 uppercase tracking-wider block font-sans text-right leading-none">
                            {DbController.getSchoolInfo().headteacherName || 'Headteacher Sign'}
                          </span>
                          <span className="text-[5px] font-bold text-slate-400 block tracking-widest uppercase text-right leading-none">
                            AUTHORIZED SIGNATURE
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Setup Manual & Control */}
              <div className="w-full md:w-[380px] p-6 bg-white flex flex-col justify-between overflow-y-auto max-h-none md:max-h-[90vh] no-print">
                <div className="space-y-4 font-sans">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 flex-shrink-0">
                      <IdCard size={22} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-950">Bulk ID Generator</h4>
                      <p className="text-[10px] text-slate-400">Generate and print multiple badges</p>
                    </div>
                  </div>

                  {/* Cloud Drive PDF Export Trigger Integration for Bulk Cards */}
                  <GoogleDriveExportControl 
                    elementId="bulk-student-id-cards-print-area" 
                    defaultFilename={`Bulk_ID_Cards_${selectedClass === 'All' ? 'All_Classes' : selectedClass.replace(/\s+/g, '_')}.pdf`}
                    isLandscape={false} 
                  />

                  <div className="p-3 bg-indigo-50 border border-indigo-100/70 rounded-xl space-y-1 text-indigo-950 text-[11px]">
                    <span className="font-bold">🖨️ Bulk Printing Instructions</span>
                    <p className="text-[10px] text-indigo-800/90 leading-relaxed">
                      This module formats and prints cards in a 2-column grid to fit neatly on standard A4 layout paper.
                    </p>
                  </div>

                  <div className="space-y-3 text-xs text-slate-700 font-sans">
                    <span className="font-bold text-slate-900 border-b border-slate-100 pb-1 block">Setup Checklists:</span>
                    
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <div className="font-bold text-[10px] text-slate-600 bg-slate-100 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">1</div>
                        <p className="text-[11px] leading-relaxed">
                          Verify that the total count (<span className="font-bold text-indigo-600">{selectedStudentsForIdCards.length}</span>) matches your printing batch.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <div className="font-bold text-[10px] text-slate-600 bg-slate-100 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">2</div>
                        <p className="text-[11px] leading-relaxed">
                          Set <strong>Destination</strong> to <strong>Save as PDF</strong> or select your badge card printer.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <div className="font-bold text-[10px] text-slate-600 bg-slate-100 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">3</div>
                        <p className="text-[11px] leading-relaxed">
                          Check <strong className="text-indigo-600 font-bold">Background Graphics</strong> to ensure beautiful colored header wave vectors.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200/60 text-[10px] text-amber-800 leading-relaxed space-y-1">
                    <strong>💡 Sandbox Hint:</strong>
                    <p className="leading-normal">
                      For best printing alignment, make sure to open the application in a new window or tab.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-6 border-t border-slate-100 mt-6 font-sans">
                  <button
                    type="button"
                    onClick={() => setShowBulkIdCardModal(false)}
                    className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 font-semibold rounded-xl transition cursor-pointer text-[12px] flex-shrink-0"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handlePrintBulkIdCards();
                    }}
                    className="flex-1 px-5 py-2.5 bg-[#059669] hover:bg-[#047857] text-white font-semibold rounded-xl shadow-xs transition cursor-pointer text-[12px] text-center flex items-center justify-center gap-1.5 active:translate-y-0.5"
                  >
                    <Printer size={14} /> Print ID Cards ({selectedStudentsForIdCards.length})
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden single student print target. Visible only during @media print */}
      <div 
        id="student-id-card-print-area" 
        className="hidden print:block print:w-[297mm]"
      >
        {selectedIdCardStudent && (
          <div className="id-cards-landscape-page">
            {Array.from({ length: 8 }).map((_, idx) => (
              renderStudentIdCardContent(selectedIdCardStudent, `single-print-${idx}`)
            ))}
          </div>
        )}
      </div>

      {/* Hidden bulk print target inside main container. Visible only during @media print */}
      <div 
        id="bulk-student-id-cards-print-area" 
        className="hidden print:block print:w-[297mm]"
      >
        {(() => {
          const chunkSize = 8;
          const chunks = [];
          for (let i = 0; i < selectedStudentsForIdCards.length; i += chunkSize) {
            chunks.push(selectedStudentsForIdCards.slice(i, i + chunkSize));
          }
          return chunks.map((chunk, chunkIdx) => (
            <div 
              key={`print-page-${chunkIdx}`}
              className="id-cards-landscape-page"
            >
              {chunk.map((student) => (
                renderStudentIdCardContent(student, `bulk-print-${chunkIdx}`)
              ))}
              {/* Fill remaining slots with invisible cards to preserve 4x2 grid spacing if last page has < 8 cards */}
              {Array.from({ length: 8 - chunk.length }).map((_, idx) => (
                <div key={`empty-${chunkIdx}-${idx}`} className="id-card-print-item border border-dashed border-slate-200 bg-white/20 opacity-0 print:opacity-0" />
              ))}
            </div>
          ));
        })()}
      </div>

      {/* STUDENT BEHAVIORAL REMARKS LOG & TRACKER MODAL */}
      <AnimatePresence>
        {showTranscriptPrint && (
          <PrintPreviewModal
            isOpen={showTranscriptPrint}
            onClose={() => setShowTranscriptPrint(false)}
            customHtml={transcriptHtml}
            documentTitle={transcriptTitle}
            studentId={selectedOverviewStudent?.id}
            onLanguageChange={(l) => {
              if (selectedOverviewStudent) {
                handleGenerateTranscript(selectedOverviewStudent, l as 'en' | 'twi');
              }
            }}
            currentLanguage={transcriptLanguage}
          />
        )}

        {showRemarksModal && selectedRemarkStudent && (
          <div 
            onClick={() => setShowRemarksModal(false)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 no-print overflow-y-auto cursor-pointer font-sans"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ ease: "easeOut", duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[24px] border border-slate-200/50 shadow-2xl max-w-4xl w-full flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100 overflow-hidden my-8 max-h-[90vh] cursor-default"
            >
              {/* Left Column: Form to log a new remark */}
              <div className="w-full md:w-[380px] p-6 flex flex-col justify-between bg-slate-50">
                <div className="space-y-6">
                  {/* Student Header Info */}
                  <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
                    <div className="w-12 h-12 rounded-full border border-slate-200 bg-white overflow-hidden flex-shrink-0 flex items-center justify-center shadow-2xs">
                      {selectedRemarkStudent.photoUrl ? (
                        <img src={selectedRemarkStudent.photoUrl} alt={selectedRemarkStudent.firstName} className="w-full h-full object-cover" />
                      ) : (
                        <User size={20} className="text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 truncate">
                        {selectedRemarkStudent.firstName} {selectedRemarkStudent.lastName}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-mono">
                        Class: {selectedRemarkStudent.class} • ID: {selectedRemarkStudent.id}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-slate-950 flex items-center gap-1.5">
                      <MessageSquare size={16} className="text-amber-500" /> Log Behavioral Remark
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Record disciplinary remarks, conduct praise, or academic observations.
                    </p>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSaveRemark} className="space-y-4 pt-1">
                    {/* Category Selector */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Category Classification
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(['Conduct', 'Positive', 'Academic', 'Improvement', 'Other'] as const).map((cat) => {
                          const isSelected = newRemarkCategory === cat;
                          let themeClasses = '';
                          let CatIcon = MessageSquare;
                          if (cat === 'Positive') {
                            themeClasses = isSelected ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs shadow-emerald-500/10' : 'bg-white border-slate-200 hover:bg-emerald-50 hover:border-emerald-200 text-slate-600 hover:text-emerald-700';
                            CatIcon = Heart;
                          } else if (cat === 'Conduct') {
                            themeClasses = isSelected ? 'bg-blue-500 border-blue-500 text-white shadow-xs shadow-blue-500/10' : 'bg-white border-slate-200 hover:bg-blue-50 hover:border-blue-200 text-slate-600 hover:text-blue-700';
                            CatIcon = ShieldAlert;
                          } else if (cat === 'Academic') {
                            themeClasses = isSelected ? 'bg-purple-500 border-purple-500 text-white shadow-xs shadow-purple-500/10' : 'bg-white border-slate-200 hover:bg-purple-50 hover:border-purple-200 text-slate-600 hover:text-purple-700';
                            CatIcon = BookOpen;
                          } else if (cat === 'Improvement') {
                            themeClasses = isSelected ? 'bg-amber-500 border-amber-500 text-white shadow-xs shadow-amber-500/10' : 'bg-white border-slate-200 hover:bg-amber-50 hover:border-amber-200 text-slate-600 hover:text-amber-700';
                            CatIcon = AlertTriangle;
                          } else {
                            themeClasses = isSelected ? 'bg-slate-600 border-slate-600 text-white' : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-600';
                            CatIcon = MessageSquare;
                          }

                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setNewRemarkCategory(cat)}
                              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-bold border transition cursor-pointer ${themeClasses}`}
                            >
                              <CatIcon size={12} />
                              {cat}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Remark Textarea */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Detailed Remark
                      </label>
                      <SmartTextarea
                        value={newRemarkText}
                        onChange={(e: any) => setNewRemarkText(e.target.value)}
                        placeholder="Write behavioral feedback or disciplinary action..."
                        rows={4}
                        required
                        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition resize-none font-sans"
                      />
                    </div>

                    {/* Term/Session Indicator */}
                    <div className="bg-white rounded-xl border border-slate-200 p-3 flex justify-between items-center text-[10px] font-mono text-slate-500 leading-none">
                      <div>
                        <span className="block text-slate-400 uppercase text-[8px] font-bold leading-none mb-1">Academic Session</span>
                        {selectedRemarkStudent.academicYear || selectedYear || '2026/2027'}
                      </div>
                      <div className="text-right">
                        <span className="block text-slate-400 uppercase text-[8px] font-bold leading-none mb-1">Active Term</span>
                        {selectedRemarkStudent.term || selectedTerm || 'Term 1'}
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-md transition cursor-pointer text-xs flex items-center justify-center gap-1.5"
                    >
                      <Check size={14} /> Log Remark Entry
                    </button>
                  </form>
                </div>

                <div className="pt-4 border-t border-slate-200 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowRemarksModal(false)}
                    className="w-full py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold rounded-xl transition cursor-pointer text-xs"
                  >
                    Close Log
                  </button>
                </div>
              </div>

              {/* Right Column: Historical remarks timeline tracker */}
              <div className="flex-1 p-6 bg-white overflow-y-auto max-h-[90vh] flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-slate-950">Remarks History Timeline</h4>
                      <p className="text-[10px] text-slate-400">Chronological history log for this student profile</p>
                    </div>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-bold">
                      {DbController.getBehavioralRemarksForStudent(selectedRemarkStudent.id).length} Entries
                    </span>
                  </div>

                  <div className="space-y-3 pr-1 max-h-[55vh] overflow-y-auto">
                    {DbController.getBehavioralRemarksForStudent(selectedRemarkStudent.id).length === 0 ? (
                      <div className="py-12 px-4 flex flex-col items-center justify-center text-center space-y-3">
                        <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center text-slate-400">
                          <MessageSquare size={20} />
                        </div>
                        <div className="space-y-1">
                          <h5 className="text-xs font-bold text-slate-700">No behavioral remarks logged</h5>
                          <p className="text-[10px] text-slate-400 max-w-[240px]">
                            This student has an empty history. Add their first conduct or academic remark using the left-hand form panel.
                          </p>
                        </div>
                      </div>
                    ) : (
                      DbController.getBehavioralRemarksForStudent(selectedRemarkStudent.id)
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((remark) => {
                          let cardColorClass = '';
                          let badgeClass = '';
                          let ItemIcon = MessageSquare;

                          if (remark.category === 'Positive') {
                            cardColorClass = 'border-l-4 border-l-emerald-500 bg-emerald-50/15 border border-slate-100';
                            badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-150';
                            ItemIcon = Heart;
                          } else if (remark.category === 'Conduct') {
                            cardColorClass = 'border-l-4 border-l-blue-500 bg-blue-50/15 border border-slate-100';
                            badgeClass = 'bg-blue-50 text-blue-700 border-blue-150';
                            ItemIcon = ShieldAlert;
                          } else if (remark.category === 'Academic') {
                            cardColorClass = 'border-l-4 border-l-purple-500 bg-purple-50/15 border border-slate-100';
                            badgeClass = 'bg-purple-50 text-purple-700 border-purple-150';
                            ItemIcon = BookOpen;
                          } else if (remark.category === 'Improvement') {
                            cardColorClass = 'border-l-4 border-l-amber-500 bg-amber-50/15 border border-slate-100';
                            badgeClass = 'bg-amber-50 text-amber-700 border-amber-150';
                            ItemIcon = AlertTriangle;
                          } else {
                            cardColorClass = 'border-l-4 border-l-slate-400 bg-slate-50/20 border border-slate-100';
                            badgeClass = 'bg-slate-50 text-slate-700 border-slate-150';
                            ItemIcon = MessageSquare;
                          }

                          return (
                            <div 
                              key={remark.id}
                              className={`p-3.5 rounded-xl flex flex-col justify-between space-y-2.5 transition hover:shadow-xs relative group ${cardColorClass}`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase border ${badgeClass}`}>
                                    <ItemIcon size={9} />
                                    {remark.category}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {new Date(remark.date).toLocaleDateString(undefined, { 
                                      year: 'numeric', 
                                      month: 'short', 
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                </div>
                                
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRemark(remark.id)}
                                  className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer transition md:opacity-0 md:group-hover:opacity-100"
                                  title="Delete Entry"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>

                              <p className="text-xs text-slate-700 font-sans leading-relaxed break-words whitespace-pre-wrap">
                                {remark.remark}
                              </p>

                              <div className="flex justify-between items-center text-[9px] font-mono text-slate-450 border-t border-slate-100/60 pt-2 leading-none">
                                <div>
                                  Logged by: <span className="font-semibold text-slate-600">{remark.teacherName}</span>
                                </div>
                                <div className="text-right text-slate-400">
                                  {remark.academicYear} • {remark.term}
                                </div>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>

                <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-150 text-[10px] text-indigo-800 leading-normal flex gap-2 mt-4">
                  <ShieldAlert size={14} className="text-indigo-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>Data Integrity & Traceability:</strong>
                    <p className="mt-0.5">
                      All logged behavioral entries are securely cached and synchronized in real-time with the central Cloud Database, associating complete teacher identity tracking tags automatically.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* STUDENT OVERVIEW MODAL */}
      <AnimatePresence>
        {showOverviewModal && selectedOverviewStudent && (
          <div 
            onClick={() => setShowOverviewModal(false)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 no-print overflow-y-auto cursor-pointer font-sans"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ ease: "easeOut", duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[24px] border border-slate-200/50 shadow-2xl max-w-5xl w-full flex flex-col overflow-hidden my-8 max-h-[95vh] cursor-default"
            >
              {/* Modal Header */}
              <div className="p-6 bg-white border-b border-slate-100 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shadow-xs shrink-0">
                    {selectedOverviewStudent.photoUrl ? (
                      <img src={selectedOverviewStudent.photoUrl} alt={selectedOverviewStudent.firstName} className="w-full h-full object-cover" />
                    ) : (
                      <User size={24} className="text-slate-300" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 leading-tight">
                      {selectedOverviewStudent.firstName} {selectedOverviewStudent.middleName ? selectedOverviewStudent.middleName + ' ' : ''}{selectedOverviewStudent.lastName}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Student Performance & Engagement Dashboard • ID: {selectedOverviewStudent.id}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleShareParentLinkWhatsApp(selectedOverviewStudent)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition cursor-pointer text-xs font-bold font-sans"
                    title="Share Student Profile & Report via WhatsApp"
                  >
                    <MessageSquare size={15} />
                    <span>Share WhatsApp</span>
                  </button>
                  <button
                    onClick={() => handleGenerateTranscript(selectedOverviewStudent)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition cursor-pointer text-xs font-bold font-sans"
                  >
                    <FileText size={16} />
                    Generate Transcript
                  </button>
                  <button 
                    onClick={() => setShowOverviewModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Profile Details & Family Summary Bar */}
              <div className="bg-slate-50/70 border-b border-slate-150 px-6 py-3 shrink-0 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Class & Section</span>
                    <span className="font-bold text-slate-800">
                      {selectedOverviewStudent.class} • <span className="text-indigo-600">{selectedOverviewStudent.section || 'None'}</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Ghana Post Address</span>
                    <span className="font-mono font-bold text-emerald-700">
                      {selectedOverviewStudent.ghanaPostGps || <span className="text-slate-400 font-normal">Not Provided</span>}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Residential Address</span>
                    <span className="font-medium text-slate-700 truncate block" title={selectedOverviewStudent.residentialAddress}>
                      {selectedOverviewStudent.residentialAddress || <span className="text-slate-400 font-normal">Not Provided</span>}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider block">Mother's Info</span>
                    <span className="font-semibold text-slate-800 truncate block">
                      {selectedOverviewStudent.motherName || 'N/A'}{' '}
                      <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${selectedOverviewStudent.motherStatus === 'Deceased' ? 'bg-slate-200 text-slate-700' : 'bg-rose-100 text-rose-700'}`}>
                        {selectedOverviewStudent.motherStatus || 'Living'}
                      </span>
                    </span>
                    {selectedOverviewStudent.motherTelephone && (
                      <span className="text-[10px] text-slate-500 font-mono block">{selectedOverviewStudent.motherTelephone}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-blue-500 font-bold uppercase tracking-wider block">Father's Info</span>
                    <span className="font-semibold text-slate-800 truncate block">
                      {selectedOverviewStudent.fatherName || 'N/A'}{' '}
                      <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${selectedOverviewStudent.fatherStatus === 'Deceased' ? 'bg-slate-200 text-slate-700' : 'bg-blue-100 text-blue-700'}`}>
                        {selectedOverviewStudent.fatherStatus || 'Living'}
                      </span>
                    </span>
                    {selectedOverviewStudent.fatherTelephone && (
                      <span className="text-[10px] text-slate-500 font-mono block">{selectedOverviewStudent.fatherTelephone}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Primary Guardian</span>
                    <span className="font-semibold text-slate-800 truncate block">
                      {selectedOverviewStudent.guardianName || 'N/A'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono block">
                      {selectedOverviewStudent.guardianTelephone || 'No Phone'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sub-tabs Navigation */}
              <div className="bg-slate-50/50 px-6 border-b border-slate-100 shrink-0">
                <div className="flex flex-wrap gap-4 sm:gap-8">
                  <button
                    onClick={() => setOverviewTab('trends')}
                    className={`py-3 text-[11px] font-bold uppercase tracking-widest border-b-2 transition cursor-pointer ${overviewTab === 'trends' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  >
                    <div className="flex items-center gap-2">
                      <TrendingUp size={14} />
                      Academic Trends
                    </div>
                  </button>
                  <button
                    onClick={() => setOverviewTab('attendance')}
                    className={`py-3 text-[11px] font-bold uppercase tracking-widest border-b-2 transition cursor-pointer ${overviewTab === 'attendance' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  >
                    <div className="flex items-center gap-2">
                      <Calendar size={14} />
                      Attendance History
                    </div>
                  </button>
                  <button
                    onClick={() => setOverviewTab('history')}
                    className={`py-3 text-[11px] font-bold uppercase tracking-widest border-b-2 transition cursor-pointer ${overviewTab === 'history' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  >
                    <div className="flex items-center gap-2">
                      <History size={14} />
                      Academic History
                    </div>
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                {overviewTab === 'trends' ? (
                  <div className="space-y-6">
                    {/* Top Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {(() => {
                        const trends = DbController.getStudentAcademicTrends(selectedOverviewStudent.id);
                        const avgScore = trends.length > 0 ? (trends.reduce((acc, curr) => acc + curr.totalScore, 0) / trends.length).toFixed(1) : 'N/A';
                        const bestSubject = trends.length > 0 ? [...trends].sort((a, b) => b.totalScore - a.totalScore)[0].subject : 'N/A';
                        const totalAssessments = trends.length;

                        return (
                          <>
                            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Average Academic Score</div>
                              <div className="text-2xl font-black text-indigo-600">{avgScore}%</div>
                              <div className="text-[10px] text-slate-500 mt-1">Cumulative across all terms</div>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Best Performing Subject</div>
                              <div className="text-xl font-bold text-slate-800 truncate">{bestSubject}</div>
                              <div className="text-[10px] text-slate-500 mt-1">Highest recorded score</div>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Assessments</div>
                              <div className="text-2xl font-black text-emerald-600">{totalAssessments}</div>
                              <div className="text-[10px] text-slate-500 mt-1">Recorded entries in system</div>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* Performance Chart */}
                    <div className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-xs space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                          <TrendingUp size={16} className="text-indigo-500" /> Subject Performance Trend
                        </h4>
                      </div>
                      <div className="h-[300px] w-full">
                        {(() => {
                          const trends = DbController.getStudentAcademicTrends(selectedOverviewStudent.id);
                          if (trends.length === 0) {
                            return (
                              <div className="h-full flex flex-col items-center justify-center text-center space-y-2 text-slate-400">
                                <TrendingUp size={32} opacity={0.2} />
                                <p className="text-xs">No assessment data found for this student.</p>
                              </div>
                            );
                          }

                          // Group by subject for better visualization if needed, but here we show a sequence of assessments
                          const chartData = trends.map(t => ({
                            label: `${t.term} ${t.subject.substring(0, 8)}...`,
                            score: t.totalScore,
                            subject: t.subject,
                            term: t.term
                          }));

                          return (
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                  dataKey="label" 
                                  fontSize={10} 
                                  tick={{ fill: '#94a3b8' }} 
                                  axisLine={false} 
                                  tickLine={false}
                                />
                                <YAxis 
                                  domain={[0, 100]} 
                                  fontSize={10} 
                                  tick={{ fill: '#94a3b8' }} 
                                  axisLine={false} 
                                  tickLine={false} 
                                />
                                <Tooltip 
                                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                  formatter={(value: number) => [`${value}%`, 'Score']}
                                />
                                <Line 
                                  type="monotone" 
                                  dataKey="score" 
                                  stroke="#4f46e5" 
                                  strokeWidth={3} 
                                  dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }} 
                                  activeDot={{ r: 6, strokeWidth: 0 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Subjects Table */}
                    <div className="bg-white rounded-[24px] border border-slate-200 shadow-xs overflow-hidden">
                      <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                        <h4 className="text-sm font-bold text-slate-800">Academic Records Breakdown</h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              <th className="px-6 py-3">Subject</th>
                              <th className="px-6 py-3">Term / Session</th>
                              <th className="px-6 py-3 text-center">Class Score</th>
                              <th className="px-6 py-3 text-center">Exam Score</th>
                              <th className="px-6 py-3 text-center">Total</th>
                              <th className="px-6 py-3 text-center">Grade</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {(() => {
                              const trends = DbController.getStudentAcademicTrends(selectedOverviewStudent.id);
                              if (trends.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                                      No detailed records available.
                                    </td>
                                  </tr>
                                );
                              }
                              return [...trends].reverse().map((t, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/80 transition">
                                  <td className="px-6 py-3 font-semibold text-slate-700">{t.subject}</td>
                                  <td className="px-6 py-3 text-slate-500">{t.term} • {t.academicYear}</td>
                                  <td className="px-6 py-3 text-center font-mono text-slate-600">{t.classScore50}</td>
                                  <td className="px-6 py-3 text-center font-mono text-slate-600">{t.examScore50}</td>
                                  <td className="px-6 py-3 text-center">
                                    <span className={`inline-block px-2 py-0.5 rounded-full font-bold ${t.totalScore >= 80 ? 'bg-emerald-50 text-emerald-700' : t.totalScore >= 50 ? 'bg-indigo-50 text-indigo-700' : 'bg-rose-50 text-rose-700'}`}>
                                      {t.totalScore}%
                                    </span>
                                  </td>
                                  <td className="px-6 py-3 text-center">
                                    <span className="font-bold text-slate-900">{t.gradeLevel}</span>
                                  </td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : overviewTab === 'attendance' ? (
                  <div className="space-y-6">
                    {/* Attendance Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {(() => {
                        const history = DbController.getStudentAttendanceHistory(selectedOverviewStudent.id);
                        const stats = DbController.getStudentAttendanceStats(selectedOverviewStudent.id);
                        const rate = stats.schoolOpen > 0 ? ((stats.present / stats.schoolOpen) * 100).toFixed(1) : '0';
                        const lastPresence = history.length > 0 ? history[history.length - 1].date : 'N/A';

                        return (
                          <>
                            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Attendance Rate</div>
                              <div className="text-2xl font-black text-indigo-600">{rate}%</div>
                              <div className="text-[10px] text-slate-500 mt-1">Overall punctuality</div>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Days Present</div>
                              <div className="text-2xl font-black text-emerald-600">{stats.present}</div>
                              <div className="text-[10px] text-slate-500 mt-1">Confirmed appearances</div>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Days Absent</div>
                              <div className="text-2xl font-black text-rose-600">{stats.schoolOpen - stats.present}</div>
                              <div className="text-[10px] text-slate-500 mt-1">Missed school days</div>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Last Recorded</div>
                              <div className="text-xl font-bold text-slate-800">{lastPresence}</div>
                              <div className="text-[10px] text-slate-500 mt-1">Latest attendance log</div>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* Attendance Visualizer */}
                    <div className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-xs space-y-4">
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Calendar size={16} className="text-indigo-500" /> Attendance Distribution
                      </h4>
                      <div className="h-[250px] w-full flex items-center justify-center">
                        {(() => {
                          const stats = DbController.getStudentAttendanceStats(selectedOverviewStudent.id);
                          if (stats.schoolOpen === 0) {
                            return (
                              <div className="flex flex-col items-center justify-center text-center space-y-2 text-slate-400">
                                <UserCheck size={32} opacity={0.2} />
                                <p className="text-xs">No attendance logs found for this student.</p>
                              </div>
                            );
                          }

                          const pieData = [
                            { name: 'Present', value: stats.present, color: '#10b981' },
                            { name: 'Absent', value: stats.schoolOpen - stats.present, color: '#f43f5e' }
                          ];

                          return (
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={pieData}
                                  innerRadius={60}
                                  outerRadius={80}
                                  paddingAngle={5}
                                  dataKey="value"
                                >
                                  {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36}/>
                              </PieChart>
                            </ResponsiveContainer>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Attendance Logs List */}
                    <div className="bg-white rounded-[24px] border border-slate-200 shadow-xs overflow-hidden">
                      <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                        <h4 className="text-sm font-bold text-slate-800">Recent Attendance Logs</h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              <th className="px-6 py-3">Date</th>
                              <th className="px-6 py-3">Status</th>
                              <th className="px-6 py-3">Class Level</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {(() => {
                              const history = DbController.getStudentAttendanceHistory(selectedOverviewStudent.id);
                              if (history.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan={3} className="px-6 py-10 text-center text-slate-400">
                                      No logs recorded yet.
                                    </td>
                                  </tr>
                                );
                              }
                              return [...history].reverse().slice(0, 10).map((h, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/80 transition">
                                  <td className="px-6 py-3 font-mono text-slate-700">{h.date}</td>
                                  <td className="px-6 py-3">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${h.status === 'Present' ? 'bg-emerald-50 text-emerald-700' : h.status === 'Absent' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                                      <div className={`w-1.5 h-1.5 rounded-full ${h.status === 'Present' ? 'bg-emerald-500' : h.status === 'Absent' ? 'bg-rose-500' : 'bg-slate-400'}`}></div>
                                      {h.status}
                                    </span>
                                  </td>
                                  <td className="px-6 py-3 text-slate-500">{h.class}</td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                      {DbController.getStudentAttendanceHistory(selectedOverviewStudent.id).length > 10 && (
                        <div className="p-3 bg-slate-50 text-center border-t border-slate-100 text-[10px] text-slate-400 font-medium">
                          Showing most recent 10 logs
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Header Summary */}
                    <div className="bg-white p-6 rounded-[24px] border border-slate-200/60 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h4 className="text-base font-black text-slate-800">Timeline of Academic & Behavioral Journey</h4>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">Chronological log of term assessments, attendance benchmarks, and teacher reflections.</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
                        <div className="flex items-center gap-2 bg-indigo-50/50 border border-indigo-100/60 px-4 py-2 rounded-xl text-indigo-700">
                          <History size={16} className="text-indigo-500" />
                          <span className="text-xs font-bold font-mono">{chronologicalTerms.length} Term{chronologicalTerms.length !== 1 ? 's' : ''} Logged</span>
                        </div>
                        {chronologicalTerms.length > 0 && (
                          <button
                            onClick={() => handleGenerateTranscript(selectedOverviewStudent)}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-lg transition cursor-pointer text-[10px] font-bold uppercase tracking-wider"
                          >
                            <Printer size={14} />
                            Generate Transcript PDF
                          </button>
                        )}
                      </div>
                    </div>

                    {chronologicalTerms.length === 0 ? (
                      <div className="bg-white rounded-[24px] border border-slate-200 p-12 text-center flex flex-col items-center justify-center space-y-3">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                          <History size={24} />
                        </div>
                        <h5 className="text-sm font-bold text-slate-800">No Historical Log Found</h5>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">There are currently no recorded academic assessments, attendance histories, or behavioral reflections for this student.</p>
                      </div>
                    ) : (
                      <div className="relative border-l-2 border-indigo-100/80 ml-4 pl-6 sm:pl-8 space-y-10 py-2">
                        {chronologicalTerms.map((period, periodIdx) => {
                          const assessments = DbController.getStudentAcademicTrends(selectedOverviewStudent.id);
                          const attendanceLogs = DbController.getStudentAttendanceHistory(selectedOverviewStudent.id);
                          const behavioralRemarks = DbController.getBehavioralRemarksForStudent(selectedOverviewStudent.id);
                          const calendar = DbController.getAcademicCalendar();

                          const termAssessments = assessments.filter(a => a.academicYear === period.academicYear && a.term === period.term);
                          
                          const termAttendance = attendanceLogs.filter(log => {
                            const p = getTermAndYearForDate(log.date, calendar);
                            return p && p.academicYear === period.academicYear && p.term === period.term;
                          });

                          const termPresent = termAttendance.filter(a => a.status === 'Present').length;
                          const termAbsent = termAttendance.filter(a => a.status === 'Absent').length;
                          const termHolidays = termAttendance.filter(a => a.status === 'Holiday').length;
                          const termTotal = termPresent + termAbsent;
                          const termRate = termTotal > 0 ? ((termPresent / termTotal) * 100).toFixed(1) : 'N/A';

                          const termRemarks = behavioralRemarks.filter(r => r.academicYear === period.academicYear && r.term === period.term);

                          return (
                            <div key={periodIdx} className="relative group">
                              {/* Timeline dot */}
                              <div className="absolute -left-[35px] sm:-left-[43px] top-1.5 w-6 h-6 rounded-full bg-white border-2 border-indigo-500 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition duration-200 shadow-sm">
                                <Award size={12} />
                              </div>

                              <div className="space-y-4">
                                {/* Term Title & Badges */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                  <div>
                                    <h5 className="text-sm font-black text-slate-800 tracking-tight">
                                      {period.academicYear} • {period.term}
                                    </h5>
                                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                                      Historical Milestone Node
                                    </p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                  {/* Left/Middle Content: Assessments & Attendance */}
                                  <div className="lg:col-span-2 space-y-4">
                                    {/* Assessments Subsection */}
                                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-3xs overflow-hidden">
                                      <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                                        <h6 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                          <BookOpen size={12} className="text-slate-400" />
                                          Assessments & Grades
                                        </h6>
                                        {termAssessments.length > 0 && (
                                          <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold">
                                            {termAssessments.length} Subjects
                                          </span>
                                        )}
                                      </div>
                                      
                                      {termAssessments.length === 0 ? (
                                        <div className="p-6 text-center text-slate-400 text-xs">
                                          No subject assessments logged.
                                        </div>
                                      ) : (
                                        <div className="divide-y divide-slate-100">
                                          {termAssessments.map((a, aIdx) => (
                                            <div key={aIdx} className="p-4 hover:bg-slate-50/30 transition space-y-2">
                                              <div className="flex justify-between items-start gap-4">
                                                <div>
                                                  <div className="text-xs font-bold text-slate-800">{a.subject}</div>
                                                  <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                                                    Grade: <span className="font-bold text-slate-700">{a.gradeLevel}</span> • Remarks: <span className="italic text-slate-500">{a.remarks || 'No remarks'}</span>
                                                  </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                  <span className={`inline-block text-xs font-black px-2.5 py-0.5 rounded-full ${a.totalScore >= 80 ? 'bg-emerald-50 text-emerald-700' : a.totalScore >= 50 ? 'bg-indigo-50 text-indigo-700' : 'bg-rose-50 text-rose-700'}`}>
                                                    {a.totalScore}%
                                                  </span>
                                                </div>
                                              </div>
                                              
                                              {/* Component Breakdown Drawer/Subrow */}
                                              <div className="grid grid-cols-4 gap-2 bg-slate-50/60 p-2 rounded-lg text-[9px] font-medium text-slate-500 font-mono">
                                                <div>Ex: {a.exercises?.join(', ') || 'N/A'}</div>
                                                <div>Tests: {a.tests?.join(', ') || 'N/A'}</div>
                                                <div>Proj: {a.projectWork ?? 'N/A'}</div>
                                                <div>Group: {a.groupWork ?? 'N/A'}</div>
                                              </div>

                                              {a.teacherRemarks && (
                                                <div className="bg-amber-50/40 border-l-2 border-amber-300 p-2 rounded text-[10px] text-slate-600 italic">
                                                  " {a.teacherRemarks} "
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    {/* Attendance Subsection */}
                                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-3xs p-4 space-y-3">
                                      <h6 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                        <Calendar size={12} className="text-slate-400" />
                                        Attendance Benchmark
                                      </h6>

                                      {termAttendance.length === 0 ? (
                                        <div className="text-center text-slate-400 text-xs py-4">
                                          No attendance recorded for this term.
                                        </div>
                                      ) : (
                                        <div className="space-y-3">
                                          <div className="flex justify-between items-center text-xs">
                                            <span className="font-semibold text-slate-600">Punctuality Score:</span>
                                            <span className={`font-black ${Number(termRate) >= 90 ? 'text-emerald-600' : Number(termRate) >= 75 ? 'text-indigo-600' : 'text-rose-600'}`}>
                                              {termRate}%
                                            </span>
                                          </div>
                                          
                                          {/* Sleek progress bar */}
                                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div 
                                              className={`h-full rounded-full ${Number(termRate) >= 90 ? 'bg-emerald-500' : Number(termRate) >= 75 ? 'bg-indigo-500' : 'bg-rose-500'}`}
                                              style={{ width: `${termRate === 'N/A' ? 0 : termRate}%` }}
                                            />
                                          </div>

                                          <div className="flex justify-between text-[10px] font-semibold text-slate-400 font-mono">
                                            <div>Present: <span className="text-emerald-600">{termPresent} days</span></div>
                                            <div>Absent: <span className="text-rose-600">{termAbsent} days</span></div>
                                            <div>Holidays: <span className="text-slate-500">{termHolidays} days</span></div>
                                            <div>Total Logs: {termAttendance.length}</div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Right Content: Teacher Reflections & Remarks */}
                                  <div className="space-y-4">
                                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-3xs overflow-hidden h-full flex flex-col">
                                      <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                                        <h6 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                          <MessageSquare size={12} className="text-slate-400" />
                                          Teacher Reflections
                                        </h6>
                                      </div>

                                      {termRemarks.length === 0 ? (
                                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 text-xs">
                                          <MessageSquare size={16} className="text-slate-300 mb-1" />
                                          No reflections or behavioural remarks logged.
                                        </div>
                                      ) : (
                                        <div className="divide-y divide-slate-100 flex-1 overflow-y-auto max-h-[350px]">
                                          {termRemarks.map((r, rIdx) => (
                                            <div key={rIdx} className="p-4 hover:bg-slate-50/30 transition space-y-2">
                                              <div className="flex justify-between items-center">
                                                <span className={`inline-block px-2 py-0.5 rounded-md text-[8px] font-bold tracking-wider uppercase ${
                                                  r.category === 'Conduct' ? 'bg-blue-50 text-blue-700' :
                                                  r.category === 'Academic' ? 'bg-indigo-50 text-indigo-700' :
                                                  r.category === 'Positive' ? 'bg-emerald-50 text-emerald-700' :
                                                  'bg-amber-50 text-amber-700'
                                                }`}>
                                                  {r.category}
                                                </span>
                                                <span className="text-[9px] font-mono text-slate-400 font-semibold">
                                                  {new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </span>
                                              </div>
                                              
                                              <p className="text-xs text-slate-600 leading-relaxed italic">
                                                " {r.remark} "
                                              </p>
                                              
                                              <div className="text-[9px] text-slate-400 font-bold flex items-center gap-1">
                                                <User size={10} />
                                                <span>{r.teacherName || 'Teacher'}</span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 shrink-0">
                <button
                  onClick={() => setShowOverviewModal(false)}
                  className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg shadow-slate-900/10 transition cursor-pointer text-xs"
                >
                  Dismiss Overview
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SECTION DATA CONTROLS */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3 no-print">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <ShieldAlert className="text-indigo-500" size={14} /> Section Student Controls
        </h4>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          Manage local student profile states, reset database inputs, and trigger cascade purge processes for this module.
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
            <RotateCcw size={13} /> Delete Active / Selected Student
          </button>
          <button
            type="button"
            onClick={handleDeleteAllStudents}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 hover:text-rose-850 hover:bg-rose-100 rounded-xl font-bold font-sans transition text-xs cursor-pointer shadow-xs sm:ml-auto"
          >
            <Trash2 size={13} /> Delete All Section Data
          </button>
        </div>
      </div>

      {/* STUDENT PORTAL QR CODE MODAL */}
      <AnimatePresence>
        {showQrModal && selectedQrStudent && (
          <div 
            onClick={() => setShowQrModal(false)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 no-print overflow-y-auto cursor-pointer font-sans"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ ease: "easeOut", duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[24px] border border-slate-200/50 shadow-2xl max-w-lg w-full overflow-hidden my-8 cursor-default"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 leading-none">
                    <QrCode className="text-emerald-600" size={18} />
                    Individual Portal Access QR
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1">Scan to access private report card and fee payment portal</p>
                </div>
                <button
                  onClick={() => setShowQrModal(false)}
                  className="p-1 px-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-650 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-8 flex flex-col items-center space-y-6 text-center">
                <div 
                  id="student-qr-print-area"
                  className="p-8 bg-white border border-slate-200 rounded-[32px] shadow-sm flex flex-col items-center space-y-4"
                >
                  <div className="text-center space-y-1">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-tight">
                      {selectedQrStudent.firstName} {selectedQrStudent.lastName}
                    </h4>
                    <p className="text-[10px] font-mono text-slate-500">ID: {selectedQrStudent.id} • {selectedQrStudent.class}</p>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-inner">
                    <QRCodeSVG 
                      value={(() => {
                        const yr = selectedQrStudent.academicYear || selectedYear || '2026/2027';
                        const tm = selectedQrStudent.term || selectedTerm || 'Term 1';
                        const token = generateSecureToken(selectedQrStudent.id, yr, tm);
                        return `${window.location.origin}/?studentId=${selectedQrStudent.id}&year=${encodeURIComponent(yr)}&term=${encodeURIComponent(tm)}&token=${token}&parentMode=true`;
                      })()}
                      size={200}
                      level="H"
                      includeMargin={true}
                    />
                  </div>

                  <div className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-100">
                    Institutional Secure Access Portal
                  </div>
                </div>

                <div className="space-y-2 w-full">
                  <p className="text-xs text-slate-500 leading-relaxed px-4">
                    This QR code provides direct access to the parent portal for <strong>{selectedQrStudent.firstName} {selectedQrStudent.lastName}</strong>. It is encrypted and unique to the current academic session.
                  </p>
                  
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col items-center space-y-2">
                    <span className="text-[9px] uppercase font-black text-slate-400 tracking-widest">Portal Token</span>
                    <code className="text-[11px] font-mono font-bold text-slate-800 bg-white px-3 py-1 rounded-lg border border-slate-200">
                      {generateSecureToken(
                        selectedQrStudent.id, 
                        selectedQrStudent.academicYear || selectedYear || '2026/2027', 
                        selectedQrStudent.term || selectedTerm || 'Term 1'
                      )}
                    </code>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowQrModal(false)}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold rounded-xl transition cursor-pointer text-xs"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleShareParentLinkWhatsApp(selectedQrStudent)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-md shadow-indigo-600/10 transition cursor-pointer text-xs flex items-center gap-2 active:scale-95"
                >
                  <Share2 size={14} /> Share via WhatsApp
                </button>
                <button
                  type="button"
                  onClick={handlePrintQrCode}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-md shadow-emerald-600/10 transition cursor-pointer text-xs flex items-center gap-2 active:scale-95"
                >
                  <Printer size={14} /> Print QR Access Card
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

      {/* ENROLLMENT/SAVE CONFIRMATION MODAL */}
      <AnimatePresence>
        {pendingStudent && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) setPendingStudent(null);
            }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 no-print cursor-pointer"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-slate-900 font-sans cursor-default space-y-4"
              id="student-enrollment-confirmation-modal"
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                  <BadgeCheck size={28} />
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                    {isEditing ? "Confirm Record Updates" : "Confirm Student Enrollment"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isEditing ? "Verify and confirm updates to this student profile:" : "Please verify the enrollment registry information below before finalizing:"}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2.5 text-xs">
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500 font-medium">Full Name</span>
                  <span className="text-slate-800 font-semibold">{pendingStudent.firstName} {pendingStudent.middleName ? pendingStudent.middleName + ' ' : ''}{pendingStudent.lastName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500 font-medium">Class Level</span>
                  <span className="text-slate-800 font-semibold">{pendingStudent.class}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500 font-medium">Class / Section</span>
                  <span className="text-slate-800 font-semibold">{pendingStudent.class} • Section: {pendingStudent.section || 'None'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500 font-medium">Gender / Status</span>
                  <span className="text-slate-800 font-semibold">{pendingStudent.gender} / {pendingStudent.status}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500 font-medium">Date of Birth</span>
                  <span className="text-slate-800 font-semibold flex items-center gap-1.5">
                    <span>{pendingStudent.dateOfBirth}</span>
                    {pendingStudent.dateOfBirth && (() => {
                      const ageObj = calculateAgeFromDob(pendingStudent.dateOfBirth);
                      return ageObj ? <span className="text-[10.5px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">({ageObj.formatted})</span> : null;
                    })()}
                  </span>
                </div>
                {pendingStudent.ghanaPostGps && (
                  <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                    <span className="text-slate-500 font-medium">Ghana Post Address</span>
                    <span className="text-emerald-700 font-mono font-bold">{pendingStudent.ghanaPostGps}</span>
                  </div>
                )}
                {(pendingStudent.motherName || pendingStudent.fatherName) && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Parents (M / F)</span>
                    <span className="text-slate-800 font-semibold truncate max-w-[200px]">
                      {pendingStudent.motherName ? `${pendingStudent.motherName} (${pendingStudent.motherStatus || 'Living'})` : ''}
                      {pendingStudent.motherName && pendingStudent.fatherName ? ' • ' : ''}
                      {pendingStudent.fatherName ? `${pendingStudent.fatherName} (${pendingStudent.fatherStatus || 'Living'})` : ''}
                    </span>
                  </div>
                )}
              </div>

              <div className="text-[10px] text-slate-400 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100 text-center">
                🛡️ This student record is secured using client-side AES-256 encryption.
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPendingStudent(null)}
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

      {/* BULK STUDENT QR CODES GENERATOR & PRINTER MODAL */}
      <AnimatePresence>
        {showBulkQrModal && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowBulkQrModal(false);
            }}
            className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 no-print overflow-y-auto cursor-pointer font-sans"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ ease: "easeOut", duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-50 rounded-[28px] border border-slate-200/50 shadow-2xl max-w-6xl w-full flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200 overflow-hidden my-8 max-h-[90vh] cursor-default"
            >
              
              {/* Left Configuration Panel */}
              <div className="w-full md:w-[350px] p-6 bg-white flex flex-col justify-between overflow-y-auto select-none">
                <div className="space-y-6">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 leading-none">
                        <QrCode className="text-indigo-600 animate-pulse" size={18} />
                        Bulk QR Generator
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-1">Bulk-generate secure parent portal QR access keys</p>
                    </div>
                  </div>

                  {/* Format Selector */}
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Print Format Type</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setBulkQrFormat('id_card')}
                        className={`py-2 px-1 text-[10px] font-bold rounded-xl border transition cursor-pointer text-center flex flex-col items-center gap-1 ${bulkQrFormat === 'id_card' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-2 ring-indigo-500/10' : 'bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                      >
                        <IdCard size={14} />
                        <span>ID Card</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setBulkQrFormat('sticker')}
                        className={`py-2 px-1 text-[10px] font-bold rounded-xl border transition cursor-pointer text-center flex flex-col items-center gap-1 ${bulkQrFormat === 'sticker' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-2 ring-indigo-500/10' : 'bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                      >
                        <QrCode size={14} />
                        <span>Sticker</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBulkQrFormat('avery_label');
                          setBulkQrCols(3);
                        }}
                        className={`py-2 px-1 text-[10px] font-bold rounded-xl border transition cursor-pointer text-center flex flex-col items-center gap-1 ${bulkQrFormat === 'avery_label' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-2 ring-indigo-500/10' : 'bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        title="Print student contact info as Avery 5160 address labels"
                      >
                        <Mail size={14} />
                        <span>Avery Label</span>
                      </button>
                    </div>
                  </div>

                  {/* Filtering Controls */}
                  <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Target Filter</span>
                    
                    {/* Class Filter */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-500 block">Class Level</label>
                      <select
                        value={bulkQrClassFilter}
                        onChange={(e) => setBulkQrClassFilter(e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-medium"
                      >
                        <option value="All">All Classes ({students.length} Students)</option>
                        {CLASSES.map(cls => {
                          const count = students.filter(s => s.class === cls).length;
                          return (
                            <option key={cls} value={cls}>{cls} ({count})</option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Search Field */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-500 block">Search Student</label>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 text-slate-400" size={12} />
                        <input
                          type="text"
                          value={bulkQrSearch}
                          onChange={(e) => setBulkQrSearch(e.target.value)}
                          placeholder="Search name or ID..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Print Parameters */}
                  <div className="space-y-3">
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Print Options</span>
                    
                    {/* Grid Columns */}
                    <div className="flex justify-between items-center bg-slate-50/50 p-3 rounded-xl border border-slate-150">
                      <span className="text-xs font-semibold text-slate-700">Cards/Columns per Row</span>
                      <select
                        value={bulkQrCols}
                        onChange={(e) => setBulkQrCols(Number(e.target.value))}
                        className="text-xs px-2 py-1 border border-slate-200 rounded-lg bg-white font-bold text-slate-800"
                      >
                        <option value={2}>2 Columns</option>
                        <option value={3}>3 Columns</option>
                        <option value={4}>4 Columns</option>
                      </select>
                    </div>

                    {/* Toggle Portal Code text */}
                    <label className="flex items-center gap-2 px-3 py-2 bg-slate-50/50 rounded-xl border border-slate-150 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={includePortalToken}
                        onChange={(e) => setIncludePortalToken(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                      />
                      <span className="text-xs font-semibold text-slate-700">Include parent secure token text</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-3 pt-6 border-t border-slate-100">
                  <div className="text-center">
                    <span className="text-[10px] font-bold text-indigo-600">
                      {selectedBulkStudents.length} of {filteredBulkStudents.length} Selected
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handlePrintBulkQrCodes}
                    disabled={selectedBulkStudents.length === 0}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold font-sans text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                  >
                    <Printer size={16} />
                    Trigger QR Code Printer
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBulkQrModal(false)}
                    className="w-full py-2 border border-slate-250 text-slate-500 hover:bg-slate-50 rounded-xl font-bold font-sans text-xs transition cursor-pointer text-center bg-white"
                  >
                    Cancel / Exit
                  </button>
                </div>
              </div>

              {/* Right Selection & Preview Layout */}
              <div className="flex-1 p-6 overflow-y-auto flex flex-col justify-between max-h-[90vh]">
                <div className="space-y-6">
                  {/* Select Actions header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Select Profiles ({filteredBulkStudents.length})</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Toggle checkboxes below to filter print sheets</p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedBulkStudents(filteredBulkStudents.map(s => s.id))}
                        className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 px-2.5 py-1 rounded-lg border border-indigo-150 transition cursor-pointer bg-white"
                      >
                        Select All Filtered
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedBulkStudents([])}
                        className="text-[10px] font-black text-slate-500 hover:text-slate-600 hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 transition cursor-pointer bg-white"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  {/* Checklist of students */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[220px] overflow-y-auto p-3 border border-slate-200/60 bg-white rounded-2xl shadow-inner">
                    {filteredBulkStudents.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center col-span-full py-6">No matching students found with current filters.</p>
                    ) : (
                      filteredBulkStudents.map(student => {
                        const isChecked = selectedBulkStudents.includes(student.id);
                        return (
                          <label 
                            key={student.id} 
                            className={`flex items-start gap-2 p-2 rounded-xl border cursor-pointer select-none transition ${isChecked ? 'bg-indigo-50/30 border-indigo-200 ring-1 ring-indigo-200/50' : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50'}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedBulkStudents(prev => prev.filter(id => id !== student.id));
                                } else {
                                  setSelectedBulkStudents(prev => [...prev, student.id]);
                                }
                              }}
                              className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-[10.5px] font-black text-slate-800 leading-tight truncate">{student.firstName} {student.lastName}</p>
                              <p className="text-[8.5px] font-mono font-medium text-slate-400 truncate mt-0.5">ID: {student.id}</p>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>

                  {/* Print Preview Canvas */}
                  <div className="space-y-3">
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Live Print Canvas Preview</span>
                    
                    <div className="border border-slate-250 bg-slate-200 rounded-3xl p-6 shadow-inner max-h-[350px] overflow-y-auto">
                      <div 
                        id="bulk-qr-print-area" 
                        className="grid gap-6 bg-white p-8 rounded-2xl w-full text-slate-900 font-sans"
                        style={{
                          gridTemplateColumns: `repeat(${bulkQrCols}, minmax(0, 1fr))`
                        }}
                      >
                        {students.filter(s => selectedBulkStudents.includes(s.id)).map(student => {
                          const yr = student.academicYear || selectedYear || '2026/2027';
                          const tm = student.term || selectedTerm || 'Term 1';
                          const token = generateSecureToken(student.id, yr, tm);
                          const portalUrl = `${window.location.origin}/?studentId=${student.id}&year=${encodeURIComponent(yr)}&term=${encodeURIComponent(tm)}&token=${token}&parentMode=true`;

                          if (bulkQrFormat === 'id_card') {
                            return (
                              <div 
                                key={student.id} 
                                className="qr-card-item bg-white text-slate-950 rounded-2xl border border-slate-300 shadow-sm flex flex-col justify-between overflow-hidden relative"
                                style={{ minHeight: '380px' }}
                              >
                                {/* Header banner */}
                                <div className="bg-indigo-950 text-white p-2 text-center relative overflow-hidden flex flex-col items-center justify-center min-h-[55px]">
                                  <div className="relative z-10 flex items-center gap-1.5 max-w-[95%] justify-center">
                                    {DbController.getSchoolInfo().logoUrl ? (
                                      <img 
                                        src={DbController.getSchoolInfo().logoUrl} 
                                        alt="School Logo" 
                                        className="w-5 h-5 object-contain rounded-full bg-white p-0.5"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[7px] font-bold text-white">SCH</div>
                                    )}
                                    <div className="text-left flex-1 min-w-0">
                                      <h4 className="text-[7.5px] font-black uppercase tracking-wide truncate leading-tight">
                                        {DbController.getSchoolInfo().name}
                                      </h4>
                                    </div>
                                  </div>
                                  <div className="absolute bottom-0 right-0 left-0 bg-amber-500 text-[5px] font-extrabold uppercase tracking-widest py-0.5 text-center text-slate-950 z-10">
                                    Parent Portal Access Key
                                  </div>
                                </div>

                                {/* Body */}
                                <div className="flex-1 p-3 flex flex-col items-center justify-center space-y-2 relative z-10 bg-radial from-white to-slate-50/30">
                                  {/* Student Photo or Icon */}
                                  <div className="w-14 h-14 rounded-full border border-indigo-900 overflow-hidden bg-slate-100 flex items-center justify-center shadow-xs">
                                    {student.photoUrl ? (
                                      <img 
                                        src={student.photoUrl} 
                                        alt={`${student.firstName} Photo`} 
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <User size={24} className="text-slate-350" />
                                    )}
                                  </div>

                                  <div className="text-center">
                                    <h3 className="text-[10px] font-black text-slate-900 tracking-tight leading-tight uppercase truncate max-w-[150px]">
                                      {student.firstName} {student.lastName}
                                    </h3>
                                    <p className="text-[6.5px] font-mono font-bold text-indigo-700 tracking-wider mt-0.5">
                                      ID: {student.id}
                                    </p>
                                    <p className="text-[7.5px] font-semibold text-slate-500 mt-0.5">
                                      {student.class}
                                    </p>
                                  </div>

                                  {/* QR Code Container */}
                                  <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-xs flex items-center justify-center">
                                    <QRCodeSVG 
                                      value={portalUrl}
                                      size={100}
                                      level="M"
                                      includeMargin={true}
                                    />
                                  </div>
                                </div>

                                {/* Footer secure line */}
                                {includePortalToken && (
                                  <div className="p-2 bg-slate-50 border-t border-slate-150 flex flex-col items-center justify-center gap-0.5 text-center">
                                    <span className="text-[5.5px] font-black text-slate-400 uppercase tracking-widest">SECURE ACCESS TOKEN</span>
                                    <code className="text-[7px] font-mono font-bold text-slate-800 bg-white border border-slate-200 px-1 rounded truncate max-w-[150px]">
                                      {token}
                                    </code>
                                  </div>
                                )}
                              </div>
                            );
                          } else if (bulkQrFormat === 'avery_label') {
                            return (
                              <div 
                                key={student.id} 
                                className="qr-card-item bg-white text-slate-950 rounded-lg border border-dashed border-slate-300 p-2.5 flex items-start gap-2 overflow-hidden text-left relative font-sans"
                                style={{ height: '96px', maxHeight: '96px', boxSizing: 'border-box' }}
                              >
                                {/* Left: Minimal QR mailing locator */}
                                <div className="shrink-0 bg-white p-1 rounded border border-slate-150 flex items-center justify-center">
                                  <QRCodeSVG 
                                    value={portalUrl}
                                    size={45}
                                    level="L"
                                    includeMargin={false}
                                  />
                                </div>

                                {/* Right: Address and mailing information */}
                                <div className="min-w-0 flex-1 flex flex-col justify-between h-full select-all text-slate-800">
                                  <div>
                                    <div className="flex items-center justify-between gap-1 leading-none">
                                      <p className="text-[9px] font-black text-slate-900 truncate uppercase">
                                        {student.guardianName ? `TO: ${student.guardianName}` : 'TO: Parent / Guardian'}
                                      </p>
                                      <span className="text-[7px] bg-indigo-50 text-indigo-700 font-extrabold px-1 rounded-sm shrink-0 uppercase font-mono">
                                        {student.class}
                                      </span>
                                    </div>
                                    <p className="text-[7.5px] font-medium text-slate-500 leading-tight mt-0.5 truncate">
                                      c/o {student.firstName} {student.lastName} {student.middleName ? `${student.middleName} ` : ''}(ID: {student.id})
                                    </p>
                                    <p className="text-[8px] font-bold text-slate-700 leading-tight mt-1 truncate">
                                      {student.residentialAddress || 'No Residential Address Listed'}
                                    </p>
                                  </div>
                                  <div className="flex items-center justify-between text-[7px] text-slate-400 font-mono border-t border-slate-100 pt-1 leading-none">
                                    <span className="truncate">Parent Portal QR Key</span>
                                    <span className="font-bold text-slate-600">{student.guardianTelephone || 'No Contact Phone'}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          } else {
                            {/* STICKER FORMAT */}
                            return (
                              <div 
                                key={student.id} 
                                className="qr-card-item bg-white text-slate-950 rounded-xl border border-slate-300 p-3.5 flex flex-col items-center justify-between text-center space-y-2 relative shadow-xs"
                                style={{ minHeight: '220px' }}
                              >
                                <div className="space-y-0.5 min-w-0">
                                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-tight truncate leading-tight max-w-[150px]">
                                    {student.firstName} {student.lastName}
                                  </h4>
                                  <p className="text-[7.5px] font-semibold text-slate-500">{student.class}</p>
                                  <p className="text-[6px] font-mono text-slate-400 font-bold">ID: {student.id}</p>
                                </div>

                                <div className="bg-white p-1.5 rounded-lg border border-slate-100 shadow-inner flex items-center justify-center">
                                  <QRCodeSVG 
                                    value={portalUrl}
                                    size={95}
                                    level="M"
                                    includeMargin={true}
                                  />
                                </div>

                                {includePortalToken ? (
                                  <div className="w-full flex flex-col items-center gap-0.5">
                                    <span className="text-[5px] uppercase font-black text-slate-400 tracking-widest">Token Key</span>
                                    <code className="text-[6.5px] font-mono font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded truncate max-w-[140px]">
                                      {token}
                                    </code>
                                  </div>
                                ) : (
                                  <span className="text-[5.5px] font-mono uppercase tracking-widest text-slate-400 font-bold">Scan to Access Portal</span>
                                )}
                              </div>
                            );
                          }
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBulkWhatsAppModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Left Configuration Sidebar */}
              <div className="w-full md:w-80 bg-slate-50 p-6 border-r border-slate-100 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 leading-tight">Bulk WhatsApp</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">Send parents notifications in bulk via WhatsApp messaging.</p>
                  </div>

                  {/* Template Selection */}
                  <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Message Template</span>
                    <div className="space-y-2">
                      <button
                        onClick={() => setBulkWhatsAppTemplate('FEES_REMINDER')}
                        className={`w-full text-left p-3 rounded-xl border transition flex items-center gap-3 ${bulkWhatsAppTemplate === 'FEES_REMINDER' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bulkWhatsAppTemplate === 'FEES_REMINDER' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                          <FileSpreadsheet size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">Fees Reminder</p>
                          <p className="text-[9px] text-slate-500">Outstanding balance alert</p>
                        </div>
                      </button>

                      <button
                        onClick={() => setBulkWhatsAppTemplate('ASSESSMENT_RELEASE')}
                        className={`w-full text-left p-3 rounded-xl border transition flex items-center gap-3 ${bulkWhatsAppTemplate === 'ASSESSMENT_RELEASE' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bulkWhatsAppTemplate === 'ASSESSMENT_RELEASE' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                          <BadgeCheck size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">Report Card</p>
                          <p className="text-[9px] text-slate-500">Assessment release alert</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Filtering Controls */}
                  <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Target Filter</span>
                    
                    {/* Class Filter */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-500 block">Class Level</label>
                      <select
                        value={bulkWhatsAppClassFilter}
                        onChange={(e) => setBulkWhatsAppClassFilter(e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-medium"
                      >
                        <option value="All">All Classes ({students.length} Students)</option>
                        {CLASSES.map(cls => {
                          const count = students.filter(s => s.class === cls).length;
                          return (
                            <option key={cls} value={cls}>{cls} ({count})</option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Search Field */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-500 block">Search Student</label>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 text-slate-400" size={12} />
                        <input
                          type="text"
                          value={bulkWhatsAppSearch}
                          onChange={(e) => setBulkWhatsAppSearch(e.target.value)}
                          placeholder="Search name or ID..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-6 border-t border-slate-100">
                  <div className="text-center">
                    <span className="text-[10px] font-bold text-emerald-600">
                      {selectedBulkWhatsAppStudents.length} of {filteredBulkWhatsAppStudents.length} Selected
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSendBulkWhatsApp}
                    disabled={selectedBulkWhatsAppStudents.length === 0}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold font-sans text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                  >
                    <Share2 size={16} />
                    Send {selectedBulkWhatsAppStudents.length} Messages
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBulkWhatsAppModal(false)}
                    className="w-full py-2 border border-slate-250 text-slate-500 hover:bg-slate-50 rounded-xl font-bold font-sans text-xs transition cursor-pointer text-center bg-white"
                  >
                    Cancel / Exit
                  </button>
                </div>
              </div>

              {/* Right Selection & Preview Layout */}
              <div className="flex-1 p-6 overflow-y-auto flex flex-col justify-between max-h-[90vh]">
                <div className="space-y-6">
                  {/* Select Actions header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Select Recipients ({filteredBulkWhatsAppStudents.length})</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Toggle checkboxes to include/exclude parents</p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedBulkWhatsAppStudents(filteredBulkWhatsAppStudents.map(s => s.id))}
                        className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50/50 px-2.5 py-1 rounded-lg border border-emerald-150 transition cursor-pointer bg-white"
                      >
                        Select All Filtered
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedBulkWhatsAppStudents([])}
                        className="text-[10px] font-black text-slate-500 hover:text-slate-600 hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 transition cursor-pointer bg-white"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  {/* Checklist of students */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[300px] overflow-y-auto p-3 border border-slate-200/60 bg-white rounded-2xl shadow-inner">
                    {filteredBulkWhatsAppStudents.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center col-span-full py-6">No matching students found with current filters.</p>
                    ) : (
                      filteredBulkWhatsAppStudents.map(student => {
                        const isChecked = selectedBulkWhatsAppStudents.includes(student.id);
                        return (
                          <label 
                            key={student.id} 
                            className={`flex items-start gap-2 p-2 rounded-xl border cursor-pointer select-none transition ${isChecked ? 'bg-emerald-50/30 border-emerald-200 ring-1 ring-emerald-200/50' : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50'}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedBulkWhatsAppStudents(prev => prev.filter(id => id !== student.id));
                                } else {
                                  setSelectedBulkWhatsAppStudents(prev => [...prev, student.id]);
                                }
                              }}
                              className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-[10.5px] font-black text-slate-800 leading-tight truncate">{student.firstName} {student.lastName}</p>
                              <p className="text-[8.5px] font-mono font-medium text-slate-400 truncate mt-0.5">Phone: {student.guardianTelephone || 'N/A'}</p>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>

                  {/* Template Preview */}
                  <div className="space-y-3">
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Message Preview (First Selected)</span>
                    
                    <div className="border border-slate-250 bg-slate-100 rounded-3xl p-6 shadow-inner">
                      {selectedBulkWhatsAppStudents.length > 0 ? (
                        (() => {
                          const student = students.find(s => s.id === selectedBulkWhatsAppStudents[0]);
                          if (!student) return null;
                          const yr = student.academicYear || selectedYear || '2026/2027';
                          const tm = student.term || selectedTerm || 'Term 1';
                          const { message } = getWhatsAppShareData(student, yr, tm, bulkWhatsAppTemplate);
                          return (
                            <div className="bg-[#DCF8C6] p-4 rounded-2xl border border-[#C5E1A5] text-slate-800 text-xs font-medium whitespace-pre-wrap shadow-sm relative">
                              <div className="absolute top-2 right-2 flex gap-1">
                                <div className="w-1 h-1 rounded-full bg-slate-400/30" />
                                <div className="w-1 h-1 rounded-full bg-slate-400/30" />
                              </div>
                              {message}
                            </div>
                          );
                        })()
                      ) : (
                        <div className="text-center py-12 text-slate-400 italic text-xs">
                          Select a recipient to see message preview
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {whatsappShareStudent && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-hidden no-print">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 text-left"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900 font-sans tracking-tight">Share via WhatsApp</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Select a notification template for {whatsappShareStudent.firstName} {whatsappShareStudent.lastName}.</p>
                </div>
                <button
                  onClick={() => setWhatsappShareStudent(null)}
                  className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Options */}
              <div className="p-6 space-y-4">
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Message Template</span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setIndividualWhatsAppTemplate('FEES_REMINDER')}
                    className={`text-left p-4 rounded-xl border transition flex flex-col gap-2 ${individualWhatsAppTemplate === 'FEES_REMINDER' ? 'border-emerald-600 bg-emerald-50/50 text-emerald-900' : 'border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-700'}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${individualWhatsAppTemplate === 'FEES_REMINDER' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      <FileSpreadsheet size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold">Fees Reminder</p>
                      <p className="text-[9px] opacity-75">Outstanding balance notice</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setIndividualWhatsAppTemplate('ASSESSMENT_RELEASE')}
                    className={`text-left p-4 rounded-xl border transition flex flex-col gap-2 ${individualWhatsAppTemplate === 'ASSESSMENT_RELEASE' ? 'border-emerald-600 bg-emerald-50/50 text-emerald-900' : 'border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-700'}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${individualWhatsAppTemplate === 'ASSESSMENT_RELEASE' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      <BadgeCheck size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold">Report Card</p>
                      <p className="text-[9px] opacity-75">Academic results release</p>
                    </div>
                  </button>
                </div>

                {/* Message Preview */}
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Message Preview</span>
                  <div className="bg-[#E5DDD5] p-4 rounded-2xl border border-slate-200 shadow-inner max-h-48 overflow-y-auto font-sans leading-relaxed">
                    {(() => {
                      const yr = whatsappShareStudent.academicYear || selectedYear || '2026/2027';
                      const tm = whatsappShareStudent.term || selectedTerm || 'Term 1';
                      const { message } = getWhatsAppShareData(whatsappShareStudent, yr, tm, individualWhatsAppTemplate);
                      return (
                        <div className="bg-[#DCF8C6] p-3.5 rounded-xl border border-[#C5E1A5] text-slate-800 text-xs font-medium whitespace-pre-wrap relative shadow-xs">
                          {message}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button
                  onClick={() => setWhatsappShareStudent(null)}
                  className="flex-1 py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 transition text-center cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const yr = whatsappShareStudent.academicYear || selectedYear || '2026/2027';
                    const tm = whatsappShareStudent.term || selectedTerm || 'Term 1';
                    shareParentPortalWhatsApp(whatsappShareStudent, yr, tm, individualWhatsAppTemplate);
                    setWhatsappShareStudent(null);
                    triggerToast(`Launching WhatsApp for ${whatsappShareStudent.firstName}!`, 'success');
                  }}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition text-center cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <MessageSquare size={14} />
                  Send via WhatsApp
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
        <BatchCameraCaptureModal
          students={students}
          onPhotoCaptured={(studentId, photoUrl) => {
            const studentToUpdate = students.find(s => s.id === studentId);
            if (studentToUpdate) {
              const updated = { ...studentToUpdate, photoUrl };
              DbController.saveStudent(updated);
              onRefresh();
              if (!isAutoSave) {
                onManualSave();
              }
            }
          }}
          onClose={() => setIsBatchCameraOpen(false)}
          theme={theme}
        />
      )}

      {/* SECTION ASSIGNMENT REGISTRY & MANAGEMENT MODAL */}
      {showSectionManagerModal && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSectionManagerModal(false);
          }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[90] p-4 no-print animate-fade-in"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden text-left flex flex-col max-h-[85vh] animate-scale-up">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Users size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-sans">
                    School Section Categories
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Create, view, and remove section assignments for your school
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSectionManagerModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Add New Section form */}
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-indigo-900">
                  Create New Section Category
                </label>
                <p className="text-[10.5px] text-indigo-700/80">
                  Add a custom stream, house, or section (e.g. Gold, Diamond, Emerald, Stream B)
                </p>
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAddSectionFromModal(e);
                  }}
                  className="flex gap-2 pt-1"
                >
                  <input
                    type="text"
                    value={newManagerSectionName}
                    onChange={(e) => setNewManagerSectionName(e.target.value)}
                    placeholder="Enter new section name..."
                    className="flex-1 px-3 py-2 text-xs border border-indigo-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800 placeholder:text-slate-400"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-lg text-xs transition cursor-pointer shrink-0 shadow-xs flex items-center gap-1.5"
                  >
                    <Plus size={13} />
                    <span>Add Section</span>
                  </button>
                </form>
              </div>

              {/* Sections List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600 px-1">
                  <span>Registered Sections ({sectionsList.length})</span>
                  <span className="text-[10px] text-slate-400 font-normal">Click delete icon to remove</span>
                </div>

                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {sectionsList.map((sec) => {
                    const isNone = sec.toLowerCase() === 'none';
                    const assignedCount = students.filter(s => (s.section || '').toLowerCase() === sec.toLowerCase()).length;
                    return (
                      <div
                        key={sec}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition ${
                          isNone 
                            ? 'bg-slate-50 border-slate-200' 
                            : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                            isNone 
                              ? 'bg-slate-200 text-slate-700' 
                              : 'bg-indigo-100 text-indigo-800'
                          }`}>
                            {sec}
                          </span>
                          <div>
                            <p className="text-[11px] font-semibold text-slate-700">
                              {isNone ? 'None (No Section Assignment)' : `Section ${sec}`}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {assignedCount} enrolled student{assignedCount === 1 ? '' : 's'}
                            </p>
                          </div>
                        </div>

                        {isNone ? (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            Required Default
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDeleteSection(sec)}
                            className="p-1.5 px-2 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition cursor-pointer border border-rose-200 flex items-center gap-1 text-[11px] font-bold"
                            title={`Remove section "${sec}"`}
                          >
                            <Trash2 size={12} />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Information Note */}
              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-[10.5px] text-amber-800 leading-relaxed">
                <strong>Institutional Note:</strong> If your school does not use sections, keep students assigned to <strong>'None'</strong>. Removing an existing section automatically updates any currently assigned students to 'None' safely without altering grades or history.
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSectionManagerModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 no-print animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden text-left p-6 space-y-4 animate-scale-up">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl shrink-0 ${confirmModal.danger ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                <AlertTriangle size={24} className="animate-bounce-slow" />
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[110] p-4 no-print animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden text-left p-6 space-y-4 animate-scale-up">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl shrink-0 bg-indigo-50 text-indigo-600">
                <User size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900 font-sans tracking-tight">
                  Enter Student Image URL
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Provide a direct web link to the student's profile photo:
                </p>
                <div className="mt-3">
                  <input
                    type="url"
                    value={tempImageUrl}
                    onChange={(e) => setTempImageUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-800 font-semibold text-xs"
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

      {/* Floating Status Bar for Bulk Operations */}
      <AnimatePresence>
        {selectedStudentIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 z-[100] w-[calc(100vw-1.5rem)] max-w-2xl no-print"
          >
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex flex-col xs:flex-row items-center justify-between gap-3 backdrop-blur-md">
              <div className="flex items-center justify-between xs:justify-start w-full xs:w-auto gap-3 pl-2">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Students Selected</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-white font-mono">{selectedStudentIds.length}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedStudentIds(filteredStudents.map(s => s.id))}
                      className={`text-[9px] font-bold uppercase tracking-tighter px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition cursor-pointer ${selectedStudentIds.length === filteredStudents.length ? 'hidden' : ''}`}
                    >
                      All {filteredStudents.length}
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedStudentIds([])}
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
                      setShouldUpdateStatus(false);
                      setShouldUpdateClass(false);
                      setShouldUpdateAttendance(true);
                      setBulkAttendanceStatus('Present');
                      setShouldUpdateFeeStatus(false);
                      setShowBulkUpdateModal(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold px-2.5 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-emerald-900/20 active:scale-95"
                  >
                    <UserCheck size={14} />
                    <span className="hidden sm:inline">Mark Present</span>
                  </button>

                  <button
                    onClick={() => {
                      setShouldUpdateStatus(false);
                      setShouldUpdateClass(false);
                      setShouldUpdateAttendance(false);
                      setShouldUpdateFeeStatus(true);
                      setShowBulkUpdateModal(true);
                    }}
                    className="bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold px-2.5 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-amber-900/20 active:scale-95"
                  >
                    <CircleDollarSign size={14} />
                    <span className="hidden sm:inline">Mark Paid</span>
                  </button>

                  <button
                    onClick={() => {
                      setShouldUpdateStatus(true);
                      setShouldUpdateClass(true);
                      setShouldUpdateAttendance(false);
                      setShouldUpdateFeeStatus(false);
                      setShowBulkUpdateModal(true);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold px-2.5 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-indigo-900/20 active:scale-95"
                  >
                    <RefreshCw size={14} />
                    <span className="hidden sm:inline">Bulk Actions</span>
                  </button>

                  <div className="h-8 w-px bg-slate-800 mx-1 hidden xs:block"></div>

                  <button
                    onClick={() => setSelectedStudentIds([])}
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
    </div>
  );
}
