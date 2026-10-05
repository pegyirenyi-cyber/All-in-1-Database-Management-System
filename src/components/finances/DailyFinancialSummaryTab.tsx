import React, { useState, useMemo } from 'react';
import { AcademicYearType, TermType, SchoolInfo, Student, SchoolExpense, ExpenseCategory } from '../../types';
import { DbController } from '../../db';
import { ThemeStyles } from '../ThemeWrapper';
import { triggerToast } from '../../utils';
import { 
  Wallet, TrendingUp, TrendingDown, DollarSign, Printer, Download,
  Calendar, CheckCircle2, AlertTriangle, ShieldCheck, ArrowUpRight,
  ArrowDownRight, Filter, Search, RefreshCw, CreditCard, Banknote,
  Smartphone, Building, PieChart as PieChartIcon, Layers, FileText,
  Clock, ChevronRight, BarChart3
} from 'lucide-react';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend 
} from 'recharts';

interface Props {
  theme: ThemeStyles;
  students: Student[];
  schoolInfo: SchoolInfo;
  selectedAcademicYear: AcademicYearType;
  selectedTerm: TermType;
}

interface FlattenedFeePayment {
  id: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  academicYear: string;
  term: string;
  amount: number;
  date: string;
  component: string;
  method: 'Cash' | 'Mobile Money' | 'Bank Transfer' | 'Cheque';
  receiptNo: string;
  remarks?: string;
}

export type DateFilterType = 'single' | 'month' | 'quarter' | 'range';

const CATEGORY_COLORS = [
  '#6366F1', // Indigo
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#F43F5E', // Rose
  '#0EA5E9', // Sky
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#64748B'  // Slate
];

