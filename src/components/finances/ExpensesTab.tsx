import React, { useState, useMemo } from 'react';
import { 
  SchoolExpense, ExpenseCategory, AcademicYearType, TermType, SchoolInfo,
  CustomBillComponent, VoucherApprovalStatus, FinancialAuditLog, CustomExpenseCategory
} from '../../types';
import { DbController } from '../../db';
import { ThemeStyles } from '../ThemeWrapper';
import { triggerToast } from '../../utils';
import { 
  Receipt, Plus, Search, Printer, Trash2, Edit2, CheckCircle2, 
  DollarSign, TrendingDown, Sliders, Check, Clock,
  AlertTriangle, ShieldCheck, X, FileText, Download,
  CheckCheck, AlertCircle, Building, UserCheck
} from 'lucide-react';
import CreateBillCategoryModal from './CreateBillCategoryModal';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie } from 'recharts';

interface Props {
  theme: ThemeStyles;
  schoolInfo: SchoolInfo;
  selectedAcademicYear: AcademicYearType;
  selectedTerm: TermType;
}

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Salaries & Staff Allowances',
  'Utilities (Electricity / Water / Internet)',
  'Maintenance & Repairs',
  'Teaching & Learning Materials',
  'Vehicle Fuel & Transportation Logistics',
  'Kitchen & Canteen Supplies',
  'Sanitation & Health Supplies',
  'Sports & Co-Curricular',
  'Events & Excursions',
  'Administrative & Bank Charges',
  'ICT & Software Licensing',
  'Other Operations'
];

const STANDARD_BILL_COMPONENTS = [
  { id: 'fees', name: 'Tuition / School Fees' },
  { id: 'transportation', name: 'Transportation & Bus Services' },
  { id: 'canteen', name: 'Canteen & Daily Feeding Program' },
  { id: 'excursion', name: 'Educational Excursions & Field Trips' },
  { id: 'sports', name: 'Sports & Athletics Levy' },
  { id: 'textbooks', name: 'Textbooks & Learning Materials' }
];

