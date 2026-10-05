export interface SchoolInfo {
  id: string;
  name: string;
  motto: string;
  logoUrl: string;
  schoolNumber: string;
  emisCode: string;
  gpsAddress: string;
  schoolType: 'Public' | 'Private';
  headteacherName: string;
  telephone: string;
  email: string;
  qualifications: string;
  highestAcademicQualifications: string;
  district: string;
  circuit: string;
  reopeningDate?: string;
  signatureUrl?: string;
  stampUrl?: string;
  paystackPublicKey?: string;
  paystackSecretKey?: string;
  paystackMode?: 'test' | 'live';
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromNumber?: string;
  twilioEnabled?: boolean;
  smsBalance?: number;
  smsSenderId?: string;
  licensePrice1Year?: number;
  licensePrice2Year?: number;
  licensePrice3Year?: number;
  licensePrice5Year?: number;
  smsRate?: number;
  crestUrl?: string;
  schoolId?: string;
  assignedTeacherId?: string;
}

export type ClassType =
  | 'Creche'
  | 'Nursery 1'
  | 'Nursery 2'
  | 'KG. 1'
  | 'KG. 2'
  | 'Basic 1'
  | 'Basic 2'
  | 'Basic 3'
  | 'Basic 4'
  | 'Basic 5'
  | 'Basic 6'
  | 'Basic 7'
  | 'Basic 8'
  | 'Basic 9';

export const CLASSES: ClassType[] = [
  'Creche',
  'Nursery 1',
  'Nursery 2',
  'KG. 1',
  'KG. 2',
  'Basic 1',
  'Basic 2',
  'Basic 3',
  'Basic 4',
  'Basic 5',
  'Basic 6',
  'Basic 7',
  'Basic 8',
  'Basic 9'
];

export type SectionType = 'None' | 'Faith' | 'Harmony' | 'Humility' | 'Peace' | string;

export const SECTIONS: SectionType[] = ['None', 'Faith', 'Harmony', 'Humility', 'Peace'];

export const COMMON_MEDICAL_CONDITIONS = [
  'None',
  'Asthma',
  'Sickle Cell Disease / Trait',
  'Peanut / Tree Nut Allergy',
  'Lactose Intolerance / Dairy Allergy',
  'Egg Allergy',
  'Seafood / Fish Allergy',
  'Penicillin / Drug Allergy',
  'Diabetes (Type 1 / Type 2)',
  'Epilepsy / Seizures',
  'Chronic Respiratory / Bronchitis',
  'Skin Allergy / Eczema',
  'G6PD Deficiency',
  'Eye / Vision Impairment',
  'Hearing Impairment',
  'Other (Specify condition)'
] as const;

export type MedicalConditionType = (typeof COMMON_MEDICAL_CONDITIONS)[number] | string;

export interface Student {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  class: ClassType;
  gender: 'Male' | 'Female';
  dateOfBirth: string; // YYYY-MM-DD
  placeOfBirth: string;
  status: 'Day' | 'Boarder';
  section: SectionType;
  nationality: string;
  guardianName: string;
  guardianTelephone: string;
  guardianOccupation: string;
  guardianEmail?: string;
  email?: string;
  residentialAddress: string;
  ghanaPostGps?: string;
  // Parent Info (Mother & Father)
  motherName?: string;
  motherTelephone?: string;
  motherOccupation?: string;
  motherStatus?: 'Alive' | 'Death' | string;
  fatherName?: string;
  fatherTelephone?: string;
  fatherOccupation?: string;
  fatherStatus?: 'Alive' | 'Death' | string;
  photoUrl: string; // Base64 or local path
  createdAt: string;
  academicYear?: AcademicYearType;
  term?: TermType;
  medicalCondition?: MedicalConditionType;
  medicalConditionOther?: string;
  medicalNotes?: string;
  formerSchool?: string; // Formal School / Previous school attended
}

export type TeacherRank =
  | 'Superintendent II'
  | 'Superintendent I'
  | 'Senior Superintendent II'
  | 'Senior Superintendent I'
  | 'Principal Superintendent'
  | 'Assistant Director II'
  | 'Assistant Director I'
  | 'Deputy Director'
  | 'Director II'
  | 'Director I'
  | 'Not applicable';

