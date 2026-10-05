import React, { useState, useMemo } from 'react';
import { 
  SchoolExcursion, ExcursionParticipant, Student, ClassType, CLASSES, 
  AcademicYearType, TermType, SchoolInfo 
} from '../../types';
import { DbController } from '../../db';
import { ThemeStyles } from '../ThemeWrapper';
import { triggerToast } from '../../utils';
import { 
  Compass, Plus, Search, Filter, Printer, Trash2, Edit2, CheckCircle2, 
  Clock, AlertCircle, DollarSign, Users, MapPin, Calendar, FileText, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  theme: ThemeStyles;
  students: Student[];
  schoolInfo: SchoolInfo;
  selectedAcademicYear: AcademicYearType;
  selectedTerm: TermType;
}

export default function ExcursionTab({
  theme,
  students,
  schoolInfo,
  selectedAcademicYear,
  selectedTerm
}: Props) {
  const [excursions, setExcursions] = useState<SchoolExcursion[]>(() => DbController.getExcursions());
  const [participants, setParticipants] = useState<ExcursionParticipant[]>(() => DbController.getExcursionParticipants());

  const [selectedExcursionId, setSelectedExcursionId] = useState<string>(() => {
    const list = DbController.getExcursions();
    return list[0]?.id || '';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Partial' | 'Unpaid'>('All');

  // Modals
  const [showAddExcursionModal, setShowAddExcursionModal] = useState(false);
  const [editingExcursion, setEditingExcursion] = useState<SchoolExcursion | null>(null);
  const [excursionForm, setExcursionForm] = useState<Partial<SchoolExcursion>>({
    title: '',
    destination: '',
    targetClasses: ['Basic 4', 'Basic 5', 'Basic 6', 'Basic 7', 'Basic 8', 'Basic 9'],
    eventDate: '2026-11-20',
    feePerStudent: 250,
    estimatedLogisticsCost: 3500,
    description: '',
    status: 'Upcoming'
  });

  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);
  const [regStudentId, setRegStudentId] = useState('');
  const [regEmergencyContact, setRegEmergencyContact] = useState('');
  const [regConsentSigned, setRegConsentSigned] = useState(true);

  const [showPayModal, setShowPayModal] = useState(false);
  const [activeParticipantForPay, setActiveParticipantForPay] = useState<ExcursionParticipant | null>(null);
  const [payAmount, setPayAmount] = useState('');

  const currentExcursion = excursions.find(e => e.id === selectedExcursionId) || excursions[0];

  const currentParticipants = useMemo(() => {
    if (!currentExcursion) return [];
    return participants.filter(p => p.excursionId === currentExcursion.id);
  }, [participants, currentExcursion]);

  const filteredParticipants = useMemo(() => {
    return currentParticipants.filter(p => {
      const matchesSearch = 
        p.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.studentId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [currentParticipants, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    if (!currentExcursion) return { registered: 0, totalBilled: 0, totalPaid: 0, totalBalance: 0, netMargin: 0 };
    const registered = currentParticipants.length;
    const totalBilled = currentParticipants.reduce((sum, p) => sum + p.feeAmount, 0);
    const totalPaid = currentParticipants.reduce((sum, p) => sum + p.paidAmount, 0);
    const totalBalance = currentParticipants.reduce((sum, p) => sum + p.balance, 0);
    const netMargin = totalPaid - (currentExcursion.estimatedLogisticsCost || 0);
    return {
      registered,
      totalBilled,
      totalPaid,
      totalBalance,
      netMargin
    };
  }, [currentExcursion, currentParticipants]);

  const handlePrintManifest = () => {
    if (typeof (window as any).printTarget === 'function') {
      (window as any).printTarget(
        'excursion-manifest-print-area',
        `Educational Excursion Manifest & Ledger - ${currentExcursion?.title || 'Trip'}`,
        true
      );
    } else {
      window.print();
    }
  };

  const handleSaveExcursion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!excursionForm.title || !excursionForm.destination || !excursionForm.feePerStudent) {
      triggerToast('Please provide trip title, destination, and fee per student.', 'error');
      return;
    }
    const payload: SchoolExcursion = {
      id: editingExcursion ? editingExcursion.id : 'exc-' + Date.now(),
      title: excursionForm.title,
      destination: excursionForm.destination,
      targetClasses: excursionForm.targetClasses || ['All'],
      eventDate: excursionForm.eventDate || new Date().toISOString().split('T')[0],
      feePerStudent: Number(excursionForm.feePerStudent),
      estimatedLogisticsCost: Number(excursionForm.estimatedLogisticsCost) || 0,
      description: excursionForm.description,
      status: excursionForm.status || 'Upcoming'
    };
    DbController.saveExcursion(payload);
    const updated = DbController.getExcursions();
    setExcursions(updated);
    setSelectedExcursionId(payload.id);
    setShowAddExcursionModal(false);
    setEditingExcursion(null);
    triggerToast('School excursion trip saved.', 'success');
  };

  const handleDeleteExcursion = (id: string) => {
    if (confirm('Delete this excursion trip and all participant records?')) {
      DbController.deleteExcursion(id);
      const updated = DbController.getExcursions();
      setExcursions(updated);
      setSelectedExcursionId(updated[0]?.id || '');
      triggerToast('Excursion removed.', 'info');
    }
  };

  const handleRegisterParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentExcursion) return;
    const student = students.find(s => s.id === regStudentId);
    if (!student) {
      triggerToast('Please choose a student.', 'error');
      return;
    }
    const alreadyRegistered = currentParticipants.some(p => p.studentId === student.id);
    if (alreadyRegistered) {
      triggerToast(`${student.firstName} is already registered for this trip.`, 'error');
      return;
    }

    const payload: ExcursionParticipant = {
      id: 'ep-' + Date.now(),
      excursionId: currentExcursion.id,
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      studentClass: student.class,
      emergencyContact: regEmergencyContact || student.guardianTelephone || '',
      feeAmount: currentExcursion.feePerStudent,
      paidAmount: 0,
      balance: currentExcursion.feePerStudent,
      status: 'Unpaid',
      consentSigned: regConsentSigned
    };

    DbController.saveExcursionParticipant(payload);
    setParticipants(DbController.getExcursionParticipants());
    setShowAddParticipantModal(false);
    setRegStudentId('');
    setRegEmergencyContact('');
    triggerToast(`Enrolled ${student.firstName} for ${currentExcursion.title}.`, 'success');
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeParticipantForPay) return;
    const amt = Number(payAmount);
    if (isNaN(amt) || amt <= 0) {
      triggerToast('Please enter a valid amount.', 'error');
      return;
    }
    const newPaid = activeParticipantForPay.paidAmount + amt;
    const newBal = Math.max(0, activeParticipantForPay.feeAmount - newPaid);
    const newStatus: ExcursionParticipant['status'] = newBal === 0 ? 'Paid' : 'Partial';

    const updated: ExcursionParticipant = {
      ...activeParticipantForPay,
      paidAmount: newPaid,
      balance: newBal,
      status: newStatus,
      paymentDate: new Date().toISOString().split('T')[0],
      receiptNumber: 'EXC-' + Math.floor(100000 + Math.random() * 900000)
    };

    DbController.saveExcursionParticipant(updated);
    setParticipants(DbController.getExcursionParticipants());
    setShowPayModal(false);
    setActiveParticipantForPay(null);
    setPayAmount('');
    triggerToast(`Payment of GHS ${amt.toFixed(2)} recorded for ${updated.studentName}.`, 'success');
  };

  const handleDeleteParticipant = (id: string) => {
    if (confirm('Remove student from trip participant manifest?')) {
      DbController.deleteExcursionParticipant(id);
      setParticipants(DbController.getExcursionParticipants());
      triggerToast('Participant removed.', 'info');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-sky-50 text-sky-600 border border-sky-200 shrink-0">
              <Compass size={22} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-800">School Excursions & Educational Tours</h2>
              <p className="text-xs text-slate-500">
                Manage field trips, participant fees, permission slips, and tour budgeting for {selectedAcademicYear} • {selectedTerm}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {excursions.length > 0 && (
            <select
              value={selectedExcursionId}
              onChange={(e) => setSelectedExcursionId(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 font-bold focus:outline-none"
            >
              {excursions.map(exc => (
                <option key={exc.id} value={exc.id}>
                  {exc.title} ({exc.eventDate})
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={handlePrintManifest}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
            title="Generate PDF or Print Excursion Summary"
          >
            <Printer size={14} />
            <span>Print / PDF Summary</span>
          </button>

          <button
            onClick={() => {
              setEditingExcursion(null);
              setExcursionForm({
                title: '',
                destination: '',
                targetClasses: ['All'],
                eventDate: new Date().toISOString().split('T')[0],
                feePerStudent: 200,
                estimatedLogisticsCost: 2000,
                description: '',
                status: 'Upcoming'
              });
              setShowAddExcursionModal(true);
            }}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Plus size={14} />
            <span>New Trip</span>
          </button>

          {currentExcursion && (
            <button
              onClick={() => setShowAddParticipantModal(true)}
              className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Plus size={14} />
              <span>Enroll Student</span>
            </button>
          )}
        </div>
      </div>

      {currentExcursion ? (
        <>
          {/* Trip Details Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-sky-50 text-sky-700 border border-sky-200">
                  {currentExcursion.status}
                </span>
                <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                  <Calendar size={12} /> {currentExcursion.eventDate}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900">{currentExcursion.title}</h3>
              <p className="text-xs text-slate-600 flex items-center gap-1.5">
                <MapPin size={13} className="text-rose-500 shrink-0" />
                <span>Destination: <strong className="text-slate-800">{currentExcursion.destination}</strong></span>
              </p>
              {currentExcursion.description && (
                <p className="text-xs text-slate-500 italic pt-1">{currentExcursion.description}</p>
              )}
            </div>

            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80 shrink-0">
              <div className="text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Fee / Student</span>
                <strong className="text-sm font-mono text-slate-800">GHS {currentExcursion.feePerStudent.toFixed(2)}</strong>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div className="text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Estimated Costs</span>
                <strong className="text-sm font-mono text-slate-800">GHS {(currentExcursion.estimatedLogisticsCost || 0).toFixed(2)}</strong>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setEditingExcursion(currentExcursion);
                    setExcursionForm(currentExcursion);
                    setShowAddExcursionModal(true);
                  }}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                  title="Edit excursion"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  onClick={() => handleDeleteExcursion(currentExcursion.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                  title="Delete excursion"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Enrolled Students</span>
              <div className="text-xl font-bold text-slate-800 mt-1 flex items-center gap-2">
                <Users size={18} className="text-sky-500" />
                <span>{stats.registered} Commited</span>
              </div>
              <span className="text-[10.5px] text-slate-500 mt-0.5 block">Participant list</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Total Tour Billed</span>
              <div className="text-xl font-bold text-slate-800 mt-1">
                GHS {stats.totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10.5px] text-slate-500 mt-0.5 block">Target trip revenue</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block font-mono">Total Collected</span>
              <div className="text-xl font-bold text-emerald-700 mt-1">
                GHS {stats.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10.5px] text-emerald-600 mt-0.5 block font-semibold">Ready in funds</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block font-mono">Unpaid Tour Balances</span>
              <div className="text-xl font-bold text-rose-600 mt-1">
                GHS {stats.totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10.5px] text-rose-500 mt-0.5 block">Outstanding collections</span>
            </div>
          </div>

          {/* Participant Table */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
              <div className="flex-1 min-w-[200px] relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search student or ID on this excursion..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-medium focus:outline-none"
                >
                  <option value="All">All Statuses</option>
                  <option value="Paid">Fully Paid</option>
                  <option value="Partial">Partial</option>
                  <option value="Unpaid">Unpaid</option>
                </select>

                <button
                  type="button"
                  onClick={handlePrintManifest}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  title="Generate PDF or Print Excursion Summary"
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
                      <th className="py-3 px-4">Emergency Contact</th>
                      <th className="py-3 px-4 text-center">Consent Signed</th>
                      <th className="py-3 px-4 text-right">Fee (GHS)</th>
                      <th className="py-3 px-4 text-right">Paid (GHS)</th>
                      <th className="py-3 px-4 text-right">Balance (GHS)</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredParticipants.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-10 text-slate-400">
                          <Compass size={32} className="mx-auto mb-2 opacity-30" />
                          <p className="font-semibold text-slate-600">No students enrolled on this trip yet.</p>
                          <p className="text-[11px] text-slate-400 mt-1">Click "Enroll Student" above to build the manifest.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredParticipants.map(part => (
                        <tr key={part.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4 font-semibold text-slate-800">
                            <div>{part.studentName}</div>
                            <span className="font-mono text-[10px] text-slate-400">{part.studentId}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-semibold text-[10.5px]">
                              {part.studentClass}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600">{part.emergencyContact || 'N/A'}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              part.consentSigned ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                            }`}>
                              {part.consentSigned ? 'Signed' : 'Pending'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-medium text-slate-700">
                            {part.feeAmount.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                            {part.paidAmount.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                            {part.balance.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              part.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              part.status === 'Partial' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {part.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setActiveParticipantForPay(part);
                                  setPayAmount(part.balance > 0 ? String(part.balance) : '');
                                  setShowPayModal(true);
                                }}
                                className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg font-bold text-[11px] transition cursor-pointer"
                              >
                                Pay
                              </button>
                              <button
                                onClick={() => handleDeleteParticipant(part.id)}
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
        </>
      ) : (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 space-y-3">
          <Compass size={40} className="mx-auto text-slate-300" />
          <h3 className="font-bold text-slate-700 text-base">No Excursions Configured</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">Create educational tours, field trips, and museum visits to begin tracking participant finances.</p>
          <button
            onClick={() => setShowAddExcursionModal(true)}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={14} /> Create Excursion
          </button>
        </div>
      )}

      {/* CREATE / EDIT EXCURSION MODAL */}
      <AnimatePresence>
        {showAddExcursionModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4"
            >
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Compass size={18} className="text-sky-600" />
                <span>{editingExcursion ? 'Edit Excursion' : 'Plan New Excursion'}</span>
              </h3>

              <form onSubmit={handleSaveExcursion} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Excursion / Tour Title *</label>
                  <input
                    type="text"
                    value={excursionForm.title}
                    onChange={(e) => setExcursionForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Science Fair & Museum Expedition"
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Destination *</label>
                  <input
                    type="text"
                    value={excursionForm.destination}
                    onChange={(e) => setExcursionForm(prev => ({ ...prev, destination: e.target.value }))}
                    placeholder="e.g. Kakum Canopy Walk & Cape Coast"
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Fee per Student (GHS) *</label>
                    <input
                      type="number"
                      value={excursionForm.feePerStudent}
                      onChange={(e) => setExcursionForm(prev => ({ ...prev, feePerStudent: Number(e.target.value) }))}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Estimated Costs (GHS)</label>
                    <input
                      type="number"
                      value={excursionForm.estimatedLogisticsCost}
                      onChange={(e) => setExcursionForm(prev => ({ ...prev, estimatedLogisticsCost: Number(e.target.value) }))}
                      placeholder="Bus, snacks, fees"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Date of Trip</label>
                    <input
                      type="date"
                      value={excursionForm.eventDate}
                      onChange={(e) => setExcursionForm(prev => ({ ...prev, eventDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Status</label>
                    <select
                      value={excursionForm.status}
                      onChange={(e) => setExcursionForm(prev => ({ ...prev, status: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="Upcoming">Upcoming</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Description / Tour Guidelines</label>
                  <textarea
                    rows={2}
                    value={excursionForm.description}
                    onChange={(e) => setExcursionForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Educational objectives, dress code, departure time..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddExcursionModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-semibold hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold shadow-xs transition cursor-pointer"
                  >
                    Save Excursion
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ENROLL PARTICIPANT MODAL */}
      <AnimatePresence>
        {showAddParticipantModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4"
            >
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Users size={18} className="text-sky-600" />
                <span>Enroll Student for {currentExcursion?.title}</span>
              </h3>

              <form onSubmit={handleRegisterParticipant} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Select Student *</label>
                  <select
                    value={regStudentId}
                    onChange={(e) => {
                      setRegStudentId(e.target.value);
                      const std = students.find(s => s.id === e.target.value);
                      if (std) setRegEmergencyContact(std.guardianTelephone || '');
                    }}
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
                  <label className="block text-slate-700 font-bold mb-1">Emergency Phone Contact</label>
                  <input
                    type="text"
                    value={regEmergencyContact}
                    onChange={(e) => setRegEmergencyContact(e.target.value)}
                    placeholder="Parent / Guardian phone"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="consentSigned"
                    checked={regConsentSigned}
                    onChange={(e) => setRegConsentSigned(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-sky-600"
                  />
                  <label htmlFor="consentSigned" className="text-slate-700 font-medium cursor-pointer">
                    Parent / Guardian Consent Slip Signed & Received
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddParticipantModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-semibold hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold shadow-xs transition cursor-pointer"
                  >
                    Enroll Participant
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RECORD PARTICIPANT PAYMENT MODAL */}
      <AnimatePresence>
        {showPayModal && activeParticipantForPay && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4"
            >
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <DollarSign size={18} className="text-emerald-600" />
                <span>Receive Excursion Fee</span>
              </h3>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1">
                <div className="font-bold text-slate-800">{activeParticipantForPay.studentName}</div>
                <div className="text-slate-500">{currentExcursion?.title}</div>
                <div className="flex justify-between font-mono pt-1 text-slate-600">
                  <span>Balance Due:</span>
                  <strong className="text-rose-600">GHS {activeParticipantForPay.balance.toFixed(2)}</strong>
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
                    max={activeParticipantForPay.balance}
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
                    <Check size={14} /> Record Payment
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DEDICATED OFFICIAL PRINTABLE EXCURSION MANIFEST */}
      <div id="excursion-manifest-print-area" className="hidden print:block font-sans text-slate-900 bg-white p-4">
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-4 text-center">
          <h1 className="text-xl font-black uppercase tracking-tight text-slate-950">
            {schoolInfo?.name || 'GeeTech Academy'}
          </h1>
          <p className="text-xs text-slate-600 font-medium mt-0.5">
            {schoolInfo?.gpsAddress || 'P.O. Box 1234, Accra, Ghana'} • Tel: {schoolInfo?.telephone || '+233 24 000 0000'}
          </p>
          <div className="inline-block mt-2 px-3 py-1 bg-slate-900 text-white font-mono text-xs font-bold uppercase tracking-widest rounded">
            EDUCATIONAL EXCURSION MANIFEST &amp; FINANCIAL REGISTER
          </div>
          <p className="text-xs font-bold text-slate-700 mt-2">
            Trip: {currentExcursion?.title || 'Excursion'} • Destination: {currentExcursion?.destination || 'N/A'} • Date: {currentExcursion?.eventDate || 'N/A'}
          </p>
          <p className="text-[11px] text-slate-500">
            Academic Session: {selectedAcademicYear} • {selectedTerm} | Target Classes: {currentExcursion?.targetClasses?.join(', ') || 'All'}
          </p>
        </div>

        {/* Excursion Logistics & Financial Overview */}
        <div className="grid grid-cols-5 gap-2 mb-4 text-center">
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Registered Students</span>
            <span className="text-sm font-black text-slate-900">{stats.registered} Students</span>
          </div>
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Total Billed</span>
            <span className="text-sm font-black text-slate-900 font-mono">GH₵ {stats.totalBilled.toFixed(2)}</span>
          </div>
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Total Collected</span>
            <span className="text-sm font-black text-emerald-800 font-mono">GH₵ {stats.totalPaid.toFixed(2)}</span>
          </div>
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Outstanding</span>
            <span className="text-sm font-black text-rose-800 font-mono">GH₵ {stats.totalBalance.toFixed(2)}</span>
          </div>
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Net Trip Margin</span>
            <span className={`text-sm font-black font-mono ${stats.netMargin >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
              GH₵ {stats.netMargin.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Participants Table */}
        <table className="w-full border-collapse border border-slate-400 text-[11px] mb-4">
          <thead>
            <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-400">
              <th className="border border-slate-400 p-1.5 text-center w-8">#</th>
              <th className="border border-slate-400 p-1.5 text-left">Student Name</th>
              <th className="border border-slate-400 p-1.5 text-left">Student ID</th>
              <th className="border border-slate-400 p-1.5 text-center">Class</th>
              <th className="border border-slate-400 p-1.5 text-left">Emergency Phone</th>
              <th className="border border-slate-400 p-1.5 text-center">Consent</th>
              <th className="border border-slate-400 p-1.5 text-right">Fee (GH₵)</th>
              <th className="border border-slate-400 p-1.5 text-right">Paid (GH₵)</th>
              <th className="border border-slate-400 p-1.5 text-right">Balance (GH₵)</th>
              <th className="border border-slate-400 p-1.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredParticipants.length === 0 ? (
              <tr>
                <td colSpan={10} className="border border-slate-400 p-4 text-center text-slate-500">
                  No participants enrolled on this excursion trip yet.
                </td>
              </tr>
            ) : (
              filteredParticipants.map((part, idx) => (
                <tr key={part.id} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                  <td className="border border-slate-400 p-1.5 text-center font-mono">{idx + 1}</td>
                  <td className="border border-slate-400 p-1.5 font-bold text-slate-900">{part.studentName}</td>
                  <td className="border border-slate-400 p-1.5 font-mono text-[10px]">{part.studentId}</td>
                  <td className="border border-slate-400 p-1.5 text-center font-semibold">{part.studentClass}</td>
                  <td className="border border-slate-400 p-1.5 font-mono text-[10px]">{part.emergencyContact || 'N/A'}</td>
                  <td className="border border-slate-400 p-1.5 text-center font-semibold">{part.consentSigned ? 'Yes' : 'Pending'}</td>
                  <td className="border border-slate-400 p-1.5 text-right font-mono">{part.feeAmount.toFixed(2)}</td>
                  <td className="border border-slate-400 p-1.5 text-right font-mono font-bold text-slate-900">{part.paidAmount.toFixed(2)}</td>
                  <td className="border border-slate-400 p-1.5 text-right font-mono font-bold text-slate-900">{part.balance.toFixed(2)}</td>
                  <td className="border border-slate-400 p-1.5 text-center font-bold">{part.status}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-900">
              <td colSpan={6} className="border border-slate-400 p-1.5 text-right uppercase">Total Trip Collections:</td>
              <td className="border border-slate-400 p-1.5 text-right font-mono">GH₵ {stats.totalBilled.toFixed(2)}</td>
              <td className="border border-slate-400 p-1.5 text-right font-mono">GH₵ {stats.totalPaid.toFixed(2)}</td>
              <td className="border border-slate-400 p-1.5 text-right font-mono">GH₵ {stats.totalBalance.toFixed(2)}</td>
              <td className="border border-slate-400 p-1.5 text-center">{stats.registered} Enrolled</td>
            </tr>
          </tfoot>
        </table>

        {/* Signatures */}
        <div className="grid grid-cols-3 gap-8 pt-6 mt-4 border-t border-slate-400 text-center text-xs">
          <div>
            <div className="border-b border-slate-900 pb-8 mb-1"></div>
            <p className="font-bold text-slate-900 uppercase">Trip Coordinator / Teacher</p>
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
            <p className="text-[10px] text-slate-500">Official Stamp & Date</p>
          </div>
        </div>
      </div>
    </div>
  );
}
