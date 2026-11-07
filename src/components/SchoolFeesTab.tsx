import React, { useState, useMemo, useRef, ChangeEvent, FormEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CreateBillCategoryModal from './finances/CreateBillCategoryModal';
import { 
  Student, 
  ClassType, 
  CLASSES, 
  AcademicYearType, 
  ACADEMIC_YEARS, 
  TermType, 
  TERMS, 
  StudentFeeBill, 
  FeePayment, 
  SchoolInfo,
  CustomBillComponent,
  CustomBillComponentItem,
  BillComponentCategory
} from '../types';
import { DbController, getStorageItem, setStorageItem } from '../db';
import { QRCodeSVG } from 'qrcode.react';
import PaystackPaymentTrigger from './PaystackPaymentTrigger';
import { generatePdfFromHtml, downloadBlobLocally } from '../pdfHelper';
import { ThemeStyles } from './ThemeWrapper';
import { generateSecureToken, getWatermarkHtml, formatIdentifiableFilename } from '../utils';
import { isGoogleAuthenticated, sendGmailMessage } from '../googleDriveService';
import SmartTextarea from './SmartTextarea';
import { AcademicYearModal } from './common/AcademicYearModal';
import { 
  DollarSign, 
  Plus, 
  Search, 
  Printer, 
  Trash2, 
  X, 
  Check, 
  Save, 
  FileDown, 
  FileSpreadsheet,
  Coins, 
  Receipt, 
  CreditCard, 
  Calendar, 
  User, 
  Info, 
  Filter, 
  BookOpen, 
  AlertTriangle,
  Eraser,
  RotateCcw,
  Eye,
  Bell,
  Mail,
  Send,
  MessageSquare,
  PieChart as PieChartIcon,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
  Percent,
  Layers,
  Edit2,
  Settings2,
  RefreshCw,
  Tag,
  SlidersHorizontal,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

export function calculateBillExpected(bill: StudentFeeBill | null | undefined): number {
  if (!bill) return 0;
  const base = 
    (Number(bill.schoolFees) || 0) + 
    (Number(bill.utilityBill) || 0) + 
    (Number(bill.sportsFees) || 0) + 
    (Number(bill.ptaDues) || 0) + 
    (Number(bill.transportationBill) || 0) + 
    (Number(bill.otherFee) || 0);
  const customTotal = (bill.customComponents || []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  return base + customTotal;
}
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  Legend 
} from 'recharts';

interface Props {
  theme: ThemeStyles;
  students: Student[];
  schoolInfo: SchoolInfo;
  isAutoSave: boolean;
  onManualSave: () => void;
  selectedAcademicYear?: AcademicYearType;
  setSelectedAcademicYear?: (yr: AcademicYearType) => void;
  selectedTerm?: TermType;
  setSelectedTerm?: (tm: TermType) => void;
}

export default function SchoolFeesTab({ 
  theme, 
  students, 
  schoolInfo, 
  isAutoSave, 
  onManualSave,
  selectedAcademicYear: propAcademicYear,
  setSelectedAcademicYear: propSetAcademicYear,
  selectedTerm: propTerm,
  setSelectedTerm: propSetTerm
}: Props) {
  // Navigation & selectors
  const [localAcademicYear, setLocalAcademicYear] = useState<AcademicYearType>('2026/2027');
  const [localTerm, setLocalTerm] = useState<TermType>('Term 1');

  const selectedAcademicYear = propAcademicYear || localAcademicYear;
  const setSelectedAcademicYear = propSetAcademicYear || setLocalAcademicYear;

  const selectedTerm = propTerm || localTerm;
  const setSelectedTerm = propSetTerm || setLocalTerm;

  const [academicYearsList, setAcademicYearsList] = useState<AcademicYearType[]>(() => DbController.getAcademicYears());
  const [showAcademicYearModal, setShowAcademicYearModal] = useState(false);

  useEffect(() => {
    const handleSyncYears = () => setAcademicYearsList(DbController.getAcademicYears());
    window.addEventListener('academic-years-updated', handleSyncYears);
    return () => window.removeEventListener('academic-years-updated', handleSyncYears);
  }, []);

  const [selectedClass, setSelectedClass] = useState<ClassType | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected student for billing setup & details
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);

  // Core billing states loading
  const [feeBills, setFeeBills] = useState<StudentFeeBill[]>(() => DbController.getStudentFeeBills());
  
  // Add payment form states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTab, setPaymentTab] = useState<'manual' | 'paystack'>('manual');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentComponent, setPaymentComponent] = useState<FeePayment['component']>('School Fees');
  const [paymentMethod, setPaymentMethod] = useState<FeePayment['method']>('Cash');
  const [paymentRemarks, setPaymentRemarks] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isCreateCategoryModalOpen, setIsCreateCategoryModalOpen] = useState(false);
  const [customBillComponents, setCustomBillComponents] = useState<CustomBillComponent[]>(() => DbController.getCustomBillComponents());
  const [showComponentsManagerModal, setShowComponentsManagerModal] = useState(false);
  const [editingComponent, setEditingComponent] = useState<CustomBillComponent | null>(null);
  const [showQuickCreateInModal, setShowQuickCreateInModal] = useState(false);
  const [newComponentForm, setNewComponentForm] = useState({
    name: '',
    code: '',
    category: 'Academic' as BillComponentCategory,
    defaultAmount: 50,
    frequency: 'Per Term' as 'Per Term' | 'Per Year' | 'One-Time' | 'Optional',
    isAllClasses: true,
    selectedClasses: [] as ClassType[],
    isRequired: true,
    description: ''
  });

  // Dedicated granular bill components section state
  const [inlineNewComp, setInlineNewComp] = useState<{
    name: string;
    code: string;
    category: BillComponentCategory;
    defaultAmount: string;
    frequency: 'Per Term' | 'Per Year' | 'One-Time' | 'Optional';
    applicableClasses: (ClassType | 'All')[];
  }>({
    name: '',
    code: '',
    category: 'Academic',
    defaultAmount: '',
    frequency: 'Per Term',
    applicableClasses: ['All']
  });
  const [showInlineAddRow, setShowInlineAddRow] = useState(false);
  const [componentSearchQuery, setComponentSearchQuery] = useState('');
  const [componentCategoryFilter, setComponentCategoryFilter] = useState<'All' | BillComponentCategory>('All');

  useEffect(() => {
    const handleCompUpdate = () => {
      setCustomBillComponents(DbController.getCustomBillComponents());
    };
    window.addEventListener('bill-components-updated', handleCompUpdate);
    return () => window.removeEventListener('bill-components-updated', handleCompUpdate);
  }, []);

  // Selected payment for receipt viewing/generation
  const [activeReceiptPayment, setActiveReceiptPayment] = useState<{ bill: StudentFeeBill; payment: FeePayment } | null>(null);
  const [activeLedgerStudent, setActiveLedgerStudent] = useState<StudentFeeBill | null>(null);
  const [receiptEmailOverride, setReceiptEmailOverride] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Payment Reminder states
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderCustomMessage, setReminderCustomMessage] = useState('');
  const [reminderClosingDate, setReminderClosingDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [reminderRecipientPhone, setReminderRecipientPhone] = useState('');
  const [reminderSendingSms, setReminderSendingSms] = useState(false);
  const [reminderSmsSuccess, setReminderSmsSuccess] = useState<string | null>(null);

  // Automated Fee Invoice States
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [invoiceDueDate, setInvoiceDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [invoiceNotes, setInvoiceNotes] = useState(
    'Please deposit outstanding fees directly into the school account: GeeTech Academy, GCB Bank, Account No. 10111223344, or send via MTN Mobile Money to 0244123456 (Merchant: GeeTech Academy). Please present your deposit slip or transaction ID to the accounts office for official receipting.'
  );

  // SMS Logs for delivery tracking
  const [smsLogs, setSmsLogs] = useState<{ sid: string; studentName: string; phone: string; status: string; sentAt: number }[]>(() => {
    return getStorageItem('smsLogs_fees_reminders', []);
  });

  const [bulkReceiptData, setBulkReceiptData] = useState<{ bill: StudentFeeBill; payment: FeePayment }[]>([]);

  // Debtors Analyzer states
  const [showDebtorsModal, setShowDebtorsModal] = useState(false);
  const [debtorMinAmount, setDebtorMinAmount] = useState('1');
  const [debtorSelectedClassFilter, setDebtorSelectedClassFilter] = useState<ClassType | 'All'>('All');
  const [debtorSearchQuery, setDebtorSearchQuery] = useState('');

  // Report Center states
  const [showReportCenterModal, setShowReportCenterModal] = useState(false);
  const [reportCenterType, setReportCenterType] = useState<'student' | 'class' | 'school'>('student');
  const [reportCenterSelectedStudentId, setReportCenterSelectedStudentId] = useState<string>('');
  const [reportCenterSelectedClass, setReportCenterSelectedClass] = useState<ClassType | 'All'>('All');
  const [reportCenterSearchQuery, setReportCenterSearchQuery] = useState('');

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

  const [showBulkBillingModal, setShowBulkBillingModal] = useState(false);
  const [bulkSchoolFeesAmount, setBulkSchoolFeesAmount] = useState('400');

  // Fee Distribution Pie Chart Filter & Metric Toggle States
  const [chartMetricType, setChartMetricType] = useState<'students' | 'amount'>('students');
  const [chartClassFilter, setChartClassFilter] = useState<ClassType | 'All'>('All');

  // Specific Bill Component PDF Receipts Hub state
  const [showComponentReceiptsModal, setShowComponentReceiptsModal] = useState(false);
  const [selectedReceiptComponent, setSelectedReceiptComponent] = useState<string>('All');
  const [receiptComponentClassFilter, setReceiptComponentClassFilter] = useState<ClassType | 'All'>('All');
  const [receiptComponentSearchQuery, setReceiptComponentSearchQuery] = useState('');
  const [isGeneratingComponentPdf, setIsGeneratingComponentPdf] = useState(false);
  const [pdfTargetPayment, setPdfTargetPayment] = useState<{ bill: StudentFeeBill; payment: FeePayment } | null>(null);
  const [activeInstallmentComponentFilter, setActiveInstallmentComponentFilter] = useState<string>('All');

  // Initialize Report Center student when modal opens
  useEffect(() => {
    if (showReportCenterModal) {
      if (activeStudentId) {
        setReportCenterSelectedStudentId(activeStudentId);
      } else if (students.length > 0) {
        setReportCenterSelectedStudentId(students[0].id);
      }
    }
  }, [showReportCenterModal, activeStudentId, students]);

  // Report Center calculations
  const reportCenterSelectedStudent = useMemo(() => {
    return students.find(s => s.id === reportCenterSelectedStudentId);
  }, [students, reportCenterSelectedStudentId]);

  const reportCenterSelectedStudentBill = useMemo(() => {
    if (!reportCenterSelectedStudent) return null;
    return getStudentBill(reportCenterSelectedStudent);
  }, [reportCenterSelectedStudent, feeBills, selectedAcademicYear, selectedTerm]);

  const reportCenterSelectedStudentStats = useMemo(() => {
    if (!reportCenterSelectedStudent || !reportCenterSelectedStudentBill) return { expected: 0, paid: 0, bal: 0 };
    const expected = calculateBillExpected(reportCenterSelectedStudentBill);
    const paid = (reportCenterSelectedStudentBill.payments || []).reduce((sum, p) => sum + (Number(p?.amount) || 0), 0);
    const bal = expected - paid;
    return { expected, paid, bal };
  }, [reportCenterSelectedStudent, reportCenterSelectedStudentBill]);

  const reportCenterClassStudents = useMemo(() => {
    if (reportCenterSelectedClass === 'All') return students;
    return students.filter(s => s.class === reportCenterSelectedClass);
  }, [students, reportCenterSelectedClass]);

  const reportCenterClassData = useMemo(() => {
    const list = reportCenterClassStudents.map(student => {
      const bill = getStudentBill(student);
      const expected = calculateBillExpected(bill);
      const paid = bill.payments ? bill.payments.reduce((sum, p) => sum + p.amount, 0) : 0;
      const owed = expected - paid;
      return {
        student,
        bill,
        expected,
        paid,
        owed
      };
    });

    const totalExpected = list.reduce((sum, item) => sum + item.expected, 0);
    const totalPaid = list.reduce((sum, item) => sum + item.paid, 0);
    const totalOwed = list.reduce((sum, item) => sum + item.owed, 0);

    return {
      list,
      totalExpected,
      totalPaid,
      totalOwed
    };
  }, [reportCenterClassStudents, feeBills, selectedAcademicYear, selectedTerm]);

  const reportCenterSchoolData = useMemo(() => {
    const classStats = CLASSES.map(cls => {
      const classStudents = students.filter(s => s.class === cls);
      let totalExpected = 0;
      let totalPaid = 0;
      classStudents.forEach(student => {
        const bill = getStudentBill(student);
        const expected = calculateBillExpected(bill);
        const paid = bill.payments ? bill.payments.reduce((sum, p) => sum + p.amount, 0) : 0;
        totalExpected += expected;
        totalPaid += paid;
      });
      const totalOwed = totalExpected - totalPaid;
      const rate = totalExpected > 0 ? Math.round((totalPaid / totalExpected) * 100) : 0;
      return {
        class: cls,
        count: classStudents.length,
        totalExpected,
        totalPaid,
        totalOwed,
        rate
      };
    }).filter(s => s.count > 0 || s.totalExpected > 0);

    const overallExpected = classStats.reduce((sum, s) => sum + s.totalExpected, 0);
    const overallPaid = classStats.reduce((sum, s) => sum + s.totalPaid, 0);
    const overallOwed = overallExpected - overallPaid;
    const overallRate = overallExpected > 0 ? Math.round((overallPaid / overallExpected) * 100) : 0;

    return {
      classStats,
      overallExpected,
      overallPaid,
      overallOwed,
      overallRate
    };
  }, [students, feeBills, selectedAcademicYear, selectedTerm]);

  // Helper: Retrieve component-specific expected debit on a student bill
  const getComponentExpectedAmount = (bill: StudentFeeBill | null | undefined, componentName: string): number => {
    if (!bill || !componentName) return 0;
    const cLower = componentName.toLowerCase().trim();
    if (cLower === 'school fees') return Number(bill.schoolFees) || 0;
    if (cLower === 'utility bill') return Number(bill.utilityBill) || 0;
    if (cLower === 'sports fees') return Number(bill.sportsFees) || 0;
    if (cLower === 'pta dues') return Number(bill.ptaDues) || 0;
    if (cLower === 'transportation bill') return Number(bill.transportationBill) || 0;
    if (cLower === 'other fee' || cLower.includes('other')) return Number(bill.otherFee) || 0;
    
    const custom = (bill.customComponents || []).find(c => c && (c.componentName || '').toLowerCase().trim() === cLower);
    return custom ? (Number(custom.amount) || 0) : 0;
  };

  // Helper: Retrieve total paid to-date specifically towards a component on a student bill
  const getComponentPaidAmount = (bill: StudentFeeBill | null | undefined, componentName: string): number => {
    if (!bill || !componentName) return 0;
    const cLower = componentName.toLowerCase().trim();
    return (bill.payments || [])
      .filter(p => p && (p.component || '').toLowerCase().trim() === cLower)
      .reduce((sum, p) => sum + (Number(p?.amount) || 0), 0);
  };

  // All recorded component payments across all active bills
  const allComponentPayments = useMemo(() => {
    const list: { bill: StudentFeeBill; payment: FeePayment }[] = [];
    feeBills
      .filter(b => b && b.academicYear === selectedAcademicYear && b.term === selectedTerm)
      .forEach(bill => {
        (bill.payments || []).forEach(payment => {
          if (payment) {
            list.push({ bill, payment });
          }
        });
      });
    return list;
  }, [feeBills, selectedAcademicYear, selectedTerm]);

  // Unique list of component names present in payments or defined in components
  const availableComponentNames = useMemo(() => {
    const names = new Set<string>();
    // Standard components
    names.add('School Fees');
    names.add('Exam Fees');
    names.add('Library Levy');
    names.add('ICT Lab Levy');
    names.add('Utility Bill');
    names.add('Sports Fees');
    names.add('PTA Dues');
    names.add('Transportation Bill');
    names.add('Other Fee');
    // Add custom bill components
    (customBillComponents || []).forEach(c => {
      if (c && c.name) names.add(c.name);
    });
    // Add any component from recorded payments
    allComponentPayments.forEach(item => {
      if (item.payment && item.payment.component) names.add(item.payment.component);
    });
    return Array.from(names);
  }, [customBillComponents, allComponentPayments]);

  // Filtered component payments for the receipts hub
  const filteredComponentPayments = useMemo(() => {
    return allComponentPayments.filter(item => {
      if (!item || !item.payment || !item.bill) return false;
      // 1. Component filter
      if (selectedReceiptComponent !== 'All') {
        const itemComp = (item.payment.component || 'School Fees').toLowerCase().trim();
        const selComp = selectedReceiptComponent.toLowerCase().trim();
        if (itemComp !== selComp) {
          return false;
        }
      }
      // 2. Class filter
      if (receiptComponentClassFilter !== 'All') {
        if (item.bill.class !== receiptComponentClassFilter) return false;
      }
      // 3. Search query
      if (receiptComponentSearchQuery.trim()) {
        const q = receiptComponentSearchQuery.toLowerCase();
        const sName = (item.bill.studentName || '').toLowerCase();
        const sId = (item.bill.studentId || '').toLowerCase();
        const rNo = (item.payment.receiptNo || '').toLowerCase();
        if (!sName.includes(q) && !sId.includes(q) && !rNo.includes(q)) return false;
      }
      return true;
    });
  }, [allComponentPayments, selectedReceiptComponent, receiptComponentClassFilter, receiptComponentSearchQuery]);

  const handlePrintReportCenter = () => {
    let title = 'School Ledger Summary';
    if (reportCenterType === 'student') {
      title = `Student Fee Ledger - ${reportCenterSelectedStudent?.firstName || ''} ${reportCenterSelectedStudent?.lastName || ''}`;
    } else if (reportCenterType === 'class') {
      title = `Class Fee Ledger - ${reportCenterSelectedClass}`;
    }
    handlePrintStandard('report-center-preview-content', title);
  };

  const handleDownloadReportCenterPDF = () => {
    let filename = '';
    const cleanFn = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '_');
    if (reportCenterType === 'student') {
      filename = `Fees_Ledger_${cleanFn(reportCenterSelectedStudent?.firstName || 'Student')}_${selectedAcademicYear.replace('/', '_')}_${selectedTerm.replace(' ', '_')}`;
    } else if (reportCenterType === 'class') {
      filename = `Class_Ledger_${cleanFn(reportCenterSelectedClass)}_${selectedAcademicYear.replace('/', '_')}_${selectedTerm.replace(' ', '_')}`;
    } else {
      filename = `School_Ledger_Summary_${selectedAcademicYear.replace('/', '_')}_${selectedTerm.replace(' ', '_')}`;
    }
    handleExportFeesPDF('report-center-preview-content', filename);
  };

  const handleExportReportCenterCSV = () => {
    const escapeCSV = (val: string | number | undefined | null): string => {
      if (val === undefined || val === null) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    let csvContent = "";
    let filename = "";
    const cleanFn = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '_');

    if (reportCenterType === 'student') {
      if (!reportCenterSelectedStudent || !reportCenterSelectedStudentBill) {
        showToast("No student selected for CSV export.", "error");
        return;
      }
      const s = reportCenterSelectedStudent;
      const b = reportCenterSelectedStudentBill;
      filename = `Fees_Ledger_${cleanFn(s.firstName)}_${cleanFn(s.lastName)}_${cleanFn(selectedAcademicYear)}_${cleanFn(selectedTerm)}.csv`;

      csvContent += `STUDENT FEES LEDGER STATEMENT\n`;
      csvContent += `School Name,${escapeCSV(schoolInfo.name || 'GeeTech Academy')}\n`;
      csvContent += `Academic Year,${escapeCSV(selectedAcademicYear)}\n`;
      csvContent += `Term,${escapeCSV(selectedTerm)}\n`;
      csvContent += `Student ID,${escapeCSV(s.id)}\n`;
      csvContent += `Student Name,${escapeCSV(`${s.firstName} ${s.lastName}`)}\n`;
      csvContent += `Class,${escapeCSV(s.class)}\n\n`;

      csvContent += `FEE COMPONENT BILLING\n`;
      csvContent += `Component,Expected Amount (GHS)\n`;
      csvContent += `School Fees,${(b.schoolFees || 0).toFixed(2)}\n`;
      csvContent += `Utility Bill,${(b.utilityBill || 0).toFixed(2)}\n`;
      csvContent += `Sports Fees,${(b.sportsFees || 0).toFixed(2)}\n`;
      csvContent += `PTA Dues,${(b.ptaDues || 0).toFixed(2)}\n`;
      csvContent += `Transportation Bill,${(b.transportationBill || 0).toFixed(2)}\n`;
      csvContent += `Other Fee (${escapeCSV(b.otherFeeDescription || 'Other')}),${(b.otherFee || 0).toFixed(2)}\n`;
      (b.customComponents || []).forEach(c => {
        csvContent += `${escapeCSV(c.componentName)}${c.category ? ` (${escapeCSV(c.category)})` : ''},${(Number(c.amount) || 0).toFixed(2)}\n`;
      });
      csvContent += `TOTAL EXPECTED,${reportCenterSelectedStudentStats.expected.toFixed(2)}\n\n`;

      csvContent += `CREDITED INSTALLMENTS RECEIVED\n`;
      csvContent += `Payment Date,Receipt Code,Allocated Component,Method,Amount Paid (GHS)\n`;
      if (!b.payments || b.payments.length === 0) {
        csvContent += `No payments recorded,,,\n`;
      } else {
        b.payments.forEach(p => {
          csvContent += `${escapeCSV(p.date)},${escapeCSV(p.receiptNo)},${escapeCSV(p.component)},${escapeCSV(p.method)},${p.amount.toFixed(2)}\n`;
        });
      }
      csvContent += `TOTAL PAID,,,,${reportCenterSelectedStudentStats.paid.toFixed(2)}\n`;
      csvContent += `OUTSTANDING ARREARS BALANCE,,,,${reportCenterSelectedStudentStats.bal.toFixed(2)}\n`;

    } else if (reportCenterType === 'class') {
      filename = `Class_Ledger_${cleanFn(reportCenterSelectedClass)}_${cleanFn(selectedAcademicYear)}_${cleanFn(selectedTerm)}.csv`;

      csvContent += `CLASS FEES COMPLIANCE LEDGER\n`;
      csvContent += `School Name,${escapeCSV(schoolInfo.name || 'GeeTech Academy')}\n`;
      csvContent += `Class,${escapeCSV(reportCenterSelectedClass)}\n`;
      csvContent += `Academic Year,${escapeCSV(selectedAcademicYear)}\n`;
      csvContent += `Term,${escapeCSV(selectedTerm)}\n`;
      csvContent += `Export Date,${escapeCSV(new Date().toLocaleDateString())}\n\n`;

      csvContent += `Student ID,First Name,Last Name,Class,School Fees (GHS),Utility Bill (GHS),Sports Fees (GHS),PTA Dues (GHS),Transportation (GHS),Other Fee (GHS),Other Fee Description,Total Expected (GHS),Total Paid (GHS),Outstanding Arrears (GHS),Payment Status\n`;

      reportCenterClassData.list.forEach(item => {
        const s = item.student;
        const b = item.bill;
        const statusStr = item.owed <= 0 ? 'Cleared' : item.paid > 0 ? 'Partial' : 'No Payment';
        csvContent += `${escapeCSV(s.id)},${escapeCSV(s.firstName)},${escapeCSV(s.lastName)},${escapeCSV(s.class)},${(b.schoolFees || 0).toFixed(2)},${(b.utilityBill || 0).toFixed(2)},${(b.sportsFees || 0).toFixed(2)},${(b.ptaDues || 0).toFixed(2)},${(b.transportationBill || 0).toFixed(2)},${(b.otherFee || 0).toFixed(2)},${escapeCSV(b.otherFeeDescription || '')},${item.expected.toFixed(2)},${item.paid.toFixed(2)},${item.owed.toFixed(2)},${statusStr}\n`;
      });

      csvContent += `\nCUMULATIVE TOTALS,,,,,,,,,,,${reportCenterClassData.totalExpected.toFixed(2)},${reportCenterClassData.totalPaid.toFixed(2)},${reportCenterClassData.totalOwed.toFixed(2)},${reportCenterClassData.totalExpected > 0 ? Math.round((reportCenterClassData.totalPaid / reportCenterClassData.totalExpected) * 100) : 0}% Coll.\n`;

    } else if (reportCenterType === 'school') {
      filename = `School_Ledger_Summary_${cleanFn(selectedAcademicYear)}_${cleanFn(selectedTerm)}.csv`;

      csvContent += `CAMPUS-WIDE FEES DIRECTORY STATUS\n`;
      csvContent += `School Name,${escapeCSV(schoolInfo.name || 'GeeTech Academy')}\n`;
      csvContent += `Academic Year,${escapeCSV(selectedAcademicYear)}\n`;
      csvContent += `Term,${escapeCSV(selectedTerm)}\n`;
      csvContent += `Export Date,${escapeCSV(new Date().toLocaleDateString())}\n\n`;

      csvContent += `CLASS DIVISIONAL SUMMARY AGGREGATES\n`;
      csvContent += `Class Name,Billed Students,Expected Revenue (GHS),Total Collected (GHS),Outstanding Arrears (GHS),Collection Efficiency\n`;

      reportCenterSchoolData.classStats.forEach(s => {
        csvContent += `${escapeCSV(s.class)},${s.count},${s.totalExpected.toFixed(2)},${s.totalPaid.toFixed(2)},${s.totalOwed.toFixed(2)},${s.rate}%\n`;
      });

      csvContent += `TOTAL SUMMATIONS,${students.length},${reportCenterSchoolData.overallExpected.toFixed(2)},${reportCenterSchoolData.overallPaid.toFixed(2)},${reportCenterSchoolData.overallOwed.toFixed(2)},${reportCenterSchoolData.overallRate}%\n\n`;

      csvContent += `DETAILED STUDENT FEES REGISTRIES\n`;
      csvContent += `Student ID,First Name,Last Name,Class,Total Expected (GHS),Total Paid (GHS),Outstanding Arrears (GHS),Payment Status\n`;

      students.forEach(student => {
        const bill = getStudentBill(student);
        const expected = calculateBillExpected(bill);
        const paid = bill.payments ? bill.payments.reduce((sum, p) => sum + p.amount, 0) : 0;
        const owed = expected - paid;
        const statusStr = owed <= 0 ? 'Cleared' : paid > 0 ? 'Partial' : 'No Payment';
        csvContent += `${escapeCSV(student.id)},${escapeCSV(student.firstName)},${escapeCSV(student.lastName)},${escapeCSV(student.class)},${expected.toFixed(2)},${paid.toFixed(2)},${owed.toFixed(2)},${statusStr}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadBlobLocally(blob, filename);
    showToast("Structured CSV ledger exported successfully!");
  };

  useEffect(() => {
    setStorageItem('smsLogs_fees_reminders', smsLogs);
  }, [smsLogs]);

  useEffect(() => {
    // Poll pending SMS statuses
    const interval = setInterval(() => {
      const pendingLogs = smsLogs.filter(log => !['delivered', 'failed', 'undelivered'].includes(log.status.toLowerCase()));
      if (pendingLogs.length > 0) {
        pendingLogs.forEach(async (log) => {
          try {
            const res = await fetch(`/api/communications/sms-status/${log.sid}`);
            if (res.ok) {
              const data = await res.json();
              if (data.status && data.status.toLowerCase() !== log.status.toLowerCase()) {
                setSmsLogs(prev => prev.map(l => l.sid === log.sid ? { ...l, status: data.status } : l));
              }
            }
          } catch (err) {}
        });
      }
    }, 5000); // poll every 5 seconds
    return () => clearInterval(interval);
  }, [smsLogs]);

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const urlStudentId = q.get('studentId');
      const urlReceiptNo = q.get('receiptNo');
      
      if (urlStudentId) {
        setActiveStudentId(urlStudentId);
        
        if (urlReceiptNo) {
          // Find if there is a bill containing this payment receipt
          const foundBill = feeBills.find(b => 
            b.studentId === urlStudentId && 
            b.payments.some(p => p.receiptNo === urlReceiptNo)
          );
          if (foundBill) {
            const foundPayment = foundBill.payments.find(p => p.receiptNo === urlReceiptNo);
            if (foundPayment) {
              setActiveReceiptPayment({ bill: foundBill, payment: foundPayment });
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to parse URL query params for ledger", err);
    }
  }, [feeBills]);

  useEffect(() => {
    if (activeReceiptPayment) {
      const studentObj = students.find(s => s.id === activeReceiptPayment.bill.studentId);
      const emailVal = studentObj?.guardianEmail || studentObj?.email || '';
      setReceiptEmailOverride(emailVal);
    } else {
      setReceiptEmailOverride('');
    }
  }, [activeReceiptPayment, students]);

  // Form handling state for currently active selected student
  const activeStudent = useMemo(() => students.find(s => s.id === activeStudentId), [students, activeStudentId]);
  
  const activeBill = useMemo(() => {
    if (!activeStudent) return null;
    return getStudentBill(activeStudent);
  }, [activeStudent, feeBills, selectedAcademicYear, selectedTerm]);

  // Outstanding calculations for selected student
  const activeExpectedAndPaid = useMemo(() => {
    if (!activeStudent || !activeBill) return { expected: 0, paid: 0, bal: 0 };
    const expected = calculateBillExpected(activeBill);
    const paid = (activeBill.payments || []).reduce((sum, p) => sum + (Number(p?.amount) || 0), 0);
    const bal = expected - paid;
    return { expected, paid, bal };
  }, [activeStudent, activeBill]);

  const compileReminderMessage = (templateText: string) => {
    if (!activeStudent) return templateText;
    const { bal } = activeExpectedAndPaid;
    const token = generateSecureToken(activeStudent.id, selectedAcademicYear, selectedTerm);
    const parentUrl = `${window.location.origin}/?studentId=${activeStudent.id}&year=${encodeURIComponent(selectedAcademicYear)}&term=${encodeURIComponent(selectedTerm)}&token=${token}`;
    
    return templateText
      .replace(/{guardianName}/g, activeStudent.guardianName || 'Guardian')
      .replace(/{firstName}/g, activeStudent.firstName)
      .replace(/{lastName}/g, activeStudent.lastName)
      .replace(/{studentId}/g, activeStudent.id)
      .replace(/{balance}/g, bal.toFixed(2))
      .replace(/{term}/g, selectedTerm)
      .replace(/{academicYear}/g, selectedAcademicYear)
      .replace(/{reportLink}/g, parentUrl);
  };

  const compileRandomReminderMessage = (templateText: string) => {
    const student = activeStudent || students[0];
    const liveOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const parentUrl = student 
      ? `${liveOrigin}/?studentId=${student.id}&year=${encodeURIComponent(selectedAcademicYear)}&term=${encodeURIComponent(selectedTerm)}`
      : `${liveOrigin}/?parentMode=true`;
    return templateText
      .replace(/{guardianName}/g, student?.guardianName || 'Parent / Guardian')
      .replace(/{firstName}/g, student?.firstName || 'Student')
      .replace(/{lastName}/g, student?.lastName || '')
      .replace(/{studentId}/g, student?.id || 'STU-001')
      .replace(/{balance}/g, activeBill ? (() => {
        const totalBill = (activeBill.schoolFees || 0) + (activeBill.utilityBill || 0) + (activeBill.sportsFees || 0) + (activeBill.ptaDues || 0) + (activeBill.transportationBill || 0) + (activeBill.otherFee || 0) + (activeBill.customComponents || []).reduce((sum, c) => sum + (c.amount || 0), 0);
        const totalPaid = (activeBill.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
        return Math.max(0, totalBill - totalPaid).toFixed(2);
      })() : '0.00')
      .replace(/{term}/g, selectedTerm)
      .replace(/{academicYear}/g, selectedAcademicYear)
      .replace(/{reportLink}/g, parentUrl);
  };

  const handleOpenReminderModal = () => {
    if (!activeStudent || !activeBill) return;

    setReminderRecipientPhone(activeStudent.guardianTelephone || '');
    setReminderSmsSuccess(null);
    setReminderCustomMessage(
      `Dear {guardianName}, this is a payment reminder for {firstName} {lastName} ({studentId}). Our school ledger shows an outstanding balance of GHS {balance} for {term}, {academicYear}. Kindly arrange to settle this amount. You can securely view/download the full bill & receipt ledger here: {reportLink}`
    );
    setShowReminderModal(true);
  };

  const handleOpenInvoice = () => {
    if (!activeStudent) return;
    const yearPart = selectedAcademicYear.split('/')[0];
    const randPart = Math.floor(1000 + Math.random() * 9000);
    setInvoiceNo(`INV-${yearPart}-${activeStudent.id}-${randPart}`);
    
    // Set default invoice date to today
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    
    // Default due date: 14 days from now
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setInvoiceDueDate(d.toISOString().split('T')[0]);
    
    setShowInvoiceModal(true);
  };

  const handleSendReminderSMS = async () => {
    if (!reminderRecipientPhone) return;
    setReminderSendingSms(true);
    setReminderSmsSuccess(null);

    const sName = `${activeStudent?.firstName} ${activeStudent?.lastName}`;
    const sGuardian = activeStudent?.guardianName || 'Guardian';

    try {
      const res = await fetch('/api/communications/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: reminderRecipientPhone.trim(),
          body: compileReminderMessage(reminderCustomMessage)
        })
      });

      const parsed = await res.json();
      
      if (res.ok && parsed.success) {
        // Add to student database if parent tel changed or was blank
        if (activeStudent && activeStudent.guardianTelephone !== reminderRecipientPhone) {
          try {
            const updatedStudent = {
              ...activeStudent,
              guardianTelephone: reminderRecipientPhone
            };
            await DbController.saveStudent(updatedStudent);
          } catch (err) {
            console.warn("Failed to sync guardian telephone updates:", err);
          }
        }
        
        // Save to logs
        setSmsLogs(prev => [
          { sid: parsed.sid, studentName: sName, phone: reminderRecipientPhone, status: 'Sent', sentAt: Date.now() },
          ...prev
        ]);
        
        setReminderSmsSuccess(`Automated payment compliance SMS reminder successfully dispatched to parent ${sGuardian} (${reminderRecipientPhone})!`);
      } else {
        showToast(parsed.message || "Failed to dispatch SMS reminder.", "error");
      }
    } catch (error: any) {
      showToast(error.message || "Failed to contact SMS gateway.", "error");
    }

    setReminderSendingSms(false);
  };

  const handleSendReminderWhatsApp = () => {
    if (!reminderRecipientPhone) return;
    
    let phone = reminderRecipientPhone.trim().replace(/[\s\-\(\)\+]/g, '');
    if (phone.startsWith('0') && phone.length === 10) {
      phone = '233' + phone.substring(1);
    }
    
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(compileReminderMessage(reminderCustomMessage))}`;
    
    const sName = activeStudent ? `${activeStudent.firstName} ${activeStudent.lastName}` : 'Student';
    const sGuardian = activeStudent?.guardianName || 'Guardian';
    
    setSmsLogs(prev => [
      { sid: `WA_${Date.now()}`, studentName: sName, phone: reminderRecipientPhone, status: 'WhatsApp Sent', sentAt: Date.now() },
      ...prev
    ]);

    if (activeStudent && activeStudent.guardianTelephone !== reminderRecipientPhone) {
      try {
        const updatedStudent = {
          ...activeStudent,
          guardianTelephone: reminderRecipientPhone
        };
        DbController.saveStudent(updatedStudent);
      } catch (err) {
        console.warn("Failed to sync guardian telephone updates:", err);
      }
    }

    window.open(whatsappUrl, '_blank');
    setReminderSmsSuccess(`Formatted WhatsApp reminder opened in standard secure web chat view!`);
  };

  // Notification / Feedback Toast states
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleClearInputs = () => {
    setPaymentAmount('');
    setPaymentRemarks('');
    setPaymentComponent('School Fees');
    setPaymentMethod('Cash');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    showToast("Resetted active payment dialogue inputs to blank.", "success");
  };

  const handleDeleteActiveSelection = () => {
    if (activeStudentId) {
      const targetStuObj = students.find(s => s.id === activeStudentId);
      const studentName = targetStuObj ? `${targetStuObj.firstName} ${targetStuObj.lastName}` : "the active student";
      setConfirmModal({
        isOpen: true,
        title: "Reset Student Fees Ledger?",
        message: `Are you sure you want to delete and reset the fees ledger accounts billing and payment history for ${studentName}? This subtraction will affect student balances immediately and void any recorded installments.`,
        confirmText: "Delete & Reset",
        danger: true,
        onConfirm: () => {
          const nextBills = feeBills.filter(b => b.studentId !== activeStudentId);
          setFeeBills(nextBills);
          const toDelete = feeBills.filter(b => b.studentId === activeStudentId);
          toDelete.forEach(b => {
            if (b.id) DbController.deleteStudentFeeBill(b.id);
          });
          setActiveStudentId(null);
          showToast("Active student fee log successfully reset.", "success");
        }
      });
    } else {
      showToast("Please select a student from the fee ledger directory first.", "error");
    }
  };

  const handleDeleteAllFees = () => {
    setConfirmModal({
      isOpen: true,
      title: "CRITICAL: Delete All Fees Section Data?",
      message: "Are you absolutely sure you want to completely delete all historical Student Fee Bills and payments transactions ledger? This action is permanent, affects the entire school directory, and cannot be undone.",
      confirmText: "Purge All Data",
      danger: true,
      onConfirm: () => {
        DbController.clearAllStudentFeeBills();
        setFeeBills([]);
        onManualSave();
        showToast("Successfully purged all recorded fee logs and ledger transactions.", "success");
      }
    });
  };

  // Synchronize state with LocalStorage / Cloud
  const handleSaveBill = (updatedBill: StudentFeeBill) => {
    const nextBills = feeBills.map(b => b.id === updatedBill.id ? updatedBill : b);
    if (!nextBills.some(b => b.id === updatedBill.id)) {
      nextBills.push(updatedBill);
    }
    setFeeBills(nextBills);
    DbController.saveStudentFeeBill(updatedBill);
    if (!isAutoSave) {
      onManualSave();
    }
  };

  const handleBulkSetup = (targetClass: ClassType | 'All', values: {
    schoolFees: number;
    utilityBill: number;
    sportsFees: number;
    ptaDues: number;
    transportationBill: number;
    otherFee: number;
    otherFeeDescription: string;
  }) => {
    // Collect all students fitting description
    const targetStudents = students.filter(s => targetClass === 'All' || s.class === targetClass);
    if (targetStudents.length === 0) {
      showToast("No students found in the target class class directory.", "error");
      return;
    }

    let updatedCount = 0;
    const updatedBills = [...feeBills];

    targetStudents.forEach(student => {
      const billId = `${student.id}_${selectedAcademicYear}_${selectedTerm}`.replace(/\//g, '-');
      const existingIdx = updatedBills.findIndex(b => b.id === billId);

      const applicableCustoms = customBillComponents.filter(c =>
        c.isActive && (c.applicableClasses.includes('All') || c.applicableClasses.includes(student.class))
      );

      if (existingIdx >= 0) {
        // Update bills but maintain payments of this account and merge customComponents
        const existing = updatedBills[existingIdx];
        const existingCustoms = existing.customComponents || [];
        const mergedCustoms = [...existingCustoms];
        applicableCustoms.forEach(c => {
          if (!mergedCustoms.some(mc => mc && (mc.componentId === c.id || (mc.componentName || '').toLowerCase() === (c.name || '').toLowerCase()))) {
            mergedCustoms.push({
              componentId: c.id,
              componentName: c.name,
              amount: Number(c.defaultAmount) || 0,
              category: c.category,
              isRequired: c.isRequired
            });
          }
        });

        const updated: StudentFeeBill = {
          ...existing,
          ...values,
          customComponents: mergedCustoms,
          updatedAt: new Date().toISOString()
        };
        updatedBills[existingIdx] = updated;
        DbController.saveStudentFeeBill(updated);
      } else {
        const initialCustoms = applicableCustoms.map(c => ({
          componentId: c.id,
          componentName: c.name,
          amount: Number(c.defaultAmount) || 0,
          category: c.category,
          isRequired: c.isRequired
        }));

        // Create new account
        const newBill: StudentFeeBill = {
          id: billId,
          studentId: student.id,
          studentName: `${student.firstName} ${student.middleName ? student.middleName + ' ' : ''}${student.lastName}`,
          class: student.class,
          academicYear: selectedAcademicYear,
          term: selectedTerm,
          ...values,
          customComponents: initialCustoms,
          payments: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        updatedBills.push(newBill);
        DbController.saveStudentFeeBill(newBill);
      }
      updatedCount++;
    });

    setFeeBills(updatedBills);
    if (!isAutoSave) {
      onManualSave();
    }
    showToast(`Successfully set standard term bills for ${updatedCount} student registries.`, 'success');
  };

  const handleClearAllFees = () => {
    setConfirmModal({
      isOpen: true,
      title: "Reset Fees Directory?",
      message: "Are you absolutely sure you want to delete ALL student school fee accounts and payment installments across all academic terms? This action is irreversible and cannot be undone.",
      confirmText: "Reset Directory",
      danger: true,
      onConfirm: () => {
        DbController.clearAllStudentFeeBills();
        setFeeBills([]);
        setActiveStudentId(null);
        showToast("All school fees database records have been securely initialized and cleared.", 'success');
      }
    });
  };

  // Find the bill state for a given student
  function getStudentBill(student: Student): StudentFeeBill {
    const billId = `${student.id}_${selectedAcademicYear}_${selectedTerm}`.replace(/\//g, '-');
    const found = feeBills.find(b => b.id === billId);

    const applicableCustoms = customBillComponents.filter(c => 
      c.isActive && (c.applicableClasses.includes('All') || c.applicableClasses.includes(student.class))
    );

    if (found) {
      const safePayments = Array.isArray(found.payments) ? found.payments : [];
      let studentCustoms = found.customComponents;
      if (!studentCustoms || !Array.isArray(studentCustoms)) {
        studentCustoms = applicableCustoms.map(c => ({
          componentId: c.id,
          componentName: c.name,
          amount: Number(c.defaultAmount) || 0,
          category: c.category,
          isRequired: c.isRequired
        }));
        return { ...found, payments: safePayments, customComponents: studentCustoms };
      } else {
        let hasNew = false;
        const merged = [...studentCustoms];
        applicableCustoms.forEach(c => {
          if (!merged.some(mc => mc && (mc.componentId === c.id || (mc.componentName || '').toLowerCase() === (c.name || '').toLowerCase()))) {
            merged.push({
              componentId: c.id,
              componentName: c.name,
              amount: Number(c.defaultAmount) || 0,
              category: c.category,
              isRequired: c.isRequired
            });
            hasNew = true;
          }
        });
        return { ...found, payments: safePayments, customComponents: hasNew ? merged : studentCustoms };
      }
    }

    // Default template-less state with auto-linked active components
    const initialCustoms = applicableCustoms.map(c => ({
      componentId: c.id,
      componentName: c.name,
      amount: Number(c.defaultAmount) || 0,
      category: c.category,
      isRequired: c.isRequired
    }));

    return {
      id: billId,
      studentId: student.id,
      studentName: `${student.firstName} ${student.middleName ? student.middleName + ' ' : ''}${student.lastName}`,
      class: student.class,
      academicYear: selectedAcademicYear,
      term: selectedTerm,
      schoolFees: 0,
      utilityBill: 0,
      sportsFees: 0,
      ptaDues: 0,
      transportationBill: 0,
      otherFee: 0,
      otherFeeDescription: '',
      customComponents: initialCustoms,
      payments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  // Aggregate totals
  const overallStats = useMemo(() => {
    // Filtered by selected year and term
    const activeTermAccounts = feeBills.filter(b => b && b.academicYear === selectedAcademicYear && b.term === selectedTerm);
    
    let totalExpected = 0;
    let totalPaid = 0;

    activeTermAccounts.forEach(bill => {
      // expected sum
      totalExpected += calculateBillExpected(bill);
      // paid sum
      const paidSum = (bill.payments || []).reduce((sum, p) => sum + (Number(p?.amount) || 0), 0);
      totalPaid += paidSum;
    });

    const totalOutstanding = totalExpected - totalPaid;
    const collectionPercent = totalExpected > 0 ? Math.round((totalPaid / totalExpected) * 100) : 0;

    return {
      totalExpected,
      totalPaid,
      totalOutstanding,
      collectionPercent,
      activeAccountsCount: activeTermAccounts.length
    };
  }, [feeBills, selectedAcademicYear, selectedTerm, customBillComponents]);

  // Fee Distribution & Status Pie Chart Calculations
  const feeDistributionStats = useMemo(() => {
    const targetStudents = chartClassFilter === 'All'
      ? students
      : students.filter(s => s.class === chartClassFilter);

    let fullyPaidCount = 0;
    let fullyPaidExpected = 0;
    let fullyPaidPaid = 0;

    let partiallyPaidCount = 0;
    let partiallyPaidExpected = 0;
    let partiallyPaidPaid = 0;
    let partiallyPaidArrears = 0;

    let unpaidCount = 0;
    let unpaidExpected = 0;
    let unpaidPaid = 0;

    let unbilledCount = 0;

    targetStudents.forEach(student => {
      const bill = getStudentBill(student);
      const expected = calculateBillExpected(bill);
      const paid = bill.payments ? bill.payments.reduce((sum, p) => sum + p.amount, 0) : 0;
      const owed = expected - paid;

      if (expected === 0) {
        unbilledCount++;
      } else if (owed <= 0) {
        fullyPaidCount++;
        fullyPaidExpected += expected;
        fullyPaidPaid += paid;
      } else if (paid > 0) {
        partiallyPaidCount++;
        partiallyPaidExpected += expected;
        partiallyPaidPaid += paid;
        partiallyPaidArrears += owed;
      } else {
        unpaidCount++;
        unpaidExpected += expected;
        unpaidPaid += paid;
      }
    });

    const totalBilledStudents = fullyPaidCount + partiallyPaidCount + unpaidCount;
    const totalStudents = targetStudents.length;

    const totalTermExpected = fullyPaidExpected + partiallyPaidExpected + unpaidExpected;
    const totalTermPaid = fullyPaidPaid + partiallyPaidPaid + unpaidPaid;
    const totalTermArrears = totalTermExpected - totalTermPaid;

    // Data formatted for Recharts
    const pieDataStudents = [
      {
        name: 'Fully Paid',
        value: fullyPaidCount,
        amount: fullyPaidPaid,
        expected: fullyPaidExpected,
        arrears: 0,
        color: '#10b981',
        description: 'Fee cleared in full'
      },
      {
        name: 'Partially Paid',
        value: partiallyPaidCount,
        amount: partiallyPaidPaid,
        expected: partiallyPaidExpected,
        arrears: partiallyPaidArrears,
        color: '#f59e0b',
        description: 'Installment payments made'
      },
      {
        name: 'Unpaid',
        value: unpaidCount,
        amount: unpaidPaid,
        expected: unpaidExpected,
        arrears: unpaidExpected,
        color: '#f43f5e',
        description: 'Zero payments made'
      }
    ];

    const pieDataAmount = [
      {
        name: 'Fully Paid (Collected)',
        value: fullyPaidPaid,
        studentCount: fullyPaidCount,
        color: '#10b981',
        description: 'From cleared accounts'
      },
      {
        name: 'Partially Paid (Collected)',
        value: partiallyPaidPaid,
        studentCount: partiallyPaidCount,
        color: '#3b82f6',
        description: 'Installment collections'
      },
      {
        name: 'Outstanding Arrears',
        value: totalTermArrears,
        studentCount: partiallyPaidCount + unpaidCount,
        color: '#f43f5e',
        description: 'Uncollected balances'
      }
    ];

    return {
      fullyPaidCount,
      fullyPaidExpected,
      fullyPaidPaid,
      partiallyPaidCount,
      partiallyPaidExpected,
      partiallyPaidPaid,
      partiallyPaidArrears,
      unpaidCount,
      unpaidExpected,
      unpaidPaid,
      unbilledCount,
      totalBilledStudents,
      totalStudents,
      totalTermExpected,
      totalTermPaid,
      totalTermArrears,
      pieDataStudents,
      pieDataAmount
    };
  }, [students, feeBills, selectedAcademicYear, selectedTerm, chartClassFilter]);

  // Handle bill details modification
  const handleEditBillComponent = (field: keyof Omit<StudentFeeBill, 'payments' | 'id'>, value: any) => {
    if (!activeBill) return;
    const nextBill = {
      ...activeBill,
      [field]: value,
      updatedAt: new Date().toISOString()
    };
    handleSaveBill(nextBill);
  };

  // Handle granular custom bill component modification for this specific student
  const handleEditCustomComponent = (componentId: string, amount: number) => {
    if (!activeBill) return;
    const currentCustoms = activeBill.customComponents || [];
    const nextCustoms = currentCustoms.map(c =>
      c.componentId === componentId ? { ...c, amount: Math.max(0, amount) } : c
    );
    const nextBill: StudentFeeBill = {
      ...activeBill,
      customComponents: nextCustoms,
      updatedAt: new Date().toISOString()
    };
    handleSaveBill(nextBill);
  };

  const handleAddCustomComponentToActiveBill = (componentId: string) => {
    if (!activeBill) return;
    const compDef = customBillComponents.find(c => c.id === componentId);
    if (!compDef) return;

    const currentCustoms = activeBill.customComponents || [];
    if (currentCustoms.some(c => c.componentId === componentId)) {
      showToast(`${compDef.name} is already linked to this student's billing statement.`, 'error');
      return;
    }

    const nextCustoms = [
      ...currentCustoms,
      {
        componentId: compDef.id,
        componentName: compDef.name,
        amount: Number(compDef.defaultAmount) || 0,
        category: compDef.category,
        isRequired: compDef.isRequired
      }
    ];

    const nextBill: StudentFeeBill = {
      ...activeBill,
      customComponents: nextCustoms,
      updatedAt: new Date().toISOString()
    };
    handleSaveBill(nextBill);
    showToast(`Linked ${compDef.name} (GHS ${Number(compDef.defaultAmount).toFixed(2)}) to ${activeBill.studentName}'s bill.`, 'success');
  };

  const handleRemoveCustomComponentFromActiveBill = (componentId: string) => {
    if (!activeBill) return;
    const currentCustoms = activeBill.customComponents || [];
    const nextCustoms = currentCustoms.filter(c => c.componentId !== componentId);
    const nextBill: StudentFeeBill = {
      ...activeBill,
      customComponents: nextCustoms,
      updatedAt: new Date().toISOString()
    };
    handleSaveBill(nextBill);
    showToast(`Removed component from this student's billing statement.`, 'success');
  };

  const handleSyncComponentsToAllStudents = () => {
    const activeCustoms = customBillComponents.filter(c => c.isActive);
    if (activeCustoms.length === 0) {
      showToast("No active granular bill components to link.", "error");
      return;
    }

    let count = 0;
    const updatedBills = [...feeBills];

    students.forEach(student => {
      const billId = `${student.id}_${selectedAcademicYear}_${selectedTerm}`.replace(/\//g, '-');
      const existingIdx = updatedBills.findIndex(b => b.id === billId);
      const applicable = activeCustoms.filter(c => c.applicableClasses.includes('All') || c.applicableClasses.includes(student.class));

      if (existingIdx >= 0) {
        const existing = updatedBills[existingIdx];
        const existingCustoms = existing.customComponents || [];
        const mergedCustoms = [...existingCustoms];

        applicable.forEach(appComp => {
          const foundIdx = mergedCustoms.findIndex(mc => mc && (mc.componentId === appComp.id || (mc.componentName || '').toLowerCase() === (appComp.name || '').toLowerCase()));
          if (foundIdx === -1) {
            mergedCustoms.push({
              componentId: appComp.id,
              componentName: appComp.name,
              amount: Number(appComp.defaultAmount) || 0,
              category: appComp.category,
              isRequired: appComp.isRequired
            });
          }
        });

        const updatedBill: StudentFeeBill = {
          ...existing,
          customComponents: mergedCustoms,
          updatedAt: new Date().toISOString()
        };
        updatedBills[existingIdx] = updatedBill;
        DbController.saveStudentFeeBill(updatedBill);
        count++;
      } else {
        const initialCustoms = applicable.map(c => ({
          componentId: c.id,
          componentName: c.name,
          amount: Number(c.defaultAmount) || 0,
          category: c.category,
          isRequired: c.isRequired
        }));

        const newBill: StudentFeeBill = {
          id: billId,
          studentId: student.id,
          studentName: `${student.firstName} ${student.middleName ? student.middleName + ' ' : ''}${student.lastName}`,
          class: student.class,
          academicYear: selectedAcademicYear,
          term: selectedTerm,
          schoolFees: 0,
          utilityBill: 0,
          sportsFees: 0,
          ptaDues: 0,
          transportationBill: 0,
          otherFee: 0,
          otherFeeDescription: '',
          customComponents: initialCustoms,
          payments: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        updatedBills.push(newBill);
        DbController.saveStudentFeeBill(newBill);
        count++;
      }
    });

    setFeeBills(updatedBills);
    if (!isAutoSave) {
      onManualSave();
    }
    showToast(`Successfully linked ${activeCustoms.length} granular components across ${count} student billing statements.`, "success");
  };

  const handleSaveGranularComponent = (comp: CustomBillComponent) => {
    DbController.saveCustomBillComponent(comp);
    const updated = DbController.getCustomBillComponents();
    setCustomBillComponents(updated);
    showToast(`Bill component "${comp.name}" saved with default cost GHS ${Number(comp.defaultAmount).toFixed(2)}.`, 'success');
  };

  const handleDeleteGranularComponent = (id: string) => {
    const target = customBillComponents.find(c => c.id === id);
    setConfirmModal({
      isOpen: true,
      title: `Delete ${target?.name || 'Bill Component'}?`,
      message: `Are you sure you want to delete this bill component? It will no longer be applied to new student bills.`,
      confirmText: 'Delete Component',
      danger: true,
      onConfirm: () => {
        DbController.deleteCustomBillComponent(id);
        const updated = DbController.getCustomBillComponents();
        setCustomBillComponents(updated);
        showToast('Bill component deleted.', 'success');
      }
    });
  };

  const handleUpdateComponentInline = (id: string, updates: Partial<CustomBillComponent>, showToastNotification = false) => {
    const target = customBillComponents.find(c => c.id === id);
    if (!target) return;
    const updated = { ...target, ...updates, updatedAt: new Date().toISOString() };
    DbController.saveCustomBillComponent(updated);
    const updatedList = DbController.getCustomBillComponents();
    setCustomBillComponents(updatedList);
    if (showToastNotification) {
      showToast(`Updated "${updated.name}" cost to GHS ${Number(updated.defaultAmount).toFixed(2)}.`, 'success');
    }
  };

  const handleAddInlineComponent = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = inlineNewComp.name.trim();
    if (!trimmedName) {
      showToast("Please enter a component name (e.g. Exam Fees, Library Levy).", "error");
      return;
    }
    const cost = parseFloat(inlineNewComp.defaultAmount) || 0;
    const code = inlineNewComp.code.trim() || trimmedName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    const newComp: CustomBillComponent = {
      id: `comp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: trimmedName,
      code,
      category: inlineNewComp.category,
      defaultAmount: Math.max(0, cost),
      frequency: inlineNewComp.frequency,
      applicableClasses: inlineNewComp.applicableClasses.length > 0 ? inlineNewComp.applicableClasses : ['All'],
      isRequired: true,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    handleSaveGranularComponent(newComp);
    setInlineNewComp({
      name: '',
      code: '',
      category: 'Academic',
      defaultAmount: '',
      frequency: 'Per Term',
      applicableClasses: ['All']
    });
    setShowInlineAddRow(false);
  };

  const handleResetToDefaultComponents = () => {
    const list = DbController.getCustomBillComponents();
    setCustomBillComponents(list);
  };

  const handleAddPayment = (e: FormEvent) => {
    e.preventDefault();
    if (!activeBill || !activeStudent) return;
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      showToast("Please specify a valid payment amount greater than zero.", "error");
      return;
    }

    // Generate neat clean unique receipt number GSE-FEES-YYYY-{Random}
    const randPart = Math.floor(1000 + Math.random() * 9000);
    const generatedReceipt = `GTIMS-${selectedAcademicYear.split('/')[0]}-${randPart}`;

    const newPayment: FeePayment = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      amount,
      date: paymentDate,
      component: paymentComponent,
      method: paymentMethod,
      receiptNo: generatedReceipt,
      remarks: paymentRemarks.trim() || undefined
    };

    const nextBill: StudentFeeBill = {
      ...activeBill,
      payments: [...activeBill.payments, newPayment],
      updatedAt: new Date().toISOString()
    };

    handleSaveBill(nextBill);
    setShowPaymentModal(false);
    setPaymentAmount('');
    setPaymentRemarks('');
    showToast(`Installment of GHS ${amount.toFixed(2)} received from ${activeBill.studentName}. Receipt Generated.`, 'success');
  };

  const handleDeletePayment = (paymentId: string) => {
    if (!activeBill) return;
    setConfirmModal({
      isOpen: true,
      title: "Void Payment Transaction?",
      message: "Are you sure you want to void/delete this fee installment payment transaction? This subtraction will affect student balances immediately.",
      confirmText: "Void Payment",
      danger: true,
      onConfirm: () => {
        const nextPayments = activeBill.payments.filter(p => p.id !== paymentId);
        const nextBill: StudentFeeBill = {
          ...activeBill,
          payments: nextPayments,
          updatedAt: new Date().toISOString()
        };
        handleSaveBill(nextBill);
        showToast("Installment payment transaction successfully deleted and voided.", "success");
      }
    });
  };

  const handleBulkPrintReceipts = () => {
    const data = filteredStudents
      .map(student => {
        const bill = getStudentBill(student);
        if (bill.payments.length === 0) return null;
        // Get the latest payment
        const latestPayment = [...bill.payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        return { bill, payment: latestPayment };
      })
      .filter(item => item !== null) as { bill: StudentFeeBill; payment: FeePayment }[];

    if (data.length === 0) {
      showToast("No payments found for the selected students in this term.", "error");
      return;
    }

    setBulkReceiptData(data);
    showToast(`Generating bulk receipts for ${data.length} students...`, "success");
    
    // Trigger print preview for the bulk receipts
    setTimeout(() => {
      handlePrintStandard('bulk-receipts-print-area', `Bulk Payment Receipts (${data.length} Students)`);
    }, 250);
  };

  const filenameFriendly = (name: string) => name.replace(/[^a-zA-Z0-9]+/g, '_');

  const handleExportFeesPDF = async (elementId: string, filename: string) => {
    try {
      const isLandscape = false;
      const result = await generatePdfFromHtml(elementId, filename, isLandscape);
      downloadBlobLocally(result.blob, result.filename);
      showToast("PDF report generated successfully!");
    } catch (e: any) {
      showToast(`Error creating PDF resource: ${e.message}`, "error");
    }
  };

  const handleGenerateComponentPdfReceipt = async (bill: StudentFeeBill, payment: FeePayment) => {
    setIsGeneratingComponentPdf(true);
    setPdfTargetPayment({ bill, payment });

    // Allow DOM to update and render the dedicated component PDF receipt container
    setTimeout(async () => {
      try {
        const sanitizedComp = (payment.component || 'Component').replace(/[^a-zA-Z0-9]+/g, '_');
        const sanitizedStudent = (bill.studentName || bill.studentId).replace(/[^a-zA-Z0-9]+/g, '_');
        const filename = `Receipt_${sanitizedComp}_${sanitizedStudent}_${payment.receiptNo}.pdf`;
        
        const result = await generatePdfFromHtml('component-pdf-receipt-render-node', filename, false);
        downloadBlobLocally(result.blob, result.filename);
        showToast(`Official PDF receipt for ${payment.component} (GHS ${payment.amount.toFixed(2)}) generated successfully!`, 'success');
      } catch (err: any) {
        console.error("PDF generation error:", err);
        showToast(`Failed to generate PDF receipt: ${err.message || 'Error'}`, 'error');
      } finally {
        setIsGeneratingComponentPdf(false);
      }
    }, 220);
  };

  const handleBulkPrintComponentReceipts = () => {
    if (filteredComponentPayments.length === 0) {
      showToast("No payments found for the selected component and filters.", "error");
      return;
    }
    setBulkReceiptData(filteredComponentPayments);
    showToast(`Preparing ${filteredComponentPayments.length} component receipts...`, "success");
    setTimeout(() => {
      handlePrintStandard('bulk-receipts-print-area', `${selectedReceiptComponent} Payment Receipts (${filteredComponentPayments.length} Students)`);
    }, 250);
  };

  const handlePrintStandard = (elementId: string, title = 'Official Fee Document') => {
    try {
      const el = document.getElementById(elementId);
      const contentHtml = el ? el.innerHTML : undefined;
      if (typeof (window as any).printTarget === 'function') {
        (window as any).printTarget(elementId, title, false, contentHtml);
      } else {
        window.print();
      }
    } catch (err: any) {
      console.error("Window print exception: ", err);
      showToast("Direct print restriction. Please export PDF.", "error");
    }
  };

  const handleSendReceiptEmail = async () => {
    if (!activeReceiptPayment) return;
    if (!receiptEmailOverride || !receiptEmailOverride.trim()) {
      showToast("Please specify a valid parent/guardian email address.", "error");
      return;
    }

    setIsSendingEmail(true);
    try {
      if (isGoogleAuthenticated()) {
        const mailSubject = `Digital Payment Receipt #${activeReceiptPayment.payment.receiptNo} - ${activeReceiptPayment.bill.studentName}`;
        const htmlBody = `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded-lg; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 25px; border-bottom: 2px solid #6366f1; padding-bottom: 15px;">
              <h2 style="color: #4f46e5; margin: 0; text-transform: uppercase; font-size: 20px; tracking: 0.05em;">Digital Payment Receipt</h2>
              <p style="color: #64748b; font-size: 11px; margin: 5px 0 0 0;">GEETECH HIGH-SCHOOL MANAGEMENT PLATFORM</p>
            </div>
            
            <p style="font-size: 14px; color: #334155;">Dear Parent/Guardian,</p>
            <p style="font-size: 14px; color: #334155; line-height: 1.5;">
              We have successfully received and processed your payment for <strong>${activeReceiptPayment.bill.studentName}</strong>. 
              Please find the complete transaction summary detailed below:
            </p>
            
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0;">
              <table style="width: 100%; font-size: 13px; color: #334155; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #64748b; border-bottom: 1px solid #f1f5f9;">Receipt Number</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #0f172a; border-bottom: 1px solid #f1f5f9; font-family: monospace;">${activeReceiptPayment.payment.receiptNo}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #64748b; border-bottom: 1px solid #f1f5f9;">Amount Paid</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 800; color: #16a34a; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-family: monospace;">GHS ${activeReceiptPayment.payment.amount}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #64748b; border-bottom: 1px solid #f1f5f9;">Fee Component</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${activeReceiptPayment.payment.component}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #64748b; border-bottom: 1px solid #f1f5f9;">Payment Method</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #0f172a; border-bottom: 1px solid #f1f5f9; text-transform: uppercase;">${activeReceiptPayment.payment.method}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #64748b;">Transaction Date</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #0f172a;">${activeReceiptPayment.payment.date}</td>
                </tr>
              </table>
            </div>
            
            <p style="font-size: 13px; color: #64748b; text-align: center; margin-top: 30px; border-top: 1px dashed #cbd5e1; padding-top: 15px;">
              Thank you for your valuable partnership in your child's educational journey.<br/>
              <em>This is a secure electronic receipt dispatched directly from our administration portal.</em>
            </p>
          </div>
        `;
        await sendGmailMessage(receiptEmailOverride.trim(), mailSubject, htmlBody);
        showToast(`Digital receipt copy successfully delivered using your connected Gmail to ${receiptEmailOverride.trim()}`, "success");
      } else {
        const response = await fetch('/api/communications/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: receiptEmailOverride.trim(),
            studentName: activeReceiptPayment.bill.studentName,
            studentId: activeReceiptPayment.bill.studentId,
            receiptNo: activeReceiptPayment.payment.receiptNo,
            amount: activeReceiptPayment.payment.amount,
            component: activeReceiptPayment.payment.component,
            method: activeReceiptPayment.payment.method,
            date: activeReceiptPayment.payment.date
          })
        });

        const result = await response.json();
        if (response.ok && result.success) {
          showToast(`Digital copy of receipt ${activeReceiptPayment.payment.receiptNo} successfully sent to ${receiptEmailOverride.trim()}`, "success");
        } else {
          showToast(result.message || "Failed to dispatch digital receipt copy.", "error");
        }
      }
    } catch (err: any) {
      console.error("Failed to send receipt email:", err);
      showToast(err.message || "Network error occurred while connecting to email gateway.", "error");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleExportLedgerCSV = (student: StudentFeeBill) => {
    if (!student) return;

    // Build chronological debits and credits list
    const debits = [
      { date: student.academicYear + " - " + student.term, desc: "Standard School Tuition Fees", debit: student.schoolFees, credit: 0 },
      { date: student.academicYear + " - " + student.term, desc: "Utility and Maintenance levy", debit: student.utilityBill, credit: 0 },
      { date: student.academicYear + " - " + student.term, desc: "Sports development dues", debit: student.sportsFees, credit: 0 },
      { date: student.academicYear + " - " + student.term, desc: "PTA annual dues allocation", debit: student.ptaDues, credit: 0 },
    ];
    if (student.transportationBill && student.transportationBill > 0) {
      debits.push({
        date: student.academicYear + " - " + student.term,
        desc: "Transportation Bill allocation",
        debit: student.transportationBill,
        credit: 0
      });
    }
    if (student.otherFee > 0) {
      debits.push({
        date: student.academicYear + " - " + student.term,
        desc: `Other Levy / Miscellaneous (${student.otherFeeDescription || 'Other'})`,
        debit: student.otherFee,
        credit: 0
      });
    }

    const credits = student.payments.map((p) => ({
      date: p.date,
      desc: `Payment Receipt: ${p.receiptNo} (${p.component} via ${p.method})`,
      debit: 0,
      credit: p.amount
    }));

    const ledgerEntries = [...debits, ...credits];

    const csvRows: string[][] = [];

    // Metadata
    csvRows.push(["STUDENT TRANSACTION STATEMENT & LEDGER"]);
    csvRows.push([]);
    csvRows.push(["Student Name", student.studentName]);
    csvRows.push(["Student ID", student.studentId]);
    csvRows.push(["Class/Division", student.class]);
    csvRows.push(["Academic Year", student.academicYear]);
    csvRows.push(["Term", student.term]);
    csvRows.push(["Statement Generated Date", new Date().toISOString().split('T')[0]]);
    csvRows.push([]);

    // Headers
    csvRows.push(["Transaction Date", "Description/Reference", "Debit (Charge) GHS", "Credit (Payment) GHS", "Running Balance GHS"]);

    let runningBalance = 0;
    ledgerEntries.forEach((entry) => {
      runningBalance += entry.debit - entry.credit;
      csvRows.push([
        entry.date,
        entry.desc,
        entry.debit > 0 ? entry.debit.toFixed(2) : "0.00",
        entry.credit > 0 ? entry.credit.toFixed(2) : "0.00",
        runningBalance.toFixed(2)
      ]);
    });

    csvRows.push([]);
    
    const expectedTotal = student.schoolFees + student.utilityBill + student.sportsFees + student.ptaDues + (student.transportationBill || 0) + student.otherFee;
    const totalPaid = student.payments.reduce((sum, p) => sum + p.amount, 0);
    const outstanding = expectedTotal - totalPaid;

    csvRows.push(["SUMMARY BALANCE"]);
    csvRows.push(["Total Expected Charges (Debits)", expectedTotal.toFixed(2)]);
    csvRows.push(["Total Payments Received (Credits)", totalPaid.toFixed(2)]);
    csvRows.push(["Outstanding Cumulative Balance Due", outstanding.toFixed(2)]);

    const csvContent = csvRows
      .map((row) =>
        row
          .map((value) => {
            const escaped = String(value).replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const filename = `Ledger_${filenameFriendly(student.studentName || student.studentId)}.csv`;
    
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast(`Ledger CSV statement exported successfully!`);
  };

  const handlePrintDebtors = () => {
    const minAmt = parseFloat(debtorMinAmount) || 0;
    
    // Generate class summation rows
    const classRowsHtml = debtorData.classSummaries.map(s => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px; text-align: left; font-weight: 500;">${s.class}</td>
        <td style="padding: 10px; text-align: center; font-weight: 600;">${s.count}</td>
        <td style="padding: 10px; text-align: right; font-family: monospace; font-weight: bold; color: #1e293b;">GHS ${s.totalOwed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    `).join('');

    // Generate detailed rows
    const detailRowsHtml = filteredDebtors.map(d => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px; text-align: left;">
          <strong style="color: #0f172a; font-size: 13px;">${d.student.firstName} ${d.student.lastName}</strong><br/>
          <small style="color: #64748b; font-family: monospace; font-size: 10px; font-weight: 500;">REG: ${d.student.id}</small>
        </td>
        <td style="padding: 10px; text-align: left; font-weight: 500;">${d.student.class}</td>
        <td style="padding: 10px; text-align: right; font-family: monospace; color: #475569;">GHS ${d.expected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="padding: 10px; text-align: right; font-family: monospace; color: #059669; font-weight: 500;">GHS ${d.paid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="padding: 10px; text-align: right; font-family: monospace; font-weight: bold; color: #dc2626;">GHS ${d.owed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    `).join('');

    const debtorHtmlContent = `
      <div style="padding: 24px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 24px; font-weight: bold;">${schoolInfo.name || 'GeeTech Academy'}</h1>
          <p style="margin: 6px 0 0 0; font-size: 13px; font-style: italic; color: #475569; font-weight: 500;">Motto: "${schoolInfo.motto || 'Excellence and Dignity'}"</p>
          <p style="margin: 6px 0 0 0; font-size: 11px; color: #64748b; font-weight: 500;">${schoolInfo.gpsAddress || 'Digital Address GPS'} • TEL: ${schoolInfo.telephone || '+233 24 556 7780'}</p>
        </div>
        
        <hr style="border: 0; border-top: 2px solid #0f172a; margin-bottom: 25px;" />

        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 30px;">
          <div>
            <h2 style="margin: 0; border: none; padding: 0; color: #0f172a; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.01em;">OFFICIAL DEBTOR ACCOUNTS ANALYSIS REPORT</h2>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #475569;">Academic Cycle: <strong>${selectedTerm} (${selectedAcademicYear})</strong></p>
          </div>
          <div style="text-align: right; font-size: 11px; font-family: monospace; color: #64748b; line-height: 1.5;">
            Generated: ${new Date().toLocaleString()}<br/>
            Owed Threshold Limit: <strong>GHS ${minAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
          </div>
        </div>

        <h2 style="font-size: 13px; text-transform: uppercase; margin-top: 35px; margin-bottom: 12px; border-bottom: 2px solid #0f172a; padding-bottom: 6px; color: #1e3a8a; font-weight: 700;">I. Class Summation Summary</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 12px;">
          <thead>
            <tr style="border-bottom: 2px solid #cbd5e1; background-color: #f8fafc;">
              <th style="padding: 10px; text-align: left; font-weight: bold; width: 40%;">Class / Division Name</th>
              <th style="padding: 10px; text-align: center; font-weight: bold; width: 25%;">Registered Debtor Count</th>
              <th style="padding: 10px; text-align: right; font-weight: bold; width: 35%;">Total Outstanding Arrears Balance</th>
            </tr>
          </thead>
          <tbody>
            ${classRowsHtml || '<tr><td colspan="3" style="text-align: center; color: #64748b; padding: 20px;">No class debtors found matching criteria.</td></tr>'}
            <tr style="border-top: 2px solid #0f172a; background-color: #f1f5f9; font-size: 13px; font-weight: bold;">
              <td style="padding: 12px 10px; text-align: left; font-weight: 800;">TOTAL SUMMARY SUMMATION</td>
              <td style="padding: 12px 10px; text-align: center; font-weight: 800; color: #1e3a8a;">${debtorData.overallDebtorCount} Students</td>
              <td style="padding: 12px 10px; text-align: right; font-weight: 900; color: #dc2626; font-family: monospace;">GHS ${debtorData.overallTotalOwed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        <h2 style="font-size: 13px; text-transform: uppercase; margin-top: 35px; margin-bottom: 12px; border-bottom: 2px solid #0f172a; padding-bottom: 6px; color: #1e3a8a; font-weight: 700;">II. Itemized Debtor Students Registry (Class Filter: ${debtorSelectedClassFilter})</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 12px;">
          <thead>
            <tr style="border-bottom: 2px solid #cbd5e1; background-color: #f8fafc;">
              <th style="padding: 10px; text-align: left; font-weight: bold; width: 35%;">Student Particulars</th>
              <th style="padding: 10px; text-align: left; font-weight: bold; width: 15%;">Class</th>
              <th style="padding: 10px; text-align: right; font-weight: bold; width: 16%;">Expected Fees</th>
              <th style="padding: 10px; text-align: right; font-weight: bold; width: 16%;">Paid Installments</th>
              <th style="padding: 10px; text-align: right; font-weight: bold; width: 18%;">Outstanding Arrears</th>
            </tr>
          </thead>
          <tbody>
            ${detailRowsHtml || '<tr><td colspan="5" style="text-align: center; color: #64748b; padding: 20px;">No detailed debtor records found matching selections.</td></tr>'}
          </tbody>
        </table>

        <div style="margin-top: 70px; display: flex; justify-content: space-between; font-size: 11px; font-weight: 600;">
          <div style="width: 220px; border-top: 1.5px solid #475569; text-align: center; padding-top: 6px; color: #475569;">
            Accounts / Billing Desk Officer
          </div>
          <div style="width: 220px; border-top: 1.5px solid #475569; text-align: center; padding-top: 6px; color: #475569;">
            Bursar / Authorized Signature Seal
          </div>
        </div>
      </div>
    `;

    if (typeof (window as any).printTarget === 'function') {
      (window as any).printTarget('', 'Termly Debtors Registry Report', false, debtorHtmlContent);
    } else {
      window.print();
    }
  };

  const handleExportDebtorsCSV = () => {
    const csvRows: string[][] = [];
    csvRows.push(["SCHOOL FEES DEBTORS SUMMARY & DETAILS REPORT"]);
    csvRows.push(["Academic Year", selectedAcademicYear]);
    csvRows.push(["Term", selectedTerm]);
    csvRows.push(["Report Date", new Date().toISOString().split('T')[0]]);
    csvRows.push(["Minimum Threshold (GHS)", debtorMinAmount]);
    csvRows.push([]);

    // 1. Class summation sheet part
    csvRows.push(["CLASS SUMMATION SUMMARY"]);
    csvRows.push(["Class", "Debtor Students Count", "Total Outstanding (GHS)"]);
    debtorData.classSummaries.forEach(s => {
      csvRows.push([s.class, String(s.count), s.totalOwed.toFixed(2)]);
    });
    csvRows.push(["Overall Total", String(debtorData.overallDebtorCount), debtorData.overallTotalOwed.toFixed(2)]);
    csvRows.push([]);
    csvRows.push([]);

    // 2. Detailed list sheet part
    csvRows.push(["DETAILED DEBTOR REGISTER"]);
    csvRows.push(["Student ID", "Student Name", "Class", "Expected Amount (GHS)", "Paid Amount (GHS)", "Outstanding Arrears (GHS)"]);
    debtorData.allDebtorStudents.forEach(d => {
      csvRows.push([
        d.student.id,
        `${d.student.firstName} ${d.student.lastName}`,
        d.student.class,
        d.expected.toFixed(2),
        d.paid.toFixed(2),
        d.owed.toFixed(2)
      ]);
    });

    const csvContent = csvRows
      .map((row) =>
        row
          .map((value) => {
            const escaped = String(value).replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Debtors_Report_${selectedAcademicYear.replace('/', '_')}_${selectedTerm.toLowerCase().replace(' ', '_')}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Debtors report exported as CSV successfully!");
  };

  // Filter students based on state selections
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      // 1. Class filter
      if (selectedClass !== 'All' && student.class !== selectedClass) return false;
      // 2. Search query filter
      const fullName = `${student.firstName} ${student.middleName || ''} ${student.lastName}`.toLowerCase();
      if (searchQuery.trim() !== '' && !fullName.includes(searchQuery.toLowerCase()) && !student.id.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [students, selectedClass, searchQuery]);

  // Debtors Analyzer Memoized Calculations
  const debtorData = useMemo(() => {
    const minAmt = parseFloat(debtorMinAmount) || 0;
    
    // Calculate expected, paid, and outstanding for all students in selected term/year
    const allDebtorStudents = students.map(student => {
      const bill = getStudentBill(student);
      const expected = calculateBillExpected(bill);
      const paid = bill.payments ? bill.payments.reduce((sum, p) => sum + p.amount, 0) : 0;
      const owed = expected - paid;
      return {
        student,
        bill,
        expected,
        paid,
        owed
      };
    }).filter(d => d.owed >= minAmt);

    // Summation of outstanding balances grouped by class
    const classSummaries = CLASSES.map(cls => {
      const classDebtors = allDebtorStudents.filter(d => d.student.class === cls);
      const count = classDebtors.length;
      const totalOwed = classDebtors.reduce((sum, d) => sum + d.owed, 0);
      const totalExpected = classDebtors.reduce((sum, d) => sum + d.expected, 0);
      const totalPaid = classDebtors.reduce((sum, d) => sum + d.paid, 0);
      return {
        class: cls,
        count,
        totalOwed,
        totalExpected,
        totalPaid
      };
    }).filter(s => s.count > 0 || s.totalOwed > 0);

    const overallTotalOwed = allDebtorStudents.reduce((sum, d) => sum + d.owed, 0);
    const overallDebtorCount = allDebtorStudents.length;

    return {
      allDebtorStudents,
      classSummaries,
      overallTotalOwed,
      overallDebtorCount
    };
  }, [students, feeBills, debtorMinAmount, selectedAcademicYear, selectedTerm]);

  const filteredDebtors = useMemo(() => {
    return debtorData.allDebtorStudents.filter(d => {
      // 1. Class filter
      if (debtorSelectedClassFilter !== 'All' && d.student.class !== debtorSelectedClassFilter) return false;
      // 2. Search query filter
      if (debtorSearchQuery.trim() !== '') {
        const fullName = `${d.student.firstName} ${d.student.middleName || ''} ${d.student.lastName}`.toLowerCase();
        if (!fullName.includes(debtorSearchQuery.toLowerCase()) && !d.student.id.toLowerCase().includes(debtorSearchQuery.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }, [debtorData.allDebtorStudents, debtorSelectedClassFilter, debtorSearchQuery]);

  return (
    <div id="fees-registry-view" className="space-y-6">
      
      {/* Dynamic Feedback Toast */}
      {toastMessage && (
        <div className={`fixed bottom-4 right-4 sm:bottom-5 sm:right-5 left-4 sm:left-auto max-w-sm z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl text-white transition-all duration-300 transform translate-y-0 ${
          toastMessage.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
        }`}>
          <Check className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">{toastMessage.text}</span>
        </div>
      )}

      {/* Main Stats Header Ribbon */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Expected (Term Summary)</p>
            <p className="text-2xl font-bold font-mono text-slate-800">
              GHS {overallStats.totalExpected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-[10px] text-slate-400 capitalize font-medium">{selectedAcademicYear} • {selectedTerm}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <Coins className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider font-semibold">Total Paid (Installments)</p>
            <p className="text-2xl font-bold font-mono text-emerald-700">
              GHS {overallStats.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="flex items-center gap-1">
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-1 rounded">
                {overallStats.collectionPercent}% Collection Rate
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-lg">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Outstanding Balance</p>
            <p className="text-2xl font-bold font-mono text-rose-600">
              GHS {overallStats.totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-[10px] text-slate-400 font-medium">Remaining to collect</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
          <div className="p-3 bg-slate-50 text-slate-600 rounded-lg">
            <User className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Active Fee Registers</p>
            <p className="text-2xl font-bold font-mono text-slate-800">{overallStats.activeAccountsCount}</p>
            <span className="text-[10px] text-slate-400 font-medium">Billed students this term</span>
          </div>
        </div>
      </div>

      {/* FEE COLLECTION DISTRIBUTION & STATUS PIE CHART ANALYTICS */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 md:p-6 space-y-6 no-print">
        {/* Header & Controls */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <PieChartIcon size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                  Fee Collection & Payment Status Distribution
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-100 text-indigo-800 border border-indigo-200 font-mono">
                  {selectedTerm}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Visual breakdown of fully paid, partially paid, and unpaid fees across {selectedAcademicYear} • {selectedTerm}
              </p>
            </div>
          </div>

          {/* Metric Mode Toggle & Class Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setChartMetricType('students')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  chartMetricType === 'students'
                    ? 'bg-white text-indigo-950 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User size={13} />
                <span>Student Count</span>
              </button>
              <button
                type="button"
                onClick={() => setChartMetricType('amount')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  chartMetricType === 'amount'
                    ? 'bg-white text-indigo-950 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Coins size={13} />
                <span>Value (GHS)</span>
              </button>
            </div>

            <select
              value={chartClassFilter}
              onChange={(e) => setChartClassFilter(e.target.value as any)}
              className="text-xs font-bold bg-slate-50 border border-slate-200 hover:border-indigo-400 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition cursor-pointer"
            >
              <option value="All">All Classes ({students.length} students)</option>
              {CLASSES.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Main Chart & Metric Cards Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          {/* Left Column: Recharts Donut Pie Chart (lg:col-span-5) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center relative bg-slate-50/60 rounded-2xl border border-slate-200/70 p-4 min-h-[300px]">
            {feeDistributionStats.totalBilledStudents === 0 ? (
              <div className="text-center py-12 space-y-2">
                <PieChartIcon className="mx-auto text-slate-300" size={38} />
                <p className="text-xs font-bold text-slate-500">No billed students found for this context.</p>
                <p className="text-[11px] text-slate-400">Initialize standard billing to populate the distribution chart.</p>
              </div>
            ) : (
              <>
                <div className="w-full h-[250px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartMetricType === 'students' ? feeDistributionStats.pieDataStudents : feeDistributionStats.pieDataAmount}
                        cx="50%"
                        cy="50%"
                        innerRadius={62}
                        outerRadius={95}
                        paddingAngle={4}
                        dataKey="value"
                        animationDuration={800}
                      >
                        {(chartMetricType === 'students' ? feeDistributionStats.pieDataStudents : feeDistributionStats.pieDataAmount).map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.color} 
                            stroke="#ffffff"
                            strokeWidth={2}
                            className="transition-all hover:opacity-85 cursor-pointer"
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const totalCount = feeDistributionStats.totalBilledStudents || 1;
                            const totalExp = feeDistributionStats.totalTermExpected || 1;
                            const pct = ((data.value / (chartMetricType === 'students' ? totalCount : totalExp)) * 100).toFixed(1);

                            return (
                              <div className="bg-slate-900/95 text-white p-3.5 rounded-xl border border-slate-700 shadow-xl text-xs space-y-1.5 min-w-[200px]">
                                <div className="flex items-center justify-between gap-3 border-b border-slate-700/80 pb-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: data.color }} />
                                    <span className="font-black text-white">{data.name}</span>
                                  </div>
                                  <span className="font-mono font-bold text-amber-300">{pct}%</span>
                                </div>

                                {chartMetricType === 'students' ? (
                                  <div className="space-y-1 pt-1 font-mono">
                                    <div className="flex justify-between text-[11px] text-slate-300 gap-3">
                                      <span>Student Count:</span>
                                      <span className="font-bold text-white">{data.value} student{data.value === 1 ? '' : 's'}</span>
                                    </div>
                                    <div className="flex justify-between text-[11px] text-slate-300 gap-3">
                                      <span>Total Paid:</span>
                                      <span className="font-bold text-emerald-400">GHS {data.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between text-[11px] text-slate-300 gap-3">
                                      <span>Total Arrears:</span>
                                      <span className="font-bold text-rose-400">GHS {data.arrears.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-1 pt-1 font-mono">
                                    <div className="flex justify-between text-[11px] text-slate-300 gap-3">
                                      <span>Amount Value:</span>
                                      <span className="font-bold text-emerald-400">GHS {data.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    {data.studentCount !== undefined && (
                                      <div className="flex justify-between text-[11px] text-slate-300 gap-3">
                                        <span>Affected Students:</span>
                                        <span className="font-bold text-white">{data.studentCount}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          return null;
                        }} 
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Center Donut Overlay Stat */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                      {chartMetricType === 'students' 
                        ? `${feeDistributionStats.fullyPaidCount + feeDistributionStats.partiallyPaidCount}/${feeDistributionStats.totalBilledStudents}`
                        : `${((feeDistributionStats.totalTermPaid / (feeDistributionStats.totalTermExpected || 1)) * 100).toFixed(0)}%`
                      }
                    </span>
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                      {chartMetricType === 'students' ? 'Paid / Billed' : 'Collection Rate'}
                    </span>
                  </div>
                </div>

                {/* Quick Legend Pills below chart */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-[11px] font-bold">
                  {(chartMetricType === 'students' ? feeDistributionStats.pieDataStudents : feeDistributionStats.pieDataAmount).map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-2xs">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-700">{item.name}:</span>
                      <span className="font-mono text-slate-950">
                        {chartMetricType === 'students' ? `${item.value} stds` : `GHS ${item.value.toLocaleString()}`}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Right Column: Detailed Breakdown Cards (lg:col-span-7) */}
          <div className="lg:col-span-7 space-y-3.5">
            {/* 1. Fully Paid Card */}
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-black uppercase text-emerald-950 tracking-wider">Fully Paid Fees</h4>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-black uppercase bg-emerald-200/80 text-emerald-900">
                      {feeDistributionStats.totalBilledStudents > 0 ? Math.round((feeDistributionStats.fullyPaidCount / feeDistributionStats.totalBilledStudents) * 100) : 0}% of Students
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 font-medium mt-0.5">
                    Students who have completely cleared all term fee obligations.
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right shrink-0 border-t sm:border-t-0 border-emerald-200/60 pt-2 sm:pt-0">
                <span className="text-lg font-black text-emerald-900 font-mono block">
                  {feeDistributionStats.fullyPaidCount} <span className="text-xs font-normal text-emerald-700">Student{feeDistributionStats.fullyPaidCount === 1 ? '' : 's'}</span>
                </span>
                <span className="text-[11px] font-bold text-emerald-700 font-mono block">
                  GHS {feeDistributionStats.fullyPaidPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Collected
                </span>
              </div>
            </div>

            {/* 2. Partially Paid Card */}
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                  <Clock size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-black uppercase text-amber-950 tracking-wider">Partially Paid Fees</h4>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-black uppercase bg-amber-200/80 text-amber-900">
                      {feeDistributionStats.totalBilledStudents > 0 ? Math.round((feeDistributionStats.partiallyPaidCount / feeDistributionStats.totalBilledStudents) * 100) : 0}% of Students
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-800 font-medium mt-0.5">
                    Active installment payments made; pending balance remaining.
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right shrink-0 border-t sm:border-t-0 border-amber-200/60 pt-2 sm:pt-0">
                <span className="text-lg font-black text-amber-900 font-mono block">
                  {feeDistributionStats.partiallyPaidCount} <span className="text-xs font-normal text-amber-700">Student{feeDistributionStats.partiallyPaidCount === 1 ? '' : 's'}</span>
                </span>
                <div className="text-[11px] font-bold font-mono space-x-1.5">
                  <span className="text-emerald-700">Paid: GHS {feeDistributionStats.partiallyPaidPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className="text-rose-700">| Bal: GHS {feeDistributionStats.partiallyPaidArrears.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* 3. Unpaid Fees Card */}
            <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                  <XCircle size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-black uppercase text-rose-950 tracking-wider">Unpaid Fees (Zero Payment)</h4>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-black uppercase bg-rose-200/80 text-rose-900">
                      {feeDistributionStats.totalBilledStudents > 0 ? Math.round((feeDistributionStats.unpaidCount / feeDistributionStats.totalBilledStudents) * 100) : 0}% of Students
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-800 font-medium mt-0.5">
                    No payments recorded against expected fee bill for this term.
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right shrink-0 border-t sm:border-t-0 border-rose-200/60 pt-2 sm:pt-0">
                <span className="text-lg font-black text-rose-900 font-mono block">
                  {feeDistributionStats.unpaidCount} <span className="text-xs font-normal text-rose-700">Student{feeDistributionStats.unpaidCount === 1 ? '' : 's'}</span>
                </span>
                <span className="text-[11px] font-black text-rose-700 font-mono block">
                  GHS {feeDistributionStats.unpaidExpected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Arrears
                </span>
              </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="bg-slate-100/90 p-3.5 rounded-2xl border border-slate-200/80 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1">
                  <TrendingUp size={14} className="text-indigo-600" />
                  Overall Term Collection Progress:
                </span>
                <span className="font-mono text-indigo-950">
                  GHS {feeDistributionStats.totalTermPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / GHS {feeDistributionStats.totalTermExpected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({feeDistributionStats.totalTermExpected > 0 ? Math.round((feeDistributionStats.totalTermPaid / feeDistributionStats.totalTermExpected) * 100) : 0}%)
                </span>
              </div>

              <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden flex">
                <div 
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ 
                    width: `${feeDistributionStats.totalTermExpected > 0 ? (feeDistributionStats.fullyPaidPaid / feeDistributionStats.totalTermExpected) * 100 : 0}%` 
                  }}
                  title="Fully Paid"
                />
                <div 
                  className="bg-amber-400 h-full transition-all duration-500"
                  style={{ 
                    width: `${feeDistributionStats.totalTermExpected > 0 ? (feeDistributionStats.partiallyPaidPaid / feeDistributionStats.totalTermExpected) * 100 : 0}%` 
                  }}
                  title="Partially Paid"
                />
                <div 
                  className="bg-rose-500/30 h-full transition-all duration-500"
                  style={{ 
                    width: `${feeDistributionStats.totalTermExpected > 0 ? (feeDistributionStats.totalTermArrears / feeDistributionStats.totalTermExpected) * 100 : 0}%` 
                  }}
                  title="Outstanding Arrears"
                />
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* SMS Delivery Summary Stats */}
      {smsLogs.length > 0 && (
        <div className="grid gap-4 mt-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Delivered SMS</p>
              <p className="text-xl font-bold font-mono text-emerald-600 mt-1">
                {smsLogs.filter(l => l.status.toLowerCase() === 'delivered').length}
              </p>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <Check className="h-5 w-5" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Pending SMS</p>
              <p className="text-xl font-bold font-mono text-blue-600 mt-1">
                {smsLogs.filter(l => !['delivered', 'failed', 'undelivered'].includes(l.status.toLowerCase())).length}
              </p>
            </div>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <MessageSquare className="h-5 w-5" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Failed SMS</p>
              <p className="text-xl font-bold font-mono text-rose-600 mt-1">
                {smsLogs.filter(l => l.status.toLowerCase() === 'failed' || l.status.toLowerCase() === 'undelivered').length}
              </p>
            </div>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
        </div>
      )}

      {/* Control Utility bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between no-print">
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <div className="flex items-center gap-1 text-slate-800 font-semibold shrink-0">
            <Filter className="h-4 w-4" />
            <span className="text-sm">Manage Context:</span>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <select 
                value={selectedAcademicYear}
                onChange={(e) => {
                  if (e.target.value === '__ADD_ACADEMIC_YEAR__') {
                    setShowAcademicYearModal(true);
                  } else {
                    setSelectedAcademicYear(e.target.value as AcademicYearType);
                  }
                }}
                className="text-xs border-slate-200 rounded-lg bg-slate-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 py-1.5 px-3"
              >
                {academicYearsList.map(y => <option key={y} value={y}>{y}</option>)}
                <option value="__ADD_ACADEMIC_YEAR__" className="font-bold text-indigo-600 bg-indigo-50/50">
                  ➕ Add Academic Year...
                </option>
              </select>
              <button
                type="button"
                onClick={() => setShowAcademicYearModal(true)}
                className="p-1.5 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                title="Add or configure Academic Year"
              >
                <Plus size={13} />
              </button>
            </div>

            <select 
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value as TermType)}
              className="text-xs border-slate-200 rounded-lg bg-slate-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 py-1.5 px-3"
            >
              {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          {/* Granular Bill Components & Levies Manager Trigger */}
          <button
            onClick={() => setShowComponentsManagerModal(true)}
            className="text-[10px] sm:text-xs inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white py-1.5 px-3 rounded-lg font-bold transition shadow-sm shrink-0 whitespace-nowrap cursor-pointer active:scale-95 border border-indigo-400/30"
            title="Define granular bill components (e.g. Exam Fees, Library Levy) with individual cost values and link to student billing statements automatically"
          >
            <Layers className="h-3.5 w-3.5 text-indigo-200 stroke-[2.5]" />
            <span>Granular Bill Components</span>
            <span className="bg-white/20 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full ml-0.5">
              {customBillComponents.filter(c => c.isActive).length} Active
            </span>
          </button>

          {/* Create New Bill Category Button */}
          <button
            onClick={() => setIsCreateCategoryModalOpen(true)}
            className="text-[10px] sm:text-xs inline-flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-1.5 px-3 rounded-lg font-bold transition border border-indigo-200 shrink-0 whitespace-nowrap cursor-pointer"
            title="Create and add another bill category"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" /> New Component
          </button>

          {/* Bulk Fee Applicator template */}
          <button
            onClick={() => setShowBulkBillingModal(true)}
            className="text-[10px] sm:text-xs inline-flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white py-1.5 px-3 rounded-lg font-medium transition shrink-0 whitespace-nowrap shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" /> Initialize Standard Billing
          </button>

          <button
            onClick={handleBulkPrintReceipts}
            className="text-[10px] sm:text-xs inline-flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-1.5 px-3 rounded-lg font-medium transition border border-indigo-200 shrink-0 whitespace-nowrap cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" /> Bulk Receipts
          </button>

          <button
            onClick={() => setShowComponentReceiptsModal(true)}
            className="text-[10px] sm:text-xs inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 px-3 rounded-lg font-bold transition shadow-sm shrink-0 whitespace-nowrap cursor-pointer active:scale-95"
            title="Generate and download official PDF receipts specifically for bill component payments (Exam Fees, Library Levy, etc.)"
          >
            <Receipt className="h-3.5 w-3.5" /> Component PDF Receipts
          </button>

          <button
            onClick={() => setShowDebtorsModal(true)}
            className="text-[10px] sm:text-xs inline-flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white py-1.5 px-3 rounded-lg font-medium transition shadow-sm shrink-0 whitespace-nowrap"
          >
            <AlertTriangle className="h-3.5 w-3.5 animate-bounce-slow" /> Debtors
          </button>

          <button
            onClick={() => setShowReportCenterModal(true)}
            className="text-[10px] sm:text-xs inline-flex items-center justify-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white py-1.5 px-3 rounded-lg font-medium transition shadow-sm select-none shrink-0 whitespace-nowrap"
          >
            <FileDown className="h-3.5 w-3.5" /> PDF Center
          </button>

          <button
            onClick={handleClearAllFees}
            className="text-[10px] sm:text-xs inline-flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 py-1.5 px-3 rounded-lg font-medium transition border border-rose-200 shrink-0 whitespace-nowrap"
          >
            <Trash2 className="h-3.5 w-3.5" /> Reset
          </button>
        </div>
      </div>

      {/* SMS Delivery Tracking Panel */}
      {smsLogs.length > 0 && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 no-print">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="text-indigo-600" size={15} /> 
                Automated SMS Deliveries 
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Live tracking of fee reminder dispatches</p>
            </div>
            <button 
              onClick={() => {
                setConfirmModal({
                  isOpen: true,
                  title: "Clear SMS Delivery Logs?",
                  message: "Are you sure you want to clear all automated SMS dispatch records? This will purge the live tracking table.",
                  confirmText: "Clear Logs",
                  danger: true,
                  onConfirm: () => {
                    setSmsLogs([]);
                  }
                });
              }}
              className="text-[10px] text-rose-500 hover:text-rose-700 font-bold px-2 py-1 bg-rose-50 rounded"
            >
              Clear Logs
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[9px] uppercase tracking-wider text-slate-500 border-y border-slate-200">
                  <th className="p-2 font-semibold">Sent At</th>
                  <th className="p-2 font-semibold">Student / Parent</th>
                  <th className="p-2 font-semibold">Phone #</th>
                  <th className="p-2 font-semibold text-right">Delivery Status</th>
                </tr>
              </thead>
              <tbody className="text-[11px] divide-y divide-slate-100 font-medium">
                {smsLogs.map((log) => (
                  <tr key={log.sid} className="hover:bg-slate-50">
                    <td className="p-2 text-slate-500 font-mono">
                      {new Date(log.sentAt).toLocaleString('en-US', { hour12: true, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-2 text-slate-800">{log.studentName}</td>
                    <td className="p-2 text-slate-600 font-mono">{log.phone}</td>
                    <td className="p-2 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${
                        log.status.toLowerCase() === 'delivered' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                        log.status.toLowerCase() === 'failed' || log.status.toLowerCase() === 'undelivered' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                        log.status.toLowerCase() === 'sent' || log.status.toLowerCase() === 'queued' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                        'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DEDICATED GRANULAR BILL COMPONENTS & LEVIES REAL-TIME EDITABLE SECTION     */}
      {/* ========================================================================= */}
      <div id="granular-bill-components-editable-section" className="bg-white rounded-xl shadow-sm border border-slate-200/90 overflow-hidden mb-6">
        {/* Section Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-blue-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-sm shadow-blue-200 shrink-0">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Bill Components & Itemized Levies
                </h3>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                  {customBillComponents.filter(c => c.isActive).length} of {customBillComponents.length} Active
                </span>
                <span className="px-2.5 py-0.5 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-mono">
                  Total Active Levies: GHS {customBillComponents.filter(c => c.isActive).reduce((sum, c) => sum + (Number(c.defaultAmount) || 0), 0).toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage granular charges (Exam Fees, Library Levy, ICT Lab, etc.) with real-time costs that link dynamically into student billing statements.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={() => setShowComponentReceiptsModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition shadow-sm active:scale-95 cursor-pointer"
              title="Generate and download official PDF receipts specifically for bill component payments (Exam Fees, Library Levy, etc.)"
            >
              <Receipt className="h-3.5 w-3.5 text-emerald-600" />
              <span>Component PDF Receipts</span>
            </button>

            <button
              type="button"
              onClick={handleSyncComponentsToAllStudents}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition shadow-sm active:scale-95 cursor-pointer"
              title="Push current active components and fees to all registered student bills for this term"
            >
              <RefreshCw className="h-3.5 w-3.5 text-blue-600" />
              <span>Sync to Student Statements</span>
            </button>

            <button
              type="button"
              onClick={() => setShowInlineAddRow(!showInlineAddRow)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition shadow-sm active:scale-95 ${
                showInlineAddRow
                  ? 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'
              }`}
            >
              {showInlineAddRow ? (
                <>
                  <X className="h-3.5 w-3.5" />
                  <span>Cancel Add</span>
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  <span>+ Add Component</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleResetToDefaultComponents}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
              title="Restore standard default bill components (Exam, Library, ICT)"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Quick Filter & Search Bar */}
        <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search component or code..."
                value={componentSearchQuery}
                onChange={(e) => setComponentSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 placeholder-slate-400"
              />
              {componentSearchQuery && (
                <button
                  type="button"
                  onClick={() => setComponentSearchQuery('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <select
              value={componentCategoryFilter}
              onChange={(e) => setComponentCategoryFilter(e.target.value as any)}
              className="text-xs py-1.5 px-2 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Categories</option>
              <option value="Academic">Academic</option>
              <option value="Facilities & Utilities">Facilities & Utilities</option>
              <option value="Welfare & Feeding">Welfare & Feeding</option>
              <option value="Extra-Curricular">Extra-Curricular</option>
              <option value="Logistics & Transport">Logistics & Transport</option>
              <option value="Materials & Books">Materials & Books</option>
              <option value="Special Projects">Special Projects</option>
            </select>
          </div>

          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 self-end sm:self-center font-medium">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            <span>Values update in real-time — edits persist immediately to database and active bills</span>
          </div>
        </div>

        {/* Quick-Add Inline Form Row (when toggled) */}
        {showInlineAddRow && (
          <form
            onSubmit={handleAddInlineComponent}
            className="p-4 bg-blue-50/50 border-b border-blue-100 flex flex-col md:flex-row items-stretch md:items-end gap-3 transition-all"
          >
            <div className="flex-1 min-w-[180px]">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Component Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Exam Fees, Library Levy"
                value={inlineNewComp.name}
                onChange={(e) => setInlineNewComp({ ...inlineNewComp, name: e.target.value })}
                className="w-full text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
              />
            </div>

            <div className="w-full md:w-28">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Code
              </label>
              <input
                type="text"
                placeholder="e.g. EXAM"
                value={inlineNewComp.code}
                onChange={(e) => setInlineNewComp({ ...inlineNewComp, code: e.target.value.toUpperCase() })}
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 font-mono uppercase"
              />
            </div>

            <div className="w-full md:w-44">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Category
              </label>
              <select
                value={inlineNewComp.category}
                onChange={(e) => setInlineNewComp({ ...inlineNewComp, category: e.target.value as BillComponentCategory })}
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
              >
                <option value="Academic">Academic</option>
                <option value="Facilities & Utilities">Facilities & Utilities</option>
                <option value="Welfare & Feeding">Welfare & Feeding</option>
                <option value="Extra-Curricular">Extra-Curricular</option>
                <option value="Logistics & Transport">Logistics & Transport</option>
                <option value="Materials & Books">Materials & Books</option>
                <option value="Special Projects">Special Projects</option>
              </select>
            </div>

            <div className="w-full md:w-36">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Cost Value (GHS) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1.5 text-xs font-bold text-slate-400">GHS</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  placeholder="0.00"
                  value={inlineNewComp.defaultAmount}
                  onChange={(e) => setInlineNewComp({ ...inlineNewComp, defaultAmount: e.target.value })}
                  className="w-full text-xs pl-11 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 font-bold"
                />
              </div>
            </div>

            <div className="w-full md:w-36">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Frequency
              </label>
              <select
                value={inlineNewComp.frequency}
                onChange={(e) => setInlineNewComp({ ...inlineNewComp, frequency: e.target.value as any })}
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
              >
                <option value="Per Term">Per Term</option>
                <option value="Per Year">Per Year</option>
                <option value="One-Time">One-Time</option>
                <option value="Optional">Optional</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-1 md:pt-0 shrink-0">
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition shadow-sm flex items-center gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Save Component</span>
              </button>
              <button
                type="button"
                onClick={() => setShowInlineAddRow(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Real-Time Editable Components Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <th className="py-2.5 px-4 font-bold">Component Name & Code</th>
                <th className="py-2.5 px-3 font-bold">Category</th>
                <th className="py-2.5 px-3 font-bold">
                  <div className="flex items-center gap-1">
                    <span>Associated Cost (GHS)</span>
                    <span className="text-[9px] font-normal lowercase bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full">real-time</span>
                  </div>
                </th>
                <th className="py-2.5 px-3 font-bold">Frequency</th>
                <th className="py-2.5 px-3 font-bold">Class Scope</th>
                <th className="py-2.5 px-3 font-bold text-center">Status</th>
                <th className="py-2.5 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100 font-normal">
              {customBillComponents
                .filter(c => {
                  if (!c) return false;
                  const searchLower = (componentSearchQuery || '').toLowerCase();
                  const matchesSearch = !searchLower || 
                    (c.name || '').toLowerCase().includes(searchLower) ||
                    ((c.code || '').toLowerCase().includes(searchLower));
                  const matchesCategory = componentCategoryFilter === 'All' || c.category === componentCategoryFilter;
                  return matchesSearch && matchesCategory;
                })
                .map((comp) => {
                  return (
                    <tr key={comp.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Name & Code */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={comp.name}
                            onChange={(e) => handleUpdateComponentInline(comp.id, { name: e.target.value })}
                            className="font-semibold text-slate-900 text-xs px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 transition max-w-[200px]"
                            title="Click to edit component name"
                          />
                          <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                            {comp.code || 'COMP'}
                          </span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-2.5 px-3">
                        <select
                          value={comp.category}
                          onChange={(e) => handleUpdateComponentInline(comp.id, { category: e.target.value as BillComponentCategory })}
                          className="text-xs py-1 px-2 bg-slate-50 hover:bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 transition cursor-pointer"
                        >
                          <option value="Academic">Academic</option>
                          <option value="Facilities & Utilities">Facilities & Utilities</option>
                          <option value="Welfare & Feeding">Welfare & Feeding</option>
                          <option value="Extra-Curricular">Extra-Curricular</option>
                          <option value="Logistics & Transport">Logistics & Transport</option>
                          <option value="Materials & Books">Materials & Books</option>
                          <option value="Special Projects">Special Projects</option>
                        </select>
                      </td>

                      {/* Associated Cost (Real-time Editable Numeric Cell) */}
                      <td className="py-2.5 px-3">
                        <div className="relative flex items-center max-w-[150px]">
                          <span className="absolute left-2.5 text-[11px] font-bold text-slate-400 select-none pointer-events-none">
                            GHS
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={comp.defaultAmount === 0 ? '' : comp.defaultAmount}
                            placeholder="0.00"
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              handleUpdateComponentInline(comp.id, { defaultAmount: Math.max(0, val) });
                            }}
                            onBlur={() => {
                              showToast(`Updated "${comp.name}" cost to GHS ${Number(comp.defaultAmount).toFixed(2)}.`, 'success');
                            }}
                            className="w-full pl-11 pr-2.5 py-1 text-xs font-bold text-slate-900 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-right shadow-inner"
                            title="Edit cost value in real-time"
                          />
                        </div>
                      </td>

                      {/* Frequency */}
                      <td className="py-2.5 px-3">
                        <select
                          value={comp.frequency}
                          onChange={(e) => handleUpdateComponentInline(comp.id, { frequency: e.target.value as any })}
                          className="text-xs py-1 px-2 bg-slate-50 hover:bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 transition cursor-pointer"
                        >
                          <option value="Per Term">Per Term</option>
                          <option value="Per Year">Per Year</option>
                          <option value="One-Time">One-Time</option>
                          <option value="Optional">Optional</option>
                        </select>
                      </td>

                      {/* Class Scope */}
                      <td className="py-2.5 px-3">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {comp.applicableClasses.includes('All') ? 'All Classes' : comp.applicableClasses.join(', ')}
                        </span>
                      </td>

                      {/* Active Status (Real-time toggle switch) */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleUpdateComponentInline(comp.id, { isActive: !comp.isActive })}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition border active:scale-95 ${
                            comp.isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          }`}
                          title={comp.isActive ? 'Click to disable from new bills' : 'Click to activate on bills'}
                        >
                          {comp.isActive ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              <span>Active</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3 text-slate-400" />
                              <span>Disabled</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteGranularComponent(comp.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition border border-transparent hover:border-rose-200 active:scale-95"
                          title={`Delete ${comp.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

              {customBillComponents.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    <p className="text-xs mb-2 text-slate-500 font-medium">No custom bill components or itemized levies defined yet.</p>
                    <button
                      type="button"
                      onClick={() => setShowInlineAddRow(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition cursor-pointer shadow-xs active:scale-95"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add First Bill Component</span>
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Section Footer / Information Note */}
        <div className="p-3 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
          <div className="flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            <span>
              All modifications apply in real-time. Use <strong>"Sync to Student Statements"</strong> to immediately refresh itemized totals for all existing students in {selectedTerm}, {selectedAcademicYear}.
            </span>
          </div>
          <div className="font-semibold text-slate-700 shrink-0">
            {customBillComponents.filter(c => c.isActive).length} component{customBillComponents.filter(c => c.isActive).length === 1 ? '' : 's'} linked
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Student Selection Search lists (grid-span-5) */}
        <div id="school-fees-student-list-container" className="lg:col-span-4 bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col h-[650px]">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider flex items-center gap-1.5">
              <User className="h-4 w-4" /> Student Registry
            </h3>

            <div className="flex flex-col gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name or registry ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value as ClassType | 'All')}
                className="w-full text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 py-1.5 px-2"
              >
                <option value="All">Filter Class: All Classes</option>
                {CLASSES.map(cls => <option key={cls} value={cls}>{cls}</option>)}
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredStudents.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No matching student records found.
              </div>
            ) : (
              filteredStudents.map(student => {
                const bill = getStudentBill(student);
                const expected = calculateBillExpected(bill);
                const paid = (bill.payments || []).reduce((sum, p) => sum + (Number(p?.amount) || 0), 0);
                const bal = expected - paid;
                const isSelected = student.id === activeStudentId;

                return (
                  <button
                    key={student.id}
                    onClick={() => setActiveStudentId(student.id)}
                    className={`w-full p-3 text-left transition flex items-center justify-between ${
                      isSelected ? 'bg-blue-50/70 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-semibold text-slate-800">
                          {student.firstName} {student.lastName}
                        </p>
                        {bal > 0 && (
                          <span className="text-[8px] bg-rose-50 text-rose-700 px-1.5 py-0.2 rounded font-bold border border-rose-200 select-none uppercase tracking-wider">
                            Arrears
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {student.class} • Register {student.id}
                      </p>
                    </div>

                    <div className="text-right">
                      {expected === 0 ? (
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-mono font-medium">Unbilled</span>
                      ) : (
                        <div>
                          <p className={`text-xs font-bold font-mono ${bal <= 0 ? 'text-emerald-600' : 'text-rose-600 animate-pulse-slow'}`}>
                            {bal <= 0 ? 'Fully Paid' : `Bal: GHS ${bal.toFixed(0)}`}
                          </p>
                          <p className="text-[9px] text-slate-400 mt-0.5">
                            Paid: GHS {paid.toFixed(0)} / {expected.toFixed(0)}
                          </p>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Active Student Accounts & Payments Ledger Details (grid-span-8) */}
        <div id="fees-summary-table-and-view" className="lg:col-span-8 space-y-6">
          {activeStudent && activeBill ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
              
              {/* Active Student Card Header */}
              <div className="flex flex-col 2xl:flex-row justify-between items-start 2xl:items-center pb-4 border-b border-slate-100 gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase py-0.5 px-2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                      BILLING & LEDGER {selectedTerm}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-800 mt-1 capitalize leading-snug truncate">
                    {activeStudent.firstName} {activeStudent.middleName ? activeStudent.middleName + ' ' : ''}{activeStudent.lastName}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Class {activeStudent.class} • Student ID: <span className="font-mono font-semibold">{activeStudent.id}</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full 2xl:w-auto">
                  {activeExpectedAndPaid.bal > 0 && (
                    <button
                      onClick={handleOpenReminderModal}
                      className="text-xs inline-flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white py-2 px-3 rounded-lg font-semibold transition shadow-sm select-none active:translate-y-0.5 shrink-0 whitespace-nowrap"
                    >
                      <Bell className="h-3.5 w-3.5 animate-bounce-slow" /> <span>Notice & SMS Reminder</span>
                    </button>
                  )}

                  <button
                    onClick={handleOpenInvoice}
                    className="text-xs inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-3 rounded-lg font-semibold transition shadow-sm select-none active:translate-y-0.5 shrink-0 whitespace-nowrap"
                  >
                    <Receipt className="h-3.5 w-3.5" /> <span>Generate Invoice</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveLedgerStudent(activeBill);
                    }}
                    className="text-xs inline-flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-3 rounded-lg font-medium transition shrink-0 whitespace-nowrap"
                  >
                    <Printer className="h-3.5 w-3.5" /> <span>Full Ledger</span>
                  </button>

                  <button
                    onClick={() => setShowPaymentModal(true)}
                    className="text-xs inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-3 rounded-lg font-medium transition shadow-sm shrink-0 whitespace-nowrap"
                  >
                    <Plus className="h-3.5 w-3.5" /> <span>Record Installment</span>
                  </button>
                </div>
              </div>

              {/* Installments calculations balances details box */}
              {(() => {
                const expected = activeBill.schoolFees + activeBill.utilityBill + activeBill.sportsFees + activeBill.ptaDues + (activeBill.transportationBill || 0) + activeBill.otherFee;
                const paid = (activeBill.payments || []).reduce((sum, p) => sum + (Number(p?.amount) || 0), 0);
                const bal = expected - paid;

                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="p-3 bg-white rounded-lg border border-slate-100">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Expected Term Bills</p>
                      <p className="text-xl font-bold font-mono text-slate-700 mt-1">GHS {expected.toFixed(2)}</p>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-100">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Total Installments Paid</p>
                      <p className="text-xl font-bold font-mono text-emerald-700 mt-1">GHS {paid.toFixed(2)}</p>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-100">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Outstanding/Balance Due</p>
                      <p className={`text-xl font-bold font-mono mt-1 ${bal > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        GHS {bal.toFixed(2)}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* SECTION: ADMIN ADD/MODIFY BILLS */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                  <span>Modify Expected Bill Categories (Terminal setup)</span>
                  <span className="text-[10px] text-slate-400 capitalize font-medium font-sans">Modify values instantly. Changes persist.</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">School Fees (GHS)</label>
                    <input
                      type="number"
                      value={activeBill.schoolFees}
                      min="0"
                      onChange={(e) => handleEditBillComponent('schoolFees', parseFloat(e.target.value) || 0)}
                      className="w-full text-xs font-mono py-1.5 px-3 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Utility Bill (GHS)</label>
                    <input
                      type="number"
                      value={activeBill.utilityBill}
                      min="0"
                      onChange={(e) => handleEditBillComponent('utilityBill', parseFloat(e.target.value) || 0)}
                      className="w-full text-xs font-mono py-1.5 px-3 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Sports Fees (GHS)</label>
                    <input
                      type="number"
                      value={activeBill.sportsFees}
                      min="0"
                      onChange={(e) => handleEditBillComponent('sportsFees', parseFloat(e.target.value) || 0)}
                      className="w-full text-xs font-mono py-1.5 px-3 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">PTA Dues (GHS)</label>
                    <input
                      type="number"
                      value={activeBill.ptaDues}
                      min="0"
                      onChange={(e) => handleEditBillComponent('ptaDues', parseFloat(e.target.value) || 0)}
                      className="w-full text-xs font-mono py-1.5 px-3 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Transportation Bill (GHS)</label>
                    <input
                      type="number"
                      value={activeBill.transportationBill || 0}
                      min="0"
                      onChange={(e) => handleEditBillComponent('transportationBill', parseFloat(e.target.value) || 0)}
                      className="w-full text-xs font-mono py-1.5 px-3 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Other Fee amount (GHS)</label>
                    <input
                      type="number"
                      value={activeBill.otherFee}
                      min="0"
                      onChange={(e) => handleEditBillComponent('otherFee', parseFloat(e.target.value) || 0)}
                      className="w-full text-xs font-mono py-1.5 px-3 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Other Fee Memo Description</label>
                    <input
                      type="text"
                      placeholder="e.g. Excursion, Practical materials"
                      value={activeBill.otherFeeDescription || ''}
                      onChange={(e) => handleEditBillComponent('otherFeeDescription', e.target.value)}
                      className="w-full text-xs py-1.5 px-3 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* GRANULAR BILL COMPONENTS & LEVIES FOR THIS STUDENT */}
                <div className="mt-4 pt-3.5 border-t border-slate-200/90 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Granular Bill Components &amp; Levies</span>
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded-full normal-case">
                          {(activeBill.customComponents || []).length} Linked
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Itemized component costs automatically linked to this student's billing statement. Admins can customize individual values.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowComponentsManagerModal(true)}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        <Settings2 size={12} />
                        <span>Manage All Components</span>
                      </button>
                    </div>
                  </div>

                  {/* Components cards grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {(activeBill.customComponents || []).map((comp) => (
                      <div
                        key={comp.componentId}
                        className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-indigo-300 transition group space-y-2 relative"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 pr-1">
                            <span className="text-xs font-bold text-slate-800 block truncate" title={comp.componentName}>
                              {comp.componentName}
                            </span>
                            {comp.category && (
                              <span className="inline-block text-[9px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100 mt-0.5">
                                {comp.category}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomComponentFromActiveBill(comp.componentId)}
                            className="text-slate-300 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition cursor-pointer shrink-0"
                            title="Remove this levy from student's billing statement"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        <div>
                          <label className="block text-[10px] font-medium text-slate-500 mb-1">
                            Individual Cost Value (GHS)
                          </label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono font-bold">
                              GHS
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={comp.amount}
                              onChange={(e) => handleEditCustomComponent(comp.componentId, parseFloat(e.target.value) || 0)}
                              className="w-full text-xs font-mono font-bold text-slate-800 py-1.5 pl-11 pr-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50/50 focus:bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Dropdown to link another component */}
                    {customBillComponents.filter(c => !(activeBill.customComponents || []).some(sc => sc.componentId === c.id)).length > 0 && (
                      <div className="p-3 bg-slate-50/70 border border-dashed border-slate-300 rounded-xl flex flex-col justify-center gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                          <Plus size={11} /> Link Granular Component
                        </label>
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAddCustomComponentToActiveBill(e.target.value);
                              e.target.value = '';
                            }
                          }}
                          defaultValue=""
                          className="w-full text-xs py-1.5 px-2 border border-slate-200 rounded-lg bg-white text-slate-700 cursor-pointer focus:ring-1 focus:ring-indigo-500 font-medium"
                        >
                          <option value="" disabled>Select component to link...</option>
                          {customBillComponents
                            .filter(c => !(activeBill.customComponents || []).some(sc => sc.componentId === c.id))
                            .map(c => (
                              <option key={c.id} value={c.id}>
                                {c.name} (GHS {Number(c.defaultAmount).toFixed(2)})
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* INSTALLMENT TRANSACTION LIST */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                    <Receipt className="h-4 w-4" /> Installments payment history (Receipt directory)
                  </h3>
                  {activeBill.payments.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-medium">Filter Component:</span>
                      <select
                        value={activeInstallmentComponentFilter}
                        onChange={(e) => setActiveInstallmentComponentFilter(e.target.value)}
                        className="text-[11px] font-semibold border border-slate-200 bg-white rounded-lg px-2.5 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                      >
                        <option value="All">All Components ({activeBill.payments.length})</option>
                        {Array.from(new Set(activeBill.payments.map(p => p.component || 'School Fees'))).map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="border border-slate-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        <th className="py-2.5 px-3">Installment Date</th>
                        <th className="py-2.5 px-3">Receipt Code</th>
                        <th className="py-2.5 px-3">Allocated Component</th>
                        <th className="py-2.5 px-3">Method</th>
                        <th className="py-2.5 px-3 text-right">Amount (GHS)</th>
                        <th className="py-2.5 px-3 text-center">Receipt Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {activeBill.payments.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400 font-mono text-[11px]">
                            No payment installments received for this academic term yet.
                          </td>
                        </tr>
                      ) : activeBill.payments.filter(p => activeInstallmentComponentFilter === 'All' || p.component === activeInstallmentComponentFilter).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400 font-mono text-[11px]">
                            No payments found matching "{activeInstallmentComponentFilter}".
                          </td>
                        </tr>
                      ) : (
                        activeBill.payments
                          .filter(p => activeInstallmentComponentFilter === 'All' || p.component === activeInstallmentComponentFilter)
                          .map(payment => (
                          <tr key={payment.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono text-[11px] text-slate-600">{payment.date}</td>
                            <td className="py-2 px-3 font-semibold text-[11px] font-mono text-slate-800">{payment.receiptNo}</td>
                            <td className="py-2 px-3">
                              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                                {payment.component}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-600">{payment.method}</td>
                            <td className="py-2 px-3 font-mono font-semibold text-right text-emerald-700">
                              {payment.amount.toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <div className="inline-flex gap-1.5 items-center justify-center">
                                <button
                                  onClick={() => handleGenerateComponentPdfReceipt(activeBill, payment)}
                                  disabled={isGeneratingComponentPdf}
                                  title={`Download Official PDF Receipt for ${payment.component}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition border border-emerald-200 disabled:opacity-50 cursor-pointer shadow-2xs active:scale-95"
                                >
                                  <FileDown className="h-3 w-3" /> PDF
                                </button>
                                <button
                                  onClick={() => setActiveReceiptPayment({ bill: activeBill, payment })}
                                  title="Preview & Print Official Receipt"
                                  className="p-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                                >
                                  <Receipt className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeletePayment(payment.id)}
                                  title="Delete Transaction"
                                  className="p-1 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ) : (
            /* DEFAULT EMPTY REGISTRY DASHBOARD TABLE */
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest">School Fees Registry - Quick Overview</h3>
                  <p className="text-[10px] text-slate-400">Total ledger summaries across class divisions for {selectedAcademicYear} • {selectedTerm}</p>
                </div>
              </div>

              <div id="school-fees-general-table" className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1200px]">
                  <thead>
                    <tr className="bg-slate-100/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                      <th className="p-3">Student Details & Class</th>
                      <th className="p-3">School Fees</th>
                      <th className="p-3">Utility Bill</th>
                      <th className="p-3">Sports Fees</th>
                      <th className="p-3">PTA Dues</th>
                      <th className="p-3">Transport Bill</th>
                      <th className="p-3">Other Fee</th>
                      <th className="p-3">Granular Levies</th>
                      <th className="p-3 text-right">Term Total</th>
                      <th className="p-3 text-right">Amount Paid</th>
                      <th className="p-3 text-right">Outstanding Bal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {students.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="p-8 text-center text-slate-400 font-mono">
                          Please register students first in the Student profiles registry directory in order to manage billing.
                        </td>
                      </tr>
                    ) : (
                      students.map(student => {
                        const bill = getStudentBill(student);
                        const expected = calculateBillExpected(bill);
                        const paid = (bill.payments || []).reduce((sum, p) => sum + (Number(p?.amount) || 0), 0);
                        const outstanding = expected - paid;
                        const customSum = (bill.customComponents || []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

                        return (
                          <tr key={student.id} className="hover:bg-slate-50/50">
                            <td className="p-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-semibold text-slate-700">{student.firstName} {student.lastName}</p>
                                {outstanding > 0 && (
                                  <span className="text-[8px] bg-rose-50 text-rose-700 font-bold px-1.5 py-0.2 rounded border border-rose-200 select-none uppercase tracking-wider">
                                    Arrears
                                  </span>
                                )}
                              </div>
                              <p className="text-[9px] text-slate-400">{student.class} • Register #{student.id}</p>
                            </td>
                            <td className="p-3 font-mono text-[11px] text-slate-500">GHS {bill.schoolFees}</td>
                            <td className="p-3 font-mono text-[11px] text-slate-500">GHS {bill.utilityBill}</td>
                            <td className="p-3 font-mono text-[11px] text-slate-500">GHS {bill.sportsFees}</td>
                            <td className="p-3 font-mono text-[11px] text-slate-500">GHS {bill.ptaDues}</td>
                            <td className="p-3 font-mono text-[11px] text-slate-500">GHS {bill.transportationBill || 0}</td>
                            <td className="p-3 font-mono text-[11px] text-slate-500">GHS {bill.otherFee} <span className="text-[9px] text-slate-400 italic block">{bill.otherFeeDescription}</span></td>
                            <td className="p-3 font-mono text-[11px] text-indigo-700 font-semibold">
                              GHS {customSum.toFixed(1)}
                              {(bill.customComponents || []).length > 0 && (
                                <span className="block text-[8.5px] text-slate-400 font-sans font-normal truncate max-w-[120px]" title={(bill.customComponents || []).map(c => `${c.componentName}: ${c.amount}`).join(', ')}>
                                  {(bill.customComponents || []).map(c => c.componentName).join(', ')}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono font-medium text-slate-700 font-semibold bg-slate-50/30">
                              GHS {expected.toFixed(1)}
                            </td>
                            <td className="p-3 text-right font-mono font-semibold text-emerald-700">
                              GHS {paid.toFixed(1)}
                            </td>
                            <td className={`p-3 text-right font-mono font-bold ${outstanding > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                              GHS {outstanding.toFixed(1)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* MODAL overlay: Receive Installment Form */}
      <AnimatePresence>
        {showPaymentModal && activeStudent && activeBill && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowPaymentModal(false);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto cursor-pointer no-print"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ ease: "easeOut", duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white max-w-[465px] w-full rounded-[24px] shadow-2xl border border-slate-100 overflow-hidden cursor-default md:my-8"
            >
              
              <div className="p-6 pb-4 bg-white border-b border-slate-100/80 flex items-center justify-between">
                <div>
                  <h3 className="text-[13px] font-bold text-slate-800 uppercase tracking-widest font-sans flex items-center gap-1.5 leading-none">
                    <CreditCard className="h-4 w-4 text-emerald-650" /> Settle Student Fees
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1">Settle or log fee collections for {activeBill.studentName}</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="p-1 px-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Secure Tab Controller inside Dialog */}
              <div className="flex border-b border-slate-100 bg-slate-50/50 p-1 no-print">
                <button
                  type="button"
                  onClick={() => setPaymentTab('manual')}
                  className={`flex-1 py-2 text-center text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    paymentTab === 'manual'
                      ? 'bg-white text-slate-800 shadow-sm border border-slate-200/45 font-extrabold'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Manual Cash/Cheque
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentTab('paystack')}
                  className={`flex-1 py-1 px-2 text-center text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    paymentTab === 'paystack'
                      ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/40 font-extrabold'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Paystack MoMo/Card
                </button>
              </div>

              <div className="p-6 md:p-8 space-y-5 text-xs text-left bg-white">
                {/* Form fields that are shared between both manual and online payments */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Component allocation</label>
                    <button
                      type="button"
                      onClick={() => setIsCreateCategoryModalOpen(true)}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer select-none flex items-center gap-1"
                    >
                      <Plus size={12} className="stroke-[2.5]" />
                      <span>Not listed? Create New</span>
                    </button>
                  </div>
                  <select
                    value={paymentComponent}
                    onChange={(e) => setPaymentComponent(e.target.value as FeePayment['component'])}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-[13px] text-slate-700 bg-slate-50/15 hover:bg-slate-50/30 transition duration-150 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none"
                  >
                    <optgroup label="Standard School Fees">
                      <option value="School Fees">School Fees (Standard tuition)</option>
                      <option value="Utility Bill">Utility Bill</option>
                      <option value="Sports Fees">Sports Fees</option>
                      <option value="PTA dues">PTA Dues</option>
                      <option value="Transportation Bill">Transportation Bill</option>
                      <option value="Other Fee">Other Fee (Excursions/Misc)</option>
                    </optgroup>
                    {customBillComponents.length > 0 && (
                      <optgroup label="Custom Bill Categories &amp; Levies">
                        {customBillComponents.map(comp => (
                          <option key={comp.id} value={comp.name}>
                            {comp.name} ({comp.category})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Payment Amount (GHS)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3.5 font-bold text-slate-400 font-mono text-[10px] leading-none">GHS</span>
                    <input
                      type="number"
                      required
                      min="1"
                      step="0.01"
                      placeholder="0.00"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl pl-12 pr-4 py-2.5 font-sans text-[13px] focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none text-slate-700 font-medium"
                    />
                  </div>
                </div>

                {paymentTab === 'manual' ? (
                  <form onSubmit={handleAddPayment} className="space-y-5 pt-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Transaction date</label>
                      <input
                        type="date"
                        required
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 font-sans text-[13px] focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none text-slate-700"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Payment Method</label>
                      <div className="grid grid-cols-4 gap-2">
                        {(['Cash', 'Mobile Money', 'Bank Transfer', 'Cheque'] as const).map(met => (
                          <button
                            key={met}
                            type="button"
                            onClick={() => setPaymentMethod(met)}
                            className={`py-2 px-1 border rounded-xl font-medium text-[11px] text-center transition ${
                              paymentMethod === met 
                                ? 'border-blue-500 bg-blue-50/40 text-blue-600 font-semibold' 
                                : 'border-slate-200/80 hover:bg-slate-50 text-slate-500 font-normal bg-white'
                            }`}
                          >
                            {met}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Remarks / Details / Memo</label>
                      <input
                        type="text"
                        placeholder="e.g. Paid in cash by father, transaction reference"
                        value={paymentRemarks}
                        onChange={(e) => setPaymentRemarks(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-[13px] text-slate-700 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none placeholder:text-slate-300"
                      />
                    </div>

                    <div className="pt-6 border-t border-slate-100 flex justify-end gap-3 bg-white">
                      <button
                        type="button"
                        onClick={() => setShowPaymentModal(false)}
                        className="px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-500 font-semibold rounded-xl transition cursor-pointer text-[12px]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-[#059669] hover:bg-[#047857] text-white font-semibold rounded-xl shadow-xs transition cursor-pointer text-[12px]"
                      >
                        Record Installment
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="pt-2">
                    <PaystackPaymentTrigger
                      paymentType="fees"
                      studentId={activeStudent.id}
                      studentName={`${activeStudent.firstName} ${activeStudent.lastName}`}
                      email={activeStudent.email || ''}
                      amount={parseFloat(paymentAmount) || 0}
                      academicYear={selectedAcademicYear}
                      term={selectedTerm}
                      component={paymentComponent}
                      billId={activeBill.id}
                      onSuccess={(verifiedData) => {
                        const amount = parseFloat(paymentAmount) || verifiedData.amount;
                        const randPart = Math.floor(1000 + Math.random() * 9000);
                        const generatedReceipt = `GTIMS-PAYSTACK-${selectedAcademicYear.split('/')[0]}-${randPart}`;
                        const today = new Date().toISOString().split('T')[0];

                        const newPayment: FeePayment = {
                          id: verifiedData.reference,
                          amount,
                          date: today,
                          component: paymentComponent,
                          method: 'Mobile Money',
                          receiptNo: generatedReceipt,
                          remarks: `Paid online via Paystack. Ref: ${verifiedData.reference}`
                        };

                        const nextBill: StudentFeeBill = {
                          ...activeBill,
                          payments: [...activeBill.payments, newPayment],
                          updatedAt: new Date().toISOString()
                        };

                        handleSaveBill(nextBill);
                        setTimeout(() => {
                          setShowPaymentModal(false);
                          setPaymentAmount('');
                          setPaymentRemarks('');
                        }, 2000);
                      }}
                      onCancel={() => setShowPaymentModal(false)}
                      triggerLabel={`Initialize Online Settle: GHS ${(parseFloat(paymentAmount) || 0).toFixed(2)}`}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DYNAMIC GENERAL PRINT AREA (HIDDEN) FOR RECEIPT SPECIFIC */}
      <AnimatePresence>
        {activeReceiptPayment && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) setActiveReceiptPayment(null);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto cursor-pointer no-print"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ ease: "easeOut", duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white max-w-2xl w-full rounded-[24px] shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] cursor-default md:my-8"
            >
              
              <div className="p-6 pb-4 bg-white border-b border-slate-100/85 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-[13px] font-bold text-slate-800 uppercase tracking-widest font-sans leading-none">
                    GTIMS OFFICIAL RECEIPT
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1">Review ledger payment transaction metadata</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePrintStandard('fee-receipt-print-area', `Official Payment Receipt - ${activeReceiptPayment.payment.receiptNo}`)}
                    className="px-3.5 py-2 hover:bg-slate-50 border border-slate-200 text-slate-500 font-semibold rounded-xl text-xs transition cursor-pointer bg-white"
                  >
                    <Printer className="h-3.5 w-3.5 inline mr-1" /> Print
                  </button>
                  <button
                    onClick={() => {
                      const fname = formatIdentifiableFilename({
                        docType: `Receipt-${activeReceiptPayment.payment.component.replace(/[^a-zA-Z0-9]+/g, '_')}`,
                        studentName: activeReceiptPayment.bill.studentName,
                        studentId: activeReceiptPayment.bill.studentId,
                        receiptNo: activeReceiptPayment.payment.receiptNo,
                        term: selectedTerm,
                        academicYear: selectedAcademicYear,
                        extension: 'pdf'
                      });
                      handleExportFeesPDF('fee-receipt-print-area', fname);
                    }}
                    className="px-3.5 py-2 bg-[#059669] hover:bg-[#047857] text-white font-semibold rounded-xl text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5"
                  >
                    <FileDown className="h-3.5 w-3.5" /> Download PDF Receipt
                  </button>
                  <button 
                    onClick={() => setActiveReceiptPayment(null)}
                    className="p-1 px-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition cursor-pointer ml-1 animate-none bg-transparent"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Inline parent/guardian email dispatch controls */}
              <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 no-print">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[#059669]" />
                  <span className="font-medium">Send to Parent:</span>
                  <input 
                    type="email" 
                    value={receiptEmailOverride}
                    onChange={(e) => setReceiptEmailOverride(e.target.value)}
                    placeholder="parent@email.com"
                    className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none w-48 font-medium text-slate-800"
                  />
                </div>
                <button
                  onClick={handleSendReceiptEmail}
                  disabled={isSendingEmail}
                  className="px-3 py-1.5 bg-[#059669] hover:bg-[#047857] text-white font-semibold rounded-xl text-xs transition cursor-pointer flex items-center gap-1 shadow-xs disabled:opacity-50"
                >
                  {isSendingEmail ? (
                    <>Sending...</>
                  ) : (
                    <>
                      <Mail className="h-3.5 w-3.5" /> Dispatch Receipt
                    </>
                  )}
                </button>
              </div>

            <div className="flex-1 overflow-y-auto p-4" id="fee-receipt-print-area">
              <div className="relative border-[2px] border-double border-slate-800 p-4 space-y-3 bg-white text-slate-900 text-left h-full flex flex-col justify-between overflow-hidden">
                {/* Watermark */}
                <div className="absolute inset-0 pointer-events-none" dangerouslySetInnerHTML={{ __html: getWatermarkHtml(schoolInfo.crestUrl) }} />
                
                <div className="relative z-10 flex flex-col h-full justify-between">
                {/* Official Crest & School metadata - Compact for DL */}
                <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                  <div className="space-y-0.5">
                    <h1 className="text-sm font-bold tracking-tight text-slate-950 uppercase leading-tight">{schoolInfo.name}</h1>
                    <p className="text-[9px] font-semibold text-slate-500 tracking-wider">Motto: "{schoolInfo.motto}"</p>
                    <p className="text-[9px] text-slate-700 leading-tight">{schoolInfo.gpsAddress} • Tel: {schoolInfo.telephone}</p>
                  </div>
                  {schoolInfo.logoUrl ? (
                    <img referrerPolicy="no-referrer" src={schoolInfo.logoUrl} className="h-10 w-10 object-contain" alt="School Crest" />
                  ) : (
                    <div className="p-1 border border-slate-200 rounded bg-slate-50 text-slate-400">
                      <Receipt className="h-6 w-6" />
                    </div>
                  )}
                </div>

                {/* Receipt Title - Slimmer */}
                <div className="text-center py-1 bg-slate-50 border-b border-slate-200">
                  <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-950">OFFICIAL BILL COMPONENT PAYMENT RECEIPT</h2>
                </div>

                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-[10px] font-sans">
                  <div className="space-y-1">
                    <p><span className="text-slate-500">CODE:</span> <span className="font-mono font-bold">{activeReceiptPayment.payment.receiptNo}</span></p>
                    <p><span className="text-slate-500">STUDENT:</span> <span className="font-bold uppercase">{activeReceiptPayment.bill.studentName}</span></p>
                    <p><span className="text-slate-500">ID:</span> <span className="font-semibold font-mono">{activeReceiptPayment.bill.studentId}</span></p>
                  </div>

                  <div className="space-y-1 text-right">
                    <p><span className="text-slate-500">DATE:</span> <span className="font-semibold font-mono">{activeReceiptPayment.payment.date}</span></p>
                    <p><span className="text-slate-500">TERM:</span> <span className="font-semibold">{activeReceiptPayment.bill.academicYear} • {activeReceiptPayment.bill.term}</span></p>
                    <p><span className="text-slate-500">METHOD:</span> <span className="font-bold">{activeReceiptPayment.payment.method}</span></p>
                  </div>
                </div>

                {/* Main receipt ledger breakdown - Ultra compact */}
                <div className="border border-slate-800 rounded overflow-hidden">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-800 text-[9px]">
                        <th className="p-1.5 text-left pl-3">Component Description</th>
                        <th className="p-1.5 text-center">Status</th>
                        <th className="p-1.5 text-right pr-3">Payment Amount (GHS)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-2 pl-3">
                          <p className="font-bold text-slate-900 uppercase">{activeReceiptPayment.payment.component}</p>
                          <p className="text-[8.5px] text-slate-500 font-normal">Allocated Bill Item Payment</p>
                        </td>
                        <td className="p-2 text-center">
                          {(() => {
                            const exp = getComponentExpectedAmount(activeReceiptPayment.bill, activeReceiptPayment.payment.component);
                            const paid = getComponentPaidAmount(activeReceiptPayment.bill, activeReceiptPayment.payment.component);
                            const isFullySettled = exp > 0 && paid >= exp;
                            return (
                              <span className={`px-2 py-0.5 rounded text-[8.5px] font-bold uppercase ${
                                isFullySettled ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {isFullySettled ? 'Fully Settled' : 'Partially Paid'}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="p-2 text-right pr-3 font-mono font-bold text-slate-900 bg-slate-50">
                          {activeReceiptPayment.payment.amount.toFixed(2)}
                        </td>
                      </tr>
                      {activeReceiptPayment.payment.remarks && (
                        <tr>
                          <td colSpan={3} className="p-1.5 pl-3 bg-slate-50/50 italic text-[9px] text-slate-500 border-t border-slate-200">
                            Note: {activeReceiptPayment.payment.remarks}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Totals & Component Settlement Breakdown */}
                {(() => {
                  const bill = activeReceiptPayment.bill;
                  const compName = activeReceiptPayment.payment.component;
                  const compExpected = getComponentExpectedAmount(bill, compName);
                  const compPaid = getComponentPaidAmount(bill, compName);
                  const compBalance = Math.max(0, compExpected - compPaid);

                  const expectedTotal = calculateBillExpected(bill);
                  const totalPaid = (bill.payments || []).reduce((sum, p) => sum + (Number(p?.amount) || 0), 0);
                  const outstanding = expectedTotal - totalPaid;

                  return (
                    <div className="grid grid-cols-2 gap-4 text-[9.5px] border-t border-slate-300 pt-2 font-sans">
                      <div className="space-y-1 border-r border-slate-200 pr-3">
                        <p className="font-bold uppercase text-[9px] text-slate-700 tracking-wider">
                          {compName} Settlement
                        </p>
                        <div className="space-y-0.5 text-[9px]">
                          <p className="flex justify-between"><span className="text-slate-500">Expected Levy:</span> <span className="font-mono font-semibold">GHS {compExpected.toFixed(2)}</span></p>
                          <p className="flex justify-between"><span className="text-slate-500">Total Paid To-Date:</span> <span className="font-mono font-semibold text-emerald-700">GHS {compPaid.toFixed(2)}</span></p>
                          <p className="flex justify-between font-bold border-t border-slate-200 pt-0.5"><span className="text-slate-700">Component Balance:</span> <span className="font-mono text-rose-700">GHS {compBalance.toFixed(2)}</span></p>
                        </div>
                      </div>

                      <div className="space-y-1 pl-1">
                        <p className="font-bold uppercase text-[9px] text-slate-700 tracking-wider">
                          Overall Student Ledger
                        </p>
                        <div className="space-y-0.5 text-[9px]">
                          <p className="flex justify-between"><span className="text-slate-500">Total Term Bill:</span> <span className="font-mono">GHS {expectedTotal.toFixed(2)}</span></p>
                          <p className="flex justify-between"><span className="text-slate-500">Cumulative Paid:</span> <span className="font-mono font-bold text-emerald-700">GHS {totalPaid.toFixed(2)}</span></p>
                          <p className="flex justify-between font-bold text-slate-950 border-t border-slate-200 pt-0.5"><span className="font-bold">Total Arrears:</span> <span className="font-mono text-rose-700">GHS {outstanding.toFixed(2)}</span></p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Verification QR & Signatures */}
                <div className="flex justify-between items-center text-[10px] border-t border-slate-300 pt-2">
                  <div className="flex items-center gap-2">
                    <div className="p-0.5 bg-white border border-slate-200 rounded-md shrink-0">
                      <QRCodeSVG 
                        value={`${window.location.origin}/?tab=fees&studentId=${activeReceiptPayment.bill.studentId}&receiptNo=${activeReceiptPayment.payment.receiptNo}&comp=${encodeURIComponent(activeReceiptPayment.payment.component)}`}
                        size={38} 
                        level="M" 
                      />
                    </div>
                    <div className="text-left space-y-0.5">
                      <p className="text-slate-400 text-[8px] uppercase font-bold tracking-tighter">Verified Component Receipt</p>
                      <p className="text-[8px] text-slate-500 leading-tight">Electronic ledger statement credential</p>
                    </div>
                  </div>
                  <div className="flex gap-6 text-center text-[8.5px]">
                    <div className="border-t border-dashed border-slate-400 pt-1 min-w-[90px]">
                      <p className="font-medium text-slate-700 uppercase tracking-tighter">Accounts Officer</p>
                    </div>
                    <div className="border-t border-dashed border-slate-400 pt-1 min-w-[90px]">
                      <p className="font-medium text-slate-700 uppercase tracking-tighter">Bursar / Cashier</p>
                    </div>
                  </div>
                </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

      {/* DYNAMIC GENERAL PRINT AREA (HIDDEN) FOR FULL STUDENT LEDGER */}
      <AnimatePresence>
        {activeLedgerStudent && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) setActiveLedgerStudent(null);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto cursor-pointer no-print"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ ease: "easeOut", duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white max-w-2xl w-full rounded-[24px] shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] cursor-default md:my-8"
            >
              
              <div className="p-4 sm:p-6 pb-4 bg-white border-b border-slate-100/85 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                <div>
                  <h3 className="text-[13px] font-bold text-slate-800 uppercase tracking-widest font-sans leading-none">
                    GTIMS LEDGER REPORT
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1">Review student fee liabilities and payment streams</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handlePrintStandard('fee-ledger-print-area', `Student Fee Ledger - ${activeLedgerStudent.studentName}`)}
                    className="flex-1 sm:flex-none px-3 py-2 hover:bg-slate-50 border border-slate-200 text-slate-500 font-semibold rounded-xl text-[10px] sm:text-xs transition cursor-pointer bg-white"
                  >
                    <Printer className="h-3.5 w-3.5 inline mr-1" /> Print
                  </button>
                  <button
                    onClick={() => handleExportLedgerCSV(activeLedgerStudent)}
                    className="flex-1 sm:flex-none px-3 py-2 hover:bg-slate-50 border border-slate-200 text-slate-600 font-semibold rounded-xl text-[10px] sm:text-xs transition cursor-pointer bg-white"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 inline mr-1 text-[#059669]" /> CSV
                  </button>
                  <button
                    onClick={() => {
                      const fname = formatIdentifiableFilename({
                        docType: 'Fee Ledger',
                        studentName: activeLedgerStudent.studentName,
                        studentId: activeLedgerStudent.studentId,
                        term: selectedTerm,
                        academicYear: selectedAcademicYear,
                        extension: 'pdf'
                      });
                      handleExportFeesPDF('fee-ledger-print-area', fname);
                    }}
                    className="flex-1 sm:flex-none px-3 py-2 bg-[#059669] hover:bg-[#047857] text-white font-semibold rounded-xl text-[10px] sm:text-xs shadow-xs transition cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5 inline mr-1" /> PDF
                  </button>
                  <button 
                    onClick={() => setActiveLedgerStudent(null)}
                    className="p-1 px-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition cursor-pointer bg-transparent animate-none hidden sm:block"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

            <div className="flex-1 overflow-y-auto p-4" id="fee-ledger-print-area">
              <div className="border-[2px] border-double border-slate-800 p-4 space-y-3 bg-white text-slate-900 text-left h-full flex flex-col justify-between">
                
                {/* Official Crest & School metadata - Compact for DL */}
                <div className="flex justify-between items-center pb-2 border-b border-slate-800 shrink-0">
                  <div className="space-y-0.5">
                    <h1 className="text-sm font-bold tracking-tight text-slate-950 uppercase leading-tight">{schoolInfo.name}</h1>
                    <p className="text-[9px] font-semibold text-slate-500 tracking-wider leading-none">Motto: "{schoolInfo.motto}"</p>
                    <p className="text-[9px] text-slate-700 leading-tight">{schoolInfo.gpsAddress} • Tel: {schoolInfo.telephone}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-50 px-2.5 py-0.5 rounded border border-slate-200">
                      BILLING & LEDGER
                    </span>
                    <p className="text-[9px] text-slate-500 font-mono mt-0.5">Academic: {activeLedgerStudent.academicYear} • {activeLedgerStudent.term}</p>
                  </div>
                </div>

                {/* DL Columns content layout */}
                <div className="grid grid-cols-2 gap-4 text-[10px] font-sans flex-1">
                  
                  {/* Left Column: Student details & Expected bills table */}
                  <div className="space-y-2 border-r border-slate-200 pr-3 flex flex-col justify-between">
                    <div className="bg-slate-50 p-1.5 rounded space-y-0.5 border border-slate-100">
                      <p><span className="text-slate-500 font-medium uppercase text-[8px] tracking-tight">Student Name:</span> <span className="font-bold text-slate-950 uppercase">{activeLedgerStudent.studentName}</span></p>
                      <p><span className="text-slate-500 font-medium uppercase text-[8px] tracking-tight">ID:</span> <span className="font-semibold font-mono">{activeLedgerStudent.studentId}</span> | <span className="text-slate-500 font-medium uppercase text-[8px] tracking-tight">Class:</span> <span className="font-semibold">{activeLedgerStudent.class}</span></p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">I. Summary of Expected Bills</p>
                      <table className="w-full text-[9px] border border-slate-300">
                        <tbody>
                          <tr className="border-b border-slate-200">
                            <td className="p-1 pl-1.5 text-slate-600">Tuition Fees</td>
                            <td className="p-1 text-right pr-1.5 font-mono">GHS {activeLedgerStudent.schoolFees.toFixed(2)}</td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="p-1 pl-1.5 text-slate-600">Utility Bill</td>
                            <td className="p-1 text-right pr-1.5 font-mono">GHS {activeLedgerStudent.utilityBill.toFixed(2)}</td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="p-1 pl-1.5 text-slate-600">Sports & PTA</td>
                            <td className="p-1 text-right pr-1.5 font-mono">GHS {(activeLedgerStudent.sportsFees + activeLedgerStudent.ptaDues).toFixed(2)}</td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="p-1 pl-1.5 text-slate-600">Transportation</td>
                            <td className="p-1 text-right pr-1.5 font-mono">GHS {(activeLedgerStudent.transportationBill || 0).toFixed(2)}</td>
                          </tr>
                          {activeLedgerStudent.otherFee > 0 && (
                            <tr className="border-b border-slate-200">
                              <td className="p-1 pl-1.5 text-slate-600">Other Levy</td>
                              <td className="p-1 text-right pr-1.5 font-mono">GHS {activeLedgerStudent.otherFee.toFixed(2)}</td>
                            </tr>
                          )}
                          {(activeLedgerStudent.customComponents || []).filter(c => (Number(c.amount) || 0) > 0).map(c => (
                            <tr key={c.componentId} className="border-b border-slate-200">
                              <td className="p-1 pl-1.5 text-slate-600 truncate max-w-[120px]" title={c.componentName}>{c.componentName}</td>
                              <td className="p-1 text-right pr-1.5 font-mono">GHS {Number(c.amount).toFixed(2)}</td>
                            </tr>
                          ))}
                          <tr className="bg-slate-100 font-bold">
                            <td className="p-1 pl-1.5 text-slate-900">Total Term Bill</td>
                            <td className="p-1 text-right pr-1.5 font-mono text-slate-900">
                              GHS {calculateBillExpected(activeLedgerStudent).toFixed(2)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right Column: Payments table & Outstanding balances */}
                  <div className="space-y-2 flex flex-col justify-between">
                    <div className="space-y-1">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">II. Credited Installments History</p>
                      <div className="border border-slate-300 rounded max-h-[85px] overflow-hidden">
                        <table className="w-full text-[9px]">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-300 text-slate-500 text-[8px] uppercase">
                              <th className="p-1 text-left pl-1.5">Date</th>
                              <th className="p-1 text-left">Receipt No</th>
                              <th className="p-1 text-right pr-1.5">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {activeLedgerStudent.payments.length === 0 ? (
                              <tr>
                                <td colSpan={3} className="p-2 text-center text-slate-400 italic text-[8px]">No payments credited yet.</td>
                              </tr>
                            ) : (
                              activeLedgerStudent.payments.slice(0, 3).map((p) => (
                                <tr key={p.id}>
                                  <td className="p-1 font-mono pl-1.5">{p.date}</td>
                                  <td className="p-1 font-mono font-semibold">{p.receiptNo}</td>
                                  <td className="p-1 text-right pr-1.5 font-mono text-emerald-700 font-bold">GHS {p.amount.toFixed(2)}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                      {activeLedgerStudent.payments.length > 3 && (
                        <p className="text-[7px] text-right text-slate-400 italic pr-1 leading-none">Showing latest 3 transactions</p>
                      )}
                    </div>

                    {/* Overall Statements Summary balances */}
                    <div className="bg-slate-50 p-1.5 rounded space-y-0.5 border border-slate-100">
                      {(() => {
                        const expectedTotal = calculateBillExpected(activeLedgerStudent);
                        const totalPaid = activeLedgerStudent.payments.reduce((sum, p) => sum + p.amount, 0);
                        const outstanding = expectedTotal - totalPaid;

                        return (
                          <div className="space-y-0.5 font-sans text-[10px]">
                            <div className="flex justify-between"><span className="text-slate-500 font-medium">Expected Total:</span> <span className="font-mono">GHS {expectedTotal.toFixed(2)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 font-medium">Total Paid To-Date:</span> <span className="font-mono text-emerald-700 font-bold">GHS {totalPaid.toFixed(2)}</span></div>
                            <div className="flex justify-between border-t border-slate-300 pt-0.5 font-bold text-slate-950 text-[11px]"><span className="font-bold">Outstanding Balance:</span> <span className="font-mono">GHS {outstanding.toFixed(2)}</span></div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                </div>

                {/* Signatures Footer - Side by side compact */}
                <div className="grid grid-cols-2 gap-4 text-center text-[8px] border-t border-slate-200 pt-1.5 shrink-0">
                  <div className="border-t border-dashed border-slate-400 pt-0.5">
                    <p className="font-bold text-slate-700 uppercase tracking-tighter">Bursar / Accounts Office</p>
                  </div>
                  <div className="border-t border-dashed border-slate-400 pt-0.5">
                    <p className="font-bold text-slate-700 uppercase tracking-tighter">Official Verification & Stamp</p>
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* PAYMENT REMINDER NOTICE MODAL OVERLAY */}
    <AnimatePresence>
      {showReminderModal && activeStudent && activeBill && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs no-print flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowReminderModal(false)}
            className="fixed inset-0 cursor-pointer"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative w-full max-w-5xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col lg:flex-row h-[90vh] lg:h-[80vh] z-10 text-left font-sans"
          >
            {/* LEFT COLUMN: CONTROLS & PARAMS */}
            <div className="w-full lg:w-2/5 p-6 border-b lg:border-b-0 lg:border-r border-slate-200 overflow-y-auto flex flex-col justify-between bg-slate-50 gap-6">
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-xl flex items-center justify-center">
                    <Bell size={20} className="text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Reminder notice engine</h3>
                    <p className="text-[10px] text-slate-400">Generate professional debt reminders and dispatch automated SMS advisories.</p>
                  </div>
                </div>

                <hr className="border-slate-200" />

                {/* RECEP DETAILS & PHONE */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Recipient Contact Information</h4>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Guardian Name</label>
                      <input 
                        type="text"
                        value={activeStudent.guardianName || 'Guardian'}
                        disabled
                        className="w-full text-xs px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-semibold cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1 flex justify-between">
                        <span>Guardian Telephone</span>
                        {!reminderRecipientPhone && <span className="text-rose-500 lowercase font-bold animate-pulse">Required *</span>}
                      </label>
                      <input 
                        type="tel"
                        value={reminderRecipientPhone}
                        onChange={(e) => {
                          setReminderRecipientPhone(e.target.value);
                          setReminderSmsSuccess(null);
                        }}
                        placeholder="e.g. +233240000000"
                        className={`w-full text-xs px-3 py-2 border rounded-lg font-bold font-mono text-slate-800 focus:outline-none focus:ring-1 ${!reminderRecipientPhone ? 'border-rose-300 bg-rose-50/50 focus:ring-rose-500' : 'border-slate-200 focus:ring-amber-500'}`}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Response / Payment Due Deadline</label>
                      <input 
                        type="date"
                        value={reminderClosingDate}
                        onChange={(e) => {
                          setReminderClosingDate(e.target.value);
                          setReminderSmsSuccess(null);
                        }}
                        className="w-full text-xs px-3 py-2 border border-slate-200 bg-white rounded-lg font-mono text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>

                {/* EDIT MESSAGE PREVIEW */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Custom Carrier SMS Template Message</label>
                    <span className="text-[9px] font-mono text-slate-400 bg-slate-250 px-1 py-0.5 rounded font-black">
                      Chars: {reminderCustomMessage.length}
                    </span>
                  </div>
                  <SmartTextarea
                    rows={4}
                    value={reminderCustomMessage}
                    onChange={(e: any) => {
                      setReminderCustomMessage(e.target.value);
                      setReminderSmsSuccess(null);
                    }}
                    className="w-full text-xs p-3 border border-slate-200 rounded-xl bg-white font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-700 leading-relaxed resize-none"
                  />
                  
                  {/* Safe Live Preview (Fictional Example) to avoid Data breach / PII leaks on screen */}
                  <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-1">
                    <span className="text-[9.5px] font-black uppercase text-indigo-750 font-sans tracking-wide block">🛡 GDPR Shield: Safe Fictional Preview</span>
                    <p className="text-[10.5px] text-slate-650 font-medium leading-relaxed font-sans italic select-none">
                      "{compileRandomReminderMessage(reminderCustomMessage)}"
                    </p>
                  </div>

                  <p className="text-[9px] text-slate-400 italic leading-snug">The SMS template contains curly bracket variables like <code className="bg-slate-200 text-slate-700 px-0.5 rounded font-bold font-mono text-[8px]">{'{guardianName}'}</code> and <code className="bg-slate-200 text-slate-700 px-0.5 rounded font-bold font-mono text-[8px]">{'{reportLink}'}</code> which are compiled securely on transmission.</p>
                </div>

                {reminderSmsSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-[11px] font-medium leading-relaxed flex gap-2">
                    <Check className="text-emerald-600 flex-shrink-0 mt-0.5" size={14} />
                    <span>{reminderSmsSuccess}</span>
                  </div>
                )}
              </div>

              {/* ACTION FOOTER BUTTONS */}
              <div className="space-y-2 pt-4 border-t border-slate-200">
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={reminderSendingSms || !reminderRecipientPhone}
                    onClick={handleSendReminderSMS}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold shadow-md transition transform active:translate-y-0.5 select-none ${!reminderRecipientPhone ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-600 text-white'}`}
                  >
                    {reminderSendingSms ? (
                      <>
                        <RotateCcw size={12} className="animate-spin" /> Sending SMS...
                      </>
                    ) : (
                      <>
                        <Send size={12} /> Dispatch SMS
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={!reminderRecipientPhone}
                    onClick={handleSendReminderWhatsApp}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold shadow-md transition transform active:translate-y-0.5 select-none ${!reminderRecipientPhone ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                  >
                    <MessageSquare size={12} /> WhatsApp Link
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportFeesPDF('fees-reminder-notice-canvas', `Payment_Reminder_${activeStudent.firstName}_${activeStudent.lastName}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 hover:bg-slate-200 border border-slate-200 text-slate-700 font-semibold bg-white rounded-lg text-xs transition"
                  >
                    <FileDown size={12} /> Save PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handlePrintStandard('fees-reminder-notice-canvas', `Fee Payment Reminder - ${activeStudent.firstName} ${activeStudent.lastName}`);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg text-xs transition"
                  >
                    <Printer size={12} /> Direct Print
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReminderModal(false)}
                  className="w-full text-center py-2 text-slate-400 hover:text-slate-600 text-xs font-semibold"
                >
                  Close Dialogue Panel
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN: DOCUMENT PREVIEW */}
            <div className="flex-1 bg-slate-100 p-6 overflow-y-auto flex items-center justify-center">
              {/* PORTRAIT LETTER CONTAINER */}
              <div 
                id="fees-reminder-notice-canvas"
                className="w-full max-w-[620px] min-h-[780px] bg-white border border-slate-300 shadow-lg p-8 relative flex flex-col justify-between text-slate-905 leading-normal"
                style={{ aspectRatio: '1/1.414' }}
              >
                <div>
                  {/* SCHOOL LETTERHEAD */}
                  <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                      {schoolInfo.logoUrl ? (
                        <img 
                          src={schoolInfo.logoUrl} 
                          alt="School Logo" 
                          referrerPolicy="no-referrer"
                          className="w-14 h-14 object-contain rounded-xl"
                        />
                      ) : (
                        <div className="w-14 h-14 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold text-xl uppercase">
                          {schoolInfo.name?.substring(0, 2) || 'SC'}
                        </div>
                      )}
                      <div>
                        <h1 className="text-sm font-black uppercase text-slate-900 tracking-tight">{schoolInfo.name || 'GeeTech Academy'}</h1>
                        <p className="text-[10px] italic font-medium text-slate-500">{schoolInfo.motto || 'Motto: Excellence and Dignity'}</p>
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">{schoolInfo.gpsAddress || 'Digital Address System'} • GPS</p>
                      </div>
                    </div>
                    <div className="text-right text-[8.5px] font-mono text-slate-500 space-y-0.5">
                      <p>TEL: {schoolInfo.telephone || '+233 24 556 7780'}</p>
                      <p>EMAIL: {schoolInfo.email || 'info@school.edu.gh'}</p>
                      <p>DATE: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                  </div>

                  {/* DOCUMENT TITLE */}
                  <div className="text-center my-6 space-y-1">
                    <h2 className="text-xs font-black uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-100 py-1 px-4 rounded-lg inline-block">
                      OFFICIAL FEES CLEARANCE & ARREARS ADVISORY
                    </h2>
                    <p className="text-[9px] text-slate-400 font-mono">Reference No: {activeStudent.id}_REM_T{selectedTerm?.replace(/\D/g, '')}</p>
                  </div>

                  {/* SALUTATION */}
                  <div className="text-[11px] space-y-3 font-sans text-left">
                    <p>To the Parent / Guardian of <span className="font-bold underline capitalize">{activeStudent.firstName} {activeStudent.middleName ? activeStudent.middleName + ' ' : ''}{activeStudent.lastName}</span>,</p>
                    <p className="text-slate-700 leading-relaxed text-justify">
                      We hope this letter finds you well. The school administration is writing to formally notify you of outstanding tuition dues in our accounts. Our current ledger records state that the financial obligations for the student listed below are currently in arrears for <strong>{selectedTerm} ({selectedAcademicYear})</strong>.
                    </p>
                  </div>

                  {/* STUDENT DETAIL & ARREARS TABLE */}
                  <div className="my-6 space-y-3 text-left">
                    <div className="grid grid-cols-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[10px]">
                      <div>
                        <span className="text-slate-400 uppercase font-bold tracking-wider block text-[8px]">Pupil Full Name</span>
                        <span className="font-bold text-slate-900 capitalize">{activeStudent.firstName} {activeStudent.lastName}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 uppercase font-bold tracking-wider block text-[8px]">Student Register ID / Class</span>
                        <span className="font-bold font-mono text-slate-900">{activeStudent.id} • Class {activeStudent.class}</span>
                      </div>
                    </div>

                    <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest pl-1">Arrears Category Ledger Summary</p>
                    <div className="border border-slate-300 rounded-lg overflow-hidden">
                      <table className="w-full text-left border-collapse text-[10px]">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                            <th className="p-2">Levy Component Description</th>
                            <th className="p-2 text-right">Debit Billed</th>
                            <th className="p-2 text-right">Credit Settled</th>
                            <th className="p-2 text-right">Outstanding Arrears</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {/* schoolFees row */}
                          {activeBill.schoolFees > 0 && (
                            <tr>
                              <td className="p-2">Standard School Tuition Fees</td>
                              <td className="p-2 text-right font-mono text-slate-500">GHS {activeBill.schoolFees.toFixed(2)}</td>
                              <td className="p-2 text-right font-mono text-slate-500">-</td>
                              <td className="p-2 text-right font-mono font-semibold text-rose-600">GHS {activeBill.schoolFees.toFixed(2)}</td>
                            </tr>
                          )}
                          {/* utilityBill row */}
                          {activeBill.utilityBill > 0 && (
                            <tr>
                              <td className="p-2">Facility & Utility Maintenance Levy</td>
                              <td className="p-2 text-right font-mono text-slate-500">GHS {activeBill.utilityBill.toFixed(2)}</td>
                              <td className="p-2 text-right font-mono text-slate-500">-</td>
                              <td className="p-2 text-right font-mono font-semibold text-rose-600">GHS {activeBill.utilityBill.toFixed(2)}</td>
                            </tr>
                          )}
                          {/* sportsFees row */}
                          {activeBill.sportsFees > 0 && (
                            <tr>
                              <td className="p-2">Sports development dues allocation</td>
                              <td className="p-2 text-right font-mono text-slate-500">GHS {activeBill.sportsFees.toFixed(2)}</td>
                              <td className="p-2 text-right font-mono text-slate-500">-</td>
                              <td className="p-2 text-right font-mono font-semibold text-rose-600">GHS {activeBill.sportsFees.toFixed(2)}</td>
                            </tr>
                          )}
                          {/* ptaDues row */}
                          {activeBill.ptaDues > 0 && (
                            <tr>
                              <td className="p-2">PTA annual dues allocation</td>
                              <td className="p-2 text-right font-mono text-slate-500">GHS {activeBill.ptaDues.toFixed(2)}</td>
                              <td className="p-2 text-right font-mono text-slate-500">-</td>
                              <td className="p-2 text-right font-mono font-semibold text-rose-600">GHS {activeBill.ptaDues.toFixed(2)}</td>
                            </tr>
                          )}
                          {/* transportationBill row */}
                          {activeBill.transportationBill > 0 && (
                            <tr>
                              <td className="p-2">Transportation Bill allocation</td>
                              <td className="p-2 text-right font-mono text-slate-500">GHS {activeBill.transportationBill.toFixed(2)}</td>
                              <td className="p-2 text-right font-mono text-slate-500">-</td>
                              <td className="p-2 text-right font-mono font-semibold text-rose-600">GHS {activeBill.transportationBill.toFixed(2)}</td>
                            </tr>
                          )}
                          {/* otherFee row */}
                          {activeBill.otherFee > 0 && (
                            <tr>
                              <td className="p-2">Miscellaneous category ({activeBill.otherFeeDescription || 'Other'})</td>
                              <td className="p-2 text-right font-mono text-slate-500">GHS {activeBill.otherFee.toFixed(2)}</td>
                              <td className="p-2 text-right font-mono text-slate-500">-</td>
                              <td className="p-2 text-right font-mono font-semibold text-rose-600">GHS {activeBill.otherFee.toFixed(2)}</td>
                            </tr>
                          )}
                          {/* Granular Custom Bill Components */}
                          {(activeBill.customComponents || []).filter(c => (Number(c.amount) || 0) > 0).map(c => (
                            <tr key={c.componentId}>
                              <td className="p-2 font-medium text-slate-800">{c.componentName} {c.category ? `(${c.category})` : ''}</td>
                              <td className="p-2 text-right font-mono text-slate-500">GHS {Number(c.amount).toFixed(2)}</td>
                              <td className="p-2 text-right font-mono text-slate-500">-</td>
                              <td className="p-2 text-right font-mono font-semibold text-rose-600">GHS {Number(c.amount).toFixed(2)}</td>
                            </tr>
                          ))}
                          {/* installments paid subtract row */}
                          {activeExpectedAndPaid.paid > 0 && (
                            <tr className="bg-emerald-50/50">
                              <td className="p-2 font-semibold text-emerald-700">Less: Credited installments registered</td>
                              <td className="p-2 text-right font-mono text-slate-400">-</td>
                              <td className="p-2 text-right font-mono text-emerald-700">GHS {activeExpectedAndPaid.paid.toFixed(2)}</td>
                              <td className="p-2 text-right font-mono text-emerald-500">- GHS {activeExpectedAndPaid.paid.toFixed(2)}</td>
                            </tr>
                          )}
                          {/* Combined net balance totals */}
                          <tr className="bg-slate-100 font-bold border-t border-slate-300 text-[11px]">
                            <td className="p-2">Total Net Financial Dues Pending:</td>
                            <td className="p-2 text-right font-mono text-slate-700">GHS {activeExpectedAndPaid.expected.toFixed(2)}</td>
                            <td className="p-2 text-right font-mono text-emerald-700">GHS {activeExpectedAndPaid.paid.toFixed(2)}</td>
                            <td className="p-2 text-right font-mono text-rose-700 bg-rose-50/50">GHS {activeExpectedAndPaid.bal.toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* COMPLIANCE WARNING TEXT */}
                  <div className="text-[10.5px] leading-relaxed text-slate-700 space-y-2 border-l-2 border-amber-500 pl-4 bg-amber-50/20 py-2 pr-2 rounded-r-lg text-left">
                    <p className="font-bold text-slate-800">Ledger Compliance Instructions:</p>
                    <p>
                      We kindly query you to clear the outstanding sum of <strong>GHS {activeExpectedAndPaid.bal.toFixed(2)}</strong> on or before <strong>{new Date(reminderClosingDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong> to ensure uninterrupted class participation and terminal educational activity records processing.
                    </p>
                    <p>
                      All pay-slips and mobile money receipts MUST be verified manually at the main treasury office for ledger credit update.
                    </p>
                  </div>
                </div>

                {/* SIGNATURE AREA IN PORTRAIT CANVAS FOOTER */}
                <div className="mt-8 border-t border-slate-200 pt-6 flex justify-between items-end text-left">
                  <div className="space-y-1 text-slate-500 text-[8px] font-mono leading-relaxed">
                    <p>Produced by: Ledger Administration Center</p>
                    <p>Signee: {schoolInfo.headteacherName || 'Head Teacher Principal'}</p>
                    <p>Certified Official Copy • Digital Signature Verification</p>
                  </div>
                  
                  <div className="text-center relative">
                    {/* Stamp or signature images */}
                    {schoolInfo.signatureUrl && (
                      <img 
                        src={schoolInfo.signatureUrl} 
                        alt="Signature" 
                        referrerPolicy="no-referrer"
                        className="w-16 h-8 absolute -top-6 left-1/2 -translate-x-1/2 object-contain pointer-events-none opacity-80"
                      />
                    )}
                    {schoolInfo.stampUrl && (
                      <img 
                        src={schoolInfo.stampUrl} 
                        alt="Stamp Seal" 
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 absolute -top-8 -right-4 object-contain pointer-events-none opacity-70"
                      />
                    )}
                    <span className="block italic text-[10px] text-slate-800 font-bold border-t border-slate-400 border-dashed pt-1 min-w-[130px]">
                      {schoolInfo.headteacherName || 'Principal headteacher'}
                    </span>
                    <span className="block text-[8px] uppercase tracking-wider text-slate-400 mt-0.5">Seal & Signature</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* AUTOMATED FEE INVOICE GENERATOR MODAL */}
    <AnimatePresence>
      {showInvoiceModal && activeStudent && activeBill && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs no-print flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowInvoiceModal(false)}
            className="fixed inset-0 cursor-pointer"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative w-full max-w-5xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col lg:flex-row h-[90vh] lg:h-[80vh] z-10 text-left font-sans"
          >
            {/* LEFT COLUMN: CONTROLS & INSTRUCTIONS */}
            <div className="w-full lg:w-2/5 p-6 border-b lg:border-b-0 lg:border-r border-slate-200 overflow-y-auto flex flex-col justify-between bg-slate-50 gap-6">
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 rounded-xl flex items-center justify-center">
                    <Receipt size={20} className="text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Invoice Generator</h3>
                    <p className="text-[10px] text-slate-400">Pulls student particulars & outstanding balances to compile printable parental notices.</p>
                  </div>
                </div>

                <hr className="border-slate-200" />

                {/* EDITABLE PARAMETERS */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Invoice Particulars</h4>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Invoice Number</label>
                      <input 
                        type="text"
                        value={invoiceNo}
                        onChange={(e) => setInvoiceNo(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-bold font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Issue Date</label>
                        <input 
                          type="date"
                          value={invoiceDate}
                          onChange={(e) => setInvoiceDate(e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg font-semibold font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Payment Due Date</label>
                        <input 
                          type="date"
                          value={invoiceDueDate}
                          onChange={(e) => setInvoiceDueDate(e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg font-semibold font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Custom Notes / Payment Terms</label>
                      <SmartTextarea
                        rows={5}
                        value={invoiceNotes}
                        onChange={(e: any) => setInvoiceNotes(e.target.value)}
                        className="w-full text-xs p-3 border border-slate-200 rounded-xl bg-white font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 leading-relaxed resize-none"
                        placeholder="Specify payment details, bank accounts, or MOMO merchant info..."
                      />
                    </div>
                  </div>
                </div>

                {/* NOTE TEMPLATES FOR EASY POPULATION */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Note Templates</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setInvoiceNotes('Please deposit outstanding fees directly into the school account: GeeTech Academy, GCB Bank, Account No. 10111223344, or send via MTN Mobile Money to 0244123456 (Merchant: GeeTech Academy). Please present your deposit slip or transaction ID to the accounts office for official receipting.')}
                      className="text-[10px] font-medium p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 transition text-left leading-snug"
                    >
                      <strong>Default (MOMO & GCB)</strong>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInvoiceNotes('All fees must be fully cleared before the third week of term. Payment can be made in person at the school accounting desk (cash/cheque) or deposited into Ecobank Ghana, Account Name: GeeTech Academy, Account Number: 012233445566. Credit card payments are accepted.')}
                      className="text-[10px] font-medium p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 transition text-left leading-snug"
                    >
                      <strong>Alternative (Ecobank & Desk)</strong>
                    </button>
                  </div>
                </div>
              </div>

              {/* ACTION FOOTER */}
              <div className="space-y-2 pt-4 border-t border-slate-200">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportFeesPDF('fees-invoice-notice-canvas', `Fee_Invoice_${activeStudent.firstName}_${activeStudent.lastName}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-md transition transform active:translate-y-0.5 select-none"
                  >
                    <FileDown size={14} /> Save Invoice PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handlePrintStandard('fees-invoice-notice-canvas', `Student Fee Invoice - ${activeStudent.firstName} ${activeStudent.lastName}`);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl text-xs transition"
                  >
                    <Printer size={14} /> Direct Print
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(false)}
                  className="w-full text-center py-2 text-slate-400 hover:text-slate-600 text-xs font-semibold"
                >
                  Close Invoice Panel
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN: DOCUMENT PREVIEW */}
            <div className="flex-1 bg-slate-100 p-6 overflow-y-auto flex items-center justify-center">
              {/* PORTRAIT LETTER CONTAINER */}
              <div 
                id="fees-invoice-notice-canvas"
                className="w-full max-w-[620px] bg-white border border-slate-300 shadow-lg p-8 relative flex flex-col justify-between text-slate-900 leading-normal"
                style={{ minHeight: '800px', aspectRatio: '1/1.414' }}
              >
                <div>
                  {/* SCHOOL LETTERHEAD */}
                  <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                      {schoolInfo.logoUrl ? (
                        <img 
                          src={schoolInfo.logoUrl} 
                          alt="School Logo" 
                          referrerPolicy="no-referrer"
                          className="w-14 h-14 object-contain rounded-xl"
                        />
                      ) : (
                        <div className="w-14 h-14 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold text-xl uppercase">
                          {schoolInfo.name?.substring(0, 2) || 'SC'}
                        </div>
                      )}
                      <div>
                        <h1 className="text-sm font-black uppercase text-slate-900 tracking-tight">{schoolInfo.name || 'GeeTech Academy'}</h1>
                        <p className="text-[10px] italic font-medium text-slate-500">{schoolInfo.motto || 'Motto: Excellence and Dignity'}</p>
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">{schoolInfo.gpsAddress || 'Digital Address System'} • GPS</p>
                      </div>
                    </div>
                    <div className="text-right text-[8.5px] font-mono text-slate-500 space-y-0.5">
                      <p>TEL: {schoolInfo.telephone || '+233 24 556 7780'}</p>
                      <p>EMAIL: {schoolInfo.email || 'info@school.edu.gh'}</p>
                      <p className="font-bold">INVOICE: #{invoiceNo}</p>
                    </div>
                  </div>

                  {/* INVOICE TITLE & STATUS BLOCK */}
                  <div className="flex justify-between items-center my-6">
                    <div className="text-left">
                      <h2 className="text-sm font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 py-1 px-4 rounded-lg inline-block">
                        STUDENT TERM FEE INVOICE
                      </h2>
                      <p className="text-[9px] text-slate-400 font-mono mt-1">Academic Cycle: {selectedTerm} ({selectedAcademicYear})</p>
                    </div>
                    
                    <div className="text-right">
                      {activeExpectedAndPaid.bal <= 0 ? (
                        <span className="text-[10px] font-bold uppercase py-1 px-3 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded">Fully Settled</span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase py-1 px-3 bg-amber-100 text-amber-800 border border-amber-200 rounded">Payment Pending</span>
                      )}
                    </div>
                  </div>

                  {/* CLIENT & BILL TO BLOCK */}
                  <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs mb-6 text-left">
                    <div className="space-y-1">
                      <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold block">Bill To (Parent/Guardian)</span>
                      <p className="font-black text-slate-800 capitalize">{activeStudent.guardianName || 'Parent/Guardian'}</p>
                      {activeStudent.guardianTelephone && <p className="font-mono text-slate-500 font-semibold">{activeStudent.guardianTelephone}</p>}
                    </div>
                    <div className="space-y-1">
                      <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold block">Student Particulars</span>
                      <p className="font-bold text-slate-800 capitalize">{activeStudent.firstName} {activeStudent.lastName}</p>
                      <p className="font-mono text-slate-500 font-semibold">{activeStudent.id} • Class: {activeStudent.class}</p>
                    </div>
                  </div>

                  {/* INVOICE METADATA DETAILS */}
                  <div className="grid grid-cols-3 gap-2 text-left text-[10px] mb-6 font-medium text-slate-600 border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-[8px] uppercase text-slate-400 block font-bold">Invoice Date</span>
                      <span className="font-mono text-slate-800 font-bold">{new Date(invoiceDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    </div>
                    <div>
                      <span className="text-[8px] uppercase text-slate-400 block font-bold">Due Date</span>
                      <span className="font-mono text-slate-800 font-bold">{new Date(invoiceDueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    </div>
                    <div>
                      <span className="text-[8px] uppercase text-slate-400 block font-bold">Billing Status</span>
                      <span className="font-mono text-slate-800 font-bold capitalize">{activeExpectedAndPaid.bal <= 0 ? 'Clearance Issued' : `Outstanding Arrears`}</span>
                    </div>
                  </div>

                  {/* ITEMIZED BILL TABLE */}
                  <div className="space-y-3 text-left">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">I. Itemized Term Fees breakdown</p>
                    <div className="border border-slate-300 rounded-lg overflow-hidden">
                      <table className="w-full text-left border-collapse text-[10px]">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                            <th className="p-2">Levy Category component description</th>
                            <th className="p-2 text-right">Debit Expected</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {/* schoolFees row */}
                          <tr>
                            <td className="p-2">Standard School Tuition Fees</td>
                            <td className="p-2 text-right font-mono text-slate-800 font-medium">GHS {activeBill.schoolFees.toFixed(2)}</td>
                          </tr>
                          {/* utilityBill row */}
                          <tr>
                            <td className="p-2">Facility & Utility Maintenance Levy</td>
                            <td className="p-2 text-right font-mono text-slate-800 font-medium">GHS {activeBill.utilityBill.toFixed(2)}</td>
                          </tr>
                          {/* sportsFees row */}
                          <tr>
                            <td className="p-2">Sports Development Dues Allocation</td>
                            <td className="p-2 text-right font-mono text-slate-800 font-medium">GHS {activeBill.sportsFees.toFixed(2)}</td>
                          </tr>
                          {/* ptaDues row */}
                          <tr>
                            <td className="p-2">PTA Annual Dues Allocation</td>
                            <td className="p-2 text-right font-mono text-slate-800 font-medium">GHS {activeBill.ptaDues.toFixed(2)}</td>
                          </tr>
                          {/* transportationBill row */}
                          {activeBill.transportationBill > 0 && (
                            <tr>
                              <td className="p-2">Transportation Bill Allocation</td>
                              <td className="p-2 text-right font-mono text-slate-800 font-medium">GHS {activeBill.transportationBill.toFixed(2)}</td>
                            </tr>
                          )}
                          {/* otherFee row */}
                          {activeBill.otherFee > 0 && (
                            <tr>
                              <td className="p-2">Miscellaneous Fee ({activeBill.otherFeeDescription || 'Other'})</td>
                              <td className="p-2 text-right font-mono text-slate-800 font-medium">GHS {activeBill.otherFee.toFixed(2)}</td>
                            </tr>
                          )}
                          {/* Granular Custom Bill Components */}
                          {(activeBill.customComponents || []).filter(c => (Number(c.amount) || 0) > 0).map(c => (
                            <tr key={c.componentId}>
                              <td className="p-2">{c.componentName} {c.category ? `(${c.category})` : ''}</td>
                              <td className="p-2 text-right font-mono text-slate-800 font-medium">GHS {Number(c.amount).toFixed(2)}</td>
                            </tr>
                          ))}
                          
                          {/* Expected total row */}
                          <tr className="bg-slate-50 font-bold border-t border-slate-300">
                            <td className="p-2 font-black text-slate-800">Total Billed expected this Term:</td>
                            <td className="p-2 text-right font-mono font-black text-slate-900">GHS {activeExpectedAndPaid.expected.toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* CREDITS APPLIED BOX (IF ANY) */}
                  {activeExpectedAndPaid.paid > 0 && (
                    <div className="mt-4 space-y-2 text-left">
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">II. Credited installments received to-date</p>
                      <div className="border border-slate-300 rounded-lg overflow-hidden">
                        <table className="w-full text-left border-collapse text-[9px]">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                              <th className="p-1.5">Date</th>
                              <th className="p-1.5">Receipt No</th>
                              <th className="p-1.5">Method</th>
                              <th className="p-1.5 text-right">Amount Paid</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {activeBill.payments.map((p) => (
                              <tr key={p.id}>
                                <td className="p-1.5 font-mono text-slate-600">{p.date}</td>
                                <td className="p-1.5 font-mono text-slate-700 font-semibold">{p.receiptNo}</td>
                                <td className="p-1.5 text-slate-600">{p.method}</td>
                                <td className="p-1.5 text-right font-mono text-emerald-700 font-semibold">GHS {p.amount.toFixed(2)}</td>
                              </tr>
                            ))}
                            <tr className="bg-emerald-50/50 font-bold border-t border-slate-300 text-[10px]">
                              <td colSpan={3} className="p-1.5 text-right text-emerald-800">Total Payments Credited:</td>
                              <td className="p-1.5 text-right font-mono text-emerald-700 font-black">GHS {activeExpectedAndPaid.paid.toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* GRAND OUTSTANDING BOX */}
                  <div className="mt-5 p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center">
                    <div className="text-left">
                      <h3 className="text-xs font-black uppercase text-slate-900 tracking-tight">TOTAL OUTSTANDING DUE</h3>
                      <p className="text-[9px] text-slate-400 font-mono">Kindly settle this amount prior to due date</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-black font-mono ${activeExpectedAndPaid.bal > 0 ? 'text-indigo-600' : 'text-emerald-600'}`}>
                        GHS {activeExpectedAndPaid.bal.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* INVOICE PAYMENT TERMS & NOTES */}
                  <div className="mt-5 text-[9.5px] leading-relaxed text-slate-600 border-l-2 border-indigo-500 pl-4 bg-indigo-50/15 py-2.5 pr-2 rounded-r-lg text-left">
                    <p className="font-bold text-slate-800 uppercase tracking-wider text-[8px] mb-1">Official Payment Instructions:</p>
                    <p className="whitespace-pre-wrap">{invoiceNotes}</p>
                  </div>
                </div>

                {/* SIGNATURE AREA IN PORTRAIT CANVAS FOOTER */}
                <div className="mt-8 border-t border-slate-200 pt-6 flex justify-between items-end text-left">
                  <div className="space-y-1 text-slate-400 text-[8px] font-mono leading-relaxed">
                    <p>Generated via GTIMS automated ledger engine</p>
                    <p>Invoice status: {activeExpectedAndPaid.bal <= 0 ? 'CLOSED' : 'OPEN - ARREARS'}</p>
                    <p>Official Digital Signature Verification Certificate</p>
                  </div>
                  
                  <div className="text-center relative">
                    {/* Stamp or signature images */}
                    {schoolInfo.signatureUrl && (
                      <img 
                        src={schoolInfo.signatureUrl} 
                        alt="Signature" 
                        referrerPolicy="no-referrer"
                        className="w-16 h-8 absolute -top-6 left-1/2 -translate-x-1/2 object-contain pointer-events-none opacity-80"
                      />
                    )}
                    {schoolInfo.stampUrl && (
                      <img 
                        src={schoolInfo.stampUrl} 
                        alt="Stamp Seal" 
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 absolute -top-8 -right-4 object-contain pointer-events-none opacity-70"
                      />
                    )}
                    <span className="block italic text-[10px] text-slate-800 font-bold border-t border-slate-400 border-dashed pt-1 min-w-[130px]">
                      {schoolInfo.headteacherName || 'Principal headteacher'}
                    </span>
                    <span className="block text-[8px] uppercase tracking-wider text-slate-400 mt-0.5">Seal & Signature</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {showDebtorsModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs no-print flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDebtorsModal(false)}
            className="fixed inset-0 cursor-pointer"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative w-full max-w-6xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col h-[90vh] xl:h-[85vh] z-10 text-left font-sans"
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-xl flex items-center justify-center">
                  <AlertTriangle size={20} className="text-amber-600 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Outstanding Fees & Debtors Analyzer</h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Analysis for <strong className="text-indigo-600">{selectedTerm}</strong> of the <strong className="text-indigo-600">{selectedAcademicYear}</strong> Academic Session
                  </p>
                </div>
              </div>

              {/* Threshold parameter controls */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-slate-200 rounded-xl shadow-xs">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">Min Outstanding (GHS):</label>
                  <input 
                    type="number"
                    min="0"
                    placeholder="0"
                    value={debtorMinAmount}
                    onChange={(e) => setDebtorMinAmount(e.target.value)}
                    className="w-20 font-bold font-mono text-xs text-slate-800 bg-transparent border-0 p-0 focus:ring-0 focus:outline-hidden"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 flex-1 sm:flex-none">
                  <button
                    type="button"
                    onClick={handlePrintDebtors}
                    className="flex-1 sm:flex-none px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Printer size={13} /> <span className="sm:hidden lg:inline">Print Report</span><span className="hidden sm:inline lg:hidden">Print</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportDebtorsCSV}
                    className="flex-1 sm:flex-none px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <FileSpreadsheet size={13} /> <span className="sm:hidden lg:inline">Export CSV</span><span className="hidden sm:inline lg:hidden">CSV</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDebtorsModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body (Responsive Layout) */}
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
              {/* Left Column: Class Summation Summary */}
              <div className="w-full lg:w-5/12 p-6 border-b lg:border-b-0 lg:border-r border-slate-200 overflow-y-auto flex flex-col bg-slate-50/50">
                <div className="mb-4">
                  <h4 className="text-xs font-bold uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                    <Coins className="text-amber-500" size={14} /> I. Class Summation Summary
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Click any class row below to filter the detailed register on the right.</p>
                </div>

                <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200 font-bold">
                        <th className="p-3">Class Name</th>
                        <th className="p-3 text-center">Debtors</th>
                        <th className="p-3 text-right">Sum Owed (GHS)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {debtorData.classSummaries.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="p-8 text-center text-slate-400">
                            No student registries meet the outstanding balance criteria.
                          </td>
                        </tr>
                      ) : (
                        debtorData.classSummaries.map((s) => {
                          const isFiltered = debtorSelectedClassFilter === s.class;
                          return (
                            <tr 
                              key={s.class}
                              onClick={() => setDebtorSelectedClassFilter(isFiltered ? 'All' : s.class)}
                              className={`cursor-pointer transition ${
                                isFiltered ? 'bg-indigo-50 hover:bg-indigo-100/80 text-indigo-900 border-l-4 border-indigo-600' : 'hover:bg-slate-50'
                              }`}
                            >
                              <td className="p-3 font-semibold">{s.class}</td>
                              <td className="p-3 text-center">
                                <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-[10px] rounded">
                                  {s.count}
                                </span>
                              </td>
                              <td className="p-3 text-right font-bold font-mono">
                                GHS {s.totalOwed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {debtorData.classSummaries.length > 0 && (
                      <tfoot>
                        <tr className="bg-slate-100/70 border-t-2 border-slate-300 text-xs font-bold text-slate-800">
                          <td className="p-3 font-extrabold uppercase">Overall Summation</td>
                          <td className="p-3 text-center font-extrabold text-indigo-700">
                            {debtorData.overallDebtorCount}
                          </td>
                          <td className="p-3 text-right font-extrabold font-mono text-rose-600">
                            GHS {debtorData.overallTotalOwed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                <div className="mt-4 p-4 bg-amber-50 border border-amber-200/60 rounded-2xl flex items-start gap-2.5">
                  <Info className="text-amber-600 shrink-0 mt-0.5" size={14} />
                  <div className="text-[10px] text-amber-800 leading-relaxed font-medium">
                    💡 <strong>Class Summation Tip:</strong> Select a class above to narrow down the right-hand student register. If "All Classes" is active, you are analyzing the entire school population.
                  </div>
                </div>
              </div>

              {/* Right Column: Detailed list for Entire Class/School */}
              <div className="flex-1 p-6 overflow-y-auto flex flex-col bg-white">
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                      <User className="text-indigo-500" size={14} /> II. Detailed Debtor Registry
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Showing detailed arrears ledger items. Selected Class: <strong className="text-slate-700">{debtorSelectedClassFilter}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Search inside debtors */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Filter list by name..."
                        value={debtorSearchQuery}
                        onChange={(e) => setDebtorSearchQuery(e.target.value)}
                        className="text-[11px] pl-8 pr-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 w-44"
                      />
                    </div>

                    {/* Quick filter class select */}
                    <select
                      value={debtorSelectedClassFilter}
                      onChange={(e) => setDebtorSelectedClassFilter(e.target.value as ClassType | 'All')}
                      className="text-[11px] border border-slate-200 rounded-lg bg-slate-50 focus:outline-hidden py-1.5 px-2 font-medium text-slate-700"
                    >
                      <option value="All">All Classes</option>
                      {CLASSES.map(cls => <option key={cls} value={cls}>{cls}</option>)}
                    </select>

                    {debtorSelectedClassFilter !== 'All' && (
                      <button
                        onClick={() => setDebtorSelectedClassFilter('All')}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded"
                      >
                        Reset Filter
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200 font-bold">
                        <th className="p-3">Student / Particulars</th>
                        <th className="p-3">Class</th>
                        <th className="p-3 text-right">Expected Fees</th>
                        <th className="p-3 text-right">Paid to-date</th>
                        <th className="p-3 text-right">Arrears (Owed)</th>
                        <th className="p-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {filteredDebtors.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400">
                            No detailed debtor records match your search or filter settings.
                          </td>
                        </tr>
                      ) : (
                        filteredDebtors.map((d) => (
                          <tr key={d.student.id} className="hover:bg-slate-50/70 transition">
                            <td className="p-3">
                              <p className="font-bold text-slate-800 capitalize">{d.student.firstName} {d.student.lastName}</p>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">REG ID: {d.student.id}</p>
                            </td>
                            <td className="p-3">
                              <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded">
                                {d.student.class}
                              </span>
                            </td>
                            <td className="p-3 text-right font-mono text-slate-600">
                              GHS {d.expected.toFixed(2)}
                            </td>
                            <td className="p-3 text-right font-mono text-emerald-600">
                              GHS {d.paid.toFixed(2)}
                            </td>
                            <td className="p-3 text-right font-mono text-rose-600 font-bold">
                              GHS {d.owed.toFixed(2)}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveStudentId(d.student.id);
                                  setShowDebtorsModal(false);
                                  showToast(`Selected ${d.student.firstName}'s fees ledger statement!`);
                                }}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg text-[10px] font-bold transition inline-flex items-center gap-1"
                              >
                                View Ledger
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>Filtered Debtors Count: <strong>{filteredDebtors.length} students</strong></span>
                  <span>Total Owed (Filtered): <strong className="text-rose-600 font-bold">GHS {filteredDebtors.reduce((sum, d) => sum + d.owed, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDebtorsModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition"
              >
                Close Analyzer
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* REPORT CENTER MODAL */}
    <AnimatePresence>
      {showReportCenterModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 no-print">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="relative w-full max-w-[1240px] bg-slate-100 rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col lg:flex-row h-[90vh] z-50 text-left font-sans"
          >
            {/* Sidebar Controls (Left Column) */}
            <div className="w-full lg:w-[400px] flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-200 bg-white select-none">
              <div className="p-5 flex-1 flex flex-col overflow-hidden">
                {/* Header Title */}
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
                  <div className="p-2.5 bg-violet-50 text-violet-600 rounded-2xl">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Report & Print Center</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Generate official compliance bills & ledger PDFs</p>
                  </div>
                </div>

                {/* Tab Switcher */}
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-50 border border-slate-200/60 rounded-xl mb-4">
                  <button
                    onClick={() => setReportCenterType('student')}
                    className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
                      reportCenterType === 'student' ? 'bg-white text-violet-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <User size={14} />
                    <span>Each Student</span>
                  </button>
                  <button
                    onClick={() => setReportCenterType('class')}
                    className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
                      reportCenterType === 'class' ? 'bg-white text-violet-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <BookOpen size={14} />
                    <span>Whole Class</span>
                  </button>
                  <button
                    onClick={() => setReportCenterType('school')}
                    className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
                      reportCenterType === 'school' ? 'bg-white text-violet-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Coins size={14} />
                    <span>Entire School</span>
                  </button>
                </div>

                {/* Tab Parameter Inputs */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                  {reportCenterType === 'student' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">1. Search Student Directory</label>
                        <div className="relative mt-1">
                          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Type name or registration ID..."
                            value={reportCenterSearchQuery}
                            onChange={(e) => setReportCenterSearchQuery(e.target.value)}
                            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-hidden focus:ring-1 focus:ring-violet-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">2. Select Student Statement</label>
                        <div className="mt-1.5 border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-50 max-h-[220px] overflow-y-auto">
                          {students.filter(student => {
                            const q = reportCenterSearchQuery.toLowerCase().trim();
                            if (!q) return true;
                            const fullName = `${student.firstName} ${student.middleName || ''} ${student.lastName}`.toLowerCase();
                            return fullName.includes(q) || student.id.toLowerCase().includes(q);
                          }).length === 0 ? (
                            <p className="p-4 text-center text-xs text-slate-400 italic">No matching students found</p>
                          ) : (
                            students.filter(student => {
                              const q = reportCenterSearchQuery.toLowerCase().trim();
                              if (!q) return true;
                              const fullName = `${student.firstName} ${student.middleName || ''} ${student.lastName}`.toLowerCase();
                              return fullName.includes(q) || student.id.toLowerCase().includes(q);
                            }).map(student => (
                              <button
                                key={student.id}
                                onClick={() => setReportCenterSelectedStudentId(student.id)}
                                className={`w-full text-left p-2.5 transition flex items-center justify-between text-xs cursor-pointer ${
                                  reportCenterSelectedStudentId === student.id ? 'bg-violet-50 text-violet-900 font-bold border-l-4 border-violet-600' : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <div>
                                  <p className="capitalize font-semibold">{student.firstName} {student.lastName}</p>
                                  <p className="text-[9px] text-slate-400 font-mono mt-0.5">{student.id} • {student.class}</p>
                                </div>
                                <Check size={14} className={reportCenterSelectedStudentId === student.id ? 'opacity-100 text-violet-600' : 'opacity-0'} />
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {reportCenterType === 'class' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">1. Select Target Class Category</label>
                        <div className="grid grid-cols-2 gap-2 mt-1.5">
                          {CLASSES.map(cls => (
                            <button
                              key={cls}
                              onClick={() => setReportCenterSelectedClass(cls)}
                              className={`py-2 px-3 border rounded-xl text-xs font-semibold text-center transition cursor-pointer ${
                                reportCenterSelectedClass === cls
                                  ? 'bg-violet-50 border-violet-300 text-violet-700 font-bold shadow-xs'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {cls}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {reportCenterType === 'school' && (
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl">
                        <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          <Info size={14} className="text-violet-600" />
                          <span>Campus-wide Summary</span>
                        </h4>
                        <p className="text-[10px] text-slate-500 leading-relaxed mt-1.5">
                          Pulls an official multi-page comprehensive ledger digest across Creche, Nursery, and Basic divisions 1-9.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 text-center text-xs">
                        <div className="p-2.5 bg-slate-50 border border-slate-150 rounded-xl">
                          <span className="text-[8px] text-slate-400 font-bold uppercase">Total Classes</span>
                          <p className="text-lg font-bold text-slate-800 mt-0.5">{CLASSES.length}</p>
                        </div>
                        <div className="p-2.5 bg-slate-50 border border-slate-150 rounded-xl">
                          <span className="text-[8px] text-slate-400 font-bold uppercase">Total Billed</span>
                          <p className="text-lg font-bold text-slate-800 mt-0.5">{students.length} students</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar Action Buttons Block */}
              <div className="p-5 border-t border-slate-100 bg-slate-50 space-y-2.5 shrink-0">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleDownloadReportCenterPDF}
                    disabled={reportCenterType === 'student' && !reportCenterSelectedStudent}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs transition shadow-xs cursor-pointer select-none"
                  >
                    <FileDown size={14} />
                    <span>Download PDF</span>
                  </button>

                  <button
                    onClick={handlePrintReportCenter}
                    disabled={reportCenterType === 'student' && !reportCenterSelectedStudent}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs transition shadow-xs cursor-pointer select-none"
                  >
                    <Printer size={14} />
                    <span>Direct Print</span>
                  </button>
                </div>

                <button
                  onClick={handleExportReportCenterCSV}
                  disabled={reportCenterType === 'student' && !reportCenterSelectedStudent}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs transition shadow-xs cursor-pointer select-none"
                >
                  <FileSpreadsheet size={14} />
                  <span>Export Accounting CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowReportCenterModal(false)}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer text-center"
                >
                  Return to Fees Registry
                </button>
              </div>
            </div>

            {/* Document Preview (Right Column) */}
            <div className="flex-1 bg-slate-200 p-8 overflow-y-auto flex justify-center items-start">
              <div 
                id="report-center-preview-content"
                className="w-[794px] min-h-[1123px] bg-white border border-slate-300 shadow-xl p-10 relative flex flex-col justify-between text-slate-900 text-xs leading-relaxed"
              >
                {/* 1. Student Preview */}
                {reportCenterType === 'student' && reportCenterSelectedStudent && reportCenterSelectedStudentBill ? (
                  <div className="space-y-6">
                    {/* Letterhead */}
                    <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4">
                      <div className="flex items-center gap-3 text-left">
                        {schoolInfo.crestUrl || schoolInfo.logoUrl ? (
                          <img 
                            src={schoolInfo.crestUrl || schoolInfo.logoUrl} 
                            alt="School Crest" 
                            referrerPolicy="no-referrer"
                            className="w-14 h-14 object-contain rounded-xl"
                          />
                        ) : (
                          <div className="w-14 h-14 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold text-xl uppercase">
                            {schoolInfo.name?.substring(0, 2) || 'SC'}
                          </div>
                        )}
                        <div>
                          <h1 className="text-sm font-black uppercase text-slate-900 tracking-tight">{schoolInfo.name || 'GeeTech Academy'}</h1>
                          <p className="text-[10px] italic font-medium text-slate-500">Motto: "{schoolInfo.motto || 'Excellence and Dignity'}"</p>
                          <p className="text-[9px] text-slate-400 font-mono mt-0.5">{schoolInfo.gpsAddress || 'Digital Address System'} • GPS</p>
                        </div>
                      </div>
                      <div className="text-right text-[8.5px] font-mono text-slate-500 space-y-0.5">
                        <p>TEL: {schoolInfo.telephone || '+233 24 556 7780'}</p>
                        <p>EMAIL: {schoolInfo.email || 'info@school.edu.gh'}</p>
                        <p className="font-bold">GEN DATE: {new Date().toLocaleDateString()}</p>
                      </div>
                    </div>

                    {/* Document Header Title */}
                    <div className="text-center bg-slate-100 border border-slate-200 py-1.5 rounded-lg">
                      <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                        OFFICIAL STUDENT FEES LEDGER STATEMENT
                      </h2>
                      <p className="text-[9px] text-slate-500 font-semibold font-mono mt-0.5">
                        Academic Cycle: {selectedTerm} ({selectedAcademicYear})
                      </p>
                    </div>

                    {/* Meta grid */}
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-150 text-[11px] text-left">
                      <div className="space-y-0.5">
                        <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold block">Student Particulars</span>
                        <p className="font-bold text-slate-800">Name: <span className="capitalize">{reportCenterSelectedStudent.firstName} {reportCenterSelectedStudent.lastName}</span></p>
                        <p className="font-mono">ID: <span className="font-bold">{reportCenterSelectedStudent.id}</span></p>
                        <p>Class: <span className="font-semibold">{reportCenterSelectedStudent.class}</span></p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold block">Parent/Guardian Details</span>
                        <p className="font-bold text-slate-800">Guardian: <span className="capitalize">{reportCenterSelectedStudent.guardianName || 'N/A'}</span></p>
                        <p className="font-mono">Contact: {reportCenterSelectedStudent.guardianTelephone || 'N/A'}</p>
                        <p>Email: <span className="font-mono text-[10px]">{reportCenterSelectedStudent.guardianEmail || 'N/A'}</span></p>
                      </div>
                    </div>

                    {/* Bills table */}
                    <div className="space-y-2 text-left">
                      <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">I. Itemized Bills Allocation</h3>
                      <div className="border border-slate-300 rounded-lg overflow-hidden">
                        <table className="w-full text-left border-collapse text-[10px]">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-[9px]">
                              <th className="p-2">Levy Category Component</th>
                              <th className="p-2 text-right">Debit Expected (GHS)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            <tr>
                              <td className="p-2">Standard School Tuition Fees</td>
                              <td className="p-2 text-right font-mono text-slate-800 font-semibold">GHS {reportCenterSelectedStudentBill.schoolFees.toFixed(2)}</td>
                            </tr>
                            <tr>
                              <td className="p-2">Facility & Utility Maintenance Levy</td>
                              <td className="p-2 text-right font-mono text-slate-800 font-semibold">GHS {reportCenterSelectedStudentBill.utilityBill.toFixed(2)}</td>
                            </tr>
                            <tr>
                              <td className="p-2">Sports Development Dues Allocation</td>
                              <td className="p-2 text-right font-mono text-slate-800 font-semibold">GHS {reportCenterSelectedStudentBill.sportsFees.toFixed(2)}</td>
                            </tr>
                            <tr>
                              <td className="p-2">PTA Annual Dues Allocation</td>
                              <td className="p-2 text-right font-mono text-slate-800 font-semibold">GHS {reportCenterSelectedStudentBill.ptaDues.toFixed(2)}</td>
                            </tr>
                            {reportCenterSelectedStudentBill.transportationBill > 0 && (
                              <tr>
                                <td className="p-2">Transportation Bill Allocation</td>
                                <td className="p-2 text-right font-mono text-slate-800 font-semibold">GHS {reportCenterSelectedStudentBill.transportationBill.toFixed(2)}</td>
                              </tr>
                            )}
                            {reportCenterSelectedStudentBill.otherFee > 0 && (
                              <tr>
                                <td className="p-2">Miscellaneous Fee ({reportCenterSelectedStudentBill.otherFeeDescription || 'Other'})</td>
                                <td className="p-2 text-right font-mono text-slate-800 font-semibold">GHS {reportCenterSelectedStudentBill.otherFee.toFixed(2)}</td>
                              </tr>
                            )}
                            {(reportCenterSelectedStudentBill.customComponents || []).filter(c => (Number(c.amount) || 0) > 0).map(c => (
                              <tr key={c.componentId}>
                                <td className="p-2">{c.componentName} {c.category ? `(${c.category})` : ''}</td>
                                <td className="p-2 text-right font-mono text-slate-800 font-semibold">GHS {Number(c.amount).toFixed(2)}</td>
                              </tr>
                            ))}
                            <tr className="bg-slate-50 font-bold border-t border-slate-300">
                              <td className="p-2 font-bold text-slate-800 uppercase text-[9px]">Total Expected Billings:</td>
                              <td className="p-2 text-right font-mono font-bold text-slate-900">GHS {reportCenterSelectedStudentStats.expected.toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Credit installments table */}
                    <div className="space-y-2 text-left">
                      <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">II. Credited Installments Received</h3>
                      <div className="border border-slate-300 rounded-lg overflow-hidden">
                        <table className="w-full text-left border-collapse text-[10px]">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-[9px]">
                              <th className="p-1.5 pl-2">Payment Date</th>
                              <th className="p-1.5">Receipt Code</th>
                              <th className="p-1.5">Allocated Item</th>
                              <th className="p-1.5">Method</th>
                              <th className="p-1.5 text-right pr-2">Amount Paid (GHS)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {reportCenterSelectedStudentBill.payments.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="p-4 text-center text-slate-400 italic font-mono text-[9px]">
                                  No fee payments recorded for this academic term cycle yet.
                                </td>
                              </tr>
                            ) : (
                              reportCenterSelectedStudentBill.payments.map(p => (
                                <tr key={p.id} className="hover:bg-slate-50">
                                  <td className="p-1.5 pl-2 font-mono">{p.date}</td>
                                  <td className="p-1.5 font-mono font-semibold">{p.receiptNo}</td>
                                  <td className="p-1.5 capitalize">{p.component}</td>
                                  <td className="p-1.5">{p.method}</td>
                                  <td className="p-1.5 text-right pr-2 font-mono font-semibold text-emerald-700">GHS {p.amount.toFixed(2)}</td>
                                </tr>
                              ))
                            )}
                            <tr className="bg-slate-50 font-bold border-t border-slate-300">
                              <td colSpan={4} className="p-1.5 pl-2 text-right font-bold text-slate-800 uppercase text-[8.5px]">Total Payments Received:</td>
                              <td className="p-1.5 text-right pr-2 font-mono font-bold text-emerald-700">GHS {reportCenterSelectedStudentStats.paid.toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Balance panel */}
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center">
                      <div className="text-left">
                        <h3 className="text-[10px] font-black uppercase text-slate-900 tracking-tight">OUTSTANDING ARREARS BALANCE DUE</h3>
                        <p className="text-[8.5px] text-slate-400 font-mono">Status check: {reportCenterSelectedStudentStats.bal <= 0 ? 'CLEARED' : 'PENDING SETTLEMENT'}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-base font-black font-mono ${reportCenterSelectedStudentStats.bal > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                          GHS {reportCenterSelectedStudentStats.bal.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Verification */}
                    <div className="flex justify-between items-end text-[9px] border-t border-slate-200 pt-4 shrink-0">
                      <div className="flex items-center gap-2">
                        <div className="p-0.5 bg-white border border-slate-200 rounded-md shrink-0">
                          <QRCodeSVG 
                            value={`${window.location.origin}/?tab=fees&studentId=${reportCenterSelectedStudent.id}`}
                            size={36} 
                            level="M" 
                          />
                        </div>
                        <div className="text-left space-y-0.5">
                          <p className="text-slate-400 text-[8px] uppercase font-bold tracking-tighter">Verification</p>
                          <p className="text-[8px] text-slate-500 leading-tight">Scan QR to verify official school ledger standing.</p>
                        </div>
                      </div>

                      {/* Signature Area */}
                      <div className="text-center relative">
                        {schoolInfo.signatureUrl && (
                          <img 
                            src={schoolInfo.signatureUrl} 
                            alt="Signature" 
                            referrerPolicy="no-referrer"
                            className="w-16 h-8 absolute -top-5 left-1/2 -translate-x-1/2 object-contain pointer-events-none opacity-80 animate-none"
                          />
                        )}
                        {schoolInfo.stampUrl && (
                          <img 
                            src={schoolInfo.stampUrl} 
                            alt="Stamp Seal" 
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 absolute -top-7 -right-3 object-contain pointer-events-none opacity-70 animate-none"
                          />
                        )}
                        <span className="block italic text-[9.5px] text-slate-800 font-bold border-t border-slate-400 border-dashed pt-1 min-w-[140px]">
                          {schoolInfo.headteacherName || 'Principal headteacher'}
                        </span>
                        <span className="block text-[7.5px] uppercase tracking-wider text-slate-400 mt-0.5">Authorized Seal / Signature</span>
                      </div>
                    </div>
                  </div>
                ) : reportCenterType === 'student' ? (
                  <div className="flex flex-col items-center justify-center flex-1 h-full py-20 text-slate-400 italic gap-2">
                    <User size={36} className="opacity-50" />
                    <p>Please select a student from the left sidebar to preview statement</p>
                  </div>
                ) : null}

                {/* 2. Class Preview */}
                {reportCenterType === 'class' && (
                  <div className="space-y-6">
                    {/* Letterhead */}
                    <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4">
                      <div className="flex items-center gap-3 text-left">
                        {schoolInfo.crestUrl || schoolInfo.logoUrl ? (
                          <img 
                            src={schoolInfo.crestUrl || schoolInfo.logoUrl} 
                            alt="School Crest" 
                            referrerPolicy="no-referrer"
                            className="w-14 h-14 object-contain rounded-xl"
                          />
                        ) : (
                          <div className="w-14 h-14 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold text-xl uppercase">
                            {schoolInfo.name?.substring(0, 2) || 'SC'}
                          </div>
                        )}
                        <div>
                          <h1 className="text-sm font-black uppercase text-slate-900 tracking-tight">{schoolInfo.name || 'GeeTech Academy'}</h1>
                          <p className="text-[10px] italic font-medium text-slate-500">Motto: "{schoolInfo.motto || 'Excellence and Dignity'}"</p>
                          <p className="text-[9px] text-slate-400 font-mono mt-0.5">{schoolInfo.gpsAddress || 'Digital Address System'} • GPS</p>
                        </div>
                      </div>
                      <div className="text-right text-[8.5px] font-mono text-slate-500 space-y-0.5">
                        <p>TEL: {schoolInfo.telephone || '+233 24 556 7780'}</p>
                        <p>EMAIL: {schoolInfo.email || 'info@school.edu.gh'}</p>
                        <p className="font-bold">GEN DATE: {new Date().toLocaleDateString()}</p>
                      </div>
                    </div>

                    {/* Title */}
                    <div className="text-center bg-slate-100 border border-slate-200 py-1.5 rounded-lg">
                      <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                        CLASS TERMINAL FEES COMPLIANCE LEDGER
                      </h2>
                      <p className="text-[9px] text-slate-500 font-semibold font-mono mt-0.5">
                        Class Division: {reportCenterSelectedClass} • Academic Year: {selectedAcademicYear} • Term: {selectedTerm}
                      </p>
                    </div>

                    {/* Quick stats panel */}
                    <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                      <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                        <p className="text-slate-400 font-bold uppercase text-[7.5px] tracking-tight">Billed Students</p>
                        <p className="text-sm font-bold text-slate-800 mt-0.5">{reportCenterClassData.list.length}</p>
                      </div>
                      <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                        <p className="text-slate-400 font-bold uppercase text-[7.5px] tracking-tight">Total Expected</p>
                        <p className="text-sm font-bold text-slate-800 mt-0.5 font-mono">GHS {reportCenterClassData.totalExpected.toFixed(0)}</p>
                      </div>
                      <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                        <p className="text-slate-400 font-bold uppercase text-[7.5px] tracking-tight">Total Collected</p>
                        <p className="text-sm font-bold text-emerald-700 mt-0.5 font-mono">GHS {reportCenterClassData.totalPaid.toFixed(0)}</p>
                      </div>
                      <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                        <p className="text-slate-400 font-bold uppercase text-[7.5px] tracking-tight">Total Outstanding</p>
                        <p className="text-sm font-bold text-rose-600 mt-0.5 font-mono">GHS {reportCenterClassData.totalOwed.toFixed(0)}</p>
                      </div>
                    </div>

                    {/* Detail list table */}
                    <div className="border border-slate-300 rounded-lg overflow-hidden text-left">
                      <table className="w-full text-left border-collapse text-[10px]">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-[8.5px] uppercase">
                            <th className="p-2 text-center w-8">#</th>
                            <th className="p-2">Student ID</th>
                            <th className="p-2">Full Student Name</th>
                            <th className="p-2 text-right">Expected Fees</th>
                            <th className="p-2 text-right">Paid To-Date</th>
                            <th className="p-2 text-right">Arrears Due</th>
                            <th className="p-2 text-center w-24">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {reportCenterClassData.list.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-6 text-center text-slate-400 italic font-mono text-[9.5px]">
                                No registered students found billed under this class category currently.
                              </td>
                            </tr>
                          ) : (
                            reportCenterClassData.list.map((item, idx) => (
                              <tr key={item.student.id} className="hover:bg-slate-50">
                                <td className="p-1.5 text-center text-slate-400 font-mono font-medium">{idx + 1}</td>
                                <td className="p-1.5 font-mono font-semibold text-slate-600">{item.student.id}</td>
                                <td className="p-1.5 font-bold uppercase text-slate-900">{item.student.firstName} {item.student.lastName}</td>
                                <td className="p-1.5 text-right font-mono text-slate-600">GHS {item.expected.toFixed(1)}</td>
                                <td className="p-1.5 text-right font-mono text-emerald-600">GHS {item.paid.toFixed(1)}</td>
                                <td className={`p-1.5 text-right font-mono font-bold ${item.owed > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                                  GHS {item.owed.toFixed(1)}
                                </td>
                                <td className="p-1.5 text-center">
                                  <span className={`inline-block px-1.5 py-0.5 rounded text-[7.5px] font-extrabold tracking-wide uppercase border ${
                                    item.owed <= 0 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                                    item.paid > 0 ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                    'bg-rose-50 text-rose-800 border-rose-200'
                                  }`}>
                                    {item.owed <= 0 ? 'Cleared' : item.paid > 0 ? 'Partial' : 'No Payment'}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                          <tr className="bg-slate-100 font-extrabold border-t border-slate-300 text-[9.5px]">
                            <td colSpan={3} className="p-2 text-right uppercase text-slate-800">Class Cumulative Totals:</td>
                            <td className="p-2 text-right font-mono">GHS {reportCenterClassData.totalExpected.toFixed(1)}</td>
                            <td className="p-2 text-right font-mono text-emerald-700">GHS {reportCenterClassData.totalPaid.toFixed(1)}</td>
                            <td className="p-2 text-right font-mono text-rose-600">GHS {reportCenterClassData.totalOwed.toFixed(1)}</td>
                            <td className="p-2 text-center">
                              <span className="text-[8px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded font-black">
                                {reportCenterClassData.totalExpected > 0 ? Math.round((reportCenterClassData.totalPaid / reportCenterClassData.totalExpected) * 100) : 0}% COLL.
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Signature area */}
                    <div className="pt-8 border-t border-slate-200 flex justify-between items-end text-left text-[9px] shrink-0">
                      <div className="space-y-1 text-slate-400 font-mono text-[7.5px]">
                        <p>Class ledger generated by school fees registry</p>
                        <p>Compliance cycle: {selectedTerm} ({selectedAcademicYear})</p>
                      </div>
                      <div className="text-center relative">
                        {schoolInfo.signatureUrl && (
                          <img 
                            src={schoolInfo.signatureUrl} 
                            alt="Signature" 
                            referrerPolicy="no-referrer"
                            className="w-16 h-8 absolute -top-5 left-1/2 -translate-x-1/2 object-contain pointer-events-none opacity-80 animate-none"
                          />
                        )}
                        {schoolInfo.stampUrl && (
                          <img 
                            src={schoolInfo.stampUrl} 
                            alt="Stamp Seal" 
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 absolute -top-7 -right-3 object-contain pointer-events-none opacity-70 animate-none"
                          />
                        )}
                        <span className="block italic text-[9.5px] text-slate-800 font-bold border-t border-slate-400 border-dashed pt-1 min-w-[140px]">
                          {schoolInfo.headteacherName || 'Principal headteacher'}
                        </span>
                        <span className="block text-[7.5px] uppercase tracking-wider text-slate-400 mt-0.5">Authorized Seal / Signature</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. School Preview */}
                {reportCenterType === 'school' && (
                  <div className="space-y-6">
                    {/* Letterhead */}
                    <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4">
                      <div className="flex items-center gap-3 text-left">
                        {schoolInfo.crestUrl || schoolInfo.logoUrl ? (
                          <img 
                            src={schoolInfo.crestUrl || schoolInfo.logoUrl} 
                            alt="School Crest" 
                            referrerPolicy="no-referrer"
                            className="w-14 h-14 object-contain rounded-xl"
                          />
                        ) : (
                          <div className="w-14 h-14 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold text-xl uppercase">
                            {schoolInfo.name?.substring(0, 2) || 'SC'}
                          </div>
                        )}
                        <div>
                          <h1 className="text-sm font-black uppercase text-slate-900 tracking-tight">{schoolInfo.name || 'GeeTech Academy'}</h1>
                          <p className="text-[10px] italic font-medium text-slate-500">Motto: "{schoolInfo.motto || 'Excellence and Dignity'}"</p>
                          <p className="text-[9px] text-slate-400 font-mono mt-0.5">{schoolInfo.gpsAddress || 'Digital Address System'} • GPS</p>
                        </div>
                      </div>
                      <div className="text-right text-[8.5px] font-mono text-slate-500 space-y-0.5">
                        <p>TEL: {schoolInfo.telephone || '+233 24 556 7780'}</p>
                        <p>EMAIL: {schoolInfo.email || 'info@school.edu.gh'}</p>
                        <p className="font-bold">GEN DATE: {new Date().toLocaleDateString()}</p>
                      </div>
                    </div>

                    {/* Title */}
                    <div className="text-center bg-slate-100 border border-slate-200 py-1.5 rounded-lg">
                      <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                        COMPREHENSIVE CAMPUS-WIDE FEES DIRECTORY
                      </h2>
                      <p className="text-[9px] text-slate-500 font-semibold font-mono mt-0.5">
                        Executive Accounts Summary • Academic Year: {selectedAcademicYear} • Cycle: {selectedTerm}
                      </p>
                    </div>

                    {/* Metrics Cards */}
                    <div className="grid grid-cols-4 gap-3 text-left">
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <p className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">Expected Revenue</p>
                        <p className="text-sm font-black font-mono text-slate-800 mt-1">GHS {reportCenterSchoolData.overallExpected.toLocaleString('en-US', { minimumFractionDigits: 1 })}</p>
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <p className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">Total Collection</p>
                        <p className="text-sm font-black font-mono text-emerald-700 mt-1">GHS {reportCenterSchoolData.overallPaid.toLocaleString('en-US', { minimumFractionDigits: 1 })}</p>
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <p className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">Outstanding Arrears</p>
                        <p className="text-sm font-black font-mono text-rose-600 mt-1">GHS {reportCenterSchoolData.overallOwed.toLocaleString('en-US', { minimumFractionDigits: 1 })}</p>
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <p className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">Collection Efficiency</p>
                        <p className="text-sm font-black font-mono text-indigo-700 mt-1">{reportCenterSchoolData.overallRate}%</p>
                      </div>
                    </div>

                    {/* Class divisions summary */}
                    <div className="space-y-2 text-left">
                      <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">I. Class Divisional Ledger Aggregates</h3>
                      <div className="border border-slate-300 rounded-lg overflow-hidden font-sans">
                        <table className="w-full text-left border-collapse text-[10px]">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-[8.5px] uppercase">
                              <th className="p-2">Class Name</th>
                              <th className="p-2 text-center">Billed Registries</th>
                              <th className="p-2 text-right">Expected Revenue</th>
                              <th className="p-2 text-right">Total Collected</th>
                              <th className="p-2 text-right">Outstanding Arrears</th>
                              <th className="p-2 text-right">Rate (%)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {reportCenterSchoolData.classStats.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="p-4 text-center text-slate-400 italic font-mono text-[9.5px]">
                                  No student billing records found on this academic cycle yet.
                                </td>
                              </tr>
                            ) : (
                              reportCenterSchoolData.classStats.map(s => (
                                <tr key={s.class} className="hover:bg-slate-50 font-medium">
                                  <td className="p-2 font-bold text-slate-800">{s.class}</td>
                                  <td className="p-2 text-center font-mono">{s.count} students</td>
                                  <td className="p-2 text-right font-mono text-slate-600">GHS {s.totalExpected.toLocaleString('en-US', { minimumFractionDigits: 1 })}</td>
                                  <td className="p-2 text-right font-mono text-emerald-600">GHS {s.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 1 })}</td>
                                  <td className={`p-2 text-right font-mono font-bold ${s.totalOwed > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                                    GHS {s.totalOwed.toLocaleString('en-US', { minimumFractionDigits: 1 })}
                                  </td>
                                  <td className="p-2 text-right font-mono text-indigo-700 font-bold">{s.rate}%</td>
                                </tr>
                              ))
                            )}
                            <tr className="bg-slate-100 font-black border-t-2 border-slate-300 text-[10px]">
                              <td className="p-2 text-slate-800 uppercase">TOTAL SUMMATIONS:</td>
                              <td className="p-2 text-center font-mono text-indigo-700">{students.length} billed</td>
                              <td className="p-2 text-right font-mono">GHS {reportCenterSchoolData.overallExpected.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                              <td className="p-2 text-right font-mono text-emerald-700">GHS {reportCenterSchoolData.overallPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                              <td className="p-2 text-right font-mono text-rose-600">GHS {reportCenterSchoolData.overallOwed.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                              <td className="p-2 text-right font-mono text-indigo-700">{reportCenterSchoolData.overallRate}%</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Signature block */}
                    <div className="pt-8 border-t border-slate-200 flex justify-between items-end text-left text-[9px] shrink-0">
                      <div className="space-y-1 text-slate-400 font-mono text-[7.5px]">
                        <p>Official School Campus Financial Directory</p>
                        <p>Generated by administrative ledger portal</p>
                      </div>
                      <div className="text-center relative">
                        {schoolInfo.signatureUrl && (
                          <img 
                            src={schoolInfo.signatureUrl} 
                            alt="Signature" 
                            referrerPolicy="no-referrer"
                            className="w-16 h-8 absolute -top-5 left-1/2 -translate-x-1/2 object-contain pointer-events-none opacity-80 animate-none"
                          />
                        )}
                        {schoolInfo.stampUrl && (
                          <img 
                            src={schoolInfo.stampUrl} 
                            alt="Stamp Seal" 
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 absolute -top-7 -right-3 object-contain pointer-events-none opacity-70 animate-none"
                          />
                        )}
                        <span className="block italic text-[9.5px] text-slate-800 font-bold border-t border-slate-400 border-dashed pt-1 min-w-[140px]">
                          {schoolInfo.headteacherName || 'Principal headteacher'}
                        </span>
                        <span className="block text-[7.5px] uppercase tracking-wider text-slate-400 mt-0.5">Authorized Seal / Signature</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* SECTION DATA CONTROLS */}
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3 no-print mt-6">
      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
        <AlertTriangle className="text-indigo-500" size={14} /> Section School Fees Controls
      </h4>
      <p className="text-[10px] text-slate-500 leading-relaxed">
        Manage active payment states, wipe entry fields inside overlays, and purge historical transaction and debit rows associated with this module.
      </p>
      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        <button
          type="button"
          onClick={handleClearInputs}
          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-850 hover:bg-slate-100 rounded-xl font-bold font-sans transition text-xs cursor-pointer shadow-xs"
        >
          <Eraser size={13} /> <span className="hidden sm:inline">Clear All</span> Inputs
        </button>
        <button
          type="button"
          onClick={handleDeleteActiveSelection}
          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 hover:text-amber-850 hover:bg-amber-100 rounded-xl font-bold font-sans transition text-xs cursor-pointer shadow-xs"
        >
          <RotateCcw size={13} /> <span className="hidden sm:inline">Delete Selected</span> Ledger
        </button>
        <button
          type="button"
          onClick={handleDeleteAllFees}
          className="w-full sm:w-auto sm:ml-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 hover:text-rose-850 hover:bg-rose-100 rounded-xl font-bold font-sans transition text-xs cursor-pointer shadow-xs"
        >
          <Trash2 size={13} /> Delete All Section Data
        </button>
      </div>
    </div>

    {/* BULK RECEIPTS PRINT AREA (HIDDEN) - 3 RECEIPTS PER A4 PORTRAIT SHEET */}
    <div id="bulk-receipts-print-area" className="hidden">
      {(() => {
        // Chunk into groups of 3 receipts per A4 Portrait sheet
        const pages: typeof bulkReceiptData[] = [];
        for (let i = 0; i < bulkReceiptData.length; i += 3) {
          pages.push(bulkReceiptData.slice(i, i + 3));
        }

        return pages.map((pageGroup, pageIdx) => (
          <div 
            key={`bulk-receipt-page-${pageIdx}`} 
            className="bulk-receipts-print-page w-[210mm] min-h-[297mm] p-[6mm] bg-white text-slate-900 mx-auto flex flex-col justify-between"
            style={{ 
              pageBreakAfter: 'always', 
              breakAfter: 'page', 
              pageBreakInside: 'avoid',
              boxSizing: 'border-box' 
            }}
          >
            {pageGroup.map((data, itemIdx) => (
              <React.Fragment key={`${data.payment.id}-${itemIdx}`}>
                <div 
                  className="bulk-receipt-slip relative bg-white text-slate-900 text-left border-[2px] border-double border-slate-800 p-3 flex flex-col justify-between rounded-none overflow-hidden"
                  style={{
                    height: '88mm',
                    maxHeight: '90mm',
                    boxSizing: 'border-box',
                    pageBreakInside: 'avoid'
                  }}
                >
                  {/* Watermark */}
                  <div 
                    className="absolute inset-0 pointer-events-none opacity-5" 
                    dangerouslySetInnerHTML={{ __html: getWatermarkHtml(schoolInfo.crestUrl) }} 
                  />
                  
                  <div className="relative z-10 flex flex-col h-full justify-between">
                    {/* Header */}
                    <div className="flex justify-between items-center pb-1.5 border-b border-slate-800">
                      <div className="space-y-0.5">
                        <h1 className="text-xs font-bold tracking-tight text-slate-950 uppercase leading-tight">{schoolInfo.name}</h1>
                        <p className="text-[8px] font-semibold text-slate-500 tracking-wider">Motto: "{schoolInfo.motto}"</p>
                        <p className="text-[8px] text-slate-700 leading-tight">{schoolInfo.gpsAddress} • Tel: {schoolInfo.telephone}</p>
                      </div>
                      {schoolInfo.logoUrl ? (
                        <img referrerPolicy="no-referrer" src={schoolInfo.logoUrl} className="h-8 w-8 object-contain" alt="School Crest" />
                      ) : (
                        <div className="p-0.5 border border-slate-200 rounded bg-slate-50 text-slate-400">
                          <Receipt className="h-5 w-5" />
                        </div>
                      )}
                    </div>

                    {/* Receipt Title */}
                    <div className="text-center py-0.5 bg-slate-50 border-b border-slate-200">
                      <h2 className="text-[9px] font-bold uppercase tracking-widest text-slate-950">OFFICIAL PAYMENT RECEIPT</h2>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[8.5px] font-sans">
                      <div className="space-y-0.5">
                        <p><span className="text-slate-500">CODE:</span> <span className="font-mono font-bold">{data.payment.receiptNo}</span></p>
                        <p><span className="text-slate-500">STUDENT:</span> <span className="font-bold uppercase truncate">{data.bill.studentName}</span></p>
                        <p><span className="text-slate-500">ID:</span> <span className="font-semibold font-mono">{data.bill.studentId}</span></p>
                      </div>

                      <div className="space-y-0.5 text-right">
                        <p><span className="text-slate-500">DATE:</span> <span className="font-semibold font-mono">{data.payment.date}</span></p>
                        <p><span className="text-slate-500">TERM:</span> <span className="font-semibold">{data.bill.academicYear} • {data.bill.term}</span></p>
                        <p><span className="text-slate-500">METHOD:</span> <span className="font-bold">{data.payment.method}</span></p>
                      </div>
                    </div>

                    {/* Main Receipt Breakdown */}
                    <div className="border border-slate-800 rounded overflow-hidden">
                      <table className="w-full text-[8.5px]">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-800 text-[8px]">
                            <th className="p-1 text-left pl-2">Description</th>
                            <th className="p-1 text-right pr-2">Amount (GHS)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="p-1 pl-2">
                              <p className="font-bold text-slate-900 uppercase">{data.payment.component}</p>
                            </td>
                            <td className="p-1 text-right pr-2 font-mono font-bold text-slate-900 bg-slate-50">
                              {data.payment.amount.toFixed(2)}
                            </td>
                          </tr>
                          {data.payment.remarks && (
                            <tr>
                              <td colSpan={2} className="p-0.5 pl-2 bg-slate-50/50 italic text-[7.5px] text-slate-500 border-t border-slate-200">
                                Note: {data.payment.remarks}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Totals & QR Code */}
                    <div className="flex justify-between items-end text-[8.5px] border-t border-slate-300 pt-1">
                      <div className="flex items-center gap-1.5">
                        <div className="p-0.5 bg-white border border-slate-200 rounded shrink-0">
                          <QRCodeSVG 
                            value={`${window.location.origin}/?tab=fees&studentId=${data.bill.studentId}&receiptNo=${data.payment.receiptNo}`}
                            size={32} 
                            level="M" 
                          />
                        </div>
                        <div className="text-left space-y-0.5">
                          <p className="text-slate-400 text-[7px] uppercase font-bold tracking-tighter">Verification</p>
                          <p className="text-[7px] text-slate-500 leading-tight">Official electronic payment record</p>
                        </div>
                      </div>
                      <div className="text-right space-y-0.5">
                        {(() => {
                          const expectedTotal = calculateBillExpected(data.bill);
                          const totalPaid = (data.bill.payments || []).reduce((sum, p) => sum + (Number(p?.amount) || 0), 0);
                          const outstanding = expectedTotal - totalPaid;

                          return (
                            <div className="space-y-0.5">
                              <p className="flex justify-between gap-4"><span className="text-slate-500">Paid to-date:</span> <span className="font-mono font-bold text-emerald-700">GHS {totalPaid.toFixed(2)}</span></p>
                              <p className="flex justify-between gap-4 font-bold text-slate-950 border-t border-slate-300 pt-0.5 text-[9.5px]"><span className="font-bold">Balance:</span> <span className="font-mono">GHS {outstanding.toFixed(2)}</span></p>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Signatures */}
                    <div className="pt-1 grid grid-cols-2 gap-4 text-center text-[7.5px]">
                      <div className="border-t border-dashed border-slate-400 pt-0.5">
                        <p className="font-medium text-slate-700 uppercase tracking-tighter">Accounts Office</p>
                      </div>
                      <div className="border-t border-dashed border-slate-400 pt-0.5">
                        <p className="font-medium text-slate-700 uppercase tracking-tighter">Bursar / Signature</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Perforated / Scissor guide between receipts on the same sheet */}
                {itemIdx < pageGroup.length - 1 && (
                  <div className="perforated-cut-line relative flex items-center justify-center my-1 select-none pointer-events-none">
                    <div className="w-full border-t border-dashed border-slate-400" />
                    <span className="absolute bg-white px-2 text-[7.5px] text-slate-400 font-mono tracking-wider flex items-center gap-1">
                      ✂ CUT HERE / TEAR SLIP
                    </span>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        ));
      })()}
    </div>

    {confirmModal && confirmModal.isOpen && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 no-print animate-fade-in">
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

    {showBulkBillingModal && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 no-print animate-fade-in">
        <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden text-left p-6 space-y-4 animate-scale-up">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl shrink-0 bg-indigo-50 text-indigo-600">
              <Coins size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-slate-900 font-sans tracking-tight">
                Initialize Standard Billing
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Apply default standard bills to ALL students? Enter base GHS amount for School Fees:
              </p>
              <div className="mt-3">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Base School Fees Amount (GHS)</label>
                <input
                  type="number"
                  value={bulkSchoolFeesAmount}
                  onChange={(e) => setBulkSchoolFeesAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-800 font-semibold text-xs"
                  placeholder="e.g. 400"
                  min="0"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowBulkBillingModal(false)}
              className="flex-1 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer select-none text-center"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const sAmt = parseFloat(bulkSchoolFeesAmount) || 0;
                handleBulkSetup('All', {
                  schoolFees: sAmt,
                  utilityBill: 50,
                  sportsFees: 20,
                  ptaDues: 30,
                  transportationBill: 0,
                  otherFee: 0,
                  otherFeeDescription: 'Excursion'
                });
                setShowBulkBillingModal(false);
              }}
              className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition cursor-pointer select-none text-center"
            >
              Apply Billing
            </button>
          </div>
        </div>
      </div>
    )}

      {/* GRANULAR BILL COMPONENTS & LEVIES MANAGER MODAL */}
      <AnimatePresence>
        {showComponentsManagerModal && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowComponentsManagerModal(false);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto cursor-pointer no-print"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ ease: "easeOut", duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white max-w-4xl w-full rounded-[24px] shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] cursor-default md:my-8"
            >
              <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-white/10 rounded-xl">
                    <Layers className="h-5 w-5 text-indigo-100" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider">Granular Bill Components &amp; Levies Manager</h3>
                    <p className="text-[11px] text-indigo-100 font-medium">Define fee items (Exam Fees, Library Levy, ICT Levy) with individual cost values and auto-link to student statements.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowComponentsManagerModal(false)}
                  className="p-1.5 hover:bg-white/10 rounded-xl text-white/80 hover:text-white transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6 bg-slate-50/50 text-xs">
                {/* Top Action Ribbon */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-slate-800 text-[13px]">Active Term Billing Components ({customBillComponents.length})</h4>
                    <p className="text-[11px] text-slate-500">Changes propagate instantly to linked student statements upon sync.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        handleSyncComponentsToAllStudents();
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                      title="Propagate active components to all student billing statements"
                    >
                      <RefreshCw size={14} className="text-indigo-100" />
                      <span>Sync &amp; Apply to All Students</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreateCategoryModalOpen(true)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Create New Component</span>
                    </button>
                  </div>
                </div>

                {/* Components List Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customBillComponents.map((comp) => (
                    <div 
                      key={comp.id}
                      className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3 hover:border-indigo-300 transition flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-extrabold uppercase text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                              {comp.category}
                            </span>
                            <h5 className="text-sm font-black text-slate-900 mt-1">{comp.name}</h5>
                            {comp.code && <span className="font-mono text-[10px] text-slate-400">Code: {comp.code}</span>}
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-base font-black font-mono text-slate-900 block">
                              GHS {Number(comp.defaultAmount).toFixed(2)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">{comp.frequency}</span>
                          </div>
                        </div>

                        {comp.description && (
                          <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">{comp.description}</p>
                        )}

                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] font-bold text-slate-500">Classes:</span>
                          {comp.applicableClasses.includes('All') ? (
                            <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">All Classes</span>
                          ) : (
                            comp.applicableClasses.map(cls => (
                              <span key={cls} className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">{cls}</span>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={comp.isActive}
                            onChange={(e) => {
                              const updated = { ...comp, isActive: e.target.checked, updatedAt: new Date().toISOString() };
                              handleSaveGranularComponent(updated);
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-700">Active</span>
                        </label>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingComponent(comp);
                              // Can also trigger edit modal or inline prompt
                            }}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 px-2.5 py-1 bg-indigo-50 rounded-lg transition"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteGranularComponent(comp.id)}
                            className="text-xs font-bold text-rose-600 hover:text-rose-800 px-2.5 py-1 bg-rose-50 rounded-lg transition"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-6 py-4 bg-white border-t border-slate-100 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setShowComponentsManagerModal(false)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Done / Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DEDICATED OFFSCREEN COMPONENT PDF RECEIPT RENDER NODE */}
      <div
        id="component-pdf-receipt-render-node"
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          width: '794px',
          minHeight: '1123px',
          backgroundColor: '#ffffff',
          zIndex: -50,
          padding: '36px',
          boxSizing: 'border-box',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          color: '#0f172a'
        }}
      >
        {pdfTargetPayment && (() => {
          const { bill, payment } = pdfTargetPayment;
          const compName = payment.component || 'School Fees';
          const compExpected = getComponentExpectedAmount(bill, compName);
          const compPaid = getComponentPaidAmount(bill, compName);
          const compBalance = Math.max(0, compExpected - compPaid);
          const isFullySettled = compExpected > 0 && compPaid >= compExpected;

          const totalExpected = calculateBillExpected(bill);
          const totalPaid = (bill.payments || []).reduce((sum, p) => sum + (Number(p?.amount) || 0), 0);
          const totalOutstanding = Math.max(0, totalExpected - totalPaid);

          const componentMeta = (customBillComponents || []).find(c => c && (c.name || '').toLowerCase() === compName.toLowerCase());

          return (
            <div style={{ position: 'relative', border: '3px double #0f172a', padding: '28px', backgroundColor: '#ffffff', minHeight: '1040px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              {/* Watermark */}
              <div
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.04 }}
                dangerouslySetInnerHTML={{ __html: getWatermarkHtml(schoolInfo.crestUrl) }}
              />

              <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', gap: '20px' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '16px' }}>
                  <div>
                    <h1 style={{ fontSize: '20px', fontWeight: '900', textTransform: 'uppercase', margin: 0, letterSpacing: '-0.5px', color: '#090d16' }}>{schoolInfo.name}</h1>
                    <p style={{ fontSize: '11px', fontWeight: '600', color: '#475569', margin: '3px 0 0 0', fontStyle: 'italic' }}>"{schoolInfo.motto}"</p>
                    <p style={{ fontSize: '10px', color: '#64748b', margin: '4px 0 0 0' }}>{schoolInfo.gpsAddress} • Tel: {schoolInfo.telephone} • {schoolInfo.email}</p>
                  </div>
                  {schoolInfo.logoUrl ? (
                    <img referrerPolicy="no-referrer" src={schoolInfo.logoUrl} style={{ height: '64px', width: '64px', objectFit: 'contain' }} alt="Crest" />
                  ) : (
                    <div style={{ width: '56px', height: '56px', border: '1px solid #cbd5e1', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', color: '#059669', fontWeight: 'bold' }}>GTIMS</div>
                  )}
                </div>

                {/* Receipt Title Banner */}
                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', color: '#166534' }}>
                      OFFICIAL BILL COMPONENT PAYMENT RECEIPT
                    </span>
                    <p style={{ fontSize: '10px', color: '#15803d', margin: '2px 0 0 0' }}>Specific Component Settlement Voucher • Academic Year {bill.academicYear}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b' }}>Receipt Reference</span>
                    <div style={{ fontSize: '15px', fontWeight: '800', fontFamily: 'monospace', color: '#0f172a' }}>{payment.receiptNo}</div>
                  </div>
                </div>

                {/* Student & Payment Info Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div><span style={{ color: '#64748b', fontWeight: '600' }}>STUDENT NAME:</span> <strong style={{ textTransform: 'uppercase', color: '#0f172a' }}>{bill.studentName}</strong></div>
                    <div><span style={{ color: '#64748b', fontWeight: '600' }}>STUDENT ID:</span> <span style={{ fontFamily: 'monospace', fontWeight: '700' }}>{bill.studentId}</span></div>
                    <div><span style={{ color: '#64748b', fontWeight: '600' }}>CLASS / DIVISION:</span> <span style={{ fontWeight: '700', color: '#1e293b' }}>{bill.class}</span></div>
                    <div><span style={{ color: '#64748b', fontWeight: '600' }}>BILLING CYCLE:</span> <span>{bill.academicYear} • {bill.term}</span></div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'right' }}>
                    <div><span style={{ color: '#64748b', fontWeight: '600' }}>TRANSACTION DATE:</span> <span style={{ fontFamily: 'monospace', fontWeight: '700' }}>{payment.date}</span></div>
                    <div><span style={{ color: '#64748b', fontWeight: '600' }}>PAYMENT METHOD:</span> <strong style={{ textTransform: 'uppercase', color: '#047857' }}>{payment.method}</strong></div>
                    <div><span style={{ color: '#64748b', fontWeight: '600' }}>TARGET COMPONENT:</span> <strong style={{ color: '#0f172a' }}>{compName}</strong></div>
                    <div><span style={{ color: '#64748b', fontWeight: '600' }}>PAYMENT STATUS:</span> <span style={{ fontWeight: '800', color: isFullySettled ? '#166534' : '#b45309' }}>{isFullySettled ? 'FULLY SETTLED' : 'PARTIALLY PAID'}</span></div>
                  </div>
                </div>

                {/* Specific Bill Component Ledger Line Item */}
                <div>
                  <h4 style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#334155', margin: '0 0 8px 0' }}>
                    Bill Component Payment Breakdown
                  </h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', border: '1px solid #cbd5e1' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #94a3b8', textTransform: 'uppercase', fontSize: '10px', color: '#334155' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Item / Component Description</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Category</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Expected Levy (GHS)</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Paid This Receipt (GHS)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '12px', fontWeight: '700', color: '#0f172a' }}>
                          <div style={{ textTransform: 'uppercase' }}>{compName}</div>
                          {componentMeta?.description && (
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'normal', marginTop: '2px' }}>{componentMeta.description}</div>
                          )}
                        </td>
                        <td style={{ padding: '12px', color: '#475569' }}>
                          <span style={{ backgroundColor: '#e2e8f0', color: '#334155', padding: '2px 8px', borderRadius: '4px', fontSize: '9.5px', fontWeight: '600' }}>
                            {componentMeta?.category || 'Standard Levy'}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '600', color: '#334155' }}>
                          {compExpected.toFixed(2)}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '800', color: '#166534', backgroundColor: '#f0fdf4', fontSize: '13px' }}>
                          GHS {payment.amount.toFixed(2)}
                        </td>
                      </tr>
                      {payment.remarks && (
                        <tr>
                          <td colSpan={4} style={{ padding: '8px 12px', fontSize: '10px', fontStyle: 'italic', color: '#475569', backgroundColor: '#f8fafc' }}>
                            <strong>Official Note:</strong> {payment.remarks}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Dual Settlement Cards: Specific Component vs Overall Ledger */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '11px' }}>
                  {/* Specific Component Settlement Card */}
                  <div style={{ border: '1.5px solid #10b981', borderRadius: '8px', padding: '12px', backgroundColor: '#ecfdf5' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #a7f3d0', paddingBottom: '6px', marginBottom: '8px' }}>
                      <strong style={{ textTransform: 'uppercase', fontSize: '10px', color: '#065f46' }}>{compName} Settlement Position</strong>
                      <span style={{ fontSize: '9px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px', backgroundColor: isFullySettled ? '#059669' : '#d97706', color: '#ffffff' }}>
                        {isFullySettled ? 'FULLY SETTLED' : 'PARTIAL SETTLEMENT'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10.5px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#047857' }}>Component Expected Levy:</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: '700' }}>GHS {compExpected.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#047857' }}>Cumulative Paid To-Date:</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#15803d' }}>GHS {compPaid.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #a7f3d0', paddingTop: '4px', fontWeight: 'bold' }}>
                        <span style={{ color: '#065f46' }}>Remaining Component Balance:</span>
                        <span style={{ fontFamily: 'monospace', color: compBalance > 0 ? '#b91c1c' : '#15803d' }}>GHS {compBalance.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Overall Student Ledger Card */}
                  <div style={{ border: '1.5px solid #cbd5e1', borderRadius: '8px', padding: '12px', backgroundColor: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '8px' }}>
                      <strong style={{ textTransform: 'uppercase', fontSize: '10px', color: '#334155' }}>Overall Student Dues Summary</strong>
                      <span style={{ fontSize: '9px', color: '#64748b' }}>{bill.term}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10.5px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Total Billed Dues:</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: '700' }}>GHS {totalExpected.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Total Installments Credited:</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#15803d' }}>GHS {totalPaid.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '4px', fontWeight: 'bold' }}>
                        <span style={{ color: '#1e293b' }}>Cumulative Unpaid Balance:</span>
                        <span style={{ fontFamily: 'monospace', color: totalOutstanding > 0 ? '#b91c1c' : '#15803d' }}>GHS {totalOutstanding.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Security Verification & Signatures */}
                <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ padding: '4px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
                      <QRCodeSVG
                        value={`${window.location.origin}/?tab=fees&studentId=${bill.studentId}&receiptNo=${payment.receiptNo}&component=${encodeURIComponent(compName)}&amount=${payment.amount}`}
                        size={64}
                        level="M"
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: '#1e293b' }}>Electronic Verification Seal</div>
                      <div style={{ fontSize: '8.5px', color: '#64748b', maxWidth: '240px', lineHeight: '1.3', marginTop: '2px' }}>
                        Scan QR code with any camera or device to authenticate this official fee settlement record against the primary institutional database.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '32px', textAlign: 'center' }}>
                    <div style={{ minWidth: '130px' }}>
                      <div style={{ borderBottom: '1px dashed #64748b', height: '36px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                        <span style={{ fontSize: '10px', fontWeight: 'bold', fontStyle: 'italic', color: '#334155' }}>Official Clearance</span>
                      </div>
                      <span style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', color: '#475569', display: 'block', marginTop: '4px' }}>Accounts Officer</span>
                    </div>

                    <div style={{ minWidth: '130px', position: 'relative' }}>
                      {schoolInfo.signatureUrl && (
                        <img
                          src={schoolInfo.signatureUrl}
                          alt="Signature"
                          referrerPolicy="no-referrer"
                          style={{ height: '32px', position: 'absolute', top: '0', left: '50%', transform: 'translateX(-50%)', opacity: 0.8 }}
                        />
                      )}
                      <div style={{ borderBottom: '1px dashed #64748b', height: '36px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                        <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#1e293b' }}>{schoolInfo.headteacherName || 'Bursar'}</span>
                      </div>
                      <span style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', color: '#475569', display: 'block', marginTop: '4px' }}>Bursar / Cashier</span>
                    </div>
                  </div>
                </div>

                {/* Footer Notice */}
                <div style={{ textAlign: 'center', fontSize: '8.5px', color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                  This is an official computer-generated receipt issued by {schoolInfo.name}. Valid only when verified via the electronic school ledger portal.
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* SPECIFIC BILL COMPONENT PDF RECEIPTS HUB MODAL */}
      <AnimatePresence>
        {showComponentReceiptsModal && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowComponentReceiptsModal(false);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto no-print"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ ease: "easeOut", duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white max-w-5xl w-full rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] text-left"
            >
              {/* Modal Header */}
              <div className="p-5 sm:p-6 pb-4 bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 leading-snug">
                      Specific Bill Component PDF Receipts Hub
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Generate, preview, and download official PDF receipts specifically itemized by fee component
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBulkPrintComponentReceipts}
                    disabled={filteredComponentPayments.length === 0}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                    title="Print all filtered component receipts"
                  >
                    <Printer className="w-3.5 h-3.5" /> Batch Print Filtered ({filteredComponentPayments.length})
                  </button>
                  <button
                    onClick={() => setShowComponentReceiptsModal(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Filter Controls Bar */}
              <div className="p-4 sm:px-6 bg-slate-50 border-b border-slate-200/80 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shrink-0">
                <div className="flex flex-wrap items-center gap-2.5 flex-1">
                  {/* Component Selector */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Component:</span>
                    <select
                      value={selectedReceiptComponent}
                      onChange={(e) => setSelectedReceiptComponent(e.target.value)}
                      className="text-xs font-bold border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="All">All Components ({availableComponentNames.length})</option>
                      {availableComponentNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Class Filter */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Class:</span>
                    <select
                      value={receiptComponentClassFilter}
                      onChange={(e) => setReceiptComponentClassFilter(e.target.value as any)}
                      className="text-xs font-bold border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="All">All Classes</option>
                      {CLASSES.map((cls) => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Search Box */}
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={receiptComponentSearchQuery}
                    onChange={(e) => setReceiptComponentSearchQuery(e.target.value)}
                    placeholder="Search student name or ID..."
                    className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-800 placeholder-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {receiptComponentSearchQuery && (
                    <button
                      onClick={() => setReceiptComponentSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Component Stats Ribbon */}
              <div className="px-5 sm:px-6 py-3 bg-white border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Focus</p>
                  <p className="text-xs font-bold text-slate-800 truncate mt-0.5">{selectedReceiptComponent}</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Payment Records</p>
                  <p className="text-xs font-bold font-mono text-indigo-700 mt-0.5">{filteredComponentPayments.length} transactions</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Received</p>
                  <p className="text-xs font-bold font-mono text-emerald-700 mt-0.5">
                    GHS {filteredComponentPayments.reduce((sum, item) => sum + item.payment.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Term Cycle</p>
                  <p className="text-xs font-bold text-slate-700 truncate mt-0.5">{selectedAcademicYear} • {selectedTerm}</p>
                </div>
              </div>

              {/* Filtered Payments Table */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                        <th className="py-3 px-3.5">Date</th>
                        <th className="py-3 px-3.5">Receipt Code</th>
                        <th className="py-3 px-3.5">Student</th>
                        <th className="py-3 px-3.5">Class</th>
                        <th className="py-3 px-3.5">Component</th>
                        <th className="py-3 px-3.5 text-right">Amount Paid</th>
                        <th className="py-3 px-3.5 text-center">Settlement Status</th>
                        <th className="py-3 px-3.5 text-center">Download PDF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredComponentPayments.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-400 font-mono text-xs">
                            <Receipt className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                            No payment transactions found matching the selected component and search criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredComponentPayments.map(({ bill, payment }) => {
                          const compExpected = getComponentExpectedAmount(bill, payment.component);
                          const compPaid = getComponentPaidAmount(bill, payment.component);
                          const compBalance = Math.max(0, compExpected - compPaid);
                          const isFullySettled = compExpected > 0 && compPaid >= compExpected;

                          return (
                            <tr key={payment.id} className="hover:bg-slate-50/80 transition">
                              <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-600">{payment.date}</td>
                              <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900">{payment.receiptNo}</td>
                              <td className="py-2.5 px-3.5">
                                <div className="font-bold text-slate-800">{bill.studentName}</div>
                                <div className="text-[10px] font-mono text-slate-400">{bill.studentId}</div>
                              </td>
                              <td className="py-2.5 px-3.5 font-medium text-slate-600">{bill.class}</td>
                              <td className="py-2.5 px-3.5">
                                <span className="inline-block bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                                  {payment.component}
                                </span>
                              </td>
                              <td className="py-2.5 px-3.5 text-right font-mono font-bold text-emerald-700">
                                GHS {payment.amount.toFixed(2)}
                              </td>
                              <td className="py-2.5 px-3.5 text-center">
                                <div className="inline-flex flex-col items-center gap-0.5">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                    isFullySettled ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {isFullySettled ? 'Fully Settled' : 'Partially Paid'}
                                  </span>
                                  {compExpected > 0 && (
                                    <span className="text-[9px] text-slate-400 font-mono">
                                      Bal: GHS {compBalance.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3.5 text-center">
                                <div className="inline-flex items-center gap-1.5 justify-center">
                                  <button
                                    onClick={() => handleGenerateComponentPdfReceipt(bill, payment)}
                                    disabled={isGeneratingComponentPdf}
                                    title={`Download official PDF receipt for ${payment.component}`}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition shadow-2xs disabled:opacity-50 cursor-pointer active:scale-95"
                                  >
                                    <FileDown className="w-3.5 h-3.5" /> PDF
                                  </button>
                                  <button
                                    onClick={() => setActiveReceiptPayment({ bill, payment })}
                                    title="Preview slip & print receipt"
                                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                  >
                                    <Receipt className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <span className="text-xs text-slate-500">
                  Showing <strong>{filteredComponentPayments.length}</strong> matching component receipt records
                </span>
                <button
                  onClick={() => setShowComponentReceiptsModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Close Receipt Hub
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create New Bill Category Modal */}
      <CreateBillCategoryModal
        isOpen={isCreateCategoryModalOpen}
        onClose={() => {
          setIsCreateCategoryModalOpen(false);
          setCustomBillComponents(DbController.getCustomBillComponents());
        }}
        onSuccess={(newComp) => {
          setCustomBillComponents(DbController.getCustomBillComponents());
          setPaymentComponent(newComp.name);
        }}
      />

      {/* Academic Year Selection & Calendar Creator Modal */}
      <AcademicYearModal
        isOpen={showAcademicYearModal}
        onClose={() => setShowAcademicYearModal(false)}
        onSelectYear={(yr) => setSelectedAcademicYear(yr)}
        currentYear={selectedAcademicYear}
      />

    </div>
  );
}
