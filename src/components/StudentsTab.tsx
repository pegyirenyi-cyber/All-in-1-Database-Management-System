import React, { useState, useRef, ChangeEvent, FormEvent, useMemo, useEffect } from 'react';
import { 
  Student, ClassType, CLASSES, SectionType, SECTIONS, 
  AcademicYearType, ACADEMIC_YEARS, TermType, TERMS, UserRole,
  BehavioralRemark, SubjectType
} from '../types';
import { DbController } from '../db';
import { compressImage } from '../utils';
import { ThemeStyles } from './ThemeWrapper';
import { 
  Plus, Search, Edit2, Trash2, Printer, Upload, X, Check, Save, User, MapPin, PhoneCall, ShieldAlert, BadgeCheck, FileDown, RotateCcw, Eraser, Eye, FileSpreadsheet,
  ChevronLeft, ChevronRight, IdCard, MessageSquare, AlertTriangle, Heart, Award, BookOpen, QrCode, Mail, Camera, Share2, TrendingUp, Calendar, UserCheck, Users
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';
import CameraCapture from './CameraCapture';
import GoogleDriveExportControl from './GoogleDriveExportControl';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { generateSecureToken, getWatermarkHtml, triggerToast, shareParentPortalWhatsApp, getWhatsAppShareData, WhatsAppTemplate } from '../utils';

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
  photoUrl: '',
  academicYear: '2026/2027',
  term: 'Term 1'
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
  const isAdminOrHead = userRole === 'Admin' || userRole === 'Headteacher';
  const [selectedClass, setSelectedClass] = useState<string>(() => {
    if (userRole === 'Teacher') {
      return assignedClasses.length > 0 ? assignedClasses[0] : (assignedClass || 'None');
    }
    return 'All';
  });
  const [selectedSection, setSelectedSection] = useState<string>('All');

  const [studentsSubTab, setStudentsSubTab] = useState<'roster' | 'overview'>('roster');

  useEffect(() => {
    if (userRole === 'Teacher') {
      setSelectedClass(assignedClasses.length > 0 ? assignedClasses[0] : (assignedClass || 'None'));
    }
  }, [assignedClass, assignedClasses, userRole]);
  
  // Pagination states
  const [studentPage, setStudentPage] = useState(1);
  const [studentPageSize, setStudentPageSize] = useState(12);

  // Reset page when search or filters change
  useEffect(() => {
    setStudentPage(1);
  }, [searchTerm, selectedClass, selectedSection, selectedYear, selectedTerm]);
  
  // Modal/Form toggle states
  const [isEditing, setIsEditing] = useState(false);
  const [formState, setFormState] = useState<Partial<Student>>({ ...INITIAL_FORM });
  const [showFormModal, setShowFormModal] = useState(false);
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

  const [isCameraOpen, setIsCameraOpen] = useState(false);
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
  const [bulkWhatsAppTemplate, setBulkWhatsAppTemplate] = useState<WhatsAppTemplate>('PORTAL_ACCESS');
  const [bulkWhatsAppSearch, setBulkWhatsAppSearch] = useState<string>('');
  const [selectedBulkWhatsAppStudents, setSelectedBulkWhatsAppStudents] = useState<string[]>([]);

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

  // Behavioral remarks states
  const [selectedRemarkStudent, setSelectedRemarkStudent] = useState<Student | null>(null);
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  const [newRemarkText, setNewRemarkText] = useState('');
  const [newRemarkCategory, setNewRemarkCategory] = useState<BehavioralRemark['category']>('Conduct');

  // Student Overview states
  const [showOverviewModal, setShowOverviewModal] = useState(false);
  const [selectedOverviewStudent, setSelectedOverviewStudent] = useState<Student | null>(null);
  const [overviewTab, setOverviewTab] = useState<'trends' | 'attendance'>('trends');

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
    const residentialAddressIdx = findIndex(['residentialaddress', 'residential address', 'address']);

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

      // Admin house/section selection
      let section: SectionType = 'None';
      const rawSection = getValue(sectionIdx);
      if (rawSection) {
        const foundSec = SECTIONS.find(s => s.toLowerCase() === rawSection.toLowerCase());
        if (foundSec) {
          section = foundSec;
        } else {
          errors.push(`Invalid Section: "${rawSection}". Specify one of: ${SECTIONS.join(', ')}`);
        }
      } else {
        section = (selectedSection !== 'All' ? selectedSection : 'Faith') as SectionType;
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
        photoUrl: '', // Default blank on bulk uploading
        academicYear: selectedYear || '2026/2027',
        term: selectedTerm || 'Term 1',
        createdAt: new Date().toISOString()
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
              section: (SECTIONS.includes(item.section) ? item.section : 'None') as SectionType,
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
      'Guardian Name', 'Guardian Telephone', 'Guardian Occupation', 'Residential Address'
    ];
    const examples = [
      ['Kofi', 'Kwadwo', 'Mensah', 'Class 1', 'Male', '2016-04-12', 'Kumasi', 'Day', 'Faith', 'Ghanaian', 'Kwame Mensah', '0241234567', 'Trader', '12 Main St Kumasi'],
      ['Ama', 'Osei', 'Sarpong', 'Class 2', 'Female', '2015-08-23', 'Accra', 'Boarder', 'Harmony', 'Ghanaian', 'Abena Sarpong', '0209876543', 'Teacher', 'Plot 45 East Legon']
    ];

    const csvContent = [
      headers.join(','),
      ...examples.map(ex => ex.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "student_bulk_import_template.csv");
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

  // Filter students dynamically with academicYear and term support with high-performance memoization
  const filteredStudents = useMemo(() => {
    const term = searchTerm?.toLowerCase() || '';
    return students.filter(std => {
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
  }, [students, searchTerm, selectedClass, selectedSection, selectedYear, selectedTerm, userRole, assignedClass]);

  // Paginated students slice for desktop UI performance with high-performance memoization
  const totalStudentsCount = filteredStudents.length;
  const totalStudentPages = useMemo(() => Math.ceil(totalStudentsCount / studentPageSize), [totalStudentsCount, studentPageSize]);
  const activeStudentPage = Math.min(Math.max(1, studentPage), totalStudentPages || 1);
  
  const paginatedStudents = useMemo(() => {
    return filteredStudents.slice((activeStudentPage - 1) * studentPageSize, activeStudentPage * studentPageSize);
  }, [filteredStudents, activeStudentPage, studentPageSize]);

  const handleExportCSV = () => {
    const headers = [
      'Student ID', 'First Name', 'Middle Name', 'Last Name', 'Class', 'Gender',
      'Date of Birth', 'Place of Birth', 'Status', 'Section', 'Nationality',
      'Guardian Name', 'Guardian Telephone', 'Guardian Occupation', 'Residential Address', 
      'Academic Year', 'Academic Term', 'Created At'
    ];
    
    const csvRows = [headers.join(',')];
    
    for (const std of filteredStudents) {
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
        std.section,
        std.nationality,
        std.guardianName,
        std.guardianTelephone,
        std.guardianOccupation,
        std.residentialAddress,
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
    link.setAttribute("download", `student_database_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenAdd = () => {
    setFormState({ 
      ...INITIAL_FORM, 
      id: 'ST' + Math.floor(100000 + Math.random() * 90000),
      class: userRole === 'Teacher' && assignedClass ? assignedClass : 'Basic 1',
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
    const url = prompt("Enter online image URL:");
    if (url) {
      setFormState(prev => ({ ...prev, photoUrl: url }));
    }
  };

  const handleSaveSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formState.firstName || !formState.lastName || !formState.class || !formState.dateOfBirth) {
      alert("Please populate all required fields (*)");
      return;
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
      section: formState.section as SectionType,
      nationality: formState.nationality || 'Ghanaian',
      guardianName: formState.guardianName || '',
      guardianTelephone: formState.guardianTelephone || '',
      guardianOccupation: formState.guardianOccupation || '',
      guardianEmail: formState.guardianEmail || '',
      email: formState.email || '',
      residentialAddress: formState.residentialAddress || '',
      photoUrl: formState.photoUrl || '',
      academicYear: formState.academicYear || selectedYear || '2026/2027',
      term: formState.term || selectedTerm || 'Term 1',
      createdAt: formState.createdAt || new Date().toISOString()
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
    const badgeElement = document.getElementById('student-id-card-print-area');
    if (!badgeElement) {
      try {
        window.print();
      } catch (e) {
        console.warn("Direct print restricted inside sandbox iframe:", e);
        setPrintBlocked(true);
      }
      return;
    }

    try {
      // Open a clean blank tab for printing to bypass iframe restrictions
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        // Fallback if popup is blocked
        window.print();
        return;
      }

      // Extract all current styles from the main document to preserve Tailwind classes & custom styling perfectly
      let stylesHtml = '';
      const styleSheets = document.head.querySelectorAll('style, link[rel="stylesheet"]');
      styleSheets.forEach((el) => {
        stylesHtml += el.outerHTML;
      });

      const badgeHtml = badgeElement.outerHTML;

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>ID Badge - ${selectedIdCardStudent.firstName} ${selectedIdCardStudent.lastName}</title>
            ${stylesHtml}
            <style>
              body {
                margin: 0;
                padding: 0;
                background-color: #ffffff;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
              }
              /* Center the badge card on print layout */
              @media print {
                @page {
                  size: portrait;
                  margin: 0;
                }
                body {
                  background-color: #ffffff;
                  min-height: auto;
                  display: block;
                  margin: 0;
                  padding: 0;
                }
                #student-id-card-print-area {
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%) scale(1.1) !important;
                  box-shadow: none !important;
                  border: 1px solid #1e293b !important;
                  border-radius: 12px !important;
                  page-break-inside: avoid !important;
                  page-break-after: avoid !important;
                }
              }
            </style>
          </head>
          <body>
            ${badgeHtml}
            <script>
              window.addEventListener('load', () => {
                setTimeout(() => {
                  window.focus();
                  window.print();
                  window.onafterprint = () => {
                    window.close();
                  };
                }, 500);
              });
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (e) {
      console.warn("Popup blocked or direct print restricted:", e);
      try {
        window.print();
      } catch (err) {
        setPrintBlocked(true);
      }
    }
  };

  const handlePrintQrCode = () => {
    if (!selectedQrStudent) return;
    const qrElement = document.getElementById('student-qr-print-area');
    if (!qrElement) return;

    window.print();
  };

  const handleShareParentLinkWhatsApp = (student: any) => {
    const yr = student.academicYear || selectedYear || '2026/2027';
    const tm = student.term || selectedTerm || 'Term 1';
    shareParentPortalWhatsApp(student, yr, tm);
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

      {studentsSubTab === 'roster' ? (
        <>
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
              className="w-full sm:w-60 text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
            />
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
            onChange={(e) => setSelectedSection(e.target.value)}
            className="text-xs px-2.5 py-2 border border-slate-200 rounded-lg bg-white"
          >
            <option value="All">All Sections</option>
            {SECTIONS.map(sec => (
              <option key={sec} value={sec}>{sec}</option>
            ))}
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
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 border border-emerald-600 text-white hover:bg-emerald-700 active:translate-y-0.5 transition text-xs font-semibold rounded-lg cursor-pointer shadow-xs"
            title="Export filtered/all records to a CSV spreadsheet"
          >
            <FileSpreadsheet size={15} /> Export to CSV
          </button>
          {isAdminOrHead && (
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 border border-blue-600 text-white hover:bg-blue-700 active:translate-y-0.5 transition text-xs font-semibold rounded-lg cursor-pointer shadow-xs"
              title="Import student records from a formatted CSV or JSON file"
            >
              <Upload size={15} /> Bulk Import (CSV/JSON)
            </button>
          )}
          <button
            onClick={handleOpenBulkQrModal}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 border border-indigo-600 text-white hover:bg-indigo-700 active:translate-y-0.5 transition text-xs font-semibold rounded-lg cursor-pointer shadow-xs"
            title="Generate and bulk-print student QR codes"
          >
            <QrCode size={15} /> Bulk QR Codes
          </button>
          {(userRole === 'Admin' || userRole === 'Teacher') && (
            <button
              onClick={handleOpenBulkWhatsAppModal}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 border border-emerald-600 text-white hover:bg-emerald-700 active:translate-y-0.5 transition text-xs font-semibold rounded-lg cursor-pointer shadow-xs"
              title="Send bulk WhatsApp notifications to parents"
            >
              <Share2 size={15} /> Bulk WhatsApp
            </button>
          )}
          <button
            onClick={() => setShowPdfGuide(!showPdfGuide)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-900 text-white hover:bg-slate-800 active:translate-y-0.5 transition text-xs font-semibold rounded-lg cursor-pointer"
          >
            <Eye size={15} /> Toggle Preview Mode
          </button>
          <button
            onClick={handleOpenAdd}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer active:translate-y-0.5 transition ${theme.btnColors}`}
          >
            <Plus size={16} /> Add Student
          </button>
        </div>
      </div>

      {/* Grid container of student cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 no-print">
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
        ) : (
          paginatedStudents.map((std, idx) => (
            <motion.div 
              key={std.id}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition duration-200 flex flex-col justify-between"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.4), ease: 'easeOut' }}
            >
              <div className="p-4 flex gap-4">
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
                    className="p-1 hover:bg-emerald-50 hover:text-emerald-600 rounded text-emerald-650 cursor-pointer transition"
                    title="Share Parent Access Link via WhatsApp"
                  >
                    <Share2 size={12} />
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
      </>
      ) : (
        <div className="animate-fade-in space-y-6">
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
        </div>
      )}

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
                    <label className="block text-slate-600 font-medium mb-1">Section Assignment</label>
                    <select
                      value={formState.section}
                      onChange={(e) => setFormState(prev => ({ ...prev, section: e.target.value as SectionType }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none"
                    >
                      {SECTIONS.map(sec => (
                        <option key={sec} value={sec}>{sec}</option>
                      ))}
                    </select>
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
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Date of Birth *</label>
                    <input
                      type="date"
                      value={formState.dateOfBirth}
                      onChange={(e) => setFormState(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                      required
                    />
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
                    <label className="block text-slate-600 font-medium mb-1">Nationality</label>
                    <input
                      type="text"
                      value={formState.nationality}
                      onChange={(e) => setFormState(prev => ({ ...prev, nationality: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                      placeholder="e.g. Ghanaian"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Day / Boarder status</label>
                    <select
                      value={formState.status}
                      onChange={(e) => setFormState(prev => ({ ...prev, status: e.target.value as 'Day' | 'Boarder' }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="Day">Day Status</option>
                      <option value="Boarder">Boarding Status</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Step 2: Guardian Details */}
              <div className="space-y-4 pt-1">
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider pb-1 border-b border-slate-100">Guardian / Family Contacts</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Guardian Full Name</label>
                    <input
                      type="text"
                      value={formState.guardianName}
                      onChange={(e) => setFormState(prev => ({ ...prev, guardianName: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                      placeholder="Parent/Guardian Name"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Telephone Contact</label>
                    <input
                      type="text"
                      value={formState.guardianTelephone}
                      onChange={(e) => setFormState(prev => ({ ...prev, guardianTelephone: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                      placeholder="Phone digits"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Guardian Email</label>
                    <input
                      type="email"
                      value={formState.guardianEmail}
                      onChange={(e) => setFormState(prev => ({ ...prev, guardianEmail: e.target.value, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                      placeholder="e.g. parent@email.com"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Occupation</label>
                    <input
                      type="text"
                      value={formState.guardianOccupation}
                      onChange={(e) => setFormState(prev => ({ ...prev, guardianOccupation: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                      placeholder="e.g. Merchant"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-medium mb-1">Residential Address</label>
                  <input
                    type="text"
                    value={formState.residentialAddress}
                    onChange={(e) => setFormState(prev => ({ ...prev, residentialAddress: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                    placeholder="e.g., PLT 12 BLK B, Kumasi"
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
              
              <div id="students-roster-preview-card" className="relative w-full max-w-[650px] aspect-[1.414/1] bg-white p-6 text-black border shadow-2xl text-[8px] space-y-3 font-sans rounded-none overflow-y-auto">
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
            <div className="w-full md:w-[400px] p-6 bg-white flex flex-col justify-between overflow-y-auto max-h-none md:max-h-[90vh]">
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
                                    <td className="py-2 px-3 font-mono text-slate-500">{student.dateOfBirth || <span className="text-red-400 italic">None</span>}</td>
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
                  id="student-id-card-print-area" 
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
              <div className="w-full md:w-[400px] p-6 bg-white flex flex-col justify-between overflow-y-auto max-h-none md:max-h-[90vh]">
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
                    isLandscape={false} 
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

      {/* STUDENT BEHAVIORAL REMARKS LOG & TRACKER MODAL */}
      <AnimatePresence>
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
                      <textarea
                        value={newRemarkText}
                        onChange={(e) => setNewRemarkText(e.target.value)}
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
                <button 
                  onClick={() => setShowOverviewModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X size={20} />
                </button>
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
                ) : (
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
          <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl text-white transition-all duration-300 transform translate-y-0 ${
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
                  <span className="text-slate-500 font-medium">Gender / Status</span>
                  <span className="text-slate-800 font-semibold">{pendingStudent.gender} / {pendingStudent.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Date of Birth</span>
                  <span className="text-slate-800 font-semibold">{pendingStudent.dateOfBirth}</span>
                </div>
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
                        onClick={() => setBulkWhatsAppTemplate('PORTAL_ACCESS')}
                        className={`w-full text-left p-3 rounded-xl border transition flex items-center gap-3 ${bulkWhatsAppTemplate === 'PORTAL_ACCESS' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bulkWhatsAppTemplate === 'PORTAL_ACCESS' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                          <Share2 size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">Portal Access</p>
                          <p className="text-[9px] text-slate-500">General link sharing</p>
                        </div>
                      </button>

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

      {isCameraOpen && (
        <CameraCapture 
          onCapture={(url) => setFormState(prev => ({ ...prev, photoUrl: url }))} 
          onClose={() => setIsCameraOpen(false)} 
        />
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
    </div>
  );
}