export const TEACHER_RANKS: TeacherRank[] = [
  'Superintendent II',
  'Superintendent I',
  'Senior Superintendent II',
  'Senior Superintendent I',
  'Principal Superintendent',
  'Assistant Director II',
  'Assistant Director I',
  'Deputy Director',
  'Director II',
  'Director I',
  'Not applicable'
];

export interface Teacher {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  gender: 'Male' | 'Female';
  dateOfBirth: string;
  placeOfBirth: string;
  subjectsTaught: string; // Description of Class teacher/Subjects
  professionalQualifications: string;
  highestAcademicQualifications: string;
  rank: TeacherRank;
  dateOfFirstAppointment: string;
  dateOfPostingToCurrentStation: string;
  staffId: string;
  tinNumber?: string; // Taxpayer Identification Number
  ntcNumber: string;
  ssnitNumber: string;
  district: string;
  circuit: string;
  photoUrl: string;
  createdAt: string;
  schoolId?: string;
  email?: string;
  phone?: string;
  subjectSpecialization?: string;
  assignedClass?: ClassType | 'None';
  assignedClasses?: ClassType[];
  assignedSubjects?: SubjectType[];
  permissions?: {
    canEditGrades?: boolean;
    canApproveAttendance?: boolean;
    canExportReports?: boolean;
  };
  status?: string;
  title?: string;
  isClassTeacher?: boolean;
  classTeacherOf?: string;
  sectionTeacherOf?: string;
}

export type AttendanceStatus = 'Present' | 'Holiday' | 'Absent' | 'Unmarked';

export interface AttendanceRecord {
  id: string; // date_studentId
  date: string; // YYYY-MM-DD
  studentId: string;
  studentName: string;
  class: ClassType;
  status: AttendanceStatus;
  schoolId?: string;
}

export type StaffAttendanceStatus = 'Present' | 'Absent' | 'On Leave' | 'Unmarked';

export interface StaffAttendanceRecord {
  id: string; // date_teacherId
  date: string; // YYYY-MM-DD
  teacherId: string;
  teacherName: string;
  status: StaffAttendanceStatus;
  arrivalTime?: string;   // e.g. "07:30"
  departureTime?: string; // e.g. "16:00"
  remarks?: string;
}

export type AcademicYearType =
  | '2025/2026'
  | '2026/2027'
  | '2027/2028'
  | '2028/2029'
  | '2029/2030'
  | '2030/2031'
  | '2031/2032'
  | '2032/2033'
  | '2033/2034'
  | '2034/2035'
  | '2035/2036'
  | '2036/2037'
  | '2037/2038'
  | '2038/2039'
  | '2039/2040';

export const ACADEMIC_YEARS: AcademicYearType[] = [
  '2025/2026',
  '2026/2027',
  '2027/2028',
  '2028/2029',
  '2029/2030',
  '2030/2031',
  '2031/2032',
  '2032/2033',
  '2033/2034',
  '2034/2035',
  '2035/2036',
  '2036/2037',
  '2037/2038',
  '2038/2039',
  '2039/2040'
];

export type TermType = 'Term 1' | 'Term 2' | 'Term 3';

export const TERMS: TermType[] = ['Term 1', 'Term 2', 'Term 3'];

export type SubjectType =
  | 'English Language'
  | 'Mathematics'
  | 'Integrated Science'
  | 'Social Studies'
  | 'Religious And Moral Education'
  | 'Computing'
  | 'Creative Arts And Design'
  | 'French Language'
  | 'Our World Our People'
  | 'Career Technology'
  | 'History'
  | 'Ghanaian Language And Culture'
  | 'Literacy'
  | 'Numeracy'
  | 'Writing'
  | 'Drawing'
  | 'Colouring'
  | 'Environmental Studies';

