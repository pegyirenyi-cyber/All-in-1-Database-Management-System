import React, { useState, useRef } from 'react';
import { SchoolInfo, UserAccount } from '../types';
import { DbController } from '../db';
import { 
  Building2, 
  Calendar, 
  GraduationCap, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  ShieldCheck,
  Upload,
  Link,
  Check,
  X,
  FileSignature,
  Landmark,
  Smartphone,
  Eye,
  EyeOff,
  Palette,
  BookOpen,
  MapPin,
  RotateCcw,
  CreditCard,
  Lock,
  Layers,
  HelpCircle,
  FileText,
  LogOut
} from 'lucide-react';

interface SetupWizardProps {
  currentUser: UserAccount;
  initialSchoolInfo: SchoolInfo;
  onComplete: (updatedSchool: SchoolInfo) => void;
  onBackToLogin?: () => void;
  onLogout?: () => void;
}

// 16 Official Administrative Regions of Ghana
const GHANA_REGIONS = [
  'Greater Accra',
  'Ashanti',
  'Central',
  'Eastern',
  'Western',
  'Western North',
  'Volta',
  'Oti',
  'Northern',
  'North East',
  'Savannah',
  'Upper East',
  'Upper West',
  'Bono',
  'Bono East',
  'Ahafo'
];

// Presets for institutional themes
const THEME_PALETTES = [
  { name: 'GES Navy', hex: '#1e3a8a', bgClass: 'bg-blue-900' },
  { name: 'Royal Indigo', hex: '#4338ca', bgClass: 'bg-indigo-700' },
  { name: 'Forest Emerald', hex: '#065f46', bgClass: 'bg-emerald-800' },
  { name: 'Crimson Burgundy', hex: '#881337', bgClass: 'bg-rose-900' },
  { name: 'Deep Purple', hex: '#581c87', bgClass: 'bg-purple-900' },
  { name: 'Classic Slate', hex: '#0f172a', bgClass: 'bg-slate-900' }
];

// Class stream categories (Strictly Basic School: Pre-school, Primary, Basic 7-9)
const CLASS_GROUPS = [
  {
    title: 'Pre-School / Early Childhood',
    classes: ['Creche', 'Nursery 1', 'Nursery 2', 'Kindergarten 1', 'Kindergarten 2']
  },
  {
    title: 'Primary School (Basic 1 - 6)',
    classes: ['Basic 1', 'Basic 2', 'Basic 3', 'Basic 4', 'Basic 5', 'Basic 6']
  },
  {
    title: 'Junior High School (Basic 7 - 9)',
    classes: ['Basic 7', 'Basic 8', 'Basic 9']
  }
];

// Helper to calculate total Monday-to-Friday school days between opening and closing dates
export const calculateSchoolDays = (startStr: string, endStr: string): number => {
  if (!startStr || !endStr) return 0;
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;

  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    // Monday (1) through Friday (5) are official school days
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
};

