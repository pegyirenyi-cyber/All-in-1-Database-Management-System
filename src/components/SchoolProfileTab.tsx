import { useState, ChangeEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SchoolInfo, Teacher } from '../types';
import { DbController } from '../db';
import { compressImage, getWatermarkHtml } from '../utils';
import { ThemeStyles } from './ThemeWrapper';
import { Printer, Save, CheckCircle, Info, Landmark, ShieldCheck, FileDown, Trash2, RotateCcw, Eraser, Eye, User, Link } from 'lucide-react';
import GoogleDriveExportControl from './GoogleDriveExportControl';

export function DefaultCrest({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M32 4L8 14V34C8 46.8 18.2 56.4 32 60C45.8 56.4 56 46.8 56 34V14L32 4Z" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M32 18V42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M22 26C22 26 26 23 32 23C38 23 42 26 42 26" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M22 34C22 34 26 31 32 31C38 31 42 34 42 34" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M32 12C32 12 30 15 32 17C34 19 32 21 32 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

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
  schoolInfo: SchoolInfo;
  onUpdate: (info: SchoolInfo) => void;
  isAutoSave: boolean;
  onManualSave: () => void;
  teachers?: Teacher[];
}

export default function SchoolProfileTab({ theme, schoolInfo, onUpdate, isAutoSave, onManualSave, teachers = [] }: Props) {
  const [formData, setFormData] = useState<SchoolInfo>({ ...schoolInfo });
  const [savedMessage, setSavedMessage] = useState(false);

  useEffect(() => {
    if (formData.assignedTeacherId) {
      const selectedTeacher = teachers.find(t => t.id === formData.assignedTeacherId);
      if (selectedTeacher) {
        const fullName = `${selectedTeacher.firstName} ${selectedTeacher.middleName ? selectedTeacher.middleName + ' ' : ''}${selectedTeacher.lastName}`.trim();
        const teacherPhone = selectedTeacher.phone || '';
        const teacherEmail = selectedTeacher.email || '';
        const teacherQual = selectedTeacher.professionalQualifications || '';
        const teacherHighestQual = selectedTeacher.highestAcademicQualifications || '';
        const teacherDistrict = selectedTeacher.district || '';
        const teacherCircuit = selectedTeacher.circuit || '';

        const needsSync = 
          formData.headteacherName !== fullName ||
          (teacherPhone && formData.telephone !== teacherPhone) ||
          (teacherEmail && formData.email !== teacherEmail) ||
          (teacherQual && formData.qualifications !== teacherQual) ||
          (teacherHighestQual && formData.highestAcademicQualifications !== teacherHighestQual) ||
          (teacherDistrict && formData.district !== teacherDistrict) ||
          (teacherCircuit && formData.circuit !== teacherCircuit);

        if (needsSync) {
          const updated = {
            ...formData,
            headteacherName: fullName,
            telephone: teacherPhone || formData.telephone,
            email: teacherEmail || formData.email,
            qualifications: teacherQual || formData.qualifications,
            highestAcademicQualifications: teacherHighestQual || formData.highestAcademicQualifications,
            district: teacherDistrict || formData.district,
            circuit: teacherCircuit || formData.circuit,
          };
          setFormData(updated);
          onUpdate(updated);
          if (isAutoSave) {
            DbController.saveSchoolInfo(updated);
          }
        }
      }
    }
  }, [teachers, formData.assignedTeacherId]);

  const handleSelectTeacher = (teacherId: string) => {
    if (!teacherId) {
      const updated = {
        ...formData,
        assignedTeacherId: '',
      };
      setFormData(updated);
      onUpdate(updated);
      if (isAutoSave) {
        DbController.saveSchoolInfo(updated);
      }
      return;
    }

    const selectedTeacher = teachers.find(t => t.id === teacherId);
    if (selectedTeacher) {
      const fullName = `${selectedTeacher.firstName} ${selectedTeacher.middleName ? selectedTeacher.middleName + ' ' : ''}${selectedTeacher.lastName}`.trim();
      
      const updated = {
        ...formData,
        assignedTeacherId: teacherId,
        headteacherName: fullName,
        telephone: selectedTeacher.phone || formData.telephone || '',
        email: selectedTeacher.email || formData.email || '',
        highestAcademicQualifications: selectedTeacher.highestAcademicQualifications || formData.highestAcademicQualifications || '',
        qualifications: selectedTeacher.professionalQualifications || formData.qualifications || '',
        district: selectedTeacher.district || formData.district || '',
        circuit: selectedTeacher.circuit || formData.circuit || '',
      };

      setFormData(updated);
      onUpdate(updated);
      if (isAutoSave) {
        DbController.saveSchoolInfo(updated);
      }
    }
  };

  const handleInputChange = (key: keyof SchoolInfo, val: string) => {
    const updated = { ...formData, [key]: val };
    setFormData(updated);
    onUpdate(updated);

    if (isAutoSave) {
      DbController.saveSchoolInfo(updated);
    }
  };

  const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        if (typeof reader.result === 'string') {
          const base64 = reader.result;
          try {
            const compressed = await compressImage(base64);
            handleInputChange('logoUrl', compressed);
          } catch (err) {
            console.error("Logo compression error:", err);
            handleInputChange('logoUrl', base64);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSignatureUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        if (typeof reader.result === 'string') {
          const base64 = reader.result;
          try {
            const compressed = await compressImage(base64);
            handleInputChange('signatureUrl', compressed);
          } catch (err) {
            console.error("Signature compression error:", err);
            handleInputChange('signatureUrl', base64);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStampUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        if (typeof reader.result === 'string') {
          const base64 = reader.result;
          try {
            const compressed = await compressImage(base64);
            handleInputChange('stampUrl', compressed);
          } catch (err) {
            console.error("Stamp compression error:", err);
            handleInputChange('stampUrl', base64);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCrestUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        if (typeof reader.result === 'string') {
          const base64 = reader.result;
          try {
            const compressed = await compressImage(base64);
            handleInputChange('crestUrl', compressed);
          } catch (err) {
            console.error("Crest compression error:", err);
            handleInputChange('crestUrl', base64);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    DbController.saveSchoolInfo(formData);
    onManualSave();
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 3000);
  };

  const [printBlocked, setPrintBlocked] = useState(false);
  const [showPdfGuide, setShowPdfGuide] = useState(false);

  const handlePrint = () => {
    try {
      window.print();
    } catch (e) {
      console.warn("Direct printing restricted inside sandbox iframe:", e);
      setPrintBlocked(true);
    }
  };

  const handleClearForm = () => {
    const cleared: SchoolInfo = {
      id: formData.id || 'school_default',
      name: '',
      motto: '',
      logoUrl: '',
      schoolNumber: '',
      emisCode: '',
      gpsAddress: '',
      schoolType: 'Public',
      headteacherName: '',
      telephone: '',
      email: '',
      qualifications: '',
      highestAcademicQualifications: '',
      district: '',
      circuit: '',
      reopeningDate: '',
      crestUrl: ''
    };
    setFormData(cleared);
    onUpdate(cleared);
    if (isAutoSave) {
      DbController.saveSchoolInfo(cleared);
    }
  };

  const handleDeleteActive = () => {
    // Reset/delete the active selection (here we clear the active uploaded logo, crest, and motto inputs)
    const activeDeleted = { ...formData, logoUrl: '', motto: '', crestUrl: '' };
    setFormData(activeDeleted);
    onUpdate(activeDeleted);
    if (isAutoSave) {
      DbController.saveSchoolInfo(activeDeleted);
    }
  };

  const handleDeleteAll = () => {
    if (window.confirm("Are you sure you want to completely erase and delete all School Profile data? This action cannot be undone.")) {
      const blank: SchoolInfo = {
        id: 'school_default',
        name: '',
        motto: '',
        logoUrl: '',
        schoolNumber: '',
        emisCode: '',
        gpsAddress: '',
        schoolType: 'Public',
        headteacherName: '',
        telephone: '',
        email: '',
        qualifications: '',
        highestAcademicQualifications: '',
        district: '',
        circuit: '',
        reopeningDate: '',
        crestUrl: ''
      };
      setFormData(blank);
      onUpdate(blank);
      DbController.saveSchoolInfo(blank);
      onManualSave();
    }
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Top Banner Control Ribbon */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm no-print">
        <div>
          <h2 className="text-xl font-display font-bold text-slate-800 flex items-center gap-2">
            <Landmark className={theme.accentText} size={22} />
            School Institutional Profile
          </h2>
          <p className="text-xs text-slate-500">Configure central school directory parameters and details</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPdfGuide(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 border border-slate-900 text-white hover:bg-slate-850 active:translate-y-0.5 transition text-xs font-semibold rounded-lg cursor-pointer shadow-sm"
          >
            <Printer size={15} /> Print Profile
          </button>

          {!isAutoSave && (
            <button
               onClick={handleSave}
               className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer active:translate-y-0.5 transition ${theme.btnColors}`}
            >
              <Save size={15} /> Save Settings
            </button>
          )}
        </div>
      </div>

      {savedMessage && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs py-2.5 px-4 rounded-lg animate-fade-in no-print">
          <CheckCircle size={15} className="text-emerald-600" />
          <span>School Setup successfully updated and synced with storage!</span>
        </div>
      )}

      {/* Main Grid: Form Left, Institutional Card Preview Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* EDITING FORM */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6 no-print">
          
          {/* Group 1: General Info */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 pb-2 border-b border-slate-100 flex items-center gap-1.5 mb-4">
              <ShieldCheck size={16} className="text-slate-400" /> Administrative Identity
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">School Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
                  placeholder="e.g. Greenwood Academy"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">School Motto</label>
                <input
                  type="text"
                  value={formData.motto}
                  onChange={(e) => handleInputChange('motto', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
                  placeholder="e.g. Discipline and Integrity"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">School Registration ID</label>
                <input
                  type="text"
                  value={formData.schoolNumber}
                  onChange={(e) => handleInputChange('schoolNumber', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
                  placeholder="e.g. GTIMS-2026"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">EMIS Code</label>
                <input
                  type="text"
                  value={formData.emisCode}
                  onChange={(e) => handleInputChange('emisCode', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
                  placeholder="e.g. EMIS-3210459"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">GPS Digital Address</label>
                <input
                  type="text"
                  value={formData.gpsAddress}
                  onChange={(e) => handleInputChange('gpsAddress', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
                  placeholder="e.g. AK-045-2317"
                />
              </div>



              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">School Type</label>
                <select
                  value={formData.schoolType}
                  onChange={(e) => handleInputChange('schoolType', e.target.value as 'Private' | 'Public')}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
                >
                  <option value="Private">Private Institution</option>
                  <option value="Public">Public / Government Maintained</option>
                </select>
              </div>

              <div className="md:col-span-2 border-t border-slate-100/50 pt-3 mt-2">
                <label className="block text-xs font-semibold text-slate-700 mb-2">School Official Logo / Emblem</label>
                <div className="flex flex-col sm:flex-row items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="w-16 h-16 rounded-lg bg-white border border-slate-300 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-2xs">
                    {formData.logoUrl ? (
                      <img src={formData.logoUrl} className="w-full h-full object-contain" alt="Preview Logo" referrerPolicy="no-referrer" />
                    ) : (
                      <DefaultCrest className="h-10 w-10 text-indigo-500" />
                    )}
                  </div>
                  <div className="flex-grow space-y-1 w-full text-center sm:text-left">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <label className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px] font-bold rounded-lg shadow-2xs pointer-events-auto cursor-pointer select-none transition">
                        Choose Image File
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleLogoUpload}
                        />
                      </label>
                      {formData.logoUrl && (
                        <button
                          type="button"
                          onClick={() => handleInputChange('logoUrl', '')}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[11px] font-bold rounded-lg transition"
                        >
                          Remove custom logo
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400">Supported: PNG, JPG, GIF (Max 1MB). Saved in real-time to persistent database.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Group 2: Headteacher Directory */}
          <div className="pt-2">
            <h3 className="text-sm font-semibold text-slate-700 pb-2 border-b border-slate-100 flex items-center gap-1.5 mb-4">
              <Info size={16} className="text-slate-400" /> Headship & Leadership Desk
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 mb-2">
                <label className="block text-xs font-bold text-indigo-900 mb-1 flex items-center gap-1.5">
                  <Link size={14} className="text-indigo-600" />
                  Link Headteacher to Registered Faculty Member
                </label>
                <p className="text-[11px] text-indigo-700/80 mb-3 font-sans">
                  Select a teacher from your school roster to automatically fill and dynamically synchronize their credentials, qualifications, contact lines, and administrative jurisdiction boundaries in real-time.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <select
                    value={formData.assignedTeacherId || ''}
                    onChange={(e) => handleSelectTeacher(e.target.value)}
                    className="w-full sm:w-auto flex-grow text-xs px-3 py-2 border border-slate-250 bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-slate-800"
                  >
                    <option value="">-- Manual Mode (No registered Teacher assigned) --</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.firstName} {teacher.middleName ? teacher.middleName + ' ' : ''}{teacher.lastName} ({teacher.staffId || 'No ID'})
                      </option>
                    ))}
                  </select>
                  
                  {formData.assignedTeacherId && (
                    <div className="flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-emerald-200 uppercase tracking-wide">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live Sync Active
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Headteacher Name *</label>
                <input
                  type="text"
                  value={formData.headteacherName}
                  onChange={(e) => handleInputChange('headteacherName', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
                  placeholder="Name of Headteacher"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Telephone Contact *</label>
                <input
                  type="text"
                  value={formData.telephone}
                  onChange={(e) => handleInputChange('telephone', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
                  placeholder="e.g. 0544052717"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Mailing Address</label>
                <input
                  type="text"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
                  placeholder="School official email"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Highest Academic Qualifications</label>
                <select
                  value={formData.highestAcademicQualifications || ''}
                  onChange={(e) => handleInputChange('highestAcademicQualifications', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none bg-white text-slate-800"
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

              <div className="md:col-span-2 space-y-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Professional / Academic Certifications</label>
                <select
                  value={
                    formData.qualifications === '' 
                      ? '' 
                      : (["NTC Professional Teacher License", "Certificate in School Leadership and Management (CSLM)", "Post Graduate Diploma in Education (PGDE)", "Diploma in Basic Education (DBE)", "Teacher Certificate 'A'", "Professional Certificate in Educational Administration", "Early Childhood Care and Development Certification", "Executive Certificate in Educational Leadership", "Certificate in Guidance and Counseling", "Special Education (SPED) Certificate", "None"].includes(formData.qualifications) 
                        ? formData.qualifications 
                        : 'Other')
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'Other') {
                      handleInputChange('qualifications', 'Custom Certification');
                    } else {
                      handleInputChange('qualifications', val);
                    }
                  }}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none bg-white text-slate-800"
                >
                  <option value="">-- Select Professional/Academic Certification --</option>
                  <option value="None">None / Not certified</option>
                  <option value="NTC Professional Teacher License">NTC Professional Teacher License (National Teaching Council)</option>
                  <option value="Certificate in School Leadership and Management (CSLM)">Certificate in School Leadership and Management (CSLM)</option>
                  <option value="Post Graduate Diploma in Education (PGDE)">Post Graduate Diploma in Education (PGDE)</option>
                  <option value="Diploma in Basic Education (DBE)">Diploma in Basic Education (DBE)</option>
                  <option value="Teacher Certificate 'A'">Teacher Certificate 'A'</option>
                  <option value="Professional Certificate in Educational Administration">Professional Certificate in Educational Administration</option>
                  <option value="Early Childhood Care and Development Certification">Early Childhood Care and Development Certification</option>
                  <option value="Executive Certificate in Educational Leadership">Executive Certificate in Educational Leadership</option>
                  <option value="Certificate in Guidance and Counseling">Certificate in Guidance and Counseling</option>
                  <option value="Special Education (SPED) Certificate">Special Education (SPED) Certificate</option>
                  <option value="Other">Other (Specify details below)</option>
                </select>

                {(formData.qualifications !== '' && !["NTC Professional Teacher License", "Certificate in School Leadership and Management (CSLM)", "Post Graduate Diploma in Education (PGDE)", "Diploma in Basic Education (DBE)", "Teacher Certificate 'A'", "Professional Certificate in Educational Administration", "Early Childhood Care and Development Certification", "Executive Certificate in Educational Leadership", "Certificate in Guidance and Counseling", "Special Education (SPED) Certificate", "None"].includes(formData.qualifications)) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="pt-1.5"
                  >
                    <input
                      type="text"
                      value={formData.qualifications === 'Custom Certification' ? '' : formData.qualifications}
                      onChange={(e) => handleInputChange('qualifications', e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
                      placeholder="Specify your custom professional certification details..."
                    />
                  </motion.div>
                )}
              </div>

              <div className="md:col-span-2 border-t border-slate-100/65 pt-4 mt-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Digital Signature */}
                <div className="space-y-1 text-left">
                  <label className="block text-xs font-semibold text-slate-700">Headteacher's Digital Signature</label>
                  <div className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="w-24 h-12 rounded bg-white border border-slate-300 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-2xs">
                      {formData.signatureUrl ? (
                        <img src={formData.signatureUrl} className="w-full h-full object-contain" alt="Signature Preview" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="text-[10px] text-slate-400 italic font-mono text-center leading-none">No Signature Uploaded</div>
                      )}
                    </div>
                    <div className="flex-grow space-y-1">
                      <label className="inline-block px-2 py-1 bg-white border border-slate-205 text-slate-700 hover:bg-slate-50 text-[10px] font-bold rounded shadow-2xs cursor-pointer transition select-none">
                        Choose File
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleSignatureUpload}
                        />
                      </label>
                      {formData.signatureUrl && (
                        <button
                          type="button"
                          onClick={() => handleInputChange('signatureUrl', '')}
                          className="block text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                        >
                          Remove Signature
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-400">Renders on the Signature section of printed Report Cards.</p>
                </div>

                {/* School Stamp */}
                <div className="space-y-1 text-left">
                  <label className="block text-xs font-semibold text-slate-700">School Stamp / Seal</label>
                  <div className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="w-16 h-12 rounded bg-white border border-slate-300 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-2xs">
                      {formData.stampUrl ? (
                        <img src={formData.stampUrl} className="w-full h-full object-contain" alt="Stamp Preview" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="text-[10px] text-slate-400 italic font-mono text-center leading-none">No Stamp Uploaded</div>
                      )}
                    </div>
                    <div className="flex-grow space-y-1">
                      <label className="inline-block px-2 py-1 bg-white border border-slate-205 text-slate-700 hover:bg-slate-50 text-[10px] font-bold rounded shadow-2xs cursor-pointer transition select-none">
                        Choose File
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleStampUpload}
                        />
                      </label>
                      {formData.stampUrl && (
                        <button
                          type="button"
                          onClick={() => handleInputChange('stampUrl', '')}
                          className="block text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                        >
                          Remove Stamp
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-400 font-sans">Superimposed adjacent to the Signature block.</p>
                </div>

                {/* Custom School Crest Watermark */}
                <div className="space-y-1 text-left">
                  <label className="block text-xs font-semibold text-slate-700">Custom Watermark Crest / Logo</label>
                  <div className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="w-16 h-12 rounded bg-white border border-slate-300 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-2xs">
                      {formData.crestUrl ? (
                        <img src={formData.crestUrl} className="w-full h-full object-contain" alt="Crest Preview" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="text-[10px] text-slate-400 italic font-mono text-center leading-none text-center">Default (Ghana Crest)</div>
                      )}
                    </div>
                    <div className="flex-grow space-y-1">
                      <label className="inline-block px-2 py-1 bg-white border border-slate-205 text-slate-700 hover:bg-slate-50 text-[10px] font-bold rounded shadow-2xs cursor-pointer transition select-none">
                        Choose File
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleCrestUpload}
                        />
                      </label>
                      {formData.crestUrl && (
                        <button
                          type="button"
                          onClick={() => handleInputChange('crestUrl', '')}
                          className="block text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                        >
                          Remove Crest
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-400 font-sans">Watermarks print preview documents. Falls back to default Ghana Crest.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Group 3: Regional Boundaries */}
          <div className="pt-2">
            <h3 className="text-sm font-semibold text-slate-700 pb-2 border-b border-slate-100 flex items-center gap-1.5 mb-4">
              District & Jurisdiction Zones
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Administrative District</label>
                <input
                  type="text"
                  value={formData.district}
                  onChange={(e) => handleInputChange('district', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
                  placeholder="e.g., Kumasi Metropolitan"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Educational Circuit</label>
                <input
                  type="text"
                  value={formData.circuit}
                  onChange={(e) => handleInputChange('circuit', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
                  placeholder="e.g. Asokonyi Circuit"
                />
              </div>
            </div>
          </div>

          {/* SECTION DATA CONTROLS */}
          <div className="mt-8 pt-6 border-t border-slate-100 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="text-indigo-500" size={14} /> Section Profile Controls
            </h4>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Manage input states, select parameters, and institutional logs for this module.
            </p>
            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleClearForm}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-850 hover:bg-slate-100 rounded-xl font-bold font-sans transition text-xs cursor-pointer shadow-xs"
              >
                <Eraser size={13} /> Clear All Inputs
              </button>
              <button
                type="button"
                onClick={handleDeleteActive}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 hover:text-amber-850 hover:bg-amber-100 rounded-xl font-bold font-sans transition text-xs cursor-pointer shadow-xs"
              >
                <RotateCcw size={13} /> Delete Active Assets
              </button>
              <button
                type="button"
                onClick={handleDeleteAll}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 hover:text-rose-850 hover:bg-rose-100 rounded-xl font-bold font-sans transition text-xs cursor-pointer shadow-xs sm:ml-auto"
              >
                <Trash2 size={13} /> Delete All Section Data
              </button>
            </div>
          </div>

        </div>

        {/* PROFILE PREVIEW & CERTIFICATE PANEL */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between space-y-6 print:m-0 print:border-0 print:p-0 print:bg-white lg:col-span-1">
          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-5 print:border-none print:shadow-none">
            <div className="text-center pb-4 border-b border-slate-100">
              <div className="mx-auto w-16 h-16 rounded-full bg-slate-50 border border-slate-200 mb-3 flex items-center justify-center overflow-hidden">
                {formData.logoUrl ? (
                  <img src={formData.logoUrl} className="w-full h-full object-contain" alt="School logo" referrerPolicy="no-referrer" />
                ) : (
                  <DefaultCrest className="h-10 w-10 text-indigo-600" />
                )}
              </div>
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${formData.schoolType === 'Private' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'} mb-2`}>
                {formData.schoolType} Institution
              </span>
              <h4 className="text-sm font-display font-black text-slate-900 uppercase tracking-tight">{formData.name}</h4>
              <p className="text-xs text-slate-500 italic mt-1 font-serif">"{formData.motto || 'Motto not updated'}"</p>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">EMIS Code:</span>
                <span className="text-slate-700 font-semibold">{formData.emisCode || 'n/a'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">School No:</span>
                <span className="text-slate-700 font-semibold">{formData.schoolNumber || 'n/a'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Digital GPS:</span>
                <span className="text-slate-700 font-semibold text-right">{formData.gpsAddress || 'n/a'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">District:</span>
                <span className="text-slate-700 font-semibold text-right">{formData.district || 'n/a'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Circuit:</span>
                <span className="text-slate-700 font-semibold text-right">{formData.circuit || 'n/a'}</span>
              </div>
              <div className="pt-2 text-[11px] font-sans">
                <span className="block text-slate-400 font-mono text-[10px] uppercase">Headteacher Contact:</span>
                <strong className="block text-slate-800 font-medium mt-0.5">
                  {formData.headteacherName}
                  {formData.assignedTeacherId && (
                    <span className="ml-1 text-[9px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded font-bold font-mono">Linked</span>
                  )}
                </strong>
                <span className="text-slate-500 text-xs block">{formData.telephone} | {formData.email}</span>
                <span className="text-slate-400 italic text-[10px] block mt-1">{formData.highestAcademicQualifications}</span>
              </div>
            </div>
          </div>
          <div className="bg-slate-100 p-4 rounded-lg border border-slate-200 text-[11px] text-slate-500 leading-relaxed font-sans no-print flex items-center gap-2">
            <Info size={22} className="text-slate-400 flex-shrink-0" />
            <span>Updates made on this worksheet are saved securely. Use the Print action to output standard corporate reports or PDF catalogs of files.</span>
          </div>
        </div>

      </div>

      {/* PRINT-ONLY HIGH FIDELITY LAYOUT (ONLY VISIBLE ON PRINT) */}
      <div id="school-profile-print-area" className="hidden print:block font-serif max-w-4xl mx-auto p-12 bg-white text-black border-4 border-double border-slate-800 rounded-none shadow-none mt-20 relative">
        <div className="absolute inset-0 z-0 pointer-events-none" dangerouslySetInnerHTML={{ __html: getWatermarkHtml(formData.crestUrl) }} />
        <div className="text-center border-b-2 border-slate-800 pb-6 mb-8 relative z-10">
          <div className="mx-auto w-24 h-24 mb-4 flex items-center justify-center overflow-hidden border border-slate-300 rounded-full bg-slate-50">
            {formData.logoUrl ? (
              <img src={formData.logoUrl} className="w-full h-full object-contain" alt="Logo" referrerPolicy="no-referrer" />
            ) : (
              <DefaultCrest className="h-16 w-16 text-slate-800" />
            )}
          </div>
          <h1 className="text-3xl font-bold tracking-tight uppercase font-display">{formData.name}</h1>
          <p className="text-sm italic font-serif mt-1">Motto: "{formData.motto}"</p>
          <div className="grid grid-cols-3 gap-2 mt-4 text-xs font-mono">
            <div><strong>EMIS:</strong> {formData.emisCode}</div>
            <div><strong>REG NO:</strong> {formData.schoolNumber}</div>
            <div><strong>GPS:</strong> {formData.gpsAddress}</div>
          </div>
        </div>

        <h2 className="text-lg font-bold uppercase text-center tracking-widest border-b border-slate-400 pb-2 mb-6">
          Official Institutional Profile Sheet
        </h2>

        <div className="grid grid-cols-2 gap-x-12 gap-y-4 text-sm leading-8">
          <div>
            <strong>School Category:</strong> {formData.schoolType} Institution
          </div>
          <div>
            <strong>Educational District:</strong> {formData.district}
          </div>
          <div>
            <strong>Educational Circuit:</strong> {formData.circuit}
          </div>
          <div>
            <strong>Head of Institution:</strong> {formData.headteacherName}
          </div>
          <div>
            <strong>Contact Phone:</strong> {formData.telephone}
          </div>
          <div>
            <strong>Electronic Mail:</strong> {formData.email}
          </div>
          <div className="col-span-2 mt-4 border-t border-slate-200 pt-4">
            <strong>Headteacher Academic Qualifications:</strong>
            <p className="italic text-slate-800 text-xs mt-1 leading-relaxed">{formData.qualifications || 'No qualifications listed.'}</p>
          </div>
          <div className="col-span-2">
            <strong>Academic Level Achieved:</strong> {formData.highestAcademicQualifications || 'N/A'}
          </div>
        </div>

        <div className="mt-20 flex justify-between text-xs font-serif pt-8 border-t border-slate-300">
          <div className="text-center w-48">
            <div className="h-14 w-48 relative flex items-center justify-center">
              {formData.stampUrl && (
                <img 
                  src={formData.stampUrl} 
                  alt="Official Stamp" 
                  className="absolute w-16 h-16 object-contain opacity-75 z-0 transform -rotate-12 translate-x-[-15%]" 
                  referrerPolicy="no-referrer"
                />
              )}
              {formData.signatureUrl ? (
                <img 
                  src={formData.signatureUrl} 
                  alt="Headteacher Signature" 
                  className="absolute w-32 h-10 object-contain z-10" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-[1px] w-48 bg-slate-500 self-end"></div>
              )}
            </div>
            {formData.signatureUrl && <div className="h-[1px] w-48 bg-slate-300"></div>}
            <p className="mt-2 font-semibold font-mono">{formData.headteacherName || 'Headteacher'}</p>
            <p className="text-slate-500 italic">Signature of Headteacher</p>
          </div>
          <div className="text-center w-48">
            <div className="h-14 w-48 relative flex items-center justify-center">
              {formData.stampUrl ? (
                <img 
                  src={formData.stampUrl} 
                  alt="Official Date Stamp" 
                  className="absolute w-16 h-16 object-contain opacity-85" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-[1px] w-48 bg-slate-500 self-end"></div>
              )}
            </div>
            {formData.stampUrl && <div className="h-[1px] w-48 bg-slate-300"></div>}
            <p className="mt-2 font-mono">{new Date().toLocaleDateString()}</p>
            <p className="text-slate-500 italic">Official Date Stamp</p>
          </div>
        </div>
      </div>

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
                Your browser blocks direct print triggers from inside the preview iframe. To print this profile sheet, please click the <strong className="text-slate-800 font-bold">"Open in a new tab" ↗</strong> button at the top right of the application workspace first.
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
              
              <div id="school-profile-preview-card" className="relative w-full max-w-[450px] min-h-[636px] bg-white p-8 text-black border-4 border-double border-slate-800 shadow-2xl text-[9px] space-y-3 font-serif rounded-none overflow-y-auto">
                {/* Transparent School Crest Watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.045] z-0">
                  {formData.crestUrl ? (
                    <img src={formData.crestUrl} className="w-[280px] h-[280px] object-contain" alt="Watermark Crest" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-[280px] h-[280px]" dangerouslySetInnerHTML={{ __html: GHANA_CREST_SVG_SIMPLE }} />
                  )}
                </div>

                <div className="relative z-10 text-center border-b-2 border-slate-800 pb-2 mb-3">
                  <div className="mx-auto w-12 h-12 mb-2 flex items-center justify-center overflow-hidden border border-slate-200 rounded-full bg-slate-50">
                    {formData.logoUrl ? (
                      <img src={formData.logoUrl} className="w-full h-full object-contain" alt="Logo" referrerPolicy="no-referrer" />
                    ) : (
                      <DefaultCrest className="h-8 w-8 text-slate-800" />
                    )}
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-tight font-sans text-stone-900">{formData.name}</h3>
                  <p className="text-[9px] italic mt-0.5 text-stone-600">Motto: "{formData.motto}"</p>
                  <div className="flex justify-center gap-4 mt-2 text-[8px] font-mono opacity-80 text-stone-500">
                    <span>EMIS: {formData.emisCode}</span>
                    <span>REG NO: {formData.schoolNumber}</span>
                  </div>
                </div>

                <h4 className="text-[10px] font-bold uppercase text-center tracking-widest border-b border-slate-300 pb-1 mb-2 text-stone-900">
                  Official Institutional Profile Sheet
                </h4>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[9px] leading-relaxed text-stone-900">
                  <div><strong>School Type:</strong> {formData.schoolType}</div>
                  <div><strong>Educational District:</strong> {formData.district}</div>
                  <div><strong>Educational Circuit:</strong> {formData.circuit}</div>
                  <div><strong>Head of Institution:</strong> {formData.headteacherName}</div>
                  <div><strong>Contact Phone:</strong> {formData.telephone}</div>
                  <div><strong>Electronic Mail:</strong> {formData.email}</div>
                  <div className="col-span-2 border-t border-stone-200 pt-2 mt-1">
                    <strong>Headteacher Academic Qualifications:</strong>
                    <p className="italic text-stone-700 text-[8px] leading-relaxed mt-0.5">{formData.qualifications || 'No qualifications listed.'}</p>
                  </div>
                  <div className="col-span-2">
                    <strong>Academic Level Achieved:</strong> {formData.highestAcademicQualifications || 'N/A'}
                  </div>
                </div>

                <div className="pt-4 border-t border-stone-300 flex justify-between text-[8px] opacity-90 mt-6">
                  <div className="text-center">
                    <div className="h-6 w-24 border-b border-stone-400 mx-auto"></div>
                    <p className="mt-1 font-mono font-medium">{formData.headteacherName}</p>
                    <p className="text-stone-500 italic">Headmaster/Principal</p>
                  </div>
                  <div className="text-center">
                    <div className="h-6 w-24 border-b border-stone-400 mx-auto"></div>
                    <p className="mt-1 font-mono">{new Date().toLocaleDateString()}</p>
                    <p className="text-stone-500 italic">Official Stamp Date</p>
                  </div>
                </div>
              </div>
              
              <span className="text-[10px] text-slate-300 font-mono tracking-wide">Standard A4 Format Proportionately Scaled</span>
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
                    <p className="text-[10px] text-slate-400">Review print layout parameters</p>
                  </div>
                </div>

                <GoogleDriveExportControl 
                  elementId="school-profile-preview-card" 
                  defaultFilename={`${formData.name ? formData.name.replace(/\s+/g, '_') : 'School'}_Official_Profile.pdf`} 
                />

                <div className="p-3 bg-teal-50 border border-teal-100/70 rounded-xl space-y-1 text-teal-800 text-[11px]">
                  <span className="font-bold">✨ High-Fidelity Vector Rendering</span>
                  <p className="text-[10px] text-teal-700/90 leading-relaxed">
                    This document is fully compiled with absolute styling rules for printing to laser printers or saving directly to your hard drive as high-end PDFs.
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
                        Under <strong>Destination</strong>, choose <strong className="text-slate-900 font-bold">Save as PDF</strong> as your target system printer.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <div className="font-bold text-[10px] text-slate-600 bg-slate-100 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">3</div>
                      <p className="text-[11px] leading-relaxed">
                        Expand <strong>More Settings</strong>, set orientation check to <strong>Portrait</strong>, format size <strong>A4</strong>, tick <strong>Background Graphics</strong>, and untick headers.
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
                    handlePrint();
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

    </div>
  );
}