export const SUBJECTS: SubjectType[] = [
  'English Language',
  'Mathematics',
  'Integrated Science',
  'Social Studies',
  'Religious And Moral Education',
  'Computing',
  'Creative Arts And Design',
  'French Language',
  'Our World Our People',
  'Career Technology',
  'History',
  'Ghanaian Language And Culture',
  'Literacy',
  'Numeracy',
  'Writing',
  'Drawing',
  'Colouring',
  'Environmental Studies'
];

export interface StudentAssessment {
  id: string; // auth-uid + studentId + academicYear + term + subject
  studentId: string;
  studentName: string;
  class: ClassType;
  academicYear: AcademicYearType;
  term: TermType;
  subject: SubjectType;
  // Assessments schema
  exercises: number[]; // Array of exactly 4 numbers (0-10 each) -> total 40
  tests: number[]; // Array of exactly 2 numbers (0-20 each) -> total 40
  projectWork: number; // 0-10
  groupWork: number; // 0-10
  // Result fields
  classScoreTotal: number; // 0-100 sum
  classScore50: number; // classScoreTotal * 0.50
  examScore100: number; // 0-100 exam mark
  examScore50: number; // examScore100 * 0.50
  totalScore: number; // classScore50 + examScore50 (0-100)
  gradeLevel: 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  remarks: string; // Emerging, Developing, etc.
  position?: number; // Position in class for this subject
  teacherRemarks?: string;

  // Custom assessments
  isCustomAssessment?: boolean;
  customAssessments?: number[]; // Scores for custom components
  isArchived?: boolean;
  archivedAt?: string;
  schoolId?: string;
}

export interface AssessmentTemplate {
  id: string; // class + subject + year + term
  components: { name: string; maxScore: number }[];
}

export type UserRole = 'Admin' | 'Headteacher' | 'Teacher';

export interface UserAccount {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  staffId?: string;
  schoolId?: string;
  createdAt: string;
  licenseType?: 'trial' | 'activated' | 'unlimited';
  licensePeriod?: number; // Number of years: 1, 2, 3, or 5
  registeredOn?: string;
  trialEndDate?: string;
  lastActivatedOn?: string;
  activationCode?: string;
  requestCode?: string;
  promoDiscountRate?: number;
  autoRenew?: boolean;
  isSuspended?: boolean;
  usedCodes?: string[];
}

export interface WebAuthnCredential {
  id: string; // base64 / binary string representation of the credential ID
  publicKey: string; // public key representation
  userEmail: string; // bound user's email
  userName: string; // bound user's name
  deviceName: string; // name of the authenticator e.g., "Peggy's TouchID Laptop"
  createdAt: string; // timestamp
  isSimulated?: boolean; // whether it was registered via simulation fallback
}

export type ThemeType = 'Classic' | 'Emerald' | 'Ruby' | 'Cosmic' | 'Gold' | 'Sophisticated Dark' | 'Crystal Glass' | 'Midnight' | 'Sunset' | 'Ocean';

export interface FeePayment {
  id: string; // transaction ID
  amount: number;
  date: string; // YYYY-MM-DD
  component: 'School Fees' | 'Utility Bill' | 'Sports Fees' | 'PTA dues' | 'Transportation Bill' | 'Other Fee' | (string & {});
  method: 'Cash' | 'Mobile Money' | 'Bank Transfer' | 'Cheque';
  receiptNo: string;
  remarks?: string;
}

export interface StudentFeeBill {
  id: string; // studentId + "_" + academicYear + "_" + term
  studentId: string;
  studentName: string;
  class: ClassType;
  academicYear: AcademicYearType;
  term: TermType;
  
  // Bills per component
  schoolFees: number;
  utilityBill: number;
  sportsFees: number;
  ptaDues: number;
  transportationBill: number;
  otherFee: number;
  otherFeeDescription?: string;
  
  // Installments list
  payments: FeePayment[];
  
  createdAt: string;
  updatedAt: string;
}

