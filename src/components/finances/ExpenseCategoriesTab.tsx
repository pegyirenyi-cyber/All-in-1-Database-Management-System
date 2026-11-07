import React, { useState, useMemo, useEffect } from 'react';
import { 
  CustomExpenseCategory, 
  SchoolExpense, 
  AcademicYearType, 
  TermType, 
  SchoolInfo 
} from '../../types';
import { DbController } from '../../db';
import { ThemeStyles } from '../ThemeWrapper';
import { triggerToast } from '../../utils';
import { 
  Tags, Plus, Search, Filter, Edit2, Trash2, CheckCircle2, 
  AlertTriangle, DollarSign, TrendingDown, Layers, FileSpreadsheet,
  Printer, ArrowRight, Eye, ShieldCheck, Clock, Check, X,
  Banknote, Wrench, BookOpen, Zap, Bus, Utensils, Trophy,
  Compass, Receipt, Cpu, MoreHorizontal, Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  theme: ThemeStyles;
  schoolInfo?: SchoolInfo;
  selectedAcademicYear: AcademicYearType;
  selectedTerm: TermType;
}

const CATEGORY_ICONS: Record<string, any> = {
  Banknote,
  Wrench,
  BookOpen,
  Zap,
  Bus,
  Utensils,
  ShieldCheck,
  Trophy,
  Compass,
  Receipt,
  Cpu,
  MoreHorizontal,
  Building2,
  Tags
};

const COLOR_PRESETS = [
  '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', 
  '#ec4899', '#f59e0b', '#f97316', '#06b6d4', 
  '#14b8a6', '#64748b', '#ef4444', '#84cc16'
];

