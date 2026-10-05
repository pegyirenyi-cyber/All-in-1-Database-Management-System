import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  StaffPayslip, 
  Teacher, 
  SchoolInfo, 
  AcademicYearType, 
  TermType, 
  TERMS, 
  ACADEMIC_YEARS,
  SchoolExpense 
} from '../../types';
import { DbController } from '../../db';
import { ThemeStyles } from '../ThemeWrapper';
import { triggerToast, getWatermarkHtml, formatIdentifiableFilename } from '../../utils';
import { generatePdfFromHtml, downloadBlobLocally } from '../../pdfHelper';
import { isGoogleAuthenticated, sendGmailMessage } from '../../googleDriveService';
import { 
  Banknote, Plus, Download, Printer, Search, Filter, 
  CheckCircle2, Clock, AlertTriangle, FileText, Send, 
  Trash2, Edit2, Sparkles, DollarSign, Building2, User, 
  CreditCard, ShieldCheck, Mail, ArrowRight, Eye, RefreshCw,
  Check, X, ChevronRight, FileSpreadsheet
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  theme: ThemeStyles;
  schoolInfo: SchoolInfo;
  selectedAcademicYear: AcademicYearType;
  selectedTerm: TermType;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Base salary recommendations by GES Teacher Rank
const DEFAULT_SALARY_BY_RANK: Record<string, number> = {
  'Director II': 5200,
  'Deputy Director': 4600,
  'Assistant Director I': 4100,
  'Assistant Director II': 3600,
  'Principal Superintendent': 3200,
  'Senior Superintendent I': 2800,
  'Senior Superintendent II': 2400,
  'Superintendent I': 2100,
  'Superintendent II': 1900,
  'Teacher': 2400,
  'Support Staff': 1600
};

// Ghanaian Currency Words Helper
function numberToGhanaianWords(amount: number): string {
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  function convertGroup(num: number): string {
    let groupStr = '';
    if (num >= 100) {
      groupStr += units[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }
    if (num >= 20) {
      groupStr += tens[Math.floor(num / 10)] + (num % 10 > 0 ? '-' + units[num % 10] : '') + ' ';
    } else if (num > 0) {
      groupStr += units[num] + ' ';
    }
    return groupStr;
  }

  const integerPart = Math.floor(Math.abs(amount));
  const pesewas = Math.round((Math.abs(amount) - integerPart) * 100);

  if (integerPart === 0 && pesewas === 0) return 'Zero Ghana Cedis Only';

  let result = '';
  if (integerPart >= 1000000) {
    result += convertGroup(Math.floor(integerPart / 1000000)) + 'Million ';
  }
  const thousands = Math.floor((integerPart % 1000000) / 1000);
  if (thousands > 0) {
    result += convertGroup(thousands) + 'Thousand ';
  }
  const remainder = integerPart % 1000;
  if (remainder > 0) {
    result += convertGroup(remainder);
  }

  result = result.trim() + ' Ghana Cedis';
  if (pesewas > 0) {
    result += ` and ${convertGroup(pesewas).trim()} Pesewas`;
  }
  return result + ' Only';
}

// Calculate standard Ghanaian statutory PAYE & SSNIT Tier 1 (5.5%)
function calculateStatutoryDeductions(basicSalary: number, grossSalary: number) {
  const ssnitTier1 = Number((basicSalary * 0.055).toFixed(2)); // 5.5% employee SSNIT
  const employerSsnit = Number((basicSalary * 0.13).toFixed(2)); // 13.0% employer SSNIT
  
  // Taxable income = Gross - Employee SSNIT
  const taxableIncome = Math.max(0, grossSalary - ssnitTier1);
  
  // Standard Ghana GRA PAYE Graduated Brackets (Simplified approx)
  let paye = 0;
  if (taxableIncome > 490) {
    const rem = taxableIncome - 490;
    if (rem <= 110) paye = rem * 0.05;
    else if (rem <= 240) paye = (110 * 0.05) + ((rem - 110) * 0.10);
    else if (rem <= 3240) paye = (110 * 0.05) + (130 * 0.10) + ((rem - 240) * 0.175);
    else paye = (110 * 0.05) + (130 * 0.10) + (3000 * 0.175) + ((rem - 3240) * 0.25);
  }

  return {
    ssnitTier1,
    employerSsnit,
    payeTax: Number(paye.toFixed(2))
  };
}

export default function StaffPayslipsTab({
  theme,
  schoolInfo,
  selectedAcademicYear,
  selectedTerm
}: Props) {
  const [payslips, setPayslips] = useState<StaffPayslip[]>(() => DbController.getStaffPayslips());
  const [teachers, setTeachers] = useState<Teacher[]>(() => DbController.getTeachers());

  // Filters
  const currentMonthYear = useMemo(() => {
    const d = new Date();
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return localStorage.getItem('sms_payslips_month') || currentMonthYear;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Draft' | 'Approved' | 'Disbursed' | 'Paid'>('All');
  const [roleFilter, setRoleFilter] = useState<string>('All');

  // Modals
  const [activePayslipModal, setActivePayslipModal] = useState<StaffPayslip | null>(null);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPayslip, setEditingPayslip] = useState<Partial<StaffPayslip> | null>(null);
  const [isDisbursing, setIsDisbursing] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailOverride, setEmailOverride] = useState('');

  // Batch generator state
  const [batchMonth, setBatchMonth] = useState(selectedMonth);
  const [batchSelectedStaffIds, setBatchSelectedStaffIds] = useState<string[]>([]);
  const [batchWelfareDues, setBatchWelfareDues] = useState<number>(50);
  const [batchTransportAllowance, setBatchTransportAllowance] = useState<number>(150);

  const refreshData = () => {
    setPayslips([...DbController.getStaffPayslips()]);
    setTeachers([...DbController.getTeachers()]);
  };

  useEffect(() => {
    localStorage.setItem('sms_payslips_month', selectedMonth);
  }, [selectedMonth]);

  // Filtered payslips
  const filteredPayslips = useMemo(() => {
    return payslips.filter(p => {
      const matchesMonth = selectedMonth === 'All Months' || p.month === selectedMonth;
      const matchesSession = p.academicYear === selectedAcademicYear && p.term === selectedTerm;
      const matchesSearch = 
        p.staffName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.staffId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.staffRole && p.staffRole.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.staffSsnitNumber && p.staffSsnitNumber.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus = statusFilter === 'All' || p.paymentStatus === statusFilter;
      const matchesRole = roleFilter === 'All' || p.staffRole === roleFilter;

      return matchesMonth && matchesSession && matchesSearch && matchesStatus && matchesRole;
    });
  }, [payslips, selectedMonth, selectedAcademicYear, selectedTerm, searchQuery, statusFilter, roleFilter]);

  // Available unique roles for filtering
  const availableRoles = useMemo(() => {
    const roles = new Set<string>();
    teachers.forEach(t => {
      if (t.rank) roles.add(t.rank);
      if (t.isClassTeacher) roles.add('Class Teacher');
    });
    payslips.forEach(p => {
      if (p.staffRole) roles.add(p.staffRole);
    });
    return Array.from(roles);
  }, [teachers, payslips]);

  // KPI Calculations
  const stats = useMemo(() => {
    const totalNet = filteredPayslips.reduce((s, p) => s + (p.netSalary || 0), 0);
    const totalGross = filteredPayslips.reduce((s, p) => s + (p.grossSalary || 0), 0);
    const totalBasic = filteredPayslips.reduce((s, p) => s + (p.basicSalary || 0), 0);
    const totalAllowances = filteredPayslips.reduce((s, p) => s + (p.grossSalary - p.basicSalary || 0), 0);
    const totalSsnit = filteredPayslips.reduce((s, p) => s + (p.ssnitTier1 || 0), 0);
    const totalPaye = filteredPayslips.reduce((s, p) => s + (p.payeTax || 0), 0);
    const totalEmployerSsnit = filteredPayslips.reduce((s, p) => s + (p.employerSsnitTier1 || 0), 0);
    const paidCount = filteredPayslips.filter(p => p.paymentStatus === 'Paid' || p.paymentStatus === 'Disbursed').length;

    return {
      totalNet,
      totalGross,
      totalBasic,
      totalAllowances,
      totalSsnit,
      totalPaye,
      totalEmployerSsnit,
      totalStaff: filteredPayslips.length,
      paidCount,
      rate: filteredPayslips.length > 0 ? Math.round((paidCount / filteredPayslips.length) * 100) : 0
    };
  }, [filteredPayslips]);

  // Handle single payslip creation / update
  const handleSavePayslip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayslip || !editingPayslip.staffName || !editingPayslip.basicSalary) {
      triggerToast('Please provide staff details and basic salary.', 'error');
      return;
    }

    const basic = Number(editingPayslip.basicSalary) || 0;
    const transport = Number(editingPayslip.transportAllowance) || 0;
    const resp = Number(editingPayslip.responsibilityAllowance) || 0;
    const overtime = Number(editingPayslip.overtimeAllowance) || 0;
    const housing = Number(editingPayslip.housingAllowance) || 0;
    const otherAllow = Number(editingPayslip.otherAllowances) || 0;

    const gross = basic + transport + resp + overtime + housing + otherAllow;

    // Deductions
    const statutory = calculateStatutoryDeductions(basic, gross);
    const ssnit = editingPayslip.ssnitTier1 !== undefined ? Number(editingPayslip.ssnitTier1) : statutory.ssnitTier1;
    const paye = editingPayslip.payeTax !== undefined ? Number(editingPayslip.payeTax) : statutory.payeTax;
    const welfare = Number(editingPayslip.staffWelfare) || 0;
    const loan = Number(editingPayslip.loanRepayment) || 0;
    const pf = Number(editingPayslip.providentFund) || 0;
    const otherDed = Number(editingPayslip.otherDeductions) || 0;

    const totalDed = ssnit + paye + welfare + loan + pf + otherDed;
    const net = Math.max(0, gross - totalDed);

    const now = new Date().toISOString();
    const isNew = !editingPayslip.id;
    const id = editingPayslip.id || `payslip_${(editingPayslip.staffId || 'staff').replace(/[^a-zA-Z0-9]/g, '')}_${Date.now()}`;

    const finalPayslip: StaffPayslip = {
      id,
      staffId: editingPayslip.staffId || 'STAFF-001',
      staffName: editingPayslip.staffName.trim(),
      staffRole: editingPayslip.staffRole || 'Teacher',
      staffEmail: editingPayslip.staffEmail,
      staffPhone: editingPayslip.staffPhone,
      staffBankName: editingPayslip.staffBankName || 'GCB Bank',
      staffAccountNumber: editingPayslip.staffAccountNumber || '0000000000000',
      staffBankBranch: editingPayslip.staffBankBranch || 'Main Branch',
      staffSsnitNumber: editingPayslip.staffSsnitNumber || 'C000000000000',
      staffTin: editingPayslip.staffTin || 'P0000000000',
      month: editingPayslip.month || selectedMonth,
      paymentDate: editingPayslip.paymentDate || new Date().toISOString().split('T')[0],
      academicYear: editingPayslip.academicYear || selectedAcademicYear,
      term: editingPayslip.term || selectedTerm,
      basicSalary: basic,
      transportAllowance: transport,
      responsibilityAllowance: resp,
      overtimeAllowance: overtime,
      housingAllowance: housing,
      otherAllowances: otherAllow,
      otherAllowancesDescription: editingPayslip.otherAllowancesDescription,
      grossSalary: gross,
      ssnitTier1: ssnit,
      payeTax: paye,
      staffWelfare: welfare,
      loanRepayment: loan,
      providentFund: pf,
      otherDeductions: otherDed,
      otherDeductionsDescription: editingPayslip.otherDeductionsDescription,
      totalDeductions: totalDed,
      netSalary: net,
      employerSsnitTier1: statutory.employerSsnit,
      employerProvidentFund: Number(editingPayslip.employerProvidentFund) || 0,
      paymentMethod: editingPayslip.paymentMethod || 'Bank Transfer',
      momoNetwork: editingPayslip.momoNetwork || (editingPayslip.paymentMethod === 'Mobile Money' ? 'MTN MoMo' : undefined),
      momoNumber: editingPayslip.momoNumber || (editingPayslip.paymentMethod === 'Mobile Money' ? editingPayslip.staffPhone : undefined),
      momoAccountName: editingPayslip.momoAccountName || (editingPayslip.paymentMethod === 'Mobile Money' ? editingPayslip.staffName : undefined),
      chequeNumber: editingPayslip.chequeNumber,
      chequeBankName: editingPayslip.chequeBankName,
      chequeIssueDate: editingPayslip.chequeIssueDate,
      paymentStatus: editingPayslip.paymentStatus || 'Approved',
      voucherNumber: editingPayslip.voucherNumber || `PV-SAL-${(editingPayslip.month || selectedMonth).replace(/\s+/g, '').toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
      remarks: editingPayslip.remarks,
      preparedBy: editingPayslip.preparedBy || 'Accounts Officer',
      approvedBy: editingPayslip.approvedBy || 'Headteacher',
      createdAt: editingPayslip.createdAt || now,
      updatedAt: now
    };

    DbController.saveStaffPayslip(finalPayslip);
    refreshData();
    setIsEditModalOpen(false);
    setEditingPayslip(null);
    triggerToast(isNew ? `Created payslip for ${finalPayslip.staffName}` : `Updated payslip for ${finalPayslip.staffName}`, 'success');
  };

  // Open Batch Generator
  const openBatchGenerator = () => {
    setBatchMonth(selectedMonth === 'All Months' ? currentMonthYear : selectedMonth);
    setBatchSelectedStaffIds(teachers.map(t => t.id));
    setIsBatchModalOpen(true);
  };

  // Run Batch Generation
  const handleGenerateBatchPayroll = () => {
    if (batchSelectedStaffIds.length === 0) {
      triggerToast('Please select at least one staff member to generate payslips for.', 'error');
      return;
    }

    const targetTeachers = teachers.filter(t => batchSelectedStaffIds.includes(t.id));
    const newSlips: StaffPayslip[] = [];
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    targetTeachers.forEach(teacher => {
      const staffName = `${teacher.firstName} ${teacher.lastName}`.trim();
      const role = teacher.rank || (teacher.isClassTeacher ? 'Class Teacher' : 'Teacher');
      const baseSalary = DEFAULT_SALARY_BY_RANK[teacher.rank] || (teacher.isClassTeacher ? 2600 : 2400);
      const respAllowance = teacher.isClassTeacher ? 200 : (teacher.assignedClasses && teacher.assignedClasses.length > 1 ? 150 : 0);
      const transport = batchTransportAllowance;
      const gross = baseSalary + respAllowance + transport;

      const statutory = calculateStatutoryDeductions(baseSalary, gross);
      const welfare = batchWelfareDues;
      const totalDed = statutory.ssnitTier1 + statutory.payeTax + welfare;
      const net = Math.max(0, gross - totalDed);

      const id = `payslip_${teacher.id || teacher.staffId || Math.random().toString(36).substr(2, 6)}_${batchMonth.replace(/\s+/g, '_')}`;

      const payslip: StaffPayslip = {
        id,
        staffId: teacher.staffId || teacher.id || 'TCH-' + Math.floor(100 + Math.random() * 900),
        staffName,
        staffRole: `${role} ${teacher.assignedClass && teacher.assignedClass !== 'None' ? `(${teacher.assignedClass})` : ''}`.trim(),
        staffEmail: teacher.email,
        staffPhone: teacher.phone,
        staffBankName: 'GCB Bank Ghana',
        staffAccountNumber: '10' + Math.floor(1000000000 + Math.random() * 9000000000),
        staffBankBranch: 'Commercial Branch',
        staffSsnitNumber: teacher.ssnitNumber || 'C' + Math.floor(10000000000 + Math.random() * 90000000000),
        staffTin: teacher.tinNumber || 'P' + Math.floor(100000000 + Math.random() * 900000000),
        month: batchMonth,
        paymentDate: today,
        academicYear: selectedAcademicYear,
        term: selectedTerm,
        basicSalary: baseSalary,
        transportAllowance: transport,
        responsibilityAllowance: respAllowance,
        overtimeAllowance: 0,
        housingAllowance: 0,
        otherAllowances: 0,
        grossSalary: gross,
        ssnitTier1: statutory.ssnitTier1,
        payeTax: statutory.payeTax,
        staffWelfare: welfare,
        loanRepayment: 0,
        providentFund: 0,
        otherDeductions: 0,
        totalDeductions: totalDed,
        netSalary: net,
        employerSsnitTier1: statutory.employerSsnit,
        employerProvidentFund: 0,
        paymentMethod: 'Bank Transfer',
        paymentStatus: 'Approved',
        voucherNumber: `PV-SAL-${batchMonth.replace(/\s+/g, '').toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
        remarks: 'Monthly staff salary generated via payroll batch engine.',
        preparedBy: 'Accounts Officer',
        approvedBy: 'Headteacher',
        createdAt: now,
        updatedAt: now
      };

      newSlips.push(payslip);
    });

    DbController.saveStaffPayslipsBatch(newSlips);
    refreshData();
    setIsBatchModalOpen(false);
    triggerToast(`Successfully generated ${newSlips.length} staff payslips for ${batchMonth}!`, 'success');
  };

  // Disburse Payroll & Write to Expenses Ledger
  const handleDisbursePayrollToExpenses = () => {
    const eligibleSlips = filteredPayslips.filter(p => p.paymentStatus !== 'Disbursed');
    if (eligibleSlips.length === 0) {
      triggerToast('All displayed payslips are already disbursed to the Expenses ledger.', 'info');
      return;
    }

    const totalNet = eligibleSlips.reduce((sum, p) => sum + (p.netSalary || 0), 0);
    const confirmMessage = `Disburse ${eligibleSlips.length} staff payslips totaling GH₵ ${totalNet.toLocaleString('en-US', { minimumFractionDigits: 2 })} and write official expenditure voucher into Finance Expenses ledger?`;
    
    if (!window.confirm(confirmMessage)) return;

    setIsDisbursing(true);
    try {
      const result = DbController.disbursePayrollToExpenses(
        eligibleSlips.map(p => p.id),
        { academicYear: selectedAcademicYear, term: selectedTerm, month: selectedMonth }
      );
      refreshData();
      triggerToast(`Disbursed GH₵ ${result.expense.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} to Expenses ledger (Voucher: ${result.expense.voucherNumber})!`, 'success');
    } catch (err: any) {
      console.error('Payroll disbursement error:', err);
      triggerToast(err.message || 'Failed to disburse payroll to expenses.', 'error');
    } finally {
      setIsDisbursing(false);
    }
  };

  // Delete Payslip
  const handleDeletePayslip = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete the payslip for "${name}"?`)) {
      DbController.deleteStaffPayslip(id);
      refreshData();
      triggerToast(`Deleted payslip for ${name}`, 'info');
    }
  };

  // Download PDF of Single Payslip
  const handleDownloadPayslipPdf = async (payslip: StaffPayslip) => {
    setIsGeneratingPdf(true);
    try {
      const filename = `Payslip_${payslip.staffId}_${payslip.month.replace(/\s+/g, '_')}.pdf`;
      const { blob } = await generatePdfFromHtml('payslip-official-document', filename, false);
      downloadBlobLocally(blob, filename);
      triggerToast(`Downloaded payslip for ${payslip.staffName}!`, 'success');
    } catch (err: any) {
      console.error('Error downloading payslip PDF:', err);
      triggerToast('Failed to download PDF. Please use the Print button as fallback.', 'error');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Print Payslip
  const handlePrintPayslip = () => {
    if (typeof (window as any).printTarget === 'function') {
      (window as any).printTarget(
        'payslip-official-document',
        `Staff Payslip - ${activePayslipModal?.staffName} (${activePayslipModal?.month})`,
        false
      );
    } else {
      window.print();
    }
  };

  // Email Payslip to Staff Member
  const handleSendEmail = async (payslip: StaffPayslip) => {
    const targetEmail = emailOverride.trim() || payslip.staffEmail;
    if (!targetEmail) {
      triggerToast('Please provide a valid staff email address.', 'error');
      return;
    }

    setIsSendingEmail(true);
    try {
      const emailBody = `
