import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Smartphone, Send, AlertTriangle, Search, Trash2, CheckCircle, RefreshCw, 
  MessageSquare, Sliders, Users, Info, MessageCircle
} from 'lucide-react';
import { Student, CLASSES, AcademicYearType, ACADEMIC_YEARS } from '../types';
import { DbController, getStorageItem, setStorageItem, removeStorageItem } from '../db';
import { ThemeStyles } from './ThemeWrapper';
import { generateSecureToken, getWhatsAppShareData, shareParentPortalWhatsApp, WhatsAppTemplate } from '../utils';

interface Props {
  theme: ThemeStyles;
  students: Student[];
  isAdmin?: boolean;
}

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  enabled: boolean;
}

interface DispatchLog {
  id: string;
  timestamp: string;
  studentId: string;
  studentName: string;
  guardianName: string;
  phoneNumber: string;
  message: string;
  channel: 'Twilio API' | 'Native Carrier' | 'Ghana Carrier (MTN)' | 'WhatsApp Direct';
  status: 'Delivered' | 'Failed' | 'Initiated' | 'Pending';
  errorDetails?: string;
  class: string;
}

// Predefined communication templates
const TEMPLATES = [
  {
    id: 'report_link',
    label: 'Academic Report Link Notice',
    text: 'Dear {guardianName}, the Term Report Card for {firstName} {lastName} ({class}) is now ready. Click here to securely view/download the full official grades and fee statement anytime: {reportLink}'
  },
  {
    id: 'assessment_reminder',
    label: 'Upcoming Assessment Reminder',
    text: 'Dear {guardianName}, please be reminded that {firstName} {lastName} ({class}) has upcoming assessments scheduled for next week. Kindly ensure they are well prepared. - {schoolName}'
  },
  {
    id: 'fee_reminder',
    label: 'Outstanding Fees Reminder',
    text: 'Dear {guardianName}, this is a gentle reminder that {firstName} {lastName} ({class}) has an outstanding school fee balance of GHS {feeBalance}. Please arrange for settlement. - {schoolName}'
  },
  {
    id: 'attendance_alert',
    label: 'Student Absence Alert',
    text: 'Urgent: Dear {guardianName}, {firstName} {lastName} ({class}) was recorded as ABSENT during today\'s morning registration call. Please contact the administration if you are unaware of this absence.'
  },
  {
    id: 'general_broadcast',
    label: 'General PTA & School Broadcast',
    text: 'Dear {guardianName}, please be informed that our upcoming general PTA congress will take place this Sunday at 2:00 PM in the main assembly hall. Agenda: Fee revisions and academic calendar. Thank you. - {schoolName}'
  }
];

