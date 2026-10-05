import React, { useState, useMemo } from 'react';
import { 
  SportsActivity, StudentSportsRecord, Student, ClassType, CLASSES, 
  AcademicYearType, TermType, SchoolInfo 
} from '../../types';
import { DbController } from '../../db';
import { ThemeStyles } from '../ThemeWrapper';
import { triggerToast } from '../../utils';
import { 
  Trophy, Plus, Search, Filter, Printer, Trash2, Edit2, CheckCircle2, 
  Clock, AlertCircle, DollarSign, Users, Award, Shield, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  theme: ThemeStyles;
  students: Student[];
  schoolInfo: SchoolInfo;
  selectedAcademicYear: AcademicYearType;
  selectedTerm: TermType;
}

export default function SportsFinancesTab({
  theme,
  students,
  schoolInfo,
  selectedAcademicYear,
  selectedTerm
}: Props) {
  const [activities, setActivities] = useState<SportsActivity[]>(() => DbController.getSportsActivities());
  const [records, setRecords] = useState<StudentSportsRecord[]>(() => DbController.getSportsRecords());

  const [activeView, setActiveView] = useState<'roster' | 'activities'>('roster');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActivityFilter, setSelectedActivityFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Partial' | 'Unpaid'>('All');

  // Modals
  const [showAddActivityModal, setShowAddActivityModal] = useState(false);
  const [activityForm, setActivityForm] = useState<Partial<SportsActivity>>({
    title: '',
    category: 'Annual Levy',
    amount: 50,
    description: ''
  });

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignStudentId, setAssignStudentId] = useState('');
  const [assignActivityId, setAssignActivityId] = useState('');
  const [assignHouse, setAssignHouse] = useState('Red House');

  const [showPayModal, setShowPayModal] = useState(false);
  const [activeRecordForPay, setActiveRecordForPay] = useState<StudentSportsRecord | null>(null);
  const [payAmount, setPayAmount] = useState('');

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchesSearch = 
        r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.studentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.activityTitle.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesActivity = selectedActivityFilter === 'All' || r.activityId === selectedActivityFilter;
      const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
      return matchesSearch && matchesActivity && matchesStatus;
    });
  }, [records, searchQuery, selectedActivityFilter, statusFilter]);

  const stats = useMemo(() => {
    const totalBilled = records.reduce((sum, r) => sum + r.feeAmount, 0);
    const totalPaid = records.reduce((sum, r) => sum + r.paidAmount, 0);
    const totalBalance = records.reduce((sum, r) => sum + r.balance, 0);
    return {
      totalStudents: records.length,
      totalBilled,
      totalPaid,
      totalBalance,
      collectionRate: totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 0
    };
  }, [records]);

  const handleSaveActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityForm.title || !activityForm.amount) {
      triggerToast('Please provide activity title and fee amount.', 'error');
      return;
    }
    const payload: SportsActivity = {
      id: 'sp-' + Date.now(),
      title: activityForm.title,
      category: activityForm.category || 'Annual Levy',
      amount: Number(activityForm.amount),
      term: selectedTerm,
      academicYear: selectedAcademicYear,
      description: activityForm.description
    };
    DbController.saveSportsActivity(payload);
    setActivities(DbController.getSportsActivities());
    setShowAddActivityModal(false);
    triggerToast('New sports activity / levy created.', 'success');
  };

  const handleDeleteActivity = (id: string) => {
    if (confirm('Delete this sports activity?')) {
      DbController.deleteSportsActivity(id);
      setActivities(DbController.getSportsActivities());
      triggerToast('Sports activity deleted.', 'info');
    }
  };

  const handleAssignStudent = (e: React.FormEvent) => {
    e.preventDefault();
    const student = students.find(s => s.id === assignStudentId);
    const activity = activities.find(a => a.id === assignActivityId);
    if (!student || !activity) {
      triggerToast('Please select student and sports activity.', 'error');
      return;
    }

    const payload: StudentSportsRecord = {
      id: 'sr-' + Date.now(),
      activityId: activity.id,
      activityTitle: activity.title,
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      studentClass: student.class,
      house: assignHouse,
      feeAmount: activity.amount,
      paidAmount: 0,
      balance: activity.amount,
      status: 'Unpaid'
    };

    DbController.saveSportsRecord(payload);
    setRecords(DbController.getSportsRecords());
    setShowAssignModal(false);
    setAssignStudentId('');
    setAssignActivityId('');
    triggerToast(`Enrolled ${student.firstName} for ${activity.title}.`, 'success');
  };

  const [activeReceiptRecord, setActiveReceiptRecord] = useState<StudentSportsRecord | null>(null);

  const handlePrintLedger = () => {
    if (typeof (window as any).printTarget === 'function') {
      (window as any).printTarget(
        'sports-ledger-print-area',
        `Sports & Athletics Financial Ledger - ${selectedAcademicYear} ${selectedTerm}`,
        false
      );
    } else {
      window.print();
    }
  };

  const handlePrintReceipt = (rec: StudentSportsRecord) => {
    setActiveReceiptRecord(rec);
    setTimeout(() => {
      if (typeof (window as any).printTarget === 'function') {
        (window as any).printTarget(
          'sports-receipt-print-area',
          `Sports Subscription Receipt - ${rec.receiptNumber || 'Receipt'}`,
          false
        );
      } else {
        window.print();
      }
    }, 100);
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRecordForPay) return;
    const amt = Number(payAmount);
    if (isNaN(amt) || amt <= 0) {
      triggerToast('Please enter a valid amount.', 'error');
      return;
    }
    const newPaid = activeRecordForPay.paidAmount + amt;
    const newBal = Math.max(0, activeRecordForPay.feeAmount - newPaid);
    const newStatus: StudentSportsRecord['status'] = newBal === 0 ? 'Paid' : 'Partial';

    const updated: StudentSportsRecord = {
      ...activeRecordForPay,
      paidAmount: newPaid,
      balance: newBal,
      status: newStatus,
      paymentDate: new Date().toISOString().split('T')[0],
      receiptNumber: 'SPT-' + Math.floor(100000 + Math.random() * 900000)
    };

    DbController.saveSportsRecord(updated);
    setRecords(DbController.getSportsRecords());
    setShowPayModal(false);
    setActiveRecordForPay(null);
    setPayAmount('');
    triggerToast(`Payment of GHS ${amt.toFixed(2)} recorded for ${updated.studentName}.`, 'success');
    handlePrintReceipt(updated);
  };

  const handleDeleteRecord = (id: string) => {
    if (confirm('Delete this sports fee ledger entry?')) {
      DbController.deleteSportsRecord(id);
      setRecords(DbController.getSportsRecords());
      triggerToast('Record removed.', 'info');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-orange-50 text-orange-600 border border-orange-200 shrink-0">
              <Trophy size={22} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Sports & Co-Curricular Finances</h2>
              <p className="text-xs text-slate-500">
                Manage annual sports levies, house jerseys/kits, athletics tournament dues, and collections for {selectedAcademicYear} • {selectedTerm}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
            <button
              onClick={() => setActiveView('roster')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeView === 'roster' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sports Dues Ledger
            </button>
            <button
              onClick={() => setActiveView('activities')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeView === 'activities' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Levies & Kits ({activities.length})
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrintLedger}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
            title="Generate PDF or Print Sports Finance Summary"
          >
            <Printer size={14} />
            <span>Print / PDF Summary</span>
          </button>

          {activeView === 'roster' ? (
            <button
              onClick={() => setShowAssignModal(true)}
              className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Plus size={14} />
              <span>Bill Student</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setActivityForm({ title: '', category: 'Annual Levy', amount: 50, description: '' });
                setShowAddActivityModal(true);
              }}
              className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Plus size={14} />
              <span>Add Levy / Kit</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Billed Students</span>
          <div className="text-xl font-bold text-slate-800 mt-1 flex items-center gap-2">
            <Users size={18} className="text-orange-500" />
            <span>{stats.totalStudents} Entries</span>
          </div>
          <span className="text-[10.5px] text-slate-500 mt-0.5 block">Active sports billings</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Total Sports Dues Billed</span>
          <div className="text-xl font-bold text-slate-800 mt-1">
            GHS {stats.totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10.5px] text-slate-500 mt-0.5 block">Expected sports funds</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block font-mono">Collected</span>
          <div className="text-xl font-bold text-emerald-700 mt-1">
            GHS {stats.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10.5px] text-emerald-600 mt-0.5 block font-semibold">{stats.collectionRate}% Recovered</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block font-mono">Outstanding Dues</span>
          <div className="text-xl font-bold text-rose-600 mt-1">
            GHS {stats.totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10.5px] text-rose-500 mt-0.5 block">Pending sports balances</span>
        </div>
      </div>

      {/* ROSTER TABLE */}
      {activeView === 'roster' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
            <div className="flex-1 min-w-[200px] relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student, ID, or activity..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedActivityFilter}
                onChange={(e) => setSelectedActivityFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-medium focus:outline-none"
              >
                <option value="All">All Activities / Levies</option>
                {activities.map(a => (
                  <option key={a.id} value={a.id}>{a.title}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-medium focus:outline-none"
              >
                <option value="All">All Statuses</option>
                <option value="Paid">Paid</option>
                <option value="Partial">Partial</option>
                <option value="Unpaid">Unpaid</option>
              </select>

              <button
                type="button"
                onClick={handlePrintLedger}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                title="Generate PDF or Print Sports Finance Summary"
              >
                <Printer size={13} />
                <span>Print / PDF Summary</span>
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-sans">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Class</th>
                    <th className="py-3 px-4">House</th>
                    <th className="py-3 px-4">Sports Levy / Kit Item</th>
                    <th className="py-3 px-4 text-right">Fee (GHS)</th>
                    <th className="py-3 px-4 text-right">Paid (GHS)</th>
                    <th className="py-3 px-4 text-right">Balance (GHS)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-10 text-slate-400">
                        <Trophy size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="font-semibold text-slate-600">No sports fee records found.</p>
                        <p className="text-[11px] text-slate-400 mt-1">Assign sports dues or kit billings to students.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map(rec => (
                      <tr key={rec.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          <div>{rec.studentName}</div>
                          <span className="font-mono text-[10px] text-slate-400">{rec.studentId}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-semibold text-[10.5px]">
                            {rec.studentClass}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-slate-100 text-slate-800">
                            {rec.house || 'General'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium">{rec.activityTitle}</td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-slate-700">
                          {rec.feeAmount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                          {rec.paidAmount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                          {rec.balance.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            rec.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            rec.status === 'Partial' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {rec.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handlePrintReceipt(rec)}
                              className="p-1 hover:bg-orange-50 text-slate-400 hover:text-orange-700 rounded transition cursor-pointer"
                              title="Print Sports Receipt"
                            >
                              <Printer size={13} />
                            </button>
                            <button
                              onClick={() => {
                                setActiveRecordForPay(rec);
                                setPayAmount(rec.balance > 0 ? String(rec.balance) : '');
                                setShowPayModal(true);
                              }}
                              className="px-2.5 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-lg font-bold text-[11px] transition cursor-pointer"
                            >
                              Pay
                            </button>
                            <button
                              onClick={() => handleDeleteRecord(rec.id)}
                              className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVITIES VIEW */}
      {activeView === 'activities' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {activities.map(act => (
            <div key={act.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between">
                  <span className="p-2 rounded-xl bg-orange-50 text-orange-600 border border-orange-200">
                    <Trophy size={18} />
                  </span>
                  <button
                    onClick={() => handleDeleteActivity(act.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <span className="inline-block mt-2 px-2 py-0.5 rounded text-[9.5px] font-black uppercase tracking-wider bg-orange-50 text-orange-700">
                  {act.category}
                </span>
                <h4 className="font-bold text-slate-800 text-sm mt-1">{act.title}</h4>
                <div className="text-xl font-extrabold text-orange-600 font-mono mt-2">
                  GHS {act.amount.toFixed(2)}
                </div>
                {act.description && (
                  <p className="text-xs text-slate-500 mt-2">{act.description}</p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span>Academic Session:</span>
                <span className="font-bold text-slate-700">{act.academicYear} • {act.term}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE ACTIVITY MODAL */}
      <AnimatePresence>
        {showAddActivityModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4"
            >
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Trophy size={18} className="text-orange-500" />
                <span>Create Sports Activity / Levy</span>
              </h3>

              <form onSubmit={handleSaveActivity} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Title *</label>
                  <input
                    type="text"
                    value={activityForm.title}
                    onChange={(e) => setActivityForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Inter-House Athletic Levy"
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Category</label>
                    <select
                      value={activityForm.category}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, category: e.target.value as any }))}
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="Annual Levy">Annual Levy</option>
                      <option value="Sports Kit">Sports Kit</option>
                      <option value="Tournament Fee">Tournament Fee</option>
                      <option value="Club Dues">Club Dues</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Amount (GHS) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={activityForm.amount}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, amount: Number(e.target.value) }))}
                      required
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-lg font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={activityForm.description}
                    onChange={(e) => setActivityForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Details about jersey kit or sports meet..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddActivityModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-semibold hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold shadow-xs transition cursor-pointer"
                  >
                    Save Activity
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BILL STUDENT MODAL */}
      <AnimatePresence>
        {showAssignModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4"
            >
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Award size={18} className="text-orange-500" />
                <span>Bill Student for Sports Dues</span>
              </h3>

              <form onSubmit={handleAssignStudent} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Select Student *</label>
                  <select
                    value={assignStudentId}
                    onChange={(e) => setAssignStudentId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="">-- Choose student --</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.firstName} {s.lastName} ({s.class}) - {s.id}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Sports Levy / Kit Item *</label>
                  <select
                    value={assignActivityId}
                    onChange={(e) => setAssignActivityId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="">-- Choose activity / item --</option>
                    {activities.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.title} (GHS {a.amount.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">House Allocation</label>
                  <select
                    value={assignHouse}
                    onChange={(e) => setAssignHouse(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Red House (Aggrey)">Red House (Aggrey)</option>
                    <option value="Blue House (Guggisberg)">Blue House (Guggisberg)</option>
                    <option value="Green House (Fraser)">Green House (Fraser)</option>
                    <option value="Gold House (Nkrumah)">Gold House (Nkrumah)</option>
                    <option value="General">General / All Houses</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAssignModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-semibold hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold shadow-xs transition cursor-pointer"
                  >
                    Add Billing
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RECORD PAYMENT MODAL */}
      <AnimatePresence>
        {showPayModal && activeRecordForPay && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4"
            >
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <DollarSign size={18} className="text-emerald-600" />
                <span>Receive Sports Payment</span>
              </h3>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1">
                <div className="font-bold text-slate-800">{activeRecordForPay.studentName}</div>
                <div className="text-slate-500">{activeRecordForPay.activityTitle}</div>
                <div className="flex justify-between font-mono pt-1 text-slate-600">
                  <span>Balance Due:</span>
                  <strong className="text-rose-600">GHS {activeRecordForPay.balance.toFixed(2)}</strong>
                </div>
              </div>

              <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Amount Paid (GHS) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    required
                    max={activeRecordForPay.balance}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowPayModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-semibold hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs transition cursor-pointer flex items-center gap-1"
                  >
                    <Check size={14} /> Record & Print
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DEDICATED OFFICIAL PRINTABLE SPORTS LEDGER */}
      <div id="sports-ledger-print-area" className="hidden print:block font-sans text-slate-900 bg-white p-4">
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-4 text-center">
          <h1 className="text-xl font-black uppercase tracking-tight text-slate-950">
            {schoolInfo?.name || 'GeeTech Academy'}
          </h1>
          <p className="text-xs text-slate-600 font-medium mt-0.5">
            {schoolInfo?.gpsAddress || 'P.O. Box 1234, Accra, Ghana'} • Tel: {schoolInfo?.telephone || '+233 24 000 0000'}
          </p>
          <div className="inline-block mt-2 px-3 py-1 bg-slate-900 text-white font-mono text-xs font-bold uppercase tracking-widest rounded">
            SPORTS, ATHLETICS &amp; KIT FINANCIAL LEDGER
          </div>
          <p className="text-xs font-bold text-slate-700 mt-2">
            Academic Session: {selectedAcademicYear} • {selectedTerm} | Status: {statusFilter === 'All' ? 'All Records' : statusFilter}
          </p>
        </div>

        {/* Metrics Summary */}
        <div className="grid grid-cols-5 gap-2 mb-4 text-center">
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Enrolled Students</span>
            <span className="text-sm font-black text-slate-900">{stats.totalStudents} Students</span>
          </div>
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Total Dues Billed</span>
            <span className="text-sm font-black text-slate-900 font-mono">GH₵ {stats.totalBilled.toFixed(2)}</span>
          </div>
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Total Dues Paid</span>
            <span className="text-sm font-black text-emerald-800 font-mono">GH₵ {stats.totalPaid.toFixed(2)}</span>
          </div>
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Outstanding</span>
            <span className="text-sm font-black text-rose-800 font-mono">GH₵ {stats.totalBalance.toFixed(2)}</span>
          </div>
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Collection Rate</span>
            <span className="text-sm font-black text-indigo-900">{stats.collectionRate}%</span>
          </div>
        </div>

        {/* Sports Table */}
        <table className="w-full border-collapse border border-slate-400 text-[11px] mb-4">
          <thead>
            <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-400">
              <th className="border border-slate-400 p-1.5 text-center w-8">#</th>
              <th className="border border-slate-400 p-1.5 text-left">Student Name</th>
              <th className="border border-slate-400 p-1.5 text-left">Student ID</th>
              <th className="border border-slate-400 p-1.5 text-center">Class</th>
              <th className="border border-slate-400 p-1.5 text-center">House</th>
              <th className="border border-slate-400 p-1.5 text-left">Sports Levy / Kit Item</th>
              <th className="border border-slate-400 p-1.5 text-right">Fee (GH₵)</th>
              <th className="border border-slate-400 p-1.5 text-right">Paid (GH₵)</th>
              <th className="border border-slate-400 p-1.5 text-right">Balance (GH₵)</th>
              <th className="border border-slate-400 p-1.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={10} className="border border-slate-400 p-4 text-center text-slate-500">
                  No sports ledger records match the selected criteria.
                </td>
              </tr>
            ) : (
              filteredRecords.map((rec, idx) => (
                <tr key={rec.id} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                  <td className="border border-slate-400 p-1.5 text-center font-mono">{idx + 1}</td>
                  <td className="border border-slate-400 p-1.5 font-bold text-slate-900">{rec.studentName}</td>
                  <td className="border border-slate-400 p-1.5 font-mono text-[10px]">{rec.studentId}</td>
                  <td className="border border-slate-400 p-1.5 text-center font-semibold">{rec.studentClass}</td>
                  <td className="border border-slate-400 p-1.5 text-center font-medium">{rec.house || 'General'}</td>
                  <td className="border border-slate-400 p-1.5">{rec.activityTitle}</td>
                  <td className="border border-slate-400 p-1.5 text-right font-mono">{rec.feeAmount.toFixed(2)}</td>
                  <td className="border border-slate-400 p-1.5 text-right font-mono font-bold text-slate-900">{rec.paidAmount.toFixed(2)}</td>
                  <td className="border border-slate-400 p-1.5 text-right font-mono font-bold text-slate-900">{rec.balance.toFixed(2)}</td>
                  <td className="border border-slate-400 p-1.5 text-center font-bold">{rec.status}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-900">
              <td colSpan={6} className="border border-slate-400 p-1.5 text-right uppercase">Total Sports Collections:</td>
              <td className="border border-slate-400 p-1.5 text-right font-mono">GH₵ {stats.totalBilled.toFixed(2)}</td>
              <td className="border border-slate-400 p-1.5 text-right font-mono">GH₵ {stats.totalPaid.toFixed(2)}</td>
              <td className="border border-slate-400 p-1.5 text-right font-mono">GH₵ {stats.totalBalance.toFixed(2)}</td>
              <td className="border border-slate-400 p-1.5 text-center">{stats.collectionRate}% Paid</td>
            </tr>
          </tfoot>
        </table>

        {/* Signatures */}
        <div className="grid grid-cols-3 gap-8 pt-6 mt-4 border-t border-slate-400 text-center text-xs">
          <div>
            <div className="border-b border-slate-900 pb-8 mb-1"></div>
            <p className="font-bold text-slate-900 uppercase">Sports Master / Coach</p>
            <p className="text-[10px] text-slate-500">Signature &amp; Date</p>
          </div>
          <div>
            <div className="border-b border-slate-900 pb-8 mb-1"></div>
            <p className="font-bold text-slate-900 uppercase">Accountant / Bursar</p>
            <p className="text-[10px] text-slate-500">Signature &amp; Date</p>
          </div>
          <div>
            <div className="border-b border-slate-900 pb-8 mb-1"></div>
            <p className="font-bold text-slate-900 uppercase">Head of Institution</p>
            <p className="text-[10px] text-slate-500">Official Stamp &amp; Date</p>
          </div>
        </div>
      </div>

      {/* DEDICATED PRINTABLE SINGLE SPORTS RECEIPT */}
      {activeReceiptRecord && (
        <div id="sports-receipt-print-area" className="hidden print:block font-sans text-slate-900 bg-white p-4 border border-slate-400 max-w-lg mx-auto">
          <div className="border-b-2 border-slate-900 pb-3 text-center">
            <h2 className="text-base font-black uppercase text-slate-950">{schoolInfo?.name || 'GeeTech Academy'}</h2>
            <p className="text-[10px] text-slate-600">{schoolInfo?.gpsAddress || 'Accra, Ghana'} • Tel: {schoolInfo?.telephone || '+233 24 000 0000'}</p>
            <div className="inline-block mt-1 px-2 py-0.5 bg-orange-700 text-white font-mono text-[10px] font-bold uppercase rounded">
              OFFICIAL SPORTS &amp; KIT LEVY RECEIPT
            </div>
          </div>
          <div className="py-3 space-y-1.5 text-xs">
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span className="text-slate-500 font-medium">Receipt Number:</span>
              <span className="font-mono font-bold">{activeReceiptRecord.receiptNumber || 'N/A'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span className="text-slate-500 font-medium">Payment Date:</span>
              <span className="font-mono">{activeReceiptRecord.paymentDate || 'N/A'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span className="text-slate-500 font-medium">Student Name:</span>
              <span className="font-bold text-slate-900">{activeReceiptRecord.studentName} ({activeReceiptRecord.studentClass})</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span className="text-slate-500 font-medium">Sports House:</span>
              <span className="font-semibold">{activeReceiptRecord.house || 'General House'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span className="text-slate-500 font-medium">Item / Subscription:</span>
              <span className="font-semibold">{activeReceiptRecord.activityTitle}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span className="text-slate-500 font-medium">Session:</span>
              <span>{selectedAcademicYear} • {selectedTerm}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span className="text-slate-500 font-medium">Total Billed:</span>
              <span className="font-mono">GH₵ {activeReceiptRecord.feeAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1 text-emerald-800 font-bold">
              <span>Amount Paid:</span>
              <span className="font-mono">GH₵ {activeReceiptRecord.paidAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-1 font-bold text-slate-900">
              <span>Remaining Balance:</span>
              <span className="font-mono">GH₵ {activeReceiptRecord.balance.toFixed(2)}</span>
            </div>
          </div>
          <div className="border-t border-dashed border-slate-400 pt-3 text-center text-[10px] text-slate-500">
            Official receipt for sports kit &amp; athletics subscription. • Sports Department &amp; Bursary
          </div>
        </div>
      )}
    </div>
  );
}
