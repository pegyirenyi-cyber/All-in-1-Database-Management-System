import React, { useState, useMemo } from 'react';
import { 
  TextbookItem, StudentTextbookTransaction, Student, ClassType, CLASSES, 
  AcademicYearType, TermType, SchoolInfo 
} from '../../types';
import { DbController } from '../../db';
import { ThemeStyles } from '../ThemeWrapper';
import { triggerToast } from '../../utils';
import { 
  BookOpen, Plus, Search, Filter, Printer, Trash2, Edit2, CheckCircle2, 
  Clock, AlertCircle, DollarSign, Users, Package, RotateCcw, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  theme: ThemeStyles;
  students: Student[];
  schoolInfo: SchoolInfo;
  selectedAcademicYear: AcademicYearType;
  selectedTerm: TermType;
}

export default function TextbooksFinancesTab({
  theme,
  students,
  schoolInfo,
  selectedAcademicYear,
  selectedTerm
}: Props) {
  const [books, setBooks] = useState<TextbookItem[]>(() => DbController.getTextbooks());
  const [transactions, setTransactions] = useState<StudentTextbookTransaction[]>(() => DbController.getTextbookTransactions());

  const [activeView, setActiveView] = useState<'transactions' | 'catalog'>('transactions');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Partial' | 'Unpaid'>('All');

  // Modals
  const [showAddBookModal, setShowAddBookModal] = useState(false);
  const [bookForm, setBookForm] = useState<Partial<TextbookItem>>({
    title: '',
    subject: 'Core Mathematics',
    targetClass: 'Basic 7',
    salePrice: 80,
    rentalPrice: 25,
    stockQty: 50,
    publisher: 'NaCCA / Ministry of Education'
  });

  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueStudentId, setIssueStudentId] = useState('');
  const [issueBookId, setIssueBookId] = useState('');
  const [issueType, setIssueType] = useState<'Purchase' | 'Rental'>('Purchase');

  const [showPayModal, setShowPayModal] = useState(false);
  const [activeTxForPay, setActiveTxForPay] = useState<StudentTextbookTransaction | null>(null);
  const [payAmount, setPayAmount] = useState('');

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = 
        t.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.studentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.bookTitle.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesClass = selectedClassFilter === 'All' || t.studentClass === selectedClassFilter;
      const matchesStatus = statusFilter === 'All' || t.status === statusFilter;
      return matchesSearch && matchesClass && matchesStatus;
    });
  }, [transactions, searchQuery, selectedClassFilter, statusFilter]);

  const stats = useMemo(() => {
    const totalBilled = transactions.reduce((sum, t) => sum + t.amount, 0);
    const totalPaid = transactions.reduce((sum, t) => sum + t.paidAmount, 0);
    const totalBalance = transactions.reduce((sum, t) => sum + t.balance, 0);
    const totalStock = books.reduce((sum, b) => sum + b.stockQty, 0);
    return {
      totalTransactions: transactions.length,
      totalBilled,
      totalPaid,
      totalBalance,
      totalStock
    };
  }, [transactions, books]);

  const handlePrintLedger = () => {
    if (typeof (window as any).printTarget === 'function') {
      (window as any).printTarget(
        'textbooks-ledger-print-area',
        `Textbook Inventory & Issuance Register - ${selectedAcademicYear} ${selectedTerm}`,
        true
      );
    } else {
      window.print();
    }
  };

  const handleSaveBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookForm.title || !bookForm.salePrice) {
      triggerToast('Please provide book title and price.', 'error');
      return;
    }
    const payload: TextbookItem = {
      id: 'tb-' + Date.now(),
      title: bookForm.title,
      subject: bookForm.subject || 'General',
      targetClass: bookForm.targetClass || 'Basic 7',
      salePrice: Number(bookForm.salePrice),
      rentalPrice: Number(bookForm.rentalPrice) || 0,
      stockQty: Number(bookForm.stockQty) || 0,
      publisher: bookForm.publisher
    };
    DbController.saveTextbook(payload);
    setBooks(DbController.getTextbooks());
    setShowAddBookModal(false);
    triggerToast('Textbook added to catalog.', 'success');
  };

  const handleDeleteBook = (id: string) => {
    if (confirm('Delete this textbook from catalog?')) {
      DbController.deleteTextbook(id);
      setBooks(DbController.getTextbooks());
      triggerToast('Book deleted.', 'info');
    }
  };

  const handleIssueBook = (e: React.FormEvent) => {
    e.preventDefault();
    const student = students.find(s => s.id === issueStudentId);
    const book = books.find(b => b.id === issueBookId);
    if (!student || !book) {
      triggerToast('Please select student and textbook.', 'error');
      return;
    }
    const cost = issueType === 'Purchase' ? book.salePrice : (book.rentalPrice || 25);

    const payload: StudentTextbookTransaction = {
      id: 'tt-' + Date.now(),
      bookId: book.id,
      bookTitle: book.title,
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      studentClass: student.class,
      type: issueType,
      amount: cost,
      paidAmount: 0,
      balance: cost,
      status: 'Unpaid',
      date: new Date().toISOString().split('T')[0],
      returned: false
    };

    DbController.saveTextbookTransaction(payload);
    setTransactions(DbController.getTextbookTransactions());
    setShowIssueModal(false);
    setIssueStudentId('');
    setIssueBookId('');
    triggerToast(`Issued ${book.title} to ${student.firstName}.`, 'success');
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTxForPay) return;
    const amt = Number(payAmount);
    if (isNaN(amt) || amt <= 0) {
      triggerToast('Please enter a valid amount.', 'error');
      return;
    }
    const newPaid = activeTxForPay.paidAmount + amt;
    const newBal = Math.max(0, activeTxForPay.amount - newPaid);
    const newStatus: StudentTextbookTransaction['status'] = newBal === 0 ? 'Paid' : 'Partial';

    const updated: StudentTextbookTransaction = {
      ...activeTxForPay,
      paidAmount: newPaid,
      balance: newBal,
      status: newStatus,
      receiptNumber: 'BK-' + Math.floor(100000 + Math.random() * 900000)
    };

    DbController.saveTextbookTransaction(updated);
    setTransactions(DbController.getTextbookTransactions());
    setShowPayModal(false);
    setActiveTxForPay(null);
    setPayAmount('');
    triggerToast(`Payment of GHS ${amt.toFixed(2)} recorded for ${updated.studentName}.`, 'success');
  };

  const handleToggleReturn = (tx: StudentTextbookTransaction) => {
    const updated: StudentTextbookTransaction = {
      ...tx,
      returned: !tx.returned,
      returnDate: !tx.returned ? new Date().toISOString().split('T')[0] : undefined
    };
    DbController.saveTextbookTransaction(updated);
    setTransactions(DbController.getTextbookTransactions());
    triggerToast(updated.returned ? 'Marked textbook as returned.' : 'Marked book as pending return.', 'info');
  };

  const handleDeleteTransaction = (id: string) => {
    if (confirm('Delete this textbook transaction record?')) {
      DbController.deleteTextbookTransaction(id);
      setTransactions(DbController.getTextbookTransactions());
      triggerToast('Transaction removed.', 'info');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 shrink-0">
              <BookOpen size={22} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Textbooks & Stationery Distribution</h2>
              <p className="text-xs text-slate-500">
                Manage textbook sales, rental lending library, inventory, and student payments for {selectedAcademicYear} • {selectedTerm}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
            <button
              onClick={() => setActiveView('transactions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeView === 'transactions' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sales & Lending Register
            </button>
            <button
              onClick={() => setActiveView('catalog')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeView === 'catalog' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Book Catalog ({books.length})
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrintLedger}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
            title="Generate PDF or Print Textbooks Finance Summary"
          >
            <Printer size={14} />
            <span>Print / PDF Summary</span>
          </button>

          {activeView === 'transactions' ? (
            <button
              onClick={() => setShowIssueModal(true)}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Plus size={14} />
              <span>Issue / Sell Book</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setBookForm({ title: '', subject: 'Integrated Science', targetClass: 'Basic 7', salePrice: 75, rentalPrice: 25, stockQty: 40, publisher: '' });
                setShowAddBookModal(true);
              }}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Plus size={14} />
              <span>Add Textbook</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Issued Books</span>
          <div className="text-xl font-bold text-slate-800 mt-1 flex items-center gap-2">
            <Package size={18} className="text-purple-500" />
            <span>{stats.totalTransactions} Items</span>
          </div>
          <span className="text-[10.5px] text-slate-500 mt-0.5 block">{stats.totalStock} in stock</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Total Billed</span>
          <div className="text-xl font-bold text-slate-800 mt-1">
            GHS {stats.totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10.5px] text-slate-500 mt-0.5 block">Textbook receivables</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block font-mono">Collected</span>
          <div className="text-xl font-bold text-emerald-700 mt-1">
            GHS {stats.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10.5px] text-emerald-600 mt-0.5 block font-semibold">Ready in registry</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block font-mono">Outstanding Book Balances</span>
          <div className="text-xl font-bold text-rose-600 mt-1">
            GHS {stats.totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10.5px] text-rose-500 mt-0.5 block">Pending book fees</span>
        </div>
      </div>

      {/* TRANSACTIONS TABLE */}
      {activeView === 'transactions' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
            <div className="flex-1 min-w-[200px] relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student, book title, or ID..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
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
                title="Generate PDF or Print Textbooks Finance Summary"
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
                    <th className="py-3 px-4">Textbook</th>
                    <th className="py-3 px-4 text-center">Type</th>
                    <th className="py-3 px-4 text-right">Price (GHS)</th>
                    <th className="py-3 px-4 text-right">Paid (GHS)</th>
                    <th className="py-3 px-4 text-right">Balance (GHS)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Rental Return</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-10 text-slate-400">
                        <BookOpen size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="font-semibold text-slate-600">No textbook transactions found.</p>
                        <p className="text-[11px] text-slate-400 mt-1">Issue or sell books to students above.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          <div>{tx.studentName}</div>
                          <span className="font-mono text-[10px] text-slate-400">{tx.studentId}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-semibold text-[10.5px]">
                            {tx.studentClass}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium">{tx.bookTitle}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            tx.type === 'Purchase' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
                          }`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-slate-700">
                          {tx.amount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                          {tx.paidAmount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                          {tx.balance.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            tx.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            tx.status === 'Partial' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {tx.type === 'Rental' ? (
                            <button
                              onClick={() => handleToggleReturn(tx)}
                              className={`px-2 py-0.5 rounded text-[10.5px] font-bold cursor-pointer transition ${
                                tx.returned ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800 hover:bg-emerald-50 hover:text-emerald-700'
                              }`}
                            >
                              {tx.returned ? 'Returned' : 'Not Returned'}
                            </button>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setActiveTxForPay(tx);
                                setPayAmount(tx.balance > 0 ? String(tx.balance) : '');
                                setShowPayModal(true);
                              }}
                              className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg font-bold text-[11px] transition cursor-pointer"
                            >
                              Pay
                            </button>
                            <button
                              onClick={() => handleDeleteTransaction(tx.id)}
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

      {/* CATALOG VIEW */}
      {activeView === 'catalog' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {books.map(book => (
            <div key={book.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between">
                  <span className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-200">
                    <BookOpen size={18} />
                  </span>
                  <button
                    onClick={() => handleDeleteBook(book.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <span className="inline-block mt-2 px-2 py-0.5 rounded text-[9.5px] font-black uppercase tracking-wider bg-purple-50 text-purple-700">
                  {book.targetClass} • {book.subject}
                </span>
                <h4 className="font-bold text-slate-800 text-sm mt-1">{book.title}</h4>
                <div className="flex items-baseline gap-3 mt-2">
                  <span className="text-base font-extrabold text-purple-700 font-mono">
                    GHS {book.salePrice.toFixed(2)}{' '}
                    <span className="text-xs font-normal text-slate-400">(Sale)</span>
                  </span>
                  {book.rentalPrice ? (
                    <span className="text-xs font-mono text-slate-500">
                      GHS {book.rentalPrice.toFixed(2)} (Rental)
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span>Stock in Store:</span>
                <span className="font-bold text-slate-700">{book.stockQty} copies</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ADD BOOK MODAL */}
      <AnimatePresence>
        {showAddBookModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4"
            >
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <BookOpen size={18} className="text-purple-600" />
                <span>Add Textbook to Catalog</span>
              </h3>

              <form onSubmit={handleSaveBook} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Book Title *</label>
                  <input
                    type="text"
                    value={bookForm.title}
                    onChange={(e) => setBookForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Core Mathematics for Basic 8"
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Subject</label>
                    <input
                      type="text"
                      value={bookForm.subject}
                      onChange={(e) => setBookForm(prev => ({ ...prev, subject: e.target.value }))}
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Target Class</label>
                    <select
                      value={bookForm.targetClass}
                      onChange={(e) => setBookForm(prev => ({ ...prev, targetClass: e.target.value as any }))}
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-lg bg-white"
                    >
                      {CLASSES.map(cls => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Sale Price *</label>
                    <input
                      type="number"
                      value={bookForm.salePrice}
                      onChange={(e) => setBookForm(prev => ({ ...prev, salePrice: Number(e.target.value) }))}
                      required
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-lg font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Rental Fee</label>
                    <input
                      type="number"
                      value={bookForm.rentalPrice}
                      onChange={(e) => setBookForm(prev => ({ ...prev, rentalPrice: Number(e.target.value) }))}
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Stock Qty</label>
                    <input
                      type="number"
                      value={bookForm.stockQty}
                      onChange={(e) => setBookForm(prev => ({ ...prev, stockQty: Number(e.target.value) }))}
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddBookModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-semibold hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-xs transition cursor-pointer"
                  >
                    Save Book
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ISSUE BOOK MODAL */}
      <AnimatePresence>
        {showIssueModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4"
            >
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <BookOpen size={18} className="text-purple-600" />
                <span>Issue / Sell Textbook to Student</span>
              </h3>

              <form onSubmit={handleIssueBook} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Select Student *</label>
                  <select
                    value={issueStudentId}
                    onChange={(e) => setIssueStudentId(e.target.value)}
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
                  <label className="block text-slate-700 font-bold mb-1">Select Textbook *</label>
                  <select
                    value={issueBookId}
                    onChange={(e) => setIssueBookId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="">-- Choose book --</option>
                    {books.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.title} (Sale: GHS {b.salePrice} | Stock: {b.stockQty})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Transaction Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIssueType('Purchase')}
                      className={`p-2.5 rounded-lg border text-center font-bold transition cursor-pointer ${
                        issueType === 'Purchase' ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      Direct Purchase
                    </button>
                    <button
                      type="button"
                      onClick={() => setIssueType('Rental')}
                      className={`p-2.5 rounded-lg border text-center font-bold transition cursor-pointer ${
                        issueType === 'Rental' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      Term Rental
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowIssueModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-semibold hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-xs transition cursor-pointer"
                  >
                    Confirm Issue
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RECORD PAYMENT MODAL */}
      <AnimatePresence>
        {showPayModal && activeTxForPay && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4"
            >
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <DollarSign size={18} className="text-emerald-600" />
                <span>Receive Book Payment</span>
              </h3>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1">
                <div className="font-bold text-slate-800">{activeTxForPay.studentName}</div>
                <div className="text-slate-500">{activeTxForPay.bookTitle}</div>
                <div className="flex justify-between font-mono pt-1 text-slate-600">
                  <span>Balance Due:</span>
                  <strong className="text-rose-600">GHS {activeTxForPay.balance.toFixed(2)}</strong>
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
                    max={activeTxForPay.balance}
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
                    <Check size={14} /> Record & Issue
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DEDICATED OFFICIAL PRINTABLE TEXTBOOK LEDGER */}
      <div id="textbooks-ledger-print-area" className="hidden print:block font-sans text-slate-900 bg-white p-4">
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-4 text-center">
          <h1 className="text-xl font-black uppercase tracking-tight text-slate-950">
            {schoolInfo?.name || 'GeeTech Academy'}
          </h1>
          <p className="text-xs text-slate-600 font-medium mt-0.5">
            {schoolInfo?.gpsAddress || 'P.O. Box 1234, Accra, Ghana'} • Tel: {schoolInfo?.telephone || '+233 24 000 0000'}
          </p>
          <div className="inline-block mt-2 px-3 py-1 bg-slate-900 text-white font-mono text-xs font-bold uppercase tracking-widest rounded">
            TEXTBOOK INVENTORY &amp; ISSUANCE FINANCIAL REGISTER
          </div>
          <p className="text-xs font-bold text-slate-700 mt-2">
            Academic Session: {selectedAcademicYear} • {selectedTerm} | Status Filter: {statusFilter === 'All' ? 'All Issued Books' : statusFilter}
          </p>
        </div>

        {/* Metrics Overview */}
        <div className="grid grid-cols-5 gap-2 mb-4 text-center">
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Total Issued</span>
            <span className="text-sm font-black text-slate-900">{stats.totalTransactions} Books</span>
          </div>
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Total Value Billed</span>
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
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Catalog Titles</span>
            <span className="text-sm font-black text-indigo-900">{books.length} Titles ({stats.totalStock} in stock)</span>
          </div>
        </div>

        {/* Textbook Issuance Table */}
        <table className="w-full border-collapse border border-slate-400 text-[11px] mb-4">
          <thead>
            <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-400">
              <th className="border border-slate-400 p-1.5 text-center w-8">#</th>
              <th className="border border-slate-400 p-1.5 text-left">Student Name</th>
              <th className="border border-slate-400 p-1.5 text-left">Student ID</th>
              <th className="border border-slate-400 p-1.5 text-center">Class</th>
              <th className="border border-slate-400 p-1.5 text-left">Textbook Title</th>
              <th className="border border-slate-400 p-1.5 text-center">Type</th>
              <th className="border border-slate-400 p-1.5 text-right">Price (GH₵)</th>
              <th className="border border-slate-400 p-1.5 text-right">Paid (GH₵)</th>
              <th className="border border-slate-400 p-1.5 text-right">Balance (GH₵)</th>
              <th className="border border-slate-400 p-1.5 text-center">Status</th>
              <th className="border border-slate-400 p-1.5 text-center">Rental Return</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={11} className="border border-slate-400 p-4 text-center text-slate-500">
                  No textbook issuance records match the specified filters.
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx, idx) => (
                <tr key={tx.id} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                  <td className="border border-slate-400 p-1.5 text-center font-mono">{idx + 1}</td>
                  <td className="border border-slate-400 p-1.5 font-bold text-slate-900">{tx.studentName}</td>
                  <td className="border border-slate-400 p-1.5 font-mono text-[10px]">{tx.studentId}</td>
                  <td className="border border-slate-400 p-1.5 text-center font-semibold">{tx.studentClass}</td>
                  <td className="border border-slate-400 p-1.5">{tx.bookTitle}</td>
                  <td className="border border-slate-400 p-1.5 text-center">{tx.type}</td>
                  <td className="border border-slate-400 p-1.5 text-right font-mono">{tx.amount.toFixed(2)}</td>
                  <td className="border border-slate-400 p-1.5 text-right font-mono font-bold text-slate-900">{tx.paidAmount.toFixed(2)}</td>
                  <td className="border border-slate-400 p-1.5 text-right font-mono font-bold text-slate-900">{tx.balance.toFixed(2)}</td>
                  <td className="border border-slate-400 p-1.5 text-center font-bold">{tx.status}</td>
                  <td className="border border-slate-400 p-1.5 text-center font-medium">
                    {tx.type === 'Rental' ? (tx.returned ? 'Returned' : 'Not Returned') : 'N/A (Purchased)'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-900">
              <td colSpan={6} className="border border-slate-400 p-1.5 text-right uppercase">Total Textbook Billing:</td>
              <td className="border border-slate-400 p-1.5 text-right font-mono">GH₵ {stats.totalBilled.toFixed(2)}</td>
              <td className="border border-slate-400 p-1.5 text-right font-mono">GH₵ {stats.totalPaid.toFixed(2)}</td>
              <td className="border border-slate-400 p-1.5 text-right font-mono">GH₵ {stats.totalBalance.toFixed(2)}</td>
              <td colSpan={2} className="border border-slate-400 p-1.5 text-center">{filteredTransactions.length} Total Issued</td>
            </tr>
          </tfoot>
        </table>

        {/* Signatures */}
        <div className="grid grid-cols-3 gap-8 pt-6 mt-4 border-t border-slate-400 text-center text-xs">
          <div>
            <div className="border-b border-slate-900 pb-8 mb-1"></div>
            <p className="font-bold text-slate-900 uppercase">Head of Textbooks / Librarian</p>
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
    </div>
  );
}
