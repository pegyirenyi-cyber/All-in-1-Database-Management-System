import React, { useState, useMemo } from 'react';
import { 
  TransportRoute, StudentTransportRecord, Student, ClassType, CLASSES, 
  AcademicYearType, TermType, SchoolInfo 
} from '../../types';
import { DbController } from '../../db';
import { ThemeStyles } from '../ThemeWrapper';
import { triggerToast } from '../../utils';
import { 
  Bus, Plus, Search, Filter, Printer, Trash2, Edit2, CheckCircle2, 
  Clock, AlertCircle, DollarSign, Users, Phone, MapPin, Download, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  theme: ThemeStyles;
  students: Student[];
  schoolInfo: SchoolInfo;
  selectedAcademicYear: AcademicYearType;
  selectedTerm: TermType;
}

export default function TransportationTab({
  theme,
  students,
  schoolInfo,
  selectedAcademicYear,
  selectedTerm
}: Props) {
  const [routes, setRoutes] = useState<TransportRoute[]>(() => DbController.getTransportRoutes());
  const [records, setRecords] = useState<StudentTransportRecord[]>(() => DbController.getTransportRecords());

  const [activeView, setActiveView] = useState<'commuters' | 'routes'>('commuters');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRouteFilter, setSelectedRouteFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Partial' | 'Unpaid'>('All');

  // Modals
  const [showAddRouteModal, setShowAddRouteModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<TransportRoute | null>(null);
  const [routeForm, setRouteForm] = useState<Partial<TransportRoute>>({
    name: '',
    driverName: '',
    driverPhone: '',
    vehicleNumber: '',
    feePerTerm: 400,
    capacity: 30,
    notes: ''
  });

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignStudentId, setAssignStudentId] = useState('');
  const [assignRouteId, setAssignRouteId] = useState('');
  const [assignTripType, setAssignTripType] = useState<StudentTransportRecord['tripType']>('Two-Way');
  const [assignFeeOverride, setAssignFeeOverride] = useState<string>('');

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedRecordForPayment, setSelectedRecordForPayment] = useState<StudentTransportRecord | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payReceiptNum, setPayReceiptNum] = useState('');

  // Routes stats
  const filteredRecords = useMemo(() => {
    return records.filter(rec => {
      const matchesSearch = 
        rec.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.studentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.routeName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRoute = selectedRouteFilter === 'All' || rec.routeId === selectedRouteFilter;
      const matchesStatus = statusFilter === 'All' || rec.status === statusFilter;
      const matchesSession = rec.academicYear === selectedAcademicYear && rec.term === selectedTerm;
      return matchesSearch && matchesRoute && matchesStatus && matchesSession;
    });
  }, [records, searchQuery, selectedRouteFilter, statusFilter, selectedAcademicYear, selectedTerm]);

  const stats = useMemo(() => {
    const termRecords = records.filter(r => r.academicYear === selectedAcademicYear && r.term === selectedTerm);
    const totalBilled = termRecords.reduce((sum, r) => sum + (r.feeAmount || 0), 0);
    const totalPaid = termRecords.reduce((sum, r) => sum + (r.paidAmount || 0), 0);
    const totalBalance = termRecords.reduce((sum, r) => sum + (r.balance || 0), 0);
    return {
      commutersCount: termRecords.length,
      totalBilled,
      totalPaid,
      totalBalance,
      collectionRate: totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 0
    };
  }, [records, selectedAcademicYear, selectedTerm]);

  const handlePrintManifest = () => {
    if (typeof (window as any).printTarget === 'function') {
      (window as any).printTarget(
        'transportation-manifest-print-area',
        `Transportation & Commuter Manifest - ${selectedAcademicYear} ${selectedTerm}`,
        true
      );
    } else {
      window.print();
    }
  };

  // Route handlers
  const handleSaveRoute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeForm.name || !routeForm.vehicleNumber) {
      triggerToast('Please provide route name and vehicle plate number.', 'error');
      return;
    }
    const payload: TransportRoute = {
      id: editingRoute ? editingRoute.id : 'route-' + Date.now(),
      name: routeForm.name || '',
      driverName: routeForm.driverName || '',
      driverPhone: routeForm.driverPhone || '',
      vehicleNumber: routeForm.vehicleNumber || '',
      feePerTerm: Number(routeForm.feePerTerm) || 0,
      capacity: Number(routeForm.capacity) || 30,
      notes: routeForm.notes || ''
    };
    DbController.saveTransportRoute(payload);
    setRoutes(DbController.getTransportRoutes());
    setShowAddRouteModal(false);
    setEditingRoute(null);
    triggerToast(editingRoute ? 'Transport route updated.' : 'New transport route registered.', 'success');
  };

  const handleDeleteRoute = (id: string) => {
    if (confirm('Are you sure you want to delete this transport route?')) {
      DbController.deleteTransportRoute(id);
      setRoutes(DbController.getTransportRoutes());
      triggerToast('Route deleted.', 'info');
    }
  };

  // Student booking handler
  const handleAssignStudent = (e: React.FormEvent) => {
    e.preventDefault();
    const student = students.find(s => s.id === assignStudentId);
    const route = routes.find(r => r.id === assignRouteId);
    if (!student || !route) {
      triggerToast('Please select both a student and a route.', 'error');
      return;
    }
    const fee = assignFeeOverride ? Number(assignFeeOverride) : route.feePerTerm;
    const newRecord: StudentTransportRecord = {
      id: 'tr-' + Date.now(),
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      studentClass: student.class,
      routeId: route.id,
      routeName: route.name,
      tripType: assignTripType,
      term: selectedTerm,
      academicYear: selectedAcademicYear,
      feeAmount: fee,
      paidAmount: 0,
      balance: fee,
      status: 'Unpaid'
    };
    DbController.saveTransportRecord(newRecord);
    setRecords(DbController.getTransportRecords());
    setShowAssignModal(false);
    setAssignStudentId('');
    setAssignRouteId('');
    setAssignFeeOverride('');
    triggerToast(`Enrolled ${student.firstName} for ${route.name}.`, 'success');
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordForPayment) return;
    const amount = Number(payAmount);
    if (isNaN(amount) || amount <= 0) {
      triggerToast('Please enter a valid payment amount.', 'error');
      return;
    }
    const newPaid = selectedRecordForPayment.paidAmount + amount;
    const newBalance = Math.max(0, selectedRecordForPayment.feeAmount - newPaid);
    const newStatus: StudentTransportRecord['status'] = newBalance === 0 ? 'Paid' : 'Partial';

    const updated: StudentTransportRecord = {
      ...selectedRecordForPayment,
      paidAmount: newPaid,
      balance: newBalance,
      status: newStatus,
      lastPaymentDate: new Date().toISOString().split('T')[0],
      receiptNumber: payReceiptNum || 'TR-' + Math.floor(100000 + Math.random() * 900000)
    };

    DbController.saveTransportRecord(updated);
    setRecords(DbController.getTransportRecords());
    setShowPaymentModal(false);
    setSelectedRecordForPayment(null);
    setPayAmount('');
    setPayReceiptNum('');
    triggerToast(`Recorded payment of GHS ${amount.toFixed(2)} for ${updated.studentName}.`, 'success');
  };

  const handleDeleteRecord = (id: string) => {
    if (confirm('Delete this commuter booking record?')) {
      DbController.deleteTransportRecord(id);
      setRecords(DbController.getTransportRecords());
      triggerToast('Booking removed.', 'info');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Sub-Nav */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
              <Bus size={20} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-800">School Transportation & Bus Fleet</h2>
              <p className="text-xs text-slate-500">
                Manage bus routes, student commuters, fee billing, and payment reconciliations for {selectedAcademicYear} • {selectedTerm}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
            <button
              onClick={() => setActiveView('commuters')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeView === 'commuters' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Commuter Register
            </button>
            <button
              onClick={() => setActiveView('routes')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeView === 'routes' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bus Routes ({routes.length})
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrintManifest}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
            title="Generate PDF or Print Transportation Summary"
          >
            <Printer size={14} />
            <span>Print / PDF Summary</span>
          </button>

          {activeView === 'commuters' ? (
            <button
              onClick={() => setShowAssignModal(true)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Plus size={14} />
              <span>Enroll Commuter</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setEditingRoute(null);
                setRouteForm({ name: '', driverName: '', driverPhone: '', vehicleNumber: '', feePerTerm: 400, capacity: 30, notes: '' });
                setShowAddRouteModal(true);
              }}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Plus size={14} />
              <span>Add Route</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Total Commuters</span>
          <div className="text-xl font-bold text-slate-800 mt-1 flex items-center gap-2">
            <Users size={18} className="text-indigo-500" />
            <span>{stats.commutersCount} Students</span>
          </div>
          <span className="text-[10.5px] text-slate-500 mt-0.5 block">Active bus subscribers</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Total Expected Revenue</span>
          <div className="text-xl font-bold text-slate-800 mt-1">
            GHS {stats.totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10.5px] text-slate-500 mt-0.5 block">Term transportation fees</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block font-mono">Total Collected</span>
          <div className="text-xl font-bold text-emerald-700 mt-1">
            GHS {stats.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10.5px] text-emerald-600 mt-0.5 block font-semibold">{stats.collectionRate}% Collection Rate</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block font-mono">Outstanding Arrears</span>
          <div className="text-xl font-bold text-rose-600 mt-1">
            GHS {stats.totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10.5px] text-rose-500 mt-0.5 block">Pending fare balances</span>
        </div>
      </div>

      {/* COMMUTER VIEW */}
      {activeView === 'commuters' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
            <div className="flex-1 min-w-[200px] relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search commuter name, ID, or route..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedRouteFilter}
                onChange={(e) => setSelectedRouteFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-medium focus:outline-none"
              >
                <option value="All">All Routes</option>
                {routes.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-medium focus:outline-none"
              >
                <option value="All">All Payment Statuses</option>
                <option value="Paid">Fully Paid</option>
                <option value="Partial">Partial</option>
                <option value="Unpaid">Unpaid</option>
              </select>

              <button
                type="button"
                onClick={handlePrintManifest}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                title="Generate PDF or Print Transportation Summary"
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
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Class</th>
                    <th className="py-3 px-4">Assigned Route</th>
                    <th className="py-3 px-4">Trip Type</th>
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
                        <Bus size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="font-semibold text-slate-600">No commuter transport records found.</p>
                        <p className="text-[11px] text-slate-400 mt-1">Enroll students to assign them to school bus routes.</p>
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
                        <td className="py-3 px-4 text-slate-700 font-medium">
                          <div className="flex items-center gap-1.5">
                            <MapPin size={12} className="text-amber-500 shrink-0" />
                            <span className="truncate max-w-[200px]" title={rec.routeName}>{rec.routeName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <span className="text-[11px] font-mono">{rec.tripType}</span>
                        </td>
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
                            {rec.status === 'Paid' ? <CheckCircle2 size={10} /> : rec.status === 'Partial' ? <Clock size={10} /> : <AlertCircle size={10} />}
                            <span>{rec.status}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedRecordForPayment(rec);
                                setPayAmount(rec.balance > 0 ? String(rec.balance) : '');
                                setShowPaymentModal(true);
                              }}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 rounded-lg font-bold text-[11px] transition cursor-pointer"
                              title="Record Transport Payment"
                            >
                              Pay
                            </button>
                            <button
                              onClick={() => handleDeleteRecord(rec.id)}
                              className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                              title="Delete record"
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

      {/* ROUTES VIEW */}
      {activeView === 'routes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {routes.map(route => {
            const commuters = records.filter(r => r.routeId === route.id && r.academicYear === selectedAcademicYear && r.term === selectedTerm);
            const totalCollectedOnRoute = commuters.reduce((sum, c) => sum + c.paidAmount, 0);
            return (
              <div key={route.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                        <Bus size={18} />
                      </span>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">{route.name}</h4>
                        <span className="font-mono text-[11px] text-indigo-600 font-semibold">{route.vehicleNumber}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingRoute(route);
                          setRouteForm(route);
                          setShowAddRouteModal(true);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition cursor-pointer"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteRoute(route.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-sans">
                    <div>
                      <span className="text-slate-400 block text-[9.5px] uppercase font-mono">Driver</span>
                      <strong className="text-slate-700">{route.driverName || 'Not Assigned'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9.5px] uppercase font-mono">Contact</span>
                      <span className="text-slate-700 font-mono">{route.driverPhone || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9.5px] uppercase font-mono">Fee / Term</span>
                      <strong className="text-slate-800 font-mono">GHS {route.feePerTerm.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9.5px] uppercase font-mono">Capacity</span>
                      <span className="text-slate-700">{commuters.length} / {route.capacity || 30} seats</span>
                    </div>
                  </div>

                  {route.notes && (
                    <p className="text-[11px] text-slate-500 italic bg-amber-50/50 p-2 rounded-lg border border-amber-100/60">
                      {route.notes}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Collected:</span>
                  <span className="font-mono font-bold text-emerald-700">GHS {totalCollectedOnRoute.toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ASSIGN COMMUTER MODAL */}
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
                <Bus size={18} className="text-indigo-600" />
                <span>Enroll Student Commuter</span>
              </h3>

              <form onSubmit={handleAssignStudent} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Select Student *</label>
                  <select
                    value={assignStudentId}
                    onChange={(e) => setAssignStudentId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none"
                  >
                    <option value="">-- Choose student from directory --</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.firstName} {s.lastName} ({s.class}) - {s.id}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Select Route *</label>
                  <select
                    value={assignRouteId}
                    onChange={(e) => setAssignRouteId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none"
                  >
                    <option value="">-- Choose route --</option>
                    {routes.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} (GHS {r.feePerTerm})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Trip Type</label>
                    <select
                      value={assignTripType}
                      onChange={(e) => setAssignTripType(e.target.value as any)}
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="Two-Way">Two-Way (Pick & Drop)</option>
                      <option value="One-Way (Morning)">One-Way (Morning Only)</option>
                      <option value="One-Way (Afternoon)">One-Way (Afternoon Only)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Fee Amount (GHS)</label>
                    <input
                      type="number"
                      value={assignFeeOverride}
                      onChange={(e) => setAssignFeeOverride(e.target.value)}
                      placeholder="Leave blank for standard"
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
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
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xs transition cursor-pointer"
                  >
                    Confirm Enrollment
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RECORD PAYMENT MODAL */}
      <AnimatePresence>
        {showPaymentModal && selectedRecordForPayment && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4"
            >
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <DollarSign size={18} className="text-emerald-600" />
                <span>Receive Transport Fare</span>
              </h3>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1">
                <div className="font-bold text-slate-800">{selectedRecordForPayment.studentName}</div>
                <div className="text-slate-500">{selectedRecordForPayment.routeName}</div>
                <div className="flex justify-between font-mono pt-1 text-slate-600">
                  <span>Balance Due:</span>
                  <strong className="text-rose-600">GHS {selectedRecordForPayment.balance.toFixed(2)}</strong>
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
                    max={selectedRecordForPayment.balance}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Receipt / Voucher Number</label>
                  <input
                    type="text"
                    value={payReceiptNum}
                    onChange={(e) => setPayReceiptNum(e.target.value)}
                    placeholder="Auto-generated if left blank"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-semibold hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs transition cursor-pointer flex items-center gap-1"
                  >
                    <Check size={14} /> Record & Issue
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD / EDIT ROUTE MODAL */}
      <AnimatePresence>
        {showAddRouteModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4"
            >
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Bus size={18} className="text-amber-500" />
                <span>{editingRoute ? 'Edit Route Details' : 'Register New Bus Route'}</span>
              </h3>

              <form onSubmit={handleSaveRoute} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Route Name & Areas *</label>
                  <input
                    type="text"
                    value={routeForm.name}
                    onChange={(e) => setRouteForm(prev => ({ ...prev, name: e.target.value }))}
                    required
                    placeholder="e.g. Route 3 - Asokwa / Ahodwo / Danyame"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Vehicle Plate Number *</label>
                    <input
                      type="text"
                      value={routeForm.vehicleNumber}
                      onChange={(e) => setRouteForm(prev => ({ ...prev, vehicleNumber: e.target.value }))}
                      required
                      placeholder="e.g. AS 3421-23"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Seating Capacity</label>
                    <input
                      type="number"
                      value={routeForm.capacity}
                      onChange={(e) => setRouteForm(prev => ({ ...prev, capacity: Number(e.target.value) }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Driver Name</label>
                    <input
                      type="text"
                      value={routeForm.driverName}
                      onChange={(e) => setRouteForm(prev => ({ ...prev, driverName: e.target.value }))}
                      placeholder="e.g. Mr. Kwame Mensah"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Driver Phone Number</label>
                    <input
                      type="text"
                      value={routeForm.driverPhone}
                      onChange={(e) => setRouteForm(prev => ({ ...prev, driverPhone: e.target.value }))}
                      placeholder="0244..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Standard Term Fee (GHS) *</label>
                  <input
                    type="number"
                    value={routeForm.feePerTerm}
                    onChange={(e) => setRouteForm(prev => ({ ...prev, feePerTerm: Number(e.target.value) }))}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Route Stops & Timetable Notes</label>
                  <textarea
                    rows={2}
                    value={routeForm.notes}
                    onChange={(e) => setRouteForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Key pick-up junctions, departure hours, contact info..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddRouteModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-semibold hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-xs transition cursor-pointer"
                  >
                    {editingRoute ? 'Update Route' : 'Save Route'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DEDICATED OFFICIAL PRINTABLE TRANSPORTATION MANIFEST */}
      <div id="transportation-manifest-print-area" className="hidden print:block font-sans text-slate-900 bg-white p-4">
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-4 text-center">
          <h1 className="text-xl font-black uppercase tracking-tight text-slate-950">
            {schoolInfo?.name || 'GeeTech Academy'}
          </h1>
          <p className="text-xs text-slate-600 font-medium mt-0.5">
            {schoolInfo?.gpsAddress || 'P.O. Box 1234, Accra, Ghana'} • Tel: {schoolInfo?.telephone || '+233 24 000 0000'}
          </p>
          <div className="inline-block mt-2 px-3 py-1 bg-slate-900 text-white font-mono text-xs font-bold uppercase tracking-widest rounded">
            OFFICIAL TRANSPORTATION & COMMUTER MANIFEST
          </div>
          <p className="text-xs font-bold text-slate-700 mt-2">
            Academic Session: {selectedAcademicYear} • {selectedTerm} | Route Filter: {selectedRouteFilter === 'All' ? 'All Active Routes' : routes.find(r => r.id === selectedRouteFilter)?.name || selectedRouteFilter}
          </p>
        </div>

        {/* Manifest Metric Highlights */}
        <div className="grid grid-cols-5 gap-2 mb-4 text-center">
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Total Commuters</span>
            <span className="text-sm font-black text-slate-900">{stats.commutersCount} Students</span>
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
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Collection Rate</span>
            <span className="text-sm font-black text-indigo-900">{stats.collectionRate}%</span>
          </div>
        </div>

        {/* Commuters Table */}
        <table className="w-full border-collapse border border-slate-400 text-[11px] mb-4">
          <thead>
            <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-400">
              <th className="border border-slate-400 p-1.5 text-center w-8">#</th>
              <th className="border border-slate-400 p-1.5 text-left">Student Name</th>
              <th className="border border-slate-400 p-1.5 text-left">Student ID</th>
              <th className="border border-slate-400 p-1.5 text-center">Class</th>
              <th className="border border-slate-400 p-1.5 text-left">Assigned Route</th>
              <th className="border border-slate-400 p-1.5 text-center">Trip</th>
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
                  No commuter records match the specified filters.
                </td>
              </tr>
            ) : (
              filteredRecords.map((rec, idx) => (
                <tr key={rec.id} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                  <td className="border border-slate-400 p-1.5 text-center font-mono">{idx + 1}</td>
                  <td className="border border-slate-400 p-1.5 font-bold text-slate-900">{rec.studentName}</td>
                  <td className="border border-slate-400 p-1.5 font-mono text-[10px]">{rec.studentId}</td>
                  <td className="border border-slate-400 p-1.5 text-center font-semibold">{rec.studentClass}</td>
                  <td className="border border-slate-400 p-1.5">{rec.routeName}</td>
                  <td className="border border-slate-400 p-1.5 text-center">{rec.tripType}</td>
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
              <td colSpan={6} className="border border-slate-400 p-1.5 text-right uppercase">Total Institutional Summary:</td>
              <td className="border border-slate-400 p-1.5 text-right font-mono">GH₵ {stats.totalBilled.toFixed(2)}</td>
              <td className="border border-slate-400 p-1.5 text-right font-mono">GH₵ {stats.totalPaid.toFixed(2)}</td>
              <td className="border border-slate-400 p-1.5 text-right font-mono">GH₵ {stats.totalBalance.toFixed(2)}</td>
              <td className="border border-slate-400 p-1.5 text-center">{stats.collectionRate}% Paid</td>
            </tr>
          </tfoot>
        </table>

        {/* Route Fleet Overview */}
        <div className="border border-slate-400 p-3 rounded mb-4 bg-slate-50/50">
          <h4 className="text-[11px] font-black uppercase text-slate-800 mb-2">Active Fleet & Route Directory</h4>
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            {routes.map(r => (
              <div key={r.id} className="border border-slate-300 p-1.5 rounded bg-white">
                <span className="font-bold text-slate-900 block">{r.name}</span>
                <span className="text-slate-600 block">Vehicle: {r.vehicleNumber} | Cap: {r.capacity}</span>
                <span className="text-slate-600 block">Driver: {r.driverName || 'N/A'} ({r.driverPhone || 'N/A'})</span>
                <span className="font-mono text-slate-800 font-bold block mt-0.5">Rate: GH₵ {r.feePerTerm} / term</span>
              </div>
            ))}
          </div>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-3 gap-8 pt-6 mt-4 border-t border-slate-400 text-center text-xs">
          <div>
            <div className="border-b border-slate-900 pb-8 mb-1"></div>
            <p className="font-bold text-slate-900 uppercase">Transport Officer</p>
            <p className="text-[10px] text-slate-500">Signature & Date</p>
          </div>
          <div>
            <div className="border-b border-slate-900 pb-8 mb-1"></div>
            <p className="font-bold text-slate-900 uppercase">Accountant / Bursar</p>
            <p className="text-[10px] text-slate-500">Signature & Date</p>
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
