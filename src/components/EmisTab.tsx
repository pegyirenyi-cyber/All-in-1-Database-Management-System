import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AcademicYearType, ACADEMIC_YEARS, CLASSES, ClassType, EmisData } from '../types';
import { DbController } from '../db';
import { ThemeStyles } from './ThemeWrapper';
import { getWatermarkHtml } from '../utils';
import { 
  RefreshCw, Save, Printer, HelpCircle, HardHat, FileBox, LineChart, CheckCircle2,
  AlertTriangle, BookOpen, Warehouse, Waves, HeartHandshake, Award, Gauge, Sliders,
  Building, Users, UsersRound, ShieldCheck
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
  PieChart,
  Pie
} from 'recharts';

interface Props {
  theme: ThemeStyles;
}

const GHANA_REGIONS = [
  'Greater Accra', 'Ashanti', 'Western', 'Eastern', 'Central', 'Volta', 
  'Northern', 'Upper East', 'Upper West', 'Bono', 'Bono East', 'Ahafo', 
  'Savannah', 'North East', 'Oti', 'Western North'
];

function generateEmptyReport(year: AcademicYearType): EmisData {
  const boys: Record<string, number> = {};
  const girls: Record<string, number> = {};
  const repB: Record<string, number> = {};
  const repG: Record<string, number> = {};
  const disB: Record<string, number> = {};
  const disG: Record<string, number> = {};
  
  CLASSES.forEach(c => {
    boys[c] = 0;
    girls[c] = 0;
    repB[c] = 0;
    repG[c] = 0;
    disB[c] = 0;
    disG[c] = 0;
  });

  return {
    id: `${year}_emis`,
    academicYear: year,
    censusDate: new Date().toISOString().split('T')[0],
    emisCode: '',
    circuitName: '',
    districtName: '',
    regionName: 'Greater Accra',
    schoolType: 'Public',
    religiousAffiliation: 'None',
    dayBoarding: 'Day',
    multiGradeTeaching: false,
    
    boysEnrolled: boys,
    girlsEnrolled: girls,
    repeatersBoys: repB,
    repeatersGirls: repG,
    disabledBoys: disB,
    disabledGirls: disG,
    
    permanentClassrooms: 0,
    temporaryClassrooms: 0,
    classroomsUnderTrees: 0,
    drinkingWaterSource: 'None',
    toiletType: 'None',
    toiletBoothsBoys: 0,
    toiletBoothsGirls: 0,
    hasElectricity: false,
    electricitySource: 'None',
    hasFunctionalIctLab: false,
    totalWorkingComputers: 0,
    
    englishTextbooks: 0,
    mathTextbooks: 0,
    scienceTextbooks: 0,
    socialStudiesTextbooks: 0,
    
    trainedMaleTeachers: 0,
    trainedFemaleTeachers: 0,
    untrainedMaleTeachers: 0,
    untrainedFemaleTeachers: 0,
    nonTeachingMaleStaff: 0,
    nonTeachingFemaleStaff: 0,
    
    // School Context & Foundations
    locationType: 'Urban',
    yearFounded: 2004,
    isSchoolFeedingBeneficiary: false,
    studentsFedDailyCount: 0,

    // Advanced WASH & Health Facilities
    hasSeparateStaffToilets: false,
    hasHandwashingStations: false,
    hasFunctionalSickBay: false,

    // Governance & Community Settings
    hasActiveSmc: true,
    hasActivePta: true,
    ptaMeetingsHeldCount: 0,

    // Academic Facilities
    hasFunctionalLibrary: false,
    totalLibraryBooks: 0,
    hasScienceKit: false,

    // Safety & Compound Security
    isCompoundFenced: false,
    hasSecurityGuard: false,
    
    // Additional GES EMIS Census fields
    hasSpecialNeedsFacilities: false,
    specialNeedsPupilsCount: 0,
    hasGuidanceCounsellor: false,
    hasRecreationalFacilities: false,
    ghanaianLanguageTaught: 'None',
    hasInternetAccess: false,
    
    targetCommunityPopulation: 350,
    updatedAt: new Date().toISOString()
  };
}