export interface TermDatesConfig {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface AcademicYearConfig {
  academicYear: AcademicYearType;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  terms: Record<TermType, TermDatesConfig>;
}

export interface AcademicCalendarConfig {
  activeAcademicYear: AcademicYearType;
  activeTerm: TermType;
  years: Record<AcademicYearType, AcademicYearConfig>;
}

export interface EmisData {
  id: string; // academicYear to uniquely identify the year's record
  academicYear: AcademicYearType;
  censusDate: string; // YYYY-MM-DD
  
  // 1. General & Administration Info (GES specific)
  emisCode: string; // GES EMIS unique identifier
  circuitName: string;
  districtName: string;
  regionName: string;
  schoolType: 'Public' | 'Private';
  religiousAffiliation: string;
  dayBoarding: 'Day' | 'Boarding' | 'Day & Boarding';
  multiGradeTeaching: boolean;
  
  // 2. School Enrolment Statistics (Class level breakdowns mapping to ClassType)
  boysEnrolled: Record<string, number>;
  girlsEnrolled: Record<string, number>;
  repeatersBoys: Record<string, number>;
  repeatersGirls: Record<string, number>;
  disabledBoys: Record<string, number>;
  disabledGirls: Record<string, number>;
  
  // 3. Infrastructure & Facilities (GES EMIS Requirements)
  permanentClassrooms: number;
  temporaryClassrooms: number;
  classroomsUnderTrees: number;
  drinkingWaterSource: 'Pipe-borne' | 'Borehole' | 'Hand-dug Well' | 'None' | 'Other';
  toiletType: 'Water Closet (WC)' | 'KVIP' | 'Pit Latrine' | 'None' | 'Other';
  toiletBoothsBoys: number;
  toiletBoothsGirls: number;
  hasElectricity: boolean;
  electricitySource: 'Grid (ECG/NEDCo)' | 'Solar' | 'Generator' | 'None';
  hasFunctionalIctLab: boolean;
  totalWorkingComputers: number;
  
  // 4. Textbooks & Teaching Materials
  englishTextbooks: number;
  mathTextbooks: number;
  scienceTextbooks: number;
  socialStudiesTextbooks: number;
  
  // 5. Staffing Status Summary
  trainedMaleTeachers: number;
  trainedFemaleTeachers: number;
  untrainedMaleTeachers: number;
  untrainedFemaleTeachers: number;
  nonTeachingMaleStaff: number;
  nonTeachingFemaleStaff: number;
  
  // 6. School Context & Foundations
  locationType: 'Urban' | 'Rural' | 'Semi-Urban';
  yearFounded: number;
  isSchoolFeedingBeneficiary: boolean;
  studentsFedDailyCount: number;

  // 7. Advanced WASH & Health Facilities
  hasSeparateStaffToilets: boolean;
  hasHandwashingStations: boolean;
  hasFunctionalSickBay: boolean;

  // 8. Governance & Community Settings
  hasActiveSmc: boolean; // School Management Committee
  hasActivePta: boolean; // Parent-Teacher Association
  ptaMeetingsHeldCount: number;

  // 9. Academic Facilities
  hasFunctionalLibrary: boolean;
  totalLibraryBooks: number;
  hasScienceKit: boolean;

  // 10. Safety & Compound Security
  isCompoundFenced: boolean;
  hasSecurityGuard: boolean;
  
  targetCommunityPopulation?: number; // Optional community catchment population of school-age children (4-15 yrs)
  
  // 11. Additional GES EMIS Census fields
  hasSpecialNeedsFacilities?: boolean;
  specialNeedsPupilsCount?: number;
  hasGuidanceCounsellor?: boolean;
  hasRecreationalFacilities?: boolean;
  ghanaianLanguageTaught?: 'Twi' | 'Ga' | 'Fante' | 'Ewe' | 'Dagbani' | 'None' | 'Other';
  hasInternetAccess?: boolean;
  
