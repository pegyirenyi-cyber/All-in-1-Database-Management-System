import React, { useState, useEffect } from 'react';
import { CustomBillComponent, Student, SchoolInfo, AcademicYearType, TermType } from '../types';
import { ThemeStyles } from './ThemeWrapper';
import SchoolFeesTab from './SchoolFeesTab';
import TransportationTab from './finances/TransportationTab';
import CanteenFeedingTab from './finances/CanteenFeedingTab';
import ExcursionTab from './finances/ExcursionTab';
import SportsFinancesTab from './finances/SportsFinancesTab';
import TextbooksFinancesTab from './finances/TextbooksFinancesTab';
import ExpensesTab from './finances/ExpensesTab';
import AccountingOverviewTab from './finances/AccountingOverviewTab';
import CustomizeBillComponentsTab from './finances/CustomizeBillComponentsTab';
import DailyFinancialSummaryTab from './finances/DailyFinancialSummaryTab';
import StaffPayslipsTab from './finances/StaffPayslipsTab';
import ExpenseCategoriesTab from './finances/ExpenseCategoriesTab';
import CreateBillCategoryModal from './finances/CreateBillCategoryModal';
import { 
  Coins, Bus, Utensils, Compass, Trophy, BookOpen, Receipt, Building2, Sliders, Wallet, Plus, Banknote, Tags
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  theme: ThemeStyles;
  students: Student[];
  schoolInfo: SchoolInfo;
  isAutoSave: boolean;
  onManualSave: () => void;
  selectedAcademicYear?: AcademicYearType;
  setSelectedAcademicYear?: (yr: AcademicYearType) => void;
  selectedTerm?: TermType;
  setSelectedTerm?: (tm: TermType) => void;
  initialSubTab?: string;
}

export type FinanceSubTab = 
  | 'daily_summary'
  | 'fees' 
  | 'transportation' 
  | 'canteen' 
  | 'excursion' 
  | 'sports' 
  | 'textbooks' 
  | 'expenses' 
  | 'expense_categories'
  | 'payslips'
  | 'overview'
  | 'customize';

const FINANCE_TABS: { id: FinanceSubTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'daily_summary', label: 'Daily Liquidity & Summary', icon: Wallet },
  { id: 'fees', label: 'Fees Ledger', icon: Coins },
  { id: 'transportation', label: 'Transportation', icon: Bus },
  { id: 'canteen', label: 'Canteen (Feeding Fee)', icon: Utensils },
  { id: 'excursion', label: 'Excursion', icon: Compass },
  { id: 'sports', label: 'Sports', icon: Trophy },
  { id: 'textbooks', label: 'Textbooks', icon: BookOpen },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
  { id: 'expense_categories', label: 'Expense Categories', icon: Tags },
  { id: 'payslips', label: 'Staff Payslips', icon: Banknote },
  { id: 'overview', label: 'Accounts & Overview', icon: Building2 },
  { id: 'customize', label: 'Customize', icon: Sliders }
];

