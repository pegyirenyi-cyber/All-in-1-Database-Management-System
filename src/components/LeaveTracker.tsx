import React, { useState, useMemo } from 'react';
import { LeaveRequest, Teacher } from '../types';
import { DbController } from '../db';
import { CalendarRange, Check, X, Plus, Clock, FileText, CheckCircle2, XCircle } from 'lucide-react';

interface Props {
  theme: any;
  teachers: Teacher[];
  onRefresh: () => void;
  isAdminOrHead: boolean;
}

const INITIAL_FORM = {
  startDate: '',
  endDate: '',
  reason: ''
};

export default function LeaveTracker({ theme, teachers, onRefresh, isAdminOrHead }: Props) {
  const [requests, setRequests] = useState<LeaveRequest[]>(() => DbController.getLeaveRequests());
  const [showForm, setShowForm] = useState(false);
  const [formState, setFormState] = useState(INITIAL_FORM);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');

  const currentUser = DbController.getCurrentUser();
  const currentTeacher = useMemo(() => {
    const cuEmail = currentUser?.email?.toLowerCase().trim();
    return teachers.find(t =>
      (cuEmail && t.email?.toLowerCase().trim() === cuEmail) ||
      (currentUser?.staffId && t.staffId === currentUser.staffId) ||
      (currentUser?.uid && t.id === currentUser.uid)
    );
  }, [teachers, currentUser]);

  const displayedRequests = useMemo(() => {
    if (isAdminOrHead) return requests;
    if (currentTeacher) return requests.filter(r => r.teacherId === currentTeacher.id);
    return [];
  }, [requests, isAdminOrHead, currentTeacher]);

  const handleSaveRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.startDate || !formState.endDate || !formState.reason) return;
    
    let tId = '';
    let tName = '';
    
    if (isAdminOrHead) {
      if (!selectedTeacherId) return;
      const t = teachers.find(t => t.id === selectedTeacherId);
      if (!t) return;
      tId = t.id;
      tName = DbController.formatTeacherFullName(t);
    } else {
      if (!currentTeacher) return;
      tId = currentTeacher.id;
      tName = DbController.formatTeacherFullName(currentTeacher);
    }

    const newReq: LeaveRequest = {
      id: 'LR' + Date.now(),
      teacherId: tId,
      teacherName: tName,
      startDate: formState.startDate,
      endDate: formState.endDate,
      reason: formState.reason,
      status: 'Pending',
      requestDate: new Date().toISOString()
    };

    DbController.saveLeaveRequest(newReq);
    setRequests(DbController.getLeaveRequests());
    DbController.writeActivityLog('Leave Request Submitted', `Leave request for ${tName} from ${formState.startDate} to ${formState.endDate}.`, 'low');
    setShowForm(false);
    setFormState(INITIAL_FORM);
    onRefresh();
  };

  const handleAction = (req: LeaveRequest, action: 'Approved' | 'Rejected') => {
    const updated = { ...req, status: action };
    DbController.saveLeaveRequest(updated);
    setRequests(DbController.getLeaveRequests());
    DbController.writeActivityLog(`Leave Request ${action}`, `Request for ${req.teacherName} was ${action.toLowerCase()}.`, 'medium');
    onRefresh();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-700"><CheckCircle2 size={12} /> Approved</span>;
      case 'Rejected':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-100 text-rose-700"><XCircle size={12} /> Rejected</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-700"><Clock size={12} /> Pending</span>;
    }
  };

  return (
    <div className="space-y-6 fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-slate-900 leading-tight">Leave & Absence Tracker</h3>
          <p className="text-xs text-slate-500 font-medium">Manage and approve staff time-off requests.</p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setFormState(INITIAL_FORM);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs ${showForm ? 'bg-slate-200 text-slate-700' : theme.btnColors}`}
        >
          {showForm ? <><X size={14} /> Cancel Request</> : <><Plus size={14} /> New Leave Request</>}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSaveRequest} className="bg-white rounded-2xl border border-slate-200/90 shadow-md overflow-hidden transition-all">
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-4 flex items-center justify-between border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
                <CalendarRange size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold font-display uppercase tracking-wider text-white">
                    Submit Staff Absence & Leave Application
                  </h4>
                  <span className="bg-indigo-500/30 text-indigo-200 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border border-indigo-400/30">
                    Time-Off
                  </span>
                </div>
                <p className="text-[11px] text-slate-300/80">Staff selection, date range duration, and justification reason</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {isAdminOrHead && (
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Staff Member <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={selectedTeacherId}
                    onChange={e => setSelectedTeacherId(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 font-medium"
                  >
                    <option value="">Select Staff Member...</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className={isAdminOrHead ? "lg:col-span-1" : "sm:col-span-1"}>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Start Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formState.startDate}
                  onChange={e => setFormState({ ...formState, startDate: e.target.value })}
                  className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono text-slate-800"
                />
              </div>
              <div className={isAdminOrHead ? "lg:col-span-1" : "sm:col-span-1"}>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  End Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formState.endDate}
                  onChange={e => setFormState({ ...formState, endDate: e.target.value })}
                  className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono text-slate-800"
                />
              </div>
              <div className={isAdminOrHead ? "sm:col-span-2 lg:col-span-4" : "sm:col-span-2"}>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason / Justification Remarks <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Medical appointment, family emergency, bereavement leave..."
                  value={formState.reason}
                  onChange={e => setFormState({ ...formState, reason: e.target.value })}
                  className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                />
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className={`flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${theme.btnColors}`}
              >
                <Check size={14} /> Submit Request
              </button>
            </div>
          </div>
        </form>
      )}

      {displayedRequests.length === 0 ? (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-12 text-center rounded-xl">
          <FileText size={36} className="text-slate-300 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-slate-700">No Leave Requests</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">There are no absence or time-off requests on record.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayedRequests.sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime()).map(req => (
            <div key={req.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative overflow-hidden flex flex-col">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h5 className="font-bold text-slate-800 text-sm">{req.teacherName}</h5>
                  <p className="text-[10px] text-slate-400">Requested: {new Date(req.requestDate).toLocaleDateString()}</p>
                </div>
                {getStatusBadge(req.status)}
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-2">
                  <CalendarRange size={14} className="text-indigo-500" />
                  {new Date(req.startDate).toLocaleDateString()} &mdash; {new Date(req.endDate).toLocaleDateString()}
                </div>
                <p className="text-xs text-slate-600 italic">"{req.reason}"</p>
              </div>
              
              {isAdminOrHead && req.status === 'Pending' && (
                <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
                  <button
                    onClick={() => handleAction(req, 'Approved')}
                    className="flex-1 flex justify-center items-center gap-1.5 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    <CheckCircle2 size={14} /> Approve
                  </button>
                  <button
                    onClick={() => handleAction(req, 'Rejected')}
                    className="flex-1 flex justify-center items-center gap-1.5 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