  updatedAt: string;
}

export interface PaystackPayment {
  id: string;
  reference: string;
  studentId: string;
  studentName?: string;
  billId: string;
  component: string;
  amount: number;
  academicYear: string;
  term: string;
  status: string;
  paidAt?: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string; // ISO String representation of action time
  userEmail: string;
  userName: string;
  userRole: UserRole;
  action: string; // e.g., 'Bulk Student Promotion', 'Teacher Account Deletion', etc.
  details: string; // detailed description 
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
}

export interface BehavioralRemark {
  id: string;
  studentId: string;
  teacherId: string;
  teacherName: string;
  category: 'Positive' | 'Academic' | 'Improvement' | 'Conduct' | 'Other';
  remark: string;
  date: string; // ISO String
  academicYear: string;
  term: string;
  schoolId?: string;
}

export interface TeacherReflection {
  id: string;
  teacherId: string;
  teacherName: string;
  date: string; // YYYY-MM-DD
  content: string; // This will now store HTML from rich text editor
  category: 'Behavior' | 'Learning Progress' | 'General' | 'Other' | 'Weekly Strategy';
  weeklyStrategyTitle?: string;
  linkedStudentIds?: string[];
  linkedAssessmentIds?: string[];
  performanceSummary?: string; // summary of performance data being reflected on
  class?: ClassType;
  academicYear: AcademicYearType;
  term: TermType;
  createdAt: string; // ISO string
  schoolId?: string;
}

export interface AutoBackupConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly';
  lastBackupTime: string | null;
}

export interface CloudSyncConfig {
  enabled: boolean;
  provider: 'Google Drive' | 'Firebase Cloud Storage';
  interval: 'daily' | 'weekly' | 'monthly';
  lastSyncTime: string | null;
  status: 'idle' | 'syncing' | 'success' | 'failed';
  error?: string;
}

export interface AutoBackupEntry {
  id: string;
  timestamp: string;
  size: number;
  data: string;
}

export type DutyType = 
  | 'Assembly Monitor' 
  | 'Gate Duty' 
  | 'Lunch Supervision' 
  | 'Compound Cleaning' 
  | 'Prep/Study Supervision' 
  | 'Grounds Patrol'
  | 'Other';

export interface DutyAssignment {
  id: string; // date_teacherId_dutyType
  date: string; // YYYY-MM-DD
  teacherId: string;
  teacherName: string;
  dutyType: DutyType;
  remarks?: string;
  status: 'Pending' | 'Completed' | 'Missed';
  academicYear: AcademicYearType;
  term: TermType;
}

export interface AttachedGoogleFile {
  id: string;
  name: string;
  url: string;
  mimeType: string;
}

export interface StaffHandbookDocument {
  id: string;
  title: string;
  content: string;
  category: 'Policy' | 'Mission Statement' | 'Pedagogical Guideline' | 'Other';
  lastUpdated: string;
  updatedBy: string;
  attachedFiles?: AttachedGoogleFile[];
}

export interface LeaveRequest {
  id: string;
  teacherId: string;
  teacherName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  requestDate: string; // ISO Date String
  approverComments?: string;
  schoolId?: string;
}

export interface CustomTask {
  id: string;
  title: string;
  description: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  isCompleted: boolean;
  completedAt?: string;
  isArchived: boolean;
  archivedAt?: string;
  createdAt: string;
  createdBy: string;
  schoolId?: string;
}

export type NoteCategory = 'General' | 'Academic' | 'Finance' | 'Personnel' | 'Events' | 'Maintenance';

export interface QuickNote {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  color: 'amber' | 'blue' | 'emerald' | 'rose' | 'purple' | 'slate';
  category?: NoteCategory;
  dueDate?: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt?: string;
  schoolId?: string;
  author?: string;
  // Recipient targeting & Notice/Meeting fields for Class Teachers
  targetAudience?: 'all' | 'class_teachers' | 'specific_class';
  targetClass?: ClassType;
  isMeetingNotice?: boolean;
  meetingDate?: string;
  meetingTime?: string;
  meetingVenue?: string;
  acknowledgedBy?: {
    teacherId: string;
    teacherName: string;
    acknowledgedAt: string;
  }[];
}

export interface CommunicationTemplate {
  id: string;
  name: string;
  type: 'email' | 'whatsapp';
  subject?: string;
  text: string;
  createdAt: string;
  updatedBy: string;
  badge?: string;
  description?: string;
}