export const SetupWizard: React.FC<SetupWizardProps> = ({
  currentUser,
  initialSchoolInfo,
  onComplete,
  onBackToLogin,
  onLogout
}) => {
  const [currentStage, setCurrentStage] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isExitingToLogin, setIsExitingToLogin] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleBackToLogin = () => {
    setIsExitingToLogin(true);
    if (onBackToLogin) {
      onBackToLogin();
    } else if (onLogout) {
      onLogout();
    } else {
      DbController.logout();
      window.location.reload();
    }
  };

  // Module 1: Institution Identity & Accreditation
  const [schoolName, setSchoolName] = useState<string>(initialSchoolInfo.schoolName || initialSchoolInfo.name || '');
  const [motto, setMotto] = useState<string>(initialSchoolInfo.motto || '');
  const [emisCode, setEmisCode] = useState<string>(initialSchoolInfo.emisCode || '');
  const [gesRegNumber, setGesRegNumber] = useState<string>(initialSchoolInfo.gesRegNumber || initialSchoolInfo.schoolNumber || '');
  const [email, setEmail] = useState<string>(initialSchoolInfo.email || currentUser.email || '');
  const [phone, setPhone] = useState<string>(initialSchoolInfo.phone || initialSchoolInfo.telephone || '');
  const [address, setAddress] = useState<string>(initialSchoolInfo.address || initialSchoolInfo.officialAddress || '');
  const [country, setCountry] = useState<string>(initialSchoolInfo.country || 'Ghana');
  const [region, setRegion] = useState<string>(initialSchoolInfo.region || 'Greater Accra');
  const [district, setDistrict] = useState<string>(initialSchoolInfo.district || '');
  const [circuit, setCircuit] = useState<string>(initialSchoolInfo.circuit || '');
  const [currency, setCurrency] = useState<string>(initialSchoolInfo.currency || 'GHS');

  // Module 2: Academic Calendar & Term Configuration
  const [academicYear, setAcademicYear] = useState<string>(initialSchoolInfo.academicYear || '');
  const [currentTerm, setCurrentTerm] = useState<string>(initialSchoolInfo.currentTerm || '');
  const [termStartDate, setTermStartDate] = useState<string>(initialSchoolInfo.termStartDate || '');
  const [termEndDate, setTermEndDate] = useState<string>(initialSchoolInfo.termEndDate || '');
  const [nextTermStartDate, setNextTermStartDate] = useState<string>((initialSchoolInfo as any).nextTermStartDate || initialSchoolInfo.reopeningDate || '');
  
  // Initialize and auto-compute total school days
  const [totalTermDays, setTotalTermDays] = useState<number | string>(() => {
    if (initialSchoolInfo.termStartDate && initialSchoolInfo.termEndDate) {
      const computed = calculateSchoolDays(initialSchoolInfo.termStartDate, initialSchoolInfo.termEndDate);
      if (computed > 0) return computed;
    }
    return (initialSchoolInfo as any).totalTermDays || '';
  });

  // Dynamically recalculate school days whenever term opening or closing date is selected
  React.useEffect(() => {
    if (termStartDate && termEndDate) {
      const computed = calculateSchoolDays(termStartDate, termEndDate);
      if (computed > 0) {
        setTotalTermDays(computed);
      }
    }
  }, [termStartDate, termEndDate]);

  // Module 3: Class Streams & Curriculum Structure
  const [selectedClasses, setSelectedClasses] = useState<string[]>(
    initialSchoolInfo.selectedClasses && initialSchoolInfo.selectedClasses.length > 0 
      ? initialSchoolInfo.selectedClasses 
      : []
  );
  const [gradingSystem, setGradingSystem] = useState<string>(
    initialSchoolInfo.gradingSystem || ''
  );
  const [assessmentWeighting, setAssessmentWeighting] = useState<string>('');

  // Module 4: Branding, Headteacher Signature & Credentials
  const [logoUrl, setLogoUrl] = useState<string>(initialSchoolInfo.logoUrl || initialSchoolInfo.crestUrl || '');
  const [signatureUrl, setSignatureUrl] = useState<string>(initialSchoolInfo.signatureUrl || initialSchoolInfo.headteacherSignatureUrl || '');
  const [stampUrl, setStampUrl] = useState<string>(initialSchoolInfo.stampUrl || '');
  const [primaryColor, setPrimaryColor] = useState<string>(initialSchoolInfo.primaryColor || '#1e3a8a');
  const [headName, setHeadName] = useState<string>(initialSchoolInfo.headteacherName || currentUser.name || '');
  const [headEmail, setHeadEmail] = useState<string>(initialSchoolInfo.headteacherEmail || currentUser.email || '');
  const [headPhone, setHeadPhone] = useState<string>(initialSchoolInfo.headteacherPhone || '');
  const [staffId, setStaffId] = useState<string>(currentUser.staffId || '');

  // Drag and drop image states
  const [isDraggingCrest, setIsDraggingCrest] = useState<boolean>(false);
  const [isDraggingSignature, setIsDraggingSignature] = useState<boolean>(false);
  const crestFileInputRef = useRef<HTMLInputElement>(null);
  const sigFileInputRef = useRef<HTMLInputElement>(null);

  // Module 5: Tuition Fees, Banking, MoMo & Paystack
  const [defaultTermFee, setDefaultTermFee] = useState<number | string>(initialSchoolInfo.defaultTermFee ? initialSchoolInfo.defaultTermFee : '');
  const [bankName, setBankName] = useState<string>(initialSchoolInfo.bankName || '');
  const [bankAccountNum, setBankAccountNum] = useState<string>(initialSchoolInfo.bankAccountNum || '');
  const [bankAccountName, setBankAccountName] = useState<string>((initialSchoolInfo as any).bankAccountName || '');
  const [momoNetwork, setMomoNetwork] = useState<string>('MTN Mobile Money');
  const [momoMerchantName, setMomoMerchantName] = useState<string>('');
  const [momoMerchantNumber, setMomoMerchantNumber] = useState<string>(initialSchoolInfo.momoMerchantNumber || '');
  const [enableOnlineGateway, setEnableOnlineGateway] = useState<boolean>(Boolean(initialSchoolInfo.paystackPublicKey));
  const [paystackMode, setPaystackMode] = useState<'test' | 'live'>(initialSchoolInfo.paystackMode || 'test');
  const [paystackPublicKey, setPaystackPublicKey] = useState<string>(initialSchoolInfo.paystackPublicKey || '');
  const [paystackSecretKey, setPaystackSecretKey] = useState<string>(initialSchoolInfo.paystackSecretKey || '');
  const [showPaystackSecret, setShowPaystackSecret] = useState<boolean>(false);

  const totalStages = 5;

  const STAGE_TITLES = [
    { num: 1, title: 'Institution Identity', icon: Building2 },
    { num: 2, title: 'Academic Calendar', icon: Calendar },
    { num: 3, title: 'Classes & Grading', icon: GraduationCap },
    { num: 4, title: 'Branding & Signatures', icon: Palette },
    { num: 5, title: 'Fees & Gateways', icon: Landmark }
  ];

  // Base64 file converter
  const handleImageFile = (file: File | undefined, type: 'crest' | 'signature') => {
    if (!file) return;
    setErrorMsg('');

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, JPEG, WEBP, or SVG).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image size exceeds 5MB. Please upload an image under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Str = e.target?.result as string;
      if (type === 'crest') {
        setLogoUrl(base64Str);
      } else if (type === 'signature') {
        setSignatureUrl(base64Str);
      }
    };
    reader.onerror = () => {
      setErrorMsg('Failed to process image file into Base64 format.');
    };
    reader.readAsDataURL(file);
  };

  // Stage validation
  const validateStage = async (stageNum: number | 'all'): Promise<boolean> => {
    setIsValidating(true);
    setErrorMsg('');
    const newFieldErrors: Record<string, string> = {};

    const payload = {
      schoolName: schoolName.trim(),
      name: schoolName.trim(),
      motto: motto.trim(),
      emisCode: emisCode.trim(),
      gesRegNumber: gesRegNumber.trim(),
      email: email.trim(),
      phone: phone.trim(),
      telephone: phone.trim(),
      address: address.trim(),
      officialAddress: address.trim(),
      country: country.trim(),
      region: region.trim(),
      district: district.trim(),
      circuit: circuit.trim(),
      currency: currency.trim(),
      currentTerm: currentTerm.trim(),
      academicYear: academicYear.trim(),
      termStartDate,
      termEndDate,
      headteacherName: headName.trim(),
      headName: headName.trim(),
      headteacherEmail: headEmail.trim(),
      headEmail: headEmail.trim(),
      headteacherPhone: headPhone.trim(),
      headPhone: headPhone.trim(),
      staffId: staffId.trim(),
      logoUrl: logoUrl.trim(),
      crestUrl: logoUrl.trim(),
      signatureUrl: signatureUrl.trim(),
      headteacherSignatureUrl: signatureUrl.trim(),
      stampUrl: stampUrl.trim(),
      primaryColor: primaryColor.trim(),
      selectedClasses,
      gradingSystem: gradingSystem.trim(),
      defaultTermFee: Number(defaultTermFee) || 0,
      bankName: bankName.trim(),
      bankAccountNum: bankAccountNum.trim(),
      momoMerchantNumber: momoMerchantNumber.trim(),
      paystackMode,
      paystackPublicKey: paystackPublicKey.trim(),
      paystackSecretKey: paystackSecretKey.trim()
    };

    // Instantaneous local validation without network latency
    const localErrors: Record<string, string> = {};

    if (!stageNum || stageNum === 1 || stageNum === 'all') {
      if (!schoolName.trim()) {
        localErrors.schoolName = 'Official School Name is required.';
      }
    }

    if (!stageNum || stageNum === 2 || stageNum === 'all') {
      if (!academicYear.trim()) {
        localErrors.academicYear = 'Academic year is required.';
      }
      if (!currentTerm.trim()) {
        localErrors.currentTerm = 'Current term is required.';
      }
    }

    if (!stageNum || stageNum === 3 || stageNum === 'all') {
      if (!selectedClasses || selectedClasses.length === 0) {
        localErrors.selectedClasses = 'Please select at least one class.';
      }
    }

    if (!stageNum || stageNum === 4 || stageNum === 'all') {
      if (headEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(headEmail.trim())) {
        localErrors.headEmail = 'Please provide a valid email format for Headteacher.';
      }
    }

    if (!stageNum || stageNum === 5 || stageNum === 'all') {
      if (Number(defaultTermFee) < 0) {
        localErrors.defaultTermFee = 'Default term fee must be non-negative.';
      }
    }

    setIsValidating(false);

    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      setErrorMsg(Object.values(localErrors)[0] || 'Please check highlighted inputs.');
      return false;
    }

    setFieldErrors({});
    return true;
  };

  const handleNext = async () => {
    setErrorMsg('');
    const isValid = await validateStage(currentStage);
    if (!isValid) return;

    if (currentStage < totalStages) {
      setCurrentStage(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    setErrorMsg('');
    setFieldErrors({});
    if (currentStage > 1) {
      setCurrentStage(prev => prev - 1);
    }
  };

  const executeLaunch = async () => {
    setIsSubmitting(true);
    setErrorMsg('');

    // Ensure stage 1 has at least a school name
    if (!schoolName.trim()) {
      setCurrentStage(1);
      setFieldErrors({ schoolName: 'Official School Name is required.' });
      setErrorMsg('Please provide your School Name before launching.');
      setIsSubmitting(false);
      return;
    }

    try {
      const activeSchoolId = initialSchoolInfo.schoolId || initialSchoolInfo.id || 'school_' + currentUser.uid;

      const updatedSchool: SchoolInfo = {
        ...initialSchoolInfo,
        id: activeSchoolId,
        schoolId: activeSchoolId,
        name: schoolName.trim() || initialSchoolInfo.name || 'Ghana Education Service School',
        schoolName: schoolName.trim() || initialSchoolInfo.name || 'Ghana Education Service School',
        motto: motto.trim(),
        emisCode: emisCode.trim(),
        gesRegNumber: gesRegNumber.trim(),
        schoolNumber: gesRegNumber.trim(),
        email: email.trim() || initialSchoolInfo.email || '',
        telephone: phone.trim() || initialSchoolInfo.telephone || '',
        phone: phone.trim() || initialSchoolInfo.phone || '',
        address: address.trim(),
        officialAddress: address.trim(),
        country: country.trim() || 'Ghana',
        region: region.trim() || 'Greater Accra',
        district: district.trim(),
        circuit: circuit.trim(),
        currency: currency.trim() || 'GHS',
        currentTerm: currentTerm.trim(),
        academicYear: academicYear.trim(),
        termStartDate,
        termEndDate,
        reopeningDate: nextTermStartDate.trim() || initialSchoolInfo.reopeningDate || '',
        nextTermStartDate: nextTermStartDate.trim(),
        headteacherName: headName.trim() || currentUser.name,
        headteacherEmail: headEmail.trim() || currentUser.email,
        headteacherPhone: headPhone.trim(),
        logoUrl: logoUrl.trim(),
        crestUrl: logoUrl.trim(),
        signatureUrl: signatureUrl.trim(),
        headteacherSignatureUrl: signatureUrl.trim(),
        stampUrl: stampUrl.trim(),
        primaryColor: primaryColor.trim() || '#1e3a8a',
        gradingSystem: gradingSystem.trim(),
        defaultTermFee: Number(defaultTermFee) || 0,
        bankName: bankName.trim(),
        bankAccountNum: bankAccountNum.trim(),
        momoMerchantNumber: momoMerchantNumber.trim(),
        paystackMode: enableOnlineGateway ? paystackMode : 'test',
        paystackPublicKey: enableOnlineGateway ? paystackPublicKey.trim() : '',
        paystackSecretKey: enableOnlineGateway ? paystackSecretKey.trim() : '',
        setupWizardCompleted: true
      };

      // 1. Immediately store persistent local flags to prevent ANY popups on refresh/logout
      try {
        localStorage.setItem('sms_setup_wizard_completed', 'true');
        if (currentUser.uid) {
          localStorage.setItem(`sms_setup_wizard_completed_${currentUser.uid}`, 'true');
        }
        if (activeSchoolId) {
          localStorage.setItem(`sms_setup_wizard_completed_${activeSchoolId}`, 'true');
        }
      } catch (storageErr) {
        console.warn('LocalStorage notice during wizard complete:', storageErr);
      }

      // 2. Persist school profile immediately into local memory cache and localStorage
      DbController.updateSchoolInfoLocally(updatedSchool);

      // 3. Update user account immediately
      if (currentUser?.uid) {
        DbController.updateUserAccount(currentUser.uid, {
          setupWizardCompleted: true,
          name: headName.trim() || currentUser.name,
          staffId: staffId.trim() || currentUser.staffId
        });
      }

      // 4. Save selected classes if configured
      if (selectedClasses && selectedClasses.length > 0) {
        try {
          DbController.saveClasses(selectedClasses);
        } catch (clsErr) {}
      }

      // 5. Fire background sync to Cloud Firestore (with bounded race so user is never blocked)
      Promise.race([
        DbController.saveSchoolInfo(updatedSchool),
        new Promise(resolve => setTimeout(resolve, 600))
      ]).catch(err => {
        console.warn('Background saveSchoolInfo sync notice:', err);
      });

      // 6. Transition to main dashboard workspace INSTANTLY
      setIsSubmitting(false);
      onComplete(updatedSchool);
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg('Failed to complete setup: ' + (err.message || String(err)));
    }
  };

  const toggleClass = (cls: string) => {
    if (selectedClasses.includes(cls)) {
      if (selectedClasses.length === 1) return; // Keep at least one
      setSelectedClasses(selectedClasses.filter(c => c !== cls));
    } else {
      setSelectedClasses([...selectedClasses, cls]);
    }
  };

  const selectPresetClasses = (type: 'basic' | 'primary' | 'all') => {
    if (type === 'basic') {
      setSelectedClasses(['Kindergarten 1', 'Kindergarten 2', 'Basic 1', 'Basic 2', 'Basic 3', 'Basic 4', 'Basic 5', 'Basic 6', 'Basic 7', 'Basic 8', 'Basic 9']);
    } else if (type === 'primary') {
      setSelectedClasses(['Basic 1', 'Basic 2', 'Basic 3', 'Basic 4', 'Basic 5', 'Basic 6']);
    } else if (type === 'all') {
      const all: string[] = [];
      CLASS_GROUPS.forEach(g => all.push(...g.classes));
      setSelectedClasses(all);
    }
  };

  // Preview domain for parent link demonstration
  const sampleOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://schoolportal.edu.gh';
  const sampleParentLink = `${sampleOrigin}/?parentMode=true&studentId=STU-001&year=${encodeURIComponent(academicYear)}&term=${encodeURIComponent(currentTerm)}&token=SEC-GHANA-TOKEN`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-3xl overflow-hidden flex flex-col my-auto transition-all animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header with progress & direct Skip option */}
        <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-blue-950 text-white p-5 sm:p-6 relative">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400/25 to-blue-500/20 backdrop-blur-md flex items-center justify-center border border-amber-300/35 shadow-inner">
                <GraduationCap className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black tracking-tight font-display">School Onboarding & Setup Wizard</h2>
                <p className="text-[11px] sm:text-xs text-indigo-200">Configure your institution once. All preferences synchronize permanently.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBackToLogin}
                disabled={isExitingToLogin}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/25 hover:bg-rose-500/40 text-rose-100 hover:text-white text-[11px] font-bold border border-rose-400/35 transition cursor-pointer active:scale-95 shadow-sm disabled:opacity-50"
                title="Return to login state"
              >
                <LogOut size={12} className="shrink-0 text-rose-300" />
                <span>Back to Login</span>
              </button>
              <button
                type="button"
                onClick={executeLaunch}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold border border-white/20 transition cursor-pointer"
                title="Save current details and enter dashboard immediately"
              >
                <span>Quick Launch</span>
                <ArrowRight size={12} />
              </button>
              <span className="bg-white/15 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-mono font-bold text-amber-300 border border-white/20">
                Step {currentStage} of {totalStages}
              </span>
            </div>
          </div>

          {/* Stepper Tabs Bar */}
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2 pt-1 pb-1">
            {STAGE_TITLES.map((step) => {
              const StepIcon = step.icon;
              const isActive = currentStage === step.num;
              const isPast = currentStage > step.num;
              return (
                <button
                  type="button"
                  key={step.num}
                  onClick={() => setCurrentStage(step.num)}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-1.5 px-1 rounded-xl text-[10px] font-bold transition cursor-pointer border ${
                    isActive 
                      ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm'
                      : isPast
                        ? 'bg-white/20 text-white border-white/25 hover:bg-white/30'
                        : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <StepIcon size={12} className={isActive ? 'text-slate-950' : isPast ? 'text-emerald-300' : 'text-slate-400'} />
                  <span className="hidden sm:inline truncate">{step.title}</span>
                  <span className="sm:hidden">{step.num}</span>
                </button>
              );
            })}
          </div>

          {/* Progress Line */}
          <div className="w-full bg-slate-900/80 h-1.5 rounded-full mt-3 overflow-hidden p-0 border border-indigo-800/40">
            <div 
              className="bg-gradient-to-r from-amber-400 via-emerald-400 to-teal-400 h-full rounded-full transition-all duration-300 shadow-sm"
              style={{ width: `${(currentStage / totalStages) * 100}%` }}
            />
          </div>
        </div>

        {/* Content body */}
        <div className="p-5 sm:p-7 max-h-[62vh] overflow-y-auto custom-scrollbar">
          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STAGE 1: Institution Identity & Accreditation */}
          {currentStage === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">1</div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">Institution Identity & GES Accreditation</h3>
                  <p className="text-xs text-slate-500">Official institutional identity, registration codes, and campus location in Ghana.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Official School Name *</span>
                    {fieldErrors.schoolName && <span className="text-[10px] text-rose-600 font-semibold">{fieldErrors.schoolName}</span>}
                  </label>
                  <input
                    type="text"
                    value={schoolName}
                    onChange={e => {
                      setSchoolName(e.target.value);
                      if (fieldErrors.schoolName) setFieldErrors(prev => { const n = { ...prev }; delete n.schoolName; return n; });
                    }}
                    placeholder="e.g. St. Jude International Academy"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">School Motto</label>
                  <input
                    type="text"
                    value={motto}
                    onChange={e => setMotto(e.target.value)}
                    placeholder="e.g. Discipline, Integrity and Excellence"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>EMIS Code (Optional)</span>
                    <span className="text-[10px] text-indigo-600 font-semibold">Ministry / GES EMIS</span>
                  </label>
                  <input
                    type="text"
                    value={emisCode}
                    onChange={e => setEmisCode(e.target.value.toUpperCase())}
                    placeholder="EMIS-09182736"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Leave blank if pending GES registration.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">GES Registration No.</label>
                  <input
                    type="text"
                    value={gesRegNumber}
                    onChange={e => setGesRegNumber(e.target.value)}
                    placeholder="GES/ACC/2026/089"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">GES Administrative Region</label>
                  <select
                    value={region}
                    onChange={e => setRegion(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  >
                    {GHANA_REGIONS.map(reg => (
                      <option key={reg} value={reg}>{reg} Region</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">District / Municipality</label>
                  <input
                    type="text"
                    value={district}
                    onChange={e => setDistrict(e.target.value)}
                    placeholder="e.g. Accra Metropolitan / Tema West"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Educational Circuit</label>
                  <input
                    type="text"
                    value={circuit}
                    onChange={e => setCircuit(e.target.value)}
                    placeholder="e.g. Adabraka Circuit 01"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Official School Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="info@academy.edu.gh"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">School Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+233 24 123 4567"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Physical Campus Location / Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="e.g. Plot 14, Independence Avenue, Adabraka, Accra"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STAGE 2: Academic Calendar & Term Configuration */}
          {currentStage === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">2</div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">Academic Calendar & Term Configuration</h3>
                  <p className="text-xs text-slate-500">Configure current academic session dates. Reopening and closing dates display on terminal reports.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Active Academic Year</label>
                  <input
                    type="text"
                    value={academicYear}
                    onChange={e => setAcademicYear(e.target.value)}
                    placeholder="2026/2027"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                  <div className="flex items-center gap-2 mt-1.5">
                    {['2025/2026', '2026/2027', '2027/2028'].map(yr => (
                      <button
                        type="button"
                        key={yr}
                        onClick={() => setAcademicYear(yr)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition ${
                          academicYear === yr ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {yr}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Current Active Term</label>
                  <select
                    value={currentTerm}
                    onChange={e => setCurrentTerm(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  >
                    <option value="Term 1">Term 1 (First Term)</option>
                    <option value="Term 2">Term 2 (Second Term)</option>
                    <option value="Term 3">Term 3 (Third Term)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Term Reopening Date</label>
                  <input
                    type="date"
                    value={termStartDate}
                    onChange={e => setTermStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Term Vacation / Closing Date</label>
                  <input
                    type="date"
                    value={termEndDate}
                    onChange={e => setTermEndDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Next Term Resumption Date</label>
                  <input
                    type="date"
                    value={nextTermStartDate}
                    onChange={e => setNextTermStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Printed on report cards for parent awareness.</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Total School Days
                    </label>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                      Auto-Calculated
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={totalTermDays}
                      readOnly
                      placeholder="e.g. 65"
                      className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 cursor-not-allowed select-none focus:outline-none"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                      <Lock size={14} />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {termStartDate && termEndDate && Number(totalTermDays) > 0 
                      ? `Computed ${totalTermDays} official school days (Monday–Friday) between ${termStartDate} and ${termEndDate}.`
                      : 'Set term opening and closing dates above to automatically compute official school days.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 3: Class Streams & Curriculum Structure */}
          {currentStage === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">3</div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">Class Streams & GES Curriculum Grading</h3>
                  <p className="text-xs text-slate-500">Select active classroom levels and configure assessment benchmarks.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-800">Quick Class Presets:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => selectPresetClasses('basic')}
                      className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold border border-indigo-200 transition cursor-pointer"
                    >
                      Basic School (KG - Basic 9)
                    </button>
                    <button
                      type="button"
                      onClick={() => selectPresetClasses('primary')}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold border border-slate-200 transition cursor-pointer"
                    >
                      Primary Only
                    </button>
                    <button
                      type="button"
                      onClick={() => selectPresetClasses('all')}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold border border-slate-200 transition cursor-pointer"
                    >
                      All Levels
                    </button>
                  </div>
                </div>

                {/* Class Groups */}
                <div className="space-y-3">
                  {CLASS_GROUPS.map((group) => (
                    <div key={group.title} className="p-3 bg-slate-50/60 rounded-2xl border border-slate-200/80">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                        {group.title}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                        {group.classes.map((cls) => {
                          const isSelected = selectedClasses.includes(cls);
                          return (
                            <button
                              type="button"
                              key={cls}
                              onClick={() => toggleClass(cls)}
                              className={`px-3 py-2 rounded-xl text-xs font-bold border text-left transition flex items-center justify-between cursor-pointer ${
                                isSelected 
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <span className="truncate">{cls}</span>
                              {isSelected && <Check size={12} className="shrink-0 text-amber-300" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Grading Standards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Grading System Standard
                    </label>
                    <select
                      value={gradingSystem}
                      onChange={e => setGradingSystem(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                    >
                      <option value="GES Standards-Based Curriculum (Advance, Proficient, Approaching, Developing, Emerging)">
                        GES Standards-Based (Advance, Proficient, Approaching, Developing, Emerging)
                      </option>
                      <option value="GES Standard (A1 - F9)">
                        GES Standard (A1 - 80%+, B2, B3, C4, C5, C6, D7, E8, F9)
                      </option>
                      <option value="Competency-Based Descriptors (Exceeding, Meeting, Approaching, Developing)">
                        Competency Descriptors (Exceeding, Meeting, Approaching, Developing)
                      </option>
                      <option value="Standard Letter (A - F)">
                        Standard Letter (A: 90-100%, B: 80-89%, C: 70-79%, D: 60-69%, F: &lt;60%)
                      </option>
                      <option value="Percentage (0 - 100%)">
                        Percentage Score (0 - 100%)
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Assessment Weighting</label>
                    <select
                      value={assessmentWeighting}
                      onChange={e => setAssessmentWeighting(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                    >
                      <option value="SBA 50% / Exam 50%">Standard GES SBA 50% + Examination 50%</option>
                      <option value="SBA 30% / Exam 70%">Traditional SBA 30% + Examination 70%</option>
                      <option value="SBA 40% / Exam 60%">SBA 40% + Examination 60%</option>
                    </select>
                  </div>
                </div>

                {/* Built-in Remarks Descriptor Breakdown Display */}
                <div className="p-3.5 bg-gradient-to-br from-indigo-50/70 via-slate-50 to-blue-50/50 rounded-2xl border border-indigo-100 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                      <GraduationCap size={14} className="text-indigo-600" />
                      Built-in Standards-Based Curriculum Performance Remarks
                    </span>
                    <span className="text-[10px] font-mono font-bold text-indigo-600 bg-white px-2 py-0.5 rounded-full border border-indigo-200">
                      NaCCA / GES Standard
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-1">
                    <div className="p-2 rounded-xl bg-white border border-emerald-200 shadow-2xs">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-bold text-emerald-800 text-[11px]">Advance (L1)</span>
                        <span className="text-[10px] font-mono text-emerald-600 font-bold">80–100%</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">Highly Proficient; exceeds grade benchmarks</p>
                    </div>

                    <div className="p-2 rounded-xl bg-white border border-blue-200 shadow-2xs">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-bold text-blue-800 text-[11px]">Proficient (L2)</span>
                        <span className="text-[10px] font-mono text-blue-600 font-bold">68–79%</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">Competent; consistently satisfies standard</p>
                    </div>

                    <div className="p-2 rounded-xl bg-white border border-amber-200 shadow-2xs">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-bold text-amber-800 text-[11px]">Approaching (L3)</span>
                        <span className="text-[10px] font-mono text-amber-600 font-bold">54–67%</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">Approaching proficiency; basic mastery</p>
                    </div>

                    <div className="p-2 rounded-xl bg-white border border-purple-200 shadow-2xs">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-bold text-purple-800 text-[11px]">Developing (L4)</span>
                        <span className="text-[10px] font-mono text-purple-600 font-bold">40–53%</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">Developing grasp; requires targeted guidance</p>
                    </div>

                    <div className="p-2 rounded-xl bg-white border border-rose-200 shadow-2xs">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-bold text-rose-800 text-[11px]">Emerging (L5)</span>
                        <span className="text-[10px] font-mono text-rose-600 font-bold">0–39%</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">Beginning stage; needs remedial assistance</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 4: School Crest, Headteacher Signature & Branding */}
          {currentStage === 4 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs">4</div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">Institutional Branding & Headteacher Authorization</h3>
                  <p className="text-xs text-slate-500">Official crest and Headteacher signature are converted to Base64 and automatically embossed on terminal reports, transcripts and receipts.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Crest Uploader */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Official School Crest / Logo
                    </label>
                    {logoUrl && (
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                        <Check size={12} /> Ready
                      </span>
                    )}
                  </div>

                  <input 
                    type="file"
                    ref={crestFileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageFile(e.target.files?.[0], 'crest')}
                  />

                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingCrest(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDraggingCrest(false); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingCrest(false);
                      handleImageFile(e.dataTransfer.files?.[0], 'crest');
                    }}
                    onClick={() => crestFileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-4 text-center transition cursor-pointer flex flex-col items-center justify-center min-h-[150px] ${
                      isDraggingCrest 
                        ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]' 
                        : logoUrl 
                          ? 'border-emerald-200 bg-emerald-50/20' 
                          : 'border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-slate-100/70'
                    }`}
                  >
                    {logoUrl ? (
                      <div className="space-y-2">
                        <div className="w-16 h-16 mx-auto rounded-xl bg-white shadow-md p-1.5 border border-slate-200 flex items-center justify-center overflow-hidden">
                          <img src={logoUrl} alt="Crest Preview" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); crestFileInputRef.current?.click(); }}
                            className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-50 shadow-xs"
                          >
                            Replace
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setLogoUrl(''); }}
                            className="px-2.5 py-1 bg-rose-50 border border-rose-200 rounded-lg text-[10px] font-bold text-rose-600 hover:bg-rose-100 shadow-xs"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5 py-2">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
                          <Upload size={18} />
                        </div>
                        <div className="text-xs font-bold text-slate-800">
                          Drop school crest here
                        </div>
                        <p className="text-[10px] text-slate-400">or click to browse (PNG, JPG, SVG)</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Signature Uploader */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Headteacher Signature
                    </label>
                    {signatureUrl && (
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                        <Check size={12} /> Ready
                      </span>
                    )}
                  </div>

                  <input 
                    type="file"
                    ref={sigFileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageFile(e.target.files?.[0], 'signature')}
                  />

                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingSignature(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDraggingSignature(false); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingSignature(false);
                      handleImageFile(e.dataTransfer.files?.[0], 'signature');
                    }}
                    onClick={() => sigFileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-4 text-center transition cursor-pointer flex flex-col items-center justify-center min-h-[150px] ${
                      isDraggingSignature 
                        ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]' 
                        : signatureUrl 
                          ? 'border-emerald-200 bg-emerald-50/20' 
                          : 'border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-slate-100/70'
                    }`}
                  >
                    {signatureUrl ? (
                      <div className="space-y-2">
                        <div className="h-14 w-32 mx-auto rounded-xl bg-white shadow-md p-1.5 border border-slate-200 flex items-center justify-center overflow-hidden">
                          <img src={signatureUrl} alt="Signature Preview" className="h-full w-full object-contain filter contrast-125" />
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); sigFileInputRef.current?.click(); }}
                            className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-50 shadow-xs"
                          >
                            Replace
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSignatureUrl(''); }}
                            className="px-2.5 py-1 bg-rose-50 border border-rose-200 rounded-lg text-[10px] font-bold text-rose-600 hover:bg-rose-100 shadow-xs"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5 py-2">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mx-auto shadow-inner">
                          <FileSignature size={18} />
                        </div>
                        <div className="text-xs font-bold text-slate-800">
                          Drop signature image here
                        </div>
                        <p className="text-[10px] text-slate-400">Embossed on report cards & receipts</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Headteacher Details */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Headteacher Full Name</label>
                  <input
                    type="text"
                    value={headName}
                    onChange={e => setHeadName(e.target.value)}
                    placeholder="e.g. Dr. Abigail Mensah"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Staff / Administrator ID</label>
                  <input
                    type="text"
                    value={staffId}
                    onChange={e => setStaffId(e.target.value)}
                    placeholder="HD-001"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Headteacher Email</label>
                  <input
                    type="email"
                    value={headEmail}
                    onChange={e => setHeadEmail(e.target.value)}
                    placeholder="headmaster@academy.edu.gh"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Direct Phone Number</label>
                  <input
                    type="text"
                    value={headPhone}
                    onChange={e => setHeadPhone(e.target.value)}
                    placeholder="+233 24 000 0000"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                </div>

                {/* Theme Palette */}
                <div className="md:col-span-2 bg-slate-50 rounded-2xl p-3.5 border border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">School Primary Theme Accent</span>
                      <span className="text-[10px] text-slate-500">Applied to report card header ribbons, invoices, and certificates.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        {THEME_PALETTES.map((pal) => (
                          <button
                            type="button"
                            key={pal.hex}
                            onClick={() => setPrimaryColor(pal.hex)}
                            title={pal.name}
                            className={`w-7 h-7 rounded-xl transition cursor-pointer border-2 ${
                              primaryColor.toLowerCase() === pal.hex.toLowerCase()
                                ? 'border-amber-400 scale-110 shadow-sm'
                                : 'border-transparent hover:scale-105'
                            } ${pal.bgClass}`}
                          />
                        ))}
                      </div>
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={e => setPrimaryColor(e.target.value)}
                        className="w-8 h-8 rounded-xl border border-slate-300 cursor-pointer p-0.5 bg-white"
                        title="Pick custom hex color"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 5: Fees, Banking, Mobile Money & Launch */}
          {currentStage === 5 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-xs">5</div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">Tuition Fees, Banking & Parent Mobile Money Collection</h3>
                  <p className="text-xs text-slate-500">Configure institutional fee accounts and direct parent payment options.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Default Term Tuition Fee ({currency})
                  </label>
                  <input
                    type="number"
                    value={defaultTermFee}
                    onChange={e => setDefaultTermFee(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="450.00"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Default fee base assigned upon admission before class-specific bill adjustments.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={e => setBankName(e.target.value)}
                    placeholder="e.g. GCB Bank, Ecobank, Stanbic"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Bank Account Number</label>
                  <input
                    type="text"
                    value={bankAccountNum}
                    onChange={e => setBankAccountNum(e.target.value)}
                    placeholder="e.g. 1011300058921"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Mobile Money (MoMo) Merchant Number</label>
                  <input
                    type="text"
                    value={momoMerchantNumber}
                    onChange={e => setMomoMerchantNumber(e.target.value)}
                    placeholder="e.g. 0244123456 (St. Jude School Fees)"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Printed on student fee bills so parents can send MoMo transfers directly.</p>
                </div>
              </div>

              {/* Online Paystack Collection Toggle */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-600" />
                    <div>
                      <span className="text-xs font-bold text-slate-800">Online Parent Card & MoMo Gateway (Paystack)</span>
                      <span className="text-[10px] text-slate-500 block">Allow parents to pay directly online from their phone or laptop.</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnableOnlineGateway(!enableOnlineGateway)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition cursor-pointer border ${
                      enableOnlineGateway 
                        ? 'bg-emerald-600 text-white border-emerald-600' 
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {enableOnlineGateway ? 'Enabled' : 'Optional (Disabled)'}
                  </button>
                </div>

                {enableOnlineGateway && (
                  <div className="space-y-3 pt-2 border-t border-slate-200/80 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">Environment Mode:</span>
                      <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setPaystackMode('test')}
                          className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                            paystackMode === 'test' ? 'bg-amber-500 text-white' : 'text-slate-600'
                          }`}
                        >
                          Test Mode
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaystackMode('live')}
                          className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                            paystackMode === 'live' ? 'bg-emerald-600 text-white' : 'text-slate-600'
                          }`}
                        >
                          Live Mode
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Paystack Public Key</label>
                        <input
                          type="text"
                          value={paystackPublicKey}
                          onChange={e => setPaystackPublicKey(e.target.value)}
                          placeholder={paystackMode === 'test' ? 'pk_test_...' : 'pk_live_...'}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Paystack Secret Key</label>
                        <div className="relative">
                          <input
                            type={showPaystackSecret ? 'text' : 'password'}
                            value={paystackSecretKey}
                            onChange={e => setPaystackSecretKey(e.target.value)}
                            placeholder={paystackMode === 'test' ? 'sk_test_...' : 'sk_live_...'}
                            className="w-full pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPaystackSecret(!showPaystackSecret)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showPaystackSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Ready Review Overview Card */}
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">School</span>
                  <p className="font-bold text-slate-800 truncate">{schoolName || 'Not Set'}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Session</span>
                  <p className="font-bold text-slate-800 truncate">{academicYear} ({currentTerm})</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Classes</span>
                  <p className="font-bold text-slate-800 truncate">{selectedClasses.length} Streams Active</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Branding</span>
                  <p className="font-bold text-slate-800">
                    {logoUrl ? '✓ Crest' : 'No Logo'} • {signatureUrl ? '✓ Sig' : 'No Sig'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="bg-slate-50 px-5 sm:px-7 py-3.5 border-t border-slate-100 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBackToLogin}
              disabled={isExitingToLogin}
              className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
              title="Return to login state"
            >
              <LogOut size={13} className="shrink-0 text-rose-600" />
              <span>Back to Login</span>
            </button>

            {currentStage > 1 ? (
              <button
                type="button"
                onClick={handlePrev}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-100 transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              >
                <ArrowLeft size={13} />
                <span>Back</span>
              </button>
            ) : (
              <span className="text-xs font-semibold text-slate-500 hidden md:inline ml-1">
                Account: <span className="font-bold text-slate-700">{currentUser.name}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentStage < totalStages ? (
              <button
                type="button"
                disabled={isValidating}
                onClick={handleNext}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {isValidating ? (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>Checking...</span>
                  </>
                ) : (
                  <>
                    <span>Continue</span>
                    <ArrowRight size={13} />
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting || isValidating}
                onClick={executeLaunch}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-60 active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>Synchronizing System...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    <span>Complete Setup & Launch</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