Dear ${payslip.staffName},

Your official salary payslip for the month of ${payslip.month} (${payslip.academicYear} ${payslip.term}) has been processed and disbursed by ${schoolInfo.name || 'School Management'}.

--- SUMMARY OF SALARY PAYSLIP ---
Staff ID: ${payslip.staffId}
Designation: ${payslip.staffRole}
Voucher No: ${payslip.voucherNumber || 'N/A'}
Payment Date: ${payslip.paymentDate}

Basic Salary: GH₵ ${payslip.basicSalary.toFixed(2)}
Total Allowances: GH₵ ${(payslip.grossSalary - payslip.basicSalary).toFixed(2)}
Gross Earnings: GH₵ ${payslip.grossSalary.toFixed(2)}

Total Deductions (SSNIT, PAYE, Welfare): GH₵ ${payslip.totalDeductions.toFixed(2)}
NET TAKE-HOME PAY: GH₵ ${payslip.netSalary.toFixed(2)}
(${numberToGhanaianWords(payslip.netSalary)})

Bank / Account: ${payslip.staffBankName || 'Bank'} - ${payslip.staffAccountNumber || 'N/A'}

This is an authorized institutional document. For inquiries, contact the Finance / Accounts Office.

Warm regards,
${schoolInfo.name || 'School Administration'}
      `.trim();

      const success = await sendGmailMessage(
        targetEmail,
        `Salary Payslip - ${payslip.month} - ${payslip.staffName} (${schoolInfo.name || 'School'})`,
        emailBody
      );

      if (success) {
        triggerToast(`Payslip emailed successfully to ${targetEmail}!`, 'success');
      } else {
        triggerToast('Could not send email via Google Workspace. Please verify your connection in settings.', 'error');
      }
    } catch (err: any) {
      console.error('Email error:', err);
      triggerToast(err.message || 'Failed to send email.', 'error');
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Export Bank Schedule to CSV
  const handleExportBankScheduleCSV = () => {
    if (filteredPayslips.length === 0) {
      triggerToast('No payslips to export.', 'info');
      return;
    }

    let csv = `STAFF SALARY BANK TRANSMISSION SCHEDULE\n`;
    csv += `Institution:,"${schoolInfo.name || 'School'}"\n`;
    csv += `Period:,"${selectedMonth} (${selectedAcademicYear} ${selectedTerm})"\n\n`;
    csv += `Staff ID,Staff Name,Designation,Bank Name,Account Number,Branch,SSNIT No,TIN No,Gross Pay (GHS),Total Deductions (GHS),Net Salary (GHS),Payment Method,Status\n`;

    filteredPayslips.forEach(p => {
      csv += `"${p.staffId}","${p.staffName}","${p.staffRole}","${p.staffBankName || ''}","${p.staffAccountNumber || ''}","${p.staffBankBranch || ''}","${p.staffSsnitNumber || ''}","${p.staffTin || ''}",${p.grossSalary.toFixed(2)},${p.totalDeductions.toFixed(2)},${p.netSalary.toFixed(2)},"${p.paymentMethod}","${p.paymentStatus}"\n`;
    });

    csv += `\nTOTALS,,,,,,,,${stats.totalGross.toFixed(2)},${(stats.totalGross - stats.totalNet).toFixed(2)},${stats.totalNet.toFixed(2)},,\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const filename = `Bank_Salary_Schedule_${selectedMonth.replace(/\s+/g, '_')}.csv`;
    downloadBlobLocally(blob, filename);
    triggerToast(`Exported bank transmission schedule for ${selectedMonth}!`, 'success');
  };

  return (
    <div className="space-y-6 text-left">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-md border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-400 text-slate-950 uppercase tracking-wider">
              Finance &amp; Payroll Office
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-slate-300 text-xs font-medium">{selectedAcademicYear} • {selectedTerm}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2.5">
            <Banknote className="text-emerald-400" size={26} />
            <span>Staff Payslips &amp; Payroll</span>
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl mt-1 leading-relaxed">
            Generate, approve, and disburse official Ghanaian staff payslips with statutory SSNIT (5.5% / 13%), PAYE tax, allowances, and automatic ledger synchronization with the school Expenses ledger.
          </p>
        </div>

        {/* Top Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleExportBankScheduleCSV}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            title="Export bank transmission schedule"
          >
            <Download size={14} />
            <span>Bank CSV Schedule</span>
          </button>

          <button
            type="button"
            onClick={openBatchGenerator}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs transition flex items-center gap-1.5 shadow-md shadow-indigo-600/30 cursor-pointer active:scale-95"
            title="Generate monthly payroll batch for all teachers"
          >
            <Sparkles size={14} className="text-amber-300" />
            <span>Generate Monthly Payroll</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingPayslip({
                month: selectedMonth === 'All Months' ? currentMonthYear : selectedMonth,
                paymentDate: new Date().toISOString().split('T')[0],
                academicYear: selectedAcademicYear,
                term: selectedTerm,
                basicSalary: 2500,
                transportAllowance: 150,
                responsibilityAllowance: 0,
                staffWelfare: 50,
                paymentMethod: 'Bank Transfer',
                paymentStatus: 'Approved'
              });
              setIsEditModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-600/30 cursor-pointer active:scale-95"
            title="Create an individual custom staff payslip"
          >
            <Plus size={15} className="stroke-[2.5]" />
            <span>New Payslip</span>
          </button>

          <button
            type="button"
            onClick={handleDisbursePayrollToExpenses}
            disabled={isDisbursing || filteredPayslips.length === 0}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs transition flex items-center gap-1.5 shadow-md shadow-rose-600/30 cursor-pointer active:scale-95 disabled:opacity-50"
            title="Disburse payroll and write official expense voucher into Expenses ledger"
          >
            <ShieldCheck size={15} />
            <span>{isDisbursing ? 'Disbursing...' : 'Disburse to Expenses'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider font-mono">
            <span>Net Monthly Payroll</span>
            <DollarSign size={16} className="text-emerald-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
            GH₵ {stats.totalNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500 font-medium">
            Total take-home salary across {stats.totalStaff} staff
          </p>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider font-mono">
            <span>Gross Earnings</span>
            <Building2 size={16} className="text-indigo-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
            GH₵ {stats.totalGross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500 font-medium">
            Base: GH₵ {stats.totalBasic.toLocaleString()} • Allowances: GH₵ {stats.totalAllowances.toLocaleString()}
          </p>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider font-mono">
            <span>Statutory Taxes (SSNIT + PAYE)</span>
            <ShieldCheck size={16} className="text-amber-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
            GH₵ {(stats.totalSsnit + stats.totalPaye).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500 font-medium">
            SSNIT: GH₵ {stats.totalSsnit.toFixed(0)} • PAYE: GH₵ {stats.totalPaye.toFixed(0)} • Employer: GH₵ {stats.totalEmployerSsnit.toFixed(0)}
          </p>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider font-mono">
            <span>Disbursement Progress</span>
            <CheckCircle2 size={16} className="text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
              {stats.paidCount} / {stats.totalStaff}
            </p>
            <span className="text-xs font-bold text-emerald-600 font-mono">
              ({stats.rate}%)
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${stats.rate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search staff name, ID, SSNIT..."
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
          </div>

          {/* Month Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase font-mono">Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="All Months">All Months (Entire Session)</option>
              {MONTH_NAMES.map(m => {
                const optVal = `${m} 2026`;
                return <option key={optVal} value={optVal}>{optVal}</option>;
              })}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase font-mono">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Disbursed">Disbursed (In Expenses)</option>
              <option value="Approved">Approved</option>
              <option value="Paid">Paid</option>
              <option value="Draft">Draft</option>
            </select>
          </div>

          {/* Role Filter */}
          {availableRoles.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase font-mono">Role:</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
              >
                <option value="All">All Ranks &amp; Roles</option>
                {availableRoles.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 font-mono">
            Showing {filteredPayslips.length} payslips
          </span>
        </div>
      </div>

      {/* Main Payslips Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {filteredPayslips.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto">
              <Banknote size={32} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800">No Staff Payslips Found for {selectedMonth}</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                You can auto-generate monthly payroll payslips for all registered teachers and staff with one click using the batch engine.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={openBatchGenerator}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-md transition cursor-pointer"
              >
                <Sparkles size={14} className="inline mr-1.5 text-amber-300" />
                <span>Generate Batch Payroll for {selectedMonth === 'All Months' ? currentMonthYear : selectedMonth}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase font-mono tracking-wider">
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-3">Designation / Role</th>
                  <th className="py-3 px-3">Bank / MoMo Account</th>
                  <th className="py-3 px-3 text-right">Basic Pay</th>
                  <th className="py-3 px-3 text-right">Allowances</th>
                  <th className="py-3 px-3 text-right">Gross Pay</th>
                  <th className="py-3 px-3 text-right">Deductions</th>
                  <th className="py-3 px-3 text-right">Net Take-Home</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayslips.map((ps) => {
                  const isDisbursed = ps.paymentStatus === 'Disbursed' || ps.paymentStatus === 'Paid';
                  return (
                    <tr key={ps.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0">
                            {ps.staffName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{ps.staffName}</span>
                            <span className="text-[10px] text-slate-400 font-mono">ID: {ps.staffId}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-medium text-slate-700 block">{ps.staffRole}</span>
                        {ps.staffSsnitNumber && (
                          <span className="text-[10px] text-slate-400 font-mono">SSNIT: {ps.staffSsnitNumber}</span>
                        )}
                      </td>

                      <td className="py-3 px-3 font-mono text-[11px]">
                        <span className="font-semibold text-slate-800 block">{ps.staffBankName || 'Bank Transfer'}</span>
                        <span className="text-[10px] text-slate-400">{ps.staffAccountNumber || 'N/A'}</span>
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-medium text-slate-700">
                        GH₵ {ps.basicSalary.toFixed(2)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-emerald-600 font-medium">
                        +GH₵ {(ps.grossSalary - ps.basicSalary).toFixed(2)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        GH₵ {ps.grossSalary.toFixed(2)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-rose-600 font-medium">
                        -GH₵ {ps.totalDeductions.toFixed(2)}
                        <span className="block text-[9px] text-slate-400 font-sans">
                          (SSNIT {ps.ssnitTier1.toFixed(0)} • TAX {ps.payeTax.toFixed(0)})
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-black text-sm text-emerald-700 bg-emerald-50/40">
                        GH₵ {ps.netSalary.toFixed(2)}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                          isDisbursed
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : ps.paymentStatus === 'Approved'
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {isDisbursed ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                          <span>{ps.paymentStatus}</span>
                        </span>
                        {ps.voucherNumber && (
                          <span className="block text-[9px] text-slate-400 font-mono mt-0.5">
                            {ps.voucherNumber}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setActivePayslipModal(ps);
                              setEmailOverride(ps.staffEmail || '');
                            }}
                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition cursor-pointer"
                            title="View Official Payslip & Download PDF"
                          >
                            <Eye size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingPayslip({ ...ps });
                              setIsEditModalOpen(true);
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                            title="Edit Payslip Details"
                          >
                            <Edit2 size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeletePayslip(ps.id, ps.staffName)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition cursor-pointer"
                            title="Delete Payslip"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: OFFICIAL PRINTABLE & DOWNLOADABLE PAYSLIP PREVIEW               */}
      {/* ========================================================================= */}
      {activePayslipModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[500] p-3 sm:p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]"
          >
            {/* Modal Header & Quick Actions */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 no-print">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                  <Banknote size={20} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    Official Salary Payslip
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {activePayslipModal.month} • Ref: {activePayslipModal.voucherNumber || activePayslipModal.id}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadPayslipPdf(activePayslipModal)}
                  disabled={isGeneratingPdf}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                  title="Download clean A4 PDF of this payslip"
                >
                  <Download size={14} />
                  <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintPayslip}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  title="Print this payslip"
                >
                  <Printer size={14} />
                  <span>Print</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActivePayslipModal(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Email Dispatch Ribbon (no-print) */}
            <div className="px-5 py-2.5 bg-indigo-50/60 border-b border-indigo-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-xs no-print">
              <div className="flex items-center gap-2 text-indigo-900 font-medium">
                <Mail size={15} className="text-indigo-600 shrink-0" />
                <span>Send copy directly to staff email:</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={emailOverride}
                  onChange={(e) => setEmailOverride(e.target.value)}
                  placeholder="staff@domain.com"
                  className="px-3 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-w-[220px]"
                />
                <button
                  type="button"
                  onClick={() => handleSendEmail(activePayslipModal)}
                  disabled={isSendingEmail}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Send size={12} />
                  <span>{isSendingEmail ? 'Sending...' : 'Email'}</span>
                </button>
              </div>
            </div>

            {/* Printable Payslip Body Document */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-slate-900 bg-white" id="payslip-official-document">
              {/* Institution Header */}
              <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  {schoolInfo.logoUrl ? (
                    <img src={schoolInfo.logoUrl} alt="Logo" className="w-16 h-16 object-contain rounded-xl" />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-indigo-900 text-white flex items-center justify-center font-black text-2xl shadow-sm">
                      {(schoolInfo.name || 'S').substring(0, 1)}
                    </div>
                  )}
                  <div>
                    <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight text-slate-900 leading-tight">
                      {schoolInfo.name || 'GHANA EDUCATION SERVICE INSTITUTION'}
                    </h1>
                    <p className="text-xs text-slate-600 font-medium">
                      {schoolInfo.gpsAddress || 'P.O. Box GP 1024, Accra, Ghana'} • Tel: {schoolInfo.telephone || '+233 24 000 0000'}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      District: {schoolInfo.district || 'GES District'} • Circuit: {schoolInfo.circuit || 'Central Circuit'}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="px-3 py-1 bg-slate-900 text-white text-[11px] font-mono font-black uppercase rounded-lg tracking-wider block">
                    SALARY PAYSLIP
                  </span>
                  <span className="text-xs font-bold text-slate-800 block mt-1 font-mono">
                    {activePayslipModal.month}
                  </span>
                  <span className="text-[10px] text-slate-500 block font-mono">
                    {activePayslipModal.academicYear} • {activePayslipModal.term}
                  </span>
                </div>
              </div>

              {/* Employee Particulars Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Employee Name</span>
                  <span className="font-black text-slate-900 block">{activePayslipModal.staffName}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Staff ID</span>
                  <span className="font-bold text-slate-900 font-mono block">{activePayslipModal.staffId}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Designation / Role</span>
                  <span className="font-bold text-slate-900 block">{activePayslipModal.staffRole}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">SSNIT Number</span>
                  <span className="font-bold text-slate-900 font-mono block">{activePayslipModal.staffSsnitNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Payment Mode</span>
                  <span className="font-bold text-slate-900 block">
                    {activePayslipModal.paymentMethod === 'Mobile Money' 
                      ? `MoMo (${activePayslipModal.momoNetwork || 'MTN MoMo'})`
                      : activePayslipModal.paymentMethod === 'Cash'
                      ? 'Cash Disbursement'
                      : activePayslipModal.paymentMethod === 'Cheque'
                      ? 'Bank Cheque'
                      : 'Bank Transfer'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">
                    {activePayslipModal.paymentMethod === 'Mobile Money' 
                      ? 'MoMo Account / Number' 
                      : activePayslipModal.paymentMethod === 'Cheque'
                      ? 'Cheque / Bank Details'
                      : activePayslipModal.paymentMethod === 'Cash'
                      ? 'Cash Voucher / Ref'
                      : 'Bank & Account No'}
                  </span>
                  <span className="font-bold text-slate-800 font-mono block">
                    {activePayslipModal.paymentMethod === 'Mobile Money'
                      ? `${activePayslipModal.momoNumber || activePayslipModal.staffPhone || 'N/A'}${activePayslipModal.momoAccountName ? ` (${activePayslipModal.momoAccountName})` : ''}`
                      : activePayslipModal.paymentMethod === 'Cheque'
                      ? `${activePayslipModal.chequeNumber ? `CHQ #${activePayslipModal.chequeNumber}` : 'Cheque'} - ${activePayslipModal.chequeBankName || activePayslipModal.staffBankName || 'Bank'}`
                      : activePayslipModal.paymentMethod === 'Cash'
                      ? `Direct Cash • ${activePayslipModal.voucherNumber || 'Paid'}`
                      : `${activePayslipModal.staffBankName || 'Bank'} • ${activePayslipModal.staffAccountNumber || 'N/A'}`}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Payment Date</span>
                  <span className="font-semibold text-slate-800 font-mono block">{activePayslipModal.paymentDate}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Voucher No</span>
                  <span className="font-bold text-indigo-700 font-mono block">{activePayslipModal.voucherNumber || activePayslipModal.id}</span>
                </div>
              </div>

              {/* Side-by-Side Earnings & Deductions Tables */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Earnings Table */}
                <div className="border border-slate-300 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-300 font-black uppercase text-[11px] text-slate-800 font-mono flex items-center justify-between">
                    <span>1. Earnings &amp; Allowances</span>
                    <span>Amount (GH₵)</span>
                  </div>
                  <table className="w-full">
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="p-2.5 font-medium text-slate-700">Basic Salary</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                          GH₵ {activePayslipModal.basicSalary.toFixed(2)}
                        </td>
                      </tr>
                      {activePayslipModal.transportAllowance > 0 && (
                        <tr>
                          <td className="p-2.5 text-slate-600">Transport / Commute Allowance</td>
                          <td className="p-2.5 text-right font-mono text-slate-800">
                            GH₵ {activePayslipModal.transportAllowance.toFixed(2)}
                          </td>
                        </tr>
                      )}
                      {activePayslipModal.responsibilityAllowance > 0 && (
                        <tr>
                          <td className="p-2.5 text-slate-600">Class Teacher / Head Responsibility</td>
                          <td className="p-2.5 text-right font-mono text-slate-800">
                            GH₵ {activePayslipModal.responsibilityAllowance.toFixed(2)}
                          </td>
                        </tr>
                      )}
                      {activePayslipModal.overtimeAllowance > 0 && (
                        <tr>
                          <td className="p-2.5 text-slate-600">Overtime &amp; Extra-Curricular</td>
                          <td className="p-2.5 text-right font-mono text-slate-800">
                            GH₵ {activePayslipModal.overtimeAllowance.toFixed(2)}
                          </td>
                        </tr>
                      )}
                      {activePayslipModal.housingAllowance > 0 && (
                        <tr>
                          <td className="p-2.5 text-slate-600">Housing / Rent Subsidy</td>
                          <td className="p-2.5 text-right font-mono text-slate-800">
                            GH₵ {activePayslipModal.housingAllowance.toFixed(2)}
                          </td>
                        </tr>
                      )}
                      {activePayslipModal.otherAllowances > 0 && (
                        <tr>
                          <td className="p-2.5 text-slate-600">
                            {activePayslipModal.otherAllowancesDescription || 'Other Approved Allowances'}
                          </td>
                          <td className="p-2.5 text-right font-mono text-slate-800">
                            GH₵ {activePayslipModal.otherAllowances.toFixed(2)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-black border-t border-slate-300 text-slate-900">
                        <td className="p-2.5 uppercase font-mono">TOTAL GROSS EARNINGS:</td>
                        <td className="p-2.5 text-right font-mono text-sm">
                          GH₵ {activePayslipModal.grossSalary.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Deductions Table */}
                <div className="border border-slate-300 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-300 font-black uppercase text-[11px] text-slate-800 font-mono flex items-center justify-between">
                    <span>2. Deductions &amp; Taxes</span>
                    <span>Amount (GH₵)</span>
                  </div>
                  <table className="w-full">
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="p-2.5 font-medium text-slate-700">SSNIT Tier 1 (5.5% Employee)</td>
                        <td className="p-2.5 text-right font-mono text-rose-600 font-semibold">
                          GH₵ {activePayslipModal.ssnitTier1.toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-medium text-slate-700">PAYE Income Tax</td>
                        <td className="p-2.5 text-right font-mono text-rose-600 font-semibold">
                          GH₵ {activePayslipModal.payeTax.toFixed(2)}
                        </td>
                      </tr>
                      {activePayslipModal.staffWelfare > 0 && (
                        <tr>
                          <td className="p-2.5 text-slate-600">Staff Welfare Fund Dues</td>
                          <td className="p-2.5 text-right font-mono text-slate-800">
                            GH₵ {activePayslipModal.staffWelfare.toFixed(2)}
                          </td>
                        </tr>
                      )}
                      {activePayslipModal.loanRepayment > 0 && (
                        <tr>
                          <td className="p-2.5 text-slate-600">Staff Loan Repayment</td>
                          <td className="p-2.5 text-right font-mono text-slate-800">
                            GH₵ {activePayslipModal.loanRepayment.toFixed(2)}
                          </td>
                        </tr>
                      )}
                      {activePayslipModal.providentFund > 0 && (
                        <tr>
                          <td className="p-2.5 text-slate-600">Provident Fund (Tier 3)</td>
                          <td className="p-2.5 text-right font-mono text-slate-800">
                            GH₵ {activePayslipModal.providentFund.toFixed(2)}
                          </td>
                        </tr>
                      )}
                      {activePayslipModal.otherDeductions > 0 && (
                        <tr>
                          <td className="p-2.5 text-slate-600">
                            {activePayslipModal.otherDeductionsDescription || 'Other Deductions'}
                          </td>
                          <td className="p-2.5 text-right font-mono text-slate-800">
                            GH₵ {activePayslipModal.otherDeductions.toFixed(2)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-black border-t border-slate-300 text-rose-700">
                        <td className="p-2.5 uppercase font-mono">TOTAL DEDUCTIONS:</td>
                        <td className="p-2.5 text-right font-mono text-sm">
                          -GH₵ {activePayslipModal.totalDeductions.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Net Take-Home Highlight Banner */}
              <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-emerald-950 text-white p-5 rounded-2xl border border-emerald-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-300 block">
                    NET SALARY PAYABLE (TAKE-HOME)
                  </span>
                  <p className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white mt-0.5">
                    GH₵ {activePayslipModal.netSalary.toFixed(2)}
                  </p>
                  <p className="text-xs text-emerald-100/90 italic mt-1 font-medium">
                    {numberToGhanaianWords(activePayslipModal.netSalary)}
                  </p>
                </div>

                <div className="text-right bg-white/10 p-3 rounded-xl backdrop-blur-xs border border-white/10 shrink-0">
                  <span className="text-[10px] font-mono text-slate-300 uppercase block">Payment Status</span>
                  <span className="text-xs font-black text-emerald-400 font-mono uppercase block">
                    {activePayslipModal.paymentStatus} • {activePayslipModal.paymentMethod}
                  </span>
                </div>
              </div>

              {/* Employer Statutory Contributions Audit */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex flex-col sm:flex-row items-center justify-between gap-2 text-slate-600">
                <span className="font-bold text-slate-800">Employer Statutory Remittances (Non-Deductible from Staff):</span>
                <div className="flex items-center gap-4 font-mono font-bold text-slate-700">
                  <span>SSNIT Employer (13%): GH₵ {activePayslipModal.employerSsnitTier1.toFixed(2)}</span>
                  <span>•</span>
                  <span>Total SSNIT (18.5%): GH₵ {(activePayslipModal.ssnitTier1 + activePayslipModal.employerSsnitTier1).toFixed(2)}</span>
                </div>
              </div>

              {/* Verification & Signatures */}
              <div className="pt-6 border-t-2 border-slate-900 grid grid-cols-3 gap-6 text-center text-xs">
                <div>
                  <div className="border-b border-slate-900 pb-8 mb-1.5"></div>
                  <p className="font-black text-slate-900 uppercase">Prepared By</p>
                  <p className="text-[10px] text-slate-500">Accounts Officer / Bursar</p>
                </div>

                <div>
                  <div className="border-b border-slate-900 pb-8 mb-1.5"></div>
                  <p className="font-black text-slate-900 uppercase">Approved By</p>
                  <p className="text-[10px] text-slate-500">Head of Institution / Stamp</p>
                </div>

                <div>
                  <div className="border-b border-slate-900 pb-8 mb-1.5"></div>
                  <p className="font-black text-slate-900 uppercase">Employee Acknowledgment</p>
                  <p className="text-[10px] text-slate-500">Signature &amp; Date</p>
                </div>
              </div>

              {/* Bottom Security Footer */}
              <div className="pt-2 flex items-center justify-between text-[10px] text-slate-400 font-mono border-t border-slate-200">
                <span>System Security Hash: {activePayslipModal.id}</span>
                <span>Generated: {new Date(activePayslipModal.updatedAt).toLocaleString()}</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: BATCH PAYROLL GENERATOR                                         */}
      {/* ========================================================================= */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[500] p-3 sm:p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
          >
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/60 via-slate-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
                  <Sparkles size={20} className="text-amber-300" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Generate Monthly Staff Payroll Batch
                  </h3>
                  <p className="text-xs text-slate-500">
                    Auto-calculates salaries, statutory Ghanaian SSNIT (5.5%), and PAYE tax for teachers
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsBatchModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase font-mono text-slate-700 mb-1.5">
                    Payroll Month *
                  </label>
                  <select
                    value={batchMonth}
                    onChange={(e) => setBatchMonth(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    {MONTH_NAMES.map(m => {
                      const opt = `${m} 2026`;
                      return <option key={opt} value={opt}>{opt}</option>;
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase font-mono text-slate-700 mb-1.5">
                    Default Transport Allowance (GH₵)
                  </label>
                  <input
                    type="number"
                    value={batchTransportAllowance}
                    onChange={(e) => setBatchTransportAllowance(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase font-mono text-slate-700 mb-1.5">
                    Default Staff Welfare Dues (GH₵)
                  </label>
                  <input
                    type="number"
                    value={batchWelfareDues}
                    onChange={(e) => setBatchWelfareDues(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase font-mono text-slate-700 mb-1.5">
                    Session &amp; Term
                  </label>
                  <div className="px-3.5 py-2.5 bg-slate-100 rounded-xl font-mono font-bold text-slate-700">
                    {selectedAcademicYear} • {selectedTerm}
                  </div>
                </div>
              </div>

              {/* Staff Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black uppercase font-mono text-slate-700">
                    Select Staff Members ({batchSelectedStaffIds.length} / {teachers.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (batchSelectedStaffIds.length === teachers.length) {
                        setBatchSelectedStaffIds([]);
                      } else {
                        setBatchSelectedStaffIds(teachers.map(t => t.id));
                      }
                    }}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                  >
                    {batchSelectedStaffIds.length === teachers.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100 bg-slate-50/50 p-1">
                  {teachers.map(t => {
                    const isSelected = batchSelectedStaffIds.includes(t.id);
                    const base = DEFAULT_SALARY_BY_RANK[t.rank] || 2400;
                    return (
                      <label key={t.id} className="p-2.5 flex items-center justify-between hover:bg-indigo-50/60 rounded-xl transition cursor-pointer">
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              if (isSelected) {
                                setBatchSelectedStaffIds(batchSelectedStaffIds.filter(id => id !== t.id));
                              } else {
                                setBatchSelectedStaffIds([...batchSelectedStaffIds, t.id]);
                              }
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                          />
                          <div>
                            <span className="font-bold text-slate-900 block">{t.firstName} {t.lastName}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{t.rank || 'Teacher'} • ID: {t.staffId || t.id}</span>
                          </div>
                        </div>
                        <span className="font-mono text-xs font-bold text-slate-700">
                          GH₵ {base} base
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50">
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerateBatchPayroll}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold transition shadow-md shadow-indigo-600/30 cursor-pointer active:scale-95"
              >
                <Sparkles size={14} className="inline mr-1 text-amber-300" />
                <span>Generate {batchSelectedStaffIds.length} Payslips</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: INDIVIDUAL PAYSLIP CREATION / EDITING MODAL                     */}
      {/* ========================================================================= */}
      {isEditModalOpen && editingPayslip && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[500] p-3 sm:p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
          >
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/60 via-slate-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
                  <Banknote size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingPayslip.id ? 'Edit Staff Payslip' : 'Create Individual Staff Payslip'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Configure earnings, allowances, statutory deductions, and banking channels
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePayslip} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase font-mono text-slate-700 mb-1">
                    Select Existing Staff Member
                  </label>
                  <select
                    onChange={(e) => {
                      const t = teachers.find(tch => tch.id === e.target.value);
                      if (t) {
                        const base = DEFAULT_SALARY_BY_RANK[t.rank] || 2400;
                        setEditingPayslip(prev => ({
                          ...prev,
                          staffId: t.staffId || t.id,
                          staffName: `${t.firstName} ${t.lastName}`.trim(),
                          staffRole: t.rank || (t.isClassTeacher ? 'Class Teacher' : 'Teacher'),
                          staffEmail: t.email,
                          staffPhone: t.phone,
                          staffSsnitNumber: t.ssnitNumber,
                          staffTin: t.tinNumber,
                          basicSalary: base
                        }));
                      }
                    }}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    <option value="">-- Choose Staff Profile --</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.firstName} {t.lastName} ({t.rank || 'Teacher'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase font-mono text-slate-700 mb-1">
                    Staff Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingPayslip.staffName || ''}
                    onChange={(e) => setEditingPayslip({ ...editingPayslip, staffName: e.target.value })}
                    placeholder="e.g. Samuel K. Mensah"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase font-mono text-slate-700 mb-1">
                    Staff ID / Employee Code
                  </label>
                  <input
                    type="text"
                    value={editingPayslip.staffId || ''}
                    onChange={(e) => setEditingPayslip({ ...editingPayslip, staffId: e.target.value })}
                    placeholder="e.g. TCH-042"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase font-mono text-slate-700 mb-1">
                    Designation / Rank
                  </label>
                  <input
                    type="text"
                    value={editingPayslip.staffRole || ''}
                    onChange={(e) => setEditingPayslip({ ...editingPayslip, staffRole: e.target.value })}
                    placeholder="e.g. Senior Superintendent II"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase font-mono text-slate-700 mb-1">
                    Payroll Month
                  </label>
                  <select
                    value={editingPayslip.month || selectedMonth}
                    onChange={(e) => setEditingPayslip({ ...editingPayslip, month: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    {MONTH_NAMES.map(m => {
                      const opt = `${m} 2026`;
                      return <option key={opt} value={opt}>{opt}</option>;
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase font-mono text-slate-700 mb-1">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={editingPayslip.paymentDate || new Date().toISOString().split('T')[0]}
                    onChange={(e) => setEditingPayslip({ ...editingPayslip, paymentDate: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              {/* Earnings Breakdown */}
              <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200/80 space-y-3">
                <h4 className="font-black text-xs uppercase font-mono text-emerald-950 flex items-center gap-1.5">
                  <DollarSign size={14} className="text-emerald-600" />
                  <span>Earnings &amp; Allowances (GH₵)</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Basic Salary *</label>
                    <input
                      type="number"
                      required
                      value={editingPayslip.basicSalary ?? ''}
                      onChange={(e) => setEditingPayslip({ ...editingPayslip, basicSalary: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Transport Allowance</label>
                    <input
                      type="number"
                      value={editingPayslip.transportAllowance ?? ''}
                      onChange={(e) => setEditingPayslip({ ...editingPayslip, transportAllowance: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Responsibility Allowance</label>
                    <input
                      type="number"
                      value={editingPayslip.responsibilityAllowance ?? ''}
                      onChange={(e) => setEditingPayslip({ ...editingPayslip, responsibilityAllowance: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Overtime Allowance</label>
                    <input
                      type="number"
                      value={editingPayslip.overtimeAllowance ?? ''}
                      onChange={(e) => setEditingPayslip({ ...editingPayslip, overtimeAllowance: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Housing Subsidy</label>
                    <input
                      type="number"
                      value={editingPayslip.housingAllowance ?? ''}
                      onChange={(e) => setEditingPayslip({ ...editingPayslip, housingAllowance: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Other Allowances</label>
                    <input
                      type="number"
                      value={editingPayslip.otherAllowances ?? ''}
                      onChange={(e) => setEditingPayslip({ ...editingPayslip, otherAllowances: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Deductions Breakdown */}
              <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-200/80 space-y-3">
                <h4 className="font-black text-xs uppercase font-mono text-rose-950 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-rose-600" />
                  <span>Deductions &amp; Taxes (GH₵)</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">SSNIT Tier 1 (5.5%)</label>
                    <input
                      type="number"
                      value={editingPayslip.ssnitTier1 ?? Number(((editingPayslip.basicSalary || 0) * 0.055).toFixed(2))}
                      onChange={(e) => setEditingPayslip({ ...editingPayslip, ssnitTier1: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">PAYE Tax</label>
                    <input
                      type="number"
                      value={editingPayslip.payeTax ?? ''}
                      onChange={(e) => setEditingPayslip({ ...editingPayslip, payeTax: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Staff Welfare Dues</label>
                    <input
                      type="number"
                      value={editingPayslip.staffWelfare ?? ''}
                      onChange={(e) => setEditingPayslip({ ...editingPayslip, staffWelfare: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Loan Repayment</label>
                    <input
                      type="number"
                      value={editingPayslip.loanRepayment ?? ''}
                      onChange={(e) => setEditingPayslip({ ...editingPayslip, loanRepayment: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Method Switcher & Details */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black uppercase font-mono text-slate-800">
                    Payment Method &amp; Disbursement Channel *
                  </label>
                  <span className="text-[10px] font-bold text-slate-400 font-mono">
                    Instant Switcher
                  </span>
                </div>

                {/* 4-way Segmented Buttons for quick switching */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'Cash', label: 'Cash', icon: Banknote, desc: 'Direct Cash' },
                    { id: 'Mobile Money', label: 'MoMo', icon: CreditCard, desc: 'MTN / Telecel' },
                    { id: 'Bank Transfer', label: 'Bank', icon: Building2, desc: 'Direct Deposit' },
                    { id: 'Cheque', label: 'Cheque', icon: FileText, desc: 'Bank Cheque' }
                  ].map(m => {
                    const Icon = m.icon;
                    const isSelected = (editingPayslip.paymentMethod || 'Bank Transfer') === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setEditingPayslip(prev => ({
                            ...prev,
                            paymentMethod: m.id as any,
                            momoNetwork: prev?.momoNetwork || (m.id === 'Mobile Money' ? 'MTN MoMo' : prev?.momoNetwork),
                            momoNumber: prev?.momoNumber || (m.id === 'Mobile Money' ? prev?.staffPhone : prev?.momoNumber),
                            momoAccountName: prev?.momoAccountName || (m.id === 'Mobile Money' ? prev?.staffName : prev?.momoAccountName),
                            chequeBankName: prev?.chequeBankName || (m.id === 'Cheque' ? (prev?.staffBankName || 'GCB Bank') : prev?.chequeBankName)
                          }));
                        }}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition cursor-pointer select-none ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-600/20 font-bold'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <Icon size={16} className={`mb-1 ${isSelected ? 'text-white' : 'text-slate-500'}`} />
                        <span className="text-xs font-black leading-tight">{m.label}</span>
                        <span className={`text-[9px] ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>{m.desc}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Conditional Fields based on Selected Payment Method */}
                {editingPayslip.paymentMethod === 'Cash' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 bg-white p-3 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Disbursed By / Cashier</label>
                      <input
                        type="text"
                        value={editingPayslip.preparedBy || 'Accounts Officer'}
                        onChange={(e) => setEditingPayslip({ ...editingPayslip, preparedBy: e.target.value })}
                        placeholder="e.g. Accounts Officer / Bursar"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Cash Payment Voucher / Ref</label>
                      <input
                        type="text"
                        value={editingPayslip.voucherNumber || ''}
                        onChange={(e) => setEditingPayslip({ ...editingPayslip, voucherNumber: e.target.value })}
                        placeholder="e.g. PV-CASH-2026-001"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs"
                      />
                    </div>
                  </div>
                )}

                {editingPayslip.paymentMethod === 'Mobile Money' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 bg-white p-3 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">MoMo Network *</label>
                      <select
                        value={editingPayslip.momoNetwork || 'MTN MoMo'}
                        onChange={(e) => setEditingPayslip({ ...editingPayslip, momoNetwork: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs cursor-pointer"
                      >
                        <option value="MTN MoMo">MTN Mobile Money</option>
                        <option value="Telecel Cash">Telecel Cash (Vodafone)</option>
                        <option value="AT Money">AT Money (AirtelTigo)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">MoMo Phone Number *</label>
                      <input
                        type="tel"
                        value={editingPayslip.momoNumber || editingPayslip.staffPhone || ''}
                        onChange={(e) => setEditingPayslip({ ...editingPayslip, momoNumber: e.target.value })}
                        placeholder="e.g. 0244123456"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">MoMo Registered Name</label>
                      <input
                        type="text"
                        value={editingPayslip.momoAccountName || editingPayslip.staffName || ''}
                        onChange={(e) => setEditingPayslip({ ...editingPayslip, momoAccountName: e.target.value })}
                        placeholder="e.g. Samuel K. Mensah"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-xs"
                      />
                    </div>
                  </div>
                )}

                {(editingPayslip.paymentMethod === 'Bank Transfer' || !editingPayslip.paymentMethod) && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 bg-white p-3 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Bank Name *</label>
                      <input
                        type="text"
                        list="ghana-banks-list"
                        value={editingPayslip.staffBankName || 'GCB Bank'}
                        onChange={(e) => setEditingPayslip({ ...editingPayslip, staffBankName: e.target.value })}
                        placeholder="e.g. GCB Bank / Stanbic / Ecobank"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-xs"
                      />
                      <datalist id="ghana-banks-list">
                        <option value="GCB Bank" />
                        <option value="Stanbic Bank Ghana" />
                        <option value="Ecobank Ghana" />
                        <option value="ABSA Bank Ghana" />
                        <option value="Zenith Bank Ghana" />
                        <option value="Access Bank Ghana" />
                        <option value="Fidelity Bank Ghana" />
                        <option value="CalBank PLC" />
                        <option value="Consolidated Bank Ghana (CBG)" />
                        <option value="Standard Chartered Bank" />
                        <option value="Agricultural Development Bank (ADB)" />
                        <option value="Prudential Bank" />
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Account Number *</label>
                      <input
                        type="text"
                        value={editingPayslip.staffAccountNumber || ''}
                        onChange={(e) => setEditingPayslip({ ...editingPayslip, staffAccountNumber: e.target.value })}
                        placeholder="e.g. 1029384756"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Bank Branch</label>
                      <input
                        type="text"
                        value={editingPayslip.staffBankBranch || ''}
                        onChange={(e) => setEditingPayslip({ ...editingPayslip, staffBankBranch: e.target.value })}
                        placeholder="e.g. High Street Branch"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-xs"
                      />
                    </div>
                  </div>
                )}

                {editingPayslip.paymentMethod === 'Cheque' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 bg-white p-3 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Cheque Number *</label>
                      <input
                        type="text"
                        value={editingPayslip.chequeNumber || ''}
                        onChange={(e) => setEditingPayslip({ ...editingPayslip, chequeNumber: e.target.value })}
                        placeholder="e.g. CHQ-009823"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Issuing Bank</label>
                      <input
                        type="text"
                        value={editingPayslip.chequeBankName || editingPayslip.staffBankName || 'GCB Bank'}
                        onChange={(e) => setEditingPayslip({ ...editingPayslip, chequeBankName: e.target.value })}
                        placeholder="e.g. GCB Bank Ghana"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Cheque Issue Date</label>
                      <input
                        type="date"
                        value={editingPayslip.chequeIssueDate || editingPayslip.paymentDate || new Date().toISOString().split('T')[0]}
                        onChange={(e) => setEditingPayslip({ ...editingPayslip, chequeIssueDate: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* Statutory Numbers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">SSNIT Number</label>
                    <input
                      type="text"
                      value={editingPayslip.staffSsnitNumber || ''}
                      onChange={(e) => setEditingPayslip({ ...editingPayslip, staffSsnitNumber: e.target.value })}
                      placeholder="e.g. C0192837465"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Ghana Card / TIN</label>
                    <input
                      type="text"
                      value={editingPayslip.staffTin || ''}
                      onChange={(e) => setEditingPayslip({ ...editingPayslip, staffTin: e.target.value })}
                      placeholder="e.g. GHA-123456789-0"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition shadow-md shadow-emerald-600/30 cursor-pointer active:scale-95"
                >
                  <span>Save Payslip</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
