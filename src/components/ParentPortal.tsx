import React, { useMemo, useState, useEffect } from 'react';
import { DbController } from '../db';
import { generateSecureToken, getWatermarkHtml } from '../utils';
import PaystackPaymentTrigger from './PaystackPaymentTrigger';
import { generatePdfFromHtml, downloadBlobLocally } from '../pdfHelper';
import { AcademicYearType, TermType } from '../types';
import { 
  Award, Printer, Download, Lock, CheckCircle, AlertTriangle, 
  MessageSquare, FileText, Smartphone, Calendar, BookOpen, 
  DollarSign, Activity, RefreshCw, CreditCard, Check, X, HelpCircle
} from 'lucide-react';
import { RankBreakdownTooltip } from './AssessmentTab';

interface ParentPortalProps {
  studentId: string;
  year: string;
  term: string;
  token: string;
  onExit: () => void;
}

export default function ParentPortal({ studentId, year, term, token, onExit }: ParentPortalProps) {
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const schoolInfo = useMemo(() => DbController.getSchoolInfo(), []);

  const [feeBills, setFeeBills] = useState<any[]>(() => DbController.getStudentFeeBills());
  
  const fullBill = useMemo(() => {
    return feeBills.find(b => b.studentId === studentId && b.academicYear === year && b.term === term);
  }, [feeBills, studentId, year, term]);
  
  // Payment Modal States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'details' | 'method' | 'processing' | 'momo_otp' | 'success'>('details');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentComponent, setPaymentComponent] = useState<'School Fees' | 'Utility Bill' | 'Sports Fees' | 'PTA dues' | 'Transportation Bill' | 'Other Fee'>('School Fees');
  const [payerName, setPayerName] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [payerEmail, setPayerEmail] = useState('');
  const [paymentChannel, setPaymentChannel] = useState<'momo' | 'card'>('momo');
  
  // Momo details
  const [momoProvider, setMomoProvider] = useState<'MTN' | 'Telecel' | 'AT'>('MTN');
  const [momoNumber, setMomoNumber] = useState('');
  const [momoPin, setMomoPin] = useState('');
  
  // Card details
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  
  // Processing simulation
  const [processingStatus, setProcessingStatus] = useState('');
  const [downloadingReceiptPdf, setDownloadingReceiptPdf] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<{
    receiptNo: string;
    amount: number;
    date: string;
    component: string;
    method: string;
    payerName: string;
  } | null>(null);

  // Verify token
  const isTokenValid = useMemo(() => {
    const freshToken = generateSecureToken(studentId, year, term);
    return freshToken === token;
  }, [studentId, year, term, token]);

  // Load target compiled report
  const compiledReport = useMemo(() => {
    if (!isTokenValid) return null;
    return DbController.getStudentTermReportCard(studentId, year as AcademicYearType, term as TermType);
  }, [isTokenValid, studentId, year, term]);

  useEffect(() => {
    if (compiledReport?.student) {
      setPayerName(compiledReport.student.guardianName || '');
      setPayerPhone(compiledReport.student.guardianTelephone || '');
    }
  }, [compiledReport]);

  // Compute student financial outstanding balance and next term plan
  const studentFinancials = useMemo(() => {
    if (!isTokenValid || !studentId) return null;
    const bills = feeBills;
    
    // Find current bill
    const currentBill = bills.find(b => b.studentId === studentId && b.academicYear === year && b.term === term);
    const currentExpected = currentBill 
      ? (currentBill.schoolFees + currentBill.utilityBill + currentBill.sportsFees + currentBill.ptaDues + (currentBill.transportationBill || 0) + currentBill.otherFee)
      : 0;
    const currentPaid = currentBill
      ? currentBill.payments.reduce((sum, p) => sum + p.amount, 0)
      : 0;
    const currentOutstanding = currentExpected - currentPaid;

    // Find all previous bills to compute cumulative arrears
    const allPreviousBills = bills.filter(b => {
      if (b.studentId !== studentId) return false;
      const currentSortValue = parseInt(year.split('/')[0], 10) * 10 + parseInt(term.replace(/\D/g, ''), 10);
      const bSortValue = parseInt(b.academicYear.split('/')[0], 10) * 10 + parseInt(b.term.replace(/\D/g, ''), 10);
      return bSortValue < currentSortValue;
    });

    const previousExpected = allPreviousBills.reduce((sum, b) => 
      sum + (b.schoolFees + b.utilityBill + b.sportsFees + b.ptaDues + (b.transportationBill || 0) + b.otherFee), 0);
    const previousPaid = allPreviousBills.reduce((sum, b) => 
      sum + b.payments.reduce((pSum, p) => pSum + p.amount, 0), 0);
    const previousOutstanding = Math.max(0, previousExpected - previousPaid);
    const totalOutstanding = currentOutstanding + previousOutstanding;

    // Determine target next term parameters
    let nextTerm = 'Term 2';
    let nextYear = year;
    if (term === 'Term 1') {
      nextTerm = 'Term 2';
    } else if (term === 'Term 2') {
      nextTerm = 'Term 3';
    } else {
      nextTerm = 'Term 1';
      const parts = year.split('/');
      if (parts.length === 2) {
        nextYear = `${parseInt(parts[0], 10) + 1}/${parseInt(parts[1], 10) + 1}`;
      }
    }

    // Find next term bill
    const nextTermBillObj = bills.find(b => b.studentId === studentId && b.academicYear === nextYear && b.term === nextTerm);
    let nextTermBillSum = 0;
    let isEstimated = false;

    if (nextTermBillObj) {
      nextTermBillSum = nextTermBillObj.schoolFees + nextTermBillObj.utilityBill + nextTermBillObj.sportsFees + nextTermBillObj.ptaDues + (nextTermBillObj.transportationBill || 0) + nextTermBillObj.otherFee;
    } else {
      nextTermBillSum = currentExpected;
      isEstimated = true;
    }

    return {
      currentOutstanding,
      previousOutstanding,
      totalOutstanding,
      nextTerm,
      nextYear,
      nextTermBillSum,
      isEstimated
    };
  }, [isTokenValid, studentId, year, term, feeBills]);

  const getComponentBreakdown = () => {
    if (!compiledReport) return [];
    
    // Find current bill
    const currentBill = feeBills.find(b => b.studentId === studentId && b.academicYear === year && b.term === term);
    
    const getPaidFor = (comp: string) => {
      if (!currentBill) return 0;
      return currentBill.payments
        .filter(p => p.component === comp)
        .reduce((sum, p) => sum + p.amount, 0);
    };

    return [
      { name: 'School Fees', expected: currentBill ? currentBill.schoolFees : 0, paid: getPaidFor('School Fees') },
      { name: 'Utility Bill', expected: currentBill ? currentBill.utilityBill : 0, paid: getPaidFor('Utility Bill') },
      { name: 'Sports Fees', expected: currentBill ? currentBill.sportsFees : 0, paid: getPaidFor('Sports Fees') },
      { name: 'PTA dues', expected: currentBill ? currentBill.ptaDues : 0, paid: getPaidFor('PTA dues') },
      { name: 'Transportation Bill', expected: currentBill ? (currentBill.transportationBill || 0) : 0, paid: getPaidFor('Transportation Bill') },
      { name: 'Other Fee', expected: currentBill ? currentBill.otherFee : 0, paid: getPaidFor('Other Fee') },
    ].map(c => ({
      ...c,
      outstanding: Math.max(0, c.expected - c.paid)
    }));
  };

  const handleStartPaymentFlow = () => {
    const breakdown = getComponentBreakdown();
    const firstOutstanding = breakdown.find(c => c.outstanding > 0);
    
    if (firstOutstanding) {
      setPaymentComponent(firstOutstanding.name as any);
      setPaymentAmount(parseFloat(firstOutstanding.outstanding.toFixed(2)));
    } else {
      setPaymentComponent('School Fees');
      setPaymentAmount(parseFloat(studentFinancials?.totalOutstanding.toFixed(2) || '0'));
    }
    
    setPaymentStep('details');
    setShowPaymentModal(true);
  };

  const startProcessingPayment = () => {
    if (!paymentAmount || paymentAmount <= 0) {
      alert("Please enter a valid payment amount greater than zero.");
      return;
    }
    
    const breakdown = getComponentBreakdown();
    const targetedComp = breakdown.find(c => c.name === paymentComponent);
    if (targetedComp && paymentAmount > parseFloat((targetedComp.outstanding + 0.01).toFixed(2))) {
      alert(`The selected amount (GHS ${paymentAmount.toFixed(2)}) exceeds the outstanding balance for ${paymentComponent} (GHS ${targetedComp.outstanding.toFixed(2)}).`);
      return;
    }

    setPaymentStep('processing');
    setProcessingStatus('Establishing direct handshake secure socket connection to institutional payment channel...');
    
    setTimeout(() => {
      setProcessingStatus(
        paymentChannel === 'momo'
          ? 'Contacting telecommunications partner network gateway...'
          : 'Transmitting authorization request block to card issuer server...'
      );
      
      setTimeout(() => {
        if (paymentChannel === 'momo') {
          setPaymentStep('momo_otp');
        } else {
          setProcessingStatus('Validating 3D-Secure merchant credential handshake. Please verify authorization below.');
          setTimeout(() => {
            handleCompletePayment();
          }, 1500);
        }
      }, 1500);
    }, 1500);
  };

  const handleCompletePayment = () => {
    const fullBill = feeBills.find(b => b.studentId === studentId && b.academicYear === year && b.term === term);
    
    const randPart = Math.floor(1000 + Math.random() * 9000);
    const generatedReceipt = `GTIMS-PAY-${year.split('/')[0]}-${randPart}`;
    const today = new Date().toISOString().split('T')[0];
    
    const newPayment: any = {
      id: `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      amount: paymentAmount,
      date: today,
      component: paymentComponent,
      method: paymentChannel === 'momo' ? 'Mobile Money' : 'Bank Transfer',
      receiptNo: generatedReceipt,
      remarks: `Paid online by Parent ${payerName}`.trim()
    };
    
    let targetBill: any;
    if (fullBill) {
      targetBill = {
        ...fullBill,
        payments: [...fullBill.payments, newPayment],
        updatedAt: new Date().toISOString()
      };
    } else {
      targetBill = {
        id: `${studentId}_${year}_${term}`.replace(/\//g, '-'),
        studentId,
        studentName: `${compiledReport.student.firstName} ${compiledReport.student.lastName}`,
        class: compiledReport.student.class,
        academicYear: year as any,
        term: term as any,
        schoolFees: paymentComponent === 'School Fees' ? paymentAmount : 0,
        utilityBill: paymentComponent === 'Utility Bill' ? paymentAmount : 0,
        sportsFees: paymentComponent === 'Sports Fees' ? paymentAmount : 0,
        ptaDues: paymentComponent === 'PTA dues' ? paymentAmount : 0,
        transportationBill: paymentComponent === 'Transportation Bill' ? paymentAmount : 0,
        otherFee: paymentComponent === 'Other Fee' ? paymentAmount : 0,
        payments: [newPayment],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    
    DbController.saveStudentFeeBill(targetBill);
    
    const refreshedBills = DbController.getStudentFeeBills();
    setFeeBills(refreshedBills);
    
    setActiveReceipt({
      receiptNo: generatedReceipt,
      amount: paymentAmount,
      date: today,
      component: paymentComponent,
      method: paymentChannel === 'momo' ? `Mobile Money (${momoProvider})` : 'Credit/Debit Card',
      payerName: payerName || 'Parent / Guardian'
    });
    
    setPaymentStep('success');
  };

  const handleDownloadPDF = async () => {
    if (downloadingPdf) return;
    setDownloadingPdf(true);
    setDownloadError(null);
    try {
      const studentName = compiledReport 
        ? `${compiledReport.student.firstName}_${compiledReport.student.lastName}`
        : 'Student';
      const cleanYear = year.replace(/[\/\s]/g, '_');
      const cleanTerm = term.replace(/[\s]/g, '_');
      const filename = `${studentName}_Report_${cleanYear}_${cleanTerm}.pdf`;
      
      const result = await generatePdfFromHtml('parent-portal-report-card-render', filename);
      downloadBlobLocally(result.blob, result.filename);
    } catch (err: any) {
      console.error("Parent portal PDF download failed:", err);
      setDownloadError("Failed to convert report card to document. Please try again or use the print function.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handlePrint = () => {
    try {
      window.print();
    } catch (err) {
      console.warn("Print trigger error:", err);
    }
  };

  // Render error screen if token is invalid or student report not loaded
  if (!isTokenValid || !compiledReport) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center text-slate-100 font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl relative">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle size={32} />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-red-400 uppercase tracking-tight">Access Link Invalid or Expired</h1>
            <p className="text-xs text-slate-400">The verification token does not match our institutional database records. Please verify the URL or ask the school headmaster for a new secure SMS notification link.</p>
          </div>
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-[11px] font-mono text-slate-500 text-left space-y-1">
            <p><strong>Code:</strong> SEC_TOKEN_MISMATCH</p>
            <p><strong>Ref Student ID:</strong> {studentId || 'N/A'}</p>
            <p><strong>Context Session:</strong> {term} ({year})</p>
          </div>
          <div className="pt-2">
            <button 
              onClick={onExit}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-xl transition"
            >
              Go to Portal Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 print:bg-white print:p-0">
      
      {/* Top Banner Control Panel (No Print) */}
      <div className="bg-slate-900 text-slate-100 shadow-xl py-3 px-4 border-b border-slate-805 sticky top-0 z-50 no-print">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          
          <div className="flex items-center gap-2.5">
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-1.5 rounded-lg flex items-center justify-center flex-shrink-0 animate-pulse">
              <Lock size={14} />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5 leading-tight">
                <span className="font-bold text-slate-200">Parent Secure Report Viewer</span>
                <span className="bg-emerald-600 text-[8.5px] px-1 text-white font-mono font-bold rounded">LIVE</span>
              </div>
              <p className="text-[10px] text-slate-400">Authenticated access for guardian of {compiledReport.student.firstName} {compiledReport.student.lastName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-705 px-3 py-1.5 rounded-lg border border-slate-700 font-bold transition select-none cursor-pointer"
            >
              <Printer size={13} /> Print
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={downloadingPdf}
              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold transition shadow-md disabled:opacity-50 select-none cursor-pointer"
            >
              {downloadingPdf ? (
                <>
                  <RefreshCw size={13} className="animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Download size={13} /> Download PDF Document
                </>
              )}
            </button>

            <button
              onClick={onExit}
              className="flex items-center gap-1 bg-rose-950/30 text-rose-450 hover:bg-rose-950/50 border border-rose-900/30 px-3 py-1.5 rounded-lg font-bold transition select-none cursor-pointer"
            >
              Logout / Close
            </button>
          </div>

        </div>
      </div>

      {downloadError && (
        <div className="max-w-4xl mx-auto mt-4 px-4 no-print">
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-sans text-xs font-semibold flex items-center gap-2">
            <AlertTriangle size={15} />
            {downloadError}
          </div>
        </div>
      )}

      {/* Main Content Workspace Layout */}
      <div className="max-w-4xl mx-auto px-4 pt-6 space-y-6 print:p-0 print:m-0">
        
        {/* Short Executive Summary (No Print) */}
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 grid grid-cols-1 md:grid-cols-3 gap-5 no-print font-sans text-left">
          <div className="md:col-span-2 space-y-2">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
              <Award className="text-indigo-600" size={16} /> Academic Performance Summary
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              Dear Guardian, the academic results of <strong>{compiledReport.student.firstName} {compiledReport.student.lastName}</strong> for <strong>{term}</strong> ({year}) have been generated by the Academic Board. 
              {compiledReport.averageScore >= 80 ? " Excellent student performance is noted this term. High commendation is encouraged!" : " Satisfactory progress logged. Regular guided home tutoring is highly recommended."}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 space-y-2 font-mono text-xs flex flex-col justify-center leading-none">
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Score Average:</span>
              <strong className="text-slate-800 text-sm">{compiledReport.averageScore}%</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Class Ranking:</span>
              <strong className="text-indigo-700 text-sm bg-indigo-50 px-1 rounded">Rank: {compiledReport.grades[0]?.position ? "Available" : "N/A"}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Present Days:</span>
              <strong className="text-slate-800 text-sm">{compiledReport.attendancePresent} / {compiledReport.schoolOpenDays}</strong>
            </div>
          </div>
        </div>

        {/* Dynamic Financial Ledger / Action block for parents (No Print) */}
        {studentFinancials && (
          <div className="bg-amber-50/50 border border-amber-200/80 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-3 gap-4 font-sans text-left no-print leading-relaxed">
            <div className="space-y-1 md:col-span-2">
              <h4 className="text-xs font-black uppercase text-amber-900 tracking-wider flex items-center gap-1.5">
                <DollarSign size={14} className="text-amber-800" /> Outstanding Bills & Next Term Forecast
              </h4>
              <p className="text-[11px] text-amber-800/85">
                Outstanding Balance due for this term: <strong>GHS {studentFinancials.totalOutstanding.toFixed(2)}</strong>. 
                Next academic Term (<strong>{studentFinancials.nextTerm}</strong>) estimated pricing: <strong>GHS {studentFinancials.nextTermBillSum.toFixed(2)}</strong>. 
                Please arrange payments in time before school resumes on the reopening date.
              </p>
            </div>
            <div className="flex flex-col justify-center bg-white p-3.5 rounded-xl border border-amber-200/50 shadow-2xs divide-y divide-slate-100">
              <div className="flex justify-between py-1 text-xs">
                <span className="text-slate-400">Total Arrears:</span>
                <strong className={studentFinancials.totalOutstanding > 0 ? "text-rose-700 font-mono font-black" : "text-emerald-700 font-mono font-black"}>
                  GHS {studentFinancials.totalOutstanding.toFixed(2)}
                </strong>
              </div>
              <div className="flex justify-between py-1 text-xs font-bold pt-1.5 mt-0.5">
                <span className="text-slate-500">Reopening:</span>
                <span className="text-amber-950 font-mono text-[11px] font-black">{schoolInfo.reopeningDate || "TBD"}</span>
              </div>
              {studentFinancials.totalOutstanding > 0 && (
                <button
                  type="button"
                  onClick={handleStartPaymentFlow}
                  className="w-full mt-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition select-none cursor-pointer shadow-7xs active:scale-98"
                >
                  <CreditCard size={13} /> Settle Fees Online
                </button>
              )}
            </div>
          </div>
        )}

        {/* HIGH-FIDELITY REPORT CARD CANVAS CONTAINER */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 p-0 sm:p-2 bg-gradient-to-br from-white to-slate-50/20 print:border-none print:shadow-none print:p-0 print:bg-white">
          <div 
            id="parent-portal-report-card-render" 
            className="w-full bg-white p-6 sm:p-12 md:p-16 text-black border-[6px] md:border-[10px] border-double border-slate-900 space-y-6 font-sans text-left report-card-print-container print:p-12 print:border-double relative"
          >
            <div className="absolute inset-0 z-0 pointer-events-none hidden print:block" dangerouslySetInnerHTML={{ __html: getWatermarkHtml(schoolInfo.crestUrl) }} />
            
            {/* Header / Watermark letterhead */}
            <div className="flex flex-col sm:flex-row items-center justify-between border-b-2 border-slate-900 pb-5 mb-8 gap-4 font-sans text-left relative z-10">
              {schoolInfo.logoUrl ? (
                <img 
                  src={schoolInfo.logoUrl} 
                  alt="School Logo" 
                  className="w-20 h-20 object-contain flex-shrink-0" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-18 h-18 rounded-full bg-slate-50 flex items-center justify-center border border-slate-300 p-1 flex-shrink-0">
                  <div className="w-full h-full rounded-full border border-dashed border-slate-400 bg-white flex flex-col items-center justify-center text-[7px] text-slate-500 font-mono font-bold leading-normal">
                    <Award size={20} className="text-indigo-600 mb-0.5" />
                    <span className="scale-75 origin-center uppercase">CREST</span>
                  </div>
                </div>
              )}
              <div className="flex-1 text-center space-y-0.5">
                <h2 className="text-2xl font-black text-slate-950 tracking-tight leading-tight uppercase font-display">
                  {schoolInfo.name}
                </h2>
                <p className="text-xs italic font-serif text-slate-600">
                  Motto: "{schoolInfo.motto}"
                </p>
                <div className="text-[10px] text-slate-500 font-sans flex flex-wrap justify-center gap-x-3 gap-y-0.5 mt-0.5">
                  {schoolInfo.gpsAddress && <span>📍 {schoolInfo.gpsAddress}</span>}
                  {schoolInfo.telephone && <span>☎️ {schoolInfo.telephone}</span>}
                  {schoolInfo.email && <span>📧 {schoolInfo.email}</span>}
                </div>
                <div className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-semibold flex justify-center gap-3">
                  {schoolInfo.emisCode && <span>EMIS: {schoolInfo.emisCode}</span>}
                  {schoolInfo.schoolNumber && <span>CODE: {schoolInfo.schoolNumber}</span>}
                </div>
                <p className="text-[10px] font-mono text-slate-800 font-bold uppercase tracking-wider bg-slate-100 px-3 py-0.5 rounded-full inline-block mt-2">
                  Official Student Progress Statement Card
                </p>
              </div>
              {compiledReport.student.photoUrl ? (
                <img 
                  src={compiledReport.student.photoUrl} 
                  alt={`${compiledReport.student.firstName} ${compiledReport.student.lastName}`} 
                  className="w-16 h-16 rounded border border-slate-300 object-cover flex-shrink-0" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-16 h-16 rounded border border-dashed border-slate-300 flex flex-col items-center justify-center bg-slate-50 p-1 flex-shrink-0 text-[7px] text-slate-400 font-mono text-center leading-normal select-none">
                  <div className="font-bold scale-90">PASSPORT</div>
                  <div className="scale-75">STAMP</div>
                </div>
              )}
            </div>

            {/* Student metadata */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 bg-slate-50 p-4 rounded-xl text-xs leading-relaxed border border-slate-100 print:bg-white print:border-none">
              <div>
                <span className="text-[9px] uppercase text-slate-400 font-mono font-medium block">Student ID</span>
                <strong className="text-slate-800 font-mono text-sm">{compiledReport.student.id}</strong>
              </div>
              <div>
                <span className="text-[9px] uppercase text-slate-400 font-mono font-medium block">Full Name</span>
                <strong className="text-slate-800 text-sm whitespace-nowrap">{compiledReport.student.firstName} {compiledReport.student.lastName}</strong>
              </div>
              <div>
                <span className="text-[9px] uppercase text-slate-400 font-mono font-medium block">Class Enrollment</span>
                <strong className="text-slate-800 text-sm">{compiledReport.student.class} ({compiledReport.student.section || 'N/A'})</strong>
              </div>
              <div>
                <span className="text-[9px] uppercase text-slate-400 font-mono font-medium block">Report Period</span>
                <strong className="text-slate-800 text-sm font-mono">{term} ({year})</strong>
              </div>
              <div className="relative group cursor-help bg-indigo-50/30 p-1.5 rounded-lg border border-indigo-100/50 transition-all hover:bg-indigo-50/80">
                <span className="text-[9px] uppercase text-indigo-700 font-mono font-bold flex items-center gap-1 select-none">
                  Class Rank Standing <HelpCircle size={10} className="text-indigo-400" />
                </span>
                <strong className="text-indigo-900 text-sm font-mono block mt-0.5">{compiledReport.classRank || 'N/A'}</strong>
                <RankBreakdownTooltip 
                  term={term} 
                  year={year} 
                  averageScore={compiledReport.averageScore} 
                  gradedCount={compiledReport.gradedCount} 
                />
              </div>
              <div>
                <span className="text-[9px] uppercase text-teal-700 font-mono font-bold block">Reopening Date</span>
                <strong className="text-teal-900 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100 text-sm block">{schoolInfo.reopeningDate || 'Not Configured'}</strong>
              </div>
            </div>

            {/* Main Scores Grades Table */}
            <table className="w-full text-left border-collapse border border-slate-200 text-xs mt-6">
              <thead>
                <tr className="bg-slate-100 border-b-2 border-slate-800">
                  <th className="py-2.5 px-3 border border-slate-200 font-bold uppercase tracking-wider">Subject Course</th>
                  <th className="py-2.5 px-2 border border-slate-200 font-bold text-center uppercase tracking-wider">Class 50%</th>
                  <th className="py-2.5 px-2 border border-slate-200 font-bold text-center uppercase tracking-wider">Exams 50%</th>
                  <th className="py-2.5 px-2 border border-slate-200 font-bold text-center uppercase tracking-wider">Total 100%</th>
                  <th className="py-2.5 px-3 border border-slate-200 font-bold text-center uppercase tracking-wider">Remarks</th>
                  <th className="py-2.5 px-2 border border-slate-200 font-bold text-center uppercase tracking-wider">Rank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {compiledReport.grades.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/40">
                    <td className="py-3 px-3 border border-slate-200 font-black text-slate-900 text-sm">{item.subject}</td>
                    <td className="py-3 px-2 border border-slate-200 text-center font-mono font-bold text-slate-700 text-sm">{item.classScore50}</td>
                    <td className="py-3 px-2 border border-slate-200 text-center font-mono font-bold text-slate-700 text-sm">{item.examScore50}</td>
                    <td className="py-3 px-2 border border-slate-200 text-center font-mono font-black text-rose-700 bg-rose-50/10 text-sm">{item.totalScore}%</td>
                    <td className="py-3 px-3 border border-slate-200 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black ${item.gradeLevel === 'L1' ? 'bg-emerald-50 text-emerald-800' : item.gradeLevel === 'L2' ? 'bg-blue-50 text-blue-800' : item.gradeLevel === 'L3' ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-800'}`}>
                        {item.remarks} ({item.gradeLevel})
                      </span>
                    </td>
                    <td className="py-3 px-2 border border-slate-200 text-center font-mono font-black text-indigo-700 text-sm">{item.position ? `${item.position}` : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Aggegrates section */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 border-t border-slate-200 pt-5 text-xs text-center font-mono leading-relaxed print:border-slate-300">
              <div className="bg-slate-50/50 p-2.5 border border-slate-100 rounded-lg">
                <span className="text-slate-400 font-sans block text-[10px] uppercase font-semibold">Subjects Graded</span>
                <strong className="text-slate-800 text-sm">{compiledReport.totalSubjects} courses</strong>
              </div>
              <div className="bg-slate-50/50 p-2.5 border border-slate-100 rounded-lg">
                <span className="text-slate-400 font-sans block text-[10px] uppercase font-semibold">Term Average Score</span>
                <strong className="text-slate-800 text-sm italic">{compiledReport.averageScore}%</strong>
              </div>
              <div className="bg-slate-50/50 p-2.5 border border-slate-100 rounded-lg">
                <span className="text-slate-400 font-sans block text-[10px] uppercase font-semibold">Attendance Ledger</span>
                <strong className="text-slate-800 text-sm font-sans">{compiledReport.attendancePresent} / {compiledReport.schoolOpenDays} Days Present</strong>
              </div>
              <div className="bg-slate-50/50 p-2.5 border border-slate-100 rounded-lg">
                <span className="text-slate-400 font-sans block text-[10px] uppercase font-semibold">GES Code</span>
                <strong className="text-slate-805 text-sm uppercase">Curriculum Compliant</strong>
              </div>
            </div>

            {/* Optional Financial ledger row for official printout */}
            {studentFinancials && (
              <div className="mt-6 bg-slate-50 border border-slate-200/80 rounded-xl p-4 font-sans text-xs flex flex-row justify-between gap-4 leading-normal print:bg-white print:border-slate-300">
                <div className="space-y-1">
                  <div className="text-slate-500 uppercase tracking-wider text-[9px] font-black">Current Balance Status</div>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-base font-black ${studentFinancials.totalOutstanding > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      GHS {studentFinancials.totalOutstanding.toFixed(2)}
                    </span>
                    {studentFinancials.totalOutstanding > 0 && studentFinancials.previousOutstanding > 0 && (
                      <span className="text-[10px] text-slate-400">
                        (Term: GHS {studentFinancials.currentOutstanding.toFixed(2)} | Arrears: GHS {studentFinancials.previousOutstanding.toFixed(2)})
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400">Outstanding student balance of registered accounts ledger.</div>
                </div>
                <div className="border-l border-slate-255 pl-6 space-y-1">
                  <div className="text-slate-500 uppercase tracking-wider text-[9px] font-black">Next Term Projected Bill ({studentFinancials.nextTerm})</div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-base font-bold text-slate-800">
                      GHS {studentFinancials.nextTermBillSum.toFixed(2)}
                    </span>
                    {studentFinancials.isEstimated && (
                      <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-black font-mono">Estimated Rate</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400">Projected billing plan for the upcoming academic module term.</div>
                </div>
              </div>
            )}

            {/* Remarks and Signatures Block */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-16 border-t border-slate-100 pt-8 text-xs font-sans">
              <div className="space-y-2 text-left">
                <span className="text-[10px] font-mono text-slate-500 uppercase font-black">Principal Headteacher Remarks</span>
                <p className="text-[11px] italic text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200/50 leading-relaxed min-h-[70px] print:bg-white print:border-none">
                  {compiledReport.averageScore >= 80 
                    ? 'Excellent academic performance logged this term! Commendable work, maintain high performance across all subjects.'
                    : compiledReport.averageScore >= 60
                    ? 'Good outcome. Strong progress made across core subjects. Maintain academic discipline to excel.'
                    : 'Satisfactory performance. Continual tutoring encouraged in weaker content areas.'}
                </p>
              </div>

              <div className="flex flex-col justify-end items-end space-y-1.5 pr-6 relative">
                <div className="relative w-52 h-16 flex items-center justify-center">
                  {schoolInfo.stampUrl && (
                    <img 
                      src={schoolInfo.stampUrl} 
                      alt="School Stamp" 
                      className="absolute w-20 h-20 object-contain opacity-75 z-0 transform -rotate-12 translate-x-[-15%] translate-y-[-5%]" 
                      referrerPolicy="no-referrer"
                    />
                  )}
                  {schoolInfo.signatureUrl ? (
                    <img 
                      src={schoolInfo.signatureUrl} 
                      alt="Headteacher Signature" 
                      className="absolute w-36 h-12 object-contain z-10" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="h-[1.5px] w-52 bg-slate-400 self-end"></div>
                  )}
                </div>
                {schoolInfo.signatureUrl && <div className="h-[1px] w-52 bg-slate-300"></div>}
                <div className="text-right">
                  {schoolInfo.headteacherName && (
                    <span className="font-bold text-[10px] text-slate-800 block leading-tight">{schoolInfo.headteacherName}</span>
                  )}
                  <span className="text-[10px] text-slate-500 font-serif font-semibold">Signature of Headteacher</span>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* SUCCESS RECEIPT MODAL AREA (HIDDEN EXCEPT FOR PRINT/PDF SHIFT) */}
      <div className="hidden">
        <div 
          id="parent-portal-recent-receipt-area" 
          className="p-12 w-[600px] bg-white text-slate-800 border-[10px] border-double border-slate-900 font-sans text-xs text-left"
        >
          <div className="text-center border-b border-slate-300 pb-4 mb-4">
            <h2 className="text-base font-black uppercase text-slate-950">{schoolInfo.name}</h2>
            <p className="text-[10px] font-mono text-slate-400">INSTITUTIONAL PAYMENT RECEIPT</p>
          </div>
          <div className="space-y-2 font-sans">
            <p className="flex justify-between"><strong>Receipt Number:</strong> <span className="font-mono font-bold text-slate-950">{activeReceipt?.receiptNo}</span></p>
            <p className="flex justify-between"><strong>Transaction Date:</strong> <span>{activeReceipt?.date}</span></p>
            <p className="flex justify-between"><strong>Student Name:</strong> <span className="capitalize">{compiledReport?.student.firstName} {compiledReport?.student.lastName}</span></p>
            <p className="flex justify-between"><strong>Student ID:</strong> <span className="font-mono">{compiledReport?.student.id}</span></p>
            <p className="flex justify-between"><strong>Payer Parent:</strong> <span>{activeReceipt?.payerName}</span></p>
            <p className="flex justify-between"><strong>Payment Gateway:</strong> <span>{activeReceipt?.method}</span></p>
            <p className="flex justify-between border-t border-slate-200 pt-2 font-bold"><strong>Allocated Component:</strong> <span>{activeReceipt?.component}</span></p>
            <p className="flex justify-between text-base font-black border-t-2 border-slate-900 pt-2 text-rose-700"><strong>Amount Paid:</strong> <span className="font-mono font-bold">GHS {activeReceipt?.amount.toFixed(2)}</span></p>
          </div>
          <div className="mt-8 pt-4 border-t border-dashed border-slate-400 text-center text-[10px] text-slate-400 leading-normal">
            <p>Thank you for your instant payment.</p>
            <p>This document constitutes secure proof of transaction.</p>
          </div>
        </div>
      </div>

      {showPaymentModal && compiledReport && (
        <div className="fixed inset-0 z-[100] bg-slate-1000/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-md w-full border border-slate-200/80 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-1.5 rounded-lg">
                  <CreditCard size={14} />
                </div>
                <div className="text-left">
                  <h3 className="font-black text-xs uppercase tracking-wider text-slate-100 leading-tight">Secure Fees Payment</h3>
                  <p className="text-[10px] text-slate-400 font-sans leading-none mt-1">Settle dues for {compiledReport.student.firstName} {compiledReport.student.lastName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-1 px-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer font-black text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            {paymentStep === 'details' && (
              <div className="p-6 md:p-8 space-y-4 text-xs text-left">
                {/* 1. Component Picker */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Select Dues Component</label>
                  <select
                    value={paymentComponent}
                    onChange={(e) => {
                      const comp = e.target.value as any;
                      setPaymentComponent(comp);
                      const found = getComponentBreakdown().find(c => c.name === comp);
                      if (found) {
                        setPaymentAmount(parseFloat(found.outstanding.toFixed(2)));
                      }
                    }}
                    className="w-full bg-white px-3 py-2.5 border border-slate-250 hover:border-slate-350 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  >
                    {getComponentBreakdown().map(comp => (
                      <option 
                        key={comp.name} 
                        value={comp.name} 
                        disabled={comp.outstanding <= 0}
                      >
                        {comp.name} (Outstanding: GHS {comp.outstanding.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Amount Input */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Payment Amount (GHS)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">GHS</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.1"
                      value={paymentAmount || ''}
                      onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white pl-12 pr-4 py-2.5 border border-slate-250 hover:border-slate-350 rounded-xl font-mono font-bold text-slate-800 text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Enter custom amount. Cap limit: GHS {getComponentBreakdown().find(c => c.name === paymentComponent)?.outstanding.toFixed(2) || '0.00'}.
                  </p>
                </div>

                {/* 3. Payer Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Payer Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Samuel Guardian"
                      value={payerName}
                      onChange={(e) => setPayerName(e.target.value)}
                      className="w-full bg-white px-3 py-2.5 border border-slate-250 hover:border-slate-350 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Payer Phone Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 0541234567"
                      value={payerPhone}
                      onChange={(e) => setPayerPhone(e.target.value)}
                      className="w-full bg-white px-3 py-2.5 border border-slate-250 hover:border-slate-350 rounded-xl font-mono text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Navigation */}
                <div className="pt-3 flex gap-3">
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="flex-1 py-3 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-xl transition cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!paymentAmount || paymentAmount <= 0) {
                        alert("Please specify a valid payment amount greater than zero.");
                        return;
                      }
                      const limit = getComponentBreakdown().find(c => c.name === paymentComponent)?.outstanding || 0;
                      if (paymentAmount > parseFloat((limit + 0.01).toFixed(2))) {
                        alert(`Limit exceeded. You cannot pay more than GHS ${limit.toFixed(2)}.`);
                        return;
                      }
                      if (!payerName.trim() || !payerPhone.trim()) {
                        alert("Please enter payer's name and telephone number.");
                        return;
                      }
                      setPaymentStep('method');
                    }}
                    className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition cursor-pointer text-center"
                  >
                    Next: Pay Channel
                  </button>
                </div>
              </div>
            )}

            {paymentStep === 'method' && (
              <div className="p-6 md:p-8 space-y-5 text-xs text-left">
                {/* Channel Selectors */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Choose Gateway Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentChannel('paystack' as any)}
                      className={`p-3.5 border rounded-2xl flex flex-col items-center justify-center gap-1.5 transition cursor-pointer text-center select-none ${paymentChannel === ('paystack' as any) ? 'border-emerald-600 bg-emerald-50/20 text-emerald-900 font-black ring-1 ring-emerald-600' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}
                    >
                      <span className="text-lg">⚡</span>
                      <span className="font-bold text-[10px]">Real-time Paystack</span>
                      <span className="text-[8px] text-slate-400 font-sans leading-none">Instant Gate</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentChannel('momo')}
                      className={`p-3.5 border rounded-2xl flex flex-col items-center justify-center gap-1.5 transition cursor-pointer text-center select-none ${paymentChannel === 'momo' ? 'border-amber-500 bg-amber-500/5 text-amber-950 font-black ring-1 ring-amber-500' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}
                    >
                      <span className="text-lg">📱</span>
                      <span className="font-bold text-[10px]">Sandbox MoMo</span>
                      <span className="text-[8px] text-slate-400 font-sans leading-none font-medium">MTN / Telecel</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentChannel('card')}
                      className={`p-3.5 border rounded-2xl flex flex-col items-center justify-center gap-1.5 transition cursor-pointer text-center select-none ${paymentChannel === 'card' ? 'border-teal-600 bg-teal-50/50 text-teal-950 font-black ring-1 ring-teal-600' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}
                    >
                      <span className="text-lg">💳</span>
                      <span className="font-bold text-[10px]">Sandbox Card</span>
                      <span className="text-[8px] text-slate-400 font-sans leading-none font-medium">Visa / MM</span>
                    </button>
                  </div>
                </div>

                {/* Conditional Channel Forms */}
                {paymentChannel === ('paystack' as any) ? (
                  <div className="space-y-4">
                    <PaystackPaymentTrigger
                      studentId={studentId}
                      studentName={`${compiledReport.student.firstName} ${compiledReport.student.lastName}`}
                      email={payerEmail}
                      amount={paymentAmount}
                      academicYear={year}
                      term={term}
                      component={paymentComponent}
                      billId={fullBill?.id || `${studentId}_${year}_${term}`.replace(/\//g, '-')}
                      onSuccess={(verifiedData) => {
                        const finalReceipt = verifiedData.receiptNo || `GTIMS-PAY-${year.split('/')[0]}-${Math.floor(1000 + Math.random() * 9000)}`;
                        const today = new Date().toISOString().split('T')[0];
                        
                        const newPayment: any = {
                          id: verifiedData.reference,
                          amount: paymentAmount,
                          date: today,
                          component: paymentComponent,
                          method: 'Online Payment',
                          receiptNo: finalReceipt,
                          remarks: `Verified via Paystack. Ref: ${verifiedData.reference}`
                        };
                        
                        let targetBill: any;
                        if (fullBill) {
                          targetBill = {
                            ...fullBill,
                            payments: [...fullBill.payments, newPayment],
                            updatedAt: new Date().toISOString()
                          };
                        } else {
                          targetBill = {
                            id: `${studentId}_${year}_${term}`.replace(/\//g, '-'),
                            studentId,
                            studentName: `${compiledReport.student.firstName} ${compiledReport.student.lastName}`,
                            class: compiledReport.student.class,
                            academicYear: year as any,
                            term: term as any,
                            schoolFees: paymentComponent === 'School Fees' ? paymentAmount : 0,
                            utilityBill: paymentComponent === 'Utility Bill' ? paymentAmount : 0,
                            sportsFees: paymentComponent === 'Sports Fees' ? paymentAmount : 0,
                            ptaDues: paymentComponent === 'PTA dues' ? paymentAmount : 0,
                            transportationBill: paymentComponent === 'Transportation Bill' ? paymentAmount : 0,
                            otherFee: paymentComponent === 'Other Fee' ? paymentAmount : 0,
                            payments: [newPayment],
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                          };
                        }
                        
                        DbController.saveStudentFeeBill(targetBill);
                        
                        const refreshedBills = DbController.getStudentFeeBills();
                        setFeeBills(refreshedBills);
                        
                        setActiveReceipt({
                          receiptNo: finalReceipt,
                          amount: paymentAmount,
                          date: today,
                          component: paymentComponent,
                          method: 'Paystack Gateway (Verified)',
                          payerName: payerName || 'Parent / Guardian'
                        });
                        
                        setTimeout(() => {
                          setPaymentStep('success');
                        }, 1500);
                      }}
                      onCancel={() => setPaymentStep('details')}
                    />
                  </div>
                ) : (
                  <>
                    {paymentChannel === 'momo' ? (
                      <div className="space-y-3 p-4 bg-amber-50/20 border border-amber-200/50 rounded-2xl">
                        <div>
                          <label className="block text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1.5 text-left">Network Operator</label>
                          <div className="grid grid-cols-3 gap-2">
                            {['MTN', 'Telecel', 'AT'].map(provider => (
                              <button
                                key={provider}
                                type="button"
                                onClick={() => setMomoProvider(provider as any)}
                                className={`py-2 px-1 text-[10px] font-black border rounded-lg transition text-center cursor-pointer select-none ${momoProvider === provider ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                              >
                                {provider}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1.5 text-left">Subscriber MoMo Number</label>
                          <input
                            type="text"
                            placeholder="e.g. 0541234567"
                            value={momoNumber}
                            onChange={(e) => setMomoNumber(e.target.value)}
                            className="w-full bg-white px-3 py-2 border border-slate-200 rounded-xl font-mono text-slate-800 text-xs focus:outline-none"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 text-left font-sans">Cardholder Full Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Samuel Guardian"
                            className="w-full bg-white px-3 py-2 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 text-left">Card Number</label>
                          <input
                            type="text"
                            placeholder="xxxx xxxx xxxx xxxx"
                            value={cardNumber}
                            onChange={(e) => {
                              const v = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '').substr(0, 16);
                              const parts = [];
                              for (let i = 0; i < v.length; i += 4) {
                                parts.push(v.substr(i, 4));
                              }
                              setCardNumber(parts.join(' '));
                            }}
                            className="w-full bg-white px-3 py-2 border border-slate-200 rounded-xl font-mono text-slate-800 text-xs focus:outline-none text-left"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 text-left">Expiry MM/YY</label>
                            <input
                              type="text"
                              placeholder="MM/YY"
                              value={cardExpiry}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '').substr(0, 4);
                                if (val.length >= 2) {
                                  setCardExpiry(val.substr(0, 2) + '/' + val.substr(2));
                                } else {
                                  setCardExpiry(val);
                                }
                              }}
                              className="w-full bg-white px-3 py-2 border border-slate-200 rounded-xl font-mono text-slate-800 text-xs focus:outline-none text-center"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 text-left">CVV Code</label>
                            <input
                              type="password"
                              placeholder="•••"
                              maxLength={3}
                              value={cardCvv}
                              onChange={(e) => setCardCvv(e.target.value.replace(/[^0-9]/g, ''))}
                              className="w-full bg-white px-3 py-2 border border-slate-200 rounded-xl font-mono text-slate-800 text-xs focus:outline-none text-center"
                            />
                          </div>
                        </div>
                      </div>
                    )}
 
                    {/* Amount Confirmation Banner */}
                    <div className="flex justify-between items-center bg-slate-100 p-3 rounded-xl border border-slate-250">
                      <span className="font-bold text-slate-600">Total Charged:</span>
                      <strong className="text-slate-900 font-mono text-sm">GHS {paymentAmount.toFixed(2)}</strong>
                    </div>
 
                    {/* Actions */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => setPaymentStep('details')}
                        className="flex-1 py-3 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-xl transition cursor-pointer text-center"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => {
                          if (paymentChannel === 'momo' && !momoNumber.trim()) {
                            alert("Please provide the Subscriber Mobile Money number to proceed.");
                            return;
                          }
                          startProcessingPayment();
                        }}
                        className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition cursor-pointer text-center"
                      >
                        Authorize Payment
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {paymentStep === 'processing' && (
              <div className="p-8 text-center space-y-6">
                <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <div className="space-y-2">
                  <p className="font-bold text-sm text-slate-900">Processing Secure Transaction</p>
                  <p className="text-xs text-slate-500 font-mono leading-relaxed min-h-[40px] px-4">{processingStatus}</p>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1.5">
                  🛡️ SSL Secure 256-bit Interoperable Ledger Encryption
                </div>
              </div>
            )}

            {paymentStep === 'momo_otp' && (
              <div className="p-6 md:p-8 space-y-5 text-left text-xs">
                <div className="bg-amber-500 text-white p-3 rounded-xl flex items-center gap-2.5">
                  <span className="text-xl animate-bounce">📱</span>
                  <div>
                    <h4 className="font-sans font-bold leading-tight">Handset Push Triggered</h4>
                    <p className="text-[10px] opacity-90">Please authorize the prompt sent to {momoNumber}</p>
                  </div>
                </div>

                <div className="p-4 border border-amber-200 rounded-2xl bg-amber-50/10 space-y-3 font-sans">
                  <div className="text-center font-bold text-slate-700 text-[10px] uppercase font-sans tracking-wide">
                    {momoProvider} Mobile Money PIN Prompt
                  </div>
                  <div className="flex items-center justify-between border-b pb-2 text-[11px]">
                    <span className="text-slate-400">Merchant Name:</span>
                    <strong className="text-slate-800 font-sans">{schoolInfo.name || "GES Institution"}</strong>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2 text-[11px]">
                    <span className="text-slate-400">Merchant Code:</span>
                    <strong className="text-slate-800 font-mono">GH-{momoProvider}-0482</strong>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2 text-[11px]">
                    <span className="text-slate-400">Charge Total:</span>
                    <strong className="text-rose-700 font-mono">GHS {paymentAmount.toFixed(2)}</strong>
                  </div>

                  <div className="pt-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center mb-1.5">
                      Enter Mobile Wallet PIN
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      placeholder="••••"
                      value={momoPin}
                      onChange={(e) => setMomoPin(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-24 bg-slate-50 border border-slate-250 font-mono text-center font-bold text-lg py-1.5 rounded-xl mx-auto block tracking-widest focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setPaymentStep('method')}
                    className="flex-1 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-xl text-center block transition cursor-pointer"
                  >
                    Cancel / Back
                  </button>
                  <button
                    onClick={() => {
                      if (momoPin.length < 4) {
                        alert("Please input your 4-digit security PIN to authorize cellular dispatch.");
                        return;
                      }
                      setPaymentStep('processing');
                      setProcessingStatus('Securing authorized mobile ledger transfer...');
                      setTimeout(() => {
                        handleCompletePayment();
                      }, 1800);
                    }}
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-center block transition cursor-pointer"
                  >
                    Confirm PIN
                  </button>
                </div>
              </div>
            )}

            {paymentStep === 'success' && activeReceipt && (
              <div className="p-8 text-center space-y-6 text-xs font-sans">
                <div className="w-16 h-16 bg-emerald-50 border border-emerald-250 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl animate-bounce font-black">
                  ✓
                </div>
                
                <div className="space-y-1">
                  <h3 className="font-black text-slate-900 text-sm uppercase tracking-tight">Payment Transacted Successfully!</h3>
                  <p className="text-slate-400 text-[10px]">Your institutional ledger has been updated dynamically in real-time.</p>
                </div>

                {/* Receipt Grid */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left space-y-1.5 font-sans">
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-slate-400">Receipt No:</span>
                    <span className="font-mono font-bold text-slate-800">{activeReceipt.receiptNo}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-slate-400">Date Logged:</span>
                    <span className="text-slate-800">{activeReceipt.date}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-slate-400">Component Settled:</span>
                    <span className="text-slate-800 font-bold">{activeReceipt.component}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-slate-400">Payment Gateway:</span>
                    <span className="text-slate-800 font-bold">{activeReceipt.method}</span>
                  </div>
                  <div className="flex justify-between pt-1 font-bold text-sm">
                    <span className="text-slate-500">Amount Paid:</span>
                    <span className="text-emerald-700 font-mono font-black">GHS {activeReceipt.amount.toFixed(2)}</span>
                  </div>
                </div>

                {/* Success Action Buttons */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={async () => {
                      if (downloadingReceiptPdf) return;
                      setDownloadingReceiptPdf(true);
                      try {
                        const res = await generatePdfFromHtml('parent-portal-recent-receipt-area', `Receipt_${activeReceipt.receiptNo}.pdf`);
                        downloadBlobLocally(res.blob, res.filename);
                      } catch (err) {
                        console.error(err);
                        alert("PDF generation failed, please use the system print option.");
                      } finally {
                        setDownloadingReceiptPdf(false);
                      }
                    }}
                    disabled={downloadingReceiptPdf}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    {downloadingReceiptPdf ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" /> Fetching Document...
                      </>
                    ) : (
                      <>
                        <Download size={13} /> Save PDF Invoice
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="w-full py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-55 font-bold rounded-xl transition cursor-pointer"
                  >
                    Close Dialog
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