export default function FinancesTab({
  theme,
  students,
  schoolInfo,
  isAutoSave,
  onManualSave,
  selectedAcademicYear = '2026/2027',
  setSelectedAcademicYear,
  selectedTerm = 'Term 1',
  setSelectedTerm,
  initialSubTab
}: Props) {
  const [activeSubTab, setActiveSubTab] = useState<FinanceSubTab>(() => {
    if (initialSubTab && FINANCE_TABS.some(t => t.id === initialSubTab)) {
      return initialSubTab as FinanceSubTab;
    }
    const saved = localStorage.getItem('sms_finances_active_subtab');
    if (saved && FINANCE_TABS.some(t => t.id === saved)) {
      return saved as FinanceSubTab;
    }
    return 'fees';
  });

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleSubTabChange = (tabId: FinanceSubTab) => {
    setActiveSubTab(tabId);
    try {
      localStorage.setItem('sms_finances_active_subtab', tabId);
    } catch {}
  };

  return (
    <div className="space-y-6">
      {/* Finances Sub-Navigation Ribbon (no-print) */}
      <div className="no-print bg-white border border-slate-200 p-2 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 p-1 flex-1">
          {FINANCE_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleSubTabChange(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer select-none whitespace-nowrap ${
                  isActive
                    ? `${theme.primaryBg || 'bg-indigo-600'} text-white shadow-sm font-bold`
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 bg-transparent'
                }`}
              >
                <Icon size={15} className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span className={`font-bold ${isActive ? 'text-white' : 'text-slate-700'}`}>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 'Create New' Button for user to add another bill category if not listed */}
        <div className="flex items-center gap-2 p-1 shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-2 md:pt-0 md:pl-2">
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md shadow-indigo-500/20 active:scale-95 transition cursor-pointer select-none whitespace-nowrap"
            title="Create and add another bill category if not listed"
          >
            <Plus size={16} className="stroke-[2.5]" />
            <span>Create New</span>
          </button>
        </div>
      </div>

      {/* Sub-Tab Content Rendering */}
      <div>
        {activeSubTab === 'daily_summary' && (
          <DailyFinancialSummaryTab
            theme={theme}
            students={students}
            schoolInfo={schoolInfo}
            selectedAcademicYear={selectedAcademicYear}
            selectedTerm={selectedTerm}
          />
        )}

        {activeSubTab === 'fees' && (
          <SchoolFeesTab
            theme={theme}
            students={students}
            schoolInfo={schoolInfo}
            isAutoSave={isAutoSave}
            onManualSave={onManualSave}
            selectedAcademicYear={selectedAcademicYear}
            setSelectedAcademicYear={setSelectedAcademicYear}
            selectedTerm={selectedTerm}
            setSelectedTerm={setSelectedTerm}
          />
        )}

        {activeSubTab === 'transportation' && (
          <TransportationTab
            theme={theme}
            students={students}
            schoolInfo={schoolInfo}
            selectedAcademicYear={selectedAcademicYear}
            selectedTerm={selectedTerm}
          />
        )}

        {activeSubTab === 'canteen' && (
          <CanteenFeedingTab
            theme={theme}
            students={students}
            schoolInfo={schoolInfo}
            selectedAcademicYear={selectedAcademicYear}
            selectedTerm={selectedTerm}
          />
        )}

        {activeSubTab === 'excursion' && (
          <ExcursionTab
            theme={theme}
            students={students}
            schoolInfo={schoolInfo}
            selectedAcademicYear={selectedAcademicYear}
            selectedTerm={selectedTerm}
          />
        )}

        {activeSubTab === 'sports' && (
          <SportsFinancesTab
            theme={theme}
            students={students}
            schoolInfo={schoolInfo}
            selectedAcademicYear={selectedAcademicYear}
            selectedTerm={selectedTerm}
          />
        )}

        {activeSubTab === 'textbooks' && (
          <TextbooksFinancesTab
            theme={theme}
            students={students}
            schoolInfo={schoolInfo}
            selectedAcademicYear={selectedAcademicYear}
            selectedTerm={selectedTerm}
          />
        )}

        {activeSubTab === 'expenses' && (
          <ExpensesTab
            theme={theme}
            schoolInfo={schoolInfo}
            selectedAcademicYear={selectedAcademicYear}
            selectedTerm={selectedTerm}
          />
        )}

        {activeSubTab === 'expense_categories' && (
          <ExpenseCategoriesTab
            theme={theme}
            schoolInfo={schoolInfo}
            selectedAcademicYear={selectedAcademicYear}
            selectedTerm={selectedTerm}
          />
        )}

        {activeSubTab === 'payslips' && (
          <StaffPayslipsTab
            theme={theme}
            schoolInfo={schoolInfo}
            selectedAcademicYear={selectedAcademicYear}
            selectedTerm={selectedTerm}
          />
        )}

        {activeSubTab === 'overview' && (
          <AccountingOverviewTab
            theme={theme}
            students={students}
            schoolInfo={schoolInfo}
            selectedAcademicYear={selectedAcademicYear}
            selectedTerm={selectedTerm}
          />
        )}

        {activeSubTab === 'customize' && (
          <CustomizeBillComponentsTab
            theme={theme}
            schoolInfo={schoolInfo}
            selectedAcademicYear={selectedAcademicYear}
            selectedTerm={selectedTerm}
          />
        )}
      </div>

      {/* Create New Bill Category Modal */}
      <CreateBillCategoryModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(newComp) => {
          handleSubTabChange('customize');
        }}
      />
    </div>
  );
}
