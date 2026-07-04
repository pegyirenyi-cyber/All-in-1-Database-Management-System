import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Calendar, 
  CheckCircle, 
  Clock, 
  BookOpen, 
  ArrowRight,
  TrendingUp,
  AlertCircle,
  GraduationCap,
  CalendarDays,
  Target,
  Sparkles,
  Zap,
  Plus,
  Send,
  MessageSquare,
  X,
  ShieldCheck,
  User
} from 'lucide-react';
import { Teacher, Student, AttendanceRecord, AcademicCalendarConfig, ClassType, SubjectType, StudentAssessment, TeacherReflection, SchoolInfo } from '../types';
import TeacherReflections from './TeacherReflections';
import { DbController } from '../db';

interface TeacherDashboardTabProps {
  teacherProfile: Teacher;
  students: Student[];
  attendance: AttendanceRecord[];
  calendar: AcademicCalendarConfig;
  assessments: StudentAssessment[];
  reflections: TeacherReflection[];
  schoolInfo: SchoolInfo;
  themeStyles: any;
  onNavigate: (tabId: string, params?: any) => void;
  onRefresh: () => void;
}

export default function TeacherDashboardTab({
  teacherProfile,
  students,
  attendance,
  calendar,
  assessments,
  reflections,
  schoolInfo,
  themeStyles,
  onNavigate,
  onRefresh
}: TeacherDashboardTabProps) {
  
  const assignedClasses = useMemo(() => {
    const classesList: ClassType[] = [];
    if (teacherProfile.assignedClasses) {
      classesList.push(...teacherProfile.assignedClasses);
    }
    if (teacherProfile.assignedClass && teacherProfile.assignedClass !== 'None' && !classesList.includes(teacherProfile.assignedClass)) {
      classesList.push(teacherProfile.assignedClass);
    }
    return classesList;
  }, [teacherProfile]);

  const assignedSubjects = teacherProfile.assignedSubjects || [];

  // Filter students belonging to assigned classes
  const myStudents = useMemo(() => {
    return students.filter(s => assignedClasses.includes(s.class));
  }, [students, assignedClasses]);

  // Calculate students per class
  const studentsPerClass = useMemo(() => {
    const counts: Record<string, number> = {};
    assignedClasses.forEach(c => {
      counts[c] = students.filter(s => s.class === c).length;
    });
    return counts;
  }, [assignedClasses, students]);

  // Attendance rate for assigned classes (last 30 days or current month)
  const attendanceRate = useMemo(() => {
    const relevantAttendance = attendance.filter(a => assignedClasses.includes(a.class));
    if (relevantAttendance.length === 0) return 0;
    const presents = relevantAttendance.filter(a => a.status === 'Present').length;
    return Math.round((presents / relevantAttendance.length) * 100);
  }, [attendance, assignedClasses]);

  // Pending grading tasks (heuristic: count students in assigned classes/subjects who don't have an assessment for the active term/year)
  const pendingGradingCount = useMemo(() => {
    let count = 0;
    assignedClasses.forEach(cls => {
      const classStudents = students.filter(s => s.class === cls);
      assignedSubjects.forEach(sub => {
        classStudents.forEach(stu => {
          const hasRecord = assessments.some(a => 
            a.studentId === stu.id && 
            a.subject === sub && 
            a.academicYear === calendar.activeAcademicYear && 
            a.term === calendar.activeTerm
          );
          if (!hasRecord) count++;
        });
      });
    });
    return count;
  }, [assignedClasses, assignedSubjects, students, assessments, calendar]);

  // Upcoming Tasks list
  const upcomingTasks = useMemo(() => {
    const tasks = [];
    
    // Task: Mark attendance (if today is a weekday and we are in term time)
    const today = new Date();
    const isWeekday = today.getDay() !== 0 && today.getDay() !== 6;
    if (isWeekday) {
      tasks.push({
        id: 'mark_attendance',
        title: 'Mark Today Attendance',
        description: `Ensure attendance for your ${assignedClasses.length} assigned classes is recorded.`,
        icon: CalendarCheck,
        priority: 'high',
        action: () => onNavigate('attendance')
      });
    }

    // Task: Grading
    if (pendingGradingCount > 0) {
      tasks.push({
        id: 'grading',
        title: 'Pending Student Assessments',
        description: `You have ${pendingGradingCount} records to complete for the current term.`,
        icon: GraduationCap,
        priority: 'medium',
        action: () => onNavigate('assessments')
      });
    }

    // Term Closure Task
    const activeYearCfg = calendar.years[calendar.activeAcademicYear];
    if (activeYearCfg) {
      const termCfg = activeYearCfg.terms[calendar.activeTerm];
      if (termCfg) {
        const endDate = new Date(termCfg.endDate);
        const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 0 && diffDays <= 14) {
          tasks.push({
            id: 'term_closure',
            title: `${calendar.activeTerm} Closure Approaching`,
            description: `Only ${diffDays} days left until the end of the term. Prepare final reports.`,
            icon: Clock,
            priority: 'critical',
            action: () => {}
          });
        }
      }
    }

    return tasks;
  }, [assignedClasses, calendar, pendingGradingCount, onNavigate]);

  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [quickActionModal, setQuickActionModal] = useState<'behavior' | 'grade' | 'attendance' | null>(null);
  
  // Quick Action form states
  const [qaStudentId, setQaStudentId] = useState('');
  const [qaBehaviorContent, setQaBehaviorContent] = useState('');
  const [qaSubject, setQaSubject] = useState(assignedSubjects[0] || '');
  const [qaAssessmentType, setQaAssessmentType] = useState('exercise1'); 
  const [qaScore, setQaScore] = useState('');
  const [qaAttendanceStatus, setQaAttendanceStatus] = useState<'Present' | 'Absent' | 'On Leave'>('Present');

  const handleQuickActionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaStudentId) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { text: 'Please select a student', type: 'error' } }));
      return;
    }

    const student = students.find(s => s.id === qaStudentId);
    if (!student) return;

    if (quickActionModal === 'behavior') {
      const newReflection: TeacherReflection = {
        id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        teacherId: teacherProfile.id,
        teacherName: `${teacherProfile.firstName} ${teacherProfile.lastName}`,
        date: new Date().toISOString().split('T')[0],
        content: `Student: ${student.firstName} ${student.lastName} (${student.class}) - ${qaBehaviorContent}`,
        category: 'Behavior',
        class: student.class,
        academicYear: calendar.activeAcademicYear,
        term: calendar.activeTerm,
        createdAt: new Date().toISOString()
      };
      DbController.saveTeacherReflection(newReflection);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { text: 'Behavioral note logged successfully.', type: 'success' } }));
      setQaBehaviorContent('');
    } 
    else if (quickActionModal === 'attendance') {
      const todayDate = new Date().toISOString().split('T')[0];
      const record: AttendanceRecord = {
        id: `${todayDate}_${student.id}`,
        date: todayDate,
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        class: student.class,
        status: qaAttendanceStatus
      };
      DbController.saveAttendanceBatch([record]);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { text: `Attendance for ${student.firstName} flagged as ${qaAttendanceStatus}.`, type: 'success' } }));
    }
    else if (quickActionModal === 'grade') {
      // Find existing assessment or create a new one
      const term = calendar.activeTerm;
      const year = calendar.activeAcademicYear;
      const allAssessments = DbController.getAssessments();
      const existingIdx = allAssessments.findIndex(a => a.studentId === student.id && a.subject === qaSubject && a.term === term && a.academicYear === year);
      
      let assessmentToUpdate: StudentAssessment;
      if (existingIdx >= 0) {
        assessmentToUpdate = { ...allAssessments[existingIdx] };
      } else {
        assessmentToUpdate = {
          id: `currAuthUser_${student.id}_${year}_${term}_${qaSubject}`, // Fallback mock id
          studentId: student.id,
          studentName: `${student.firstName} ${student.lastName}`,
          class: student.class,
          academicYear: year,
          term: term,
          subject: qaSubject as SubjectType,
          exercises: [0, 0, 0, 0],
          tests: [0, 0],
          projectWork: 0,
          groupWork: 0,
          classScoreTotal: 0,
          classScore50: 0,
          examScore100: 0,
          examScore50: 0,
          totalScore: 0,
          gradeLevel: 'L5',
          remarks: 'Emerging'
        };
        allAssessments.push(assessmentToUpdate);
      }

      const scoreValue = parseFloat(qaScore);
      if (isNaN(scoreValue)) return;

      if (qaAssessmentType.startsWith('exercise')) {
        const idx = parseInt(qaAssessmentType.replace('exercise', '')) - 1;
        assessmentToUpdate.exercises[idx] = scoreValue;
      } else if (qaAssessmentType.startsWith('test')) {
        const idx = parseInt(qaAssessmentType.replace('test', '')) - 1;
        assessmentToUpdate.tests[idx] = scoreValue;
      } else if (qaAssessmentType === 'project') {
        assessmentToUpdate.projectWork = scoreValue;
      } else if (qaAssessmentType === 'group') {
        assessmentToUpdate.groupWork = scoreValue;
      } else if (qaAssessmentType === 'exam') {
        assessmentToUpdate.examScore100 = scoreValue;
      }

      const recalced = DbController.calculateScoreDetails(assessmentToUpdate);
      if (existingIdx >= 0) {
        allAssessments[existingIdx] = recalced;
      } else {
        allAssessments[allAssessments.length - 1] = recalced;
      }
      
      DbController.saveAllAssessments(allAssessments);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { text: `Grade saved for ${student.firstName} (${qaSubject}).`, type: 'success' } }));
      setQaScore('');
    }
    
    setQuickActionModal(null);
    onRefresh();
  };

  return (
    <div className="relative">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
      {/* Welcome Notice Board */}
      <div className="bg-white border-4 border-indigo-600 rounded-3xl p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-4">
          <div className="bg-indigo-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2">
            <ShieldCheck size={14} /> Official Notice Board
          </div>
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border-2 border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                <User size={32} />
              </div>
              <div className="space-y-1">
                <h1 className="text-3xl md:text-4xl font-black font-display tracking-tight text-slate-900 leading-none">
                  Welcome, <span className="text-indigo-600">{teacherProfile.firstName} {teacherProfile.lastName}</span>
                </h1>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-slate-500 font-bold text-[11px] uppercase tracking-tight">
                    <GraduationCap size={14} className="text-amber-500" />
                    Assigned Classes: <span className="text-slate-900 font-black">{assignedClasses.length > 0 ? assignedClasses.join(', ') : 'None'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500 font-bold text-[11px] uppercase tracking-tight">
                    <BookOpen size={14} className="text-indigo-500" />
                    Assigned Subjects: <span className="text-slate-900 font-black">{assignedSubjects.length > 0 ? assignedSubjects.join(', ') : 'None'}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <p className="text-slate-500 text-sm font-sans max-w-xl leading-relaxed">
              We're glad to have you back! Your dedication to shaping young minds at <span className="text-indigo-600 font-bold">{schoolInfo.name || 'our institution'}</span> is what makes our community thrive. Use the dashboard below to manage your students and academic records for the <span className="text-indigo-600 font-bold">{calendar.activeAcademicYear}</span> session.
            </p>
          </div>

          {/* Quick Notice Widgets */}
          <div className="flex flex-col gap-3 min-w-[280px]">
            {/* Birthday Alert */}
            {(() => {
              const today = new Date();
              const month = today.getMonth() + 1;
              const day = today.getDate();
              const birthdayStudents = myStudents.filter(s => {
                if (!s.dateOfBirth) return false;
                const dob = new Date(s.dateOfBirth);
                return (dob.getMonth() + 1) === month && dob.getDate() === day;
              });

              if (birthdayStudents.length > 0) {
                return (
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl flex items-center gap-3 animate-bounce-subtle">
                    <div className="p-2 bg-amber-400 text-white rounded-xl shadow-sm">
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Birthday Alert!</p>
                      <p className="text-xs font-bold text-amber-900">{birthdayStudents.length} student{birthdayStudents.length > 1 ? 's' : ''} celebrating today!</p>
                    </div>
                  </div>
                );
              }
              return (
                <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-2xl flex items-center gap-3">
                  <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-sm">
                    <CalendarDays size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Today's Schedule</p>
                    <p className="text-xs font-bold text-indigo-900">Normal School Hours</p>
                  </div>
                </div>
              );
            })()}

            {/* Performance Snapshot */}
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl flex items-center gap-3">
              <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-sm">
                <TrendingUp size={16} />
              </div>
              <div>
                <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Class Performance</p>
                <p className="text-xs font-bold text-emerald-900">{attendanceRate}% Attendance Rate</p>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl" />
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-amber-500/5 rounded-full blur-3xl" />
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={Users} 
          label="Total Students" 
          value={myStudents.length.toString()} 
          subtext={`${assignedClasses.length} Classes Assigned`}
          color="indigo"
        />
        <StatCard 
          icon={Calendar} 
          label="Attendance Rate" 
          value={`${attendanceRate}%`} 
          subtext="Current Term Average"
          color="emerald"
        />
        <StatCard 
          icon={GraduationCap} 
          label="Pending Grades" 
          value={pendingGradingCount.toString()} 
          subtext="Missing Assessment Entries"
          color="amber"
        />
        <StatCard 
          icon={Clock} 
          label="Term Progress" 
          value={(() => {
            const activeYearCfg = calendar.years[calendar.activeAcademicYear];
            if (!activeYearCfg) return '0%';
            const termCfg = activeYearCfg.terms[calendar.activeTerm];
            if (!termCfg) return '0%';
            const start = new Date(termCfg.startDate).getTime();
            const end = new Date(termCfg.endDate).getTime();
            const now = new Date().getTime();
            if (now < start) return '0%';
            if (now > end) return '100%';
            return `${Math.round(((now - start) / (end - start)) * 100)}%`;
          })()} 
          subtext={calendar.activeTerm}
          color="rose"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Assigned Classes & Students */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Target size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Assigned Classes</h3>
                  <p className="text-xs text-slate-500 font-sans">Breakdown of students under your care</p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assignedClasses.map(cls => (
                  <motion.div 
                    key={cls}
                    whileHover={{ scale: 1.02 }}
                    className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-indigo-100 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest font-mono">Section: Default</span>
                        <h4 className="text-xl font-black text-slate-900 font-display">{cls}</h4>
                      </div>
                      <div className="p-2 rounded-lg bg-white shadow-sm text-indigo-600 border border-slate-100">
                        <Users size={18} />
                      </div>
                    </div>
                    
                    <div className="mt-6 flex items-end justify-between">
                      <div>
                        <span className="block text-2xl font-black text-indigo-600 leading-none">{studentsPerClass[cls] || 0}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase font-sans mt-1 block">Total Students</span>
                      </div>
                      
                      <div className="flex gap-2">
                        <button 
                          onClick={() => onNavigate('attendance')}
                          className="p-2 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-colors"
                          title="Attendance"
                        >
                          <CalendarCheck size={16} />
                        </button>
                        <button 
                          onClick={() => onNavigate('assessments')}
                          className="p-2 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-colors"
                          title="Assessments"
                        >
                          <ClipboardCheck size={16} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {assignedClasses.length === 0 && (
                  <div className="col-span-full py-12 flex flex-col items-center justify-center text-center space-y-3 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    <div className="p-3 rounded-full bg-slate-100 text-slate-400">
                      <AlertCircle size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">No Classes Assigned</p>
                      <p className="text-xs text-slate-500">Contact your administrator to assign classes to your profile.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recently Recorded Attendance Summary */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Assigned Subjects</h3>
                  <p className="text-xs text-slate-500 font-sans">Subjects you are authorized to grade</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="flex flex-wrap gap-2">
                {assignedSubjects.map(sub => (
                  <span key={sub} className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 flex items-center gap-2">
                    <BookOpen size={14} className="text-indigo-500" />
                    {sub}
                  </span>
                ))}
                {assignedSubjects.length === 0 && (
                  <p className="text-xs text-slate-400 italic">No subjects assigned yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Teacher Reflections Module */}
          <TeacherReflections 
            teacher={teacherProfile} 
            reflections={reflections} 
            schoolInfo={schoolInfo}
            onRefresh={onRefresh} 
          />
        </div>

        {/* Right Column: Upcoming Tasks & Calendar */}
        <div className="space-y-6">
          <div className="bg-slate-900 text-white rounded-2xl overflow-hidden shadow-xl border border-slate-800">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-800/30">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Clock size={14} className="text-amber-400" /> Upcoming Tasks
              </h3>
            </div>
            <div className="divide-y divide-slate-800">
              {upcomingTasks.map((task, idx) => (
                <div 
                  key={task.id} 
                  className="p-5 hover:bg-slate-800/50 transition-colors cursor-pointer group"
                  onClick={task.action}
                >
                  <div className="flex gap-4">
                    <div className={`mt-1 p-2 rounded-lg shrink-0 ${
                      task.priority === 'critical' ? 'bg-rose-500/20 text-rose-400' :
                      task.priority === 'high' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-indigo-500/20 text-indigo-400'
                    }`}>
                      <task.icon size={18} />
                    </div>
                    <div className="space-y-1 pr-4">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-100 group-hover:text-amber-400 transition-colors">{task.title}</h4>
                        {task.priority === 'critical' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed font-sans">{task.description}</p>
                    </div>
                    <ArrowRight size={14} className="ml-auto text-slate-700 group-hover:text-white group-hover:translate-x-1 transition-all self-center" />
                  </div>
                </div>
              ))}
              {upcomingTasks.length === 0 && (
                <div className="p-10 text-center space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-600">
                    <CheckCircle size={24} />
                  </div>
                  <p className="text-xs text-slate-500 font-medium">All caught up! No pending tasks.</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Calendar Snapshot */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 border-b border-slate-100 pb-3">
              <CalendarDays size={14} className="text-indigo-500" /> Academic Context
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Current Term</span>
                <span className="text-xs font-black text-slate-900">{calendar.activeTerm}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Academic Year</span>
                <span className="text-xs font-black text-slate-900">{calendar.activeAcademicYear}</span>
              </div>
              <hr className="border-slate-50" />
              {(() => {
                const activeYearCfg = calendar.years[calendar.activeAcademicYear];
                if (!activeYearCfg) return null;
                const termCfg = activeYearCfg.terms[calendar.activeTerm];
                if (!termCfg) return null;
                return (
                  <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                    <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase font-mono">
                      <span>Term Start</span>
                      <span>Term End</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <span>{new Date(termCfg.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                      <span>{new Date(termCfg.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: (() => {
                          const start = new Date(termCfg.startDate).getTime();
                          const end = new Date(termCfg.endDate).getTime();
                          const now = new Date().getTime();
                          if (now < start) return '0%';
                          if (now > end) return '100%';
                          return `${Math.round(((now - start) / (end - start)) * 100)}%`;
                        })() }}
                        className="bg-indigo-500 h-full rounded-full"
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </motion.div>

    {/* Floating Quick Actions */}
    <div className="fixed bottom-8 right-8 z-50">
        <AnimatePresence>
          {isQuickActionsOpen && (
            <div className="absolute bottom-20 right-0 space-y-3 flex flex-col items-end">
              {[
                { label: 'Set Attendance Flag', icon: CalendarCheck, color: 'bg-emerald-600', actionId: 'attendance' },
                { label: 'Add Quick Grade', icon: GraduationCap, color: 'bg-amber-600', actionId: 'grade' },
                { label: 'Behavioral Note', icon: MessageSquare, color: 'bg-indigo-600', actionId: 'behavior' }
              ].map((action, idx) => (
                <motion.button
                  key={action.actionId}
                  initial={{ opacity: 0, scale: 0.8, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8, x: 20 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => {
                    setQuickActionModal(action.actionId as any);
                    setIsQuickActionsOpen(false);
                  }}
                  className="flex items-center gap-3 group"
                >
                  <span className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity shadow-xl">
                    {action.label}
                  </span>
                  <div className={`p-4 rounded-2xl ${action.color} text-white shadow-2xl hover:scale-110 transition-transform`}>
                    <action.icon size={20} />
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsQuickActionsOpen(!isQuickActionsOpen)}
          className={`p-5 rounded-3xl shadow-2xl transition-all duration-300 flex items-center justify-center ${
            isQuickActionsOpen 
              ? 'bg-slate-900 text-white rotate-90' 
              : 'bg-amber-400 text-slate-900'
          }`}
        >
          {isQuickActionsOpen ? <X size={28} /> : <Zap size={28} fill="currentColor" />}
          
          {!isQuickActionsOpen && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 border-2 border-white"></span>
            </span>
          )}
        </motion.button>
      </div>

      {/* Close backdrop when menu is open */}
      {isQuickActionsOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/5 backdrop-blur-[2px]"
          onClick={() => setIsQuickActionsOpen(false)}
        />
      )}

      {/* Quick Action Modal */}
      <AnimatePresence>
        {quickActionModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100"
            >
              <div className={`p-4 border-b flex justify-between items-center ${
                quickActionModal === 'attendance' ? 'bg-emerald-50 border-emerald-100 text-emerald-900' :
                quickActionModal === 'grade' ? 'bg-amber-50 border-amber-100 text-amber-900' :
                'bg-indigo-50 border-indigo-100 text-indigo-900'
              }`}>
                <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
                  {quickActionModal === 'attendance' && <><CalendarCheck size={16} className="text-emerald-600" /> Quick Attendance</>}
                  {quickActionModal === 'grade' && <><GraduationCap size={16} className="text-amber-600" /> Quick Grade</>}
                  {quickActionModal === 'behavior' && <><MessageSquare size={16} className="text-indigo-600" /> Behavioral Note</>}
                </h3>
                <button onClick={() => setQuickActionModal(null)} className="p-1 hover:bg-black/5 rounded-lg transition">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleQuickActionSubmit} className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Student</label>
                  <select
                    required
                    value={qaStudentId}
                    onChange={(e) => setQaStudentId(e.target.value)}
                    className="w-full text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  >
                    <option value="">-- Choose a student --</option>
                    {myStudents.map(s => (
                      <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.class})</option>
                    ))}
                  </select>
                </div>

                {quickActionModal === 'attendance' && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</label>
                    <div className="flex gap-2">
                      {['Present', 'Absent', 'On Leave'].map((status) => (
                        <label key={status} className={`flex-1 flex items-center justify-center p-2 rounded-xl border text-xs font-bold cursor-pointer transition ${qaAttendanceStatus === status ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                          <input type="radio" name="status" value={status} checked={qaAttendanceStatus === status} onChange={() => setQaAttendanceStatus(status as any)} className="hidden" />
                          {status}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {quickActionModal === 'grade' && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subject</label>
                      <select required value={qaSubject} onChange={e => setQaSubject(e.target.value)} className="w-full text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                        {assignedSubjects.map(sub => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assessment</label>
                        <select required value={qaAssessmentType} onChange={e => setQaAssessmentType(e.target.value)} className="w-full text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                          <option value="exercise1">Exercise 1</option>
                          <option value="exercise2">Exercise 2</option>
                          <option value="test1">Test 1</option>
                          <option value="test2">Test 2</option>
                          <option value="project">Project Work</option>
                          <option value="group">Group Work</option>
                          <option value="exam">Exam</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Score</label>
                        <input type="number" required min="0" step="0.5" value={qaScore} onChange={e => setQaScore(e.target.value)} className="w-full text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-2.5" placeholder="e.g. 8.5" />
                      </div>
                    </div>
                  </>
                )}

                {quickActionModal === 'behavior' && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Note Details</label>
                    <textarea 
                      required 
                      value={qaBehaviorContent} 
                      onChange={e => setQaBehaviorContent(e.target.value)}
                      placeholder="Describe the incident or progress..."
                      className="w-full h-24 resize-none text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                )}

                <div className="pt-2 flex gap-3">
                  <button type="button" onClick={() => setQuickActionModal(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition">
                    Cancel
                  </button>
                  <button type="submit" className={`flex-1 py-2.5 text-white rounded-xl text-xs font-bold transition ${
                    quickActionModal === 'attendance' ? 'bg-emerald-600 hover:bg-emerald-700' :
                    quickActionModal === 'grade' ? 'bg-amber-600 hover:bg-amber-700' :
                    'bg-indigo-600 hover:bg-indigo-700'
                  }`}>
                    Save Record
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, subtext, color }: { 
  icon: any, 
  label: string, 
  value: string, 
  subtext: string,
  color: 'indigo' | 'emerald' | 'amber' | 'rose'
}) {
  const colorMap = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100'
  };

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${colorMap[color]}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">{label}</p>
        <h4 className="text-2xl font-black text-slate-900 mt-0.5">{value}</h4>
        <p className="text-[10px] font-medium text-slate-500 mt-1 uppercase font-sans tracking-tight">{subtext}</p>
      </div>
    </motion.div>
  );
}

const CalendarCheck = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>
);

const ClipboardCheck = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></svg>
);