// ==========================================
// FINANCES & BUSINESS ACCOUNTING MODULE TYPES
// ==========================================

export interface TransportRoute {
  id: string;
  name: string;
  driverName: string;
  driverPhone: string;
  vehicleNumber: string;
  feePerTerm: number;
  capacity?: number;
  stops?: string[];
  notes?: string;
}

export interface StudentTransportRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentClass: ClassType;
  routeId: string;
  routeName: string;
  tripType: 'Two-Way' | 'One-Way (Morning)' | 'One-Way (Afternoon)';
  term: TermType;
  academicYear: AcademicYearType;
  feeAmount: number;
  paidAmount: number;
  balance: number;
  status: 'Paid' | 'Partial' | 'Unpaid';
  lastPaymentDate?: string;
  receiptNumber?: string;
}

export interface CanteenPlan {
  id: string;
  name: string;
  rate: number;
  frequency: 'Daily' | 'Weekly' | 'Termly';
  description?: string;
}

export interface CanteenPaymentRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentClass: ClassType;
  planId: string;
  planName: string;
  term: TermType;
  academicYear: AcademicYearType;
  date: string;
  amountPaid: number;
  paymentMethod: 'Cash' | 'Mobile Money' | 'Bank' | 'Cheque';
  receiptNumber: string;
  remarks?: string;
}

export interface SchoolExcursion {
  id: string;
  title: string;
  destination: string;
  targetClasses: string[];
  eventDate: string;
  feePerStudent: number;
  description?: string;
  status: 'Upcoming' | 'Completed' | 'Cancelled';
  estimatedLogisticsCost?: number;
}

export interface ExcursionParticipant {
  id: string;
  excursionId: string;
  studentId: string;
  studentName: string;
  studentClass: ClassType;
  emergencyContact: string;
  feeAmount: number;
  paidAmount: number;
  balance: number;
  status: 'Paid' | 'Partial' | 'Unpaid';
  paymentDate?: string;
  receiptNumber?: string;
  consentSigned: boolean;
}

export interface SportsActivity {
  id: string;
  title: string;
  category: 'Annual Levy' | 'Sports Kit' | 'Tournament Fee' | 'Club Dues';
  amount: number;
  term: TermType;
  academicYear: AcademicYearType;
  description?: string;
}

export interface StudentSportsRecord {
  id: string;
  activityId: string;
  activityTitle: string;
  studentId: string;
  studentName: string;
  studentClass: ClassType;
  house?: string;
  feeAmount: number;
  paidAmount: number;
  balance: number;
  status: 'Paid' | 'Partial' | 'Unpaid';
  paymentDate?: string;
  receiptNumber?: string;
}

export interface TextbookItem {
  id: string;
  title: string;
  subject: string;
  targetClass: ClassType;
  salePrice: number;
  rentalPrice?: number;
  stockQty: number;
  isbn?: string;
  publisher?: string;
}

export interface StudentTextbookTransaction {
  id: string;
  bookId: string;
  bookTitle: string;
  studentId: string;
  studentName: string;
  studentClass: ClassType;
  type: 'Purchase' | 'Rental';
  amount: number;
  paidAmount: number;
  balance: number;
  status: 'Paid' | 'Partial' | 'Unpaid';
  date: string;
  returned?: boolean;
  returnDate?: string;
  receiptNumber?: string;
}

export type ExpenseCategory =
  | 'Salaries & Staff Allowances'
  | 'Utilities (Electricity / Water / Internet)'
  | 'Maintenance & Repairs'
  | 'Teaching & Learning Materials'
  | 'Vehicle Fuel & Transportation Logistics'
  | 'Kitchen & Canteen Supplies'
  | 'Sanitation & Health Supplies'
  | 'Sports & Co-Curricular'
  | 'Events & Excursions'
  | 'Administrative & Bank Charges'
  | 'ICT & Software Licensing'
  | 'Other Operations'
  | (string & {});

