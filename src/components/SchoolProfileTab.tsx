import React, { useState, useEffect } from 'react';
import { 
  Building2, School, Save, RefreshCw, Upload, Check, Copy, 
  MapPin, Phone, Mail, Globe, Award, Shield, CheckCircle2,
  FileText, Calendar, Hash, UserCheck, AlertCircle, Settings,
  ExternalLink, Printer, Share2, Layers, Stamp
} from 'lucide-react';
import { DbController } from '../db';
import { SchoolInfo } from '../types';
import { triggerToast } from '../utils';
import { PrintPreviewModal } from './PrintPreviewModal';

interface SchoolProfileTabProps {
  themeStyles: {
    primaryBg: string;
    accentText?: string;
    cardBorder?: string;
    btnColors?: string;
  };
  onRefreshSchoolInfo?: () => void;
  onNavigateTab?: (tabId: string) => void;
  onOpenSetupWizard?: () => void;
}

export default function SchoolProfileTab({ 
  themeStyles, 
  onRefreshSchoolInfo,
  onNavigateTab,
  onOpenSetupWizard
}: SchoolProfileTabProps) {
  const [school, setSchool] = useState<SchoolInfo>(() => {
    return DbController.normalizeSchoolAliases(DbController.getSchoolInfo());
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [activeSubSection, setActiveSubSection] = useState<'details' | 'branding' | 'leadership' | 'contacts'>('details');

  const currentUser = DbController.getCurrentUser();
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.email?.toLowerCase().trim() === 'pegyirenyi@gmail.com';
  const isHeadteacher = currentUser?.role === 'Headteacher';
  const canEdit = isAdmin || isHeadteacher;

  // Real statistics
  const totalStudents = DbController.getStudents().length;
  const totalTeachers = DbController.getTeachers().length;

  useEffect(() => {
    const current = DbController.getSchoolInfo();
    setSchool(DbController.normalizeSchoolAliases(current));

    // Hydrate latest data from Cloud Firestore to pick up cloud changes
    DbController.fetchRemoteSchoolInfo().then((remoteSchool) => {
      if (remoteSchool && (remoteSchool.name || remoteSchool.schoolName || remoteSchool.motto || remoteSchool.telephone || remoteSchool.phone || remoteSchool.gpsAddress || remoteSchool.logoUrl || remoteSchool.crestUrl)) {
        setSchool(DbController.normalizeSchoolAliases(remoteSchool));
      }
    }).catch(err => console.warn("Remote school profile load notice:", err));
  }, []);

  const handleFieldChange = (field: keyof SchoolInfo, value: any) => {
    setSchool(prev => {
      const updated = {
        ...prev,
        [field]: value
      };
      // Synchronize bidirectional aliases seamlessly
      if (field === 'name') updated.schoolName = value;
      if (field === 'schoolName') updated.name = value;
      if (field === 'telephone') updated.phone = value;
      if (field === 'phone') updated.telephone = value;
      if (field === 'officialAddress') updated.address = value;
      if (field === 'address') updated.officialAddress = value;
      if (field === 'schoolNumber') updated.gesRegNumber = value;
      if (field === 'gesRegNumber') updated.schoolNumber = value;
      if (field === 'reopeningDate') (updated as any).nextTermStartDate = value;
      if (field === 'crestUrl') updated.logoUrl = value;
      if (field === 'logoUrl') updated.crestUrl = value;
      if (field === 'headteacherSignatureUrl') updated.signatureUrl = value;
      if (field === 'signatureUrl') updated.headteacherSignatureUrl = value;
      return updated;
    });
  };

  const compressImage = (file: File, maxWidth: number, maxHeight: number, quality = 0.85): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          let { width, height } = img;
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>, 
    field: 'logoUrl' | 'crestUrl' | 'watermarkUrl' | 'headteacherSignatureUrl' | 'bursarSignatureUrl' | 'stampUrl'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      triggerToast('Image file size must be less than 8MB', 'error');
      return;
    }

    try {
      const isSignature = field === 'headteacherSignatureUrl' || field === 'bursarSignatureUrl' || field === 'stampUrl';
      const maxDim = isSignature ? 360 : 420;
      const dataUrl = await compressImage(file, maxDim, maxDim, 0.85);

      setSchool(prev => {
        const updated = {
          ...prev,
          [field]: dataUrl,
          // When updating crest or logo, sync both so report headers and dashboards agree
          ...(field === 'crestUrl' || field === 'logoUrl' ? { crestUrl: dataUrl, logoUrl: dataUrl } : {}),
          // When updating headteacher signature, sync both aliases
          ...(field === 'headteacherSignatureUrl' ? { headteacherSignatureUrl: dataUrl, signatureUrl: dataUrl } : {})
        };
        return updated;
      });
      triggerToast(`Optimized ${field.replace('Url', '')} image preview. Remember to save changes!`, 'info');
    } catch (err) {
      console.error("Image optimization error:", err);
      triggerToast('Could not process selected image. Please try another file.', 'error');
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveSchoolProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canEdit) {
      triggerToast('Permission Denied: Only Administrators or Headteachers can modify school profiles.', 'error');
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const resolvedSchoolId = DbController.resolveActiveSchoolId() || school.schoolId || school.id;
      const schoolNameValue = (school.name || school.schoolName || 'Official School Name').trim();
      const phoneValue = (school.telephone || school.phone || '').trim();
      const addressValue = (school.officialAddress || school.address || '').trim();
      const regNumberValue = (school.schoolNumber || school.gesRegNumber || '').trim();
      const crestValue = school.crestUrl || school.logoUrl || '';
      const sigValue = school.headteacherSignatureUrl || school.signatureUrl || '';
      const reopeningValue = (school.reopeningDate || (school as any).nextTermStartDate || '').trim();

      const cleanSchool: SchoolInfo = {
        ...school,
        id: resolvedSchoolId,
        schoolId: resolvedSchoolId,
        schoolCode: school.schoolCode || resolvedSchoolId,
        name: schoolNameValue,
        schoolName: schoolNameValue,
        motto: school.motto?.trim() || '',
        schoolType: school.schoolType || 'Public',
        emisCode: school.emisCode?.trim() || '',
        schoolNumber: regNumberValue,
        gesRegNumber: regNumberValue,
        gpsAddress: school.gpsAddress?.trim() || '',
        region: school.region?.trim() || '',
        district: school.district?.trim() || '',
        circuit: school.circuit?.trim() || '',
        telephone: phoneValue,
        phone: phoneValue,
        email: school.email?.trim() || '',
        whatsappNumber: school.whatsappNumber?.trim() || '',
        officialAddress: addressValue,
        address: addressValue,
        headteacherName: school.headteacherName?.trim() || '',
        headteacherEmail: school.headteacherEmail?.trim() || '',
        headteacherPhone: school.headteacherPhone?.trim() || '',
        bursarName: school.bursarName?.trim() || '',
        qualifications: school.qualifications?.trim() || '',
        highestAcademicQualifications: school.highestAcademicQualifications?.trim() || '',
        professionalCertificate: school.professionalCertificate?.trim() || '',
        reopeningDate: reopeningValue,
        nextTermStartDate: reopeningValue,
        bursarSignatureUrl: school.bursarSignatureUrl || '',
        headteacherSignatureUrl: sigValue,
        signatureUrl: sigValue,
        crestUrl: crestValue,
        logoUrl: crestValue,
        watermarkUrl: school.watermarkUrl || '',
        stampUrl: school.stampUrl || '',
        // Preserve onboarding / institutional settings
        academicYear: school.academicYear?.trim() || '2026/2027',
        currentTerm: school.currentTerm?.trim() || 'Term 1',
        termStartDate: school.termStartDate || '',
        termEndDate: school.termEndDate || '',
        currency: school.currency?.trim() || 'GHS',
        gradingSystem: school.gradingSystem?.trim() || '',
        defaultTermFee: Number(school.defaultTermFee) || 0,
        bankName: school.bankName?.trim() || '',
        bankAccountNum: school.bankAccountNum?.trim() || '',
        momoMerchantNumber: school.momoMerchantNumber?.trim() || '',
        primaryColor: school.primaryColor?.trim() || '#1e3a8a',
        setupWizardCompleted: true
      };

      const checkEmail = (cleanSchool.headteacherEmail || cleanSchool.email)?.toLowerCase().trim();
      if (checkEmail) {
        const teachers = DbController.getTeachers();
        const conflictingTeacher = teachers.find(t => 
          t.email && 
          t.email.toLowerCase().trim() === checkEmail && 
          !t.email.toLowerCase().endsWith('@school.internal') &&
          t.id !== currentUser?.uid &&
          t.email?.toLowerCase().trim() !== currentUser?.email?.toLowerCase().trim() &&
          !(currentUser?.staffId && t.staffId && t.staffId === currentUser.staffId)
        );
        if (conflictingTeacher) {
          triggerToast(`Cannot save: The email '${checkEmail}' is already assigned to active classroom teacher ${conflictingTeacher.firstName} ${conflictingTeacher.lastName}. One email cannot be used as Headteacher and assigned to a classroom teacher.`, 'error');
          setIsSaving(false);
          return;
        }
      }

      await DbController.saveSchoolInfo(cleanSchool);
      setSchool(DbController.normalizeSchoolAliases(cleanSchool));
      setSaveSuccess(true);
      triggerToast('🎉 School Profile successfully saved and synchronized with Cloud Firestore!', 'success');

      if (onRefreshSchoolInfo) {
        onRefreshSchoolInfo();
      }

      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error('Failed to save school profile:', err);
      triggerToast(`Failed to save school profile: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const copySchoolCode = () => {
    const code = school.schoolCode || school.schoolId || school.id;
    if (code) {
      navigator.clipboard.writeText(code);
      setCopiedCode(true);
      triggerToast('School Code copied to clipboard!', 'success');
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const handlePrintCertificate = () => {
    setIsPrintModalOpen(true);
  };

  const schoolProfileSummaryHtml = `
    <div id="school-profile-print-area" class="school-profile-printable" style="max-width: 820px; margin: 0 auto; padding: 24px; font-family: 'Inter', system-ui, sans-serif; color: #0f172a; background: #ffffff;">
      <!-- Institutional Certificate Header Box -->
      <div style="border: 2px solid #0f172a; padding: 20px; border-radius: 14px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 16px; gap: 16px;">
          <div style="width: 85px; height: 85px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            ${school.crestUrl || school.logoUrl 
              ? `<img src="${school.crestUrl || school.logoUrl}" alt="School Crest" style="max-width: 85px; max-height: 85px; object-fit: contain;" />` 
              : '<div style="font-size: 36px; line-height: 1;">🏫</div>'}
          </div>
          <div style="text-align: center; flex: 1;">
            <div style="font-size: 10px; font-weight: 800; letter-spacing: 1.5px; color: #0284c7; text-transform: uppercase; margin-bottom: 3px;">
              GHANA EDUCATION SERVICE &bull; MINISTRY OF EDUCATION
            </div>
            <h1 style="font-size: 22px; font-weight: 900; margin: 0; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px; line-height: 1.2;">
              ${school.name || 'Official School Name'}
            </h1>
            ${school.motto ? `<p style="font-size: 11px; font-style: italic; color: #64748b; margin: 3px 0 0 0;">"${school.motto}"</p>` : ''}
            <div style="display: flex; justify-content: center; gap: 8px; margin-top: 8px; font-size: 9.5px; font-weight: 700;">
              <span style="background: #f0fdf4; color: #166534; padding: 2px 8px; border-radius: 6px; border: 1px solid #bbf7d0;">${school.schoolType || 'Public'} School</span>
              <span style="background: #f8fafc; color: #334155; padding: 2px 8px; border-radius: 6px; border: 1px solid #e2e8f0;">EMIS: ${school.emisCode || 'N/A'}</span>
              <span style="background: #fefce8; color: #854d0e; padding: 2px 8px; border-radius: 6px; border: 1px solid #fef08a;">Code: ${school.schoolCode || school.schoolId || school.id || 'N/A'}</span>
            </div>
          </div>
          <div style="width: 85px; height: 85px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            ${school.stampUrl 
              ? `<img src="${school.stampUrl}" alt="Official Stamp" style="max-width: 85px; max-height: 85px; object-fit: contain;" />` 
              : ''}
          </div>
        </div>

        <div style="text-align: center; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #0f172a; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
          Institutional Profile & Certified Accreditation Record
        </div>

        <!-- Two Column Key Profile Data -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; font-size: 11px; margin-bottom: 18px;">
          <div style="background: #f8fafc; padding: 14px; border-radius: 10px; border: 1px solid #e2e8f0;">
            <div style="font-weight: 800; color: #0f172a; margin-bottom: 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">
              Geographical & Administrative Info
            </div>
            <div style="margin-bottom: 5px;"><strong>Region:</strong> ${school.region || 'N/A'}</div>
            <div style="margin-bottom: 5px;"><strong>District:</strong> ${school.district || 'N/A'}</div>
            <div style="margin-bottom: 5px;"><strong>Circuit:</strong> ${school.circuit || 'N/A'}</div>
            <div style="margin-bottom: 5px;"><strong>GPS Digital Address:</strong> ${school.gpsAddress || 'N/A'}</div>
            <div><strong>Postal Address:</strong> ${school.officialAddress || 'N/A'}</div>
          </div>

          <div style="background: #f8fafc; padding: 14px; border-radius: 10px; border: 1px solid #e2e8f0;">
            <div style="font-weight: 800; color: #0f172a; margin-bottom: 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">
              Contact Channels & Census Statistics
            </div>
            <div style="margin-bottom: 5px;"><strong>Telephone Hotline:</strong> ${school.telephone || 'N/A'}</div>
            <div style="margin-bottom: 5px;"><strong>Official Email:</strong> ${school.email || 'N/A'}</div>
            <div style="margin-bottom: 5px;"><strong>Total Enrolled Students:</strong> ${totalStudents}</div>
            <div style="margin-bottom: 5px;"><strong>Total Assigned Faculty:</strong> ${totalTeachers}</div>
            <div><strong>Reopening Schedule:</strong> ${school.reopeningDate || 'Per Academic Calendar'}</div>
          </div>
        </div>

        <!-- Leadership & Signatories Grid -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 14px; margin-bottom: 16px;">
          <div style="font-weight: 800; color: #0f172a; margin-bottom: 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; text-align: center;">
            Authorized Institutional Signatories & Certifications
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 11px;">
            <!-- Headteacher -->
            <div style="border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; background: #ffffff;">
              <div style="font-size: 10px; font-weight: 800; color: #0284c7; text-transform: uppercase; margin-bottom: 3px;">Headteacher / Principal</div>
              <div style="font-size: 12.5px; font-weight: 800; color: #0f172a;">${school.headteacherName || 'Head of School'}</div>
              ${school.highestAcademicQualifications ? `<div style="font-size: 10px; color: #64748b; margin-top: 2px;">${school.highestAcademicQualifications}</div>` : ''}
              <div style="margin-top: 8px; height: 46px; display: flex; align-items: center; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px;">
                ${school.headteacherSignatureUrl 
                  ? `<img src="${school.headteacherSignatureUrl}" alt="Headteacher Signature" style="max-height: 42px; max-width: 140px; object-fit: contain;" />` 
                  : '<span style="color: #94a3b8; font-style: italic; font-size: 10px;">[Signature Certified on File]</span>'}
              </div>
              <div style="font-size: 9px; color: #64748b; margin-top: 4px; text-transform: uppercase;">Official Headteacher Signature & Date</div>
            </div>

            <!-- Bursar / Account Officer -->
            <div style="border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; background: #ffffff;">
              <div style="font-size: 10px; font-weight: 800; color: #059669; text-transform: uppercase; margin-bottom: 3px;">Account Officer / Bursar</div>
              <div style="font-size: 12.5px; font-weight: 800; color: #0f172a;">${school.bursarName || 'Bursar / Accountant'}</div>
              ${school.qualifications ? `<div style="font-size: 10px; color: #64748b; margin-top: 2px;">${school.qualifications}</div>` : ''}
              <div style="margin-top: 8px; height: 46px; display: flex; align-items: center; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px;">
                ${school.bursarSignatureUrl 
                  ? `<img src="${school.bursarSignatureUrl}" alt="Bursar Signature" style="max-height: 42px; max-width: 140px; object-fit: contain;" />` 
                  : '<span style="color: #94a3b8; font-style: italic; font-size: 10px;">[Signature Certified on File]</span>'}
              </div>
              <div style="font-size: 9px; color: #64748b; margin-top: 4px; text-transform: uppercase;">Official Bursar Signature & Date</div>
            </div>
          </div>
        </div>

        <!-- Official Stamp & Verification Footer -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #cbd5e1; padding-top: 10px; font-size: 9px; color: #64748b;">
          <div>
            <span>Verified by: <strong>GEETECH Multimedia School Management System</strong></span><br />
            <span>Printed on: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
          <div style="text-align: right;">
            <span style="font-family: monospace; font-weight: 700; color: #0f172a;">REF: ${school.schoolCode || school.schoolId || 'CERT-SEC-2026'}</span><br />
            <span style="color: #059669; font-weight: 700;">&bull; Authenticated Institutional Copy</span>
          </div>
        </div>
      </div>
    </div>
  `;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      
      {/* INSTITUTIONAL HERO HEADER CARD */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-slate-800">
        <div className="relative z-10 flex flex-col lg:flex-row items-center lg:items-start justify-between gap-6 text-center lg:text-left">
          
          {/* Crest / Logo & Core Info */}
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="relative group shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white/10 backdrop-blur-md border-2 border-white/20 p-2 flex items-center justify-center overflow-hidden shadow-2xl">
                {school.crestUrl || school.logoUrl ? (
                  <img 
                    src={school.crestUrl || school.logoUrl} 
                    alt="Official School Crest" 
                    className="w-full h-full object-contain drop-shadow"
                  />
                ) : (
                  <Building2 size={48} className="text-amber-400 animate-pulse" />
                )}
              </div>
              {school.watermarkUrl && (
                <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-slate-900/90 border border-white/30 p-1 flex items-center justify-center overflow-hidden shadow">
                  <img src={school.watermarkUrl} alt="Watermark" className="w-full h-full object-contain" />
                </div>
              )}
            </div>

            <div className="space-y-1.5 max-w-2xl">
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 size={11} /> {school.schoolType || 'Public'} School
                </span>
                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-full">
                  EMIS: {school.emisCode || 'UNASSIGNED'}
                </span>
                {school.schoolNumber && (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-full">
                    REG: {school.schoolNumber}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight uppercase text-white leading-tight">
                {school.name || 'Official School Name'}
              </h1>

              {school.motto && (
                <p className="text-xs sm:text-sm text-amber-200/90 italic font-serif">
                  "{school.motto}"
                </p>
              )}

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-4 gap-y-1 text-xs text-slate-300 font-medium pt-1">
                {school.district && (
                  <span className="flex items-center gap-1">
                    <MapPin size={13} className="text-amber-400" />
                    District: <strong className="text-white">{school.district}</strong>
                  </span>
                )}
                {school.circuit && (
                  <span>
                    Circuit: <strong className="text-white">{school.circuit}</strong>
                  </span>
                )}
                {school.region && (
                  <span>
                    Region: <strong className="text-white">{school.region}</strong>
                  </span>
                )}
              </div>

              {/* Official Signatories Status Badges */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 pt-1.5">
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                  school.headteacherSignatureUrl 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                    : 'bg-slate-800/80 text-slate-400 border border-slate-700/60'
                }`}>
                  <CheckCircle2 size={10} className={school.headteacherSignatureUrl ? 'text-emerald-400' : 'text-slate-500'} />
                  Headteacher Signature: {school.headteacherSignatureUrl ? 'Signed' : 'Pending'}
                </span>

                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                  school.bursarSignatureUrl 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                    : 'bg-slate-800/80 text-slate-400 border border-slate-700/60'
                }`}>
                  <CheckCircle2 size={10} className={school.bursarSignatureUrl ? 'text-emerald-400' : 'text-slate-500'} />
                  Bursar Signature: {school.bursarSignatureUrl ? 'Signed' : 'Pending'}
                </span>

                {school.stampUrl && (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <Stamp size={10} /> Official Seal Certified
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Tools & School Code Badge */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-center lg:items-end gap-3 shrink-0">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-3 text-center sm:text-right">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-300 block mb-0.5">
                School Unique ID Code
              </span>
              <div className="flex items-center justify-center lg:justify-end gap-2">
                <span className="font-mono font-black text-sm text-amber-300 select-all">
                  {school.schoolCode || school.schoolId || school.id || 'SMS-DEFAULT'}
                </span>
                <button
                  type="button"
                  onClick={copySchoolCode}
                  className="p-1.5 hover:bg-white/20 text-white rounded-lg transition cursor-pointer"
                  title="Copy School Code"
                >
                  {copiedCode ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrintCertificate}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-white/10 cursor-pointer"
              >
                <Printer size={14} /> Print Summary
              </button>

              {canEdit && onOpenSetupWizard && (
                <button
                  type="button"
                  onClick={onOpenSetupWizard}
                  className="px-3.5 py-2 bg-indigo-600/70 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-indigo-400/30 cursor-pointer shadow-sm"
                  title="Launch initial onboarding setup wizard"
                >
                  <Settings size={14} className="text-amber-300" /> Setup Wizard
                </button>
              )}

              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleSaveSchoolProfile()}
                  disabled={isSaving}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg cursor-pointer ${
                    saveSuccess 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95'
                  }`}
                >
                  {isSaving ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Saving to Cloud...
                    </>
                  ) : saveSuccess ? (
                    <>
                      <Check size={14} />
                      Saved & Synced!
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      Save Cloud Changes
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Decorative backdrop elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />
      </div>

      {/* QUICK STATS SNAPSHOT CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <School size={20} />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block tracking-wider">
                Enrolled Students
              </span>
              <span className="text-xl font-black text-slate-800">
                {totalStudents}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <UserCheck size={20} />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block tracking-wider">
                Assigned Teachers
              </span>
              <span className="text-xl font-black text-slate-800">
                {totalTeachers}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <Calendar size={20} />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block tracking-wider">
                Next Term Reopening
              </span>
              <span className="text-xs font-bold text-slate-800 truncate block max-w-[120px]">
                {school.reopeningDate || 'Not Configured'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block tracking-wider">
                Database Status
              </span>
              <span className="text-xs font-black text-emerald-700 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Cloud Firestore Live
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION TABS NAVIGATION */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 no-print">
        <button
          type="button"
          onClick={() => setActiveSubSection('details')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSubSection === 'details'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <Building2 size={15} /> Institutional Identification & Governance
        </button>

        <button
          type="button"
          onClick={() => setActiveSubSection('branding')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSubSection === 'branding'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <Award size={15} /> Crest, Emblems & Official Watermarks
        </button>

        <button
          type="button"
          onClick={() => setActiveSubSection('leadership')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSubSection === 'leadership'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <UserCheck size={15} /> Headteacher, Bursar & Signatories
        </button>

        <button
          type="button"
          onClick={() => setActiveSubSection('contacts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSubSection === 'contacts'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <Phone size={15} /> Contact Channels & Digital Hotlines
        </button>
      </div>

      {/* FORM SECTIONS */}
      <form onSubmit={handleSaveSchoolProfile} className="space-y-6">
        
        {/* SUBSECTION 1: INSTITUTIONAL IDENTIFICATION & GOVERNANCE */}
        {activeSubSection === 'details' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Building2 size={18} className="text-indigo-600" />
                  Institutional Details & Educational Governance
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Official school records, Ghana Education Service accreditation codes, and regional administration.
                </p>
              </div>
              {!canEdit && (
                <span className="text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1 rounded-lg">
                  Read Only (Staff Mode)
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Official School Name *
                </label>
                <input
                  type="text"
                  required
                  disabled={!canEdit}
                  value={school.name || ''}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  placeholder="e.g. ST. AUGUSTINE BASIC SCHOOL"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 uppercase disabled:bg-slate-50 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Institution Type *
                </label>
                <select
                  disabled={!canEdit}
                  value={school.schoolType || 'Public'}
                  onChange={(e) => handleFieldChange('schoolType', e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50"
                >
                  <option value="Public">Public Institution (Government)</option>
                  <option value="Private">Private Institution (Independent)</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  School Motto
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={school.motto || ''}
                  onChange={(e) => handleFieldChange('motto', e.target.value)}
                  placeholder="e.g. Knowledge, Integrity and Excellence"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 italic focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  GES EMIS Code
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={school.emisCode || ''}
                  onChange={(e) => handleFieldChange('emisCode', e.target.value)}
                  placeholder="e.g. 201040059"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  School Registration Number
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={school.schoolNumber || ''}
                  onChange={(e) => handleFieldChange('schoolNumber', e.target.value)}
                  placeholder="e.g. GES/REG/2026/049"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Administrative Region
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={school.region || ''}
                  onChange={(e) => handleFieldChange('region', e.target.value)}
                  placeholder="e.g. Greater Accra Region"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  GES Education District
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={school.district || ''}
                  onChange={(e) => handleFieldChange('district', e.target.value)}
                  placeholder="e.g. Ga Central District"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  GES Educational Circuit
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={school.circuit || ''}
                  onChange={(e) => handleFieldChange('circuit', e.target.value)}
                  placeholder="e.g. Anyaa Circuit"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  GhanaPost GPS Digital Address
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={school.gpsAddress || ''}
                  onChange={(e) => handleFieldChange('gpsAddress', e.target.value)}
                  placeholder="e.g. GS-0182-4910"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 uppercase disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Next Term Reopening Date
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={school.reopeningDate || ''}
                  onChange={(e) => handleFieldChange('reopeningDate', e.target.value)}
                  placeholder="e.g. 12th January, 2027"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Physical / Postal Address
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={school.officialAddress || ''}
                  onChange={(e) => handleFieldChange('officialAddress', e.target.value)}
                  placeholder="e.g. P.O. Box 249, Accra - Ghana"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50"
                />
              </div>

              {/* Academic Calendar Cycle & Term Fees Configuration */}
              <div className="md:col-span-3 border-t border-slate-100 pt-5 mt-2">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar size={16} className="text-indigo-600" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Academic Calendar, Term Cycle & Base Fees
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Active Academic Year
                    </label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={school.academicYear || '2026/2027'}
                      onChange={(e) => handleFieldChange('academicYear', e.target.value)}
                      placeholder="e.g. 2026/2027"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Current Term
                    </label>
                    <select
                      disabled={!canEdit}
                      value={school.currentTerm || 'Term 1'}
                      onChange={(e) => handleFieldChange('currentTerm', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                    >
                      <option value="Term 1">Term 1</option>
                      <option value="Term 2">Term 2</option>
                      <option value="Term 3">Term 3</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Term Start Date
                    </label>
                    <input
                      type="date"
                      disabled={!canEdit}
                      value={school.termStartDate || ''}
                      onChange={(e) => handleFieldChange('termStartDate', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Term End Date
                    </label>
                    <input
                      type="date"
                      disabled={!canEdit}
                      value={school.termEndDate || ''}
                      onChange={(e) => handleFieldChange('termEndDate', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Currency Symbol
                    </label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={school.currency || 'GHS'}
                      onChange={(e) => handleFieldChange('currency', e.target.value)}
                      placeholder="e.g. GHS"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 uppercase disabled:bg-slate-50"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Default Term Tuition Fee
                    </label>
                    <input
                      type="number"
                      disabled={!canEdit}
                      value={school.defaultTermFee ?? 450}
                      onChange={(e) => handleFieldChange('defaultTermFee', e.target.value)}
                      placeholder="450"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={school.bankName || ''}
                      onChange={(e) => handleFieldChange('bankName', e.target.value)}
                      placeholder="e.g. GCB Bank Ltd"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      MoMo Merchant / Number
                    </label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={school.momoMerchantNumber || ''}
                      onChange={(e) => handleFieldChange('momoMerchantNumber', e.target.value)}
                      placeholder="e.g. 0544052717"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBSECTION 2: BRANDING, CRESTS & WATERMARKS */}
        {activeSubSection === 'branding' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Award size={18} className="text-amber-500" />
                School Emblems, Official Crest & Watermarks
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                These graphical assets appear automatically on Terminal Report Cards, Invoices, Receipts, and Staff Identity Badges.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              
              {/* Primary Crest & Emblem */}
              <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-xs text-slate-800">Primary Official Crest</span>
                    <span className="text-[10px] text-slate-400 font-mono">Report Header</span>
                  </div>
                  <div className="w-full h-32 bg-white rounded-xl border border-dashed border-slate-300 flex items-center justify-center p-3 mb-3 overflow-hidden shadow-2xs">
                    {school.crestUrl || school.logoUrl ? (
                      <img 
                        src={school.crestUrl || school.logoUrl} 
                        alt="Crest Preview" 
                        className="max-h-full max-w-full object-contain" 
                      />
                    ) : (
                      <div className="text-center text-slate-400">
                        <Award size={32} className="mx-auto mb-1 opacity-40" />
                        <span className="text-[10px] font-semibold">No Crest Uploaded</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Square or circular emblem supporting PNG, JPG, WEBP, or SVG formats with transparent background.
                  </p>
                </div>

                {canEdit && (
                  <div>
                    <label className="block text-[11px] font-bold text-indigo-600 mb-1">
                      Upload New Emblem
                    </label>
                    <input
                      type="file"
                      accept="image/*,.png,.jpg,.jpeg,.svg,.webp"
                      onChange={(e) => handleImageUpload(e, 'crestUrl')}
                      className="w-full text-[10px] text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {/* Watermark Crest */}
              <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-xs text-slate-800">Official Watermark</span>
                    <span className="text-[10px] text-slate-400 font-mono">Print Background</span>
                  </div>
                  <div className="w-full h-32 bg-white rounded-xl border border-dashed border-slate-300 flex items-center justify-center p-3 mb-3 overflow-hidden shadow-2xs">
                    {school.watermarkUrl ? (
                      <img 
                        src={school.watermarkUrl} 
                        alt="Watermark Preview" 
                        className="max-h-full max-w-full object-contain opacity-60" 
                      />
                    ) : (
                      <div className="text-center text-slate-400">
                        <Layers size={32} className="mx-auto mb-1 opacity-40" />
                        <span className="text-[10px] font-semibold">No Watermark Uploaded</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Faint watermark emblem rendered on background of printed exam transcripts and student reports.
                  </p>
                </div>

                {canEdit && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Upload Watermark File
                    </label>
                    <input
                      type="file"
                      accept="image/*,.png,.jpg,.jpeg,.svg,.webp"
                      onChange={(e) => handleImageUpload(e, 'watermarkUrl')}
                      className="w-full text-[10px] text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-bold file:bg-slate-200 file:text-slate-800 hover:file:bg-slate-300 cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {/* Official Seal / Rubber Stamp */}
              <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-xs text-slate-800">School Rubber Stamp / Seal</span>
                    <span className="text-[10px] text-slate-400 font-mono">Certification</span>
                  </div>
                  <div className="w-full h-32 bg-white rounded-xl border border-dashed border-slate-300 flex items-center justify-center p-3 mb-3 overflow-hidden shadow-2xs">
                    {school.stampUrl ? (
                      <img 
                        src={school.stampUrl} 
                        alt="Official Seal Preview" 
                        className="max-h-full max-w-full object-contain" 
                      />
                    ) : (
                      <div className="text-center text-slate-400">
                        <Stamp size={32} className="mx-auto mb-1 opacity-40" />
                        <span className="text-[10px] font-semibold">No Official Stamp</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Official rubber stamp imprint applied to authenticated academic certificates and receipts.
                  </p>
                </div>

                {canEdit && (
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-600 mb-1">
                      Upload Stamp / Seal
                    </label>
                    <input
                      type="file"
                      accept="image/*,.png,.jpg,.jpeg,.svg,.webp"
                      onChange={(e) => handleImageUpload(e, 'stampUrl')}
                      className="w-full text-[10px] text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {/* Account Officer / Bursar Signature */}
              <div className="border border-emerald-200 rounded-2xl p-5 bg-emerald-50/30 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-xs text-slate-900">Account Officer / Bursar Signature</span>
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">Financial Seal</span>
                  </div>
                  <div className="w-full h-32 bg-white rounded-xl border border-dashed border-emerald-300 flex items-center justify-center p-3 mb-3 overflow-hidden shadow-2xs">
                    {school.bursarSignatureUrl ? (
                      <img 
                        src={school.bursarSignatureUrl} 
                        alt="Bursar Signature Preview" 
                        className="max-h-full max-w-full object-contain" 
                      />
                    ) : (
                      <div className="text-center text-slate-400">
                        <FileText size={32} className="mx-auto mb-1 opacity-40" />
                        <span className="text-[10px] font-semibold">No Bursar Signature Uploaded</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Authorized signature automatically affixed to student fee receipts, payment invoices, and bursar ledger statements.
                  </p>
                </div>

                {canEdit && (
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-700 mb-1">
                      Upload Bursar Signature
                    </label>
                    <input
                      type="file"
                      accept="image/*,.png,.jpg,.jpeg,.svg,.webp"
                      onChange={(e) => handleImageUpload(e, 'bursarSignatureUrl')}
                      className="w-full text-[10px] text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-bold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200 cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SUBSECTION 3: HEADTEACHER, BURSAR & SIGNATORIES */}
        {activeSubSection === 'leadership' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <UserCheck size={18} className="text-indigo-600" />
                Institutional Leadership & Authorized Signatories
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Headteacher accreditations, bursar endorsements, and cryptographic signatures for document approvals.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Headteacher Profile & Signature */}
              <div className="border border-slate-200/80 rounded-2xl p-5 bg-slate-50/40 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <span className="font-black text-xs text-slate-900">Headteacher / Principal Credentials</span>
                  <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">Chief Signatory</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Headteacher Full Name
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={school.headteacherName || ''}
                    onChange={(e) => handleFieldChange('headteacherName', e.target.value)}
                    placeholder="e.g. Mr. Emmanuel K. Ofori"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <Mail size={12} className="text-indigo-600" /> Headteacher Email
                    </label>
                    <input
                      type="email"
                      disabled={!canEdit}
                      value={school.headteacherEmail || ''}
                      onChange={(e) => handleFieldChange('headteacherEmail', e.target.value)}
                      placeholder="e.g. head@school.edu.gh"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <Phone size={12} className="text-emerald-600" /> Headteacher Phone
                    </label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={school.headteacherPhone || ''}
                      onChange={(e) => handleFieldChange('headteacherPhone', e.target.value)}
                      placeholder="e.g. +233 24 123 4567"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Highest Academic Qualifications
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={school.highestAcademicQualifications || ''}
                    onChange={(e) => handleFieldChange('highestAcademicQualifications', e.target.value)}
                    placeholder="e.g. M.Ed Educational Administration, B.Ed Psychology"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Professional Teaching Certificate / License Number
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={school.professionalCertificate || ''}
                    onChange={(e) => handleFieldChange('professionalCertificate', e.target.value)}
                    placeholder="e.g. NTC/PR/2019/004812"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                  />
                </div>

                <div className="pt-2">
                  <span className="block text-xs font-bold text-slate-700 mb-1">
                    Headteacher Official Signature
                  </span>
                  <div className="w-full h-24 bg-white rounded-xl border border-dashed border-slate-300 flex items-center justify-center p-2 mb-2 overflow-hidden shadow-2xs">
                    {school.headteacherSignatureUrl ? (
                      <img 
                        src={school.headteacherSignatureUrl} 
                        alt="Headteacher Signature" 
                        className="max-h-full max-w-full object-contain" 
                      />
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">No Headteacher Signature Uploaded</span>
                    )}
                  </div>
                  {canEdit && (
                    <input
                      type="file"
                      accept="image/*,.png,.jpg,.jpeg,.svg,.webp"
                      onChange={(e) => handleImageUpload(e, 'headteacherSignatureUrl')}
                      className="w-full text-[10px] text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                    />
                  )}
                </div>
              </div>

              {/* Bursar / Accounts Signatory */}
              <div className="border border-slate-200/80 rounded-2xl p-5 bg-slate-50/40 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <span className="font-black text-xs text-slate-900">Bursar / Accounts Officer Credentials</span>
                  <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">Financial Signatory</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Account Officer / Bursar Full Name
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={school.bursarName || ''}
                    onChange={(e) => handleFieldChange('bursarName', e.target.value)}
                    placeholder="e.g. Mrs. Grace Mensah (Senior Bursar)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Financial Qualifications / Professional Title
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={school.qualifications || ''}
                    onChange={(e) => handleFieldChange('qualifications', e.target.value)}
                    placeholder="e.g. Certified Accountant (ICA-Gh / HND Accounting)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                  />
                </div>

                <div className="pt-2">
                  <span className="block text-xs font-bold text-slate-700 mb-1">
                    Bursar / Accounts Officer Signature
                  </span>
                  <div className="w-full h-24 bg-white rounded-xl border border-dashed border-slate-300 flex items-center justify-center p-2 mb-2 overflow-hidden shadow-2xs">
                    {school.bursarSignatureUrl ? (
                      <img 
                        src={school.bursarSignatureUrl} 
                        alt="Bursar Signature" 
                        className="max-h-full max-w-full object-contain" 
                      />
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">No Bursar Signature Uploaded</span>
                    )}
                  </div>
                  {canEdit && (
                    <input
                      type="file"
                      accept="image/*,.png,.jpg,.jpeg,.svg,.webp"
                      onChange={(e) => handleImageUpload(e, 'bursarSignatureUrl')}
                      className="w-full text-[10px] text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBSECTION 4: CONTACT CHANNELS & DIGITAL HOTLINES */}
        {activeSubSection === 'contacts' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Phone size={18} className="text-teal-600" />
                Official Communications, Enquiries & Digital Media
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Official phone numbers, email addresses, and social handles printed on school documents for parent enquiries.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Phone size={13} className="text-indigo-600" /> Official Telephone Hotline
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={school.telephone || ''}
                  onChange={(e) => handleFieldChange('telephone', e.target.value)}
                  placeholder="e.g. +233 24 123 4567"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Phone size={13} className="text-emerald-600" /> WhatsApp Hotline Number
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={school.whatsappNumber || ''}
                  onChange={(e) => handleFieldChange('whatsappNumber', e.target.value)}
                  placeholder="e.g. +233 54 405 2717"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Mail size={13} className="text-rose-600" /> Official School Email Address
                </label>
                <input
                  type="email"
                  disabled={!canEdit}
                  value={school.email || ''}
                  onChange={(e) => handleFieldChange('email', e.target.value)}
                  placeholder="e.g. info@staugustine.edu.gh"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Globe size={13} className="text-blue-600" /> Facebook Page URL
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={school.facebookUrl || ''}
                  onChange={(e) => handleFieldChange('facebookUrl', e.target.value)}
                  placeholder="e.g. https://facebook.com/schoolpage"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Globe size={13} className="text-sky-500" /> Twitter / X Profile URL
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={school.twitterUrl || ''}
                  onChange={(e) => handleFieldChange('twitterUrl', e.target.value)}
                  placeholder="e.g. https://x.com/schoolpage"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Globe size={13} className="text-pink-600" /> Instagram Handle / URL
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={school.instagramUrl || ''}
                  onChange={(e) => handleFieldChange('instagramUrl', e.target.value)}
                  placeholder="e.g. https://instagram.com/schoolpage"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                />
              </div>
            </div>
          </div>
        )}

        {/* BOTTOM SAVE CONTROLS BAR */}
        {canEdit && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-700">
                Direct Cloud Firestore Pipeline Active
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSchool(DbController.getSchoolInfo())}
                className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Reset Unsaved Edits
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className={`px-6 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md cursor-pointer ${
                  saveSuccess 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95'
                }`}
              >
                {isSaving ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Saving Changes to Firestore...
                  </>
                ) : saveSuccess ? (
                  <>
                    <Check size={14} />
                    Profile Updated & Saved!
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    Save School Profile
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </form>

      {/* INSTITUTIONAL PROFILE PRINT PREVIEW MODAL */}
      {isPrintModalOpen && (
        <PrintPreviewModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          customHtml={schoolProfileSummaryHtml}
          documentTitle={`${school.name || 'School'}_Official_Profile_Summary`}
          isLandscapeDefault={false}
        />
      )}
    </div>
  );
}