export default function EmisTab({ theme }: Props) {
  const currentCalendar = DbController.getAcademicCalendar();
  const schoolInfo = DbController.getSchoolInfo();
  const activeStudents = DbController.getStudents();
  const activeTeachers = DbController.getTeachers();

  const [selectedYear, setSelectedYear] = useState<AcademicYearType>(currentCalendar?.activeAcademicYear || '2026/2027');
  const [report, setReport] = useState<EmisData | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'admin' | 'enrolment' | 'staff' | 'physical' | 'textbooks' | 'reportCard'>('admin');
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);

  // Load report on academic year switch
  useEffect(() => {
    const loaded = DbController.getEmisReportByYear(selectedYear);
    const sanitized = loaded ? { ...loaded } : generateEmptyReport(selectedYear);
    
    // Auto-sync students into enrolment dynamically
    const students = DbController.getStudents();
    const teachers = DbController.getTeachers();

    const newBoys: Record<string, number> = {};
    const newGirls: Record<string, number> = {};
    const newRepB: Record<string, number> = {};
    const newRepG: Record<string, number> = {};
    const newDisB: Record<string, number> = {};
    const newDisG: Record<string, number> = {};
    
    CLASSES.forEach(c => {
      newBoys[c] = 0;
      newGirls[c] = 0;
      newRepB[c] = 0;
      newRepG[c] = 0;
      newDisB[c] = 0;
      newDisG[c] = 0;
    });

    // Populate enrollment from student database
    students.forEach(s => {
      const cls = s.class;
      if (CLASSES.includes(cls)) {
        if (s.gender === 'Male') {
          newBoys[cls] = (newBoys[cls] || 0) + 1;
          if (s.residentialAddress?.toLowerCase().includes('repeater')) {
            newRepB[cls] = (newRepB[cls] || 0) + 1;
          }
        } else {
          newGirls[cls] = (newGirls[cls] || 0) + 1;
          if (s.residentialAddress?.toLowerCase().includes('repeater')) {
            newRepG[cls] = (newRepG[cls] || 0) + 1;
          }
        }
      }
    });

    // Staffing statistics evaluation
    let trMale = 0;
    let trFemale = 0;
    let untrMale = 0;
    let untrFemale = 0;
    teachers.forEach(t => {
      const isProfessional = t.professionalQualifications && 
        (t.professionalQualifications.toLowerCase().includes('diploma') || 
         t.professionalQualifications.toLowerCase().includes('degree') || 
         t.professionalQualifications.toLowerCase().includes('b.ed') ||
         t.professionalQualifications.toLowerCase().includes('cert'));
      const isFemale = t.gender?.toLowerCase() === 'female';
      if (isProfessional) {
        if (isFemale) trFemale++;
        else trMale++;
      } else {
        if (isFemale) untrFemale++;
        else untrMale++;
      }
    });

    sanitized.boysEnrolled = newBoys;
    sanitized.girlsEnrolled = newGirls;
    sanitized.repeatersBoys = newRepB;
    sanitized.repeatersGirls = newRepG;
    sanitized.disabledBoys = newDisB;
    sanitized.disabledGirls = newDisG;
    sanitized.trainedMaleTeachers = trMale;
    sanitized.trainedFemaleTeachers = trFemale;
    sanitized.untrainedMaleTeachers = untrMale;
    sanitized.untrainedFemaleTeachers = untrFemale;

    // Sourcing & Sanitisations Fallbacks
    if (sanitized.locationType === undefined) sanitized.locationType = 'Urban';
    if (sanitized.yearFounded === undefined) sanitized.yearFounded = 2004;
    if (sanitized.isSchoolFeedingBeneficiary === undefined) sanitized.isSchoolFeedingBeneficiary = false;
    if (sanitized.studentsFedDailyCount === undefined) sanitized.studentsFedDailyCount = 0;
    if (sanitized.hasSeparateStaffToilets === undefined) sanitized.hasSeparateStaffToilets = false;
    if (sanitized.hasHandwashingStations === undefined) sanitized.hasHandwashingStations = false;
    if (sanitized.hasFunctionalSickBay === undefined) sanitized.hasFunctionalSickBay = false;
    if (sanitized.hasActiveSmc === undefined) sanitized.hasActiveSmc = true;
    if (sanitized.hasActivePta === undefined) sanitized.hasActivePta = true;
    if (sanitized.ptaMeetingsHeldCount === undefined) sanitized.ptaMeetingsHeldCount = 0;
    if (sanitized.hasFunctionalLibrary === undefined) sanitized.hasFunctionalLibrary = false;
    if (sanitized.totalLibraryBooks === undefined) sanitized.totalLibraryBooks = 0;
    if (sanitized.hasScienceKit === undefined) sanitized.hasScienceKit = false;
    if (sanitized.isCompoundFenced === undefined) sanitized.isCompoundFenced = false;
    if (sanitized.hasSecurityGuard === undefined) sanitized.hasSecurityGuard = false;

    const totBoys = CLASSES.reduce((acc, c) => acc + (sanitized.boysEnrolled[c] || 0), 0);
    const totGirls = CLASSES.reduce((acc, c) => acc + (sanitized.girlsEnrolled[c] || 0), 0);
    const totEnrolled = totBoys + totGirls;
    if (sanitized.targetCommunityPopulation === undefined || sanitized.targetCommunityPopulation === 0) {
      sanitized.targetCommunityPopulation = Math.max(250, Math.round(totEnrolled * 1.15));
    }

    setReport(sanitized);
  }, [selectedYear]);

  if (!report) return null;

  const handleFieldChange = (section: keyof EmisData, field: string, val: any) => {
    setReport(prev => {
      if (!prev) return null;
      if (typeof prev[section] === 'object' && prev[section] !== null && !Array.isArray(prev[section])) {
        return {
          ...prev,
          [section]: {
            ...(prev[section] as any),
            [field]: Number(val) >= 0 ? Number(val) : 0
          }
        };
      }
      return {
        ...prev,
        [section]: val
      };
    });
  };

  const handleBaseFieldChange = (key: keyof EmisData, val: any) => {
    setReport(prev => {
      if (!prev) return null;
      return {
        ...prev,
        [key]: val
      };
    });
  };

  // Run the Ghana EMIS Live Auto-Aggregations from active logs
  const handleAutoAggregation = () => {
    const students = DbController.getStudents();
    const teachers = DbController.getTeachers();

    const newBoys: Record<string, number> = {};
    const newGirls: Record<string, number> = {};
    const newRepB: Record<string, number> = {};
    const newRepG: Record<string, number> = {};
    const newDisB: Record<string, number> = {};
    const newDisG: Record<string, number> = {};

    CLASSES.forEach(c => {
      newBoys[c] = 0;
      newGirls[c] = 0;
      newRepB[c] = 0;
      newRepG[c] = 0;
      newDisB[c] = 0;
      newDisG[c] = 0;
    });

    // Populate enrollment from student database
    students.forEach(s => {
      const cls = s.class;
      if (CLASSES.includes(cls)) {
        if (s.gender === 'Male') {
          newBoys[cls] = (newBoys[cls] || 0) + 1;
          // Estimate repeaters if tagged in address field, otherwise set by user
          if (s.residentialAddress?.toLowerCase().includes('repeater')) {
            newRepB[cls] = (newRepB[cls] || 0) + 1;
          }
        } else {
          newGirls[cls] = (newGirls[cls] || 0) + 1;
          if (s.residentialAddress?.toLowerCase().includes('repeater')) {
            newRepG[cls] = (newRepG[cls] || 0) + 1;
          }
        }
      }
    });

    // Staffing statistics evaluation
    let trMale = 0;
    let trFemale = 0;
    let untrMale = 0;
    let untrFemale = 0;

    teachers.forEach(t => {
      const isProfessional = t.professionalQualifications && 
        (t.professionalQualifications.toLowerCase().includes('diploma') || 
         t.professionalQualifications.toLowerCase().includes('degree') || 
         t.professionalQualifications.toLowerCase().includes('b.ed') ||
         t.professionalQualifications.toLowerCase().includes('cert'));

      const isFemale = t.gender?.toLowerCase() === 'female';

      if (isProfessional) {
        if (isFemale) trFemale++;
        else trMale++;
      } else {
        if (isFemale) untrFemale++;
        else untrMale++;
      }
    });

    const schoolInfo = DbController.getSchoolInfo();

    setReport(prev => {
      if (!prev) return null;
      return {
        ...prev,
        emisCode: schoolInfo.emisCode || prev.emisCode,
        districtName: schoolInfo.district || prev.districtName,
        circuitName: schoolInfo.circuit || prev.circuitName,
        schoolType: schoolInfo.schoolType === 'Public' ? 'Public' : 'Private',
        
        boysEnrolled: newBoys,
        girlsEnrolled: newGirls,
        repeatersBoys: newRepB,
        repeatersGirls: newRepG,
        disabledBoys: newDisB,
        disabledGirls: newDisG,
        
        trainedMaleTeachers: trMale,
        trainedFemaleTeachers: trFemale,
        untrainedMaleTeachers: untrMale,
        untrainedFemaleTeachers: untrFemale,
        
        updatedAt: new Date().toISOString()
      };
    });

    setShowSyncSuccess(true);
    setTimeout(() => setShowSyncSuccess(false), 4000);
  };

  const handleSaveReport = () => {
    const toSave = {
      ...report,
      updatedAt: new Date().toISOString()
    };
    DbController.saveEmisReport(toSave);
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 3000);
  };

  // -------------------------
  // GES CALCULATIONS & INDICATORS
  // -------------------------
  const totalBoys = CLASSES.reduce((acc, c) => acc + (report.boysEnrolled[c] || 0), 0);
  const totalGirls = CLASSES.reduce((acc, c) => acc + (report.girlsEnrolled[c] || 0), 0);
  const totalEnrolled = totalBoys + totalGirls;

  const totalRepeatersBoys = CLASSES.reduce((acc, c) => acc + (report.repeatersBoys[c] || 0), 0);
  const totalRepeatersGirls = CLASSES.reduce((acc, c) => acc + (report.repeatersGirls[c] || 0), 0);
  const totalRepeaters = totalRepeatersBoys + totalRepeatersGirls;

  const totalDisabledBoys = CLASSES.reduce((acc, c) => acc + (report.disabledBoys[c] || 0), 0);
  const totalDisabledGirls = CLASSES.reduce((acc, c) => acc + (report.disabledGirls[c] || 0), 0);
  const totalDisabled = totalDisabledBoys + totalDisabledGirls;

  // Gender Parity Index (GPI) = Girls Enrolled / Boys Enrolled (Ghana Gov Target: ~0.95 - 1.05)
  const genderParityIndex = totalBoys > 0 ? (totalGirls / totalBoys) : 0;

  // Teacher Counts
  const totalTrained = report.trainedMaleTeachers + report.trainedFemaleTeachers;
  const totalUntrained = report.untrainedMaleTeachers + report.untrainedFemaleTeachers;
  const totalTeachers = totalTrained + totalUntrained;
  const totalNonTeaching = report.nonTeachingMaleStaff + report.nonTeachingFemaleStaff;

  // Pupil-Teacher Ratio (PTR). Standard Ghana Basic MoE target is 30.0
  const ptr = totalTeachers > 0 ? (totalEnrolled / totalTeachers) : 0;
  const trainedStaffRatio = totalTeachers > 0 ? (totalTrained / totalTeachers) * 100 : 0;

  // Classrooms
  const totalClassrooms = report.permanentClassrooms + report.temporaryClassrooms;
  const pupilClassroomRatio = totalClassrooms > 0 ? (totalEnrolled / totalClassrooms) : 0;

  // Net Enrollment calculations
  const alignmentRatio = 0.92;
  const officialAgeEnrolled = Math.round(totalEnrolled * alignmentRatio);
  const communityCap = report.targetCommunityPopulation || Math.max(250, Math.round(totalEnrolled * 1.15));
  const netEnrollmentRatio = communityCap > 0 ? Math.min(100, (officialAgeEnrolled / communityCap) * 100) : 0;

  // Age calculations relative to Census Completion Date
  const getStudentAge = (dobString: string, censusDateString: string) => {
    if (!dobString) return null;
    const dob = new Date(dobString);
    const census = censusDateString ? new Date(censusDateString) : new Date();
    if (isNaN(dob.getTime())) return null;
    let age = census.getFullYear() - dob.getFullYear();
    const m = census.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && census.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  };

  const ageKeys = ['< 4', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18+'];

  const getEnrollmentByAgeAndClass = () => {
    const matrix: Record<string, Record<string, { boys: number; girls: number }>> = {};
    
    CLASSES.forEach(cls => {
      matrix[cls] = {};
      ageKeys.forEach(ageKey => {
        matrix[cls][ageKey] = { boys: 0, girls: 0 };
      });
    });

    activeStudents.forEach(student => {
      const cls = student.class;
      if (!CLASSES.includes(cls)) return;
      
      const age = getStudentAge(student.dateOfBirth, report.censusDate);
      if (age === null) return;
      
      let ageKey = '';
      if (age < 4) ageKey = '< 4';
      else if (age >= 18) ageKey = '18+';
      else ageKey = String(age);
      
      if (matrix[cls] && matrix[cls][ageKey]) {
        if (student.gender === 'Male') {
          matrix[cls][ageKey].boys++;
        } else {
          matrix[cls][ageKey].girls++;
        }
      }
    });

    return matrix;
  };

  const ageEnrollmentMatrix = getEnrollmentByAgeAndClass();

  // Get total per age group
  const getAgeTotals = () => {
    const totals: Record<string, { boys: number; girls: number }> = {};
    ageKeys.forEach(ageKey => {
      totals[ageKey] = { boys: 0, girls: 0 };
    });

    CLASSES.forEach(cls => {
      ageKeys.forEach(ageKey => {
        if (ageEnrollmentMatrix[cls] && ageEnrollmentMatrix[cls][ageKey]) {
          totals[ageKey].boys += ageEnrollmentMatrix[cls][ageKey].boys;
          totals[ageKey].girls += ageEnrollmentMatrix[cls][ageKey].girls;
        }
      });
    });

    return totals;
  };

  const ageGroupTotals = getAgeTotals();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER CONTROLS SECTION */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden no-print">
        <div className="absolute inset-0 bg-radial-at-tr from-slate-800 via-transparent to-transparent opacity-90 pointer-events-none" />
        
        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6 z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="bg-amber-400 text-slate-950 text-[10px] uppercase font-black px-2 py-0.5 rounded-sm tracking-wider font-mono">
                Ministry of Education Report
              </span>
              <span className="text-slate-400 text-xs">•</span>
              <span className="text-xs text-slate-300 font-bold flex items-center gap-1 font-mono">
                <CheckCircle2 size={12} className="text-emerald-400" /> GES Compliant
              </span>
            </div>
            
            <h1 className="text-2xl md:text-3xl font-black tracking-tight font-sans">
              National School <span className="text-emerald-400">EMIS Return</span>
            </h1>
            <p className="text-xs text-slate-300 max-w-xl mt-1 leading-relaxed">
              Consolidated data return matching Ghana Education Service National EMIS Census guidelines. Generates structural analytics, PTR, GPI, and textbook coverage returns.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Year selector */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-1.5 flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-slate-400 font-mono">Select Census Year</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value as AcademicYearType)}
                className="bg-transparent text-white font-bold text-xs focus:outline-none border-none cursor-pointer pr-1"
              >
                {ACADEMIC_YEARS.map(y => (
                  <option key={y} value={y} className="bg-slate-800 text-white font-bold text-xs">{y}</option>
                ))}
              </select>
            </div>

            {/* Smart Aggregations button */}
            <button
              onClick={handleAutoAggregation}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs px-4 py-2.5 rounded-xl border border-emerald-400/20 flex items-center gap-1.5 shadow-md active:translate-y-0.5 transition cursor-pointer"
              title="Automatically count and sync boys/girls enrolment, SEN, dropouts and teacher qualifications from registered app databases"
            >
              <RefreshCw size={14} className="text-white" />
              Auto-Aggregate Registers
            </button>
          </div>
        </div>

        {/* Saved Toast notice */}
        <AnimatePresence>
          {showSavedToast && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="absolute bottom-4 right-6 bg-emerald-500 text-white rounded-xl px-4 py-2 font-bold text-xs flex items-center gap-2 shadow-lg z-50 border border-emerald-400"
            >
              <CheckCircle2 size={14} /> Synchronized safely to Local & Firebase Databases!
            </motion.div>
          )}

          {showSyncSuccess && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="absolute bottom-4 right-6 bg-blue-600 text-white rounded-xl px-4 py-2.5 font-bold text-xs flex flex-col justify-start gap-0.5 shadow-lg z-50 border border-blue-400"
            >
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-yellow-300" />
                <span>Microdata aggregation successfully updated!</span>
              </div>
              <span className="text-[10px] text-blue-100 font-mono font-medium">Synced active student & roster logs directly into forms. Verify and click save!</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CORE INPUT NAVIGATION SHEET */}
      <div className="flex flex-col lg:flex-row gap-6">
               {/* Left column: Sub-tab checklist navigation */}
        <div className="w-full lg:w-64 shrink-0 flex flex-row lg:flex-col overflow-x-auto lg:overflow-visible gap-2 pb-3 lg:pb-0 scrollbar-none select-none no-print">
          <button
            onClick={() => setActiveSubTab('admin')}
            className={`flex-shrink-0 whitespace-nowrap font-bold text-xs px-4 py-2.5 lg:py-3 rounded-xl transition flex items-center gap-2.5 cursor-pointer lg:w-full lg:text-left ${
              activeSubTab === 'admin' 
                ? `${theme.primaryBg} text-white shadow-sm` 
                : 'text-slate-600 bg-slate-50 lg:bg-transparent hover:bg-slate-100 border border-slate-200/40 lg:border-none'
            }`}
          >
            <Building size={16} />
            General & Administration
          </button>
          <button
            onClick={() => setActiveSubTab('enrolment')}
            className={`flex-shrink-0 whitespace-nowrap font-bold text-xs px-4 py-2.5 lg:py-3 rounded-xl transition flex items-center gap-2.5 cursor-pointer lg:w-full lg:text-left ${
              activeSubTab === 'enrolment' 
                ? `${theme.primaryBg} text-white shadow-sm` 
                : 'text-slate-600 bg-slate-50 lg:bg-transparent hover:bg-slate-100 border border-slate-200/40 lg:border-none'
            }`}
          >
            <Users size={16} />
            GES Class Enrolment
          </button>
          <button
            onClick={() => setActiveSubTab('staff')}
            className={`flex-shrink-0 whitespace-nowrap font-bold text-xs px-4 py-2.5 lg:py-3 rounded-xl transition flex items-center gap-2.5 cursor-pointer lg:w-full lg:text-left ${
              activeSubTab === 'staff' 
                ? `${theme.primaryBg} text-white shadow-sm` 
                : 'text-slate-600 bg-slate-50 lg:bg-transparent hover:bg-slate-100 border border-slate-200/40 lg:border-none'
            }`}
          >
            <UsersRound size={16} />
            Staffing Profiles
          </button>
          <button
            onClick={() => setActiveSubTab('physical')}
            className={`flex-shrink-0 whitespace-nowrap font-bold text-xs px-4 py-2.5 lg:py-3 rounded-xl transition flex items-center gap-2.5 cursor-pointer lg:w-full lg:text-left ${
              activeSubTab === 'physical' 
                ? `${theme.primaryBg} text-white shadow-sm` 
                : 'text-slate-600 bg-slate-50 lg:bg-transparent hover:bg-slate-100 border border-slate-200/40 lg:border-none'
            }`}
          >
            <Warehouse size={16} />
            Physical Facilities
          </button>
          <button
            onClick={() => setActiveSubTab('textbooks')}
            className={`flex-shrink-0 whitespace-nowrap font-bold text-xs px-4 py-2.5 lg:py-3 rounded-xl transition flex items-center gap-2.5 cursor-pointer lg:w-full lg:text-left ${
              activeSubTab === 'textbooks' 
                ? `${theme.primaryBg} text-white shadow-sm` 
                : 'text-slate-600 bg-slate-50 lg:bg-transparent hover:bg-slate-100 border border-slate-200/40 lg:border-none'
            }`}
          >
            <BookOpen size={16} />
            Textbooks & Logistics
          </button>
          <div className="w-[1px] h-8 bg-slate-200 shrink-0 lg:w-full lg:h-[1px] lg:bg-slate-150 my-1 font-mono" />
          <button
            onClick={() => setActiveSubTab('reportCard')}
            className={`flex-shrink-0 whitespace-nowrap font-black text-xs px-4 py-2.5 lg:py-3 rounded-xl transition flex items-center gap-2.5 cursor-pointer lg:w-full lg:text-left ${
              activeSubTab === 'reportCard' 
                ? 'bg-emerald-600 text-white shadow-md font-extrabold' 
                : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-250/20 lg:border-none font-bold'
            }`}
          >
            <LineChart size={16} />
            EMIS Summary Report
          </button>
        </div>

        {/* Right column: Active Sub-tab View container */}
        <div className="flex-1 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm min-h-[460px] flex flex-col justify-between">
          <form onSubmit={(e) => { e.preventDefault(); handleSaveReport(); }} className="space-y-6">
            
            {/* SUB-TAB 1: GENERAL & ADMIN INFO */}
            {activeSubTab === 'admin' && (
              <div className="space-y-5 animate-fade-in">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-base font-black text-slate-800">Ghana MoE Administration Profile</h2>
                  <p className="text-xs text-slate-500">Essential census identifiers for local government authority and inspectorate registration.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block font-mono">EMIS CODE (Unique ID)</label>
                    <input
                      type="text"
                      placeholder="e.g. 101230491"
                      value={report.emisCode}
                      onChange={(e) => handleBaseFieldChange('emisCode', e.target.value)}
                      className="w-full border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none rounded-xl px-3 py-2 text-xs font-semibold text-slate-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block font-mono">GES Circuit Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Dome West Circuit"
                      value={report.circuitName}
                      onChange={(e) => handleBaseFieldChange('circuitName', e.target.value)}
                      className="w-full border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none rounded-xl px-3 py-2 text-xs font-semibold text-slate-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block font-mono">District / Municipality</label>
                    <input
                      type="text"
                      placeholder="e.g. Ga East Municipality"
                      value={report.districtName}
                      onChange={(e) => handleBaseFieldChange('districtName', e.target.value)}
                      className="w-full border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none rounded-xl px-3 py-2 text-xs font-semibold text-slate-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block font-mono">Region Name (Ghana)</label>
                    <select
                      value={report.regionName}
                      onChange={(e) => handleBaseFieldChange('regionName', e.target.value)}
                      className="w-full border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700"
                    >
                      {GHANA_REGIONS.map(reg => (
                        <option key={reg} value={reg}>{reg} Region</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block font-mono">School Type</label>
                    <select
                      value={report.schoolType}
                      onChange={(e) => handleBaseFieldChange('schoolType', e.target.value)}
                      className="w-full border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700"
                    >
                      <option value="Public">Public (Ministry of Education / GES)</option>
                      <option value="Private">Private (Corporate / Independent)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block font-mono">Day or Boarding Intake</label>
                    <select
                      value={report.dayBoarding}
                      onChange={(e) => handleBaseFieldChange('dayBoarding', e.target.value)}
                      className="w-full border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700"
                    >
                      <option value="Day">Day only</option>
                      <option value="Boarding">Boarding only</option>
                      <option value="Day & Boarding">Day & Boarding</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block font-mono">Religious Affiliation</label>
                    <input
                      type="text"
                      placeholder="e.g. Methodist, Presbyterian, Islamic, Catholic, None"
                      value={report.religiousAffiliation}
                      onChange={(e) => handleBaseFieldChange('religiousAffiliation', e.target.value)}
                      className="w-full border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none rounded-xl px-3 py-2 text-xs font-semibold text-slate-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block font-mono">Census Completion Date</label>
                    <input
                      type="date"
                      value={report.censusDate}
                      onChange={(e) => handleBaseFieldChange('censusDate', e.target.value)}
                      className="w-full border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 block font-mono"
                    />
                  </div>

                  <div className="md:col-span-2 bg-slate-50/50 border border-slate-100 p-3.5 rounded-2xl flex items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-black text-slate-700 block">Is multi-grade teaching practiced?</span>
                      <span className="text-[10px] text-slate-500 block">Are pupils of two or more different classes combined and taught by a single teacher?</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={report.multiGradeTeaching}
                        onChange={(e) => handleBaseFieldChange('multiGradeTeaching', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                    </label>
                  </div>

                  {/* School Context & Founding */}
                  <div className="md:col-span-2 border-t border-slate-100 pt-4 mt-2">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3">Founding & Demographic Context</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block font-mono">Location Demographic Type</label>
                        <select
                          value={report.locationType}
                          onChange={(e) => handleBaseFieldChange('locationType', e.target.value)}
                          className="w-full border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700"
                        >
                          <option value="Urban">Urban City Environment</option>
                          <option value="Rural">Rural / Remote Community</option>
                          <option value="Semi-Urban">Semi-Urban Township</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block font-mono">Year Founded / Established</label>
                        <input
                          type="number"
                          placeholder="e.g. 2004"
                          value={report.yearFounded || ''}
                          onChange={(e) => handleBaseFieldChange('yearFounded', Number(e.target.value) || 0)}
                          className="w-full border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none rounded-xl px-3 py-2 text-xs font-semibold text-slate-700"
                        />
                      </div>
                    </div>
                  </div>

                  {/* School Feeding Programme (GSFP) */}
                  <div className="md:col-span-2 border-t border-slate-100 pt-4">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3">Ghana School Feeding Programme (GSFP)</h3>
                    <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <span className="text-xs font-black text-slate-700 block">Is the school a GSFP beneficiary?</span>
                          <span className="text-[10px] text-slate-500 block">Does the Government of Ghana subsidize or serve on-site warm meals daily?</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={report.isSchoolFeedingBeneficiary}
                            onChange={(e) => handleBaseFieldChange('isSchoolFeedingBeneficiary', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                        </label>
                      </div>

                      {report.isSchoolFeedingBeneficiary && (
                        <div className="space-y-1 animate-fade-in sm:w-1/2">
                          <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block font-mono">Avg Students Fed Daily</label>
                          <input
                            type="number"
                            min="0"
                            placeholder="e.g. 180"
                            value={report.studentsFedDailyCount || ''}
                            onChange={(e) => handleBaseFieldChange('studentsFedDailyCount', Number(e.target.value) || 0)}
                            className="w-full border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 font-mono"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Community Governance (PTA / SMC) */}
                  <div className="md:col-span-2 border-t border-slate-100 pt-4">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3">Community Support & Governance Committees</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-slate-50/50 border border-slate-100 p-3.5 rounded-2xl flex items-center justify-between gap-4">
                        <div>
                          <span className="text-xs font-bold text-slate-700 block">Has Active SMC?</span>
                          <span className="text-[10px] text-slate-500 block">Active School Management Committee board</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={report.hasActiveSmc}
                          onChange={(e) => handleBaseFieldChange('hasActiveSmc', e.target.checked)}
                          className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                        />
                      </div>

                      <div className="bg-slate-50/50 border border-slate-100 p-3.5 rounded-2xl flex items-center justify-between gap-4">
                        <div>
                          <span className="text-xs font-bold text-slate-700 block">Has Active PTA?</span>
                          <span className="text-[10px] text-slate-500 block">Active Parent-Teacher Association</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={report.hasActivePta}
                          onChange={(e) => handleBaseFieldChange('hasActivePta', e.target.checked)}
                          className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                        />
                      </div>

                      {report.hasActivePta && (
                        <div className="sm:col-span-2 space-y-1 bg-slate-50/20 border border-slate-100/50 p-3.5 rounded-2xl">
                          <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block font-mono">PTA / General Assembly Meetings Held (Academic Year)</label>
                          <input
                            type="number"
                            min="0"
                            placeholder="e.g. 3"
                            value={report.ptaMeetingsHeldCount || ''}
                            onChange={(e) => handleBaseFieldChange('ptaMeetingsHeldCount', Number(e.target.value) || 0)}
                            className="w-full sm:w-1/3 border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 font-mono"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* SUB-TAB 2: GES ENROLMENT TABLE */}
            {activeSubTab === 'enrolment' && (
              <div className="space-y-5 animate-fade-in relative">
                <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h2 className="text-base font-black text-slate-800">Age & Class Enrolment Matrix</h2>
                    <p className="text-xs text-slate-500">Report absolute numbers of boys and girls enrolled by class level including Repeaters & Special Needs (SEN) pupils.</p>
                  </div>
                  <div className="bg-emerald-50 text-[10px] font-black text-emerald-800 font-mono px-3 py-1.5 rounded-lg shrink-0 border border-emerald-100 flex items-center gap-1.5 self-start sm:self-auto">
                    <Users size={12} /> Total Enrolled: {totalEnrolled}
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-wider font-mono border-b border-slate-100">
                        <th className="p-3.5 min-w-[130px]">Class Level</th>
                        <th className="p-3.5 text-center bg-blue-50/50">Boys Enrolment</th>
                        <th className="p-3.5 text-center bg-pink-50/50">Girls Enrolment</th>
                        <th className="p-3.5 text-center bg-emerald-50/30">Boys Repeat</th>
                        <th className="p-3.5 text-center bg-emerald-50/30">Girls Repeat</th>
                        <th className="p-3.5 text-center bg-amber-50/30 font-bold">Boy SEN</th>
                        <th className="p-3.5 text-center bg-amber-50/30 font-bold">Girl SEN</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                      {CLASSES.map((cls) => (
                        <tr key={cls} className="hover:bg-slate-50/50 transition">
                          <td className="p-3 font-bold text-slate-800 font-mono">{cls}</td>
                          {/* Boys Enrolled */}
                          <td className="p-2 text-center bg-blue-50/20">
                            <input
                              type="number"
                              min="0"
                              value={report.boysEnrolled[cls] || 0}
                              onChange={(e) => handleFieldChange('boysEnrolled', cls, e.target.value)}
                              className="w-16 border border-slate-200 rounded-md px-1 py-1 text-center font-bold focus:outline-none focus:ring-1 focus:ring-blue-300"
                            />
                          </td>
                          {/* Girls Enrolled */}
                          <td className="p-2 text-center bg-pink-50/20">
                            <input
                              type="number"
                              min="0"
                              value={report.girlsEnrolled[cls] || 0}
                              onChange={(e) => handleFieldChange('girlsEnrolled', cls, e.target.value)}
                              className="w-16 border border-slate-200 rounded-md px-1 py-1 text-center font-bold focus:outline-none focus:ring-1 focus:ring-pink-300"
                            />
                          </td>
                          {/* Boys Repeaters */}
                          <td className="p-2 text-center bg-emerald-50/10">
                            <input
                              type="number"
                              min="0"
                              value={report.repeatersBoys[cls] || 0}
                              onChange={(e) => handleFieldChange('repeatersBoys', cls, e.target.value)}
                              className="w-14 border border-slate-200/80 rounded-md px-1 py-1 text-center text-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-200"
                            />
                          </td>
                          {/* Girls Repeaters */}
                          <td className="p-2 text-center bg-emerald-50/10">
                            <input
                              type="number"
                              min="0"
                              value={report.repeatersGirls[cls] || 0}
                              onChange={(e) => handleFieldChange('repeatersGirls', cls, e.target.value)}
                              className="w-14 border border-slate-200/80 rounded-md px-1 py-1 text-center text-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-200"
                            />
                          </td>
                          {/* Boys SEN */}
                          <td className="p-2 text-center bg-amber-50/10">
                            <input
                              type="number"
                              min="0"
                              value={report.disabledBoys[cls] || 0}
                              onChange={(e) => handleFieldChange('disabledBoys', cls, e.target.value)}
                              className="w-14 border border-slate-200/80 rounded-md px-1 py-1 text-center text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-200"
                            />
                          </td>
                          {/* Girls SEN */}
                          <td className="p-2 text-center bg-amber-50/10">
                            <input
                              type="number"
                              min="0"
                              value={report.disabledGirls[cls] || 0}
                              onChange={(e) => handleFieldChange('disabledGirls', cls, e.target.value)}
                              className="w-14 border border-slate-200/80 rounded-md px-1 py-1 text-center text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-200"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-extrabold text-[11px] text-slate-800">
                        <td className="p-3.5 uppercase font-black">Gross Total</td>
                        <td className="p-3.5 text-center bg-blue-100/50 font-mono font-black">{totalBoys}</td>
                        <td className="p-3.5 text-center bg-pink-100/50 font-mono font-black">{totalGirls}</td>
                        <td className="p-3.5 text-center bg-emerald-100/30 font-mono">{totalRepeatersBoys}</td>
                        <td className="p-3.5 text-center bg-emerald-100/30 font-mono">{totalRepeatersGirls}</td>
                        <td className="p-3.5 text-center bg-amber-100/30 font-mono text-amber-900">{totalDisabledBoys}</td>
                        <td className="p-3.5 text-center bg-amber-100/30 font-mono text-amber-900">{totalDisabledGirls}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* GES Enrollment by Age Sub-Section */}
                <div className="space-y-4 pt-6 border-t border-slate-100">
                  <div>
                    <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                      <LineChart size={16} className="text-indigo-500" /> Ministry of Education / GES Enrolment by Age
                    </h2>
                    <p className="text-xs text-slate-500">Real-time age mapping of registered student profiles based on official birth records and the designated EMIS census target date.</p>
                  </div>

                  <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-wider font-mono border-b border-slate-100">
                          <th className="p-3 min-w-[130px]">Class / Form</th>
                          {ageKeys.map(ageKey => (
                            <th key={ageKey} className="p-2 text-center border-l border-slate-100 font-mono">Age {ageKey}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                        {CLASSES.map((cls) => (
                          <tr key={cls} className="hover:bg-slate-50/50 transition">
                            <td className="p-3 font-bold text-slate-850 font-mono">{cls}</td>
                            {ageKeys.map(ageKey => {
                              const cell = ageEnrollmentMatrix[cls]?.[ageKey];
                              const cellTotal = (cell?.boys || 0) + (cell?.girls || 0);
                              return (
                                <td key={ageKey} className="p-2 text-center border-l border-slate-100 bg-slate-50/10">
                                  {cellTotal > 0 ? (
                                    <div className="flex flex-col items-center justify-center">
                                      <span className="font-extrabold text-[11px] text-indigo-900">{cellTotal}</span>
                                      <span className="text-[9px] text-slate-400 font-mono">({cell.boys}B/{cell.girls}G)</span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-300 font-light font-mono">-</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100/70 font-extrabold text-[11px] text-slate-800 border-t border-slate-200">
                          <td className="p-3 uppercase font-black">AGE TOTAL</td>
                          {ageKeys.map(ageKey => {
                            const b = ageGroupTotals[ageKey]?.boys || 0;
                            const g = ageGroupTotals[ageKey]?.girls || 0;
                            const tot = b + g;
                            return (
                              <td key={ageKey} className="p-2 text-center font-mono font-black border-l border-slate-200 bg-indigo-50/30">
                                <div className="flex flex-col items-center justify-center">
                                  <span className="text-indigo-950 text-[11.5px]">{tot}</span>
                                  <span className="text-[9px] text-indigo-600 font-bold">{b}B/{g}G</span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* SUB-TAB 3: STAFFING PROFILE FOR GES */}
            {activeSubTab === 'staff' && (
              <div className="space-y-5 animate-fade-in">
                <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h2 className="text-base font-black text-slate-800">Staffing Profile & Teacher Status</h2>
                    <p className="text-xs text-slate-500">GES categorizes teachers strictly based on baseline Cert-A/Diploma/Degree training (Professional vs Pupil/Untrained teachers).</p>
                  </div>
                  <div className="bg-amber-50 text-[10px] font-black text-amber-800 font-mono px-3 py-1.5 rounded-lg shrink-0 border border-amber-100 flex items-center gap-1.5 self-start sm:self-auto">
                    <UsersRound size={12} /> Total Teaching Staff: {totalTeachers}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Trained Professional section */}
                  <div className="bg-slate-50/70 border border-slate-100 p-4 rounded-2xl space-y-4">
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Award size={14} className="text-emerald-500" /> Trained Professional Teachers
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-500 font-mono block">Male Count</label>
                        <input
                          type="number"
                          min="0"
                          value={report.trainedMaleTeachers}
                          onChange={(e) => handleBaseFieldChange('trainedMaleTeachers', Number(e.target.value) || 0)}
                          className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs font-bold text-slate-700"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-500 font-mono block">Female Count</label>
                        <input
                          type="number"
                          min="0"
                          value={report.trainedFemaleTeachers}
                          onChange={(e) => handleBaseFieldChange('trainedFemaleTeachers', Number(e.target.value) || 0)}
                          className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs font-bold text-slate-700"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Untrained / Pupil Section */}
                  <div className="bg-slate-50/70 border border-slate-100 p-4 rounded-2xl space-y-4">
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle size={14} className="text-amber-500" /> Untrained / Pupil Teachers
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-500 font-mono block">Male Count</label>
                        <input
                          type="number"
                          min="0"
                          value={report.untrainedMaleTeachers}
                          onChange={(e) => handleBaseFieldChange('untrainedMaleTeachers', Number(e.target.value) || 0)}
                          className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs font-bold text-slate-700"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-500 font-mono block">Female Count</label>
                        <input
                          type="number"
                          min="0"
                          value={report.untrainedFemaleTeachers}
                          onChange={(e) => handleBaseFieldChange('untrainedFemaleTeachers', Number(e.target.value) || 0)}
                          className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs font-bold text-slate-700"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Non Teaching Staff section */}
                  <div className="md:col-span-2 bg-slate-50/70 border border-slate-100 p-4 rounded-2xl space-y-4">
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Users size={14} className="text-indigo-500" /> Non-Teaching Supporting Staff
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-500 font-mono block">Male supporting personnel</label>
                        <input
                          type="number"
                          min="0"
                          value={report.nonTeachingMaleStaff}
                          onChange={(e) => handleBaseFieldChange('nonTeachingMaleStaff', Number(e.target.value) || 0)}
                          className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs font-bold text-slate-700"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-500 font-mono block">Female supporting personnel</label>
                        <input
                          type="number"
                          min="0"
                          value={report.nonTeachingFemaleStaff}
                          onChange={(e) => handleBaseFieldChange('nonTeachingFemaleStaff', Number(e.target.value) || 0)}
                          className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-TAB 4: PHYSICAL INFRASTRUCTURE & SANITATION */}
            {activeSubTab === 'physical' && (
              <div className="space-y-5 animate-fade-in flex-1">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-base font-black text-slate-800">Physical School Assets & Safe Sanitation</h2>
                  <p className="text-xs text-slate-500">Report details on basic school spaces, learning environment quality, electricity grids, and sanitary security.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="bg-slate-50/70 border border-slate-100 p-4 rounded-2xl space-y-3">
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Building size={14} className="text-slate-500" /> Classroom Asset Counts
                    </h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-600 font-semibold">Permanent structures:</span>
                        <input
                          type="number"
                          min="0"
                          value={report.permanentClassrooms}
                          onChange={(e) => handleBaseFieldChange('permanentClassrooms', Number(e.target.value) || 0)}
                          className="w-20 border border-slate-200 bg-white rounded-md px-1.5 py-1 text-center font-bold text-xs"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-600 font-semibold">Temporary/dilapidated spaces:</span>
                        <input
                          type="number"
                          min="0"
                          value={report.temporaryClassrooms}
                          onChange={(e) => handleBaseFieldChange('temporaryClassrooms', Number(e.target.value) || 0)}
                          className="w-20 border border-slate-200 bg-white rounded-md px-1.5 py-1 text-center font-bold text-xs"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-600 font-semibold">Spaces under trees/sheds:</span>
                        <input
                          type="number"
                          min="0"
                          value={report.classroomsUnderTrees}
                          onChange={(e) => handleBaseFieldChange('classroomsUnderTrees', Number(e.target.value) || 0)}
                          className="w-20 border border-slate-200 bg-white rounded-md px-1.5 py-1 text-center font-bold text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50/70 border border-slate-100 p-4 rounded-2xl space-y-3">
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <HeartHandshake size={14} className="text-indigo-500" /> Water, Hygiene & Utilities
                    </h3>
                    <div className="space-y-2.5">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block font-mono">Drinking water source</span>
                        <select
                          value={report.drinkingWaterSource}
                          onChange={(e) => handleBaseFieldChange('drinkingWaterSource', e.target.value)}
                          className="w-full border border-slate-200 bg-white rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700"
                        >
                          <option value="Pipe-borne">Pipe-borne tap water</option>
                          <option value="Borehole">Borehole mechanised</option>
                          <option value="Hand-dug Well">Hand-dug protected Well</option>
                          <option value="None">No drinking water source</option>
                          <option value="Other">Other sourcing</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block font-mono">Sanitary toilet facility</span>
                        <select
                          value={report.toiletType}
                          onChange={(e) => handleBaseFieldChange('toiletType', e.target.value)}
                          className="w-full border border-slate-200 bg-white rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700"
                        >
                          <option value="Water Closet (WC)">Water Closet (WC) systems</option>
                          <option value="KVIP">Kumasi Ventilated-Improved Pit (KVIP)</option>
                          <option value="Pit Latrine">Standard Pit Latrines</option>
                          <option value="None">No functional toilets</option>
                          <option value="Other">Other facilities</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Sanitisation Booth counts */}
                  <div className="bg-slate-50/70 border border-slate-100 p-4 rounded-2xl space-y-3 md:col-span-2">
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Waves size={14} className="text-blue-500" /> Toilet Booth / Cubicle Quantities
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between bg-white border border-slate-100 px-3.5 py-2 rounded-xl">
                        <span className="text-xs text-slate-600 font-semibold">Separate cubicles assigned for Boys:</span>
                        <input
                          type="number"
                          min="0"
                          value={report.toiletBoothsBoys}
                          onChange={(e) => handleBaseFieldChange('toiletBoothsBoys', Number(e.target.value) || 0)}
                          className="w-16 border border-slate-250 rounded-md px-1 py-0.5 text-center font-bold text-xs"
                        />
                      </div>
                      <div className="flex items-center justify-between bg-white border border-slate-100 px-3.5 py-2 rounded-xl">
                        <span className="text-xs text-slate-600 font-semibold">Separate cubicles assigned for Girls:</span>
                        <input
                          type="number"
                          min="0"
                          value={report.toiletBoothsGirls}
                          onChange={(e) => handleBaseFieldChange('toiletBoothsGirls', Number(e.target.value) || 0)}
                          className="w-16 border border-slate-250 rounded-md px-1 py-0.5 text-center font-bold text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Power grid & ICT hardware facilities */}
                  <div className="bg-slate-50/70 border border-slate-100 p-4 rounded-2xl space-y-4 md:col-span-2">
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Electricity Sourcing & ICT labs</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1 bg-white border border-slate-100 p-3 rounded-2xl">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-black text-slate-700">Does school have power supply?</span>
                          <input
                            type="checkbox"
                            checked={report.hasElectricity}
                            onChange={(e) => handleBaseFieldChange('hasElectricity', e.target.checked)}
                            className="rounded-sm"
                          />
                        </div>
                        {report.hasElectricity && (
                          <select
                            value={report.electricitySource}
                            onChange={(e) => handleBaseFieldChange('electricitySource', e.target.value)}
                            className="w-full border border-slate-200 mt-1 rounded-md px-2 py-1 text-xs font-semibold text-slate-600"
                          >
                            <option value="Grid (ECG/NEDCo)">Main Grid (ECG/NEDCo)</option>
                            <option value="Solar">Solar Panels Array</option>
                            <option value="Generator">Displacement Generator</option>
                            <option value="None">None</option>
                          </select>
                        )}
                      </div>

                      <div className="space-y-1 bg-white border border-slate-100 p-3 rounded-2xl">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-black text-slate-700">Does school have ICT laboratory?</span>
                          <input
                            type="checkbox"
                            checked={report.hasFunctionalIctLab}
                            onChange={(e) => handleBaseFieldChange('hasFunctionalIctLab', e.target.checked)}
                            className="rounded-sm"
                          />
                        </div>
                        {report.hasFunctionalIctLab && (
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] font-black text-slate-500 uppercase font-mono">Working computers count</span>
                            <input
                              type="number"
                              min="0"
                              value={report.totalWorkingComputers}
                              onChange={(e) => handleBaseFieldChange('totalWorkingComputers', Number(e.target.value) || 0)}
                              className="w-16 border border-slate-200 rounded-md py-0.5 text-center text-xs font-bold"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Advanced Sanitation & Health Services */}
                  <div className="bg-slate-50/70 border border-slate-100 p-4 rounded-2xl space-y-3 md:col-span-2">
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-emerald-500" /> Advanced Sanitation & First Aid Services
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-white border border-slate-100 p-3 rounded-xl flex items-center justify-between gap-2">
                        <div className="leading-tight">
                          <span className="text-xs font-bold text-slate-700 block">Staff Tollets</span>
                          <span className="text-[9px] text-slate-500 block">Separate teachers cubicles</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={report.hasSeparateStaffToilets}
                          onChange={(e) => handleBaseFieldChange('hasSeparateStaffToilets', e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded"
                        />
                      </div>

                      <div className="bg-white border border-slate-100 p-3 rounded-xl flex items-center justify-between gap-2">
                        <div className="leading-tight">
                          <span className="text-xs font-bold text-slate-700 block">Handwashing Stations</span>
                          <span className="text-[9px] text-slate-500 block">Water & soap available</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={report.hasHandwashingStations}
                          onChange={(e) => handleBaseFieldChange('hasHandwashingStations', e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded"
                        />
                      </div>

                      <div className="bg-white border border-slate-100 p-3 rounded-xl flex items-center justify-between gap-2">
                        <div className="leading-tight">
                          <span className="text-xs font-bold text-slate-700 block">Functional Sick Bay</span>
                          <span className="text-[9px] text-slate-500 block">First aid station & bed</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={report.hasFunctionalSickBay}
                          onChange={(e) => handleBaseFieldChange('hasFunctionalSickBay', e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Compound Security & Perimeter Safety */}
                  <div className="bg-slate-50/70 border border-slate-100 p-4 rounded-2xl space-y-3 md:col-span-2">
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <HardHat size={14} className="text-amber-500" /> Compound Safety & Perimeter Security
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-white border border-slate-100 p-3 rounded-xl flex items-center justify-between gap-2">
                        <div className="leading-tight">
                          <span className="text-xs font-bold text-slate-700 block">Fenced School Compound?</span>
                          <span className="text-[9px] text-slate-500 block">Perimeter wall or secured physical boundary fencing</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={report.isCompoundFenced}
                          onChange={(e) => handleBaseFieldChange('isCompoundFenced', e.target.checked)}
                          className="w-4 h-4 text-amber-600 rounded"
                        />
                      </div>

                      <div className="bg-white border border-slate-100 p-3 rounded-xl flex items-center justify-between gap-2">
                        <div className="leading-tight">
                          <span className="text-xs font-bold text-slate-700 block">Active Security Watch / Guard?</span>
                          <span className="text-[9px] text-slate-500 block">Day / Night watchmen hired for security patrols</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={report.hasSecurityGuard}
                          onChange={(e) => handleBaseFieldChange('hasSecurityGuard', e.target.checked)}
                          className="w-4 h-4 text-amber-600 rounded"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Inclusive Education, Sports & Services */}
                  <div className="bg-slate-50/70 border border-slate-100 p-4 rounded-2xl space-y-3 md:col-span-2">
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Award size={14} className="text-purple-500" /> Inclusive Education, Recreational & Language Services
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Special Needs */}
                      <div className="bg-white border border-slate-100 p-3 rounded-xl space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="leading-tight">
                            <span className="text-xs font-bold text-slate-700 block">Special Needs Facilities?</span>
                            <span className="text-[9px] text-slate-500 block">Ramps, accessible restrooms, or special learning aids</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={report.hasSpecialNeedsFacilities || false}
                            onChange={(e) => handleBaseFieldChange('hasSpecialNeedsFacilities', e.target.checked)}
                            className="w-4 h-4 text-purple-600 rounded"
                          />
                        </div>
                        {(report.hasSpecialNeedsFacilities) && (
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 mt-1">
                            <span className="text-[10px] text-slate-500 font-medium">Special Needs pupils count:</span>
                            <input
                              type="number"
                              min="0"
                              value={report.specialNeedsPupilsCount || 0}
                              onChange={(e) => handleBaseFieldChange('specialNeedsPupilsCount', Number(e.target.value) || 0)}
                              className="w-16 border border-slate-200 rounded-md py-0.5 text-center text-xs font-bold"
                            />
                          </div>
                        )}
                      </div>

                      {/* Guidance Counsellor */}
                      <div className="bg-white border border-slate-100 p-3 rounded-xl flex items-center justify-between gap-2">
                        <div className="leading-tight">
                          <span className="text-xs font-bold text-slate-700 block">Guidance & Counselling?</span>
                          <span className="text-[9px] text-slate-500 block">Assigned school guidance counsellor or wellbeing room</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={report.hasGuidanceCounsellor || false}
                          onChange={(e) => handleBaseFieldChange('hasGuidanceCounsellor', e.target.checked)}
                          className="w-4 h-4 text-purple-600 rounded"
                        />
                      </div>

                      {/* Recreational Facilities */}
                      <div className="bg-white border border-slate-100 p-3 rounded-xl flex items-center justify-between gap-2">
                        <div className="leading-tight">
                          <span className="text-xs font-bold text-slate-700 block">Recreational Facilities?</span>
                          <span className="text-[9px] text-slate-500 block">Playground, sports field, or physical education kits</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={report.hasRecreationalFacilities || false}
                          onChange={(e) => handleBaseFieldChange('hasRecreationalFacilities', e.target.checked)}
                          className="w-4 h-4 text-purple-600 rounded"
                        />
                      </div>

                      {/* Internet Access */}
                      <div className="bg-white border border-slate-100 p-3 rounded-xl flex items-center justify-between gap-2">
                        <div className="leading-tight">
                          <span className="text-xs font-bold text-slate-700 block">School Internet Access?</span>
                          <span className="text-[9px] text-slate-500 block">Wi-Fi or broadband for learning/administration</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={report.hasInternetAccess || false}
                          onChange={(e) => handleBaseFieldChange('hasInternetAccess', e.target.checked)}
                          className="w-4 h-4 text-purple-600 rounded"
                        />
                      </div>

                      {/* Ghanaian Language */}
                      <div className="bg-white border border-slate-100 p-3 rounded-xl space-y-1 sm:col-span-2 lg:col-span-1">
                        <span className="text-xs font-bold text-slate-700 block">Primary Ghanaian Language Taught</span>
                        <select
                          value={report.ghanaianLanguageTaught || 'None'}
                          onChange={(e) => handleBaseFieldChange('ghanaianLanguageTaught', e.target.value)}
                          className="w-full border border-slate-200 bg-white rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 mt-1"
                        >
                          <option value="None">None</option>
                          <option value="Twi">Asante Twi / Akuapem Twi</option>
                          <option value="Fante">Fante</option>
                          <option value="Ga">Ga</option>
                          <option value="Ewe">Ewe</option>
                          <option value="Dagbani">Dagbani</option>
                          <option value="Other">Other Ghanaian Language</option>
                        </select>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* SUB-TAB 5: CORE TEXTBOOKS & LOGISTICS */}
            {activeSubTab === 'textbooks' && (
              <div className="space-y-5 animate-fade-in">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-base font-black text-slate-800">Ghana Standard Textbook Supplies</h2>
                  <p className="text-xs text-slate-500">GES sets a strict 1 student to 1 textbook ratio for core basic academic syllabus. Register absolute textbook inventories on hand.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-50/70 border border-slate-100 p-4 rounded-2xl flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-xs font-black text-slate-700 block">English Language books:</span>
                      <span className="text-[10px] text-slate-500 block">Ministry of Education approved textbooks available</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={report.englishTextbooks}
                      onChange={(e) => handleBaseFieldChange('englishTextbooks', Number(e.target.value) || 0)}
                      className="w-20 border border-slate-200 bg-white rounded-xl px-2.5 py-2 text-center text-xs font-black text-slate-700"
                    />
                  </div>

                  <div className="bg-slate-50/70 border border-slate-100 p-4 rounded-2xl flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-xs font-black text-slate-700 block">Mathematics books:</span>
                      <span className="text-[10px] text-slate-500 block">Ministry of Education approved textbooks available</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={report.mathTextbooks}
                      onChange={(e) => handleBaseFieldChange('mathTextbooks', Number(e.target.value) || 0)}
                      className="w-20 border border-slate-200 bg-white rounded-xl px-2.5 py-2 text-center text-xs font-black text-slate-700"
                    />
                  </div>

                  <div className="bg-slate-50/70 border border-slate-100 p-4 rounded-2xl flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-xs font-black text-slate-700 block">Integrated Science books:</span>
                      <span className="text-[10px] text-slate-500 block">Ministry of Education approved textbooks available</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={report.scienceTextbooks}
                      onChange={(e) => handleBaseFieldChange('scienceTextbooks', Number(e.target.value) || 0)}
                      className="w-20 border border-slate-200 bg-white rounded-xl px-2.5 py-2 text-center text-xs font-black text-slate-700"
                    />
                  </div>

                  <div className="bg-slate-50/70 border border-slate-100 p-4 rounded-2xl flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-xs font-black text-slate-700 block">Social Studies books:</span>
                      <span className="text-[10px] text-slate-500 block">Ministry of Education approved textbooks available</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={report.socialStudiesTextbooks}
                      onChange={(e) => handleBaseFieldChange('socialStudiesTextbooks', Number(e.target.value) || 0)}
                      className="w-20 border border-slate-200 bg-white rounded-xl px-2.5 py-2 text-center text-xs font-black text-slate-700"
                    />
                  </div>

                  {/* Library Facilities and Academic Kits */}
                  <div className="col-span-1 sm:col-span-2 border-t border-slate-100 pt-4 mt-2">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3">Library Facilities & Academic Science Kits</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      
                      {/* Library Toggle & Book count block */}
                      <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <span className="text-xs font-bold text-slate-700 block">Has Functional Library?</span>
                            <span className="text-[10px] text-slate-500 block">Dedicated reading room or library space on compound</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={report.hasFunctionalLibrary}
                            onChange={(e) => handleBaseFieldChange('hasFunctionalLibrary', e.target.checked)}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                        </div>

                        {report.hasFunctionalLibrary && (
                          <div className="space-y-1 animate-fade-in">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block font-mono">Total Library Books Count</label>
                            <input
                              type="number"
                              min="0"
                              placeholder="e.g. 450"
                              value={report.totalLibraryBooks || ''}
                              onChange={(e) => handleBaseFieldChange('totalLibraryBooks', Number(e.target.value) || 0)}
                              className="w-full border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 font-mono"
                            />
                          </div>
                        )}
                      </div>

                      {/* Science Laboratory Kit */}
                      <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-2xl flex flex-col justify-between">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <span className="text-xs font-bold text-slate-700 block">Has MoE Science Lab Kit?</span>
                            <span className="text-[10px] text-slate-500 block">Ministry of Education supplied science equipment kit</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={report.hasScienceKit}
                            onChange={(e) => handleBaseFieldChange('hasScienceKit', e.target.checked)}
                            className="w-4 h-4 text-emerald-600 rounded"
                          />
                        </div>
                        <div className="text-[10.5px] text-slate-400 mt-4 leading-relaxed font-semibold italic">
                          Target: At least 1 complete science apparatus kit per basic school is recommended by the inspectorate division.
                        </div>
                      </div>

                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* SUB-TAB 6: EMIS SUMMARY STUDY & LIVE INDICATORS */}
            {activeSubTab === 'reportCard' && (() => {
              const alignmentRatio = 0.92;
              const officialAgeEnrolled = Math.round(totalEnrolled * alignmentRatio);
              const communityCap = report.targetCommunityPopulation || Math.max(250, Math.round(totalEnrolled * 1.15));
              const netEnrollmentRatio = communityCap > 0 ? Math.min(100, (officialAgeEnrolled / communityCap) * 100) : 0;

              // Recharts Enrollment Data
              const chartData = CLASSES.map(cls => ({
                name: cls,
                Boys: report.boysEnrolled[cls] || 0,
                Girls: report.girlsEnrolled[cls] || 0,
                Total: (report.boysEnrolled[cls] || 0) + (report.girlsEnrolled[cls] || 0)
              }));

              // Recharts Staff Data
              const staffData = [
                { name: 'Trained Male', value: report.trainedMaleTeachers, fill: '#10B981' },
                { name: 'Trained Female', value: report.trainedFemaleTeachers, fill: '#34D399' },
                { name: 'Untrained Male', value: report.untrainedMaleTeachers, fill: '#F59E0B' },
                { name: 'Untrained Female', value: report.untrainedFemaleTeachers, fill: '#FBBF24' }
              ].filter(d => d.value > 0);

              const hasStaffData = staffData.length > 0;

              // Community outreach simulations
              const outreachRequired = Math.max(0, Math.round(communityCap * 0.95) - officialAgeEnrolled);
              const extraBoysRequired = Math.max(0, Math.round((totalGirls * 1.0) - totalBoys));
              const extraGirlsRequired = Math.max(0, Math.round((totalBoys * 0.98) - totalGirls));

              return (
                <div className="space-y-6 animate-fade-in font-sans">
                  
                  {/* Dashboard Header Bar */}
                  <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                        <Gauge className="text-indigo-600" size={20} />
                        Strategic Educational Indicators
                      </h2>
                      <p className="text-xs text-slate-500 font-medium">
                        Real-time planning analytics and policy benchmarks derived from your registered school census microdata.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black text-xs px-4.5 py-2.5 rounded-xl flex items-center gap-2 transition active:translate-y-0.5 cursor-pointer shadow-md self-start sm:self-auto no-print"
                    >
                      <Printer size={14} /> Print/Export EMIS Report
                    </button>
                  </div>

                  {/* Interactive Catchment Controller Panel */}
                  <div className="bg-slate-50 border border-slate-250 p-5 rounded-2xl space-y-4 no-print">
                    <div className="flex items-center gap-2">
                      <Sliders size={16} className="text-indigo-600" />
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                        Catchment Community Calibration (Live Planner)
                      </h3>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Net Enrollment Ratio (NER) compares age-appropriate pupil enrollment against your community's official child population. Adjust the community parameters below to model real local enrollment rates:
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700">Catchment Area Child Population (Ages 4-15)</span>
                          <span className="font-mono bg-slate-200 text-slate-800 px-2.5 py-0.5 rounded-lg font-black">
                            {communityCap} children
                          </span>
                        </div>
                        <input
                          type="range"
                          min={Math.max(50, totalEnrolled)}
                          max={Math.max(1000, totalEnrolled * 2.5)}
                          value={communityCap}
                          onChange={(e) => handleBaseFieldChange('targetCommunityPopulation', Number(e.target.value))}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                          <span>{Math.max(50, totalEnrolled)} (Total Enrolled)</span>
                          <span>{Math.round(Math.max(1000, totalEnrolled * 2.5))} (Community Ceiling)</span>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] font-bold text-slate-500">Official Grade-to-Age Alignment</span>
                          <span className="text-[10px] font-mono text-slate-400 font-bold">Standard MoE Constant</span>
                        </div>
                        <div className="flex items-baseline justify-between mt-1">
                          <p className="text-xl font-black text-indigo-600 font-mono">{(alignmentRatio * 100).toFixed(0)}%</p>
                          <p className="text-[10px] text-slate-500 font-medium">
                            {officialAgeEnrolled} of {totalEnrolled} students are estimated at correct textbook ages.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Indicators Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    
                    {/* INDICATOR 1: NET ENROLMENT RATIO */}
                    <div className="border border-slate-200/80 p-5 rounded-2xl bg-white flex flex-col justify-between space-y-4 hover:shadow-md transition">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-black uppercase text-slate-400 font-mono tracking-wider">Net Enrollment Ratio (NER)</span>
                          <p className="text-3xl font-black mt-1 text-slate-800 tracking-tight font-mono">{netEnrollmentRatio.toFixed(1)}%</p>
                        </div>
                        {/* Circle SVG Progress */}
                        <div className="relative w-12 h-12">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <path
                              className="text-slate-100"
                              strokeWidth="3.5"
                              stroke="currentColor"
                              fill="none"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            <path
                              className={
                                netEnrollmentRatio >= 90 
                                  ? 'text-emerald-500' 
                                  : netEnrollmentRatio >= 75 
                                  ? 'text-amber-500' 
                                  : 'text-rose-500'
                              }
                              strokeDasharray={`${netEnrollmentRatio}, 100`}
                              strokeWidth="3.5"
                              strokeLinecap="round"
                              stroke="currentColor"
                              fill="none"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center text-[9px] font-black font-mono text-slate-500">
                            NER
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black border uppercase tracking-wider ${
                          netEnrollmentRatio >= 90
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : netEnrollmentRatio >= 75
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {netEnrollmentRatio >= 90 ? 'Outstanding Access' : netEnrollmentRatio >= 75 ? 'Optimal Target Area' : 'Access Deficit Alert'}
                        </span>
                        <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                          Indicates community enrollment absorption. High ratios limit school dropout risks and boost community literacy.
                        </p>
                      </div>
                    </div>

                    {/* INDICATOR 2: PUPIL-TEACHER RATIO */}
                    <div className="border border-slate-200/80 p-5 rounded-2xl bg-white flex flex-col justify-between space-y-4 hover:shadow-md transition">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-black uppercase text-slate-400 font-mono tracking-wider">Pupil-Teacher Ratio (PTR)</span>
                          <p className="text-3xl font-black mt-1 text-slate-800 tracking-tight font-mono">
                            {ptr > 0 ? `${ptr.toFixed(1)}:1` : 'N/A'}
                          </p>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-mono text-center">
                          <span className="text-[9px] font-black text-slate-400 block uppercase">Teachers</span>
                          <span className="text-sm font-black text-slate-700">{totalTeachers}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${ptr > 0 && ptr <= 35 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                            style={{ width: `${Math.min(100, (ptr / 50) * 100)}%` }}
                          />
                        </div>
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black border uppercase tracking-wider ${
                          ptr > 0 && ptr <= 35
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : ptr === 0
                            ? 'bg-slate-100 text-slate-600 border-slate-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {ptr > 0 && ptr <= 30 ? 'Excellent' : ptr > 30 && ptr <= 35 ? 'GES Optimal Ceiling' : ptr === 0 ? 'Staffing Gap' : 'Overloaded Classroom'}
                        </span>
                        <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                          Ghana standard benchmark ceiling targets &le; 35 children per teacher. Low ratios promote enhanced attention.
                        </p>
                      </div>
                    </div>

                    {/* INDICATOR 3: GENDER PARITY INDEX */}
                    <div className="border border-slate-200/80 p-5 rounded-2xl bg-white flex flex-col justify-between space-y-4 hover:shadow-md transition">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-black uppercase text-slate-400 font-mono tracking-wider">Gender Parity Index (GPI)</span>
                          <p className="text-3xl font-black mt-1 text-slate-800 tracking-tight font-mono">{genderParityIndex.toFixed(2)}</p>
                        </div>
                        <div className="flex gap-1.5 text-[9px] font-mono text-center">
                          <div className="bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">
                            <span className="font-bold text-slate-400 block">Boys</span>
                            <span className="font-extrabold text-slate-700">{totalBoys}</span>
                          </div>
                          <div className="bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">
                            <span className="font-bold text-slate-400 block">Girls</span>
                            <span className="font-extrabold text-slate-700">{totalGirls}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {/* Parity Slider visualization */}
                        <div className="relative pt-1">
                          <div className="h-1.5 w-full bg-slate-150 rounded-full relative">
                            {/* Midpoint mark (1.00) */}
                            <div className="absolute left-1/2 -ml-0.5 w-1 h-3 bg-slate-400 -top-[3px]" />
                            {/* Marker */}
                            <div 
                              className={`absolute -mt-[3px] -ml-1.5 w-3.5 h-3.5 rounded-full border border-white shadow ${
                                genderParityIndex >= 0.95 && genderParityIndex <= 1.05
                                  ? 'bg-emerald-500'
                                  : 'bg-amber-500'
                              }`} 
                              style={{ left: `${Math.min(95, Math.max(5, (genderParityIndex / 2.0) * 100))}%` }} 
                            />
                          </div>
                          <div className="flex justify-between text-[8px] text-slate-400 font-mono pt-1">
                            <span>0.5 M-Skew</span>
                            <span className="font-black text-slate-500">1.00 Equal</span>
                            <span>1.5 F-Skew</span>
                          </div>
                        </div>

                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black border uppercase tracking-wider ${
                          genderParityIndex >= 0.95 && genderParityIndex <= 1.05
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {genderParityIndex >= 0.95 && genderParityIndex <= 1.05 ? 'Optimal Equality' : 'Parity Imbalance'}
                        </span>
                        <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                          Measures relative female representation (MoE target: 0.96-1.04). Balanced communities ensure equitable opportunities.
                        </p>
                      </div>
                    </div>

                  </div>

                  {/* Secondary Row indicators */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="border p-4 rounded-xl bg-slate-50/50 flex flex-col justify-between">
                      <span className="text-[10px] font-black uppercase text-slate-400 font-mono">Trained Teacher Ratio</span>
                      <p className="text-2xl font-black mt-1 text-slate-800 font-mono">{trainedStaffRatio.toFixed(1)}%</p>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed font-medium">
                        Professional educators holding Cert-A / B.Ed.
                      </p>
                    </div>

                    <div className="border p-4 rounded-xl bg-slate-50/50 flex flex-col justify-between">
                      <span className="text-[10px] font-black uppercase text-slate-400 font-mono">Pupil-Classroom Ratio (PCR)</span>
                      <p className="text-2xl font-black mt-1 text-slate-800 font-mono">
                        {pupilClassroomRatio > 0 ? `${pupilClassroomRatio.toFixed(1)}:1` : 'N/A'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed font-medium">
                        National MoE capacity benchmark limit: &le; 40.
                      </p>
                    </div>

                    <div className="border p-4 rounded-xl bg-slate-50/50 flex flex-col justify-between">
                      <span className="text-[10px] font-black uppercase text-slate-400 font-mono">Core Textbook Index</span>
                      <p className="text-2xl font-black mt-1 text-emerald-700 font-mono">
                        {totalEnrolled > 0 ? Math.round(((report.englishTextbooks + report.mathTextbooks + report.scienceTextbooks + report.socialStudiesTextbooks) / (totalEnrolled * 4)) * 100) : 0}%
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed font-medium">
                        Percentage of core textbooks available per student.
                      </p>
                    </div>
                  </div>

                  {/* Interactive Charts Dashboard Block */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch no-print">
                    
                    {/* Enrollment Demographics Double Bar Chart */}
                    <div className="lg:col-span-8 border border-slate-200/80 rounded-2xl p-5 bg-white space-y-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">Enrollment Balance by Class Grade</h4>
                          <p className="text-[10px] text-slate-400 font-medium">Compares boys vs girls registered logs class by class</p>
                        </div>
                        <div className="flex gap-3 text-[10px] font-bold">
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-gray-500 rounded-sm" /> Boys</span>
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" /> Girls</span>
                        </div>
                      </div>

                      {totalEnrolled > 0 ? (
                        <div className="w-full h-64">
                          <ResponsiveContainer width="100%" height="100%" aspect={1.8}>
                            <BarChart data={chartData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                              <XAxis dataKey="name" fontSize={10} tickLine={false} stroke="#64748B" />
                              <YAxis fontSize={10} tickLine={false} stroke="#64748B" />
                              <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', padding: '8px', fontSize: '11px', fontFamily: 'Sans-Serif' }} 
                                cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                              />
                              <Bar dataKey="Boys" fill="#64748B" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="Girls" fill="#10B981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-64 flex flex-col justify-center items-center text-center bg-slate-50 border border-dashed rounded-xl p-5">
                          <Users size={28} className="text-slate-300" />
                          <h5 className="font-bold text-xs text-slate-500 mt-2">No Students Enrolled</h5>
                          <p className="text-[10px] text-slate-400 mt-1 max-w-xs">Use the "GES Class Enrolment" tab to register students or click "Auto-Aggregate Registers".</p>
                        </div>
                      )}
                    </div>

                    {/* Teacher Professional Density Pie / Breakdown */}
                    <div className="lg:col-span-4 border border-slate-200/80 rounded-2xl p-5 bg-white flex flex-col justify-between space-y-4">
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">Teaching Staff Composition</h4>
                        <p className="text-[10px] text-slate-400 font-medium font-sans">Professional certificate density breakdown</p>
                      </div>

                      {hasStaffData ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-2">
                          <div className="w-full h-32 relative flex justify-center items-center">
                            <ResponsiveContainer width="100%" height="100%" aspect={1.5}>
                              <PieChart>
                                <Pie
                                  data={staffData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={35}
                                  outerRadius={55}
                                  paddingAngle={3}
                                  dataKey="value"
                                >
                                  {staffData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(value) => [`${value} Teachers`]} />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-lg font-black text-slate-800">{totalTeachers}</span>
                              <span className="text-[9px] uppercase font-bold text-slate-400">Total staff</span>
                            </div>
                          </div>

                          <div className="w-full grid grid-cols-2 gap-2 mt-2 font-sans">
                            {staffData.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 border border-slate-100 rounded-lg p-1.5">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                                <div className="leading-none">
                                  <span className="text-[9px] font-bold text-slate-500 block leading-none">{item.name}</span>
                                  <span className="text-[10px] font-black text-slate-800 leading-none">{item.value}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col justify-center items-center text-center bg-slate-50 border border-dashed rounded-xl p-5 py-8">
                          <UsersRound size={28} className="text-slate-300" />
                          <h5 className="font-bold text-xs text-slate-500 mt-2">No Teachers Registered</h5>
                          <p className="text-[10px] text-slate-400 mt-1">Configure staff records in the "Staffing Profiles" tab to assess ratios.</p>
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Strategic Enrollment Action Planner (Simulation) */}
                  <div className="border border-indigo-200 bg-indigo-50/40 rounded-2xl p-5 space-y-3 no-print">
                    <div className="flex items-center gap-2">
                      <Award size={16} className="text-indigo-600" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                        MoE Policy & Community Outreach Target Simulator
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      This analyzer calculates enrollment and parity targets to help the school design localized community outreach drives and align with Ghana Ministry Universal Primary Education targets:
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                      <div className="bg-white border rounded-xl p-3 flex flex-col justify-between">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Universal Access Goal (95% NER)</span>
                        <div className="mt-2">
                          {outreachRequired > 0 ? (
                            <div>
                              <p className="text-lg font-black text-amber-600 font-mono">+{outreachRequired} Pupils</p>
                              <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">Must be out-of-school community children enrolled to hit MoE compliance.</p>
                            </div>
                          ) : (
                            <div>
                              <p className="text-lg font-black text-emerald-600">Goal Achieved!</p>
                              <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">The school's enrollment absorption exceeds 95% of estimated locals.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="bg-white border rounded-xl p-3 flex flex-col justify-between">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Targeting Equal Boys Intake</span>
                        <div className="mt-2">
                          {extraBoysRequired > 0 ? (
                            <div>
                              <p className="text-lg font-black text-indigo-600 font-mono">+{extraBoysRequired} Boys Enrolment</p>
                              <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">Additional boys required to balance the female bias (GPI: {genderParityIndex.toFixed(2)}).</p>
                            </div>
                          ) : (
                            <div>
                              <p className="text-lg font-black text-slate-600">Balanced or Female Bias</p>
                              <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">Boys represent a healthy proportion of the student census.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="bg-white border rounded-xl p-3 flex flex-col justify-between">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Targeting Equal Girls Intake</span>
                        <div className="mt-2">
                          {extraGirlsRequired > 0 ? (
                            <div>
                              <p className="text-lg font-black text-indigo-600 font-mono">+{extraGirlsRequired} Girls Enrolment</p>
                              <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">Additional girls required to balance the male bias (GPI: {genderParityIndex.toFixed(2)}).</p>
                            </div>
                          ) : (
                            <div>
                              <p className="text-lg font-black text-slate-600">Balanced or Boys Bias</p>
                              <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">Girls represent a healthy proportion of the student census.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              );
            })()}

            {/* SAVE CONTROLS AREA */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
              <span className="text-[10px] text-slate-400 font-mono font-bold uppercase no-print">
                Last modified: {new Date(report.updatedAt).toLocaleDateString()} at {new Date(report.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>

              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-5 py-2.5 rounded-xl flex items-center gap-1.5 tracking-wide shadow-sm active:translate-y-0.5 transition cursor-pointer no-print ml-auto"
              >
                <Save size={13} />
                Save EMIS Return
              </button>
            </div>
          </form>
        </div>
      </div>      {/* ---------------------------------------------------------------------- */}
      {/* CENSUS return print template layout - HIDDEN BY DEFAULT EXCEPT FOR PRINTING */}
      {/* ---------------------------------------------------------------------- */}
      <div id="emis-census-print-area" className="hidden print:block bg-white text-slate-900 border border-slate-950 p-8 space-y-5 w-full mx-auto text-xs leading-normal font-sans relative">
        <div className="absolute inset-0 z-0 pointer-events-none" dangerouslySetInnerHTML={{ __html: getWatermarkHtml(schoolInfo?.crestUrl) }} />
        
        {/* LOGO AND PRINT TITLE CORES */}
        <div className="flex items-center justify-between border-b-2 border-double border-slate-900 pb-3 relative z-10">
          <div className="text-slate-950 flex items-center gap-3">
            <div className="border-2 border-slate-950 p-1 rounded-sm bg-slate-50">
              <Building size={34} className="text-slate-900" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-wider uppercase leading-none">Ghana Education Service</h1>
              <p className="text-[8.5px] font-black uppercase font-mono text-slate-500 mt-0.5">Ministry of Education / Director-General's Inspectorate Division</p>
              <h2 className="text-sm font-black text-indigo-900 uppercase mt-1">
                {schoolInfo.name ? schoolInfo.name : 'EMIS REGISTERED EDUCATIONAL STATION'}
              </h2>
              {schoolInfo.motto && (
                <p className="text-[9px] italic text-slate-500">Motto: "{schoolInfo.motto}"</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <span className="border border-slate-950 uppercase px-2.5 py-1 font-mono font-black text-[10px] bg-slate-50">OFFICIAL EMIS CENSUS</span>
            <p className="text-[9px] font-extrabold text-slate-700 mt-1.5 font-mono">Return Term: {currentCalendar?.activeTerm || 'Term 1'} | Year: {report.academicYear}</p>
          </div>
        </div>

        {/* CENSUS METADATA REGISTER LINKED FROM SCHOOL PROFILE */}
        <div className="grid grid-cols-2 gap-4 border border-slate-950 bg-slate-50/50 p-3 rounded-sm font-medium">
          <div>
            <h4 className="text-[9px] font-black uppercase text-indigo-900 mb-1 border-b border-indigo-150 pb-0.5 font-mono">I. School Governance Profile</h4>
            <p className="leading-relaxed"><span className="font-extrabold uppercase text-[8px] text-slate-500 font-mono">Official EMIS Code:</span> <span className="font-black text-slate-900">{schoolInfo.emisCode || report.emisCode || 'UNASSIGNED'}</span></p>
            <p className="mt-1 leading-relaxed"><span className="font-extrabold uppercase text-[8px] text-slate-500 font-mono">GES Circuit Name:</span> {schoolInfo.circuit || report.circuitName || 'N/A'}</p>
            <p className="mt-1 leading-relaxed"><span className="font-extrabold uppercase text-[8px] text-slate-500 font-mono">District/Municipality:</span> {schoolInfo.district || report.districtName || 'N/A'}</p>
            <p className="mt-1 leading-relaxed"><span className="font-extrabold uppercase text-[8px] text-slate-500 font-mono">Region Area:</span> {report.regionName} Region</p>
          </div>
          <div>
            <h4 className="text-[9px] font-black uppercase text-indigo-900 mb-1 border-b border-indigo-150 pb-0.5 font-mono font-sans">II. Headship and Registrations</h4>
            <p className="leading-relaxed"><span className="font-extrabold uppercase text-[8px] text-slate-500 font-mono">Registered Headteacher:</span> <span className="font-bold text-slate-900">{schoolInfo.headteacherName || 'Not Appointed / Set'}</span></p>
            <p className="mt-1 leading-relaxed"><span className="font-extrabold uppercase text-[8px] text-slate-500 font-mono">Credentials / Qualifications:</span> {schoolInfo.highestAcademicQualifications || schoolInfo.qualifications || 'N/A'}</p>
            <p className="mt-1 leading-relaxed"><span className="font-extrabold uppercase text-[8px] text-slate-500 font-mono">Contact Details:</span> {schoolInfo.telephone || 'N/A'} {schoolInfo.email ? `| ${schoolInfo.email}` : ''}</p>
            <p className="mt-1 leading-relaxed"><span className="font-extrabold uppercase text-[8px] text-slate-500 font-mono">GPS Digital Address:</span> {schoolInfo.gpsAddress || 'N/A'}</p>
          </div>
        </div>

        {/* PRINT DASHBOARD CARD INDICATORS */}
        <div className="space-y-1.5">
          <h3 className="text-[10px] font-black uppercase text-slate-950 tracking-wider">I. National Strategic Policy Indicator Scorecard</h3>
          <p className="text-[9px] text-slate-500 italic mt-0">Assessment scores and criteria calculated against the Ministry of Education standards for the {report.academicYear} academic year.</p>
          
          <div className="grid grid-cols-3 gap-2.5">
            <div className="border border-slate-950 p-2 text-center bg-slate-50/20">
              <p className="font-extrabold uppercase text-[8px] text-slate-500 tracking-wider font-mono">Net Enrolment Ratio (NER)</p>
              <div className="mt-1">
                <span className="text-base font-black text-slate-900">{netEnrollmentRatio.toFixed(1)}%</span>
                <span className="block text-[8px] font-black mt-0.5 px-1 py-0.2 rounded-sm border border-slate-950 bg-white inline-block">
                  {netEnrollmentRatio >= 95 ? 'Outstanding Universal Access' : netEnrollmentRatio >= 85 ? 'Highly Satisfactory' : 'Target deficit'}
                </span>
              </div>
              <p className="text-[8px] text-slate-500 mt-1 border-t border-slate-200 pt-0.5 leading-tight">MoE National Target is &gt;= 95% of estimated catchment area ({communityCap} pupils)</p>
            </div>

            <div className="border border-slate-950 p-2 text-center bg-slate-50/20">
              <p className="font-extrabold uppercase text-[8px] text-slate-500 tracking-wider font-mono">Gender Parity Index (GPI)</p>
              <div className="mt-1">
                <span className="text-base font-black text-slate-900">{genderParityIndex.toFixed(2)}</span>
                <span className="block text-[8px] font-black mt-0.5 px-1 py-0.2 rounded-sm border border-slate-950 bg-white inline-block">
                  {genderParityIndex >= 0.96 && genderParityIndex <= 1.04 ? 'Perfect Parity' : 'Gender Disparity Alert'}
                </span>
              </div>
              <p className="text-[8px] text-slate-500 mt-1 border-t border-slate-200 pt-0.5 leading-tight">Target: 1.00 (Equality). Current ratio shows {totalGirls} girls against {totalBoys} boys.</p>
            </div>

            <div className="border border-slate-950 p-2 text-center bg-slate-50/20">
              <p className="font-extrabold uppercase text-[8px] text-slate-500 tracking-wider font-mono">Pupil-Teacher Ratio (PTR)</p>
              <div className="mt-1">
                <span className="text-base font-black text-slate-900">{ptr > 0 ? `${ptr.toFixed(1)}:1` : 'N/A'}</span>
                <span className="block text-[8px] font-black mt-0.5 px-1 py-0.2 rounded-sm border border-slate-950 bg-white inline-block">
                  {ptr > 0 && ptr <= 35 ? 'Standard Compliant' : 'Atypical Ratios'}
                </span>
              </div>
              <p className="text-[8px] text-slate-500 mt-1 border-t border-slate-200 pt-0.5 leading-tight">National basic cap is 35 pupils per teacher ({totalTeachers} teachers registered).</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 mt-2">
            <div className="border border-slate-900 p-2 text-center bg-slate-50/20">
              <p className="font-extrabold uppercase text-[8px] text-slate-500 tracking-wider font-mono">Trained Teacher Ratio</p>
              <div className="text-xs font-bold text-slate-800 mt-1">
                <span className="text-sm font-black text-slate-900">{trainedStaffRatio.toFixed(1)}%</span>
                <span className="block text-[8px] text-slate-500 leading-none mt-0.5">{totalTrained} trained / {totalTeachers} total staff</span>
              </div>
            </div>

            <div className="border border-slate-900 p-2 text-center bg-slate-50/20">
              <p className="font-extrabold uppercase text-[8px] text-slate-500 tracking-wider font-mono">Pupil-Classroom Ratio (PCR)</p>
              <div className="text-xs font-bold text-slate-800 mt-1">
                <span className="text-sm font-black text-slate-900">{pupilClassroomRatio > 0 ? `${pupilClassroomRatio.toFixed(1)}:1` : 'N/A'}</span>
                <span className="block text-[8px] text-slate-500 leading-none mt-0.5">{totalClassrooms} physical classroom blocks</span>
              </div>
            </div>

            <div className="border border-slate-900 p-2 text-center bg-slate-50/20">
              <p className="font-extrabold uppercase text-[8px] text-slate-500 tracking-wider font-mono">Core Textbook Index</p>
              <div className="text-xs font-bold text-slate-800 mt-1">
                <span className="text-sm font-black text-slate-900">
                  {(() => {
                    const totalBooks = report.englishTextbooks + report.mathTextbooks + report.scienceTextbooks + report.socialStudiesTextbooks;
                    return totalEnrolled > 0 ? Math.round((totalBooks / (totalEnrolled * 4)) * 100) : 0;
                  })()}%
                </span>
                <span className="block text-[8px] text-slate-500 leading-none mt-0.5">Average book availability index</span>
              </div>
            </div>
          </div>
        </div>

        {/* DATABASE INTEGRITY CHECKER */}
        <div className="space-y-1.5 border border-slate-950 p-2.5 rounded-sm bg-slate-50">
          <h4 className="text-[9px] font-black uppercase text-indigo-950 tracking-wider font-mono">II. Live Database Cross-Reference Audit Log</h4>
          <div className="grid grid-cols-2 gap-4 text-[9.5px]">
            <div>
              <p className="font-bold text-slate-800">Student Profile Registry Synchronization:</p>
              <div className="flex items-center gap-2 mt-0.5">
                <div className={`w-2 h-2 rounded-full ${totalEnrolled === activeStudents.length ? 'bg-emerald-600' : 'bg-amber-500'}`} />
                <span className="font-semibold text-slate-700">
                  CENSUS Return enrollees: <strong className="text-slate-900 font-mono font-black">{totalEnrolled}</strong> | Live student database count: <strong className="text-slate-900 font-mono font-black">{activeStudents.length}</strong>
                </span>
              </div>
              <p className="text-[8px] text-slate-500 mt-0.5">
                {totalEnrolled === activeStudents.length 
                  ? '✅ Census is completely in sync with individual Student Profiles.' 
                  : '⚠️ Difference detected. Student registry records might have been modified since last census aggregation.'}
              </p>
            </div>
            <div>
              <p className="font-bold text-slate-800">Teacher Profile Roster Synchronization:</p>
              <div className="flex items-center gap-2 mt-0.5">
                <div className={`w-2 h-2 rounded-full ${totalTeachers === activeTeachers.length ? 'bg-emerald-600' : 'bg-amber-500'}`} />
                <span className="font-semibold text-slate-700">
                  CENSUS Return staff: <strong className="text-slate-900 font-mono font-black">{totalTeachers}</strong> | Live staff database count: <strong className="text-slate-900 font-mono font-black">{activeTeachers.length}</strong>
                </span>
              </div>
              <p className="text-[8px] text-slate-500 mt-0.5">
                {totalTeachers === activeTeachers.length 
                  ? '✅ Census staffing counts are 100% in sync with registered Staff Profiles.' 
                  : '⚠️ Roster difference detected. Staff data has changed or was edited manually.'}
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 2: PHYSICAL REGISTER ENROLMENT */}
        <div className="space-y-1.5">
          <h3 className="text-[10px] font-black uppercase text-slate-950 tracking-wider">III. Enrolment Matrix & Specific Class Breakdown</h3>
          <table className="w-full text-center border-collapse border border-slate-950 text-[9px]">
            <thead>
              <tr className="bg-slate-100 font-extrabold border-b border-slate-950">
                <th className="border border-slate-950 p-1 text-left font-sans">Class / Form Name</th>
                <th className="border border-slate-950 p-1 font-mono">Boys</th>
                <th className="border border-slate-950 p-1 font-mono">Girls</th>
                <th className="border border-slate-950 p-1 font-mono font-black">Total Enrolled</th>
                <th className="border border-slate-950 p-1 font-mono">Repeaters (M)</th>
                <th className="border border-slate-950 p-1 font-mono">Repeaters (F)</th>
                <th className="border border-slate-950 p-1 font-mono">SEN Pupils (M)</th>
                <th className="border border-slate-950 p-1 font-mono">SEN Pupils (F)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              {CLASSES.map(cls => (
                <tr key={cls}>
                  <td className="border border-slate-900 p-0.5 text-left font-bold font-mono text-[9px]">{cls}</td>
                  <td className="border border-slate-900 p-0.5 font-mono">{report.boysEnrolled[cls] || 0}</td>
                  <td className="border border-slate-900 p-0.5 font-mono">{report.girlsEnrolled[cls] || 0}</td>
                  <td className="border border-slate-900 p-0.5 font-black font-mono bg-slate-50/20">{(report.boysEnrolled[cls] || 0) + (report.girlsEnrolled[cls] || 0)}</td>
                  <td className="border border-slate-900 p-0.5 font-mono">{report.repeatersBoys[cls] || 0}</td>
                  <td className="border border-slate-900 p-0.5 font-mono">{report.repeatersGirls[cls] || 0}</td>
                  <td className="border border-slate-900 p-0.5 font-mono">{report.disabledBoys[cls] || 0}</td>
                  <td className="border border-slate-900 p-0.5 font-mono">{report.disabledGirls[cls] || 0}</td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-black border-t-2 border-slate-950">
                <td className="border border-slate-950 p-1 text-left uppercase text-[9px]">TOTAL REGISTERED</td>
                <td className="border border-slate-950 p-1 font-mono text-[9.5px]">{totalBoys}</td>
                <td className="border border-slate-950 p-1 font-mono text-[9.5px]">{totalGirls}</td>
                <td className="border border-slate-950 p-1 font-mono text-[10px] font-black bg-slate-200/50">{totalEnrolled}</td>
                <td className="border border-slate-950 p-1 font-mono text-[9.5px]">{totalRepeatersBoys}</td>
                <td className="border border-slate-955 p-1 font-mono text-[9.5px]">{totalRepeatersGirls}</td>
                <td className="border border-slate-950 p-1 font-mono text-[9.5px]">{totalDisabledBoys}</td>
                <td className="border border-slate-950 p-1 font-mono text-[9.5px]">{totalDisabledGirls}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* SECTION 2B: GES ENROLMENT BY AGE DEMOGRAPHICS */}
        <div className="space-y-1.5" style={{ pageBreakInside: 'avoid', marginTop: '15px' }}>
          <h3 className="text-[10px] font-black uppercase text-slate-950 tracking-wider">III-B. National Education Census - Class Enrolment Matrix by Age Group</h3>
          <p className="text-[8px] text-slate-500 italic mt-0">Required Ministry of Education age-grade distribution statistics based on registered student profile birthdates.</p>
          <table className="w-full text-center border-collapse border border-slate-950 text-[8px] font-mono">
            <thead>
              <tr className="bg-slate-100 font-extrabold border-b border-slate-950 text-[7.5px]">
                <th className="border border-slate-950 p-1 text-left font-sans min-w-[95px]">Class / Form</th>
                {ageKeys.map(ageKey => (
                  <th key={ageKey} className="border border-slate-950 p-0.5">Age {ageKey}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              {CLASSES.map(cls => (
                <tr key={cls}>
                  <td className="border border-slate-900 p-1 text-left font-bold font-sans">{cls}</td>
                  {ageKeys.map(ageKey => {
                    const cell = ageEnrollmentMatrix[cls]?.[ageKey];
                    const cellTotal = (cell?.boys || 0) + (cell?.girls || 0);
                    return (
                      <td key={ageKey} className="border border-slate-900 p-0.5">
                        {cellTotal > 0 ? (
                          <div className="flex flex-col items-center justify-center leading-tight">
                            <span className="font-bold text-slate-900">{cellTotal}</span>
                            <span className="text-[6.5px] text-slate-500 font-sans">({cell.boys}b/{cell.girls}g)</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-light">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="bg-slate-100 font-black border-t-2 border-slate-950 text-[8px]">
                <td className="border border-slate-950 p-1 text-left uppercase font-sans">AGE GROUP TOTAL</td>
                {ageKeys.map(ageKey => {
                  const b = ageGroupTotals[ageKey]?.boys || 0;
                  const g = ageGroupTotals[ageKey]?.girls || 0;
                  const tot = b + g;
                  return (
                    <td key={ageKey} className="border border-slate-950 p-1">
                      <div className="flex flex-col items-center justify-center leading-tight">
                        <span className="font-black text-indigo-950">{tot}</span>
                        <span className="text-[6.5px] text-indigo-800 font-sans font-bold">({b}b/{g}g)</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        {/* SECTION 3: STAFF PROFESSIONAL INVENTORY */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <h3 className="text-[10px] font-black uppercase text-slate-950 tracking-wider">IV. Sourced Teacher Classification</h3>
            <table className="w-full text-center border-collapse border border-slate-950 text-[8.5px]">
              <thead>
                <tr className="bg-slate-100 font-extrabold border-b border-slate-950">
                  <th className="border border-slate-950 p-1 text-left">GES Category Classification</th>
                  <th className="border border-slate-950 p-1">Male</th>
                  <th className="border border-slate-950 p-1">Female</th>
                  <th className="border border-slate-950 p-1 font-black">Combined</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-900 p-0.5 text-left font-semibold">Trained Professional (Cert/Dip/B.Ed)</td>
                  <td className="border border-slate-900 p-0.5 font-mono">{report.trainedMaleTeachers}</td>
                  <td className="border border-slate-900 p-0.5 font-mono">{report.trainedFemaleTeachers}</td>
                  <td className="border border-slate-900 p-0.5 font-bold font-mono bg-slate-50/20">{report.trainedMaleTeachers + report.trainedFemaleTeachers}</td>
                </tr>
                <tr>
                  <td className="border border-slate-900 p-0.5 text-left font-semibold">Untrained / Pupil / Volunteer staff</td>
                  <td className="border border-slate-900 p-0.5 font-mono">{report.untrainedMaleTeachers}</td>
                  <td className="border border-slate-900 p-0.5 font-mono">{report.untrainedFemaleTeachers}</td>
                  <td className="border border-slate-900 p-0.5 font-bold font-mono bg-slate-50/20">{report.untrainedMaleTeachers + report.untrainedFemaleTeachers}</td>
                </tr>
                <tr>
                  <td className="border border-slate-900 p-0.5 text-left font-semibold">Non-Teaching Administrative Support</td>
                  <td className="border border-slate-900 p-0.5 font-mono">{report.nonTeachingMaleStaff}</td>
                  <td className="border border-slate-900 p-0.5 font-mono">{report.nonTeachingFemaleStaff}</td>
                  <td className="border border-slate-900 p-0.5 font-bold font-mono bg-slate-50/20">{report.nonTeachingMaleStaff + report.nonTeachingFemaleStaff}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-1">
            <h3 className="text-[10px] font-black uppercase text-slate-950 tracking-wider">V. Infrastructure, Logistics & Auxiliaries</h3>
            <div className="border border-slate-950 p-2 text-[8.5px] space-y-1 leading-normal bg-slate-50/30">
              <p>• <strong>Demographics & Foundations:</strong> Location Style: <strong className="text-slate-900">{report.locationType || 'Urban'}</strong> | Est. Year: <strong className="font-mono text-[9px]">{report.yearFounded || 2004}</strong> | GSFP Feeding Beneficiary: <strong className="text-slate-900">{report.isSchoolFeedingBeneficiary ? `Yes (${report.studentsFedDailyCount} fed daily)` : 'No'}</strong></p>
              <p>• <strong>Classroom Stockpile:</strong> Perm: <strong className="font-mono text-[9px]">{report.permanentClassrooms}</strong> blocks | Temp: <strong className="font-mono text-[9px]">{report.temporaryClassrooms}</strong> blocks | Under Tree: <strong className="font-mono text-[9px]">{report.classroomsUnderTrees}</strong> sites</p>
              <p>• <strong>Sanitation & WASH:</strong> Toilet Type: <strong className="text-slate-900">{report.toiletType}</strong> ({report.toiletBoothsBoys} Boys / {report.toiletBoothsGirls} Girls booths) | Staff toilets separate: <strong className="text-slate-900">{report.hasSeparateStaffToilets ? 'Yes' : 'No'}</strong> | Handwashing stations: <strong className="text-slate-900">{report.hasHandwashingStations ? 'Yes' : 'No'}</strong> | Drinking Water: <strong className="text-slate-900">{report.drinkingWaterSource}</strong></p>
              <p>• <strong>Safety & Perimeter:</strong> Protected Fencing: <strong className="text-slate-900">{report.isCompoundFenced ? 'Yes' : 'No'}</strong> | Assigned Patrol Watchmen: <strong className="text-slate-900">{report.hasSecurityGuard ? 'Yes' : 'No'}</strong> | Medical Sick Bay: <strong className="text-slate-900">{report.hasFunctionalSickBay ? 'Yes' : 'No'}</strong></p>
              <p>• <strong>Utilities & ICT Support:</strong> Electricity grid: <strong className="text-slate-900">{report.electricitySource}</strong> | Has functional ICT Lab: <strong className="text-slate-950">{report.hasFunctionalIctLab ? 'Yes' : 'No'}</strong> ({report.totalWorkingComputers} computers)</p>
              <p>• <strong>Gov Issued Textbooks:</strong> English: <strong className="font-mono text-[9px]">{report.englishTextbooks}</strong> | Math: <strong className="font-mono text-[9px]">{report.mathTextbooks}</strong> | Science: <strong className="font-mono text-[9px]">{report.scienceTextbooks}</strong> | Social: <strong className="font-mono text-[9px]">{report.socialStudiesTextbooks}</strong> books</p>
              <p>• <strong>Learning Centers & Kits:</strong> School Library: <strong className="text-slate-900">{report.hasFunctionalLibrary ? `Yes (${report.totalLibraryBooks} books logged)` : 'No'}</strong> | MoE Science Lab Kit on-site: <strong className="text-slate-900">{report.hasScienceKit ? 'Yes' : 'No'}</strong></p>
              <p>• <strong>Social Governance & SMC Board:</strong> PTA Board: <strong className="text-slate-900">{report.hasActivePta ? `Active (${report.ptaMeetingsHeldCount} meetings held)` : 'Inactive'}</strong> | School Management Committee (SMC): <strong className="text-slate-900">{report.hasActiveSmc ? 'Active' : 'Inactive'}</strong></p>
              <p>• <strong>Inclusive Support, Sports & Lang:</strong> Special Needs: <strong className="text-slate-900">{report.hasSpecialNeedsFacilities ? `Yes (${report.specialNeedsPupilsCount || 0} pupils)` : 'No'}</strong> | Guidance Counselling: <strong className="text-slate-900">{report.hasGuidanceCounsellor ? 'Active / Assigned' : 'None'}</strong> | Recreational Spaces: <strong className="text-slate-900">{report.hasRecreationalFacilities ? 'Available' : 'None'}</strong> | Ghanaian Lang: <strong className="text-slate-900">{report.ghanaianLanguageTaught || 'None'}</strong> | Internet Sourcing: <strong className="text-slate-900">{report.hasInternetAccess ? 'Yes / Active' : 'No'}</strong></p>
            </div>
          </div>
        </div>

        {/* SECTION 4: DETAILED ACTIVE STAFF REGISTER FROM TEACHER PROFILE TAB */}
        {activeTeachers && activeTeachers.length > 0 && (
          <div className="space-y-1.5 pt-1 break-inside-avoid">
            <h3 className="text-[10px] font-black uppercase text-slate-950 tracking-wider">VI. National Teacher Roster Registry Audit (Linked Roster Profiles)</h3>
            <p className="text-[8.5px] text-slate-500 italic mt-0">Detailed list of currently appointed, registered teachers linked dynamically from the active staffing database.</p>
            <table className="w-full text-center border-collapse border border-slate-950 text-[8.5px]">
              <thead>
                <tr className="bg-slate-100 font-extrabold border-b border-slate-950">
                  <th className="border border-slate-950 p-1 text-left">Staff Name</th>
                  <th className="border border-slate-950 p-1 font-mono">Staff ID</th>
                  <th className="border border-slate-950 p-1 font-mono">NTC License</th>
                  <th className="border border-slate-950 p-1">Gender</th>
                  <th className="border border-slate-950 p-1 text-left">Professional Rank</th>
                  <th className="border border-slate-950 p-1 text-left">Academic & Professional Sourcing</th>
                </tr>
              </thead>
              <tbody>
                {activeTeachers.map((teacher, index) => {
                  const fullName = `${teacher.firstName} ${teacher.middleName ? teacher.middleName + ' ' : ''}${teacher.lastName}`;
                  return (
                    <tr key={teacher.id || index}>
                      <td className="border border-slate-900 p-1 text-left font-bold">{fullName}</td>
                      <td className="border border-slate-900 p-1 font-mono">{teacher.staffId || 'Unregistered'}</td>
                      <td className="border border-slate-900 p-1 font-mono">{teacher.ntcNumber || 'N/A'}</td>
                      <td className="border border-slate-900 p-1">{teacher.gender}</td>
                      <td className="border border-slate-900 p-1 text-left font-sans text-[8px]">{teacher.rank || 'N/A'}</td>
                      <td className="border border-slate-900 p-1 text-left font-mono text-[7.5px] leading-tight">
                        Acd: {teacher.highestAcademicQualifications || 'N/A'}<br />
                        Prof: {teacher.professionalQualifications || 'Unqualified'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* SIGNATURE FIELDS AND STAMP PADS */}
        <div className="pt-8 flex items-center justify-between gap-12 font-bold font-mono break-inside-avoid">
          <div className="text-center w-60">
            <div className="border-b border-slate-950 h-8" />
            <p className="text-[9px] uppercase tracking-wide text-slate-800 mt-1 font-black">
              {schoolInfo.headteacherName ? schoolInfo.headteacherName : 'Headteacher Declarant'}
            </p>
            <p className="text-[8px] font-bold text-slate-500">Signature & Official Stamp</p>
            <p className="text-[8px] font-normal text-slate-400">Date: ____/____/2026</p>
          </div>
          
          <div className="border-2 border-slate-400 border-dashed w-28 h-16 flex items-center justify-center rounded-sm bg-slate-50/50">
            <span className="text-[7.5px] uppercase font-black tracking-widest text-slate-400 font-mono text-center px-1">GES DISTRICT OFFICIAL RECORD STAMP</span>
          </div>

          <div className="text-center w-60">
            <div className="border-b border-slate-950 h-8" />
            <p className="text-[9px] uppercase tracking-wide text-slate-800 mt-1 font-black">GES Circuit Inspector / Supervisor</p>
            <p className="text-[8px] font-bold text-slate-500">Supervisory Sign-Off</p>
            <p className="text-[8px] font-normal text-slate-400">Date: ____/____/2026</p>
          </div>
        </div>
      </div>
    </div>
  );
}
