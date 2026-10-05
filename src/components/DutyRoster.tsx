import React, { useState, useMemo, useEffect } from 'react';
import { Teacher, DutyAssignment, DutyType, AcademicYearType, TermType } from '../types';
import { DbController } from '../db';
import { ThemeStyles } from './ThemeWrapper';
import { 
  Plus, Trash2, Calendar, User, ClipboardList, CheckCircle2, Clock, AlertCircle, ChevronLeft, ChevronRight, Filter, Download, Bell, Printer, BarChart2, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerToast } from '../utils';
import SmartTextarea from './SmartTextarea';

interface Props {
  theme: ThemeStyles;
  teachers: Teacher[];
  onRefresh: () => void;
  isAdminOrHead: boolean;
}

const DUTY_TYPES: DutyType[] = [
  'Assembly Monitor',
  'Gate Duty',
  'Lunch Supervision',
  'Compound Cleaning',
  'Prep/Study Supervision',
  'Grounds Patrol',
  'Other'
];

export default function DutyRoster({ theme, teachers, onRefresh, isAdminOrHead }: Props) {
  const [assignments, setAssignments] = useState<DutyAssignment[]>(() => DbController.getDutyAssignments());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAdding, setIsAdding] = useState(false);
  const [expandedTeacherId, setExpandedTeacherId] = useState<string | null>(null);
  const [newAssignment, setNewAssignment] = useState<Partial<DutyAssignment>>({
    dutyType: 'Assembly Monitor',
    status: 'Pending'
  });

  const calendar = useMemo(() => DbController.getAcademicCalendar(), []);
  const schoolInfo = useMemo(() => DbController.getSchoolInfo(), []);

  const filteredAssignments = useMemo(() => {
    return assignments.filter(a => a.date === selectedDate);
  }, [assignments, selectedDate]);

  const handleAddAssignment = () => {
    if (!newAssignment.teacherId || !newAssignment.dutyType) {
      triggerToast('Please select a teacher and duty type', 'error');
      return;
    }

    const teacher = teachers.find(t => t.id === newAssignment.teacherId);
    if (!teacher) return;

    const assignment: DutyAssignment = {
      id: `${selectedDate}_${newAssignment.teacherId}_${newAssignment.dutyType}_${Date.now()}`,
      date: selectedDate,
      teacherId: teacher.id,
      teacherName: `${teacher.firstName} ${teacher.lastName}`,
      dutyType: newAssignment.dutyType as DutyType,
      status: 'Pending',
      remarks: newAssignment.remarks || '',
      academicYear: calendar.activeAcademicYear,
      term: calendar.activeTerm
    };

    DbController.saveDutyAssignment(assignment);
    setAssignments(DbController.getDutyAssignments());
    setIsAdding(false);
    setNewAssignment({ dutyType: 'Assembly Monitor', status: 'Pending' });
    triggerToast('Duty assigned successfully', 'success');
  };

  const handleSmartRotation = () => {
    if (teachers.length === 0) {
      triggerToast("No teachers available for rotation.", "error");
      return;
    }
    
    const assignmentCounts: Record<string, number> = {};
    teachers.forEach(t => assignmentCounts[t.id] = 0);
    assignments.forEach(a => {
      if (assignmentCounts[a.teacherId] !== undefined) {
        assignmentCounts[a.teacherId]++;
      }
    });

    const sortedTeachers = [...teachers].sort((a, b) => {
      const countA = assignmentCounts[a.id];
      const countB = assignmentCounts[b.id];
      if (countA !== countB) return countA - countB;
      return 0.5 - Math.random();
    });
    
    const newAssignments: DutyAssignment[] = [];
    
    for (const duty of DUTY_TYPES) {
      if (duty === 'Other') continue;
      
      const alreadyAssigned = assignments.some(a => a.date === selectedDate && a.dutyType === duty);
      if (alreadyAssigned) continue;
      
      const teacher = sortedTeachers.find(t => 
        !assignments.some(a => a.date === selectedDate && a.teacherId === t.id) && 
        !newAssignments.some(na => na.teacherId === t.id)
      );
      
      if (teacher) {
        newAssignments.push({
          id: `${selectedDate}_${teacher.id}_${duty}_${Date.now()}`,
          date: selectedDate,
          teacherId: teacher.id,
          teacherName: `${teacher.firstName} ${teacher.lastName}`,
          dutyType: duty,
          status: 'Pending',
          remarks: 'Auto-assigned by Smart Rotation',
          academicYear: calendar.activeAcademicYear,
          term: calendar.activeTerm
        });
      }
    }

    if (newAssignments.length > 0) {
      newAssignments.forEach(a => DbController.saveDutyAssignment(a));
      setAssignments(DbController.getDutyAssignments());
      triggerToast(`Smart rotation applied. ${newAssignments.length} duties assigned.`, "success");
      DbController.writeActivityLog('Smart Rotation Executed', `Auto-assigned ${newAssignments.length} duties for ${selectedDate}.`, 'low');
    } else {
      triggerToast("All standard duties are already covered for this date or no available teachers.", "info");
    }
  };

  const handleDeleteAssignment = (id: string) => {
    if (window.confirm('Are you sure you want to remove this assignment?')) {
      DbController.deleteDutyAssignment(id);
      setAssignments(DbController.getDutyAssignments());
      triggerToast('Assignment removed', 'info');
    }
  };

  const handleStatusChange = (assignment: DutyAssignment, newStatus: 'Pending' | 'Completed' | 'Missed') => {
    const updated = { ...assignment, status: newStatus };
    DbController.saveDutyAssignment(updated);
    setAssignments(DbController.getDutyAssignments());
  };

  // Stats for the week
  const weekStats = useMemo(() => {
    const today = new Date(selectedDate);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const weekAssignments = assignments.filter(a => {
      const d = new Date(a.date);
      return d >= startOfWeek && d <= endOfWeek;
    });

    return {
      total: weekAssignments.length,
      completed: weekAssignments.filter(a => a.status === 'Completed').length,
      missed: weekAssignments.filter(a => a.status === 'Missed').length,
      pending: weekAssignments.filter(a => a.status === 'Pending').length
    };
  }, [assignments, selectedDate]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Print-only Header */}
      <div className="hidden print:block mb-8 border-b-4 border-slate-900 pb-4 text-center">
        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Daily Duty Roster Summary</h1>
        <p className="text-sm font-bold text-slate-500 uppercase mt-1">{schoolInfo.name || 'GEETECH SMS & ASSESSMENT CENTER'}</p>
        <div className="flex justify-between mt-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-t border-slate-100 pt-4">
          <span>Date: {new Date(selectedDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <span>Academic Year: {calendar.activeAcademicYear}</span>
          <span>Term: {calendar.activeTerm}</span>
        </div>
      </div>

      {/* Header & Controls */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${theme.badgeBg} ${theme.badgeText} shadow-sm`}>
            <ClipboardList size={24} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 leading-tight">Faculty Duty Roster</h3>
            <p className="text-xs text-slate-500 font-medium">Manage and track rotating responsibilities for school staff.</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button 
              onClick={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() - 1);
                setSelectedDate(d.toISOString().split('T')[0]);
              }}
              className="p-1.5 hover:bg-white rounded-lg transition text-slate-600"
            >
              <ChevronLeft size={16} />
            </button>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-slate-700 focus:ring-0 px-2 cursor-pointer"
            />
            <button 
              onClick={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() + 1);
                setSelectedDate(d.toISOString().split('T')[0]);
              }}
              className="p-1.5 hover:bg-white rounded-lg transition text-slate-600"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          
          {isAdminOrHead && (
            <>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition hover:bg-slate-700 active:scale-95 no-print"
              >
                <Printer size={16} /> Daily Summary
              </button>
              <button
                onClick={handleSmartRotation}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold shadow-sm transition hover:bg-indigo-100 active:scale-95 no-print"
                title="Automatically assign available teachers to required duties"
              >
                <BarChart2 size={16} /> Smart Rotation
              </button>
              <button
                onClick={() => setIsAdding(true)}
                className={`flex items-center gap-2 px-4 py-2 ${theme.btnColors} rounded-xl text-xs font-bold shadow-sm transition hover:scale-[1.02] active:scale-95`}
              >
                <Plus size={16} /> Assign Duty
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:block">
        {/* Main Roster List */}
        <div className="lg:col-span-2 space-y-4 print:w-full">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Calendar size={16} className="text-indigo-500" /> 
                Assignments for {new Date(selectedDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </h4>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{filteredAssignments.length} Scheduled</span>
            </div>

            <div className="divide-y divide-slate-100">
              {filteredAssignments.length > 0 ? (
                filteredAssignments.map((assignment) => (
                  <div key={assignment.id} className="group">
                    <div 
                      className="p-4 hover:bg-slate-50 transition cursor-pointer flex items-center justify-between gap-4"
                      onClick={() => setExpandedTeacherId(expandedTeacherId === assignment.teacherId ? null : assignment.teacherId)}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-sm ${
                          assignment.dutyType === 'Assembly Monitor' ? 'bg-amber-500' :
                          assignment.dutyType === 'Gate Duty' ? 'bg-indigo-500' :
                          assignment.dutyType === 'Lunch Supervision' ? 'bg-emerald-500' :
                          'bg-slate-500'
                        }`}>
                          {assignment.dutyType.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition">{assignment.teacherName}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">{assignment.dutyType}</span>
                            {assignment.remarks && (
                              <span className="text-[10px] text-slate-400 italic">• {assignment.remarks}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        {isAdminOrHead ? (
                          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg no-print">
                            <button
                              onClick={() => handleStatusChange(assignment, 'Pending')}
                              className={`px-2 py-1 rounded text-[9px] font-bold transition ${assignment.status === 'Pending' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                              Pending
                            </button>
                            <button
                              onClick={() => handleStatusChange(assignment, 'Completed')}
                              className={`px-2 py-1 rounded text-[9px] font-bold transition ${assignment.status === 'Completed' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                              Done
                            </button>
                            <button
                              onClick={() => handleStatusChange(assignment, 'Missed')}
                              className={`px-2 py-1 rounded text-[9px] font-bold transition ${assignment.status === 'Missed' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                              Missed
                            </button>
                          </div>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            assignment.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                            assignment.status === 'Missed' ? 'bg-rose-100 text-rose-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {assignment.status}
                          </span>
                        )}

                        {isAdminOrHead && (
                          <>
                            <button 
                              onClick={() => {
                                triggerToast(`Notification sent to ${assignment.teacherName} for ${assignment.dutyType} duty.`, 'success');
                                DbController.writeActivityLog(
                                  'Duty Notification Sent',
                                  `Manual notification triggered for ${assignment.teacherName} regarding ${assignment.dutyType} on ${assignment.date}.`,
                                  'low'
                                );
                              }}
                              className="p-2 text-slate-300 hover:text-indigo-600 transition opacity-0 group-hover:opacity-100 no-print"
                              title="Notify Teacher"
                            >
                              <Bell size={14} />
                            </button>
                            <button 
                              onClick={() => handleDeleteAssignment(assignment.id)}
                              className="p-2 text-slate-300 hover:text-rose-500 transition opacity-0 group-hover:opacity-100 no-print"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* Expandable History Log */}
                    <AnimatePresence>
                      {expandedTeacherId === assignment.teacherId && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden bg-slate-50 border-t border-slate-100"
                        >
                          <div className="p-6">
                            <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                              <Clock size={14} className="text-slate-400" />
                              Recent Duty History for {assignment.teacherName}
                            </h5>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                              {assignments
                                .filter(a => a.teacherId === assignment.teacherId && a.id !== assignment.id)
                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                .map((hist) => (
                                  <div key={hist.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                                    <div className="flex items-center gap-3">
                                      <div className={`w-2 h-2 rounded-full ${
                                        hist.status === 'Completed' ? 'bg-emerald-500' :
                                        hist.status === 'Missed' ? 'bg-rose-500' :
                                        'bg-amber-500'
                                      }`} />
                                      <span className="text-xs font-bold text-slate-700">{hist.dutyType}</span>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-[10px] text-slate-500 block">{new Date(hist.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                      <span className={`text-[9px] font-bold uppercase tracking-wider ${
                                        hist.status === 'Completed' ? 'text-emerald-600' :
                                        hist.status === 'Missed' ? 'text-rose-600' :
                                        'text-amber-600'
                                      }`}>{hist.status}</span>
                                    </div>
                                  </div>
                                ))}
                                {assignments.filter(a => a.teacherId === assignment.teacherId && a.id !== assignment.id).length === 0 && (
                                  <div className="text-center py-4 text-xs text-slate-400 italic">No previous duty assignments found for this teacher.</div>
                                )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center px-6">
                  <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-200 mb-4">
                    <ClipboardList size={32} />
                  </div>
                  <h5 className="text-sm font-bold text-slate-900">No duties assigned for this date</h5>
                  <p className="text-xs text-slate-500 mt-1 max-w-[200px]">Use the "Assign Duty" button to schedule responsibilities for staff.</p>
                </div>
              )}
            </div>
          </div>

          {/* Print-only Footer */}
          <div className="hidden print:grid grid-cols-2 gap-20 mt-20 pt-10 border-t border-slate-200">
            <div className="text-center">
              <div className="border-b border-slate-900 h-10 mb-2"></div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Headteacher's Signature</p>
            </div>
            <div className="text-center">
              <div className="border-b border-slate-900 h-10 mb-2"></div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">School Stamp / Seal</p>
            </div>
          </div>
        </div>

        {/* Sidebar: Weekly Snapshot & Add Modal */}
        <div className="space-y-6 no-print">
          {/* Weekly Summary Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <BarChart2 size={14} className="text-indigo-500" /> Weekly Status Snapshot
            </h4>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Total Assignments</span>
                <span className="font-bold text-slate-900">{weekStats.total}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${weekStats.total > 0 ? (weekStats.completed / weekStats.total) * 100 : 0}%` }} />
              </div>
              
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-100 text-center">
                  <p className="text-[10px] font-bold text-emerald-700 uppercase">Done</p>
                  <p className="text-sm font-black text-emerald-900">{weekStats.completed}</p>
                </div>
                <div className="bg-amber-50 p-2 rounded-xl border border-amber-100 text-center">
                  <p className="text-[10px] font-bold text-amber-700 uppercase">Wait</p>
                  <p className="text-sm font-black text-amber-900">{weekStats.pending}</p>
                </div>
                <div className="bg-rose-50 p-2 rounded-xl border border-rose-100 text-center">
                  <p className="text-[10px] font-bold text-rose-700 uppercase">Miss</p>
                  <p className="text-sm font-black text-rose-900">{weekStats.missed}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Info */}
          <div className="bg-indigo-600 p-6 rounded-2xl text-white shadow-lg relative overflow-hidden">
            <div className="relative z-10 space-y-3">
              <h4 className="text-sm font-black uppercase tracking-tighter flex items-center gap-2">
                <ShieldAlert size={16} className="text-indigo-200" /> Duty Guidelines
              </h4>
              <p className="text-[11px] text-indigo-100 leading-relaxed font-medium">
                Headteachers should rotate duties weekly to ensure fair distribution. Staff on duty are expected to report 15 minutes before the first bell.
              </p>
            </div>
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-24 h-24 bg-white/10 rounded-full blur-xl" />
          </div>
        </div>
      </div>

      {/* Add Assignment Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Plus className="text-indigo-600" /> Assign Responsibility
                </h3>
                <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-white rounded-xl transition text-slate-400">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Select Staff Member</label>
                  <select
                    value={newAssignment.teacherId || ''}
                    onChange={(e) => setNewAssignment({ ...newAssignment, teacherId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-xs"
                  >
                    <option value="">Choose an educator...</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.firstName} {t.lastName} ({t.staffId})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Duty Category</label>
                  <div className="grid grid-cols-2 gap-2">
                    {DUTY_TYPES.map(type => (
                      <button
                        key={type}
                        onClick={() => setNewAssignment({ ...newAssignment, dutyType: type })}
                        className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition ${
                          newAssignment.dutyType === type 
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Special Remarks</label>
                  <SmartTextarea
                    placeholder="e.g. Extra focus on morning traffic..."
                    value={newAssignment.remarks || ''}
                    onChange={(e: any) => setNewAssignment({ ...newAssignment, remarks: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-xs min-h-[80px]"
                  />
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button
                  onClick={() => setIsAdding(false)}
                  className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-xs font-bold hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddAssignment}
                  className={`flex-1 px-4 py-3 ${theme.btnColors} rounded-2xl text-xs font-bold shadow-lg transition hover:scale-[1.02] active:scale-95`}
                >
                  Schedule Duty
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function X({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
  );
}
