import React, { useState, useMemo } from 'react';
import { 
  CanteenPlan, CanteenPaymentRecord, Student, ClassType, CLASSES, 
  AcademicYearType, TermType, SchoolInfo 
} from '../../types';
import { DbController } from '../../db';
import { ThemeStyles } from '../ThemeWrapper';
import { triggerToast } from '../../utils';
import { 
  Utensils, Plus, Search, Filter, Printer, Trash2, Edit2, CheckCircle2, 
  Clock, AlertCircle, DollarSign, Users, Calendar, Coffee, FileSpreadsheet, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  theme: ThemeStyles;
  students: Student[];
  schoolInfo: SchoolInfo;
  selectedAcademicYear: AcademicYearType;
  selectedTerm: TermType;
}

export default function CanteenFeedingTab({
  theme,
  students,
  schoolInfo,
  selectedAcademicYear,
  selectedTerm
}: Props) {
  const [plans, setPlans] = useState<CanteenPlan[]>(() => DbController.getCanteenPlans());
  const [payments, setPayments] = useState<CanteenPaymentRecord[]>(() => DbController.getCanteenPayments());

  const [activeSubTab, setActiveSubTab] = useState<'payments' | 'plans' | 'headcount'>('payments');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('All');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Modals
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [payStudentId, setPayStudentId] = useState('');
  const [payPlanId, setPayPlanId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<CanteenPaymentRecord['paymentMethod']>('Cash');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [payRemarks, setPayRemarks] = useState('');

  const [showAddPlanModal, setShowAddPlanModal] = useState(false);
  const [planForm, setPlanForm] = useState<Partial<CanteenPlan>>({
    name: '',
    rate: 15,
    frequency: 'Daily',
    description: ''
  });

  // Filtered Payments
  const filteredPayments = useMemo(() => {
    return payments.filter(pay => {
      const matchesSearch = 
        pay.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pay.studentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pay.planName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesClass = selectedClassFilter === 'All' || pay.studentClass === selectedClassFilter;
      const matchesDate = !dateFilter || pay.date === dateFilter;
      const matchesSession = pay.academicYear === selectedAcademicYear && pay.term === selectedTerm;
      return matchesSearch && matchesClass && matchesDate && matchesSession;
    });
  }, [payments, searchQuery, selectedClassFilter, dateFilter, selectedAcademicYear, selectedTerm]);

  // Statistics
  const stats = useMemo(() => {
    const termPayments = payments.filter(p => p.academicYear === selectedAcademicYear && p.term === selectedTerm);
    const todayStr = new Date().toISOString().split('T')[0];
    const todayPayments = termPayments.filter(p => p.date === todayStr);

    const totalTermCollected = termPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
    const todayCollected = todayPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);

    return {
      totalCollected: totalTermCollected,
      todayCollected,
      totalTransactions: termPayments.length,
      todayCount: todayPayments.length
    };
  }, [payments, selectedAcademicYear, selectedTerm]);

  const [activeReceiptPayment, setActiveReceiptPayment] = useState<CanteenPaymentRecord | null>(null);

  const handlePrintLedger = () => {
    if (typeof (window as any).printTarget === 'function') {
      (window as any).printTarget(
        'canteen-ledger-print-area',
        `Canteen Feeding Fee Register - ${selectedAcademicYear} ${selectedTerm}`,
        false
      );
    } else {
      window.print();
    }
  };

  const handlePrintReceipt = (p: CanteenPaymentRecord) => {
    setActiveReceiptPayment(p);
    setTimeout(() => {
      if (typeof (window as any).printTarget === 'function') {
        (window as any).printTarget(
          'canteen-receipt-print-area',
          `Canteen Feeding Receipt - ${p.receiptNumber}`,
          false
        );
      } else {
        window.print();
      }
    }, 100);
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const student = students.find(s => s.id === payStudentId);
    const plan = plans.find(p => p.id === payPlanId);
    const amount = Number(payAmount);

    if (!student || !plan || isNaN(amount) || amount <= 0) {
      triggerToast('Please provide valid student, meal plan, and amount.', 'error');
      return;
    }

    const newPayment: CanteenPaymentRecord = {
      id: 'cp-' + Date.now(),
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      studentClass: student.class,
      planId: plan.id,
      planName: plan.name,
      term: selectedTerm,
      academicYear: selectedAcademicYear,
      date: payDate,
      amountPaid: amount,
      paymentMethod: payMethod,
      receiptNumber: 'CAN-' + Math.floor(100000 + Math.random() * 900000),
      remarks: payRemarks
    };

    DbController.saveCanteenPayment(newPayment);
    setPayments(DbController.getCanteenPayments());
    setShowAddPaymentModal(false);
    setPayStudentId('');
    setPayPlanId('');
    setPayAmount('');
    setPayRemarks('');
    triggerToast(`Canteen feeding fee GHS ${amount.toFixed(2)} recorded for ${student.firstName}.`, 'success');
    handlePrintReceipt(newPayment);
  };

  const handleDeletePayment = (id: string) => {
    if (confirm('Delete this canteen payment record?')) {
      DbController.deleteCanteenPayment(id);
      setPayments(DbController.getCanteenPayments());
      triggerToast('Payment record removed.', 'info');
    }
  };

  const handleSavePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!planForm.name || !planForm.rate) {
      triggerToast('Please enter plan title and fee rate.', 'error');
      return;
    }
    const payload: CanteenPlan = {
      id: 'plan-' + Date.now(),
      name: planForm.name,
      rate: Number(planForm.rate),
      frequency: planForm.frequency || 'Daily',
      description: planForm.description
    };
    DbController.saveCanteenPlan(payload);
    setPlans(DbController.getCanteenPlans());
    setShowAddPlanModal(false);
    triggerToast('New feeding package plan saved.', 'success');
  };

  const handleDeletePlan = (id: string) => {
    if (confirm('Delete this feeding meal package?')) {
      DbController.deleteCanteenPlan(id);
      setPlans(DbController.getCanteenPlans());
      triggerToast('Plan deleted.', 'info');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0">
              <Utensils size={22} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Canteen & Feeding Fee Administration</h2>
              <p className="text-xs text-slate-500">
                Manage school hot lunches, feeding fee collections, meal cards, and daily catering reports for {selectedAcademicYear} • {selectedTerm}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
            <button
              onClick={() => setActiveSubTab('payments')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeSubTab === 'payments' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Fee Collections
            </button>
            <button
              onClick={() => setActiveSubTab('plans')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeSubTab === 'plans' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Meal Packages ({plans.length})
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrintLedger}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
            title="Generate PDF or Print Canteen Feeding Summary"
          >
            <Printer size={14} />
            <span>Print / PDF Summary</span>
          </button>

          <button
            onClick={() => {
              if (activeSubTab === 'plans') {
                setPlanForm({ name: '', rate: 15, frequency: 'Daily', description: '' });
                setShowAddPlanModal(true);
              } else {
                setShowAddPaymentModal(true);
              }
            }}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Plus size={14} />
            <span>{activeSubTab === 'plans' ? 'Add Package' : 'Record Feeding Fee'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block font-mono">Total Feeding Revenue</span>
          <div className="text-xl font-bold text-emerald-700 mt-1">
            GHS {stats.totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10.5px] text-slate-500 mt-0.5 block">{selectedTerm} Collections</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">Today's Collections</span>
          <div className="text-xl font-bold text-slate-800 mt-1">
            GHS {stats.todayCollected.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10.5px] text-slate-500 mt-0.5 block">{stats.todayCount} students fed today</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block font-mono">Feeding Receipts Issued</span>
          <div className="text-xl font-bold text-indigo-600 mt-1">
            {stats.totalTransactions} Receipts
          </div>
          <span className="text-[10.5px] text-slate-500 mt-0.5 block">Reconciled vouchers</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block font-mono">Available Meal Plans</span>
          <div className="text-xl font-bold text-amber-600 mt-1">
            {plans.length} Options
          </div>
          <span className="text-[10.5px] text-slate-500 mt-0.5 block">Daily, Weekly, Termly</span>
        </div>
      </div>

      {/* PAYMENTS REGISTER */}
      {activeSubTab === 'payments' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
            <div className="flex-1 min-w-[200px] relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student name, ID, or meal package..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-medium focus:outline-none"
              >
                <option value="All">All Classes</option>
                {CLASSES.map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>

              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-medium focus:outline-none"
                title="Filter by payment date"
              />

              {dateFilter && (
                <button
                  onClick={() => setDateFilter('')}
                  className="text-xs text-rose-600 hover:underline cursor-pointer"
                >
                  Clear Date
                </button>
              )}

              <button
                type="button"
                onClick={handlePrintLedger}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                title="Generate PDF or Print Canteen Feeding Summary"
              >
                <Printer size={13} />
                <span>Print / PDF Summary</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-sans">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Receipt #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Class</th>
                    <th className="py-3 px-4">Meal Package</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4 text-right">Amount (GHS)</th>
                    <th className="py-3 px-4">Remarks</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-10 text-slate-400">
                        <Utensils size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="font-semibold text-slate-600">No feeding fee payment records found.</p>
                        <p className="text-[11px] text-slate-400 mt-1">Record daily or weekly canteen collections above.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-600">{p.receiptNumber}</td>
                        <td className="py-3 px-4 font-mono text-slate-500">{p.date}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          <div>{p.studentName}</div>
                          <span className="font-mono text-[10px] text-slate-400">{p.studentId}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-semibold text-[10.5px]">
                            {p.studentClass}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium">{p.planName}</td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{p.paymentMethod}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 text-sm">
                          {p.amountPaid.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-slate-400 italic text-[11px]">
                          {p.remarks || '-'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handlePrintReceipt(p)}
                              className="p-1 hover:bg-emerald-50 text-slate-400 hover:text-emerald-700 rounded transition cursor-pointer"
                              title="Print Feeding Receipt"
                            >
                              <Printer size={13} />
                            </button>
                            <button
                              onClick={() => handleDeletePayment(p.id)}
                              className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                              title="Delete receipt"
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

      {/* PLANS VIEW */}
      {activeSubTab === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map(plan => (
            <div key={plan.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between">
                  <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                    <Coffee size={18} />
                  </span>
                  <button
                    onClick={() => handleDeletePlan(plan.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <h4 className="font-bold text-slate-800 text-sm mt-3">{plan.name}</h4>
                <div className="text-xl font-extrabold text-emerald-700 font-mono mt-1">
                  GHS {plan.rate.toFixed(2)}{' '}
                  <span className="text-xs font-normal text-slate-400">/{plan.frequency.toLowerCase()}</span>
                </div>
                {plan.description && (
                  <p className="text-xs text-slate-500 mt-2">{plan.description}</p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span>Billing Interval:</span>
                <span className="font-bold text-slate-700">{plan.frequency}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      <AnimatePresence>
        {showAddPaymentModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4"
            >
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Utensils size={18} className="text-emerald-600" />
                <span>Receive Canteen Feeding Fee</span>
              </h3>

              <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Select Student *</label>
                  <select
                    value={payStudentId}
                    onChange={(e) => setPayStudentId(e.target.value)}
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
                  <label className="block text-slate-700 font-bold mb-1">Meal Package Plan *</label>
                  <select
                    value={payPlanId}
                    onChange={(e) => {
                      setPayPlanId(e.target.value);
                      const chosen = plans.find(p => p.id === e.target.value);
                      if (chosen) setPayAmount(String(chosen.rate));
                    }}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="">-- Choose meal package --</option>
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} - GHS {p.rate} ({p.frequency})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Amount Paid (GHS) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Payment Method</label>
                    <select
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Mobile Money">Mobile Money (MoMo)</option>
                      <option value="Bank">Bank Deposit</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Remarks / Notes</label>
                  <input
                    type="text"
                    value={payRemarks}
                    onChange={(e) => setPayRemarks(e.target.value)}
                    placeholder="e.g. Paid for 2 weeks in advance"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddPaymentModal(false)}
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

      {/* ADD PLAN MODAL */}
      <AnimatePresence>
        {showAddPlanModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4"
            >
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Coffee size={18} className="text-emerald-600" />
                <span>Create Canteen Meal Package</span>
              </h3>

              <form onSubmit={handleSavePlan} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Package Title *</label>
                  <input
                    type="text"
                    value={planForm.name}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Standard Daily Hot Lunch"
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Fee Rate (GHS) *</label>
                    <input
                      type="number"
                      step="0.5"
                      value={planForm.rate}
                      onChange={(e) => setPlanForm(prev => ({ ...prev, rate: Number(e.target.value) }))}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Interval</label>
                    <select
                      value={planForm.frequency}
                      onChange={(e) => setPlanForm(prev => ({ ...prev, frequency: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="Daily">Daily</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Termly">Termly</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={planForm.description}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Details about menu, diet, or included snacks..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddPlanModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-semibold hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs transition cursor-pointer"
                  >
                    Save Meal Plan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DEDICATED OFFICIAL PRINTABLE CANTEEN FEEDING REGISTER */}
      <div id="canteen-ledger-print-area" className="hidden print:block font-sans text-slate-900 bg-white p-4">
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-4 text-center">
          <h1 className="text-xl font-black uppercase tracking-tight text-slate-950">
            {schoolInfo?.name || 'GeeTech Academy'}
          </h1>
          <p className="text-xs text-slate-600 font-medium mt-0.5">
            {schoolInfo?.gpsAddress || 'P.O. Box 1234, Accra, Ghana'} • Tel: {schoolInfo?.telephone || '+233 24 000 0000'}
          </p>
          <div className="inline-block mt-2 px-3 py-1 bg-slate-900 text-white font-mono text-xs font-bold uppercase tracking-widest rounded">
            CANTEEN &amp; FEEDING FEE OFFICIAL REGISTER
          </div>
          <p className="text-xs font-bold text-slate-700 mt-2">
            Academic Session: {selectedAcademicYear} • {selectedTerm} {dateFilter ? `| Filter Date: ${dateFilter}` : ''}
          </p>
        </div>

        {/* Metrics Overview */}
        <div className="grid grid-cols-4 gap-3 mb-4 text-center">
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Total Feeding Revenue</span>
            <span className="text-sm font-black text-emerald-800 font-mono">GH₵ {stats.totalCollected.toFixed(2)}</span>
          </div>
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Today's Collections</span>
            <span className="text-sm font-black text-slate-900 font-mono">GH₵ {stats.todayCollected.toFixed(2)}</span>
          </div>
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Receipts Issued</span>
            <span className="text-sm font-black text-indigo-900">{stats.totalTransactions} Vouchers</span>
          </div>
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Active Meal Packages</span>
            <span className="text-sm font-black text-amber-900">{plans.length} Options</span>
          </div>
        </div>

        {/* Feeding Collections Table */}
        <table className="w-full border-collapse border border-slate-400 text-[11px] mb-4">
          <thead>
            <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-400">
              <th className="border border-slate-400 p-1.5 text-center w-8">#</th>
              <th className="border border-slate-400 p-1.5 text-left">Receipt #</th>
              <th className="border border-slate-400 p-1.5 text-left">Date</th>
              <th className="border border-slate-400 p-1.5 text-left">Student Name</th>
              <th className="border border-slate-400 p-1.5 text-center">Class</th>
              <th className="border border-slate-400 p-1.5 text-left">Meal Package</th>
              <th className="border border-slate-400 p-1.5 text-center">Mode</th>
              <th className="border border-slate-400 p-1.5 text-right">Amount (GH₵)</th>
              <th className="border border-slate-400 p-1.5 text-left">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.length === 0 ? (
              <tr>
                <td colSpan={9} className="border border-slate-400 p-4 text-center text-slate-500">
                  No canteen transactions recorded for this period.
                </td>
              </tr>
            ) : (
              filteredPayments.map((p, idx) => (
                <tr key={p.id} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                  <td className="border border-slate-400 p-1.5 text-center font-mono">{idx + 1}</td>
                  <td className="border border-slate-400 p-1.5 font-mono font-bold">{p.receiptNumber}</td>
                  <td className="border border-slate-400 p-1.5 font-mono">{p.date}</td>
                  <td className="border border-slate-400 p-1.5 font-bold text-slate-900">{p.studentName}</td>
                  <td className="border border-slate-400 p-1.5 text-center font-semibold">{p.studentClass}</td>
                  <td className="border border-slate-400 p-1.5">{p.planName}</td>
                  <td className="border border-slate-400 p-1.5 text-center">{p.paymentMethod}</td>
                  <td className="border border-slate-400 p-1.5 text-right font-mono font-bold text-slate-900">{p.amountPaid.toFixed(2)}</td>
                  <td className="border border-slate-400 p-1.5 text-slate-600 text-[10px]">{p.remarks || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-900">
              <td colSpan={7} className="border border-slate-400 p-1.5 text-right uppercase">Total Feeding Revenue:</td>
              <td className="border border-slate-400 p-1.5 text-right font-mono">GH₵ {filteredPayments.reduce((s, p) => s + p.amountPaid, 0).toFixed(2)}</td>
              <td className="border border-slate-400 p-1.5 text-center text-[10px]">{filteredPayments.length} Total Records</td>
            </tr>
          </tfoot>
        </table>

        {/* Signatures */}
        <div className="grid grid-cols-3 gap-8 pt-6 mt-4 border-t border-slate-400 text-center text-xs">
          <div>
            <div className="border-b border-slate-900 pb-8 mb-1"></div>
            <p className="font-bold text-slate-900 uppercase">Catering / Canteen Head</p>
            <p className="text-[10px] text-slate-500">Signature &amp; Date</p>
          </div>
          <div>
            <div className="border-b border-slate-900 pb-8 mb-1"></div>
            <p className="font-bold text-slate-900 uppercase">Accounts Clerk</p>
            <p className="text-[10px] text-slate-500">Signature &amp; Date</p>
          </div>
          <div>
            <div className="border-b border-slate-900 pb-8 mb-1"></div>
            <p className="font-bold text-slate-900 uppercase">Head of Institution</p>
            <p className="text-[10px] text-slate-500">Official Stamp &amp; Date</p>
          </div>
        </div>
      </div>

      {/* DEDICATED PRINTABLE SINGLE CANTEEN MEAL RECEIPT */}
      {activeReceiptPayment && (
        <div id="canteen-receipt-print-area" className="hidden print:block font-sans text-slate-900 bg-white p-4 border border-slate-400 max-w-lg mx-auto">
          <div className="border-b-2 border-slate-900 pb-3 text-center">
            <h2 className="text-base font-black uppercase text-slate-950">{schoolInfo?.name || 'GeeTech Academy'}</h2>
            <p className="text-[10px] text-slate-600">{schoolInfo?.gpsAddress || 'Accra, Ghana'} • Tel: {schoolInfo?.telephone || '+233 24 000 0000'}</p>
            <div className="inline-block mt-1 px-2 py-0.5 bg-emerald-800 text-white font-mono text-[10px] font-bold uppercase rounded">
              OFFICIAL FEEDING PAYMENT RECEIPT
            </div>
          </div>
          <div className="py-3 space-y-1.5 text-xs">
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span className="text-slate-500 font-medium">Receipt Number:</span>
              <span className="font-mono font-bold">{activeReceiptPayment.receiptNumber}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span className="text-slate-500 font-medium">Date &amp; Time:</span>
              <span className="font-mono">{activeReceiptPayment.date}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span className="text-slate-500 font-medium">Student Name:</span>
              <span className="font-bold text-slate-900">{activeReceiptPayment.studentName} ({activeReceiptPayment.studentClass})</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span className="text-slate-500 font-medium">Student ID:</span>
              <span className="font-mono">{activeReceiptPayment.studentId}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span className="text-slate-500 font-medium">Meal Plan:</span>
              <span className="font-semibold">{activeReceiptPayment.planName}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span className="text-slate-500 font-medium">Academic Session:</span>
              <span>{activeReceiptPayment.academicYear} • {activeReceiptPayment.term}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span className="text-slate-500 font-medium">Payment Mode:</span>
              <span>{activeReceiptPayment.paymentMethod}</span>
            </div>
            <div className="flex justify-between pt-2 text-sm font-black text-emerald-800">
              <span>AMOUNT PAID:</span>
              <span className="font-mono">GH₵ {activeReceiptPayment.amountPaid.toFixed(2)}</span>
            </div>
            {activeReceiptPayment.remarks && (
              <p className="text-[10px] text-slate-500 italic pt-1">Note: {activeReceiptPayment.remarks}</p>
            )}
          </div>
          <div className="border-t border-dashed border-slate-400 pt-3 text-center text-[10px] text-slate-500">
            Thank you for your prompt feeding payment. • Validated by School Bursary
          </div>
        </div>
      )}
    </div>
  );
}
