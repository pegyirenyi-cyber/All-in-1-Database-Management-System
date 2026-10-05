import React, { useState, useMemo } from 'react';
import { AcademicYearType, TermType, SchoolInfo, Student } from '../../types';
import { DbController } from '../../db';
import { ThemeStyles } from '../ThemeWrapper';
import { triggerToast } from '../../utils';
import { 
  Building2, TrendingUp, TrendingDown, DollarSign, 
  Printer, Coins, Bus, Utensils, Compass, Trophy, BookOpen, 
  Sliders, Download, CheckCircle2, AlertTriangle, ShieldCheck,
  FileSpreadsheet, PieChart as PieChartIcon, Calendar, Clock
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';

interface Props {
  theme: ThemeStyles;
  students: Student[];
  schoolInfo: SchoolInfo;
  selectedAcademicYear: AcademicYearType;
  selectedTerm: TermType;
}

export default function AccountingOverviewTab({
  selectedAcademicYear,
  selectedTerm,
  schoolInfo
}: Props) {
  const customComponents = useMemo(() => DbController.getCustomBillComponents(), []);

  const currentYear = useMemo(() => {
    return parseInt(selectedAcademicYear.split('/')[0], 10) || new Date().getFullYear();
  }, [selectedAcademicYear]);

  // Date Range / Period Filter States
  const [timeFilter, setTimeFilter] = useState<'all' | 'quarter' | 'month' | 'range'>('all');
  const [selectedQuarter, setSelectedQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1');
  const [selectedMonth, setSelectedMonth] = useState<string>(`${currentYear}-09`);
  const [customStartDate, setCustomStartDate] = useState<string>(`${currentYear}-09-01`);
  const [customEndDate, setCustomEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Compute effective date bounds & period label
  const { effectiveStartDate, effectiveEndDate, periodLabel } = useMemo(() => {
    if (timeFilter === 'all') {
      return {
        effectiveStartDate: null,
        effectiveEndDate: null,
        periodLabel: `Full Academic Session (${selectedAcademicYear} ${selectedTerm})`
      };
    }
    if (timeFilter === 'quarter') {
      const baseYear = currentYear;
      const nextYear = baseYear + 1;
      let start = `${baseYear}-09-01`;
      let end = `${baseYear}-11-30`;
      let label = `Academic Q1: Sep - Nov (${baseYear})`;
      if (selectedQuarter === 'Q2') {
        start = `${baseYear}-12-01`;
        end = `${nextYear}-02-28`;
        label = `Academic Q2: Dec - Feb (${baseYear}/${nextYear})`;
      } else if (selectedQuarter === 'Q3') {
        start = `${nextYear}-03-01`;
        end = `${nextYear}-05-31`;
        label = `Academic Q3: Mar - May (${nextYear})`;
      } else if (selectedQuarter === 'Q4') {
        start = `${nextYear}-06-01`;
        end = `${nextYear}-08-31`;
        label = `Academic Q4: Jun - Aug (${nextYear})`;
      }
      return { effectiveStartDate: start, effectiveEndDate: end, periodLabel: label };
    }
    if (timeFilter === 'month') {
      const [y, m] = selectedMonth.split('-');
      const first = `${y}-${m}-01`;
      const lastDayNum = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
      const last = `${y}-${m}-${String(lastDayNum).padStart(2, '0')}`;
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const label = `${monthNames[parseInt(m, 10) - 1]} ${y}`;
      return { effectiveStartDate: first, effectiveEndDate: last, periodLabel: label };
    }
    // range
    return {
      effectiveStartDate: customStartDate,
      effectiveEndDate: customEndDate,
      periodLabel: `Range: ${customStartDate} to ${customEndDate}`
    };
  }, [timeFilter, selectedQuarter, selectedMonth, customStartDate, customEndDate, currentYear, selectedAcademicYear, selectedTerm]);

  // Aggregate data from all finance sub-modules (with date range awareness)
  const accounting = useMemo(() => {
    // 1. School Fees / Tuition
    const feeBills = DbController.getStudentFeeBills().filter(b => b.academicYear === selectedAcademicYear && b.term === selectedTerm);
    const feesExpected = feeBills.reduce((sum, b) => {
      return sum + (b.schoolFees || 0) + (b.utilityBill || 0) + (b.ptaDues || 0) + (b.otherFee || 0);
    }, 0);

    const feesPaid = feeBills.reduce((sum, b) => {
      const p = (b.payments || [])
        .filter(pay => {
          if (!effectiveStartDate || !effectiveEndDate) return true;
          return pay.date >= effectiveStartDate && pay.date <= effectiveEndDate;
        })
        .reduce((pSum, pay) => pSum + (pay.amount || 0), 0);
      return sum + p;
    }, 0);
    const feesArrears = Math.max(0, feesExpected - feesPaid);

    // 2. Transportation
    const transportRecords = DbController.getTransportRecords().filter(r => r.academicYear === selectedAcademicYear && r.term === selectedTerm);
    const transportExpected = transportRecords.reduce((sum, r) => sum + r.feeAmount, 0);
    const transportPaid = transportRecords.reduce((sum, r) => sum + r.paidAmount, 0);
    const transportArrears = Math.max(0, transportExpected - transportPaid);

    // 3. Canteen / Feeding
    const canteenPayments = DbController.getCanteenPayments().filter(p => {
      const inTerm = p.academicYear === selectedAcademicYear && p.term === selectedTerm;
      if (!inTerm) return false;
      if (!effectiveStartDate || !effectiveEndDate) return true;
      return p.date >= effectiveStartDate && p.date <= effectiveEndDate;
    });
    const canteenPaid = canteenPayments.reduce((sum, p) => sum + p.amountPaid, 0);

    // 4. Excursions
    const excursionParticipants = DbController.getExcursionParticipants();
    const excursionExpected = excursionParticipants.reduce((sum, p) => sum + p.feeAmount, 0);
    const excursionPaid = excursionParticipants.reduce((sum, p) => sum + p.paidAmount, 0);
    const excursionArrears = Math.max(0, excursionExpected - excursionPaid);

    // 5. Sports
    const sportsRecords = DbController.getSportsRecords();
    const sportsExpected = sportsRecords.reduce((sum, r) => sum + r.feeAmount, 0);
    const sportsPaid = sportsRecords.reduce((sum, r) => sum + r.paidAmount, 0);
    const sportsArrears = Math.max(0, sportsExpected - sportsPaid);

    // 6. Textbooks
    const textbookTxs = DbController.getTextbookTransactions();
    const textbooksExpected = textbookTxs.reduce((sum, t) => sum + t.amount, 0);
    const textbooksPaid = textbookTxs.reduce((sum, t) => sum + t.paidAmount, 0);
    const textbooksArrears = Math.max(0, textbooksExpected - textbooksPaid);

    // Total Inflow Revenues
    const totalRevenueCollected = feesPaid + transportPaid + canteenPaid + excursionPaid + sportsPaid + textbooksPaid;
    const totalExpectedBilled = feesExpected + transportExpected + canteenPaid + excursionExpected + sportsExpected + textbooksExpected;
    const totalReceivablesArrears = feesArrears + transportArrears + excursionArrears + sportsArrears + textbooksArrears;

    // Outflow Operating Expenses (Filtered by effective date range if selected)
    const rawExpenses = DbController.getExpenses().filter(e => e.academicYear === selectedAcademicYear && e.term === selectedTerm);
    const allExpenses = rawExpenses.filter(e => {
      if (!effectiveStartDate || !effectiveEndDate) return true;
      return e.paymentDate >= effectiveStartDate && e.paymentDate <= effectiveEndDate;
    });
    const totalExpenses = allExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Component-Specific Expenses Map
    const componentExpenses: Record<string, number> = {
      fees: allExpenses.filter(e => e.billComponentId === 'fees' || (!e.billComponentId && (e.category === 'Teaching & Learning Materials' || e.category === 'Salaries & Staff Allowances'))).reduce((sum, e) => sum + e.amount, 0),
      transportation: allExpenses.filter(e => e.billComponentId === 'transportation' || e.category === 'Vehicle Fuel & Transportation Logistics').reduce((sum, e) => sum + e.amount, 0),
      canteen: allExpenses.filter(e => e.billComponentId === 'canteen' || e.category === 'Kitchen & Canteen Supplies').reduce((sum, e) => sum + e.amount, 0),
      excursion: allExpenses.filter(e => e.billComponentId === 'excursion' || e.category === 'Events & Excursions').reduce((sum, e) => sum + e.amount, 0),
      sports: allExpenses.filter(e => e.billComponentId === 'sports' || e.category === 'Sports & Co-Curricular').reduce((sum, e) => sum + e.amount, 0),
      textbooks: allExpenses.filter(e => e.billComponentId === 'textbooks').reduce((sum, e) => sum + e.amount, 0)
    };

    // Net Operating Margin (Surplus / Deficit)
    const netSurplus = totalRevenueCollected - totalExpenses;
    const collectionEfficiency = totalExpectedBilled > 0 ? Math.round((totalRevenueCollected / totalExpectedBilled) * 100) : 0;
    const operatingMarginRatio = totalRevenueCollected > 0 ? ((netSurplus / totalRevenueCollected) * 100).toFixed(1) : '0.0';

    const streamData = [
      { 
        id: 'fees',
        name: 'Tuition & Fees', 
        billed: feesExpected, 
        collected: feesPaid, 
        expenses: componentExpenses.fees,
        budgetCap: 0,
        net: feesPaid - componentExpenses.fees,
        arrears: feesArrears 
      },
      { 
        id: 'transportation',
        name: 'Transportation', 
        billed: transportExpected, 
        collected: transportPaid, 
        expenses: componentExpenses.transportation,
        budgetCap: 0,
        net: transportPaid - componentExpenses.transportation,
        arrears: transportArrears 
      },
      { 
        id: 'canteen',
        name: 'Canteen / Feeding', 
        billed: canteenPaid, 
        collected: canteenPaid, 
        expenses: componentExpenses.canteen,
        budgetCap: 0,
        net: canteenPaid - componentExpenses.canteen,
        arrears: 0 
      },
      { 
        id: 'excursion',
        name: 'Excursions', 
        billed: excursionExpected, 
        collected: excursionPaid, 
        expenses: componentExpenses.excursion,
        budgetCap: 0,
        net: excursionPaid - componentExpenses.excursion,
        arrears: excursionArrears 
      },
      { 
        id: 'sports',
        name: 'Sports & Kit', 
        billed: sportsExpected, 
        collected: sportsPaid, 
        expenses: componentExpenses.sports,
        budgetCap: 0,
        net: sportsPaid - componentExpenses.sports,
        arrears: sportsArrears 
      },
      { 
        id: 'textbooks',
        name: 'Textbooks', 
        billed: textbooksExpected, 
        collected: textbooksPaid, 
        expenses: componentExpenses.textbooks,
        budgetCap: 0,
        net: textbooksPaid - componentExpenses.textbooks,
        arrears: textbooksArrears 
      }
    ];

    // Add custom components to stream data
    customComponents.forEach(c => {
      const cExp = allExpenses.filter(e => e.billComponentId === c.id).reduce((sum, e) => sum + e.amount, 0);
      if (cExp > 0 || c.isActive) {
        streamData.push({
          id: c.id,
          name: c.name,
          billed: c.defaultAmount,
          collected: c.defaultAmount,
          expenses: cExp,
          budgetCap: c.expenseBudgetCap || 0,
          net: c.defaultAmount - cExp,
          arrears: 0
        });
      }
    });

    const overBudgetCount = streamData.filter(s => s.budgetCap > 0 && s.expenses > s.budgetCap).length;

    // Aggregate category expenditures for Recharts Pie Chart
    const categoryTotals: Record<string, number> = {};
    allExpenses.forEach(exp => {
      const cat = exp.category || 'Other Operations';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + exp.amount;
    });

    const categoryChartData = Object.entries(categoryTotals)
      .map(([name, value]) => ({
        name,
        value,
        percent: totalExpenses > 0 ? (value / totalExpenses) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);

    return {
      totalExpectedBilled,
      totalRevenueCollected,
      totalExpenses,
      netSurplus,
      totalReceivablesArrears,
      collectionEfficiency,
      operatingMarginRatio,
      streamData,
      categoryChartData,
      expensesCount: allExpenses.length,
      overBudgetCount
    };
  }, [selectedAcademicYear, selectedTerm, customComponents]);

  const handleExportCSV = () => {
    try {
      const headers = ['Bill Component Stream', 'Billed Expected (GHS)', 'Collected Inflow (GHS)', 'Dedicated Expenses (GHS)', 'Budget Allocation Cap (GHS)', 'Net Margin (GHS)', 'Status', 'Arrears Due (GHS)'];
      const rows = accounting.streamData.map(s => [
        `"${s.name.replace(/"/g, '""')}"`,
        s.billed.toFixed(2),
        s.collected.toFixed(2),
        s.expenses.toFixed(2),
        s.budgetCap > 0 ? s.budgetCap.toFixed(2) : 'N/A',
        s.net.toFixed(2),
        s.net >= 0 ? 'Surplus' : 'Deficit',
        s.arrears.toFixed(2)
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Institutional_Financial_Audit_${selectedAcademicYear.replace('/', '-')}_${selectedTerm.replace(' ', '_')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      triggerToast('Institutional audit schedule exported to CSV', 'success');
    } catch {
      triggerToast('Failed to export audit report', 'error');
    }
  };

  const handlePrintStatement = () => {
    if (typeof (window as any).printTarget === 'function') {
      (window as any).printTarget(
        'accounting-overview-print-area',
        `Official Financial Statement & P&L Matrix - ${selectedAcademicYear} ${selectedTerm}`,
        true
      );
    } else {
      window.print();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner - Responsive flex-wrap with zero desktop overlap */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-slate-900 text-amber-400 border border-slate-800 shrink-0">
              <Building2 size={22} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Business Accounting &amp; Institutional P&amp;L Audit</h2>
              <p className="text-xs text-slate-500">
                Consolidated profit &amp; loss, component-specific expense reconciliations, receivables, and balance sheet for {selectedAcademicYear} • {selectedTerm}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-200 cursor-pointer shadow-xs whitespace-nowrap"
          >
            <Download size={13} />
            <span>Export CSV Report</span>
          </button>

          <button
            type="button"
            onClick={handlePrintStatement}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap"
            title="Generate PDF or Print Financial Overview Summary"
          >
            <Printer size={13} />
            <span>Print / PDF Summary</span>
          </button>
        </div>
      </div>

      {/* Date Range, Academic Quarter, & Month Filter Panel */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Calendar size={15} className="text-indigo-600 shrink-0" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-800 font-mono">
              Audit Window Filter
            </span>
          </div>

          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200/80 px-2.5 py-1 rounded-xl text-xs font-mono font-bold text-indigo-900">
            <Clock size={12} className="text-indigo-600 shrink-0" />
            <span>{periodLabel}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Buttons */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setTimeFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
                timeFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Full Term
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('quarter')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
                timeFilter === 'quarter' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Academic Quarter
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('month')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
                timeFilter === 'month' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Academic Month
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('range')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
                timeFilter === 'range' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Custom Range
            </button>
          </div>

          {/* Sub-controls */}
          {timeFilter === 'quarter' && (
            <div className="flex items-center gap-1.5">
              {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setSelectedQuarter(q)}
                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    selectedQuarter === q
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  {q}: {q === 'Q1' ? 'Sep-Nov' : q === 'Q2' ? 'Dec-Feb' : q === 'Q3' ? 'Mar-May' : 'Jun-Aug'}
                </button>
              ))}
            </div>
          )}

          {timeFilter === 'month' && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-800 font-bold focus:outline-none cursor-pointer"
            >
              <option value={`${currentYear}-09`}>September {currentYear}</option>
              <option value={`${currentYear}-10`}>October {currentYear}</option>
              <option value={`${currentYear}-11`}>November {currentYear}</option>
              <option value={`${currentYear}-12`}>December {currentYear}</option>
              <option value={`${currentYear + 1}-01`}>January {currentYear + 1}</option>
              <option value={`${currentYear + 1}-02`}>February {currentYear + 1}</option>
              <option value={`${currentYear + 1}-03`}>March {currentYear + 1}</option>
              <option value={`${currentYear + 1}-04`}>April {currentYear + 1}</option>
              <option value={`${currentYear + 1}-05`}>May {currentYear + 1}</option>
            </select>
          )}

          {timeFilter === 'range' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50"
              />
              <span className="text-xs text-slate-400 font-bold">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50"
              />
            </div>
          )}
        </div>
      </div>

      {/* Primary Financial Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Collections */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block font-mono flex items-center gap-1">
            <TrendingUp size={13} />
            <span>Total Revenue Inflow</span>
          </span>
          <div className="text-2xl font-black text-emerald-700 font-mono">
            GH₵ {accounting.totalRevenueCollected.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-500 block pt-1">
            Across fees, bus, food, tours, sports &amp; books
          </span>
        </div>

        {/* Total Operating Costs */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block font-mono flex items-center gap-1">
            <TrendingDown size={13} />
            <span>Operating Expenditures</span>
          </span>
          <div className="text-2xl font-black text-rose-600 font-mono">
            GH₵ {accounting.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-500 block pt-1">
            {accounting.expensesCount} Vouchers across all components
          </span>
        </div>

        {/* Net Operating Surplus */}
        <div className={`p-5 rounded-2xl border shadow-2xs space-y-1 ${
          accounting.netSurplus >= 0 ? 'bg-indigo-50/50 border-indigo-200' : 'bg-rose-50/50 border-rose-200'
        }`}>
          <span className={`text-[10px] font-bold uppercase tracking-wider block font-mono flex items-center gap-1 ${
            accounting.netSurplus >= 0 ? 'text-indigo-600' : 'text-rose-600'
          }`}>
            <DollarSign size={13} />
            <span>Net Institutional Surplus</span>
          </span>
          <div className={`text-2xl font-black font-mono ${
            accounting.netSurplus >= 0 ? 'text-indigo-700' : 'text-rose-700'
          }`}>
            GH₵ {accounting.netSurplus.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-500 block pt-1">
            Operating Net Margin: <strong className="font-bold">{accounting.operatingMarginRatio}%</strong>
          </span>
        </div>

        {/* Collection Efficiency */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block font-mono">
            Collection Efficiency
          </span>
          <div className="text-2xl font-black text-slate-800 font-mono">
            {accounting.collectionEfficiency}%
          </div>
          <span className="text-[11px] text-slate-500 block pt-1">
            GH₵ {accounting.totalReceivablesArrears.toLocaleString('en-US', { minimumFractionDigits: 2 })} Outstanding Arrears
          </span>
        </div>
      </div>

      {/* GES & District Audit Certification Status Ribbon */}
      <div className="p-3.5 bg-slate-900 text-white rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold block">
              INSTITUTIONAL AUDIT &amp; COMPLIANCE STATUS
            </span>
            <p className="text-xs text-slate-300 font-medium">
              Voucher ledger reconciliation: {accounting.overBudgetCount === 0 ? 'All component spend within assigned allocations.' : `${accounting.overBudgetCount} component(s) exceeding departmental budget limits.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
            Term Status: <strong className="text-emerald-400 font-bold">{accounting.netSurplus >= 0 ? 'Surplus' : 'Deficit'}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
            Audited Sessions: {selectedAcademicYear}
          </span>
        </div>
      </div>

      {/* Bill Components P&L Matrix Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Sliders size={16} className="text-indigo-600" />
              <span>Bill Components Profit &amp; Loss Breakdown &amp; Budget Caps</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Net operating balance and expense caps per bill component for {selectedAcademicYear} • {selectedTerm}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-sans">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider font-mono">
                <th className="py-3 px-4">Bill Component Stream</th>
                <th className="py-3 px-4 text-right">Collected Inflow (GH₵)</th>
                <th className="py-3 px-4 text-right">Dedicated Expenses (GH₵)</th>
                <th className="py-3 px-4 text-right">Budget Allocation Cap</th>
                <th className="py-3 px-4 text-right">Net Margin (GH₵)</th>
                <th className="py-3 px-4 text-center">Audit Status</th>
                <th className="py-3 px-4 text-right">Arrears Due (GH₵)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accounting.streamData.map(stream => {
                const isNetPositive = stream.net >= 0;
                const isOverBudget = stream.budgetCap > 0 && stream.expenses > stream.budgetCap;
                return (
                  <tr key={stream.name} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-bold text-slate-800 flex items-center gap-2">
                      {stream.name.includes('Tuition') && <Coins size={14} className="text-amber-500 shrink-0" />}
                      {stream.name.includes('Transport') && <Bus size={14} className="text-indigo-500 shrink-0" />}
                      {stream.name.includes('Canteen') && <Utensils size={14} className="text-emerald-500 shrink-0" />}
                      {stream.name.includes('Excursion') && <Compass size={14} className="text-sky-500 shrink-0" />}
                      {stream.name.includes('Sports') && <Trophy size={14} className="text-orange-500 shrink-0" />}
                      {stream.name.includes('Textbook') && <BookOpen size={14} className="text-purple-500 shrink-0" />}
                      {!['Tuition', 'Transport', 'Canteen', 'Excursion', 'Sports', 'Textbook'].some(k => stream.name.includes(k)) && (
                        <Sliders size={14} className="text-indigo-600 shrink-0" />
                      )}
                      <span>{stream.name}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                      GH₵ {stream.collected.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                      GH₵ {stream.expenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">
                      {stream.budgetCap > 0 ? `GH₵ ${stream.budgetCap.toFixed(2)}` : <span className="text-slate-400 italic">No cap set</span>}
                    </td>
                    <td className={`py-3 px-4 text-right font-mono font-black ${
                      isNetPositive ? 'text-indigo-700' : 'text-rose-700'
                    }`}>
                      GH₵ {stream.net.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {stream.budgetCap > 0 ? (
                        isOverBudget ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Over Cap
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Within Cap
                          </span>
                        )
                      ) : (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isNetPositive ? 'bg-slate-100 text-slate-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {isNetPositive ? 'Surplus' : 'Deficit'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-500">
                      GH₵ {stream.arrears.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900 text-xs">
                <td className="py-3 px-4 font-black">TOTALS CONSOLIDATED</td>
                <td className="py-3 px-4 text-right font-mono text-emerald-700">
                  GH₵ {accounting.totalRevenueCollected.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-4 text-right font-mono text-rose-600">
                  GH₵ {accounting.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-4 text-right font-mono text-slate-400">—</td>
                <td className={`py-3 px-4 text-right font-mono font-black ${
                  accounting.netSurplus >= 0 ? 'text-indigo-700' : 'text-rose-700'
                }`}>
                  GH₵ {accounting.netSurplus.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-4 text-center font-mono text-[10px] uppercase font-bold text-slate-600">
                  {accounting.netSurplus >= 0 ? 'Institutional Surplus' : 'Institutional Deficit'}
                </td>
                <td className="py-3 px-4 text-right font-mono text-slate-500">
                  GH₵ {accounting.totalReceivablesArrears.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Visual Analytics: Component Comparison BarChart + Category Expenditure Recharts PieChart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Component Collections vs Expenses Bar Chart */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <h3 className="font-bold text-slate-800 text-sm">Revenue Collections vs Dedicated Expenses by Component</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={accounting.streamData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => `GH₵ ${v}`} />
                <Tooltip formatter={(value: any) => [`GH₵ ${Number(value).toFixed(2)}`, '']} />
                <Legend />
                <Bar dataKey="collected" name="Collected Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Dedicated Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Expenditure by Category Recharts Pie Chart */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-start sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <PieChartIcon size={16} className="text-indigo-600" />
                <span>Expenditure by Category</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {periodLabel}
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-rose-600 shrink-0">
              Total: GH₵ {accounting.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={accounting.categoryChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={36}
                  paddingAngle={2}
                  label={({ percent }: any) => `${(percent * 100).toFixed(0)}%`}
                >
                  {accounting.categoryChartData.map((_, index) => (
                    <Cell 
                      key={`pie-cell-${index}`} 
                      fill={['#6366F1', '#10B981', '#F59E0B', '#F43F5E', '#0EA5E9', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#64748B'][index % 10]} 
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
                  formatter={(value) => <span className="text-[10.5px] font-medium text-slate-700">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* DEDICATED OFFICIAL PRINTABLE FINANCIAL STATEMENT & P&L MATRIX */}
      <div id="accounting-overview-print-area" className="hidden print:block font-sans text-slate-900 bg-white p-4">
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-4 text-center">
          <h1 className="text-xl font-black uppercase tracking-tight text-slate-950">
            {schoolInfo?.name || 'GeeTech Academy'}
          </h1>
          <p className="text-xs text-slate-600 font-medium mt-0.5">
            {schoolInfo?.gpsAddress || 'P.O. Box 1234, Accra, Ghana'} • Tel: {schoolInfo?.telephone || '+233 24 000 0000'}
          </p>
          <div className="inline-block mt-2 px-3 py-1 bg-slate-900 text-white font-mono text-xs font-bold uppercase tracking-widest rounded">
            OFFICIAL FINANCIAL STATEMENT &amp; PROFITABILITY MATRIX
          </div>
          <p className="text-xs font-bold text-slate-700 mt-2">
            Academic Session: {selectedAcademicYear} • {selectedTerm} | Institutional Income &amp; Operating Margins
          </p>
        </div>

        {/* Executive Metrics Overview */}
        <div className="grid grid-cols-5 gap-2 mb-4 text-center">
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Total Revenue Inflow</span>
            <span className="text-sm font-black text-emerald-800 font-mono">
              GH₵ {accounting.totalRevenueCollected.toFixed(2)}
            </span>
          </div>
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Total Expenses</span>
            <span className="text-sm font-black text-rose-800 font-mono">
              GH₵ {accounting.totalExpenses.toFixed(2)}
            </span>
          </div>
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Net Operating Margin</span>
            <span className={`text-sm font-black font-mono ${accounting.netSurplus >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
              GH₵ {accounting.netSurplus.toFixed(2)}
            </span>
          </div>
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Operating Ratio</span>
            <span className="text-sm font-black text-indigo-900">
              {accounting.totalRevenueCollected > 0 ? ((accounting.netSurplus / accounting.totalRevenueCollected) * 100).toFixed(1) : '0'}%
            </span>
          </div>
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Receivables Arrears</span>
            <span className="text-sm font-black text-slate-900 font-mono">
              GH₵ {accounting.totalReceivablesArrears.toFixed(2)}
            </span>
          </div>
        </div>

        {/* P&L Breakdown Table */}
        <table className="w-full border-collapse border border-slate-400 text-[11px] mb-4">
          <thead>
            <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-400">
              <th className="border border-slate-400 p-1.5 text-center w-8">#</th>
              <th className="border border-slate-400 p-1.5 text-left">Bill Component / Account Stream</th>
              <th className="border border-slate-400 p-1.5 text-right">Inflow Billed (GH₵)</th>
              <th className="border border-slate-400 p-1.5 text-right">Revenue Collected (GH₵)</th>
              <th className="border border-slate-400 p-1.5 text-right">Expenses (GH₵)</th>
              <th className="border border-slate-400 p-1.5 text-right">Budget Cap (GH₵)</th>
              <th className="border border-slate-400 p-1.5 text-right">Net Margin (GH₵)</th>
              <th className="border border-slate-400 p-1.5 text-center">Recovery</th>
              <th className="border border-slate-400 p-1.5 text-right">Arrears (GH₵)</th>
            </tr>
          </thead>
          <tbody>
            {accounting.streamData.map((item, idx) => (
              <tr key={item.id} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                <td className="border border-slate-400 p-1.5 text-center font-mono">{idx + 1}</td>
                <td className="border border-slate-400 p-1.5 font-bold text-slate-900">{item.name}</td>
                <td className="border border-slate-400 p-1.5 text-right font-mono">{item.billed.toFixed(2)}</td>
                <td className="border border-slate-400 p-1.5 text-right font-mono font-bold text-slate-900">{item.collected.toFixed(2)}</td>
                <td className="border border-slate-400 p-1.5 text-right font-mono font-bold text-slate-900">{item.expenses.toFixed(2)}</td>
                <td className="border border-slate-400 p-1.5 text-right font-mono text-slate-600">
                  {item.budgetCap > 0 ? item.budgetCap.toFixed(2) : '—'}
                </td>
                <td className={`border border-slate-400 p-1.5 text-right font-mono font-bold ${
                  item.net >= 0 ? 'text-slate-900' : 'text-rose-700'
                }`}>
                  {item.net.toFixed(2)}
                </td>
                <td className="border border-slate-400 p-1.5 text-center font-semibold">
                  {item.billed > 0 ? Math.round((item.collected / item.billed) * 100) : 0}%
                </td>
                <td className="border border-slate-400 p-1.5 text-right font-mono text-slate-700">{item.arrears.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-900">
              <td colSpan={2} className="border border-slate-400 p-1.5 text-right uppercase">Institutional Total:</td>
              <td className="border border-slate-400 p-1.5 text-right font-mono">GH₵ {accounting.totalExpectedBilled.toFixed(2)}</td>
              <td className="border border-slate-400 p-1.5 text-right font-mono">GH₵ {accounting.totalRevenueCollected.toFixed(2)}</td>
              <td className="border border-slate-400 p-1.5 text-right font-mono">GH₵ {accounting.totalExpenses.toFixed(2)}</td>
              <td className="border border-slate-400 p-1.5 text-right font-mono">—</td>
              <td className="border border-slate-400 p-1.5 text-right font-mono">GH₵ {accounting.netSurplus.toFixed(2)}</td>
              <td className="border border-slate-400 p-1.5 text-center">{accounting.collectionEfficiency}%</td>
              <td className="border border-slate-400 p-1.5 text-right font-mono">GH₵ {accounting.totalReceivablesArrears.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Signatures & Certification */}
        <div className="grid grid-cols-3 gap-8 pt-6 mt-4 border-t border-slate-400 text-center text-xs">
          <div>
            <div className="border-b border-slate-900 pb-8 mb-1"></div>
            <p className="font-bold text-slate-900 uppercase">Head Accountant / Bursar</p>
            <p className="text-[10px] text-slate-500">Signature &amp; Date</p>
          </div>
          <div>
            <div className="border-b border-slate-900 pb-8 mb-1"></div>
            <p className="font-bold text-slate-900 uppercase">Internal Audit Committee</p>
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