export default function ExpenseCategoriesTab({
  theme,
  schoolInfo,
  selectedAcademicYear,
  selectedTerm
}: Props) {
  const [categories, setCategories] = useState<CustomExpenseCategory[]>(() => {
    return DbController.getExpenseCategories();
  });
  const [expenses, setExpenses] = useState<SchoolExpense[]>(() => {
    return DbController.getExpenses();
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive' | 'OverBudget'>('All');

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Partial<CustomExpenseCategory> | null>(null);
  const [viewingCategoryVouchers, setViewingCategoryVouchers] = useState<CustomExpenseCategory | null>(null);

  const refreshData = () => {
    setCategories([...DbController.getExpenseCategories()]);
    setExpenses([...DbController.getExpenses()]);
  };

  // Compute expenses by category for active academic session
  const sessionExpenses = useMemo(() => {
    return expenses.filter(e => e.academicYear === selectedAcademicYear && e.term === selectedTerm);
  }, [expenses, selectedAcademicYear, selectedTerm]);

  // Map category name -> total amount and count
  const categorySpendingMap = useMemo(() => {
    const map: Record<string, { total: number; count: number; vouchers: SchoolExpense[] }> = {};
    
    categories.forEach(c => {
      map[c.name] = { total: 0, count: 0, vouchers: [] };
    });

    sessionExpenses.forEach(e => {
      const catName = e.category || 'Other Operations';
      if (!map[catName]) {
        map[catName] = { total: 0, count: 0, vouchers: [] };
      }
      map[catName].total += (Number(e.amount) || 0);
      map[catName].count += 1;
      map[catName].vouchers.push(e);
    });

    return map;
  }, [categories, sessionExpenses]);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return categories.filter(c => {
      const spending = categorySpendingMap[c.name]?.total || 0;
      const isOver = c.budgetCap ? spending > c.budgetCap : false;

      const matchesSearch = 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()));

      let matchesStatus = true;
      if (statusFilter === 'Active') matchesStatus = c.isActive;
      else if (statusFilter === 'Inactive') matchesStatus = !c.isActive;
      else if (statusFilter === 'OverBudget') matchesStatus = isOver;

      return matchesSearch && matchesStatus;
    });
  }, [categories, searchQuery, statusFilter, categorySpendingMap]);

  // Summary KPIs
  const kpis = useMemo(() => {
    const totalBudget = categories.reduce((sum, c) => c.isActive ? sum + (c.budgetCap || 0) : sum, 0);
    const totalSpent = sessionExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const overBudgetCategories = categories.filter(c => {
      const spent = categorySpendingMap[c.name]?.total || 0;
      return c.budgetCap && spent > c.budgetCap;
    }).length;

    const rate = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

    return {
      activeCount: categories.filter(c => c.isActive).length,
      totalBudget,
      totalSpent,
      overBudgetCategories,
      utilizationRate: rate
    };
  }, [categories, sessionExpenses, categorySpendingMap]);

  // Handle Save
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editingCategory.name || !editingCategory.name.trim()) {
      triggerToast('Please provide a category name.', 'error');
      return;
    }

    const trimmedName = editingCategory.name.trim();
    const isNew = !editingCategory.id;

    // Check duplicate
    const duplicate = categories.find(c => {
      if (!isNew && c.id === editingCategory.id) return false;
      return c.name.toLowerCase().trim() === trimmedName.toLowerCase().trim();
    });

    if (duplicate) {
      triggerToast(`An expense category with the name "${trimmedName}" already exists.`, 'error');
      return;
    }

    const generatedCode = editingCategory.code?.trim().toUpperCase() ||
      trimmedName.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 6) ||
      'EXP-' + Math.floor(100 + Math.random() * 900);

    const now = new Date().toISOString();
    const finalCategory: CustomExpenseCategory = {
      id: editingCategory.id || `exp_cat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: trimmedName,
      code: generatedCode,
      description: editingCategory.description?.trim() || undefined,
      budgetCap: Number(editingCategory.budgetCap) > 0 ? Number(editingCategory.budgetCap) : undefined,
      color: editingCategory.color || '#6366f1',
      iconName: editingCategory.iconName || 'Tags',
      isSystem: editingCategory.isSystem || false,
      isActive: editingCategory.isActive !== undefined ? editingCategory.isActive : true,
      createdAt: editingCategory.createdAt || now,
      updatedAt: now
    };

    DbController.saveExpenseCategory(finalCategory);
    refreshData();
    setIsEditModalOpen(false);
    setEditingCategory(null);
    triggerToast(isNew ? `Created expense category "${finalCategory.name}"` : `Updated category "${finalCategory.name}"`, 'success');
  };

  // Toggle Category Active Status
  const handleToggleStatus = (category: CustomExpenseCategory) => {
    const updated: CustomExpenseCategory = {
      ...category,
      isActive: !category.isActive,
      updatedAt: new Date().toISOString()
    };
    DbController.saveExpenseCategory(updated);
    refreshData();
    triggerToast(`Category "${category.name}" is now ${updated.isActive ? 'Active' : 'Inactive'}`, 'info');
  };

  // Delete Category
  const handleDeleteCategory = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete the category "${name}"? Any existing expense transactions will retain their historical logs.`)) {
      DbController.deleteExpenseCategory(id);
      refreshData();
      triggerToast(`Deleted category "${name}"`, 'info');
    }
  };

  // Export Category Budget & Spending Matrix to CSV
  const handleExportCSV = () => {
    if (categories.length === 0) {
      triggerToast('No categories to export.', 'info');
      return;
    }

    let csv = `EXPENSE CATEGORIES & DEPARTMENTAL BUDGET MATRIX\n`;
    csv += `Institution:,"${schoolInfo?.name || 'School'}"\n`;
    csv += `Period:,"${selectedAcademicYear} - ${selectedTerm}"\n\n`;
    csv += `Code,Category Name,Status,Term Budget Cap (GHS),Actual Spent (GHS),Vouchers Count,Variance (GHS),Utilization %,Description\n`;

    categories.forEach(c => {
      const data = categorySpendingMap[c.name] || { total: 0, count: 0 };
      const budget = c.budgetCap || 0;
      const spent = data.total;
      const variance = budget > 0 ? budget - spent : 0;
      const rate = budget > 0 ? Math.round((spent / budget) * 100) : 0;

      csv += `"${c.code}","${c.name}","${c.isActive ? 'Active' : 'Inactive'}",${budget.toFixed(2)},${spent.toFixed(2)},${data.count},${variance.toFixed(2)},${rate}%,"${(c.description || '').replace(/"/g, '""')}"\n`;
    });

    csv += `\nTOTALS,,,${kpis.totalBudget.toFixed(2)},${kpis.totalSpent.toFixed(2)},${sessionExpenses.length},${(kpis.totalBudget - kpis.totalSpent).toFixed(2)},${kpis.utilizationRate}%\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const filename = `Expense_Categories_Budget_Matrix_${selectedAcademicYear.replace(/\//g, '_')}_${selectedTerm.replace(/\s+/g, '_')}.csv`;
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    triggerToast(`Exported expense categories matrix to CSV!`, 'success');
  };

  // Print Summary
  const handlePrintMatrix = () => {
    if (typeof (window as any).printTarget === 'function') {
      (window as any).printTarget(
        'expense-categories-print-area',
        `Expense Categories & Budget Matrix - ${selectedAcademicYear} ${selectedTerm}`,
        false
      );
    } else {
      window.print();
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-md border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-400 text-slate-950 uppercase tracking-wider">
              Chart of Accounts
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-slate-300 text-xs font-medium">{selectedAcademicYear} • {selectedTerm}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2.5">
            <Tags className="text-amber-400" size={26} />
            <span>Expense Categories &amp; Budget Caps</span>
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl mt-1 leading-relaxed">
            Create and organize institutional expenditure categories (Salaries, Facilities Maintenance, Teaching Supplies, Utilities, ICT), configure term budget caps, and assign payment vouchers for audited financial oversight.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            title="Export categories schedule to CSV"
          >
            <FileSpreadsheet size={14} />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePrintMatrix}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            title="Print Budget Matrix"
          >
            <Printer size={14} />
            <span>Print Matrix</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingCategory({
                name: '',
                code: '',
                budgetCap: 3000,
                color: '#6366f1',
                iconName: 'Tags',
                isActive: true
              });
              setIsEditModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-extrabold text-xs transition flex items-center gap-1.5 shadow-md shadow-indigo-500/30 cursor-pointer active:scale-95"
          >
            <Plus size={16} className="stroke-[2.5]" />
            <span>New Expense Category</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider font-mono">
            <span>Active Categories</span>
            <Tags size={16} className="text-indigo-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
            {kpis.activeCount} <span className="text-xs font-normal text-slate-400 font-sans">/ {categories.length} total</span>
          </p>
          <p className="text-[11px] text-slate-500 font-medium">
            Standard and custom expense accounts
          </p>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider font-mono">
            <span>Allocated Term Budget</span>
            <DollarSign size={16} className="text-emerald-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
            GH₵ {kpis.totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500 font-medium">
            Total departmental budget ceiling ({selectedTerm})
          </p>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider font-mono">
            <span>Actual Expenses Disbursed</span>
            <TrendingDown size={16} className="text-rose-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-rose-700 font-mono tracking-tight">
            GH₵ {kpis.totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500 font-medium">
            Across {sessionExpenses.length} verified payment vouchers
          </p>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider font-mono">
            <span>Budget Utilization</span>
            <ShieldCheck size={16} className={kpis.utilizationRate > 100 ? 'text-rose-600' : 'text-emerald-600'} />
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
              {kpis.utilizationRate}%
            </p>
            {kpis.overBudgetCategories > 0 && (
              <span className="text-[10px] font-bold text-rose-600 font-mono">
                ({kpis.overBudgetCategories} over budget)
              </span>
            )}
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                kpis.utilizationRate > 100 ? 'bg-rose-500' : kpis.utilizationRate > 80 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, kpis.utilizationRate)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search size={14} className="absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search category name, code, particulars..."
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase font-mono">Filter:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="All">All Categories</option>
              <option value="Active">Active Only</option>
              <option value="OverBudget">Over Budget Only</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="text-xs font-bold text-slate-500 font-mono">
          Showing {filteredCategories.length} categories
        </div>
      </div>

      {/* Categories Matrix Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="expense-categories-print-area">
        {filteredCategories.map((cat) => {
          const spendingData = categorySpendingMap[cat.name] || { total: 0, count: 0, vouchers: [] };
          const budget = cat.budgetCap || 0;
          const spent = spendingData.total;
          const isOver = budget > 0 && spent > budget;
          const percent = budget > 0 ? Math.round((spent / budget) * 100) : 0;
          const IconComp = CATEGORY_ICONS[cat.iconName || 'Tags'] || Tags;

          return (
            <div 
              key={cat.id} 
              className={`bg-white rounded-2xl border transition-all p-5 space-y-4 flex flex-col justify-between shadow-2xs ${
                !cat.isActive ? 'opacity-60 border-slate-200 bg-slate-50/50' : isOver ? 'border-rose-300 ring-1 ring-rose-300' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm"
                      style={{ backgroundColor: cat.color || '#6366f1' }}
                    >
                      <IconComp size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-sm font-black text-slate-900 leading-tight">
                          {cat.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono font-extrabold uppercase px-2 py-0.2 rounded bg-slate-100 text-slate-700">
                          {cat.code}
                        </span>
                        {cat.isSystem && (
                          <span className="text-[9px] font-mono text-slate-400 uppercase font-semibold">
                            Core System
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase shrink-0 ${
                    cat.isActive 
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    {cat.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Description */}
                {cat.description && (
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                    {cat.description}
                  </p>
                )}

                {/* Financial Figures */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Spent ({selectedTerm}):</span>
                    <span className="font-mono font-bold text-slate-900">
                      GH₵ {spent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Budget Ceiling:</span>
                    <span className="font-mono font-semibold text-slate-700">
                      {budget > 0 ? `GH₵ ${budget.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'Uncapped'}
                    </span>
                  </div>

                  {budget > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className={isOver ? 'text-rose-600 font-bold' : 'text-slate-500'}>
                          {isOver ? `Over budget by GH₵ ${(spent - budget).toFixed(2)}` : `Remaining: GH₵ ${(budget - spent).toFixed(2)}`}
                        </span>
                        <span className={`font-bold ${isOver ? 'text-rose-600' : 'text-slate-700'}`}>
                          {percent}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            isOver ? 'bg-rose-500' : percent > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, percent)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setViewingCategoryVouchers(cat)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1 cursor-pointer"
                >
                  <Receipt size={13} />
                  <span>{spendingData.count} Vouchers</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(cat)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    title={cat.isActive ? 'Deactivate Category' : 'Activate Category'}
                  >
                    {cat.isActive ? <Check size={14} className="text-emerald-600" /> : <X size={14} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingCategory({ ...cat });
                      setIsEditModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    title="Edit Category"
                  >
                    <Edit2 size={14} />
                  </button>

                  {!cat.isSystem && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat.id, cat.name)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                      title="Delete Custom Category"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE / EDIT EXPENSE CATEGORY MODAL                            */}
      {/* ========================================================================= */}
      {isEditModalOpen && editingCategory && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[500] p-3 sm:p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
          >
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/60 via-slate-50 to-white">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md"
                  style={{ backgroundColor: editingCategory.color || '#6366f1' }}
                >
                  <Tags size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingCategory.id ? 'Edit Expense Category' : 'Create Custom Expense Category'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Define name, accounting code, and term budget allocation
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block text-xs font-black uppercase font-mono text-slate-700">
                  Category Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingCategory.name || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  placeholder="e.g. Science Laboratory Supplies, Security Services, Building Maintenance"
                  className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-black uppercase font-mono text-slate-700">
                    Short Accounting Code
                  </label>
                  <input
                    type="text"
                    value={editingCategory.code || ''}
                    onChange={(e) => setEditingCategory({ ...editingCategory, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. LAB, MAINT, SEC"
                    className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-black uppercase font-mono text-slate-700">
                    Term Budget Cap (GH₵)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={editingCategory.budgetCap ?? ''}
                    onChange={(e) => setEditingCategory({ ...editingCategory, budgetCap: Number(e.target.value) })}
                    placeholder="e.g. 5000"
                    className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              {/* Color Tag Selection */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase font-mono text-slate-700">
                  Badge Color
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLOR_PRESETS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setEditingCategory({ ...editingCategory, color: col })}
                      className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                        editingCategory.color === col ? 'scale-125 ring-2 ring-slate-900 ring-offset-2' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="block text-xs font-black uppercase font-mono text-slate-700">
                  Accounting Description &amp; Scope
                </label>
                <textarea
                  rows={2}
                  value={editingCategory.description || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                  placeholder="Describe permitted items and purpose for vouchers charged to this category..."
                  className="w-full px-3.5 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold transition shadow-md shadow-indigo-600/30 cursor-pointer active:scale-95"
                >
                  <span>{editingCategory.id ? 'Update Category' : 'Create Category'}</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CATEGORY EXPENSE VOUCHERS DRILL-DOWN                            */}
      {/* ========================================================================= */}
      {viewingCategoryVouchers && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[500] p-3 sm:p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
          >
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-sm"
                  style={{ backgroundColor: viewingCategoryVouchers.color || '#6366f1' }}
                >
                  <Receipt size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {viewingCategoryVouchers.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Expenditure Log • {selectedAcademicYear} • {selectedTerm}
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setViewingCategoryVouchers(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {(!categorySpendingMap[viewingCategoryVouchers.name]?.vouchers || categorySpendingMap[viewingCategoryVouchers.name].vouchers.length === 0) ? (
                <div className="p-8 text-center text-slate-400">
                  <Receipt size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="font-bold text-slate-700">No payment vouchers assigned to this category in {selectedTerm}.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">When recording expenditures in the Expenses tab, select this category to debit funds here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-600 uppercase font-mono">
                      <tr>
                        <th className="py-2.5 px-3">Voucher No</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Particulars</th>
                        <th className="py-2.5 px-3">Payee</th>
                        <th className="py-2.5 px-3">Method</th>
                        <th className="py-2.5 px-3 text-right">Amount (GH₵)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {categorySpendingMap[viewingCategoryVouchers.name].vouchers.map(v => (
                        <tr key={v.id} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">{v.voucherNumber}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-500">{v.paymentDate}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{v.title}</td>
                          <td className="py-2.5 px-3 text-slate-600">{v.payee}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{v.paymentMethod}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">GH₵ {v.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-black border-t-2 border-slate-300 text-slate-900">
                        <td colSpan={5} className="py-2.5 px-3 text-right uppercase font-mono">Total Category Disbursements:</td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-rose-700">
                          GH₵ {categorySpendingMap[viewingCategoryVouchers.name].total.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex items-center justify-end bg-slate-50">
              <button
                type="button"
                onClick={() => setViewingCategoryVouchers(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