export default function CommunicationsTab({ theme, students, isAdmin }: Props) {
  const [selectedClass, setSelectedClass] = useState<string>('All Classes');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('All Academic Years');
  const [targetFilter, setTargetFilter] = useState<'all' | 'outstanding_fees' | 'no_phone' | 'has_phone'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom SMS template state
  const [templateText, setTemplateText] = useState(TEMPLATES[0].text);
  const [selectedTemplateId, setSelectedTemplateId] = useState('report_link');

  // Dynamic system configs (fetched from DB custom parameters)
  const systemSettings = useMemo(() => DbController.getSystemSettings(), []);
  const [school, setSchool] = useState(() => DbController.getSchoolInfo());
  const activeYear = systemSettings.academicYear || '2026/2027';
  const activeTerm = systemSettings.term || 'Term 1';

  // Active channel selection: 'ghana-sms' (default) or 'twilio' or 'native-device' or 'whatsapp-direct'
  const [activeChannel, setActiveChannel] = useState<'ghana-sms' | 'twilio' | 'native-device' | 'whatsapp-direct'>(() => {
    const saved = getStorageItem('geetech_active_sms_channel', 'ghana-sms');
    return (saved as any) || 'ghana-sms';
  });

  // Paystack SMS wallet top-up states
  const [isInitializingPayment, setIsInitializingPayment] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [paymentRef, setPaymentRef] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
  const pollingTimerRef = useRef<any>(null);

  // Sync state
  const [isSyncingBalance, setIsSyncingBalance] = useState(false);

  // Clean interval ref on unmount
  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, []);

  // Retrieve Twilio configurations stored on local machine/DB settings
  const [twilioConfig, setTwilioConfig] = useState<TwilioConfig>(() => {
    const sInfo = DbController.getSchoolInfo();
    const localVal = getStorageItem<any>('geetech_twilio_config', { accountSid: '', authToken: '', fromNumber: '', enabled: false }) || { accountSid: '', authToken: '', fromNumber: '', enabled: false };
    return {
      accountSid: sInfo.twilioAccountSid || localVal.accountSid || '',
      authToken: sInfo.twilioAuthToken || localVal.authToken || '',
      fromNumber: sInfo.twilioFromNumber || localVal.fromNumber || '',
      enabled: sInfo.twilioEnabled !== undefined ? sInfo.twilioEnabled : (localVal.enabled || false)
    };
  });

  const [isTestingTwilio, setIsTestingTwilio] = useState(false);
  const [twilioTestResult, setTwilioTestResult] = useState<{
    success: boolean;
    message: string;
    accountName?: string;
    status?: string;
    type?: string;
  } | null>(null);

  const handleTestTwilioCredentials = async () => {
    setIsTestingTwilio(true);
    setTwilioTestResult(null);
    try {
      const res = await fetch('/api/communications/verify-twilio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          accountSid: twilioConfig.accountSid,
          authToken: twilioConfig.authToken
        })
      });

      const parsed = await res.json();
      if (res.ok && parsed.success) {
        setTwilioTestResult({
          success: true,
          message: parsed.message,
          accountName: parsed.accountName,
          status: parsed.status,
          type: parsed.type
        });
      } else {
        setTwilioTestResult({
          success: false,
          message: parsed.message || `HTTP ${res.status}: Credential authentication failed.`
        });
      }
    } catch (e: any) {
      setTwilioTestResult({
        success: false,
        message: e.message || 'Network interface connectivity failed. Please retry.'
      });
    } finally {
      setIsTestingTwilio(false);
    }
  };

  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [testSmsMessage, setTestSmsMessage] = useState('GEETECH Twilio API Gateway Handshake Successful!');
  const [isSendingHandshake, setIsSendingHandshake] = useState(false);
  const [handshakeResult, setHandshakeResult] = useState<{
    success: boolean;
    message: string;
    sid?: string;
  } | null>(null);

  const handleSendHandshake = async () => {
    if (!testPhoneNumber) {
      alert("Please enter a valid phone number in E.164 format (e.g. +233240000000).");
      return;
    }
    setIsSendingHandshake(true);
    setHandshakeResult(null);
    try {
      const res = await fetch('/api/communications/send-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: testPhoneNumber,
          body: testSmsMessage
        })
      });

      const parsed = await res.json();
      if (res.ok && parsed.success) {
        setHandshakeResult({
          success: true,
          message: "Outbound Handshake SMS successfully processed and queued by Twilio gateway!",
          sid: parsed.sid
        });
        
        // Let's add it to the SMS Logs table for persistent visibility!
        const newLog: DispatchLog = {
          id: `SMS_TEST_${Date.now()}`,
          timestamp: new Date().toISOString(),
          studentId: 'test_handshake',
          studentName: 'Diagnostic Handshake',
          guardianName: 'Sysadmin Sandbox',
          phoneNumber: testPhoneNumber,
          message: testSmsMessage,
          channel: 'Twilio API',
          status: 'Delivered',
          class: 'SYSTEM'
        };
        const updated = [newLog, ...smsLogs];
        setSmsLogs(updated);
        setStorageItem('sms_communication_sent_logs', updated);
      } else {
        setHandshakeResult({
          success: false,
          message: parsed.message || `Outbound Handshake rejected: Status HTTP ${res.status}`
        });
      }
    } catch (e: any) {
      setHandshakeResult({
        success: false,
        message: e.message || 'Connection handshake timed out.'
      });
    } finally {
      setIsSendingHandshake(false);
    }
  };

  // SMS logs list 
  const [smsLogs, setSmsLogs] = useState<DispatchLog[]>(() => {
    return getStorageItem<DispatchLog[]>('sms_communication_sent_logs', []);
  });

  // Selected recipient IDs (individual student IDs to send to)
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  
  // Bulk dispatch state
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkStatusText, setBulkStatusText] = useState('');
  const [bulkSuccessCount, setBulkSuccessCount] = useState(0);
  const [bulkFailedCount, setBulkFailedCount] = useState(0);
  const [cancelBulkSignal, setCancelBulkSignal] = useState(false);

  // Fetch outstanding fee bills mapping for efficient lookups
  const feeBillsMap = useMemo(() => {
    const list = DbController.getStudentFeeBills();
    const map: Record<string, number> = {};
    const yearToUse = selectedAcademicYear === 'All Academic Years' ? activeYear : selectedAcademicYear;
    list.forEach(bill => {
      // We look for active term bill
      if (bill.academicYear === yearToUse && bill.term === activeTerm) {
        const totalBilled = (bill.schoolFees || 0) + (bill.utilityBill || 0) + (bill.sportsFees || 0) + (bill.ptaDues || 0) + (bill.transportationBill || 0) + (bill.otherFee || 0);
        const totalPaid = (bill.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
        map[bill.studentId] = Math.max(0, totalBilled - totalPaid);
      }
    });
    return map;
  }, [activeYear, activeTerm, selectedAcademicYear]);

  // Handle template selection
  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    const tmpl = TEMPLATES.find(t => t.id === id);
    if (tmpl) {
      setTemplateText(tmpl.text);
    }
  };

  // Helper insertion helper 
  const insertVariableTag = (tag: string) => {
    setTemplateText(prev => prev + tag);
  };

  // Compile individual sms content dynamically
  const compileMessage = (student: Student, template: string) => {
    const yearToUse = selectedAcademicYear === 'All Academic Years' ? activeYear : selectedAcademicYear;
    const token = generateSecureToken(student.id, yearToUse, activeTerm);
    const portalUrl = `${window.location.origin}/?studentId=${student.id}&year=${encodeURIComponent(yearToUse)}&term=${encodeURIComponent(activeTerm)}&token=${token}`;
    const feeBalanceVal = feeBillsMap[student.id] !== undefined ? feeBillsMap[student.id] : 0;

    return template
      .replace(/{guardianName}/g, student.guardianName || `${student.firstName} ${student.lastName} Parent`)
      .replace(/{firstName}/g, student.firstName || '')
      .replace(/{lastName}/g, student.lastName || '')
      .replace(/{class}/g, student.class || '')
      .replace(/{feeBalance}/g, feeBalanceVal.toString())
      .replace(/{schoolName}/g, school.name || 'GEETECH School Center')
      .replace(/{reportLink}/g, portalUrl);
  };

  // Filter students to send communications to
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      // 1. Class filter
      if (selectedClass !== 'All Classes' && s.class !== selectedClass) return false;

      // 2. Academic Year filter
      if (selectedAcademicYear !== 'All Academic Years' && s.academicYear !== selectedAcademicYear) return false;

      // 3. Target specific rules
      const hasTelephone = s.guardianTelephone && s.guardianTelephone.trim().length > 3;
      const feeVal = feeBillsMap[s.id] || 0;

      if (targetFilter === 'outstanding_fees' && feeVal <= 0) return false;
      if (targetFilter === 'no_phone' && hasTelephone) return false;
      if (targetFilter === 'has_phone' && !hasTelephone) return false;

      // 4. Search query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const fullMatches = `${s.firstName} ${s.lastName} ${s.guardianName} ${s.id} ${s.guardianTelephone}`.toLowerCase();
        if (!fullMatches.includes(q)) return false;
      }

      return true;
    });
  }, [students, selectedClass, selectedAcademicYear, targetFilter, searchQuery, feeBillsMap]);

  // Auto-select all matching filtered students when filter or class updates
  useEffect(() => {
    setSelectedStudentIds(filteredStudents.filter(s => s.guardianTelephone && s.guardianTelephone.trim().length > 3).map(s => s.id));
  }, [filteredStudents]);

  // Mass toggle selections
  const handleToggleAll = () => {
    const validRecipients = filteredStudents.filter(s => s.guardianTelephone && s.guardianTelephone.trim().length > 3);
    if (selectedStudentIds.length === validRecipients.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(validRecipients.map(s => s.id));
    }
  };

  const handleToggleOne = (id: string) => {
    setSelectedStudentIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // Construct standard cellular Native SMS App dispatch URI
  const getNativeSmsHref = (student: Student) => {
    const phone = (student.guardianTelephone || '').trim().replace(/[\s\-\(\)]/g, '');
    const textMsg = compileMessage(student, templateText);
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
    return isIOS ? `sms:${phone}&body=${encodeURIComponent(textMsg)}` : `sms:${phone}?body=${encodeURIComponent(textMsg)}`;
  };

  const logNativeSmsDispatch = (student: Student) => {
    const textMsg = compileMessage(student, templateText);
    const newLog: DispatchLog = {
      id: `SMS_${Date.now()}_${student.id}`,
      timestamp: new Date().toISOString(),
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      guardianName: student.guardianName || 'Guardian',
      phoneNumber: student.guardianTelephone || '',
      message: textMsg,
      channel: 'Native Carrier',
      status: 'Initiated',
      class: student.class
    };

    setSmsLogs(prev => {
      const updatedLogs = [newLog, ...prev];
      setStorageItem('sms_communication_sent_logs', updatedLogs);
      return updatedLogs;
    });
  };

  // Construct standard WhatsApp dispatch URI
  const getWhatsAppHref = (student: Student) => {
    let phone = (student.guardianTelephone || '').trim().replace(/[\s\-\(\)\+]/g, '');
    if (phone.startsWith('0') && phone.length === 10) {
      phone = '233' + phone.substring(1);
    }
    const textMsg = compileMessage(student, templateText);
    return `https://wa.me/${phone}?text=${encodeURIComponent(textMsg)}`;
  };

  const logWhatsAppDispatch = (student: Student) => {
    const textMsg = compileMessage(student, templateText);
    const newLog: DispatchLog = {
      id: `WA_${Date.now()}_${student.id}`,
      timestamp: new Date().toISOString(),
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      guardianName: student.guardianName || 'Guardian',
      phoneNumber: student.guardianTelephone || '',
      message: textMsg,
      channel: 'WhatsApp Direct',
      status: 'Initiated',
      class: student.class
    };

    setSmsLogs(prev => {
      const updatedLogs = [newLog, ...prev];
      setStorageItem('sms_communication_sent_logs', updatedLogs);
      return updatedLogs;
    });
  };

  // Synchronize SMS Balance with remote Firestore server
  const syncSmsBalance = async (quiet = false) => {
    if (!quiet) setIsSyncingBalance(true);
    try {
      await DbController.syncAllDataFromFirebase();
      const freshSchoolInfo = DbController.getSchoolInfo();
      setSchool(freshSchoolInfo);
    } catch (e) {
      console.error("Failed to fetch fresh school profile context during sync:", e);
    } finally {
      if (!quiet) setIsSyncingBalance(false);
    }
  };

  // Launch SMS prepaid wallet payment via Paystack checkout redirection
  const triggerSmsTopUp = async (amountGhs: number) => {
    setIsInitializingPayment(true);
    setPaymentStatus('pending');
    setCheckoutUrl(null);
    try {
      const res = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'school_default_sms@geetechedulayer.com',
          amount: amountGhs,
          studentId: 'school_default',
          billId: `SMS_TOPUP_${Date.now()}`,
          component: 'SMS Credits',
          academicYear: activeYear,
          term: activeTerm
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCheckoutUrl(data.data.authorization_url);
        setPaymentRef(data.data.reference);
        
        // Load official Paystack checkout popup
        const newWin = window.open(data.data.authorization_url, '_blank');
        if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
          console.warn("Popup windows blocked by browser security layer. Redirecting manually...");
        }
        
        // Boot background verifier poller
        startLocalPaymentPolling(data.data.reference);
      } else {
        alert(data.message || "Failed to initialize Paystack checkout session.");
        setPaymentStatus('failed');
      }
    } catch (e: any) {
      alert("Handshake error with Paystack engine: " + e.message);
      setPaymentStatus('failed');
    } finally {
      setIsInitializingPayment(false);
    }
  };

  // Poll Paystack transaction status under client reference
  const startLocalPaymentPolling = (ref: string) => {
    if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    
    pollingTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/verify/${ref}`);
        const data = await res.json();
        if (res.ok && data.success) {
          if (data.status === 'success') {
            clearInterval(pollingTimerRef.current);
            setPaymentStatus('success');
            setCheckoutUrl(null);
            
            // Full background sync to pull fresh wallet balances
            await syncSmsBalance(true);
            
            const rate = school.smsRate || 20;
            alert(`🎉 PAYMENT SUCCESSFUL! Your SMS carrier wallet has been credited with GHS ${data.data.amount} (+${Math.round(data.data.amount * rate)} Ghana MTN Carrier Credits).`);
          } else if (data.status === 'failed') {
            clearInterval(pollingTimerRef.current);
            setPaymentStatus('failed');
            alert("Payment has failed or been cancelled by the administrator.");
          }
        }
      } catch (err) {
        console.error("Local Top Up Polling Error:", err);
      }
    }, 4000);
  };

  // Perform integrated Real API Twilio HTTP Dispatch REST query via server-side secure proxy
  const runRealTwilioSend = async (phone: string, message: string): Promise<{ success: boolean; sid?: string; error?: string }> => {
    try {
      const res = await fetch('/api/communications/send-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: phone.trim(),
          body: message
        })
      });

      const parsed = await res.json();
      if (res.ok && parsed.success) {
        return { success: true, sid: parsed.sid };
      } else {
        return { success: false, error: parsed.message || `API Error: ${res.status}` };
      }
    } catch (e: any) {
      return { success: false, error: e.message || 'Server connection failed' };
    }
  };

  // Perform virtualized MTN Ghana Carrier high-frequency transmission (deducts 1 balance credit)
  const runGhanaSmsSend = async (phone: string, message: string): Promise<{ success: boolean; sid?: string; error?: string }> => {
    try {
      const res = await fetch('/api/communications/send-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: phone.trim(),
          body: message,
          channel: 'ghana-sms'
        })
      });

      const parsed = await res.json();
      if (res.ok && parsed.success) {
        return { success: true, sid: parsed.sid };
      } else {
        return { success: false, error: parsed.message || `GSM dispatch failed` };
      }
    } catch (e: any) {
      return { success: false, error: e.message || 'Carrier line interface timeout' };
    }
  };

  // Execute sequential bulk messaging queue
  const handleBulkDispatch = async () => {
    const count = selectedStudentIds.length;
    if (count === 0) return;

    if (activeChannel === 'native-device') {
      alert("Sequential automated background queue dispatching is only supported when utilizing digital Cloud Gateways. For Native carriers, please click the blue cellular icons individually on the list rows below to populate your device's default SMS client.");
      return;
    }

    if (activeChannel === 'twilio' && !twilioConfig.enabled) {
      alert("Twilio Cloud API dispatch is toggled OFF in credentials layer below. Set it to ACTIVE to proceed, or choose 'Ghana SMS Carrier Network' to dispatch using your Paystack wallet balance.");
      return;
    }

    if (activeChannel === 'ghana-sms') {
      const availableCredits = school.smsBalance || 0;
      if (availableCredits < count) {
        alert(`Insufficient Wallet Balance: This broadcast requires ${count} Ghana SMS credits, but your pre-paid carrier balance has only ${availableCredits} credits. Please scroll down and top up your wallet via Paystack.`);
        return;
      }
    }

    const proposalPrompt = activeChannel === 'ghana-sms'
      ? `MTN GHANA SMS BROADCAST: Dispatch ${count} real automated parent messages? This will deduct ${count} SMS units from your Paystack-funded prepaid balance.`
      : activeChannel === 'whatsapp-direct'
        ? `WHATSAPP BROADCAST: Preparing ${count} personalized messages. This will attempt to open ${count} WhatsApp chat windows sequentially. Please allow popups if prompted. Proceed?`
        : `TWILIO BROADCAST PROPOSAL: Dispatch ${count} automated parent messages via your Twilio Cloud account?`;

    if (window.confirm(proposalPrompt)) {
      setIsBulkSending(true);
      setBulkProgress(0);
      setBulkSuccessCount(0);
      setBulkFailedCount(0);
      setCancelBulkSignal(false);
      setBulkStatusText(activeChannel === 'whatsapp-direct' ? 'Launching WhatsApp Dispatcher...' : 'Connecting to cellular network transceivers...');

      const recipientList = students.filter(s => selectedStudentIds.includes(s.id));
      let currentLogs = [...smsLogs];

      for (let i = 0; i < recipientList.length; i++) {
        if (cancelBulkSignal) {
          setBulkStatusText('Broadcast sequence cancelled by the administrator.');
          break;
        }

        const student = recipientList[i];
        setBulkStatusText(`Processing ${student.firstName} ${student.lastName} (${i + 1}/${count})...`);
        setBulkProgress(Math.round(((i + 1) / count) * 100));

        const msgText = compileMessage(student, templateText);
        const parentPhone = student.guardianTelephone || '';

        let result;
        if (activeChannel === 'ghana-sms') {
          result = await runGhanaSmsSend(parentPhone, msgText);
          if (result.success) {
            setSchool(prev => ({
              ...prev,
              smsBalance: Math.max(0, (prev.smsBalance || 0) - 1)
            }));
          }
        } else if (activeChannel === 'whatsapp-direct') {
          const waHref = getWhatsAppHref(student);
          window.open(waHref, '_blank');
          logWhatsAppDispatch(student);
          result = { success: true };
        } else {
          result = await runRealTwilioSend(parentPhone, msgText);
        }

        const newLog: DispatchLog = {
          id: `${activeChannel === 'whatsapp-direct' ? 'WA' : 'SMS'}_${Date.now()}_${student.id}_bulk`,
          timestamp: new Date().toISOString(),
          studentId: student.id,
          studentName: `${student.firstName} ${student.lastName}`,
          guardianName: student.guardianName,
          phoneNumber: parentPhone,
          message: msgText,
          channel: activeChannel === 'ghana-sms' ? 'Ghana Carrier (MTN)' : activeChannel === 'whatsapp-direct' ? 'WhatsApp Direct' : 'Twilio API',
          status: result.success ? 'Delivered' : 'Failed',
          errorDetails: result.error,
          class: student.class
        };

        if (result.success) {
          setBulkSuccessCount(p => p + 1);
        } else {
          setBulkFailedCount(p => p + 1);
        }

        currentLogs = [newLog, ...currentLogs];
        setSmsLogs(currentLogs);
        setStorageItem('sms_communication_sent_logs', currentLogs);

        // Fast pacing delay so updates feel instantaneous yet tangible
        await new Promise(r => setTimeout(r, activeChannel === 'ghana-sms' ? 250 : 600));
      }

      setIsBulkSending(false);
      setBulkStatusText(`Broadcast process finalized! Successfully transmitted: ${bulkSuccessCount} | Faulty: ${bulkFailedCount}`);
      
      // Pull latest from Firestore to sync exact remaining credits
      syncSmsBalance(true);
    }
  };

  // Perform parent notification send on an individual row basis with full channel sensitivity
  const handleSingleSend = async (student: Student, parsedMsg: string) => {
    const parentPhone = (student.guardianTelephone || '').trim();
    if (!parentPhone) {
      alert("This student profile has no guardian telephone number defined.");
      return;
    }

    if (activeChannel === 'native-device') {
      const href = getNativeSmsHref(student);
      window.open(href, '_blank');
      logNativeSmsDispatch(student);
      return;
    }

    if (activeChannel === 'ghana-sms') {
      const currentBalance = school.smsBalance || 0;
      if (currentBalance <= 0) {
        alert("Prepaid Wallet Exhausted: Your Ghana SMS prepaid wallet balance is 0. Please scroll down and top up your wallet via Paystack to send this message.");
        return;
      }

      const confirmMsg = `MTN GHANA CARRIER DISPATCH: Transmit individual Parent notification to ${student.guardianName}? (Deducts 1 SMS credit)`;
      if (window.confirm(confirmMsg)) {
        const result = await runGhanaSmsSend(parentPhone, parsedMsg);
        if (result.success) {
          alert("Parent notification successfully processed via Ghana cellular networks!");
          // Live credit deduction
          const updatedBalance = Math.max(0, currentBalance - 1);
          setSchool(prev => ({ ...prev, smsBalance: updatedBalance }));

          const newLog: DispatchLog = {
            id: `SMS_${Date.now()}_single_${student.id}`,
            timestamp: new Date().toISOString(),
            studentId: student.id,
            studentName: `${student.firstName} ${student.lastName}`,
            guardianName: student.guardianName,
            phoneNumber: parentPhone,
            message: parsedMsg,
            channel: 'Ghana Carrier (MTN)',
            status: 'Delivered',
            class: student.class
          };
          const logs = [newLog, ...smsLogs];
          setSmsLogs(logs);
          setStorageItem('sms_communication_sent_logs', logs);
        } else {
          alert(`GSM Transmission Failure: ${result.error}`);
        }
      }
      return;
    }

    // Default Twilio
    const confirmMsg = `TWILIO CLOUD DISPATCH: Transmit real API notification to ${student.guardianName}?`;
    if (window.confirm(confirmMsg)) {
      const result = await runRealTwilioSend(parentPhone, parsedMsg);
      if (result.success) {
        alert("Individual SMS successfully processed via Twilio network!");
        const newLog: DispatchLog = {
          id: `SMS_${Date.now()}_single_${student.id}`,
          timestamp: new Date().toISOString(),
          studentId: student.id,
          studentName: `${student.firstName} ${student.lastName}`,
          guardianName: student.guardianName,
          phoneNumber: parentPhone,
          message: parsedMsg,
          channel: 'Twilio API',
          status: 'Delivered',
          class: student.class
        };
        const logs = [newLog, ...smsLogs];
        setSmsLogs(logs);
        setStorageItem('sms_communication_sent_logs', logs);
      } else {
        alert(`Twilio Transmission Failure: ${result.error}`);
      }
    }
  };

  // Clean communication history logs safely
  const handleClearLogs = () => {
    if (window.confirm("Are you sure you want to permanently clear the dispatch transaction log ledger? This will erase all audit trails.")) {
      setSmsLogs([]);
      removeStorageItem('sms_communication_sent_logs');
    }
  };

  // Handle saving Twilio fields
  const handleSaveTwilioSetting = (field: keyof TwilioConfig, value: any) => {
    const updated = { ...twilioConfig, [field]: value };
    setTwilioConfig(updated);
    setStorageItem('geetech_twilio_config', updated);

    // Persist to the core database School record
    try {
      const school = DbController.getSchoolInfo();
      const dbFieldMap: Record<keyof TwilioConfig, string> = {
        accountSid: 'twilioAccountSid',
        authToken: 'twilioAuthToken',
        fromNumber: 'twilioFromNumber',
        enabled: 'twilioEnabled'
      };
      const dbField = dbFieldMap[field];
      if (dbField) {
        DbController.saveSchoolInfo({
          ...school,
          [dbField]: value
        });
      }
    } catch (e) {
      console.error("Failed to replicate Twilio parameters to central cloud server:", e);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* HEADER BAR & GATEWAY SELECTION CONTROL CENTRE */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-55 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Smartphone size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-950 font-display uppercase tracking-tight">Parental Broadcast & SMS Center</h2>
              <p className="text-xs text-slate-500 font-medium">Draft dynamic templates, personalization-merge parent metrics and dispatch bulk updates instantly.</p>
            </div>
          </div>

          {/* ACTIVE DISPATCH CHANNEL CONTROLLER SEGMENT */}
          <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded-2xl">
            <button
              onClick={() => {
                setActiveChannel('ghana-sms');
                setStorageItem('geetech_active_sms_channel', 'ghana-sms');
              }}
              className={`p-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeChannel === 'ghana-sms'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full bg-white ${activeChannel === 'ghana-sms' ? 'animate-ping' : ''}`} />
              <span>🇬🇭 Ghana Carrier Network</span>
            </button>
            <button
              onClick={() => {
                setActiveChannel('twilio');
                setStorageItem('geetech_active_sms_channel', 'twilio');
              }}
              className={`p-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeChannel === 'twilio'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
              <span>Twilio Cloud API</span>
            </button>
            <button
              onClick={() => {
                setActiveChannel('native-device');
                setStorageItem('geetech_active_sms_channel', 'native-device');
              }}
              className={`p-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeChannel === 'native-device'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>Cellular Share App</span>
            </button>
            <button
              onClick={() => {
                setActiveChannel('whatsapp-direct');
                setStorageItem('geetech_active_sms_channel', 'whatsapp-direct');
              }}
              className={`p-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeChannel === 'whatsapp-direct'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <MessageCircle size={14} />
              <span>WhatsApp Direct</span>
            </button>
          </div>
        </div>

        {/* CHANNEL STATUS BANNER & INTEGRATED PAYSTACK WALLET TOP UP DRAWER */}
        {activeChannel === 'ghana-sms' && (
          <div id="sms-paystack-wallet-panel" className="bg-gradient-to-br from-amber-50/70 via-white to-amber-50/20 border border-amber-200/80 rounded-2xl p-5 shadow-8xs space-y-4 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500 text-white rounded-lg flex items-center justify-center font-bold font-mono text-sm shadow-6xs">
                  GHS
                </div>
                <div>
                  <div className="text-[10px] font-black text-amber-600 uppercase tracking-wider">Ghana SMS Carrier Prepaid Wallet</div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black text-slate-900 font-mono">
                      {school.smsBalance !== undefined ? Math.round(Number(school.smsBalance)) : 0}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">remaining SMS units</span>
                    
                    {/* Sync Balance Button */}
                    <button
                      onClick={() => syncSmsBalance()}
                      disabled={isSyncingBalance}
                      className="p-1 px-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-md text-[10px] font-bold transition inline-flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                      title="Fetch live balances from Firestore"
                    >
                      <RefreshCw size={10} className={isSyncingBalance ? 'animate-spin' : ''} />
                      {isSyncingBalance ? 'Syncing...' : 'Sync Balance'}
                    </button>
                  </div>
                </div>
              </div>

              {/* PAYSTACK ACTION PRESETS */}
              <div className="flex flex-col space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right md:text-right text-left">
                  Purchase Broadcast Units via Paystack (MoMo / Card)
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => triggerSmsTopUp(15)}
                    disabled={isInitializingPayment}
                    className="p-2 px-3 bg-white hover:bg-amber-50/40 border border-amber-250 text-amber-950 rounded-xl text-xs font-bold transition shadow-8xs disabled:opacity-50 cursor-pointer text-left inline-flex flex-col"
                  >
                    <span className="font-mono">GHS 15.00</span>
                    <span className="text-[9px] text-amber-600 font-semibold">+{15 * (school.smsRate || 20)} SMS credits</span>
                  </button>
                  <button
                    onClick={() => triggerSmsTopUp(50)}
                    disabled={isInitializingPayment}
                    className="p-2 px-3 bg-white hover:bg-amber-50/40 border border-amber-250 text-amber-950 rounded-xl text-xs font-bold transition shadow-8xs disabled:opacity-50 cursor-pointer text-left inline-flex flex-col"
                  >
                    <span className="font-mono">GHS 50.00</span>
                    <span className="text-[9px] text-amber-600 font-semibold">+{50 * (school.smsRate || 20)} SMS credits</span>
                  </button>
                  <button
                    onClick={() => triggerSmsTopUp(100)}
                    disabled={isInitializingPayment}
                    className="p-2 px-3 bg-white hover:bg-amber-50/40 border border-amber-250 text-amber-950 rounded-xl text-xs font-bold transition shadow-8xs disabled:opacity-50 cursor-pointer text-left inline-flex flex-col"
                  >
                    <span className="font-mono">GHS 100.00</span>
                    <span className="text-[9px] text-amber-600 font-semibold">+{100 * (school.smsRate || 20)} SMS credits</span>
                  </button>
                  <button
                    onClick={() => triggerSmsTopUp(220)}
                    disabled={isInitializingPayment}
                    className="p-2 px-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl text-xs font-black transition shadow-7xs hover:opacity-90 disabled:opacity-50 cursor-pointer text-left inline-flex flex-col"
                  >
                    <span className="font-mono">GHS 220.00</span>
                    <span className="text-[9px] text-amber-100 font-bold">+{220 * (school.smsRate || 20)} SMS credits</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Explanatory Charging Card */}
            <div className="bg-amber-50/30 border border-amber-100 rounded-xl p-3 text-[11px] text-amber-900 flex gap-2.5 items-start">
              <Info size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <span className="font-bold block">Wallet Billing Policy & Charging Model</span>
                <p className="text-slate-600 leading-normal">
                  <strong>Who is charged?</strong> This carrier wallet is funded exclusively by the school administration (not parents or teachers). Each dispatched SMS message deducts exactly 1 credit from this school balance. Parents receive notifications completely free of charge.
                </p>
                <p className="text-slate-500 text-[10px]">
                  Current rate: <strong>GHS 1.00 = {school.smsRate || 20} SMS credits</strong> (only <strong>GHS {(1 / (school.smsRate || 20)).toFixed(3)}</strong> per message – highly lowered for optimal operational budget).
                </p>
              </div>
            </div>

            {paymentStatus === 'pending' && (
              <div className="bg-amber-100/50 border border-amber-200 p-3 rounded-xl flex items-center justify-between text-xs font-semibold text-amber-900 animate-pulse">
                <div className="flex items-center gap-2">
                  <RefreshCw className="animate-spin text-amber-600" size={13} />
                  <span>Awaiting Paystack checkout approval. If checkout page didn't open automatically, please click below.</span>
                </div>
                {checkoutUrl && (
                  <a
                    href={checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-indigo-600 font-black"
                  >
                    Open Checkout Invoice &rarr;
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* TWILIO ACTIVE STATUS */}
        {activeChannel === 'twilio' && (
          <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${twilioConfig.enabled && twilioConfig.accountSid ? 'bg-emerald-500 animate-pulse' : 'bg-rose-400'}`} />
              <div>
                <div className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">Twilio Cloud Gateway</div>
                <div className="text-xs text-slate-600 font-semibold">
                  {twilioConfig.enabled && twilioConfig.accountSid 
                    ? `Twilio client fully configured and online (Sender: ${twilioConfig.fromNumber || 'Unspecified'})`
                    : 'Twilio setup is currently disabled or incomplete. Scroll down to enter your Twilio keys.'}
                </div>
              </div>
            </div>
            {!twilioConfig.enabled && (
              <div className="text-xs text-amber-800 bg-amber-50 border border-amber-100 p-2 rounded-lg font-bold">
                ⚠️ Twilio is configured to OFF. All individual row dispatches will fall back to E.164.
              </div>
            )}
          </div>
        )}

        {/* FREE DEVICE REDIRECT STATUS */}
        {activeChannel === 'native-device' && (
          <div className="bg-indigo-50/50 border border-indigo-200 rounded-2xl p-4 flex items-center gap-3 animate-fade-in">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
            <div>
              <div className="text-[10px] font-black text-indigo-800 uppercase tracking-wider font-display">Personal Handset Cellular Share Redirection (E.164 Mode)</div>
              <p className="text-xs text-slate-600 leading-normal font-semibold">
                No configurations, keys, or payments required! The bento transmitter compiles customized parent messages and formats deep links. Clicking row icons pops up your device's native SMS application, sending from your standard carrier carrier lines.
              </p>
            </div>
          </div>
        )}

        {/* WHATSAPP DIRECT STATUS */}
        {activeChannel === 'whatsapp-direct' && (
          <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 animate-fade-in">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div className="flex-1">
              <div className="text-[10px] font-black text-emerald-800 uppercase tracking-wider font-display">WhatsApp Direct Handshake Pipeline</div>
              <p className="text-xs text-slate-600 leading-normal font-semibold">
                Bypasses standard SMS protocols! Generates deep-linked WhatsApp messages for each guardian including secure Parent Portal access tokens. Clicking row icons pops up WhatsApp Web or Desktop pre-filled with the tailored template.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* THREE SECTION BENTO GRID LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: TEMPLATE EDITOR & DRAFT CONTROLLER (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <h3 className="text-xs font-black text-slate-950 uppercase tracking-wider flex items-center gap-1.5 font-display">
              <Sliders className="text-indigo-600" size={14} /> 1. Configure Template Content
            </h3>

            {/* QUICK PRE-SET SELECTOR */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fast Presets</label>
              <div className="grid grid-cols-1 gap-2">
                {TEMPLATES.map(tmpl => (
                  <button
                    key={tmpl.id}
                    onClick={() => handleSelectTemplate(tmpl.id)}
                    className={`px-3 py-2 text-left text-xs font-bold rounded-xl border transition flex items-center justify-between ${selectedTemplateId === tmpl.id ? 'bg-indigo-50 border-indigo-200 text-indigo-950' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-650'}`}
                  >
                    <span>{tmpl.label}</span>
                    <span className="text-[9px] font-mono text-slate-400">{selectedTemplateId === tmpl.id ? 'Active' : 'Select'}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* DRAFTING ENGINE CONTAINER */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Custom SMS Message Template:</span>
                <span className="text-[9.5px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-bold">
                  Chars: {templateText.length} ({Math.ceil(templateText.length / 160)} SMS Parts)
                </span>
              </div>
              
              <textarea
                rows={5}
                value={templateText}
                onChange={(e) => {
                  setTemplateText(e.target.value);
                  setSelectedTemplateId('custom');
                }}
                className="w-full text-xs p-3.5 border border-slate-200 rounded-xl bg-slate-50 font-medium text-slate-700 leading-relaxed focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Compose custom template body here..."
              />

              {/* DYNAMIC MERGE SHORTCUT CHIPS */}
              <div className="space-y-1.5">
                <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-widest block">Insert Personalization Token Helpers:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { tag: '{guardianName}', label: 'Parent Name' },
                    { tag: '{firstName}', label: 'Student First Name' },
                    { tag: '{lastName}', label: 'Student Last Name' },
                    { tag: '{class}', label: 'Class' },
                    { tag: '{feeBalance}', label: 'Fee Balance' },
                    { tag: '{reportLink}', label: 'Report Portal URL' },
                    { tag: '{schoolName}', label: 'School Name' }
                  ].map(item => (
                    <button
                      key={item.tag}
                      type="button"
                      onClick={() => insertVariableTag(item.tag)}
                      className="px-2 py-1 bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-600 hover:text-indigo-950 font-bold font-mono text-[9.5px] rounded-lg transition"
                    >
                      {item.tag}
                    </button>
                  ))}
                </div>
                <p className="text-[9.5px] text-slate-400 italic mt-1 font-medium leading-normal">Variables are dynamically replaced with real-time student indexes at transmission.</p>
              </div>
            </div>

            {/* SEND CONSOLE CONTROL */}
            {isBulkSending ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-950 animate-pulse flex items-center gap-1.5">
                    <RefreshCw size={12} className="animate-spin" /> Batch Transmission Launching
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-indigo-100 text-indigo-900 px-1.5 py-0.5 rounded">{bulkProgress}%</span>
                </div>
                
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${bulkProgress}%` }} />
                </div>
                
                <p className="text-[10px] font-medium text-slate-500 font-mono text-center">{bulkStatusText}</p>
                
                <div className="flex justify-between items-center text-[10.5px] bg-white p-2 border border-slate-100 rounded-lg">
                  <span className="text-emerald-700 font-black">✔ Delivered: {bulkSuccessCount}</span>
                  <span className="text-rose-600 font-black">☎ Faulty: {bulkFailedCount}</span>
                  <button
                    onClick={() => setCancelBulkSignal(true)}
                    className="px-2 py-0.5 text-[9px] bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 font-bold rounded cursor-pointer"
                  >
                    Abort Send
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={selectedStudentIds.length === 0}
                  onClick={handleBulkDispatch}
                  className={`w-full py-3 rounded-xl font-bold text-xs shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 cursor-pointer transition active:translate-y-0.5 ${selectedStudentIds.length === 0 ? 'bg-slate-100 border border-slate-200 text-slate-450 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                >
                  <Send size={15} /> Core Emit Automated Broadcast ({selectedStudentIds.length} Recipients selected)
                </button>
                <div className="text-[9.5px] text-slate-400 text-center font-medium leading-relaxed">
                  Bulk dispatching uses standard local/cloud pipelines. Only parents with verified telephone numbers are listed.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: AUDIENCE BUILDER & ACTIVE LIVE-MERGE LIST (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 flex flex-col min-h-[400px]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-150 pb-4">
              <div>
                <h3 className="text-xs font-black text-slate-950 uppercase tracking-wider flex items-center gap-1.5 font-display">
                  <Users className="text-indigo-600" size={14} /> 2. Audience Selection & Live Merge Preview
                </h3>
                <p className="text-[11px] text-slate-400">Personalized outputs based on current template content and databases.</p>
              </div>

              {/* SECTIONS / CLASSES FILTERS */}
              <div className="flex flex-wrap gap-1.5">
                <select
                  value={selectedAcademicYear}
                  onChange={(e) => setSelectedAcademicYear(e.target.value)}
                  className="bg-white px-2.5 py-1.5 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                >
                  <option value="All Academic Years">All Academic Years</option>
                  {ACADEMIC_YEARS.map(yr => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>

                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="bg-white px-2.5 py-1.5 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                >
                  <option value="All Classes">All Classes</option>
                  {CLASSES.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>

                <select
                  value={targetFilter}
                  onChange={(e) => setTargetFilter(e.target.value as any)}
                  className="bg-white px-2.5 py-1.5 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                >
                  <option value="all">No Sub-Filters</option>
                  <option value="outstanding_fees">Outstanding Fees Only</option>
                  <option value="has_phone">With Phone Numbers</option>
                  <option value="no_phone">Missing Phone Numbers</option>
                </select>
              </div>
            </div>

            {/* AUDIENCE SEARCH AND STATS HEADER */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <div className="sm:col-span-8 relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search students, parents, guardians, or phones..."
                  className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-750 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-4 text-right">
                <span className="text-[10px] font-black uppercase text-indigo-700 font-mono bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100/50">
                  Target Match: {selectedStudentIds.length}/{filteredStudents.filter(s => s.guardianTelephone && s.guardianTelephone.trim().length > 3).length}
                </span>
              </div>
            </div>

            {/* LIVE PREVIEW TABLE */}
            <div className="flex-1 overflow-x-auto border border-slate-200 rounded-xl max-h-[300px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-3 text-center w-10">
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.length > 0 && selectedStudentIds.length === filteredStudents.filter(s => s.guardianTelephone && s.guardianTelephone.trim().length > 3).length}
                        onChange={handleToggleAll}
                        className="rounded accent-indigo-600 focus:ring-0 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3 w-32">Student / Parent</th>
                    <th className="py-2.5 px-3 w-1/2">Personalized Merge Message Live Preview</th>
                    <th className="py-2.5 px-3 text-right pr-4 w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-10 text-slate-405 italic font-medium">
                        No students fit the demographic criteria or sub-filter targets.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map(student => {
                      const hasPhone = student.guardianTelephone && student.guardianTelephone.trim().length > 3;
                      const activeFeeBal = feeBillsMap[student.id] || 0;
                      const isSelected = selectedStudentIds.includes(student.id);
                      const parsedMsg = compileMessage(student, templateText);

                      return (
                        <tr 
                          key={student.id} 
                          className={`hover:bg-slate-50/50 transition ${!isSelected && hasPhone ? 'bg-slate-50/20' : ''} ${!hasPhone ? 'bg-rose-50/20 opacity-80' : ''}`}
                        >
                          {/* CHECKBOX */}
                          <td className="py-2.5 px-3 text-center">
                            {hasPhone ? (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleOne(student.id)}
                                className="rounded accent-indigo-600 focus:ring-0 cursor-pointer"
                              />
                            ) : (
                              <span className="text-rose-500 block text-[9.5px] font-bold">☠</span>
                            )}
                          </td>

                          {/* RECIPIENT INFORMATION */}
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900 leading-tight">
                              {student.firstName} {student.lastName}
                            </div>
                            <div className="text-[10px] text-slate-450 flex flex-col font-medium space-y-0.5 mt-0.5">
                              <span>Parent: {student.guardianName || 'Unspecified'}</span>
                              <span>Class: {student.class}</span>
                              {activeFeeBal > 0 && (
                                <span className="text-[9.5px] text-orange-600 font-extrabold font-mono">Bal: GHS {activeFeeBal}</span>
                              )}
                            </div>
                          </td>

                          {/* RENDERED MESSAGE PREVIEW */}
                          <td className="py-2.5 px-3 leading-relaxed font-sans text-[10.5px] text-slate-650 max-w-[280px]">
                            <div className="border border-slate-100/50 bg-slate-50/30 p-2 rounded-lg font-medium text-slate-600 block leading-normal line-clamp-3">
                              {parsedMsg}
                            </div>
                          </td>

                          {/* ROW ACTIONS */}
                          <td className="py-2.5 px-3 text-right pr-4">
                            {hasPhone ? (
                              <div className="flex items-center justify-end gap-1.5">
                                {/* WhatsApp Direct Dispatch */}
                                <a
                                  href={getWhatsAppHref(student)}
                                  onClick={() => logWhatsAppDispatch(student)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 border border-emerald-250 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg text-xs transition cursor-pointer flex items-center justify-center shadow-7xs"
                                  title="Send compiled notice directly to parent via WhatsApp"
                                >
                                  <MessageCircle size={13} className="text-emerald-600" />
                                </a>

                                {activeChannel === 'native-device' ? (
                                  /* Free Local SMS via applet redirect */
                                  <a
                                    href={getNativeSmsHref(student)}
                                    onClick={() => logNativeSmsDispatch(student)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 border border-slate-250 bg-white hover:bg-slate-100 text-slate-700 font-black rounded-lg text-xs transition cursor-pointer flex items-center justify-center shadow-7xs"
                                    title="Dispatch individually through device mobile network"
                                  >
                                    <Smartphone size={13} className="text-indigo-650" />
                                  </a>
                                ) : (
                                  /* Instant API dispatch via active channel settings */
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await handleSingleSend(student, parsedMsg);
                                    }}
                                    className={`p-1.5 px-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-7xs ${
                                      activeChannel === 'ghana-sms' 
                                        ? 'bg-amber-50 hover:bg-amber-100 border border-amber-250 text-amber-900 animate-pulse' 
                                        : 'bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 text-emerald-900'
                                    }`}
                                    title={`Manual ${activeChannel === 'ghana-sms' ? 'Ghana Carrier (MTN)' : 'Twilio API'} dispatch`}
                                  >
                                    <Send size={11} />
                                    <span>{activeChannel === 'ghana-sms' ? 'Ghana SMS' : 'Twilio'}</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-rose-500 font-bold block bg-rose-50 border border-rose-100 p-1 rounded-md text-center max-w-[100px] shadow-8xs">
                                Missing Mobile
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* TWILIO AND API GATEWAY CONTROLS CARD */}
      {isAdmin && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-100 pb-4 gap-2">
            <div>
              <h3 className="text-xs font-black text-slate-950 uppercase tracking-wider flex items-center gap-1.5 font-display">
                <Sliders className="text-indigo-600 animate-pulse" size={15} /> Twilio API Gateway Credentials Config Layer
              </h3>
              <p className="text-[11px] text-slate-500 leading-normal font-medium mt-0.5">
                Integrate your custom Twilio cellular service. Authentic API keys allow bulk notifications to deliver directly to parent devices globally. Stored credentials remain protected inside your local secure workspace.
              </p>
            </div>
            <div className="flex items-center">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${
                twilioConfig.enabled 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                  : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}>
                <span className={`w-2 h-2 rounded-full ${twilioConfig.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                {twilioConfig.enabled ? 'Gateway Active' : 'Gateway Offline'}
              </span>
            </div>
          </div>

          {/* Outer responsive split grid for credentials configuration and live diagnostic handshaking */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Column A: Credentials block (Left 7-spans) */}
            <div className="lg:col-span-7 space-y-5">
              <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
                🔐 API Keys & Gateway Configuration
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Account SID */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Account SID:</label>
                    {twilioConfig.accountSid && !twilioConfig.accountSid.trim().startsWith('AC') && (
                      <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 py-0.5 rounded">Must start with AC</span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={twilioConfig.accountSid}
                    onChange={(e) => handleSaveTwilioSetting('accountSid', e.target.value)}
                    placeholder="e.g. AC8fb180..."
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800 text-left font-mono"
                  />
                </div>

                {/* Auth Token */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Auth Token:</label>
                    {twilioConfig.authToken && twilioConfig.authToken.trim().length !== 32 && (
                      <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 py-0.5 rounded">Should be 32 chars</span>
                    )}
                  </div>
                  <input
                    type="password"
                    value={twilioConfig.authToken}
                    onChange={(e) => handleSaveTwilioSetting('authToken', e.target.value)}
                    placeholder="••••••••••••••••••••••••••••"
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800 text-left font-mono"
                  />
                </div>

                {/* Sender From Phone */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">From Twilio Number (E.164):</label>
                    {twilioConfig.fromNumber && !twilioConfig.fromNumber.trim().startsWith('+') && (
                      <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 py-0.5 rounded">Must start with '+'</span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={twilioConfig.fromNumber}
                    onChange={(e) => handleSaveTwilioSetting('fromNumber', e.target.value)}
                    placeholder="e.g. +18146447281"
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-850 font-mono text-left"
                  />
                </div>

                {/* Gateway Toggle Switch */}
                <div className="space-y-1 select-none">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Integrity State:</label>
                  <div className="flex items-center gap-2 h-[41px] bg-slate-50 border border-slate-200 px-3 rounded-xl hover:bg-slate-100 transition cursor-pointer" onClick={() => handleSaveTwilioSetting('enabled', !twilioConfig.enabled)}>
                    <input
                      type="checkbox"
                      id="twilio_enabled_flag"
                      checked={twilioConfig.enabled}
                      onChange={(e) => e.stopPropagation()} // Handled by div click
                      className="w-4 h-4 accent-indigo-600 cursor-pointer flex-shrink-0"
                    />
                    <label htmlFor="twilio_enabled_flag" className="text-[11px] font-black text-slate-700 cursor-pointer">
                      Enable Twilio Outbound Send
                    </label>
                  </div>
                </div>
              </div>

              {/* Test credentials validator action button block */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  type="button"
                  onClick={handleTestTwilioCredentials}
                  disabled={isTestingTwilio || !twilioConfig.accountSid || !twilioConfig.authToken}
                  className="px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 border border-indigo-200 text-indigo-700 font-bold rounded-xl text-xs transition cursor-pointer select-none flex items-center justify-center gap-1.5 active:translate-y-0.5 shadow-3xs"
                >
                  {isTestingTwilio ? (
                    <>
                      <RefreshCw className="animate-spin text-indigo-600" size={14} />
                      Verifying Credentials...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} />
                      Verify & Handshake Credentials
                    </>
                  )}
                </button>
                
                <p className="text-[10px] text-slate-400 font-medium">
                  Verify authorization keys against Twilio REST servers securely with 0 costs.
                </p>
              </div>

              {/* Diagnostic result logs display box */}
              {twilioTestResult && (
                <div className={`p-4 rounded-xl border transition-all ${
                  twilioTestResult.success 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5">
                      {twilioTestResult.success ? (
                        <CheckCircle className="text-emerald-600 flex-shrink-0" size={16} />
                      ) : (
                        <AlertTriangle className="text-rose-600 flex-shrink-0" size={16} />
                      )}
                    </div>
                    <div className="space-y-1 text-xs">
                      <p className="font-bold leading-none">
                        {twilioTestResult.success ? 'Credentials Validated Successfully' : 'Credentials Validation Failed'}
                      </p>
                      <p className="opacity-90 leading-normal">{twilioTestResult.message}</p>
                      {twilioTestResult.success && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-emerald-200/50 mt-2 font-mono text-[10px] font-bold">
                          <div>
                            <span className="opacity-75 uppercase block text-[8px] font-sans">Account Friendly Name:</span>
                            <span className="text-slate-800">{twilioTestResult.accountName}</span>
                          </div>
                          <div>
                            <span className="opacity-75 uppercase block text-[8px] font-sans">Account Status:</span>
                            <span className="text-emerald-700 capitalize">{twilioTestResult.status}</span>
                          </div>
                          <div>
                            <span className="opacity-75 uppercase block text-[8px] font-sans">Account Plan Type:</span>
                            <span className="text-indigo-700 capitalize">{twilioTestResult.type}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Column B: Sandbox SMS dispatch (Right 5-spans) */}
            <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="pb-2 border-b border-slate-200">
                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="text-indigo-600" size={14} /> Handshake SMS Sandbox
                </h4>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                  Send a real system test SMS to confirm final cellular route delivery on hand.
                </p>
              </div>

              <div className="space-y-3">
                {/* Destination Mobile Number */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Recipient Mobile Number (E.164):</label>
                  <input
                    type="text"
                    value={testPhoneNumber}
                    onChange={(e) => setTestPhoneNumber(e.target.value)}
                    placeholder="e.g. +233241234567"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Message Input */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Standard Handshake Payload:</label>
                  <textarea
                    value={testSmsMessage}
                    onChange={(e) => setTestSmsMessage(e.target.value)}
                    rows={2}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none leading-normal"
                  />
                </div>

                {/* Sandbox dispatch trigger */}
                <button
                  type="button"
                  onClick={handleSendHandshake}
                  disabled={isSendingHandshake || !testPhoneNumber || !twilioConfig.enabled}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold rounded-lg text-xs transition cursor-pointer select-none flex items-center justify-center gap-1.5"
                >
                  {isSendingHandshake ? (
                    <>
                      <RefreshCw className="animate-spin text-white" size={13} />
                      Processing Handshake...
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      Send Handshake SMS
                    </>
                  )}
                </button>

                {/* Handshake Result Alert */}
                {handshakeResult && (
                  <div className={`p-3 rounded-lg border text-[11px] leading-relaxed font-semibold ${
                    handshakeResult.success 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}>
                    <p className="font-bold">{handshakeResult.success ? '⚡ Dispatch Enqueued' : '❌ Gateway Rejected'}</p>
                    <p className="mt-0.5">{handshakeResult.message}</p>
                    {handshakeResult.sid && (
                      <div className="mt-1 pt-1 border-t border-emerald-100 font-mono text-[9px] text-emerald-700 flex justify-between items-center">
                        <span>Gateway SID:</span>
                        <span className="font-bold">{handshakeResult.sid}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* DISPATCH HISTORY LOG TABLE */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-xs font-black text-slate-950 uppercase tracking-wider flex items-center gap-1.5 font-display">
              <MessageSquare className="text-indigo-600" size={14} /> Outbound Communications Transaction & Logs Ledger
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">Verify cellular delivery callbacks, timestamps and payloads.</p>
          </div>
          <button
            type="button"
            onClick={handleClearLogs}
            disabled={smsLogs.length === 0}
            className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-bold cursor-pointer transition select-none flex items-center gap-1 active:translate-y-0.5"
          >
            <Trash2 size={13} /> Clear Historic logs
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-150 rounded-xl max-h-[250px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-black uppercase tracking-wider text-slate-550">
                <th className="py-2 px-3">Date / Time</th>
                <th className="py-2 px-3">Recipient Name (Phone)</th>
                <th className="py-2 px-3">Student Affected</th>
                <th className="py-2 px-3">Communication Content Payload</th>
                <th className="py-2 px-3">Protocol</th>
                <th className="py-2 px-3 text-right pr-4">Delivery Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {smsLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400 italic">No communication logs recorded during the current workspace session.</td>
                </tr>
              ) : (
                smsLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition font-sans">
                    {/* TIMESTAMP */}
                    <td className="py-2 px-3 font-mono text-[10px] text-slate-500 font-semibold">
                      {new Date(log.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>

                    {/* GUARDIAN */}
                    <td className="py-2 px-3 font-bold text-slate-800">
                      <div>{log.guardianName}</div>
                      <div className="font-mono text-[9px] text-slate-400 mt-0.5">{log.phoneNumber}</div>
                    </td>

                    {/* STUDENT */}
                    <td className="py-2 px-3">
                      <div className="font-semibold text-slate-900">{log.studentName}</div>
                      <div className="text-[9.5px] text-slate-400 font-semibold">{log.class}</div>
                    </td>

                    {/* MSG BODY */}
                    <td className="py-2 px-3 text-slate-500 font-medium max-w-[240px] truncate leading-normal" title={log.message}>
                      {log.message}
                    </td>

                    {/* DRIVER */}
                    <td className="py-2 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black ${log.channel === 'Twilio API' ? 'bg-indigo-50 border border-indigo-100 text-indigo-750' : 'bg-slate-100 border border-slate-205 text-slate-650'}`}>
                        {log.channel}
                      </span>
                    </td>

                    {/* DELIVERED OR INITIATED STATUS */}
                    <td className="py-2 px-3 text-right pr-4 font-black">
                      {log.status === 'Delivered' ? (
                        <span className="text-emerald-700 flex items-center justify-end gap-1 font-black text-[10px]">
                          <CheckCircle size={10} /> DELIVERED
                        </span>
                      ) : log.status === 'Initiated' ? (
                        <span className="text-sky-700 flex items-center justify-end gap-1 font-black text-[10px]">
                          <Smartphone size={10} /> INITIATED
                        </span>
                      ) : (
                        <div className="flex flex-col items-end">
                          <span className="text-rose-600 flex items-center justify-end gap-1 font-black text-[10px]">
                            <AlertTriangle size={10} /> DISPATCH ERROR
                          </span>
                          {log.errorDetails && <span className="text-[8px] text-rose-500 font-mono font-medium max-w-[150px] truncate mt-0.5">{log.errorDetails}</span>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