export interface CustomExpenseCategory {
  id: string;
  name: string;
  code: string;
  description?: string;
  budgetCap?: number;
  color?: string;
  iconName?: string;
  isSystem?: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type VoucherApprovalStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Disbursed' | 'Rejected';

export interface SchoolExpense {
  id: string;
  voucherNumber: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  payee: string;
  paymentMethod: 'Cash' | 'Mobile Money' | 'Bank Transfer' | 'Cheque';
  paymentDate: string;
  term: TermType;
  academicYear: AcademicYearType;
  approvedBy: string;
  preparedBy?: string;
  approvalStatus?: VoucherApprovalStatus;
  approvalDate?: string;
  disbursedDate?: string;
  budgetAllocated?: number;
  referenceNo?: string;
  description?: string;
  receiptUrl?: string;
  billComponentId?: string; // Links this expense to a specific Bill Component ('fees', 'transportation', 'canteen', 'excursion', 'sports', 'textbooks', or CustomBillComponent ID)
  billComponentName?: string; // Display name of the associated bill component
}

export type BillComponentCategory = 
  | 'Academic' 
  | 'Facilities & Utilities' 
  | 'Welfare & Feeding' 
  | 'Extra-Curricular' 
  | 'Logistics & Transport' 
  | 'Materials & Books' 
  | 'Special Projects'
  | (string & {});

export interface CustomBillComponent {
  id: string;
  name: string;
  code?: string;
  category: BillComponentCategory;
  defaultAmount: number;
  expenseBudgetCap?: number;
  frequency: 'Per Term' | 'Per Year' | 'One-Time' | 'Optional';
  applicableClasses: ('All' | ClassType)[];
  isRequired: boolean;
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialAuditLog {
  id: string;
  action: 'CREATE_EXPENSE' | 'UPDATE_EXPENSE' | 'APPROVE_EXPENSE' | 'DISBURSE_EXPENSE' | 'REJECT_EXPENSE' | 'DELETE_EXPENSE' | 'CREATE_COMPONENT' | 'UPDATE_COMPONENT' | 'OVER_BUDGET_WARNING';
  entityId: string;
  entityType: 'expense' | 'bill_component' | 'fee_bill';
  entityTitle: string;
  performedBy: string;
  role: string;
  details: string;
  amount?: number;
  timestamp: number;
}

export interface StaffPayslip {
  id: string;
  staffId: string;
  staffName: string;
  staffRole: string;
  staffEmail?: string;
  staffPhone?: string;
  staffBankName?: string;
  staffAccountNumber?: string;
  staffBankBranch?: string;
  staffSsnitNumber?: string;
  staffTin?: string;
  month: string; // e.g. "September 2026"
  paymentDate: string; // YYYY-MM-DD
  academicYear: AcademicYearType;
  term: TermType;
  
  // Earnings
  basicSalary: number;
  transportAllowance: number;
  responsibilityAllowance: number;
  overtimeAllowance: number;
  housingAllowance: number;
  otherAllowances: number;
  otherAllowancesDescription?: string;
  grossSalary: number;

  // Deductions
  ssnitTier1: number; // 5.5% employee SSNIT
  payeTax: number; // PAYE Income Tax
  staffWelfare: number; // Staff Welfare dues
  loanRepayment: number;
  providentFund: number;
  otherDeductions: number;
  otherDeductionsDescription?: string;
  totalDeductions: number;

  // Net Take-Home Pay
  netSalary: number;

  // Employer Contributions
  employerSsnitTier1: number; // 13.0% employer SSNIT
  employerProvidentFund: number;

  paymentMethod: 'Bank Transfer' | 'Mobile Money' | 'Cash' | 'Cheque';
  momoNetwork?: 'MTN MoMo' | 'Telecel Cash' | 'AT Money' | string;
  momoNumber?: string;
  momoAccountName?: string;
  chequeNumber?: string;
  chequeBankName?: string;
  chequeIssueDate?: string;
  paymentStatus: 'Draft' | 'Approved' | 'Disbursed' | 'Paid';
  disbursedDate?: string;
  voucherNumber?: string;
  expenseId?: string; // Links this to a SchoolExpense in the Expenses ledger
  remarks?: string;
  preparedBy?: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}








