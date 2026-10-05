import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Smartphone, Send, AlertTriangle, Search, Trash2, CheckCircle, RefreshCw, 
  MessageSquare, Sliders, Users, Info, MessageCircle, Mail, Copy, Download,
  ExternalLink, Filter, DollarSign, Play, ArrowRight, FileText, Check, X
} from 'lucide-react';
import { Student, CLASSES, AcademicYearType, ACADEMIC_YEARS, CommunicationTemplate } from '../types';
import { DbController, getStorageItem, setStorageItem, removeStorageItem } from '../db';
import { ThemeStyles } from './ThemeWrapper';
import { generateSecureToken, getWhatsAppShareData, shareParentPortalWhatsApp, WhatsAppTemplate, triggerToast } from '../utils';
import { User } from 'firebase/auth';
import { 
  initGoogleAuth, googleSignIn, googleSignOut, sendGmailMessage, isGoogleAuthenticated 
} from '../googleDriveService';
import SmartTextarea from './SmartTextarea';

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
  channel: 'Twilio API' | 'Native Carrier' | 'Ghana Carrier (MTN)' | 'WhatsApp Direct' | 'Gmail API';
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

const WA_FEE_TEMPLATES = [
  {
    id: 'gentle',
    title: 'Gentle Friendly Reminder',
    badge: 'Standard / Recommended',
    description: 'Polite, encouraging message with payment details and Parent Portal link',
    text: 'Dear {guardianName},\n\nHope this finds you well. This is a gentle reminder from {schoolName} regarding the outstanding school fee balance of *GHS {feeBalance}* for *{firstName} {lastName}* ({class}) for {term}.\n\nKindly arrange for settlement via Mobile Money or at the school accounts office. View fee receipts & statement here:\n{reportLink}\n\nThank you for your cooperation!'
  },
  {
    id: 'urgent',
    title: 'Urgent Overdue Notice',
    badge: 'High Priority',
    description: 'Direct formal notice requesting urgent settlement of arrears',
    text: 'URGENT SCHOOL FEES NOTICE\n\nDear {guardianName},\n\nOur records show an outstanding school fee balance of *GHS {feeBalance}* for *{firstName} {lastName}* ({class}) for {term}.\n\nWe kindly request full settlement by the end of this week to ensure uninterrupted academic participation. Access statement & receipts:\n{reportLink}\n\nThank you.\n- {schoolName} Accounts Office'
  },
  {
    id: 'installment',
    title: 'Payment Plan / Installment Offer',
    badge: 'Flexible Payment',
    description: 'Invites guardians to visit accounts office to agree on an installment schedule',
    text: 'Dear {guardianName},\n\nThis is a quick update regarding *{firstName} {lastName}* ({class}). The current pending school fee balance is *GHS {feeBalance}* for {term}.\n\nIf you would like to arrange an installment plan or have made recent payments, please contact our accounts office or inspect your live account statement:\n{reportLink}\n\nWarm regards,\n{schoolName}'
  }
];

const DEFAULT_SMS_TEMPLATES: CommunicationTemplate[] = [
  {
    id: 'report_link',
    name: 'Academic Report Link Notice',
    type: 'email',
    subject: 'Student Term Report Card Ready',
    text: 'Dear {guardianName}, the Term Report Card for {firstName} {lastName} ({class}) is now ready. Click here to securely view/download the full official grades and fee statement anytime: {reportLink}',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'System'
  },
  {
    id: 'assessment_reminder',
    name: 'Upcoming Assessment Reminder',
    type: 'email',
    subject: 'Preparedness for Upcoming Assessments',
    text: 'Dear {guardianName}, please be reminded that {firstName} {lastName} ({class}) has upcoming assessments scheduled for next week. Kindly ensure they are well prepared. - {schoolName}',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'System'
  },
  {
    id: 'fee_reminder',
    name: 'Outstanding Fees Reminder',
    type: 'email',
    subject: 'Gentle Outstanding Fees Notice',
    text: 'Dear {guardianName}, this is a gentle reminder that {firstName} {lastName} ({class}) has an outstanding school fee balance of GHS {feeBalance}. Please arrange for settlement. - {schoolName}',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'System'
  },
  {
    id: 'attendance_alert',
    name: 'Student Absence Alert',
    type: 'email',
    subject: 'Urgent Attendance Notice',
    text: 'Urgent: Dear {guardianName}, {firstName} {lastName} ({class}) was recorded as ABSENT during today\'s morning registration call. Please contact the administration if you are unaware of this absence.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'System'
  },
  {
    id: 'general_broadcast',
    name: 'General PTA & School Broadcast',
    type: 'email',
    subject: 'General PTA Congress Meeting Invitation',
    text: 'Dear {guardianName}, please be informed that our upcoming general PTA congress will take place this Sunday at 2:00 PM in the main assembly hall. Agenda: Fee revisions and academic calendar. Thank you. - {schoolName}',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'System'
  }
];

const DEFAULT_WA_TEMPLATES: CommunicationTemplate[] = [
  {
    id: 'gentle',
    name: 'Gentle Friendly Reminder',
    type: 'whatsapp',
    badge: 'Standard / Recommended',
    description: 'Polite, encouraging message with payment details and Parent Portal link',
    text: 'Dear {guardianName},\n\nHope this finds you well. This is a gentle reminder from {schoolName} regarding the outstanding school fee balance of *GHS {feeBalance}* for *{firstName} {lastName}* ({class}) for {term}.\n\nKindly arrange for settlement via Mobile Money or at the school accounts office. View fee receipts & statement here:\n{reportLink}\n\nThank you for your cooperation!',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'System'
  },
  {
    id: 'urgent',
    name: 'Urgent Overdue Notice',
    type: 'whatsapp',
    badge: 'High Priority',
    description: 'Direct formal notice requesting urgent settlement of arrears',
    text: 'URGENT SCHOOL FEES NOTICE\n\nDear {guardianName},\n\nOur records show an outstanding school fee balance of *GHS {feeBalance}* for *{firstName} {lastName}* ({class}) for {term}.\n\nWe kindly request full settlement by the end of this week to ensure uninterrupted academic participation. Access statement & receipts:\n{reportLink}\n\nThank you.\n- {schoolName} Accounts Office',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'System'
  },
  {
    id: 'installment',
    name: 'Payment Plan / Installment Offer',
    type: 'whatsapp',
    badge: 'Flexible Payment',
    description: 'Invites guardians to visit accounts office to agree on an installment schedule',
    text: 'Dear {guardianName},\n\nThis is a quick update regarding *{firstName} {lastName}* ({class}). The current pending school fee balance is *GHS {feeBalance}* for {term}.\n\nIf you would like to arrange an installment plan or have made recent payments, please contact our accounts office or inspect your live account statement:\n{reportLink}\n\nWarm regards,\n{schoolName}',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'System'
  }
];