// Helper to convert number to Ghanaian currency words
function numberToGhanaianWords(amount: number): string {
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  function convertGroup(num: number): string {
    let groupStr = '';
    if (num >= 100) {
      groupStr += units[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }
    if (num >= 20) {
      groupStr += tens[Math.floor(num / 10)] + (num % 10 > 0 ? '-' + units[num % 10] : '') + ' ';
    } else if (num > 0) {
      groupStr += units[num] + ' ';
    }
    return groupStr;
  }

  const integerPart = Math.floor(Math.abs(amount));
  const pesewas = Math.round((Math.abs(amount) - integerPart) * 100);

  if (integerPart === 0 && pesewas === 0) return 'Zero Ghana Cedis Only';

  let result = '';
  if (integerPart >= 1000000) {
    result += convertGroup(Math.floor(integerPart / 1000000)) + 'Million ';
  }
  const thousands = Math.floor((integerPart % 1000000) / 1000);
  if (thousands > 0) {
    result += convertGroup(thousands) + 'Thousand ';
  }
  const hundreds = integerPart % 1000;
  if (hundreds > 0) {
    result += convertGroup(hundreds);
  }

  result = result.trim() + ' Ghana Cedis';
  if (pesewas > 0) {
    result += ' and ' + convertGroup(pesewas).trim() + ' Pesewas';
  }
  return result + ' Only';
}

export default function ExpensesTab({
  theme,
  schoolInfo,
  selectedAcademicYear,
  selectedTerm
}: Props) {
  const [expenses, setExpenses] = useState<SchoolExpense[]>(() => DbController.getExpenses());
  const [auditLogs, setAuditLogs] = useState<FinancialAuditLog[]>(() => DbController.getFinancialAuditLogs());
  const [customComponents, setCustomComponents] = useState<CustomBillComponent[]>(() => DbController.getCustomBillComponents());
  const [customExpenseCategories, setCustomExpenseCategories] = useState<CustomExpenseCategory[]>(() => DbController.getExpenseCategories());
  const [isCreateCategoryModalOpen, setIsCreateCategoryModalOpen] = useState(false);

  const allExpenseCategories = useMemo(() => {
    const list: string[] = [...EXPENSE_CATEGORIES];
    customExpenseCategories.forEach(c => {
      if (c.isActive && !list.includes(c.name)) {
        list.push(c.name);
      }
    });
    return list;
  }, [customExpenseCategories]);

  const [activeView, setActiveView] = useState<'register' | 'approvals' | 'components' | 'analytics' | 'audit_trail'>('register');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [selectedComponentFilter, setSelectedComponentFilter] = useState<string>('All');
  const [selectedMethodFilter, setSelectedMethodFilter] = useState<string>('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('All');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<SchoolExpense | null>(null);
  const [pvSlipExpense, setPvSlipExpense] = useState<SchoolExpense | null>(null);

  const [expenseForm, setExpenseForm] = useState<Partial<SchoolExpense>>({
    voucherNumber: 'PV-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900),
    title: '',
    category: 'Utilities (Electricity / Water / Internet)',
    amount: 150,
    payee: '',
    paymentMethod: 'Cash',
    paymentDate: new Date().toISOString().split('T')[0],
    approvalStatus: 'Pending Approval',
    preparedBy: 'Accounts Officer',
    approvedBy: 'Headteacher',
    referenceNo: '',
    description: '',
    billComponentId: '',
    billComponentName: ''
  });

  const allAvailableBillComponents = useMemo(() => {
    return [
      ...STANDARD_BILL_COMPONENTS,
      ...customComponents.map(c => ({ id: c.id, name: c.name, budgetCap: c.expenseBudgetCap }))
    ];
  }, [customComponents]);

  const refreshData = () => {
    setExpenses([...DbController.getExpenses()]);
    setAuditLogs([...DbController.getFinancialAuditLogs()]);
    setCustomComponents([...DbController.getCustomBillComponents()]);
    setCustomExpenseCategories([...DbController.getExpenseCategories()]);
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const matchesSearch = 
        exp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exp.voucherNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exp.payee.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (exp.billComponentName && exp.billComponentName.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedCategoryFilter === 'All' || exp.category === selectedCategoryFilter;
      const matchesComponent = selectedComponentFilter === 'All' || 
        (selectedComponentFilter === 'general' ? !exp.billComponentId : exp.billComponentId === selectedComponentFilter);
      const matchesMethod = selectedMethodFilter === 'All' || exp.paymentMethod === selectedMethodFilter;
      const status = exp.approvalStatus || 'Approved';
      const matchesStatus = selectedStatusFilter === 'All' || status === selectedStatusFilter;
      const matchesSession = exp.academicYear === selectedAcademicYear && exp.term === selectedTerm;
      return matchesSearch && matchesCategory && matchesComponent && matchesMethod && matchesStatus && matchesSession;
    });
  }, [expenses, searchQuery, selectedCategoryFilter, selectedComponentFilter, selectedMethodFilter, selectedStatusFilter, selectedAcademicYear, selectedTerm]);

  const pendingApprovalExpenses = useMemo(() => {
    return expenses.filter(e => 
      e.academicYear === selectedAcademicYear && 
      e.term === selectedTerm && 
      (e.approvalStatus === 'Pending Approval' || e.approvalStatus === 'Draft')
    );
  }, [expenses, selectedAcademicYear, selectedTerm]);

  const stats = useMemo(() => {
    const termExpenses = expenses.filter(e => e.academicYear === selectedAcademicYear && e.term === selectedTerm);
    const totalExpenditure = termExpenses.reduce((sum, e) => sum + e.amount, 0);

    const disbursedExpenses = termExpenses.filter(e => (e.approvalStatus || 'Approved') === 'Disbursed');
    const totalDisbursed = disbursedExpenses.reduce((sum, e) => sum + e.amount, 0);

    const pendingExpenses = termExpenses.filter(e => e.approvalStatus === 'Pending Approval' || e.approvalStatus === 'Draft');
    const totalPending = pendingExpenses.reduce((sum, e) => sum + e.amount, 0);

    const categoryMap: Record<string, number> = {};
    termExpenses.forEach(e => {
      categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount;
    });

    const categoryChartData = Object.entries(categoryMap).map(([name, value]) => ({
      name,
      value
    })).sort((a, b) => b.value - a.value);

    const highestExpense = categoryChartData[0] || { name: 'None', value: 0 };

    return {
      count: termExpenses.length,
      totalExpenditure,
      totalDisbursed,
      pendingCount: pendingExpenses.length,
      totalPending,
      categoryChartData,
      highestCategory: highestExpense.name,
      highestAmount: highestExpense.value
    };
  }, [expenses, selectedAcademicYear, selectedTerm]);

  const handlePrintTable = () => {
    if (typeof (window as any).printTarget === 'function') {
      (window as any).printTarget(
        'expenses-register-print-area',
        `Expenditure & Voucher Register - ${selectedAcademicYear} ${selectedTerm}`,
        true
      );
    } else {
      window.print();
    }
  };

  const handlePrintPVSlip = () => {
    if (typeof (window as any).printTarget === 'function') {
      (window as any).printTarget(
        'expense-pv-slip-print-area',
        `Official Payment Voucher - ${pvSlipExpense?.voucherNumber || 'PV'}`,
        false
      );
    } else {
      window.print();
    }
  };

  // Component breakdown stats
  const componentBreakdown = useMemo(() => {
    const termExpenses = expenses.filter(e => e.academicYear === selectedAcademicYear && e.term === selectedTerm);
    
    return allAvailableBillComponents.map(comp => {
      const compExp = termExpenses.filter(e => e.billComponentId === comp.id);
      const totalCost = compExp.reduce((sum, e) => sum + e.amount, 0);
      const customComp = customComponents.find(c => c.id === comp.id);
      const budgetCap = customComp?.expenseBudgetCap || 0;
      return {
        id: comp.id,
        name: comp.name,
        vouchersCount: compExp.length,
        totalCost,
        budgetCap,
        isOverBudget: budgetCap > 0 && totalCost > budgetCap,
        variance: budgetCap > 0 ? budgetCap - totalCost : 0
      };
    });
  }, [expenses, allAvailableBillComponents, customComponents, selectedAcademicYear, selectedTerm]);

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.title || !expenseForm.amount || !expenseForm.payee) {
      triggerToast('Please provide expense description, payee, and amount.', 'error');
      return;
    }

    const linkedComp = allAvailableBillComponents.find(c => c.id === expenseForm.billComponentId);
    const customComp = customComponents.find(c => c.id === expenseForm.billComponentId);
    const budgetCap = customComp?.expenseBudgetCap;

    // Budget Cap Variance Audit Check
    if (budgetCap && budgetCap > 0) {
      const currentExpenses = expenses
        .filter(exp => exp.billComponentId === expenseForm.billComponentId && exp.id !== editingExpense?.id)
        .reduce((sum, exp) => sum + exp.amount, 0);
      const newTotal = currentExpenses + Number(expenseForm.amount);
      if (newTotal > budgetCap) {
        DbController.recordFinancialAudit({
          action: 'OVER_BUDGET_WARNING',
          entityId: expenseForm.billComponentId || 'unknown',
          entityType: 'bill_component',
          entityTitle: linkedComp ? linkedComp.name : 'Bill Component',
          performedBy: expenseForm.preparedBy || 'Accounts Officer',
          role: 'Accountant',
          details: `Expenditure of GH₵ ${Number(expenseForm.amount).toFixed(2)} pushed total cost to GH₵ ${newTotal.toFixed(2)}, exceeding budget cap of GH₵ ${budgetCap.toFixed(2)}.`,
          amount: Number(expenseForm.amount)
        });
        triggerToast(`Budget Alert: This voucher brings "${linkedComp?.name}" over its budget cap by GH₵ ${(newTotal - budgetCap).toFixed(2)}`, 'info');
      }
    }

    const payload: SchoolExpense = {
      id: editingExpense ? editingExpense.id : 'exp-' + Date.now(),
      voucherNumber: expenseForm.voucherNumber || 'PV-' + Math.floor(1000 + Math.random() * 9000),
      title: expenseForm.title,
      category: (expenseForm.category as ExpenseCategory) || 'Other Operations',
      amount: Number(expenseForm.amount),
      budgetAllocated: budgetCap,
      payee: expenseForm.payee,
      paymentMethod: (expenseForm.paymentMethod as any) || 'Cash',
      paymentDate: expenseForm.paymentDate || new Date().toISOString().split('T')[0],
      term: selectedTerm,
      academicYear: selectedAcademicYear,
      approvalStatus: (expenseForm.approvalStatus as VoucherApprovalStatus) || 'Pending Approval',
      preparedBy: expenseForm.preparedBy || 'Accounts Officer',
      approvedBy: expenseForm.approvedBy || 'Headteacher',
      approvalDate: expenseForm.approvalStatus === 'Approved' || expenseForm.approvalStatus === 'Disbursed' 
        ? (expenseForm.approvalDate || new Date().toISOString().split('T')[0]) 
        : undefined,
      disbursedDate: expenseForm.approvalStatus === 'Disbursed' 
        ? (expenseForm.disbursedDate || new Date().toISOString().split('T')[0]) 
        : undefined,
      referenceNo: expenseForm.referenceNo || undefined,
      description: expenseForm.description,
      billComponentId: expenseForm.billComponentId || undefined,
      billComponentName: linkedComp ? linkedComp.name : undefined
    };

    DbController.saveExpense(payload);
    refreshData();
    setShowAddModal(false);
    setEditingExpense(null);
    triggerToast(editingExpense ? 'Payment voucher updated successfully.' : 'New expenditure voucher submitted.', 'success');
  };

  const handleUpdateApproval = (expenseId: string, newStatus: VoucherApprovalStatus) => {
    DbController.updateExpenseApprovalStatus(expenseId, newStatus, 'Headteacher', 'Administrator');
    refreshData();
    triggerToast(`Payment voucher ${newStatus === 'Approved' ? 'approved' : newStatus === 'Disbursed' ? 'marked as disbursed' : 'updated to ' + newStatus}.`, 'success');
  };

  const handleBatchApprovePending = () => {
    if (pendingApprovalExpenses.length === 0) return;
    pendingApprovalExpenses.forEach(exp => {
      DbController.updateExpenseApprovalStatus(exp.id, 'Approved', 'Headteacher', 'Administrator');
    });
    refreshData();
    triggerToast(`Approved all ${pendingApprovalExpenses.length} pending vouchers!`, 'success');
  };

  const handleDeleteExpense = (id: string) => {
    if (confirm('Delete this expenditure voucher permanently? An audit log will be created.')) {
      DbController.deleteExpense(id);
      refreshData();
      triggerToast('Expense voucher removed.', 'info');
    }
  };

  const handleExportCSV = () => {
    try {
      const headers = ['Voucher No', 'Date', 'Title', 'Bill Component', 'Category', 'Payee', 'Method', 'Amount (GHS)', 'Status', 'Prepared By', 'Approved By', 'Reference No'];
      const rows = filteredExpenses.map(e => [
        e.voucherNumber,
        e.paymentDate,
        `"${e.title.replace(/"/g, '""')}"`,
        `"${(e.billComponentName || 'General Operations').replace(/"/g, '""')}"`,
        `"${e.category}"`,
        `"${e.payee.replace(/"/g, '""')}"`,
        e.paymentMethod,
        e.amount.toFixed(2),
        e.approvalStatus || 'Approved',
        `"${e.preparedBy || 'Accounts'}"`,
        `"${e.approvedBy || 'Headteacher'}"`,
        `"${e.referenceNo || ''}"`
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Payment_Vouchers_Ledger_${selectedAcademicYear.replace('/', '-')}_${selectedTerm.replace(' ', '_')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      triggerToast('Payment vouchers register exported to CSV', 'success');
    } catch {
      triggerToast('Failed to export vouchers', 'error');
    }
  };

  const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

  return (
    <div className="space-y-6">
      {/* Header Banner - Responsive layout preventing button overlap on laptop and desktop */}
      <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-xs space-y-4">
        {/* Top Row: Title on Left, Action Buttons on Right */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 shrink-0">
              <Receipt size={22} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Operational Expenses & Cash Disbursements</h2>
              <p className="text-xs text-slate-500">
                Payment vouchers, multi-stage digital approvals, budget cap compliance, and component expenditure tracking ({selectedAcademicYear} • {selectedTerm}).
              </p>
            </div>
          </div>

          {/* Action Buttons Toolbar with clean gap and wrapping */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={handlePrintTable}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
              title="Generate PDF or Print Expenses Summary"
            >
              <Printer size={14} />
              <span>Print / PDF Summary</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-200 cursor-pointer shrink-0 whitespace-nowrap"
              title="Export Payment Vouchers to CSV"
            >
              <Download size={13} />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingExpense(null);
                setExpenseForm({
                  voucherNumber: 'PV-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900),
                  title: '',
                  category: 'Utilities (Electricity / Water / Internet)',
                  amount: 150,
                  payee: '',
                  paymentMethod: 'Cash',
                  paymentDate: new Date().toISOString().split('T')[0],
                  approvalStatus: 'Pending Approval',
                  preparedBy: 'Accounts Officer',
                  approvedBy: 'Headteacher',
                  referenceNo: '',
                  description: '',
                  billComponentId: '',
                  billComponentName: ''
                });
                setShowAddModal(true);
              }}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Plus size={14} />
              <span>Record Voucher</span>
            </button>
          </div>
        </div>

        {/* Bottom Row: Navigation view tabs */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 overflow-x-auto scrollbar-thin">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200 overflow-x-auto scrollbar-none shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveView('register')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeView === 'register' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Vouchers ({filteredExpenses.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveView('approvals')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeView === 'approvals' ? 'bg-white text-amber-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Audit Approvals</span>
              {pendingApprovalExpenses.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-amber-500 text-white font-bold">
                  {pendingApprovalExpenses.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveView('components')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeView === 'components' ? 'bg-white text-indigo-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Component Budgets
            </button>
            <button
              type="button"
              onClick={() => setActiveView('analytics')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeView === 'analytics' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Analytics
            </button>
            <button
              type="button"
              onClick={() => setActiveView('audit_trail')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                activeView === 'audit_trail' ? 'bg-white text-emerald-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck size={13} className="text-emerald-600" />
              <span>Audit Trail</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Total Expenditures</span>
          <div className="text-xl font-bold text-rose-600 mt-1 font-mono">
            GH₵ {stats.totalExpenditure.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10.5px] text-slate-500 mt-0.5 block">{stats.count} Vouchers issued</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Disbursed Funds</span>
          <div className="text-xl font-bold text-emerald-700 mt-1 font-mono">
            GH₵ {stats.totalDisbursed.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10.5px] text-slate-500 mt-0.5 block">Cleared & paid to payees</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block font-mono">Pending Authorization</span>
          <div className="text-xl font-bold text-amber-700 mt-1 font-mono">
            GH₵ {stats.totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10.5px] text-slate-500 mt-0.5 block">{stats.pendingCount} Awaiting Headteacher approval</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Highest Category</span>
          <div className="text-sm font-bold text-slate-800 mt-1 truncate" title={stats.highestCategory}>
            {stats.highestCategory}
          </div>
          <span className="text-[10.5px] font-mono text-rose-600 mt-0.5 block font-semibold">
            GH₵ {stats.highestAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* VIEW 1: EXPENSES REGISTER TABLE */}
      {activeView === 'register' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
            <div className="flex-1 min-w-[200px] relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search voucher #, title, payee, or component..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-semibold focus:outline-none"
              >
                <option value="All">All Statuses</option>
                <option value="Pending Approval">Pending Approval</option>
                <option value="Approved">Approved</option>
                <option value="Disbursed">Disbursed</option>
                <option value="Rejected">Rejected</option>
                <option value="Draft">Draft</option>
              </select>

              <select
                value={selectedComponentFilter}
                onChange={(e) => setSelectedComponentFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-medium focus:outline-none"
              >
                <option value="All">All Bill Components</option>
                <option value="general">General Operations (Unlinked)</option>
                {allAvailableBillComponents.map(comp => (
                  <option key={comp.id} value={comp.id}>{comp.name}</option>
                ))}
              </select>

              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-medium focus:outline-none"
              >
                <option value="All">All Categories</option>
                {allExpenseCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <select
                value={selectedMethodFilter}
                onChange={(e) => setSelectedMethodFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-medium focus:outline-none"
              >
                <option value="All">All Payment Modes</option>
                <option value="Cash">Cash</option>
                <option value="Mobile Money">Mobile Money</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
              </select>

              <button
                type="button"
                onClick={handlePrintTable}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                title="Generate PDF or Print Expenses Summary"
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
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider font-mono">
                    <th className="py-3 px-3.5">Voucher #</th>
                    <th className="py-3 px-3.5">Date</th>
                    <th className="py-3 px-3.5">Expenditure Purpose</th>
                    <th className="py-3 px-3.5">Debit Component</th>
                    <th className="py-3 px-3.5">Payee / Vendor</th>
                    <th className="py-3 px-3.5">Mode</th>
                    <th className="py-3 px-3.5 text-right">Amount (GH₵)</th>
                    <th className="py-3 px-3.5 text-center">Status</th>
                    <th className="py-3 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-10 text-slate-400">
                        <Receipt size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="font-semibold text-slate-600">No operational expenses match your query.</p>
                        <p className="text-[11px] text-slate-400 mt-1">Click &ldquo;Record Voucher&rdquo; above to issue disbursements.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map(exp => {
                      const status = exp.approvalStatus || 'Approved';
                      return (
                        <tr key={exp.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-3.5 font-mono font-bold text-indigo-700">
                            {exp.voucherNumber}
                          </td>
                          <td className="py-3 px-3.5 font-mono text-slate-500 whitespace-nowrap">
                            {exp.paymentDate}
                          </td>
                          <td className="py-3 px-3.5 font-semibold text-slate-800">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{exp.title}</span>
                              {(exp.category === 'Salaries & Staff Allowances' || exp.voucherNumber.startsWith('PV-SAL-')) && (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[9px] font-mono font-bold">
                                  Staff Payroll
                                </span>
                              )}
                            </div>
                            {exp.description && (
                              <span className="text-[10.5px] text-slate-400 font-normal italic block truncate max-w-[220px]">
                                {exp.description}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3.5">
                            {exp.billComponentName ? (
                              <span className="inline-block px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-100 font-bold text-[10px]">
                                {exp.billComponentName}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">General Operations</span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-slate-700 font-medium">
                            <div>{exp.payee}</div>
                            {exp.referenceNo && (
                              <span className="text-[9.5px] font-mono text-slate-400 block">Ref: {exp.referenceNo}</span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 font-mono text-slate-600 whitespace-nowrap">
                            {exp.paymentMethod}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-black text-rose-600 whitespace-nowrap">
                            GH₵ {exp.amount.toFixed(2)}
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${
                              status === 'Disbursed' 
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : status === 'Approved'
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : status === 'Pending Approval'
                                ? 'bg-amber-50 text-amber-800 border-amber-200 animate-pulse'
                                : status === 'Rejected'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {status === 'Disbursed' && <CheckCheck size={11} />}
                              {status === 'Approved' && <CheckCircle2 size={11} />}
                              {status === 'Pending Approval' && <Clock size={11} />}
                              {status === 'Rejected' && <X size={11} />}
                              <span>{status}</span>
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              {/* Quick Approvals */}
                              {status === 'Pending Approval' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateApproval(exp.id, 'Approved')}
                                  className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold transition flex items-center gap-0.5 cursor-pointer"
                                  title="Authorize this voucher"
                                >
                                  <Check size={10} />
                                  <span>Approve</span>
                                </button>
                              )}

                              {status === 'Approved' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateApproval(exp.id, 'Disbursed')}
                                  className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold transition flex items-center gap-0.5 cursor-pointer"
                                  title="Mark cash/electronic funds as disbursed"
                                >
                                  <CheckCheck size={10} />
                                  <span>Disburse</span>
                                </button>
                              )}

                              {/* Official PV Slip Print Modal Trigger */}
                              <button
                                type="button"
                                onClick={() => setPvSlipExpense(exp)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition cursor-pointer"
                                title="Print Official Payment Voucher Slip"
                              >
                                <FileText size={13} />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingExpense(exp);
                                  setExpenseForm(exp);
                                  setShowAddModal(true);
                                }}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition cursor-pointer"
                                title="Edit voucher"
                              >
                                <Edit2 size={13} />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteExpense(exp.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                                title="Delete voucher"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: APPROVAL QUEUE & HEADTEACHER AUTHORIZATION */}
      {activeView === 'approvals' && (
        <div className="space-y-4">
          <div className="bg-amber-50/60 border border-amber-200/80 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-amber-900 flex items-center gap-2">
                <Clock size={16} className="text-amber-600" />
                <span>Pending Payment Voucher Authorizations ({pendingApprovalExpenses.length})</span>
              </h3>
              <p className="text-xs text-amber-800/80 mt-0.5">
                Segregation of duties: Accountant-prepared payment vouchers awaiting Headteacher review and approval.
              </p>
            </div>

            {pendingApprovalExpenses.length > 0 && (
              <button
                type="button"
                onClick={handleBatchApprovePending}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
              >
                <CheckCheck size={14} />
                <span>Authorize All Pending ({pendingApprovalExpenses.length})</span>
              </button>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider font-mono">
                    <th className="py-3 px-4">Voucher No</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Purpose</th>
                    <th className="py-3 px-4">Debit Component</th>
                    <th className="py-3 px-4">Payee</th>
                    <th className="py-3 px-4 text-right">Amount (GH₵)</th>
                    <th className="py-3 px-4">Prepared By</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingApprovalExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-slate-400">
                        <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500" />
                        <p className="font-semibold text-slate-700">All payment vouchers are authorized and up to date.</p>
                        <p className="text-xs text-slate-400 mt-0.5">No pending disbursement requests require review.</p>
                      </td>
                    </tr>
                  ) : (
                    pendingApprovalExpenses.map(exp => (
                      <tr key={exp.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-mono font-bold text-indigo-700">{exp.voucherNumber}</td>
                        <td className="py-3 px-4 font-mono text-slate-500">{exp.paymentDate}</td>
                        <td className="py-3 px-4 font-bold text-slate-800">{exp.title}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-100 font-bold text-[10px]">
                            {exp.billComponentName || 'General Operations'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700">{exp.payee}</td>
                        <td className="py-3 px-4 text-right font-mono font-black text-rose-600 text-xs">
                          GH₵ {exp.amount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{exp.preparedBy || 'Accounts Officer'}</td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateApproval(exp.id, 'Approved')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            >
                              <Check size={12} />
                              <span>Authorize</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateApproval(exp.id, 'Rejected')}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            >
                              <X size={12} />
                              <span>Reject</span>
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

      {/* VIEW 3: BILL COMPONENTS EXPENSE MATRIX & BUDGET CAPS */}
      {activeView === 'components' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <Sliders size={16} className="text-indigo-600" />
                <span>Bill Components Dedicated Cost Breakdown &amp; Budget Caps</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Activity-based costing analysis per billing component ({selectedAcademicYear} • {selectedTerm}).
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
              Total Components: {componentBreakdown.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider font-mono">
                  <th className="py-3 px-4">Component Stream</th>
                  <th className="py-3 px-4 text-center">Vouchers Count</th>
                  <th className="py-3 px-4 text-right">Budget Allocation Cap</th>
                  <th className="py-3 px-4 text-right">Incurred Cost (GH₵)</th>
                  <th className="py-3 px-4 text-center">Budget Status</th>
                  <th className="py-3 px-4 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {componentBreakdown.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-bold text-slate-800">
                      <div>{item.name}</div>
                      <span className="text-[10px] font-mono text-slate-400 font-normal">ID: {item.id}</span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-semibold text-slate-600">
                      {item.vouchersCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">
                      {item.budgetCap > 0 ? `GH₵ ${item.budgetCap.toFixed(2)}` : <span className="text-slate-400 italic">No cap set</span>}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-rose-600 text-xs">
                      GH₵ {item.totalCost.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.budgetCap > 0 ? (
                        item.isOverBudget ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10.5px] font-bold">
                            <AlertCircle size={11} /> Over by GH₵ {Math.abs(item.variance).toFixed(2)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10.5px] font-bold">
                            <CheckCircle2 size={11} /> Under Cap (GH₵ {item.variance.toFixed(2)} left)
                          </span>
                        )
                      ) : (
                        <span className="text-[10.5px] text-slate-400">Standard Spend</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingExpense(null);
                          setExpenseForm({
                            voucherNumber: 'PV-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900),
                            title: '',
                            category: 'Other Operations',
                            amount: 100,
                            payee: '',
                            paymentMethod: 'Cash',
                            paymentDate: new Date().toISOString().split('T')[0],
                            approvalStatus: 'Pending Approval',
                            preparedBy: 'Accounts Officer',
                            approvedBy: 'Headteacher',
                            description: '',
                            billComponentId: item.id,
                            billComponentName: item.name
                          });
                          setShowAddModal(true);
                        }}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={11} />
                        <span>Log Cost</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 4: CATEGORY ANALYTICS */}
      {activeView === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="font-bold text-slate-800 text-sm">Expenditure Distribution by Operational Category</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.categoryChartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <XAxis type="number" tickFormatter={(v) => `GH₵ ${v}`} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 9.5 }} />
                  <Tooltip formatter={(value: any) => [`GH₵ ${Number(value).toFixed(2)}`, 'Spent']} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {stats.categoryChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="font-bold text-slate-800 text-sm">Disbursement Share Matrix</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.categoryChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }: any) => `${name.substring(0, 10)}... (${(percent * 100).toFixed(0)}%)`}
                  >
                    {stats.categoryChartData.map((_, index) => (
                      <Cell key={`pie-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => [`GH₵ ${Number(value).toFixed(2)}`, 'Cost']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 5: COMPLIANCE AUDIT TRAIL */}
      {activeView === 'audit_trail' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-600" />
                <span>GES &amp; Internal Financial Compliance Audit Trail</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tamper-evident record of all voucher issuances, authorization changes, budget alerts, and disbursements.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              {auditLogs.length} Audit Entries
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider font-mono">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Audit Action</th>
                  <th className="py-3 px-4">Target Entity</th>
                  <th className="py-3 px-4">Officer &amp; Role</th>
                  <th className="py-3 px-4">Audit Particulars / Details</th>
                  <th className="py-3 px-4 text-right">Amount (GH₵)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400">
                      <ShieldCheck size={32} className="mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-slate-600">No financial audit events recorded yet.</p>
                      <p className="text-xs text-slate-400 mt-0.5">Audit events will be logged automatically upon voucher changes.</p>
                    </td>
                  </tr>
                ) : (
                  auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono text-[10.5px] text-slate-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                          log.action.includes('APPROVE')
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : log.action.includes('DISBURSE')
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : log.action.includes('OVER_BUDGET')
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : log.action.includes('DELETE')
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {log.entityTitle}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <div className="font-semibold">{log.performedBy}</div>
                        <span className="text-[10px] text-slate-400 block">{log.role}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-md">
                        {log.details}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                        {log.amount ? `GH₵ ${log.amount.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RECORD / MODIFY PAYMENT VOUCHER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Receipt className="text-rose-600" size={18} />
                <h3 className="text-sm font-bold text-slate-800">
                  {editingExpense ? 'Modify Payment Voucher' : 'Record Operating Expense Voucher'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-3 text-xs pt-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Voucher Number *</label>
                  <input
                    type="text"
                    required
                    value={expenseForm.voucherNumber}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, voucherNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Payment Date *</label>
                  <input
                    type="date"
                    value={expenseForm.paymentDate}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, paymentDate: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 font-bold">Debit to Bill Component (Optional)</label>
                  <button
                    type="button"
                    onClick={() => setIsCreateCategoryModalOpen(true)}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer select-none flex items-center gap-1"
                  >
                    <Plus size={12} className="stroke-[2.5]" />
                    <span>Not listed? Create New</span>
                  </button>
                </div>
                <select
                  value={expenseForm.billComponentId || ''}
                  onChange={(e) => {
                    const compId = e.target.value;
                    const linked = allAvailableBillComponents.find(c => c.id === compId);
                    setExpenseForm(prev => ({
                      ...prev,
                      billComponentId: compId,
                      billComponentName: linked ? linked.name : ''
                    }));
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">None / General Operations Overhead</option>
                  {allAvailableBillComponents.map(comp => (
                    <option key={comp.id} value={comp.id}>
                      {comp.name}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Assign this expenditure directly to a bill component for departmental profit &amp; loss tracking.
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Expense Purpose / Particulars *</label>
                <input
                  type="text"
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. ECG Power Prepaid Recharge or Office Duplicating Paper"
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Expense Category *</label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, category: e.target.value as any }))}
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {allExpenseCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Amount (GH₵) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, amount: Number(e.target.value) }))}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-extrabold text-rose-600 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Payment Mode</label>
                  <select
                    value={expenseForm.paymentMethod}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, paymentMethod: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Mobile Money">Mobile Money (MoMo)</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Payee / Vendor Name *</label>
                  <input
                    type="text"
                    value={expenseForm.payee}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, payee: e.target.value }))}
                    placeholder="e.g. ECG Kumasi or Allied Press"
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Cheque / MoMo Ref No.</label>
                  <input
                    type="text"
                    value={expenseForm.referenceNo || ''}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, referenceNo: e.target.value }))}
                    placeholder="e.g. CHQ-90812 or TXN-449"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Approval Stage</label>
                  <select
                    value={expenseForm.approvalStatus || 'Pending Approval'}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, approvalStatus: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Pending Approval">Pending Approval</option>
                    <option value="Approved">Approved</option>
                    <option value="Disbursed">Disbursed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Prepared By</label>
                  <input
                    type="text"
                    value={expenseForm.preparedBy || 'Accounts Officer'}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, preparedBy: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Disbursement Remarks / Notes</label>
                <textarea
                  rows={2}
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Additional invoice notes, purchase orders, or transaction IDs..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition shadow-xs cursor-pointer"
                >
                  {editingExpense ? 'Update Voucher' : 'Submit Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OFFICIAL GHANAIAN INSTITUTIONAL PAYMENT VOUCHER (PV SLIP) PRINT MODAL */}
      {pvSlipExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[95vh] overflow-y-auto">
            {/* Modal Controls */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 no-print">
              <div className="flex items-center gap-2">
                <FileText className="text-indigo-600" size={18} />
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                  Official Payment Voucher Slip (PV Slip)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintPVSlip}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer size={13} />
                  <span>Print PV Slip</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPvSlipExpense(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Printable Voucher Paper */}
            <div id="expense-pv-slip-print-area" className="p-6 mt-4 border-2 border-slate-900 rounded-lg font-serif bg-white text-slate-900 space-y-4">
              {/* Header with School Details */}
              <div className="text-center border-b-2 border-slate-900 pb-3">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Building size={20} className="text-slate-800" />
                  <h1 className="text-lg font-black uppercase tracking-wider text-slate-950">
                    {schoolInfo?.name || 'GeeTech Academy'}
                  </h1>
                </div>
                <p className="text-xs text-slate-600 font-sans">
                  {schoolInfo?.gpsAddress || 'P.O. Box 1234, Accra, Ghana'} • Tel: {schoolInfo?.telephone || '+233 24 000 0000'}
                </p>
                <div className="inline-block mt-2 px-3 py-1 bg-slate-900 text-white font-sans text-xs font-black uppercase tracking-widest rounded">
                  OFFICIAL PAYMENT VOUCHER
                </div>
              </div>

              {/* Meta Grid */}
              <div className="grid grid-cols-2 gap-4 font-sans text-xs border-b border-slate-300 pb-3">
                <div>
                  <span className="font-bold text-slate-500 uppercase text-[10px] block">Voucher Number:</span>
                  <span className="font-mono font-bold text-sm text-indigo-900">{pvSlipExpense.voucherNumber}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-500 uppercase text-[10px] block">Date of Payment:</span>
                  <span className="font-mono font-bold text-sm">{pvSlipExpense.paymentDate}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 uppercase text-[10px] block">Academic Session:</span>
                  <span className="font-semibold">{pvSlipExpense.academicYear} • {pvSlipExpense.term}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-500 uppercase text-[10px] block">Payment Method:</span>
                  <span className="font-semibold">{pvSlipExpense.paymentMethod} {pvSlipExpense.referenceNo ? `(${pvSlipExpense.referenceNo})` : ''}</span>
                </div>
              </div>

              {/* Debit Component & Particulars */}
              <div className="font-sans text-xs space-y-2 border-b border-slate-300 pb-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Account / Bill Component to Debit:</span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded font-bold text-slate-900 font-mono">
                    {pvSlipExpense.billComponentName || 'General Institutional Operations'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Paid To (Payee / Vendor):</span>
                  <span className="font-bold text-slate-950 uppercase">{pvSlipExpense.payee}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-700 block mb-0.5">Particulars / Purpose of Expenditure:</span>
                  <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-slate-800 leading-relaxed">
                    <strong className="block text-slate-900">{pvSlipExpense.title}</strong>
                    {pvSlipExpense.description && (
                      <span className="text-[11px] text-slate-600 mt-1 block">{pvSlipExpense.description}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Amount In Figures and Words */}
              <div className="p-3 bg-slate-100 rounded-lg font-sans border border-slate-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Amount in Words:</span>
                  <span className="font-bold text-slate-900 italic text-xs">
                    {numberToGhanaianWords(pvSlipExpense.amount)}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Amount in Figures:</span>
                  <span className="font-mono font-black text-base text-rose-700">
                    GH₵ {pvSlipExpense.amount.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Signatures & Approvals Trail */}
              <div className="grid grid-cols-3 gap-3 pt-6 font-sans text-[10.5px]">
                <div className="text-center border-t border-slate-900 pt-1.5">
                  <span className="font-bold block text-slate-800">PREPARED BY</span>
                  <span className="text-slate-600 block text-[9.5px]">{pvSlipExpense.preparedBy || 'Accounts Officer'}</span>
                  <span className="text-slate-400 block text-[9px] mt-0.5">Signature &amp; Date</span>
                </div>

                <div className="text-center border-t border-slate-900 pt-1.5">
                  <span className="font-bold block text-slate-800">CHECKED &amp; APPROVED BY</span>
                  <span className="text-slate-600 block text-[9.5px]">{pvSlipExpense.approvedBy || 'Headteacher'}</span>
                  <span className="text-slate-400 block text-[9px] mt-0.5">Official Stamp / Signature</span>
                </div>

                <div className="text-center border-t border-slate-900 pt-1.5">
                  <span className="font-bold block text-slate-800">RECEIVED BY (PAYEE)</span>
                  <span className="text-slate-600 block text-[9.5px]">{pvSlipExpense.payee}</span>
                  <span className="text-slate-400 block text-[9px] mt-0.5">Payee Signature &amp; Date</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED OFFICIAL PRINTABLE EXPENDITURE REGISTER */}
      <div id="expenses-register-print-area" className="hidden print:block font-sans text-slate-900 bg-white p-4">
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-4 text-center">
          <h1 className="text-xl font-black uppercase tracking-tight text-slate-950">
            {schoolInfo?.name || 'GeeTech Academy'}
          </h1>
          <p className="text-xs text-slate-600 font-medium mt-0.5">
            {schoolInfo?.gpsAddress || 'P.O. Box 1234, Accra, Ghana'} • Tel: {schoolInfo?.telephone || '+233 24 000 0000'}
          </p>
          <div className="inline-block mt-2 px-3 py-1 bg-slate-900 text-white font-mono text-xs font-bold uppercase tracking-widest rounded">
            OFFICIAL EXPENDITURE &amp; PAYMENT VOUCHER REGISTER
          </div>
          <p className="text-xs font-bold text-slate-700 mt-2">
            Academic Session: {selectedAcademicYear} • {selectedTerm} | Status: {selectedStatusFilter === 'All' ? 'All Vouchers' : selectedStatusFilter} | Category: {selectedCategoryFilter}
          </p>
        </div>

        {/* Metrics Overview */}
        <div className="grid grid-cols-5 gap-2 mb-4 text-center">
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Total Expenditure</span>
            <span className="text-sm font-black text-rose-800 font-mono">GH₵ {stats.totalExpenditure.toFixed(2)}</span>
          </div>
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Vouchers Logged</span>
            <span className="text-sm font-black text-slate-900">{stats.count} Vouchers</span>
          </div>
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Approved &amp; Disbursed</span>
            <span className="text-sm font-black text-emerald-800">{stats.count - stats.pendingCount}</span>
          </div>
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Pending Approval</span>
            <span className="text-sm font-black text-amber-800">{stats.pendingCount}</span>
          </div>
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Top Spend Dept</span>
            <span className="text-xs font-black text-slate-900 truncate block">{stats.highestCategory}</span>
          </div>
        </div>

        {/* Expenditure Register Table */}
        <table className="w-full border-collapse border border-slate-400 text-[11px] mb-4">
          <thead>
            <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-400">
              <th className="border border-slate-400 p-1.5 text-center w-8">#</th>
              <th className="border border-slate-400 p-1.5 text-left">Voucher #</th>
              <th className="border border-slate-400 p-1.5 text-left">Date</th>
              <th className="border border-slate-400 p-1.5 text-left">Expenditure Purpose</th>
              <th className="border border-slate-400 p-1.5 text-left">Debit Component</th>
              <th className="border border-slate-400 p-1.5 text-left">Payee / Vendor</th>
              <th className="border border-slate-400 p-1.5 text-center">Mode</th>
              <th className="border border-slate-400 p-1.5 text-center">Status</th>
              <th className="border border-slate-400 p-1.5 text-right">Amount (GH₵)</th>
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={9} className="border border-slate-400 p-4 text-center text-slate-500">
                  No expenditure vouchers match the specified filter criteria.
                </td>
              </tr>
            ) : (
              filteredExpenses.map((exp, idx) => (
                <tr key={exp.id} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                  <td className="border border-slate-400 p-1.5 text-center font-mono">{idx + 1}</td>
                  <td className="border border-slate-400 p-1.5 font-mono font-bold text-slate-900">{exp.voucherNumber}</td>
                  <td className="border border-slate-400 p-1.5 font-mono">{exp.paymentDate}</td>
                  <td className="border border-slate-400 p-1.5 font-bold text-slate-900">{exp.title}</td>
                  <td className="border border-slate-400 p-1.5">{exp.billComponentName || 'General'}</td>
                  <td className="border border-slate-400 p-1.5">{exp.payee}</td>
                  <td className="border border-slate-400 p-1.5 text-center">{exp.paymentMethod}</td>
                  <td className="border border-slate-400 p-1.5 text-center font-bold">{exp.approvalStatus || 'Approved'}</td>
                  <td className="border border-slate-400 p-1.5 text-right font-mono font-bold text-slate-900">{exp.amount.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-900">
              <td colSpan={8} className="border border-slate-400 p-1.5 text-right uppercase">Total Institutional Expenditure:</td>
              <td className="border border-slate-400 p-1.5 text-right font-mono">GH₵ {filteredExpenses.reduce((s, e) => s + e.amount, 0).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Signatures */}
        <div className="grid grid-cols-3 gap-8 pt-6 mt-4 border-t border-slate-400 text-center text-xs">
          <div>
            <div className="border-b border-slate-900 pb-8 mb-1"></div>
            <p className="font-bold text-slate-900 uppercase">Accounts Clerk / Officer</p>
            <p className="text-[10px] text-slate-500">Signature &amp; Date</p>
          </div>
          <div>
            <div className="border-b border-slate-900 pb-8 mb-1"></div>
            <p className="font-bold text-slate-900 uppercase">School Bursar / Auditor</p>
            <p className="text-[10px] text-slate-500">Signature &amp; Date</p>
          </div>
          <div>
            <div className="border-b border-slate-900 pb-8 mb-1"></div>
            <p className="font-bold text-slate-900 uppercase">Head of Institution</p>
            <p className="text-[10px] text-slate-500">Official Stamp &amp; Date</p>
          </div>
        </div>
      </div>

      {/* Create New Bill Category Modal */}
      <CreateBillCategoryModal
        isOpen={isCreateCategoryModalOpen}
        onClose={() => {
          setIsCreateCategoryModalOpen(false);
          setCustomComponents(DbController.getCustomBillComponents());
        }}
        onSuccess={(newComp) => {
          setCustomComponents(DbController.getCustomBillComponents());
          setExpenseForm(prev => ({
            ...prev,
            billComponentId: newComp.id,
            billComponentName: newComp.name
          }));
        }}
      />
    </div>
  );
}