export default function DailyFinancialSummaryTab({
  selectedAcademicYear,
  selectedTerm,
  schoolInfo
}: Props) {
  // Current local date YYYY-MM-DD
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const currentYear = useMemo(() => {
    return parseInt(selectedAcademicYear.split('/')[0], 10) || new Date().getFullYear();
  }, [selectedAcademicYear]);

  // Filter States: Mode, Single Date, Month, Quarter, Custom Range
  const [filterType, setFilterType] = useState<DateFilterType>('single');
  const [singleDate, setSingleDate] = useState<string>(todayStr);
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-09');
  const [selectedQuarter, setSelectedQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1');
  const [customStartDate, setCustomStartDate] = useState<string>(`${currentYear}-09-01`);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  const [methodFilter, setMethodFilter] = useState<string>('All');
  const [pieScope, setPieScope] = useState<'period' | 'all'>('period');
  const [activeLedgerTab, setActiveLedgerTab] = useState<'all' | 'revenue' | 'expenses'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Calculate effective date bounds, human-readable label, and duration in days
  const { effectiveStartDate, effectiveEndDate, periodLabel, periodDays } = useMemo(() => {
    let start = singleDate;
    let end = singleDate;
    let label = `Single Day (${singleDate})`;

    if (filterType === 'single') {
      start = singleDate;
      end = singleDate;
      label = singleDate === todayStr ? `Today (${singleDate})` : `Date: ${singleDate}`;
    } else if (filterType === 'month') {
      const [yearStr, monthStr] = selectedMonth.split('-');
      const y = parseInt(yearStr, 10);
      const m = parseInt(monthStr, 10);
      const firstDay = `${yearStr}-${monthStr}-01`;
      const lastDayNum = new Date(y, m, 0).getDate();
      const lastDay = `${yearStr}-${monthStr}-${String(lastDayNum).padStart(2, '0')}`;
      start = firstDay;
      end = lastDay;
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      label = `${monthNames[m - 1]} ${y}`;
    } else if (filterType === 'quarter') {
      const baseYear = currentYear;
      const nextYear = baseYear + 1;

      if (selectedQuarter === 'Q1') {
        start = `${baseYear}-09-01`;
        end = `${baseYear}-11-30`;
        label = `Academic Q1: Autumn Term (Sep - Nov ${baseYear})`;
      } else if (selectedQuarter === 'Q2') {
        start = `${baseYear}-12-01`;
        end = `${nextYear}-02-28`;
        label = `Academic Q2: Winter Term (Dec ${baseYear} - Feb ${nextYear})`;
      } else if (selectedQuarter === 'Q3') {
        start = `${nextYear}-03-01`;
        end = `${nextYear}-05-31`;
        label = `Academic Q3: Spring Term (Mar - May ${nextYear})`;
      } else {
        start = `${nextYear}-06-01`;
        end = `${nextYear}-08-31`;
        label = `Academic Q4: Summer Session (Jun - Aug ${nextYear})`;
      }
    } else if (filterType === 'range') {
      start = customStartDate || `${currentYear}-09-01`;
      end = customEndDate || todayStr;
      label = `Custom Range: ${start} to ${end}`;
    }

    // Ensure valid chronological order
    if (start > end) {
      const temp = start;
      start = end;
      end = temp;
    }

    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    const days = Math.max(1, Math.round(Math.abs(endMs - startMs) / (1000 * 60 * 60 * 24)) + 1);

    return {
      effectiveStartDate: start,
      effectiveEndDate: end,
      periodLabel: label,
      periodDays: days
    };
  }, [filterType, singleDate, selectedMonth, selectedQuarter, customStartDate, customEndDate, currentYear, todayStr]);

  // 1. Gather all student fee payments (with multi-month demo fallback if none exist)
  const allFeePayments = useMemo(() => {
    const bills = DbController.getStudentFeeBills();
    const payments: FlattenedFeePayment[] = [];

    bills.forEach(bill => {
      if (Array.isArray(bill.payments)) {
        bill.payments.forEach(p => {
          payments.push({
            id: p.id,
            studentId: bill.studentId,
            studentName: bill.studentName || 'Student',
            studentClass: bill.class,
            academicYear: bill.academicYear,
            term: bill.term,
            amount: p.amount || 0,
            date: p.date,
            component: p.component || 'School Fees',
            method: p.method || 'Cash',
            receiptNo: p.receiptNo || 'REC-' + p.id.slice(0, 6),
            remarks: p.remarks
          });
        });
      }
    });

    return payments;
  }, []);

  // 2. Gather all operational expense vouchers
  const allExpenses = useMemo(() => {
    return DbController.getExpenses();
  }, []);

  // 3. Filtered Period Fee Payments within Effective Date Range
  const periodFeePayments = useMemo(() => {
    return allFeePayments.filter(p => {
      const matchDate = p.date >= effectiveStartDate && p.date <= effectiveEndDate;
      const matchMethod = methodFilter === 'All' || p.method === methodFilter;
      const matchSearch = searchQuery.trim() === '' || 
        p.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.receiptNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.component.toLowerCase().includes(searchQuery.toLowerCase());
      return matchDate && matchMethod && matchSearch;
    });
  }, [allFeePayments, effectiveStartDate, effectiveEndDate, methodFilter, searchQuery]);

  // 4. Filtered Period Expenses within Effective Date Range
  const periodExpenses = useMemo(() => {
    return allExpenses.filter(e => {
      const matchDate = e.paymentDate >= effectiveStartDate && e.paymentDate <= effectiveEndDate;
      const matchStatus = e.approvalStatus !== 'Rejected';
      const matchMethod = methodFilter === 'All' || e.paymentMethod === methodFilter;
      const matchSearch = searchQuery.trim() === '' || 
        e.voucherNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.payee.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchDate && matchStatus && matchMethod && matchSearch;
    });
  }, [allExpenses, effectiveStartDate, effectiveEndDate, methodFilter, searchQuery]);

  // 5. Aggregate Inflow & Outflow Numbers for Selected Period
  const periodRevenueTotal = useMemo(() => {
    return periodFeePayments.reduce((sum, p) => sum + p.amount, 0);
  }, [periodFeePayments]);

  const periodExpenseTotal = useMemo(() => {
    return periodExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [periodExpenses]);

  const periodNetCashFlow = periodRevenueTotal - periodExpenseTotal;

  // Daily averages for the period
  const dailyAverageInflow = periodDays > 0 ? periodRevenueTotal / periodDays : 0;
  const dailyAverageBurnRate = periodDays > 0 ? periodExpenseTotal / periodDays : 0;

  // 6. Cumulative Overall Liquidity Reserves
  const cumulativeRevenue = useMemo(() => {
    return allFeePayments
      .filter(p => p.academicYear === selectedAcademicYear && p.term === selectedTerm)
      .reduce((sum, p) => sum + p.amount, 0);
  }, [allFeePayments, selectedAcademicYear, selectedTerm]);

  const cumulativeExpense = useMemo(() => {
    return allExpenses
      .filter(e => e.academicYear === selectedAcademicYear && e.term === selectedTerm && e.approvalStatus !== 'Rejected')
      .reduce((sum, e) => sum + e.amount, 0);
  }, [allExpenses, selectedAcademicYear, selectedTerm]);

  const totalLiquidReserves = Math.max(0, cumulativeRevenue - cumulativeExpense);

  // Channels Liquidity Breakdown for Selected Period
  const liquidityChannels = useMemo(() => {
    const channels = {
      cash: { revenue: 0, expense: 0, net: 0 },
      momo: { revenue: 0, expense: 0, net: 0 },
      bank: { revenue: 0, expense: 0, net: 0 },
      cheque: { revenue: 0, expense: 0, net: 0 }
    };

    periodFeePayments.forEach(p => {
      if (p.method === 'Cash') channels.cash.revenue += p.amount;
      else if (p.method === 'Mobile Money') channels.momo.revenue += p.amount;
      else if (p.method === 'Bank Transfer') channels.bank.revenue += p.amount;
      else if (p.method === 'Cheque') channels.cheque.revenue += p.amount;
    });

    periodExpenses.filter(e => e.approvalStatus !== 'Rejected').forEach(e => {
      if (e.paymentMethod === 'Cash') channels.cash.expense += e.amount;
      else if (e.paymentMethod === 'Mobile Money') channels.momo.expense += e.amount;
      else if (e.paymentMethod === 'Bank Transfer') channels.bank.expense += e.amount;
      else if (e.paymentMethod === 'Cheque') channels.cheque.expense += e.amount;
    });

    channels.cash.net = channels.cash.revenue - channels.cash.expense;
    channels.momo.net = channels.momo.revenue - channels.momo.expense;
    channels.bank.net = channels.bank.revenue - channels.bank.expense;
    channels.cheque.net = channels.cheque.revenue - channels.cheque.expense;

    return channels;
  }, [periodFeePayments, periodExpenses]);

  // 7. Expenditure by Category for Recharts Pie Chart
  const categoryChartData = useMemo(() => {
    const targetExpenses = pieScope === 'period' ? periodExpenses : allExpenses.filter(e => e.approvalStatus !== 'Rejected');
    const categoryMap: Record<string, { amount: number; count: number }> = {};

    targetExpenses.forEach(exp => {
      const cat = exp.category || 'Other Operations';
      if (!categoryMap[cat]) {
        categoryMap[cat] = { amount: 0, count: 0 };
      }
      categoryMap[cat].amount += exp.amount;
      categoryMap[cat].count += 1;
    });

    const total = Object.values(categoryMap).reduce((s, c) => s + c.amount, 0);

    return Object.entries(categoryMap)
      .map(([name, data]) => ({
        name,
        value: data.amount,
        count: data.count,
        percent: total > 0 ? (data.amount / total) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);
  }, [pieScope, periodExpenses, allExpenses]);

  const totalCategorySpend = useMemo(() => {
    return categoryChartData.reduce((sum, item) => sum + item.value, 0);
  }, [categoryChartData]);

  // Handle Export CSV
  const handleExportCSV = () => {
    try {
      const rows: string[][] = [
        ['Type', 'Reference #', 'Name / Payee', 'Category / Component', 'Payment Mode', 'Inflow Revenue (GHS)', 'Outflow Expense (GHS)', 'Date']
      ];

      periodFeePayments.forEach(p => {
        rows.push([
          'Fee Revenue Inflow',
          p.receiptNo,
          `"${p.studentName.replace(/"/g, '""')}"`,
          `"${p.component}"`,
          p.method,
          p.amount.toFixed(2),
          '0.00',
          p.date
        ]);
      });

      periodExpenses.forEach(e => {
        rows.push([
          'Voucher Expense Outflow',
          e.voucherNumber,
          `"${e.payee.replace(/"/g, '""')}"`,
          `"${e.category}"`,
          e.paymentMethod,
          '0.00',
          e.amount.toFixed(2),
          e.paymentDate
        ]);
      });

      const csvContent = rows.map(r => r.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Financial_Liquidity_Statement_${effectiveStartDate}_to_${effectiveEndDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      triggerToast('Financial liquidity ledger exported to CSV', 'success');
    } catch {
      triggerToast('Failed to export CSV report', 'error');
    }
  };

  // Handle Print Statement
  const handlePrintSummary = () => {
    if (typeof (window as any).printTarget === 'function') {
      (window as any).printTarget(
        'daily-financial-summary-print-area',
        `Financial Liquidity Statement - ${periodLabel}`,
        true
      );
    } else {
      window.print();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner - Header & Action Tools */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
            <Wallet size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Daily Financial Summary &amp; Liquidity Dashboard
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                Live Liquidity
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Reconciles fee receipts against operational voucher expenditures to deliver a live snapshot of cash flow, budget consumption, and liquid reserves.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-200 cursor-pointer shadow-xs whitespace-nowrap"
            title="Export filtered liquidity ledger to CSV"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePrintSummary}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap"
            title="Generate PDF or Print Financial Summary"
          >
            <Printer size={13} />
            <span>Print / PDF Summary</span>
          </button>
        </div>
      </div>

      {/* COMPREHENSIVE DATE RANGE & TIME WINDOW FILTER PANEL */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3.5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-indigo-600 shrink-0" />
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 font-mono">
                Audit Time Window &amp; Date Range Filter
              </h3>
              <p className="text-[11px] text-slate-400">
                Filter by specific academic months, quarters, single operational days, or custom date ranges
              </p>
            </div>
          </div>

          {/* Active Period Indicator Badge */}
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200/80 px-3 py-1.5 rounded-xl text-xs font-mono font-bold text-indigo-900">
            <Clock size={13} className="text-indigo-600 shrink-0" />
            <span className="truncate max-w-[280px] sm:max-w-none">{periodLabel}</span>
            <span className="px-1.5 py-0.5 rounded bg-indigo-200 text-indigo-950 text-[10px]">
              {periodDays} {periodDays === 1 ? 'day' : 'days'}
            </span>
          </div>
        </div>

        {/* Filter Mode Selector Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setFilterType('single')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
                filterType === 'single' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Single Day
            </button>
            <button
              type="button"
              onClick={() => setFilterType('month')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
                filterType === 'month' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Academic Month
            </button>
            <button
              type="button"
              onClick={() => setFilterType('quarter')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
                filterType === 'quarter' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Academic Quarter
            </button>
            <button
              type="button"
              onClick={() => setFilterType('range')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
                filterType === 'range' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Custom Date Range
            </button>
          </div>

          {/* Contextual Sub-controls for each filter type */}
          {filterType === 'single' && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSingleDate(todayStr)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  singleDate === todayStr 
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  setSingleDate(yesterday.toISOString().split('T')[0]);
                }}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  singleDate !== todayStr && singleDate === new Date(Date.now() - 86400000).toISOString().split('T')[0]
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                Yesterday
              </button>
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-400">Date:</span>
                <input
                  type="date"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                  className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                />
              </div>
            </div>
          )}

          {filterType === 'month' && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Quick Month Pills */}
              <div className="flex items-center gap-1">
                {[
                  { id: `${currentYear}-09`, label: 'Sep' },
                  { id: `${currentYear}-10`, label: 'Oct' },
                  { id: `${currentYear}-11`, label: 'Nov' },
                  { id: `${currentYear}-12`, label: 'Dec' },
                  { id: `${currentYear + 1}-01`, label: 'Jan' },
                  { id: `${currentYear + 1}-02`, label: 'Feb' }
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMonth(m.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      selectedMonth === m.id
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Full Month Selector Dropdown */}
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-800 font-bold focus:outline-none cursor-pointer"
              >
                <option value={`${currentYear}-09`}>September {currentYear} (Academic Term Start)</option>
                <option value={`${currentYear}-10`}>October {currentYear}</option>
                <option value={`${currentYear}-11`}>November {currentYear}</option>
                <option value={`${currentYear}-12`}>December {currentYear} (Term 1 Exams)</option>
                <option value={`${currentYear + 1}-01`}>January {currentYear + 1} (Term 2 Start)</option>
                <option value={`${currentYear + 1}-02`}>February {currentYear + 1}</option>
                <option value={`${currentYear + 1}-03`}>March {currentYear + 1}</option>
                <option value={`${currentYear + 1}-04`}>April {currentYear + 1} (Term 2 Exams)</option>
                <option value={`${currentYear + 1}-05`}>May {currentYear + 1} (Term 3 Start)</option>
                <option value={`${currentYear + 1}-06`}>June {currentYear + 1}</option>
                <option value={`${currentYear + 1}-07`}>July {currentYear + 1} (Term 3 Finals)</option>
                <option value={`${currentYear + 1}-08`}>August {currentYear + 1} (Summer Recess)</option>
              </select>
            </div>
          )}

          {filterType === 'quarter' && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedQuarter('Q1')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  selectedQuarter === 'Q1'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                Q1: Sep - Nov (Autumn Term)
              </button>
              <button
                type="button"
                onClick={() => setSelectedQuarter('Q2')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  selectedQuarter === 'Q2'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                Q2: Dec - Feb (Winter Term)
              </button>
              <button
                type="button"
                onClick={() => setSelectedQuarter('Q3')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  selectedQuarter === 'Q3'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                Q3: Mar - May (Spring Term)
              </button>
              <button
                type="button"
                onClick={() => setSelectedQuarter('Q4')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  selectedQuarter === 'Q4'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                Q4: Jun - Aug (Summer Term)
              </button>
            </div>
          )}

          {filterType === 'range' && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-400">From:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                />
              </div>
              <span className="text-slate-400 font-bold text-xs">to</span>
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-400">To:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                />
              </div>

              {/* Quick Preset Buttons */}
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 7);
                  setCustomStartDate(d.toISOString().split('T')[0]);
                  setCustomEndDate(todayStr);
                }}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Past 7 Days
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 30);
                  setCustomStartDate(d.toISOString().split('T')[0]);
                  setCustomEndDate(todayStr);
                }}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Past 30 Days
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomStartDate(`${currentYear}-09-01`);
                  setCustomEndDate(todayStr);
                }}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Year-To-Date
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Primary Liquidity Snapshot Cards (Reflecting the Selected Date Range) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Period Revenue Inflow */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs relative overflow-hidden group hover:border-emerald-300 transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <ArrowUpRight size={14} className="text-emerald-500" />
              <span>Fee Inflow ({periodLabel})</span>
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Banknote size={16} />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono tracking-tight">
            GH₵ {periodRevenueTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{periodFeePayments.length} fee receipts</span>
            {periodDays > 1 && (
              <span className="font-mono text-emerald-700 font-bold">
                ~GH₵ {dailyAverageInflow.toFixed(0)}/day
              </span>
            )}
          </div>
        </div>

        {/* Metric 2: Period Voucher Expenses Outflow */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs relative overflow-hidden group hover:border-rose-300 transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <ArrowDownRight size={14} className="text-rose-500" />
              <span>Voucher Outflows</span>
            </span>
            <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <TrendingDown size={16} />
            </span>
          </div>
          <div className="text-2xl font-black text-rose-600 font-mono tracking-tight">
            GH₵ {periodExpenseTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{periodExpenses.length} vouchers disbursed</span>
            {periodDays > 1 && (
              <span className="font-mono text-rose-600 font-bold">
                ~GH₵ {dailyAverageBurnRate.toFixed(0)}/day burn
              </span>
            )}
          </div>
        </div>

        {/* Metric 3: Net Cash Position for Period */}
        <div className={`p-5 rounded-2xl border shadow-2xs relative overflow-hidden transition ${
          periodNetCashFlow >= 0 ? 'bg-indigo-50/50 border-indigo-200' : 'bg-rose-50/50 border-rose-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[10px] font-bold uppercase tracking-wider font-mono flex items-center gap-1.5 ${
              periodNetCashFlow >= 0 ? 'text-indigo-700' : 'text-rose-700'
            }`}>
              <DollarSign size={14} />
              <span>Period Net Cash Flow</span>
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase font-mono ${
              periodNetCashFlow >= 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {periodNetCashFlow >= 0 ? 'Surplus' : 'Deficit'}
            </span>
          </div>
          <div className={`text-2xl font-black font-mono tracking-tight ${
            periodNetCashFlow >= 0 ? 'text-indigo-900' : 'text-rose-700'
          }`}>
            GH₵ {periodNetCashFlow.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {periodNetCashFlow >= 0 
              ? 'Positive net liquidity contribution during this period'
              : 'Disbursements exceed fee collections in this period'}
          </p>
        </div>

        {/* Metric 4: Total Liquid Cash Reserves */}
        <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-amber-400" />
              <span>Available Liquidity Reserves</span>
            </span>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-slate-800 text-slate-300">
              Total Safe &amp; Banks
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400 tracking-tight">
            GH₵ {totalLiquidReserves.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Cumulative liquidity pool</span>
            <span className="text-emerald-400 font-bold">
              {cumulativeRevenue > 0 ? Math.round((totalLiquidReserves / cumulativeRevenue) * 100) : 100}% Liquid Margin
            </span>
          </p>
        </div>
      </div>

      {/* Payment Channels Liquidity Breakdown Strip for Selected Period */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Layers size={15} className="text-indigo-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
              Liquidity Channel Movements ({periodLabel})
            </h4>
          </div>
          <span className="text-[11px] text-slate-400">
            Reconciled collections vs disbursements per channel
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Cash In Hand */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Banknote size={14} className="text-emerald-600" />
              <span className="text-[11px] font-bold">Physical Cash Safe</span>
            </div>
            <div className="text-base font-black font-mono text-slate-800">
              GH₵ {liquidityChannels.cash.net.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 flex justify-between">
              <span>In: GH₵ {liquidityChannels.cash.revenue.toFixed(0)}</span>
              <span>Out: GH₵ {liquidityChannels.cash.expense.toFixed(0)}</span>
            </div>
          </div>

          {/* Mobile Money */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Smartphone size={14} className="text-amber-600" />
              <span className="text-[11px] font-bold">Mobile Money Wallets</span>
            </div>
            <div className="text-base font-black font-mono text-slate-800">
              GH₵ {liquidityChannels.momo.net.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 flex justify-between">
              <span>In: GH₵ {liquidityChannels.momo.revenue.toFixed(0)}</span>
              <span>Out: GH₵ {liquidityChannels.momo.expense.toFixed(0)}</span>
            </div>
          </div>

          {/* Bank Accounts */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Building size={14} className="text-indigo-600" />
              <span className="text-[11px] font-bold">Bank Accounts Deposits</span>
            </div>
            <div className="text-base font-black font-mono text-slate-800">
              GH₵ {liquidityChannels.bank.net.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 flex justify-between">
              <span>In: GH₵ {liquidityChannels.bank.revenue.toFixed(0)}</span>
              <span>Out: GH₵ {liquidityChannels.bank.expense.toFixed(0)}</span>
            </div>
          </div>

          {/* Cheques */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <CreditCard size={14} className="text-purple-600" />
              <span className="text-[11px] font-bold">Bank Cheques Cleared</span>
            </div>
            <div className="text-base font-black font-mono text-slate-800">
              GH₵ {liquidityChannels.cheque.net.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 flex justify-between">
              <span>In: GH₵ {liquidityChannels.cheque.revenue.toFixed(0)}</span>
              <span>Out: GH₵ {liquidityChannels.cheque.expense.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* RECHARTS PIE CHART: Operational Expenditure by Category (Filters by Selected Month / Quarter / Range) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Recharts Pie Chart Visualizer */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <PieChartIcon size={16} className="text-indigo-600" />
                <span>Expenditure by Category (Budget Tracking)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Visualizing operational expenditures within <strong className="text-indigo-600">{periodLabel}</strong> to track which areas consume the most budget
              </p>
            </div>

            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setPieScope('period')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${
                  pieScope === 'period' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="View expenditures for selected date range / month / quarter"
              >
                Filtered Period ({periodExpenses.length})
              </button>
              <button
                type="button"
                onClick={() => setPieScope('all')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${
                  pieScope === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="View expenditures across all session records"
              >
                All Session ({allExpenses.length})
              </button>
            </div>
          </div>

          {categoryChartData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <AlertTriangle size={32} className="text-slate-400 mb-2" />
              <p className="text-xs font-bold text-slate-600">No voucher expenditures found for this time period ({periodLabel}).</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Adjust the date range, month, or quarter filter above to analyze spending.</p>
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={85}
                    paddingAngle={3}
                    label={({ percent }: any) => `${(percent * 100).toFixed(0)}%`}
                  >
                    {categoryChartData.map((_, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} 
                        stroke="#ffffff"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any, name: any) => [
                      `GH₵ ${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                      String(name)
                    ]} 
                  />
                  <Legend 
                    layout="horizontal" 
                    verticalAlign="bottom" 
                    align="center"
                    iconType="circle"
                    formatter={(value) => <span className="text-[11px] font-medium text-slate-700">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Right: Operational Areas Consumption Ranking Table */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">
                  Top Budget Consuming Operational Areas
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Period Spend: <strong className="text-slate-800 font-mono">GH₵ {totalCategorySpend.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                </p>
              </div>
            </div>

            <div className="space-y-3 mt-3">
              {categoryChartData.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4 text-center">No category spending records in this period.</p>
              ) : (
                categoryChartData.slice(0, 5).map((cat, idx) => {
                  const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
                  return (
                    <div key={cat.name} className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span 
                            className="w-3 h-3 rounded-full shrink-0" 
                            style={{ backgroundColor: color }} 
                          />
                          <span className="font-bold text-slate-800 truncate" title={cat.name}>
                            {cat.name}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-black text-slate-900 font-mono">
                            GH₵ {cat.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 ml-1.5 font-mono">
                            ({cat.percent.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                      {/* Progress Bar */}
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(5, cat.percent))}%`, backgroundColor: color }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>{cat.count} Payment Vouchers issued</span>
                        <span>Rank #{idx + 1}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-900 flex items-start gap-2.5 mt-3">
            <CheckCircle2 size={16} className="text-indigo-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              <strong>Period Insight:</strong> Analyzing spending across academic quarters and months helps administrators balance operational disbursements against fee billing cycles.
            </p>
          </div>
        </div>
      </div>

      {/* ITEMIZE RECONCILIATIONS: Dual Transaction Ledger for Selected Date Range */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Ledger Header & Filter Controls */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <FileText size={16} className="text-indigo-600" />
              <span>Itemized Transactions &amp; Receipts ({periodLabel})</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Every fee receipt collected and operational voucher disbursed between {effectiveStartDate} and {effectiveEndDate}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Tab Selector */}
            <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 text-xs font-bold shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveLedgerTab('all')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${
                  activeLedgerTab === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({periodFeePayments.length + periodExpenses.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveLedgerTab('revenue')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${
                  activeLedgerTab === 'revenue' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Inflow Receipts ({periodFeePayments.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveLedgerTab('expenses')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${
                  activeLedgerTab === 'expenses' ? 'bg-rose-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Outflow Vouchers ({periodExpenses.length})
              </button>
            </div>

            {/* Payment Method Filter */}
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-bold focus:outline-none cursor-pointer"
            >
              <option value="All">All Payment Modes</option>
              <option value="Cash">Cash</option>
              <option value="Mobile Money">Mobile Money</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
            </select>

            {/* Search Input */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search reference or payee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 placeholder-slate-400 focus:outline-none w-48 font-medium"
              />
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-sans">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider font-mono">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Transaction Type</th>
                <th className="py-3 px-4">Ref / Receipt #</th>
                <th className="py-3 px-4">Student / Payee</th>
                <th className="py-3 px-4">Category / Component</th>
                <th className="py-3 px-4 text-center">Payment Mode</th>
                <th className="py-3 px-4 text-right">Inflow Revenue (GH₵)</th>
                <th className="py-3 px-4 text-right">Outflow Expense (GH₵)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Fee Inflows */}
              {(activeLedgerTab === 'all' || activeLedgerTab === 'revenue') && periodFeePayments.map(p => (
                <tr key={`pay-${p.id}`} className="hover:bg-emerald-50/40 transition">
                  <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">{p.date}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 w-max">
                      <ArrowUpRight size={12} /> Fee Inflow
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">{p.receiptNo}</td>
                  <td className="py-3 px-4">
                    <strong className="text-slate-900 font-bold block">{p.studentName}</strong>
                    <span className="text-[10px] text-slate-400">{p.studentClass}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-700 font-medium">{p.component}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                      {p.method}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 text-sm">
                    +GH₵ {p.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-300">—</td>
                </tr>
              ))}

              {/* Expense Outflows */}
              {(activeLedgerTab === 'all' || activeLedgerTab === 'expenses') && periodExpenses.map(e => (
                <tr key={`exp-${e.id}`} className="hover:bg-rose-50/40 transition">
                  <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">{e.paymentDate}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1 w-max">
                      <ArrowDownRight size={12} /> Voucher Outflow
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">{e.voucherNumber}</td>
                  <td className="py-3 px-4">
                    <strong className="text-slate-900 font-bold block">{e.payee}</strong>
                    <span className="text-[10px] text-slate-400">{e.title}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-700 font-medium">{e.category}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                      {e.paymentMethod}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-300">—</td>
                  <td className="py-3 px-4 text-right font-mono font-black text-rose-600 text-sm">
                    -GH₵ {e.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}

              {periodFeePayments.length === 0 && periodExpenses.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                    No transactions recorded between {effectiveStartDate} and {effectiveEndDate}. Try selecting another month, quarter, or date range above.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900 text-xs">
                <td colSpan={6} className="py-3 px-4 font-black uppercase text-right">
                  Net Period Liquidity Balance ({periodLabel}):
                </td>
                <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 text-sm">
                  +GH₵ {periodRevenueTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-4 text-right font-mono font-black text-rose-600 text-sm">
                  -GH₵ {periodExpenseTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* DEDICATED OFFICIAL PRINTABLE FINANCIAL LIQUIDITY & SPENDING AUDIT STATEMENT */}
      <div id="daily-financial-summary-print-area" className="hidden print:block font-sans text-slate-900 bg-white p-4">
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-4 text-center">
          <h1 className="text-xl font-black uppercase tracking-tight text-slate-950">
            {schoolInfo?.name || 'GeeTech Academy'}
          </h1>
          <p className="text-xs text-slate-600 font-medium mt-0.5">
            {schoolInfo?.gpsAddress || 'P.O. Box 1234, Accra, Ghana'} • Tel: {schoolInfo?.telephone || '+233 24 000 0000'}
          </p>
          <div className="inline-block mt-2 px-3 py-1 bg-slate-900 text-white font-mono text-xs font-bold uppercase tracking-widest rounded">
            FINANCIAL LIQUIDITY &amp; EXPENDITURE AUDIT STATEMENT
          </div>
          <p className="text-xs font-bold text-slate-700 mt-2 font-mono">
            Audit Window: {effectiveStartDate} to {effectiveEndDate} ({periodLabel}) • Session: {selectedAcademicYear} ({selectedTerm})
          </p>
        </div>

        {/* Executive Liquidity Metrics Table */}
        <div className="grid grid-cols-4 gap-2 mb-4 text-center">
          <div className="border border-slate-400 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Period Fee Inflow</span>
            <span className="text-sm font-black text-emerald-800 font-mono">GH₵ {periodRevenueTotal.toFixed(2)}</span>
            <span className="text-[8px] text-slate-400 block">{periodFeePayments.length} Receipts</span>
          </div>
          <div className="border border-slate-400 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Period Voucher Outflows</span>
            <span className="text-sm font-black text-rose-800 font-mono">GH₵ {periodExpenseTotal.toFixed(2)}</span>
            <span className="text-[8px] text-slate-400 block">{periodExpenses.length} Vouchers</span>
          </div>
          <div className="border border-slate-400 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Net Period Position</span>
            <span className={`text-sm font-black font-mono ${periodNetCashFlow >= 0 ? 'text-indigo-900' : 'text-rose-900'}`}>
              GH₵ {periodNetCashFlow.toFixed(2)}
            </span>
            <span className="text-[8px] text-slate-400 block">{periodNetCashFlow >= 0 ? 'Surplus' : 'Deficit'}</span>
          </div>
          <div className="border border-slate-400 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Total Liquidity Reserve</span>
            <span className="text-sm font-black text-slate-900 font-mono">GH₵ {totalLiquidReserves.toFixed(2)}</span>
            <span className="text-[8px] text-slate-400 block">Available Cash</span>
          </div>
        </div>

        {/* Expenditure by Category Summary Table */}
        <div className="mb-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2 font-mono">
            Operational Expenditure Distribution by Category ({periodLabel})
          </h4>
          <table className="w-full border-collapse border border-slate-400 text-[10px]">
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-400">
                <th className="border border-slate-400 p-1 text-left">Operational Area / Category</th>
                <th className="border border-slate-400 p-1 text-center w-24">Vouchers Count</th>
                <th className="border border-slate-400 p-1 text-right w-32">Expenditure (GH₵)</th>
                <th className="border border-slate-400 p-1 text-right w-20">Share (%)</th>
              </tr>
            </thead>
            <tbody>
              {categoryChartData.map((cat, idx) => (
                <tr key={`print-cat-${idx}`} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                  <td className="border border-slate-400 p-1 font-bold">{cat.name}</td>
                  <td className="border border-slate-400 p-1 text-center font-mono">{cat.count}</td>
                  <td className="border border-slate-400 p-1 text-right font-mono font-bold">{cat.value.toFixed(2)}</td>
                  <td className="border border-slate-400 p-1 text-right font-mono">{cat.percent.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t border-slate-400">
                <td className="border border-slate-400 p-1 uppercase">Total Period Expenditure:</td>
                <td className="border border-slate-400 p-1 text-center font-mono">
                  {categoryChartData.reduce((s, c) => s + c.count, 0)}
                </td>
                <td className="border border-slate-400 p-1 text-right font-mono">GH₵ {totalCategorySpend.toFixed(2)}</td>
                <td className="border border-slate-400 p-1 text-right font-mono">100.0%</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Period Transactions Detail Table */}
        <div className="mb-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2 font-mono">
            Itemized Receipts &amp; Disbursements ({effectiveStartDate} to {effectiveEndDate})
          </h4>
          <table className="w-full border-collapse border border-slate-400 text-[10px]">
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-400">
                <th className="border border-slate-400 p-1 text-left w-16">Date</th>
                <th className="border border-slate-400 p-1 text-left w-16">Type</th>
                <th className="border border-slate-400 p-1 text-left w-24">Reference #</th>
                <th className="border border-slate-400 p-1 text-left">Description / Student / Payee</th>
                <th className="border border-slate-400 p-1 text-left w-32">Component / Category</th>
                <th className="border border-slate-400 p-1 text-center w-20">Mode</th>
                <th className="border border-slate-400 p-1 text-right w-24">Inflow (GH₵)</th>
                <th className="border border-slate-400 p-1 text-right w-24">Outflow (GH₵)</th>
              </tr>
            </thead>
            <tbody>
              {periodFeePayments.map(p => (
                <tr key={`pr-pay-${p.id}`} className="bg-white">
                  <td className="border border-slate-400 p-1 font-mono">{p.date}</td>
                  <td className="border border-slate-400 p-1 font-bold text-emerald-800">INFLOW</td>
                  <td className="border border-slate-400 p-1 font-mono">{p.receiptNo}</td>
                  <td className="border border-slate-400 p-1 font-bold">{p.studentName} ({p.studentClass})</td>
                  <td className="border border-slate-400 p-1">{p.component}</td>
                  <td className="border border-slate-400 p-1 text-center">{p.method}</td>
                  <td className="border border-slate-400 p-1 text-right font-mono font-bold text-emerald-800">+{p.amount.toFixed(2)}</td>
                  <td className="border border-slate-400 p-1 text-right font-mono text-slate-400">-</td>
                </tr>
              ))}
              {periodExpenses.map(e => (
                <tr key={`pr-exp-${e.id}`} className="bg-slate-50">
                  <td className="border border-slate-400 p-1 font-mono">{e.paymentDate}</td>
                  <td className="border border-slate-400 p-1 font-bold text-rose-800">OUTFLOW</td>
                  <td className="border border-slate-400 p-1 font-mono">{e.voucherNumber}</td>
                  <td className="border border-slate-400 p-1 font-bold">{e.payee} - {e.title}</td>
                  <td className="border border-slate-400 p-1">{e.category}</td>
                  <td className="border border-slate-400 p-1 text-center">{e.paymentMethod}</td>
                  <td className="border border-slate-400 p-1 text-right font-mono text-slate-400">-</td>
                  <td className="border border-slate-400 p-1 text-right font-mono font-bold text-rose-800">-{e.amount.toFixed(2)}</td>
                </tr>
              ))}
              {periodFeePayments.length === 0 && periodExpenses.length === 0 && (
                <tr>
                  <td colSpan={8} className="border border-slate-400 p-2 text-center text-slate-400">
                    No transactions recorded between {effectiveStartDate} and {effectiveEndDate}.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-900">
                <td colSpan={6} className="border border-slate-400 p-1 text-right uppercase">
                  Net Period Balance:
                </td>
                <td className="border border-slate-400 p-1 text-right font-mono text-emerald-800">
                  +GH₵ {periodRevenueTotal.toFixed(2)}
                </td>
                <td className="border border-slate-400 p-1 text-right font-mono text-rose-800">
                  -GH₵ {periodExpenseTotal.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Official Signatures & Verification */}
        <div className="grid grid-cols-3 gap-6 pt-6 mt-6 border-t border-slate-400 text-center text-xs">
          <div>
            <div className="border-b border-slate-900 pb-8 mb-1"></div>
            <p className="font-bold text-slate-900 uppercase">Accounts Officer / Bursar</p>
            <p className="text-[10px] text-slate-500">Signature &amp; Date</p>
          </div>
          <div>
            <div className="border-b border-slate-900 pb-8 mb-1"></div>
            <p className="font-bold text-slate-900 uppercase">Internal Auditor</p>
            <p className="text-[10px] text-slate-500">Verification Stamp</p>
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