export default function CommunicationsTab({ theme, students, isAdmin }: Props) {
  // Sub-navigation view toggle: 'all-channels' or 'whatsapp-fee-reminders' or 'template-editor'
  const [activeSubView, setActiveSubView] = useState<'all-channels' | 'whatsapp-fee-reminders' | 'template-editor'>('all-channels');

  // WhatsApp Fee Reminder utility states
  const [waSelectedClass, setWaSelectedClass] = useState<string>('All Classes');
  const [waBalanceFilter, setWaBalanceFilter] = useState<'all_outstanding' | 'gt_100' | 'gt_500' | 'gt_1000' | 'all'>('all_outstanding');
  const [waTemplatePreset, setWaTemplatePreset] = useState<string>('gentle');
  const [waCustomText, setWaCustomText] = useState<string>(
    'Dear {guardianName},\n\nThis is a friendly reminder from {schoolName} regarding the outstanding school fee balance of *GHS {feeBalance}* for *{firstName} {lastName}* ({class}) for {term}.\n\nKindly arrange for payment via Mobile Money or at the school accounts office. You can also view the full fee statement & receipts here:\n{reportLink}\n\nThank you for your continued support!'
  );
  const [waSearchQuery, setWaSearchQuery] = useState<string>('');
  const [waSelectedStudentIds, setWaSelectedStudentIds] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  // Template Editor States
  const [dbTemplates, setDbTemplates] = useState<CommunicationTemplate[]>(() => {
    return DbController.getCommunicationTemplates();
  });

  const emailTemplates = useMemo(() => {
    const customEmail = dbTemplates.filter(t => t.type === 'email');
    return customEmail.length > 0 ? customEmail : DEFAULT_SMS_TEMPLATES;
  }, [dbTemplates]);

  const whatsappTemplates = useMemo(() => {
    const customWa = dbTemplates.filter(t => t.type === 'whatsapp');
    return customWa.length > 0 ? customWa : DEFAULT_WA_TEMPLATES;
  }, [dbTemplates]);

  // Form states
  const [editingTemplate, setEditingTemplate] = useState<CommunicationTemplate | null>(null);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'email' | 'whatsapp'>('email');
  const [formSubject, setFormSubject] = useState('');
  const [formText, setFormText] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formBadge, setFormBadge] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateTypeFilter, setTemplateTypeFilter] = useState<'all' | 'email' | 'whatsapp'>('all');
  const [editorError, setEditorError] = useState('');
  const [editorSuccess, setEditorSuccess] = useState('');

  // Sequential Queue Modal State
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);
  const [queueIndex, setQueueIndex] = useState(0);

  const [selectedClass, setSelectedClass] = useState<string>('All Classes');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('All Academic Years');
  const [targetFilter, setTargetFilter] = useState<'all' | 'outstanding_fees' | 'no_phone' | 'has_phone'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom SMS template state
  const [templateText, setTemplateText] = useState(DEFAULT_SMS_TEMPLATES[0].text);
  const [selectedTemplateId, setSelectedTemplateId] = useState('report_link');

  // Dynamic system configs (fetched from DB custom parameters)
  const systemSettings = useMemo(() => DbController.getSystemSettings(), []);
  const [school, setSchool] = useState(() => DbController.getSchoolInfo());
  const activeYear = systemSettings.academicYear || '2026/2027';
  const activeTerm = systemSettings.term || 'Term 1';

  // Active channel selection: 'ghana-sms' (default) or 'twilio' or 'native-device' or 'whatsapp-direct' or 'gmail'
  const [activeChannel, setActiveChannel] = useState<'ghana-sms' | 'twilio' | 'native-device' | 'whatsapp-direct' | 'gmail'>(() => {
    const saved = getStorageItem('geetech_active_sms_channel', 'ghana-sms');
    return (saved as any) || 'ghana-sms';
  });

  // Google/Gmail Auth State
  const [isGoogleAuth, setIsGoogleAuth] = useState<boolean>(false);
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [emailSubject, setEmailSubject] = useState('Important Update regarding {firstName} {lastName} ({class})');
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);

  // Initialize Auth state for Gmail
  useEffect(() => {
    const unsub = initGoogleAuth((user, token) => {
      setIsGoogleAuth(!!token && !!user);
      setGoogleUser(user);
    });
    return () => unsub();
  }, []);

  const handleGoogleSignInClick = async () => {
    try {
      setIsAuthLoading(true);
      await googleSignIn();
    } catch (error: any) {
      console.error(error);
      alert('Google authentication failed. Please open the app in a new tab if you encounter popup restrictions.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGoogleSignOutClick = async () => {
    try {
      await googleSignOut();
    } catch (error) {
      console.error(error);
    }
  };

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

  const logsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [smsLogs.length]);

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
    const tmpl = emailTemplates.find(t => t.id === id);
    if (tmpl) {
      setTemplateText(tmpl.text);
      if (tmpl.subject) {
        setEmailSubject(tmpl.subject);
      }
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
      .replace(/{term}/g, activeTerm)
      .replace(/{reportLink}/g, portalUrl);
  };

  // Helper to compile WhatsApp message
  const getWaTemplateText = () => {
    if (waTemplatePreset === 'custom') return waCustomText;
    const found = whatsappTemplates.find(t => t.id === waTemplatePreset);
    return found ? found.text : waCustomText;
  };

  const compileWaMessage = (student: Student) => {
    const rawTemplate = getWaTemplateText();
    return compileMessage(student, rawTemplate);
  };

  const getWaFormattedPhone = (student: Student) => {
    let phone = (student.guardianTelephone || '').trim().replace(/[\s\-\(\)\+]/g, '');
    if (phone.startsWith('0') && phone.length === 10) {
      phone = '233' + phone.substring(1);
    }
    return phone;
  };

  const getWaDirectLink = (student: Student) => {
    const phone = getWaFormattedPhone(student);
    const textMsg = compileWaMessage(student);
    return `https://wa.me/${phone}?text=${encodeURIComponent(textMsg)}`;
  };

  // CRUD & Interaction Logic for Template Editor
  const insertFormVariable = (tag: string) => {
    const textarea = document.getElementById('template-form-text') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);
      const newText = before + tag + after;
      setFormText(newText);
      
      // Reset selection
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + tag.length;
      }, 0);
    } else {
      setFormText(prev => prev + tag);
    }
  };

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    setEditorError('');
    setEditorSuccess('');

    if (!formName.trim()) {
      setEditorError('Template Name is required.');
      return;
    }
    if (!formText.trim()) {
      setEditorError('Template content cannot be empty.');
      return;
    }
    if (formType === 'email' && !formSubject.trim()) {
      setEditorError('Subject is required for Email/SMS templates.');
      return;
    }

    const templateId = editingTemplate?.id || `template_${Date.now()}`;
    const newTemplate: CommunicationTemplate = {
      id: templateId,
      name: formName.trim(),
      type: formType,
      subject: formType === 'email' ? formSubject.trim() : undefined,
      text: formText,
      description: formDescription.trim() || undefined,
      badge: formBadge.trim() || undefined,
      createdAt: editingTemplate?.createdAt || new Date().toISOString(),
      updatedBy: 'Admin'
    };

    try {
      DbController.saveCommunicationTemplate(newTemplate);
      // Reload from local database
      const updated = DbController.getCommunicationTemplates();
      setDbTemplates(updated);
      
      setEditorSuccess(editingTemplate ? 'Template updated successfully!' : 'Template saved successfully!');
      
      // Reset form
      setEditingTemplate(null);
      setFormName('');
      setFormSubject('');
      setFormText('');
      setFormDescription('');
      setFormBadge('');
      
      triggerToast(editingTemplate ? 'Template updated successfully' : 'Template saved successfully');
    } catch (err: any) {
      setEditorError(err.message || 'Failed to save template.');
    }
  };

  const handleDeleteTemplate = (id: string) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    try {
      DbController.deleteCommunicationTemplate(id);
      const updated = DbController.getCommunicationTemplates();
      setDbTemplates(updated);
      triggerToast('Template deleted successfully');
    } catch (err: any) {
      alert(err.message || 'Failed to delete template.');
    }
  };

  const handleEditTemplate = (tmpl: CommunicationTemplate) => {
    setEditingTemplate(tmpl);
    setFormName(tmpl.name);
    setFormType(tmpl.type);
    setFormSubject(tmpl.subject || '');
    setFormText(tmpl.text);
    setFormDescription(tmpl.description || '');
    setFormBadge(tmpl.badge || '');
    
    // Smooth scroll to the form element
    const formEl = document.getElementById('template-form-section');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Log WhatsApp fee utility dispatch into smsLogs
  const logWaUtilityDispatch = (student: Student) => {
    const phone = getWaFormattedPhone(student);
    const msg = compileWaMessage(student);
    const newLog: DispatchLog = {
      id: `WA_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      guardianName: student.guardianName || 'Parent',
      phoneNumber: `+${phone}`,
      class: student.class || 'Unknown Class',
      message: msg,
      channel: 'WhatsApp Direct',
      status: 'Initiated'
    };
    setSmsLogs(prev => {
      const updated = [newLog, ...prev];
      setStorageItem('sms_communication_sent_logs', updated);
      return updated;
    });
  };

  // Filtered students for WhatsApp utility
  const waFilteredStudents = useMemo(() => {
    return students.filter(s => {
      if (waSelectedClass !== 'All Classes' && s.class !== waSelectedClass) return false;
      if (selectedAcademicYear !== 'All Academic Years' && s.academicYear !== selectedAcademicYear) return false;

      const feeVal = feeBillsMap[s.id] || 0;
      if (waBalanceFilter === 'all_outstanding' && feeVal <= 0) return false;
      if (waBalanceFilter === 'gt_100' && feeVal <= 100) return false;
      if (waBalanceFilter === 'gt_500' && feeVal <= 500) return false;
      if (waBalanceFilter === 'gt_1000' && feeVal <= 1000) return false;

      if (waSearchQuery.trim() !== '') {
        const q = waSearchQuery.toLowerCase();
        const fullMatches = `${s.firstName} ${s.lastName} ${s.guardianName} ${s.id} ${s.guardianTelephone} ${s.class}`.toLowerCase();
        if (!fullMatches.includes(q)) return false;
      }

      return true;
    });
  }, [students, waSelectedClass, selectedAcademicYear, waBalanceFilter, waSearchQuery, feeBillsMap]);

  // Auto select WhatsApp student IDs when waFilteredStudents changes
  useEffect(() => {
    setWaSelectedStudentIds(
      waFilteredStudents
        .filter(s => s.guardianTelephone && s.guardianTelephone.trim().length > 3)
        .map(s => s.id)
    );
  }, [waFilteredStudents]);

  const waSelectedStudents = useMemo(() => {
    return waFilteredStudents.filter(s => waSelectedStudentIds.includes(s.id));
  }, [waFilteredStudents, waSelectedStudentIds]);

  const waTotalOutstandingSum = useMemo(() => {
    return waSelectedStudents.reduce((sum, s) => sum + (feeBillsMap[s.id] || 0), 0);
  }, [waSelectedStudents, feeBillsMap]);

  const handleWaToggleAll = () => {
    const validRecipients = waFilteredStudents.filter(s => s.guardianTelephone && s.guardianTelephone.trim().length > 3);
    if (waSelectedStudentIds.length === validRecipients.length) {
      setWaSelectedStudentIds([]);
    } else {
      setWaSelectedStudentIds(validRecipients.map(s => s.id));
    }
  };

  const handleWaToggleOne = (id: string) => {
    setWaSelectedStudentIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleCopyWaMessage = (student: Student) => {
    const msg = compileWaMessage(student);
    navigator.clipboard.writeText(msg);
    setCopiedIndex(`msg_${student.id}`);
    triggerToast(`Copied WhatsApp message for ${student.firstName}!`, 'success');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCopyWaLink = (student: Student) => {
    const link = getWaDirectLink(student);
    navigator.clipboard.writeText(link);
    setCopiedIndex(`link_${student.id}`);
    triggerToast(`Copied WhatsApp direct link for ${student.firstName}!`, 'success');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCopyAllWaLinks = () => {
    if (waSelectedStudents.length === 0) {
      alert("Please select at least one student.");
      return;
    }
    const textList = waSelectedStudents.map(s => {
      const balance = feeBillsMap[s.id] || 0;
      const waLink = getWaDirectLink(s);
      return `• ${s.firstName} ${s.lastName} (${s.class}) - Guardian: ${s.guardianName || 'Parent'} (${s.guardianTelephone || 'No Phone'}) - Bal: GHS ${balance}\nLink: ${waLink}\n`;
    }).join('\n');

    navigator.clipboard.writeText(textList);
    triggerToast(`Copied WhatsApp links for ${waSelectedStudents.length} students to clipboard!`, 'success');
  };

  const handleCopyAllWaMessages = () => {
    if (waSelectedStudents.length === 0) {
      alert("Please select at least one student.");
      return;
    }
    const textList = waSelectedStudents.map(s => {
      const msg = compileWaMessage(s);
      return `----------------------------------------\nSTUDENT: ${s.firstName} ${s.lastName} (${s.class})\nPHONE: ${s.guardianTelephone}\n----------------------------------------\n${msg}\n`;
    }).join('\n\n');

    navigator.clipboard.writeText(textList);
    triggerToast(`Copied ${waSelectedStudents.length} formatted WhatsApp messages to clipboard!`, 'success');
  };

  const handleExportWaCsv = () => {
    if (waSelectedStudents.length === 0) {
      alert("Please select at least one student to export.");
      return;
    }

    const headers = ['Student ID', 'Student Name', 'Class', 'Guardian Name', 'Guardian Phone', 'Formatted Phone', 'Fee Balance (GHS)', 'WhatsApp Message', 'WhatsApp Link'];
    const rows = waSelectedStudents.map(s => {
      const balance = feeBillsMap[s.id] || 0;
      const phone = s.guardianTelephone || '';
      const formattedPhone = getWaFormattedPhone(s);
      const msg = compileWaMessage(s).replace(/"/g, '""');
      const waLink = getWaDirectLink(s);

      return [
        `"${s.id}"`,
        `"${s.firstName} ${s.lastName}"`,
        `"${s.class}"`,
        `"${s.guardianName || 'Guardian'}"`,
        `"${phone}"`,
        `"${formattedPhone}"`,
        `"${balance}"`,
        `"${msg}"`,
        `"${waLink}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const classNameClean = waSelectedClass.replace(/[^a-z0-9]/gi, '_');
    link.setAttribute('download', `WhatsApp_Fee_Reminders_${classNameClean}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast(`Exported WhatsApp Fee Reminders CSV for ${waSelectedStudents.length} students!`, 'success');
  };

  const handleStartQueue = () => {
    if (waSelectedStudents.length === 0) {
      alert("Please select at least one student to start the WhatsApp dispatch queue.");
      return;
    }
    setQueueIndex(0);
    setIsQueueModalOpen(true);
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
          term: activeTerm,
          paymentType: 'admin'
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
        const res = await fetch(`/api/payments/verify/${ref}?paymentType=admin`);
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

    if (activeChannel === 'gmail' && !isGoogleAuth) {
      alert("Please authenticate with Google / Gmail first to send bulk emails.");
      return;
    }

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
        : activeChannel === 'gmail'
          ? `GMAIL WORKSPACE BROADCAST: Dispatch ${count} real personalized parent emails using your connected Google Workspace?`
          : `TWILIO BROADCAST PROPOSAL: Dispatch ${count} automated parent messages via your Twilio Cloud account?`;

    if (window.confirm(proposalPrompt)) {
      setIsBulkSending(true);
      setBulkProgress(0);
      setBulkSuccessCount(0);
      setBulkFailedCount(0);
      setCancelBulkSignal(false);
      setBulkStatusText(
        activeChannel === 'whatsapp-direct'
          ? 'Launching WhatsApp Dispatcher...'
          : activeChannel === 'gmail'
            ? 'Handshaking with Google Workspace servers...'
            : 'Connecting to cellular network transceivers...'
      );

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
        const parentEmail = student.guardianEmail || '';

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
        } else if (activeChannel === 'gmail') {
          if (!parentEmail) {
            result = { success: false, error: 'Missing guardian email' };
          } else {
            try {
              const compiledSubject = compileMessage(student, emailSubject);
              const htmlBody = msgText.replace(/\n/g, '<br/>');
              const res = await sendGmailMessage(parentEmail, compiledSubject, htmlBody);
              if (res && res.id) {
                result = { success: true };
              } else {
                result = { success: false, error: 'API rejection' };
              }
            } catch (err: any) {
              result = { success: false, error: err.message || 'Gmail transmission failed' };
            }
          }
        } else {
          result = await runRealTwilioSend(parentPhone, msgText);
        }

        const newLog: DispatchLog = {
          id: `${activeChannel === 'gmail' ? 'GM' : activeChannel === 'whatsapp-direct' ? 'WA' : 'SMS'}_${Date.now()}_${student.id}_bulk`,
          timestamp: new Date().toISOString(),
          studentId: student.id,
          studentName: `${student.firstName} ${student.lastName}`,
          guardianName: student.guardianName,
          phoneNumber: activeChannel === 'gmail' ? parentEmail : parentPhone,
          message: msgText,
          channel: activeChannel === 'ghana-sms' ? 'Ghana Carrier (MTN)' : activeChannel === 'whatsapp-direct' ? 'WhatsApp Direct' : activeChannel === 'gmail' ? 'Gmail API' : 'Twilio API',
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
        await new Promise(r => setTimeout(r, activeChannel === 'ghana-sms' ? 250 : activeChannel === 'gmail' ? 300 : 600));
      }

      setIsBulkSending(false);
      setBulkStatusText(`Broadcast process finalized! Successfully transmitted: ${bulkSuccessCount} | Faulty: ${bulkFailedCount}`);
      
      // Pull latest from Firestore to sync exact remaining credits
      syncSmsBalance(true);
    }
  };

  // Perform parent notification send on an individual row basis with full channel sensitivity
  const handleSingleSend = async (student: Student, parsedMsg: string) => {
    if (activeChannel === 'gmail') {
      const email = (student.guardianEmail || '').trim();
      if (!email) {
        alert("This student profile has no guardian email address defined.");
        return;
      }

      if (!isGoogleAuth) {
        alert("Please authenticate with Google / Gmail first to send emails.");
        return;
      }

      const compiledSubject = compileMessage(student, emailSubject);
      const confirmMsg = `GMAIL DISPATCH: Send email notification to ${student.guardianName} (${email})?`;
      if (window.confirm(confirmMsg)) {
        try {
          const htmlBody = parsedMsg.replace(/\n/g, '<br/>');
          const result = await sendGmailMessage(email, compiledSubject, htmlBody);
          if (result && result.id) {
            alert("Email successfully sent via Gmail!");
            const newLog: DispatchLog = {
              id: `GMAIL_${Date.now()}_single_${student.id}`,
              timestamp: new Date().toISOString(),
              studentId: student.id,
              studentName: `${student.firstName} ${student.lastName}`,
              guardianName: student.guardianName,
              phoneNumber: email,
              message: parsedMsg,
              channel: 'Gmail API',
              status: 'Delivered',
              class: student.class
            };
            const logs = [newLog, ...smsLogs];
            setSmsLogs(logs);
            setStorageItem('sms_communication_sent_logs', logs);
          } else {
            alert("Failed to deliver email through Gmail API.");
          }
        } catch (error: any) {
          console.error(error);
          alert(`Gmail Transmission Failure: ${error.message || error}`);
        }
      }
      return;
    }

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
      
      {/* SUB-NAVIGATION TAB BAR */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 p-1 bg-slate-100/80 rounded-xl border border-slate-200/80 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveSubView('all-channels')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center ${
              activeSubView === 'all-channels'
                ? 'bg-white text-indigo-950 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone size={15} className="text-indigo-600" />
            <span>General Broadcast & SMS Center</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubView('whatsapp-fee-reminders')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center ${
              activeSubView === 'whatsapp-fee-reminders'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <MessageCircle size={15} />
            <span>Bulk WhatsApp Fee Reminders</span>
            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase bg-emerald-500 text-white animate-pulse">
              Class Utility
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubView('template-editor')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center ${
              activeSubView === 'template-editor'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <FileText size={15} />
            <span>Templates Editor</span>
            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase bg-indigo-500 text-white">
              Admin
            </span>
          </button>
        </div>

        {/* Quick hint or jump */}
        {activeSubView === 'all-channels' && (
          <button
            type="button"
            onClick={() => setActiveSubView('whatsapp-fee-reminders')}
            className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl transition cursor-pointer self-end sm:self-auto"
          >
            <MessageCircle size={14} className="text-emerald-600" />
            <span>Need class WhatsApp fee reminders? Launch Utility &rarr;</span>
          </button>
        )}
        {activeSubView === 'whatsapp-fee-reminders' && (
          <button
            type="button"
            onClick={() => setActiveSubView('all-channels')}
            className="text-xs text-indigo-700 hover:text-indigo-800 font-bold flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-xl transition cursor-pointer self-end sm:self-auto"
          >
            <Smartphone size={14} className="text-indigo-600" />
            <span>Back to SMS & Multi-Channel Center</span>
          </button>
        )}
        {activeSubView === 'template-editor' && (
          <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1 px-2 self-end sm:self-auto">
            <Info size={14} className="text-indigo-600" />
            <span>Database items synchronize to Firestore</span>
          </div>
        )}
      </div>

      {activeSubView === 'whatsapp-fee-reminders' && (
        <div className="space-y-6">
          {/* HERO & METRIC CARDS HEADER */}
          <div className="bg-gradient-to-br from-emerald-900 via-slate-900 to-emerald-950 p-6 rounded-2xl border border-emerald-800 text-white shadow-md space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner">
                  <MessageCircle size={26} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black font-display uppercase tracking-tight text-white">Bulk WhatsApp Fee Reminders Utility</h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500 text-slate-950">
                      Class Filter
                    </span>
                  </div>
                  <p className="text-xs text-emerald-200/80 font-medium mt-0.5">
                    Filter students by class, pick customized reminder templates, and generate direct personalized WhatsApp links for guardians.
                  </p>
                </div>
              </div>

              {/* Quick Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleStartQueue}
                  disabled={waSelectedStudents.length === 0}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black rounded-xl text-xs transition cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:translate-y-0.5"
                >
                  <Play size={15} fill="currentColor" />
                  <span>Launch Sequential Queue ({waSelectedStudents.length})</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportWaCsv}
                  disabled={waSelectedStudents.length === 0}
                  className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-40 border border-white/20 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
                  title="Download CSV report with WhatsApp direct links"
                >
                  <Download size={14} />
                  <span className="hidden sm:inline">Export CSV</span>
                </button>
              </div>
            </div>

            {/* METRIC BADGES */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-emerald-800/80">
              <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
                <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider block">Filtered Class Students</span>
                <span className="text-xl font-black text-white font-mono mt-0.5 block">{waFilteredStudents.length}</span>
                <span className="text-[10px] text-emerald-200/70 font-medium">{waSelectedClass}</span>
              </div>

              <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
                <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider block">Selected Guardians</span>
                <span className="text-xl font-black text-emerald-400 font-mono mt-0.5 block">{waSelectedStudents.length}</span>
                <span className="text-[10px] text-emerald-200/70 font-medium">ready for WhatsApp</span>
              </div>

              <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
                <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block">Total Outstanding Arrears</span>
                <span className="text-xl font-black text-amber-400 font-mono mt-0.5 block">
                  GHS {waTotalOutstandingSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-emerald-200/70 font-medium">for selected list</span>
              </div>

              <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
                <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider block">Academic Session</span>
                <span className="text-lg font-black text-white font-mono mt-0.5 block truncate">{activeYear} • {activeTerm}</span>
                <span className="text-[10px] text-emerald-200/70 font-medium">{school.name || 'GEETECH School'}</span>
              </div>
            </div>
          </div>

          {/* FILTER & TEMPLATE BUILDER GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LEFT COLUMN: FILTERS & PRESETS (lg:col-span-5) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
                <div className="border-b border-slate-150 pb-3 flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-950 uppercase tracking-wider flex items-center gap-1.5 font-display">
                    <Filter size={15} className="text-emerald-600" /> 1. Filter Class & Fee Criteria
                  </h3>
                  <span className="text-[10px] text-slate-400 font-semibold">Target Audience</span>
                </div>

                <div className="space-y-4">
                  {/* CLASS SELECTOR */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      Select School Class:
                    </label>
                    <select
                      value={waSelectedClass}
                      onChange={(e) => setWaSelectedClass(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 hover:border-emerald-500 p-2.5 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                    >
                      <option value="All Classes">All Classes ({students.length} students)</option>
                      {CLASSES.map(cls => {
                        const countInClass = students.filter(s => s.class === cls).length;
                        return (
                          <option key={cls} value={cls}>
                            {cls} ({countInClass} student{countInClass === 1 ? '' : 's'})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* FEE BALANCE THRESHOLD */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      Fee Balance Threshold:
                    </label>
                    <select
                      value={waBalanceFilter}
                      onChange={(e) => setWaBalanceFilter(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 hover:border-emerald-500 p-2.5 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                    >
                      <option value="all_outstanding">All Students with Outstanding Fees (&gt; GHS 0)</option>
                      <option value="gt_100">Fee Balance &gt; GHS 100.00</option>
                      <option value="gt_500">Fee Balance &gt; GHS 500.00</option>
                      <option value="gt_1000">Fee Balance &gt; GHS 1,000.00</option>
                      <option value="all">All Students in Class (Include Zero Balances)</option>
                    </select>
                  </div>

                  {/* ACADEMIC YEAR & TERM */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Academic Year:</label>
                      <select
                        value={selectedAcademicYear}
                        onChange={(e) => setSelectedAcademicYear(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-xs font-bold text-slate-700"
                      >
                        <option value="All Academic Years">All Years</option>
                        {ACADEMIC_YEARS.map(yr => (
                          <option key={yr} value={yr}>{yr}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Active Term:</label>
                      <div className="p-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 text-center font-mono">
                        {activeTerm}
                      </div>
                    </div>
                  </div>
                </div>

                {/* TEMPLATE PRESET SELECTOR */}
                <div className="pt-3 border-t border-slate-150 space-y-3">
                  <h4 className="text-xs font-black text-slate-950 uppercase tracking-wider flex items-center gap-1.5 font-display">
                    <FileText size={15} className="text-emerald-600" /> 2. WhatsApp Reminder Template Preset
                  </h4>

                  <div className="space-y-2">
                    {whatsappTemplates.map(preset => {
                      const isSelected = waTemplatePreset === preset.id;
                      const title = preset.name;
                      const badge = preset.badge || 'Custom';
                      const description = preset.description || 'Custom WhatsApp template';
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setWaTemplatePreset(preset.id)}
                          className={`w-full text-left p-3 rounded-xl border transition flex items-start justify-between gap-3 cursor-pointer ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-500'
                              : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold ${isSelected ? 'text-emerald-950' : 'text-slate-800'}`}>
                                {title}
                              </span>
                              <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                                preset.id === 'gentle' ? 'bg-emerald-100 text-emerald-800' : preset.id === 'urgent' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {badge}
                              </span>
                            </div>
                            <p className="text-[10.5px] text-slate-500 leading-normal font-medium">
                              {description}
                            </p>
                          </div>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isSelected ? 'bg-emerald-600 text-white' : 'border border-slate-300'}`}>
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => setWaTemplatePreset('custom')}
                      className={`w-full text-left p-3 rounded-xl border transition flex items-start justify-between gap-3 cursor-pointer ${
                        waTemplatePreset === 'custom'
                          ? 'border-emerald-600 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-500'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70'
                      }`}
                    >
                      <div>
                        <span className={`text-xs font-bold ${waTemplatePreset === 'custom' ? 'text-emerald-950' : 'text-slate-800'}`}>
                          📝 Custom WhatsApp Fee Message
                        </span>
                        <p className="text-[10.5px] text-slate-500 leading-normal font-medium mt-0.5">
                          Write your own WhatsApp reminder layout with dynamic token placeholders
                        </p>
                      </div>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${waTemplatePreset === 'custom' ? 'bg-emerald-600 text-white' : 'border border-slate-300'}`}>
                        {waTemplatePreset === 'custom' && <Check size={12} strokeWidth={3} />}
                      </div>
                    </button>
                  </div>

                  {/* CUSTOM TEXTAREA IF CUSTOM SELECTED OR EDITING */}
                  {waTemplatePreset === 'custom' && (
                    <div className="space-y-2 pt-2">
                      <SmartTextarea
                        rows={5}
                        value={waCustomText}
                        onChange={(e: any) => setWaCustomText(e.target.value)}
                        className="w-full text-xs p-3 border border-emerald-300 rounded-xl bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed"
                        placeholder="Type custom WhatsApp fee reminder template..."
                      />
                    </div>
                  )}

                  {/* VARIABLE INSERTION TAGS */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-widest block">Insert Variable Tokens:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { tag: '{guardianName}', label: 'Parent Name' },
                        { tag: '{firstName}', label: 'Student First Name' },
                        { tag: '{lastName}', label: 'Student Last Name' },
                        { tag: '{class}', label: 'Class' },
                        { tag: '{feeBalance}', label: 'Fee Balance' },
                        { tag: '{term}', label: 'Term' },
                        { tag: '{reportLink}', label: 'Portal Link' },
                        { tag: '{schoolName}', label: 'School Name' }
                      ].map(item => (
                        <button
                          key={item.tag}
                          type="button"
                          onClick={() => {
                            if (waTemplatePreset !== 'custom') {
                              setWaCustomText(getWaTemplateText() + item.tag);
                              setWaTemplatePreset('custom');
                            } else {
                              setWaCustomText(prev => prev + item.tag);
                            }
                          }}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-emerald-100 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-950 font-mono text-[9.5px] rounded-lg font-bold transition cursor-pointer"
                        >
                          {item.tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: PREFILLED MESSAGES & ACTION TABLE (lg:col-span-7) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 flex flex-col min-h-[500px]">
                
                {/* TOOLBAR HEADER */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-150 pb-4">
                  <div>
                    <h3 className="text-xs font-black text-slate-950 uppercase tracking-wider flex items-center gap-1.5 font-display">
                      <Users className="text-emerald-600" size={15} /> 3. Filtered Class Audience & WhatsApp Links
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {waFilteredStudents.length} student{waFilteredStudents.length === 1 ? '' : 's'} match filters • {waSelectedStudents.length} selected
                    </p>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyAllWaLinks}
                      disabled={waSelectedStudents.length === 0}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 disabled:opacity-40 text-slate-700 font-bold text-[11px] rounded-lg transition flex items-center gap-1 cursor-pointer"
                      title="Copy all generated wa.me direct links to clipboard"
                    >
                      <Copy size={12} />
                      <span>Copy Links</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyAllWaMessages}
                      disabled={waSelectedStudents.length === 0}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 disabled:opacity-40 text-slate-700 font-bold text-[11px] rounded-lg transition flex items-center gap-1 cursor-pointer"
                      title="Copy all formatted message texts to clipboard"
                    >
                      <FileText size={12} />
                      <span>Copy Messages</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleStartQueue}
                      disabled={waSelectedStudents.length === 0}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-extrabold text-[11px] rounded-lg transition flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      <Play size={12} fill="currentColor" />
                      <span>Start Queue ({waSelectedStudents.length})</span>
                    </button>
                  </div>
                </div>

                {/* SEARCH & AUDIENCE STATS */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  <div className="sm:col-span-8 relative">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={waSearchQuery}
                      onChange={(e) => setWaSearchQuery(e.target.value)}
                      placeholder="Search class list by student, parent name or phone..."
                      className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="sm:col-span-4 text-right">
                    <span className="text-[10.5px] font-black uppercase text-emerald-800 font-mono bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      Selected Arrears: GHS {waTotalOutstandingSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* TABLE OF CLASS STUDENTS & PREFILLED WHATSAPP MESSAGES */}
                <div className="flex-1 overflow-x-auto border border-slate-200 rounded-xl max-h-[420px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                        <th className="py-2.5 px-3 text-center w-10">
                          <input
                            type="checkbox"
                            checked={waSelectedStudentIds.length > 0 && waSelectedStudentIds.length === waFilteredStudents.filter(s => s.guardianTelephone && s.guardianTelephone.trim().length > 3).length}
                            onChange={handleWaToggleAll}
                            className="rounded accent-emerald-600 focus:ring-0 cursor-pointer"
                          />
                        </th>
                        <th className="py-2.5 px-3 w-36">Student / Class</th>
                        <th className="py-2.5 px-3 w-32">Guardian & Phone</th>
                        <th className="py-2.5 px-3 w-28">Fee Balance</th>
                        <th className="py-2.5 px-3">Pre-filled Message Preview</th>
                        <th className="py-2.5 px-3 text-right pr-4 w-28">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {waFilteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-12 text-slate-400 italic font-medium">
                            No students found in {waSelectedClass} matching fee criteria.
                          </td>
                        </tr>
                      ) : (
                        waFilteredStudents.map(student => {
                          const hasPhone = student.guardianTelephone && student.guardianTelephone.trim().length > 3;
                          const feeBal = feeBillsMap[student.id] || 0;
                          const isSelected = waSelectedStudentIds.includes(student.id);
                          const compiledMsg = compileWaMessage(student);
                          const waDirectUrl = getWaDirectLink(student);
                          const formattedPhone = getWaFormattedPhone(student);

                          return (
                            <tr
                              key={student.id}
                              className={`hover:bg-slate-50/80 transition ${!isSelected && hasPhone ? 'bg-slate-50/30' : ''} ${!hasPhone ? 'bg-rose-50/20 opacity-75' : ''}`}
                            >
                              {/* CHECKBOX */}
                              <td className="py-3 px-3 text-center">
                                {hasPhone ? (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleWaToggleOne(student.id)}
                                    className="rounded accent-emerald-600 focus:ring-0 cursor-pointer"
                                  />
                                ) : (
                                  <span className="text-rose-500 block text-[9.5px] font-bold" title="Missing guardian phone number">⚠️</span>
                                )}
                              </td>

                              {/* STUDENT NAME & CLASS */}
                              <td className="py-3 px-3">
                                <div className="font-bold text-slate-900 leading-tight">
                                  {student.firstName} {student.lastName}
                                </div>
                                <div className="text-[10px] text-slate-500 font-semibold flex items-center gap-1.5 mt-0.5">
                                  <span className="bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">{student.class}</span>
                                  <span className="font-mono text-[9px] text-slate-400">ID: {student.id}</span>
                                </div>
                              </td>

                              {/* GUARDIAN & PHONE */}
                              <td className="py-3 px-3">
                                <div className="font-bold text-slate-800 text-[11px]">
                                  {student.guardianName || 'Guardian'}
                                </div>
                                {hasPhone ? (
                                  <div className="font-mono text-[10px] text-emerald-700 font-bold flex items-center gap-1 mt-0.5">
                                    <MessageCircle size={10} className="text-emerald-600" />
                                    +{formattedPhone}
                                  </div>
                                ) : (
                                  <span className="text-[9.5px] text-rose-500 font-bold block mt-0.5">No Phone Recorded</span>
                                )}
                              </td>

                              {/* FEE BALANCE */}
                              <td className="py-3 px-3">
                                {feeBal > 0 ? (
                                  <span className="inline-block px-2 py-1 bg-amber-50 border border-amber-200 text-amber-900 font-mono font-black text-xs rounded-lg shadow-2xs">
                                    GHS {feeBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                ) : (
                                  <span className="inline-block px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono font-bold text-[10px] rounded-md">
                                    Paid (GHS 0)
                                  </span>
                                )}
                              </td>

                              {/* PREFILLED WHATSAPP MESSAGE PREVIEW */}
                              <td className="py-3 px-3 max-w-[260px]">
                                <div className="bg-slate-50 border border-slate-200/80 p-2 rounded-xl text-[10px] font-medium text-slate-700 leading-relaxed max-h-20 overflow-y-auto whitespace-pre-wrap font-sans">
                                  {compiledMsg}
                                </div>
                              </td>

                              {/* ACTIONS */}
                              <td className="py-3 px-3 text-right pr-4">
                                {hasPhone ? (
                                  <div className="flex items-center justify-end gap-1.5">
                                    {/* Direct Launch WhatsApp */}
                                    <a
                                      href={waDirectUrl}
                                      onClick={() => logWaUtilityDispatch(student)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition cursor-pointer flex items-center gap-1 shadow-xs"
                                      title="Open WhatsApp with pre-filled fee reminder"
                                    >
                                      <MessageCircle size={13} />
                                      <span className="hidden sm:inline text-[10px]">Send</span>
                                    </a>

                                    {/* Copy Message */}
                                    <button
                                      type="button"
                                      onClick={() => handleCopyWaMessage(student)}
                                      className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg text-xs transition cursor-pointer"
                                      title="Copy pre-filled text message to clipboard"
                                    >
                                      {copiedIndex === `msg_${student.id}` ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                                    </button>

                                    {/* Copy Link */}
                                    <button
                                      type="button"
                                      onClick={() => handleCopyWaLink(student)}
                                      className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg text-xs transition cursor-pointer"
                                      title="Copy wa.me link to clipboard"
                                    >
                                      {copiedIndex === `link_${student.id}` ? <Check size={13} className="text-emerald-600" /> : <ExternalLink size={13} />}
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">No Phone</span>
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
        </div>
      )}

      {activeSubView === 'all-channels' && (
        /* GENERAL BROADCAST & SMS CENTER CHANNEL (EXISTING COMPONENT UI) */
        <>
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
            <button
              onClick={() => {
                setActiveChannel('gmail');
                setStorageItem('geetech_active_sms_channel', 'gmail');
              }}
              className={`p-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeChannel === 'gmail'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Mail size={14} />
              <span>Gmail Workspace</span>
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

        {/* GMAIL WORKSPACE CONFIGURATION AND AUTH */}
        {activeChannel === 'gmail' && (
          <div className="bg-rose-50/30 border border-rose-200 rounded-2xl p-5 shadow-8xs space-y-4 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rose-600 text-white rounded-lg flex items-center justify-center font-bold font-mono text-sm shadow-6xs">
                  <Mail size={20} />
                </div>
                <div>
                  <div className="text-[10px] font-black text-rose-700 uppercase tracking-wider font-display">Google Gmail Workspace Delivery</div>
                  <div className="flex items-center gap-2">
                    {isGoogleAuth ? (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                        <span className="text-sm font-bold text-slate-950">
                          Connected as <span className="font-mono text-rose-700">{googleUser?.email || "Workspace User"}</span>
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                        <span>Offline • Click Sign In with Google to authenticate.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                {isGoogleAuth ? (
                  <button
                    onClick={handleGoogleSignOutClick}
                    className="p-2 px-4 rounded-xl text-xs font-bold bg-white hover:bg-slate-150 text-slate-700 border border-slate-200 transition flex items-center gap-1.5 cursor-pointer shadow-9xs"
                  >
                    <span>Sign Out Workspace</span>
                  </button>
                ) : (
                  <button
                    onClick={handleGoogleSignInClick}
                    disabled={isAuthLoading}
                    className="p-2 px-4 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-6xs"
                  >
                    {isAuthLoading ? <RefreshCw size={13} className="animate-spin" /> : null}
                    <span>Sign In with Google</span>
                  </button>
                )}
              </div>
            </div>

            {isGoogleAuth && (
              <div className="bg-white p-4 rounded-xl border border-slate-150 space-y-3 shadow-9xs">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                    Configure Email Subject Line
                  </label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Enter email subject..."
                    className="w-full text-xs font-bold p-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-rose-500 focus:outline-none text-slate-950"
                  />
                  <span className="text-[10px] text-slate-450 mt-1 block leading-normal">
                    Tip: You can use tags like <code className="bg-slate-100 p-0.5 px-1 rounded text-rose-600 font-mono text-[9px]">{'{firstName}'}</code>, <code className="bg-slate-100 p-0.5 px-1 rounded text-rose-600 font-mono text-[9px]">{'{lastName}'}</code>, <code className="bg-slate-100 p-0.5 px-1 rounded text-rose-600 font-mono text-[9px]">{'{class}'}</code> or <code className="bg-slate-100 p-0.5 px-1 rounded text-rose-600 font-mono text-[9px]">{'{schoolName}'}</code> to personalize subject headers!
                  </span>
                </div>
              </div>
            )}
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
                {emailTemplates.map(tmpl => (
                  <button
                    key={tmpl.id}
                    onClick={() => handleSelectTemplate(tmpl.id)}
                    className={`px-3 py-2 text-left text-xs font-bold rounded-xl border transition flex items-center justify-between ${selectedTemplateId === tmpl.id ? 'bg-indigo-50 border-indigo-200 text-indigo-950' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-650'}`}
                  >
                    <span>{tmpl.name}</span>
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
              
              <SmartTextarea
                rows={5}
                value={templateText}
                onChange={(e: any) => {
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
                      const hasEmail = student.guardianEmail && student.guardianEmail.trim().length > 3;
                      const hasTarget = activeChannel === 'gmail' ? !!hasEmail : !!hasPhone;
                      const activeFeeBal = feeBillsMap[student.id] || 0;
                      const isSelected = selectedStudentIds.includes(student.id);
                      const parsedMsg = compileMessage(student, templateText);

                      return (
                        <tr 
                          key={student.id} 
                          className={`hover:bg-slate-50/50 transition ${!isSelected && hasTarget ? 'bg-slate-50/20' : ''} ${!hasTarget ? 'bg-rose-50/20 opacity-80' : ''}`}
                        >
                          {/* CHECKBOX */}
                          <td className="py-2.5 px-3 text-center">
                            {hasTarget ? (
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
                              {activeChannel === 'gmail' && hasEmail && (
                                <span className="font-mono text-rose-650 font-bold">{student.guardianEmail}</span>
                              )}
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
                            {hasTarget ? (
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
                                ) : activeChannel === 'gmail' ? (
                                  /* Gmail delivery option */
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await handleSingleSend(student, parsedMsg);
                                    }}
                                    className="p-1.5 px-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-7xs bg-rose-50 hover:bg-rose-100 border border-rose-250 text-rose-900"
                                    title="Send email individually to parent via Gmail"
                                  >
                                    <Mail size={11} className="text-rose-600" />
                                    <span>Send Gmail</span>
                                  </button>
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
                                {activeChannel === 'gmail' ? 'Missing Email' : 'Missing Mobile'}
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
                  <SmartTextarea
                    value={testSmsMessage}
                    onChange={(e: any) => setTestSmsMessage(e.target.value)}
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

        <div ref={logsContainerRef} className="overflow-x-auto border border-slate-150 rounded-xl max-h-[250px] overflow-y-auto">
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
    </>
  )}

  {/* DYNAMIC TEMPLATE MANAGER VIEW */}
  {activeSubView === 'template-editor' && (
    <div className="space-y-6">
      {/* HEADER HERO */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 p-6 rounded-2xl border border-indigo-800 text-white shadow-md space-y-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-indigo-500/20 border border-indigo-400/30 text-indigo-400 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner">
            <FileText size={26} />
          </div>
          <div>
            <h2 className="text-xl font-black font-display uppercase tracking-tight text-white">Dynamic Template Editor</h2>
            <p className="text-xs text-indigo-200/80 font-medium mt-0.5">
              Create, update, and manage reusable Email, SMS, and WhatsApp templates. Changes persist in real-time to Firestore and synchronize across administrator devices.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: EDITOR FORM (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-6" id="template-form-section">
          <form onSubmit={handleSaveTemplate} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="border-b border-slate-150 pb-3 flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-950 uppercase tracking-wider flex items-center gap-1.5 font-display">
                <Sliders size={15} className="text-indigo-600" />
                {editingTemplate ? 'Edit Template' : 'Create Custom Template'}
              </h3>
              {editingTemplate && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingTemplate(null);
                    setFormName('');
                    setFormSubject('');
                    setFormText('');
                    setFormDescription('');
                    setFormBadge('');
                    setEditorError('');
                    setEditorSuccess('');
                  }}
                  className="text-rose-600 hover:text-rose-800 text-[10.5px] font-black uppercase flex items-center gap-1 bg-rose-50 px-2 py-1 rounded-lg"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            {editorError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle size={15} className="flex-shrink-0 text-rose-650" />
                <span className="font-medium">{editorError}</span>
              </div>
            )}

            {editorSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle size={15} className="flex-shrink-0 text-emerald-650" />
                <span className="font-medium">{editorSuccess}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* TYPE SELECTOR */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 block">Template Channel:</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setFormType('email');
                      if (formType !== 'email') setFormSubject('');
                    }}
                    className={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      formType === 'email'
                        ? 'bg-white text-indigo-950 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Mail size={14} className="text-indigo-600" />
                    <span>Email & SMS</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormType('whatsapp');
                    }}
                    className={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      formType === 'whatsapp'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/30'
                    }`}
                  >
                    <MessageCircle size={14} />
                    <span>WhatsApp</span>
                  </button>
                </div>
              </div>

              {/* NAME */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 block">Template Identifier Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. End of Term Results Notification"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-250 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-medium transition"
                />
              </div>

              {/* SUBJECT (Email only) */}
              {formType === 'email' && (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">Default Email Subject Line:</label>
                  <input
                    type="text"
                    placeholder="e.g. Term Report Card Ready - {firstName} {lastName}"
                    value={formSubject}
                    onChange={e => setFormSubject(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-250 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-medium transition"
                  />
                </div>
              )}

              {/* WHATSAPP OPTIONAL FIELDS */}
              {formType === 'whatsapp' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">Badge text (Optional):</label>
                    <input
                      type="text"
                      placeholder="e.g. High Priority"
                      value={formBadge}
                      onChange={e => setFormBadge(e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-250 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-medium transition"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">Subtitle (Optional):</label>
                    <input
                      type="text"
                      placeholder="e.g. Polite reminder for balance"
                      value={formDescription}
                      onChange={e => setFormDescription(e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-250 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-medium transition"
                    />
                  </div>
                </div>
              )}

              {/* TEXT CONTENT BODY */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 block">Message Body Content:</label>
                  <span className="text-[9.5px] font-mono text-slate-400 font-bold bg-slate-100 px-1.5 py-0.5 rounded">
                    Chars: {formText.length} ({Math.ceil(formText.length / 160)} SMS parts)
                  </span>
                </div>
                <textarea
                  id="template-form-text"
                  rows={6}
                  required
                  placeholder="Type your template text here. Use variables below..."
                  value={formText}
                  onChange={e => setFormText(e.target.value)}
                  className="w-full text-xs p-3 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-250 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-medium transition font-mono leading-relaxed resize-y"
                />
              </div>

              {/* VARIABLE CHIPS HELPER */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Click variable to insert at cursor:
                </span>
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  {[
                    { tag: '{firstName}', label: 'First Name' },
                    { tag: '{lastName}', label: 'Last Name' },
                    { tag: '{guardianName}', label: 'Parent Name' },
                    { tag: '{class}', label: 'Class' },
                    { tag: '{feeBalance}', label: 'Fees Due' },
                    { tag: '{reportLink}', label: 'Report URL' },
                    { tag: '{schoolName}', label: 'School Name' },
                    { tag: '{term}', label: 'Current Term' }
                  ].map(v => (
                    <button
                      key={v.tag}
                      type="button"
                      onClick={() => insertFormVariable(v.tag)}
                      className="px-2 py-1 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-700 hover:text-indigo-950 text-[10px] font-bold rounded-lg transition shadow-2xs flex items-center gap-1 cursor-pointer"
                    >
                      <span className="text-indigo-600 font-mono font-bold">{v.tag}</span>
                      <span className="text-slate-400 text-[9px] font-normal font-sans">({v.label})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-150 flex items-center justify-end gap-2">
              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-md active:translate-y-0.5"
              >
                <Send size={14} />
                <span>{editingTemplate ? 'Update Template Parameters' : 'Save & Publish Template'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT COLUMN: TEMPLATES LIST (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            {/* SEARCH AND FILTERS */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Search saved templates..."
                  value={templateSearch}
                  onChange={e => setTemplateSearch(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 hover:bg-slate-100/50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-medium transition"
                />
              </div>
              
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'email', label: 'Email/SMS' },
                  { id: 'whatsapp', label: 'WhatsApp' }
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTemplateTypeFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      templateTypeFilter === f.id
                        ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* TEMPLATES LIST GRID */}
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {/* Custom saved templates */}
              {(() => {
                // Combine default and custom templates for visual selection
                const allList = [
                  ...dbTemplates.map(t => ({ ...t, isCustom: true })),
                  ...DEFAULT_SMS_TEMPLATES.map(t => ({ ...t, isCustom: false })),
                  ...DEFAULT_WA_TEMPLATES.map(t => ({ ...t, isCustom: false }))
                ];

                const filtered = allList.filter(t => {
                  if (templateTypeFilter !== 'all' && t.type !== templateTypeFilter) return false;
                  if (templateSearch.trim()) {
                    const s = templateSearch.toLowerCase();
                    return (
                      t.name.toLowerCase().includes(s) ||
                      t.text.toLowerCase().includes(s) ||
                      (t.subject && t.subject.toLowerCase().includes(s))
                    );
                  }
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-xs text-slate-400 font-bold">No templates found matching search criteria.</p>
                    </div>
                  );
                }

                return filtered.map(tmpl => {
                  const isEmail = tmpl.type === 'email';
                  const isCustom = tmpl.isCustom;
                  return (
                    <div
                      key={tmpl.id + (isCustom ? '_custom' : '_default')}
                      className={`p-4 rounded-xl border transition space-y-3 ${
                        editingTemplate?.id === tmpl.id && isCustom
                          ? 'bg-indigo-50/50 border-indigo-300 ring-1 ring-indigo-300'
                          : 'bg-white hover:bg-slate-50/70 border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="text-xs font-black text-slate-900 font-display">
                              {tmpl.name}
                            </span>
                            {isEmail ? (
                              <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[8.5px] font-black px-1.5 py-0.5 rounded uppercase">
                                Email & SMS
                              </span>
                            ) : (
                              <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-[8.5px] font-black px-1.5 py-0.5 rounded uppercase">
                                WhatsApp
                              </span>
                            )}
                            {isCustom ? (
                              <span className="bg-amber-50 border border-amber-100 text-amber-700 text-[8.5px] font-black px-1.5 py-0.5 rounded uppercase">
                                Custom Saved
                              </span>
                            ) : (
                              <span className="bg-slate-100 border border-slate-200 text-slate-500 text-[8.5px] font-black px-1.5 py-0.5 rounded uppercase">
                                Read-Only System Default
                              </span>
                            )}
                          </div>
                          {tmpl.subject && (
                            <p className="text-[10.5px] text-indigo-950 font-bold">
                              Subject: <span className="font-semibold text-slate-650">{tmpl.subject}</span>
                            </p>
                          )}
                          {tmpl.description && (
                            <p className="text-[10px] text-slate-400 italic">
                              {tmpl.description}
                            </p>
                          )}
                        </div>

                        {/* ACTIONS */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {isCustom ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleEditTemplate(tmpl)}
                                className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition cursor-pointer"
                                title="Edit Template"
                              >
                                <Sliders size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTemplate(tmpl.id)}
                                className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                                title="Delete Template"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                // Clone to custom
                                setFormName(tmpl.name + ' (Custom)');
                                setFormType(tmpl.type);
                                setFormSubject(tmpl.subject || '');
                                setFormText(tmpl.text);
                                setFormDescription(tmpl.description || '');
                                setFormBadge(tmpl.badge || '');
                                setEditingTemplate(null);
                                triggerToast('Template parameters cloned into editor form!');
                                
                                const formEl = document.getElementById('template-form-section');
                                if (formEl) {
                                  formEl.scrollIntoView({ behavior: 'smooth' });
                                }
                              }}
                              className="px-2 py-1 bg-indigo-50 text-indigo-750 border border-indigo-100 hover:bg-indigo-100 text-[10px] font-extrabold rounded-lg transition cursor-pointer flex items-center gap-1"
                            >
                              <Copy size={10} />
                              <span>Customize</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* BODY TEXT PREVIEW */}
                      <div className="bg-slate-50/50 p-2.5 rounded-lg border border-slate-150 text-[10.5px] font-mono text-slate-600 leading-normal whitespace-pre-wrap break-words">
                        {tmpl.text}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )}

  {/* SEQUENTIAL WHATSAPP DISPATCH QUEUE MODAL */}
  {isQueueModalOpen && waSelectedStudents.length > 0 && (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden space-y-0">
        
        {/* MODAL HEADER */}
        <div className="bg-gradient-to-r from-emerald-800 to-emerald-950 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 rounded-xl flex items-center justify-center">
              <MessageCircle size={22} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase font-display tracking-tight text-white">Sequential WhatsApp Fee Reminders</h3>
              <p className="text-[11px] text-emerald-200/80 font-medium">
                Queue Item {queueIndex + 1} of {waSelectedStudents.length} ({waSelectedClass})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsQueueModalOpen(false)}
            className="p-1.5 hover:bg-white/10 rounded-lg text-emerald-200 hover:text-white transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* PROGRESS BAR */}
        <div className="w-full bg-slate-100 h-2">
          <div
            className="bg-emerald-500 h-full transition-all duration-300"
            style={{ width: `${((queueIndex + 1) / waSelectedStudents.length) * 100}%` }}
          />
        </div>

        {/* MODAL BODY */}
        {(() => {
          const student = waSelectedStudents[queueIndex] || waSelectedStudents[0];
          const feeBal = feeBillsMap[student.id] || 0;
          const formattedPhone = getWaFormattedPhone(student);
          const compiledMsg = compileWaMessage(student);
          const waUrl = getWaDirectLink(student);

          return (
            <div className="p-6 space-y-5">
              {/* STUDENT & GUARDIAN DETAILS CARD */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded font-mono">
                      {student.class}
                    </span>
                    <h4 className="text-base font-black text-slate-900 mt-1">
                      {student.firstName} {student.lastName}
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">
                      Guardian: <strong className="text-slate-800">{student.guardianName || 'Parent'}</strong>
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Fee Arrears</span>
                    <span className="text-base font-black text-amber-600 font-mono block">
                      GHS {feeBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/80">
                  <span className="font-bold text-slate-600 flex items-center gap-1">
                    <MessageCircle size={14} className="text-emerald-600" />
                    WhatsApp Phone:
                  </span>
                  <span className="font-mono font-bold text-slate-900">+{formattedPhone}</span>
                </div>
              </div>

              {/* PREFILLED MESSAGE BOX */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                  Generated WhatsApp Message Payload:
                </label>
                <div className="bg-emerald-50/50 border border-emerald-200/80 p-3.5 rounded-2xl text-xs font-medium text-slate-800 leading-relaxed font-sans max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {compiledMsg}
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="space-y-2 pt-2">
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    logWaUtilityDispatch(student);
                    if (queueIndex + 1 < waSelectedStudents.length) {
                      setQueueIndex(prev => prev + 1);
                    } else {
                      setIsQueueModalOpen(false);
                      triggerToast("Finished WhatsApp fee reminders queue!", 'success');
                    }
                  }}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer transition active:translate-y-0.5"
                >
                  <MessageCircle size={16} />
                  <span>Open WhatsApp Chat & Advance ({queueIndex + 1}/{waSelectedStudents.length}) &rarr;</span>
                </a>

                <div className="flex items-center justify-between gap-2 text-xs pt-1">
                  <button
                    type="button"
                    disabled={queueIndex === 0}
                    onClick={() => setQueueIndex(prev => Math.max(0, prev - 1))}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-bold rounded-lg transition cursor-pointer"
                  >
                    &larr; Previous Parent
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (queueIndex + 1 < waSelectedStudents.length) {
                        setQueueIndex(prev => prev + 1);
                      } else {
                        setIsQueueModalOpen(false);
                        triggerToast("Finished WhatsApp fee reminders queue!", 'success');
                      }
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition cursor-pointer"
                  >
                    Skip Parent &rarr;
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  )}

</div>
  );
}
