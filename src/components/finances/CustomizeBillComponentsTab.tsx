import React, { useState, useMemo, useEffect } from 'react';
import { 
  CustomBillComponent, 
  BillComponentCategory, 
  ClassType, 
  CLASSES, 
  SchoolInfo,
  SchoolExpense,
  ExpenseCategory,
  AcademicYearType,
  TermType
} from '../../types';
import { DbController } from '../../db';
import { ThemeStyles } from '../ThemeWrapper';
import { triggerToast } from '../../utils';
import { 
  Sliders, Plus, Edit2, Trash2, CheckCircle2, XCircle, Search, 
  Layers, Tag, AlertCircle, 
  Download, Receipt, DollarSign, Lock, ArrowRight,
  TrendingDown, FileSpreadsheet, Calendar, Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  theme: ThemeStyles;
  schoolInfo?: SchoolInfo;
  userRole?: string;
  selectedAcademicYear?: AcademicYearType;
  selectedTerm?: TermType;
}

const CATEGORIES: BillComponentCategory[] = [
  'Academic',
  'Facilities & Utilities',
  'Welfare & Feeding',
  'Extra-Curricular',
  'Logistics & Transport',
  'Materials & Books',
  'Special Projects'
];

const PRESETS: Omit<CustomBillComponent, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'BECE Mock Examination Levy',
    code: 'EXAM-MOCK',
    category: 'Academic',
    defaultAmount: 120,
    frequency: 'Per Term',
    applicableClasses: ['Basic 9'],
    isRequired: true,
    isActive: true,
    description: 'Regional and internal mock exam printing, invigilation, and WAEC grading standards.'
  },
  {
    name: 'ICT & Computer Lab Development Levy',
    code: 'LAB-ICT',
    category: 'Facilities & Utilities',
    defaultAmount: 65,
    frequency: 'Per Term',
    applicableClasses: ['All'],
    isRequired: true,
    isActive: true,
    description: 'Computer maintenance, high-speed internet access, and software licensing for student computer laboratory.'
  },
  {
    name: 'Graduation Robes & Speech Day Dues',
    code: 'GRAD-ANNUAL',
    category: 'Special Projects',
    defaultAmount: 180,
    frequency: 'One-Time',
    applicableClasses: ['KG. 2', 'Basic 9'],
    isRequired: true,
    isActive: true,
    description: 'Graduation ceremonial attire, certificate printing, awards, and event organization.'
  },
  {
    name: 'Science Practicals & Lab Consumables',
    code: 'SCI-PRACT',
    category: 'Academic',
    defaultAmount: 50,
    frequency: 'Per Term',
    applicableClasses: ['Basic 7', 'Basic 8', 'Basic 9'],
    isRequired: true,
    isActive: true,
    description: 'Chemicals, apparatus, specimens, and STEM experimental kits.'
  },
  {
    name: 'First Aid & Medical Welfare Fund',
    code: 'MED-FIRSTAID',
    category: 'Welfare & Feeding',
    defaultAmount: 25,
    frequency: 'Per Term',
    applicableClasses: ['All'],
    isRequired: true,
    isActive: true,
    description: 'Sick bay supplies, emergency medication, and certified campus nurse assistance.'
  },
  {
    name: 'French & Modern Languages Club',
    code: 'CLUB-FR',
    category: 'Extra-Curricular',
    defaultAmount: 40,
    frequency: 'Optional',
    applicableClasses: ['All'],
    isRequired: false,
    isActive: true,
    description: 'Interactive French language materials, audio-visual drills, and club activities.'
  },
  {
    name: 'Campus Security & Biometrics Levy',
    code: 'SEC-BIO',
    category: 'Facilities & Utilities',
    defaultAmount: 30,
    frequency: 'Per Term',
    applicableClasses: ['All'],
    isRequired: true,
    isActive: true,
    description: 'Campus perimeter security, gate monitoring, and student biometric attendance scanners.'
  },
  {
    name: 'Library & E-Learning Resource Fee',
    code: 'LIB-RES',
    category: 'Materials & Books',
    defaultAmount: 35,
    frequency: 'Per Term',
    applicableClasses: ['All'],
    isRequired: true,
    isActive: true,
    description: 'Acquisition of supplementary storybooks, reference encyclopedias, and digital tablets.'
  }
];

// Standard core bill components built into the school system
const STANDARD_CORE_COMPONENTS = [
  {
    name: 'Tuition / School Fees',
    category: 'Academic',
    frequency: 'Per Term',
    description: 'Primary instructional fee covering curriculum delivery, faculty salaries, and classroom management.',
    scope: 'All Classes'
  },
  {
    name: 'Utility & Sanitation Bill',
    category: 'Facilities & Utilities',
    frequency: 'Per Term',
    description: 'Electricity (ECG pre-paid), piped water supplies, sanitary supplies, and school environmental hygiene.',
    scope: 'All Classes'
  },
  {
    name: 'Sports & Athletics Levy',
    category: 'Extra-Curricular',
    frequency: 'Per Term',
    description: 'Inter-house competitions, sports jerseys, sporting gear, and district athletics festival dues.',
    scope: 'All Classes'
  },
  {
    name: 'PTA Dues & Development',
    category: 'Special Projects',
    frequency: 'Per Term',
    description: 'Parent-Teacher Association joint welfare contributions and general campus development.',
    scope: 'All Classes'
  },
  {
    name: 'Transportation & Bus Services',
    category: 'Logistics & Transport',
    frequency: 'Per Term',
    description: 'Daily pick-up and drop-off bus fleet maintenance, fuel, and authorized school driver logistics.',
    scope: 'Registered Bus Commuters'
  },
  {
    name: 'Canteen & Daily Feeding Program',
    category: 'Welfare & Feeding',
    frequency: 'Per Term',
    description: 'Nutritious school breakfast and hot midday lunch meals prepared under certified health inspection.',
    scope: 'Enrolled Canteen Diners'
  },
  {
    name: 'Educational Excursions & Field Trips',
    category: 'Academic',
    frequency: 'Per Event',
    description: 'Curriculum-guided academic excursions, museum visits, nature reserves, and educational tours.',
    scope: 'Target Classes / Participants'
  },
  {
    name: 'Textbooks & Learning Materials',
    category: 'Materials & Books',
    frequency: 'Per Academic Year',
    description: 'National Curriculum Council (NaCCA) approved textbooks, workbooks, and exercise books.',
    scope: 'All Classes'
  }
];

export default function CustomizeBillComponentsTab({ 
  theme, 
  schoolInfo,
  selectedAcademicYear = '2026/2027', 
  selectedTerm = 'Term 1' 
}: Props) {
  const [activeMainView, setActiveMainView] = useState<'components' | 'expenses'>('components');

  const [components, setComponents] = useState<CustomBillComponent[]>(() => {
    return DbController.getCustomBillComponents();
  });
  const [expenses, setExpenses] = useState<SchoolExpense[]>(() => {
    return DbController.getExpenses();
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [selectedExpenseComponentFilter, setSelectedExpenseComponentFilter] = useState<string>('All');

  // Add/Edit Component Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<CustomBillComponent | null>(null);

  // Add Component Form State
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formCategory, setFormCategory] = useState<BillComponentCategory>('Academic');
  const [formAmount, setFormAmount] = useState<number>(50);
  const [formBudgetCap, setFormBudgetCap] = useState<number>(0);
  const [formFrequency, setFormFrequency] = useState<'Per Term' | 'Per Year' | 'One-Time' | 'Optional'>('Per Term');
  const [isAllClasses, setIsAllClasses] = useState(true);
  const [selectedClasses, setSelectedClasses] = useState<ClassType[]>([]);
  const [formIsRequired, setFormIsRequired] = useState(true);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formDescription, setFormDescription] = useState('');

  // Add Component Expense Modal State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseFormCompId, setExpenseFormCompId] = useState<string>('');
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<number>(100);
  const [expensePayee, setExpensePayee] = useState('');
  const [expenseMethod, setExpenseMethod] = useState<'Cash' | 'Mobile Money' | 'Bank Transfer' | 'Cheque'>('Cash');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expenseVoucherNumber, setExpenseVoucherNumber] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');

  // Delete confirmation
  const [componentToDelete, setComponentToDelete] = useState<CustomBillComponent | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<SchoolExpense | null>(null);

  const refreshList = () => {
    setComponents([...DbController.getCustomBillComponents()]);
    setExpenses([...DbController.getExpenses()]);
  };

  useEffect(() => {
    refreshList();
  }, []);

  const openAddModal = () => {
    setEditingComponent(null);
    setFormName('');
    setFormCode('');
    setFormCategory('Academic');
    setFormAmount(50);
    setFormBudgetCap(0);
    setFormFrequency('Per Term');
    setIsAllClasses(true);
    setSelectedClasses([]);
    setFormIsRequired(true);
    setFormIsActive(true);
    setFormDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (comp: CustomBillComponent) => {
    setEditingComponent(comp);
    setFormName(comp.name);
    setFormCode(comp.code || '');
    setFormCategory(comp.category);
    setFormAmount(comp.defaultAmount);
    setFormBudgetCap(comp.expenseBudgetCap || 0);
    setFormFrequency(comp.frequency);
    if (comp.applicableClasses.includes('All')) {
      setIsAllClasses(true);
      setSelectedClasses([]);
    } else {
      setIsAllClasses(false);
      setSelectedClasses(comp.applicableClasses as ClassType[]);
    }
    setFormIsRequired(comp.isRequired);
    setFormIsActive(comp.isActive);
    setFormDescription(comp.description || '');
    setIsModalOpen(true);
  };

  const openAddExpenseModal = (targetCompId?: string) => {
    const defaultCompId = targetCompId || (components[0]?.id || 'custom_generic');
    setExpenseFormCompId(defaultCompId);
    setExpenseTitle('');
    setExpenseAmount(100);
    setExpensePayee('');
    setExpenseMethod('Cash');
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setExpenseVoucherNumber('PV-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000));
    setExpenseDescription('');
    setIsExpenseModalOpen(true);
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setFormName(preset.name);
    setFormCode(preset.code || '');
    setFormCategory(preset.category);
    setFormAmount(preset.defaultAmount);
    setFormBudgetCap(preset.expenseBudgetCap || 0);
    setFormFrequency(preset.frequency);
    if (preset.applicableClasses.includes('All')) {
      setIsAllClasses(true);
      setSelectedClasses([]);
    } else {
      setIsAllClasses(false);
      setSelectedClasses(preset.applicableClasses as ClassType[]);
    }
    setFormIsRequired(preset.isRequired);
    setFormIsActive(preset.isActive);
    setFormDescription(preset.description || '');
    triggerToast(`Loaded preset "${preset.name}"`, 'info');
  };

  const toggleClassSelection = (cls: ClassType) => {
    if (selectedClasses.includes(cls)) {
      setSelectedClasses(selectedClasses.filter(c => c !== cls));
    } else {
      setSelectedClasses([...selectedClasses, cls]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      triggerToast('Component name is required', 'error');
      return;
    }
    if (formAmount < 0 || isNaN(formAmount)) {
      triggerToast('Amount must be 0 or greater', 'error');
      return;
    }

    // Server-Side Duplicate Validation
    try {
      const validateRes = await fetch('/api/finances/bill-categories/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          code: formCode.trim(),
          category: formCategory,
          defaultAmount: Number(formAmount) || 0,
          existingComponents: components,
          excludeId: editingComponent ? editingComponent.id : undefined
        })
      });

      const validationData = await validateRes.json();
      if (!validateRes.ok || !validationData.valid) {
        triggerToast(validationData.message || 'Validation error: A bill category with this name already exists.', 'error');
        return;
      }
    } catch (netErr) {
      // Fallback duplicate check
      const norm = formName.trim().toLowerCase();
      const duplicate = components.find(c => {
        if (editingComponent && c.id === editingComponent.id) return false;
        return c.name.trim().toLowerCase() === norm;
      });
      if (duplicate) {
        triggerToast(`A bill category named "${duplicate.name}" already exists in the system.`, 'error');
        return;
      }
    }

    const applicable: ('All' | ClassType)[] = isAllClasses || selectedClasses.length === 0
      ? ['All']
      : selectedClasses;

    const now = new Date().toISOString();
    const comp: CustomBillComponent = {
      id: editingComponent ? editingComponent.id : `comp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: formName.trim(),
      code: formCode.trim() || undefined,
      category: formCategory,
      defaultAmount: Number(formAmount),
      expenseBudgetCap: formBudgetCap > 0 ? Number(formBudgetCap) : undefined,
      frequency: formFrequency,
      applicableClasses: applicable,
      isRequired: formIsRequired,
      isActive: formIsActive,
      description: formDescription.trim() || undefined,
      createdAt: editingComponent ? editingComponent.createdAt : now,
      updatedAt: now
    };

    DbController.saveCustomBillComponent(comp);
    refreshList();
    setIsModalOpen(false);
    triggerToast(
      editingComponent 
        ? `Updated component "${comp.name}" successfully` 
        : `Added new bill component "${comp.name}" successfully`, 
      'success'
    );
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseTitle.trim() || !expensePayee.trim() || expenseAmount <= 0) {
      triggerToast('Please provide an expense title, payee, and valid amount', 'error');
      return;
    }

    const linkedComp = components.find(c => c.id === expenseFormCompId);
    const compName = linkedComp ? linkedComp.name : 'Custom Bill Component';

    // Budget Cap Variance Audit Check
    const currentExp = componentExpenseTotals[expenseFormCompId] || 0;
    const newTotal = currentExp + Number(expenseAmount);
    if (linkedComp?.expenseBudgetCap && newTotal > linkedComp.expenseBudgetCap) {
      DbController.recordFinancialAudit({
        action: 'OVER_BUDGET_WARNING',
        entityId: linkedComp.id,
        entityType: 'bill_component',
        entityTitle: linkedComp.name,
        performedBy: 'Accounts Staff',
        role: 'Accountant',
        details: `Disbursement of GH₵ ${Number(expenseAmount).toFixed(2)} brought total component expenditure to GH₵ ${newTotal.toFixed(2)}, exceeding budget cap of GH₵ ${linkedComp.expenseBudgetCap.toFixed(2)}.`,
        amount: Number(expenseAmount)
      });
      triggerToast(`Budget Alert: This disbursement brings "${compName}" over its budget cap by GH₵ ${(newTotal - linkedComp.expenseBudgetCap).toFixed(2)}`, 'info');
    }

    const newExpense: SchoolExpense = {
      id: `exp_custom_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      voucherNumber: expenseVoucherNumber || `PV-CUST-${Math.floor(1000 + Math.random() * 9000)}`,
      title: `${compName}: ${expenseTitle.trim()}`,
      category: (linkedComp?.category === 'Academic' ? 'Teaching & Learning Materials' : 
                 linkedComp?.category === 'Facilities & Utilities' ? 'Maintenance & Repairs' :
                 linkedComp?.category === 'Welfare & Feeding' ? 'Kitchen & Canteen Supplies' :
                 linkedComp?.category === 'Extra-Curricular' ? 'Sports & Co-Curricular' :
                 linkedComp?.category === 'Logistics & Transport' ? 'Vehicle Fuel & Transportation Logistics' :
                 linkedComp?.category === 'Materials & Books' ? 'Teaching & Learning Materials' : 'Other Operations') as ExpenseCategory,
      amount: Number(expenseAmount),
      budgetAllocated: linkedComp?.expenseBudgetCap,
      payee: expensePayee.trim(),
      paymentMethod: expenseMethod,
      paymentDate: expenseDate,
      term: selectedTerm,
      academicYear: selectedAcademicYear,
      approvedBy: 'Headteacher',
      approvalStatus: 'Approved',
      preparedBy: 'Accounts Officer',
      description: expenseDescription.trim() || `Dedicated expense disbursement for bill component: ${compName}`,
      billComponentId: expenseFormCompId,
      billComponentName: compName
    };

    DbController.saveExpense(newExpense);
    refreshList();
    setIsExpenseModalOpen(false);
    triggerToast(`Recorded expense voucher for "${compName}" successfully!`, 'success');
  };

  const handleToggleStatus = (comp: CustomBillComponent) => {
    const updated: CustomBillComponent = {
      ...comp,
      isActive: !comp.isActive,
      updatedAt: new Date().toISOString()
    };
    DbController.saveCustomBillComponent(updated);
    refreshList();
    triggerToast(
      `Component "${comp.name}" is now ${updated.isActive ? 'Active' : 'Inactive'}`,
      'info'
    );
  };

  const handleDelete = () => {
    if (!componentToDelete) return;
    DbController.deleteCustomBillComponent(componentToDelete.id);
    refreshList();
    setComponentToDelete(null);
    triggerToast(`Deleted component "${componentToDelete.name}"`, 'success');
  };

  const handleDeleteExpenseConfirm = () => {
    if (!expenseToDelete) return;
    DbController.deleteExpense(expenseToDelete.id);
    refreshList();
    setExpenseToDelete(null);
    triggerToast('Expense record removed', 'info');
  };

  const handleExportCSV = () => {
    try {
      const headers = ['ID', 'Component Name', 'Code', 'Category', 'Default Amount (GHS)', 'Frequency', 'Applicable Classes', 'Required', 'Status', 'Description'];
      const rows = components.map(c => [
        c.id,
        `"${c.name}"`,
        c.code || '',
        `"${c.category}"`,
        c.defaultAmount,
        `"${c.frequency}"`,
        `"${c.applicableClasses.join(', ')}"`,
        c.isRequired ? 'Mandatory' : 'Optional',
        c.isActive ? 'Active' : 'Inactive',
        `"${(c.description || '').replace(/"/g, '""')}"`
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `School_Custom_Bill_Components_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      triggerToast('Custom bill components schedule exported to CSV', 'success');
    } catch {
      triggerToast('Failed to export bill components', 'error');
    }
  };

  const filteredComponents = useMemo(() => {
    return components.filter(c => {
      const matchesSearch = 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.code && c.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = selectedCategory === 'All' || c.category === selectedCategory;
      const matchesStatus = 
        statusFilter === 'All' ||
        (statusFilter === 'Active' && c.isActive) ||
        (statusFilter === 'Inactive' && !c.isActive);
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [components, searchTerm, selectedCategory, statusFilter]);

  // Expenses for custom bill components
  const customComponentExpenses = useMemo(() => {
    return expenses.filter(e => {
      const isCustomLinked = e.billComponentId && components.some(c => c.id === e.billComponentId);
      const matchesCompFilter = selectedExpenseComponentFilter === 'All' || e.billComponentId === selectedExpenseComponentFilter;
      return isCustomLinked && matchesCompFilter;
    });
  }, [expenses, components, selectedExpenseComponentFilter]);

  const totalCustomExpensesSum = useMemo(() => {
    return customComponentExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [customComponentExpenses]);

  // Map of componentId -> total expenses
  const componentExpenseTotals = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => {
      if (e.billComponentId) {
        map[e.billComponentId] = (map[e.billComponentId] || 0) + e.amount;
      }
    });
    return map;
  }, [expenses]);

  const handlePrintSchedule = () => {
    if (typeof (window as any).printTarget === 'function') {
      (window as any).printTarget(
        'bill-components-schedule-print-area',
        `Bill Components & Fee Structure Schedule - ${selectedAcademicYear} ${selectedTerm}`,
        false
      );
    } else {
      window.print();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-md border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-400 text-slate-950 uppercase tracking-wider">
              Headteacher Portal
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-slate-300 text-xs font-medium">Fee Structure & Dedicated Expenses</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2.5">
            <Sliders className="text-amber-400" size={24} />
            <span>Customize Bill Components</span>
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl mt-1 leading-relaxed">
            Empowers the Headteacher to create and manage custom billing components in addition to standard tuition and utility fees.
            Each bill component includes its own dedicated expenses ledger for precise departmental budgeting.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Export bill components schedule to CSV"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePrintSchedule}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Generate PDF or Print Fee Schedule Summary"
          >
            <Printer size={14} />
            <span>Print / PDF Summary</span>
          </button>

          <button
            type="button"
            onClick={() => openAddExpenseModal()}
            className="px-3.5 py-2 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95"
          >
            <Receipt size={14} />
            <span>Record Component Expense</span>
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className={`px-4 py-2 rounded-xl text-white font-black text-xs transition cursor-pointer flex items-center gap-2 shadow-lg active:scale-95 ${theme.btnColors || 'bg-indigo-600 hover:bg-indigo-500'}`}
          >
            <Plus size={16} />
            <span>Add Bill Component</span>
          </button>
        </div>
      </div>

      {/* View Switcher Tabs (Components Catalog vs Dedicated Component Expenses) */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/90 w-fit">
        <button
          type="button"
          onClick={() => setActiveMainView('components')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeMainView === 'components'
              ? 'bg-white text-indigo-900 shadow-xs font-black'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sliders size={14} className={activeMainView === 'components' ? 'text-indigo-600' : 'text-slate-400'} />
          <span>Bill Components Structure ({components.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainView('expenses')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeMainView === 'expenses'
              ? 'bg-white text-rose-900 shadow-xs font-black'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Receipt size={14} className={activeMainView === 'expenses' ? 'text-rose-600' : 'text-slate-400'} />
          <span>Component-Specific Expenses ({customComponentExpenses.length})</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">Standard Components</span>
            <Layers size={16} className="text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-800 mt-1">8 Built-in</div>
          <p className="text-[10.5px] text-slate-400 mt-0.5">Core GES & school levies</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">Custom Components</span>
            <Sliders size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl font-black text-indigo-950 mt-1">{components.length} Items</div>
          <p className="text-[10.5px] text-slate-400 mt-0.5">{components.filter(c => c.isActive).length} active for billing</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">Custom Levies Total</span>
            <DollarSign size={16} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">
            GH₵ {components.filter(c => c.isActive).reduce((sum, c) => sum + c.defaultAmount, 0).toFixed(2)}
          </div>
          <p className="text-[10.5px] text-slate-400 mt-0.5">Sum of active custom billings</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">Dedicated Expenses</span>
            <TrendingDown size={16} className="text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-700 mt-1 font-mono">
            GH₵ {totalCustomExpensesSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[10.5px] text-slate-400 mt-0.5">{customComponentExpenses.length} payment vouchers</p>
        </div>
      </div>

      {/* MAIN VIEW 1: BILL COMPONENTS STRUCTURE */}
      {activeMainView === 'components' && (
        <div className="space-y-6">
          {/* Custom Components Section */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/50">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <Sliders size={16} className="text-indigo-600" />
                  <span>Custom School Bill Components ({filteredComponents.length})</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Components configured by the Headteacher to appear on students&apos; termly bills and statements.
                </p>
              </div>

              <button
                type="button"
                onClick={openAddModal}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
              >
                <Plus size={14} />
                <span>Add Component</span>
              </button>
            </div>

            {/* Filters Bar */}
            <div className="p-3 border-b border-slate-100 flex flex-col lg:flex-row gap-2.5 items-stretch lg:items-center justify-between bg-white">
              <div className="relative flex-1 max-w-md">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search component name, code, or description..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="All">All Categories</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="All">All Status</option>
                  <option value="Active">Active Only</option>
                  <option value="Inactive">Inactive Only</option>
                </select>
              </div>
            </div>

            {/* Components Grid / Cards */}
            <div className="p-4">
              {filteredComponents.length === 0 ? (
                <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-xl">
                  <Sliders size={32} className="mx-auto text-slate-300 mb-2" />
                  <h4 className="text-sm font-bold text-slate-700">No custom bill components match your filter</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    Click the &ldquo;Add Bill Component&rdquo; button above to create a new custom fee item or reset your search query.
                  </p>
                  <button
                    type="button"
                    onClick={openAddModal}
                    className="mt-3.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Create New Component</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                  {filteredComponents.map(comp => {
                    const compExpensesTotal = componentExpenseTotals[comp.id] || 0;
                    return (
                      <div 
                        key={comp.id} 
                        className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                          comp.isActive 
                            ? 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-xs' 
                            : 'bg-slate-50/60 border-slate-200/60 opacity-75'
                        }`}
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                                  {comp.code || 'CUSTOM'}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                  {comp.category}
                                </span>
                                {comp.isRequired ? (
                                  <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-100">
                                    Mandatory
                                  </span>
                                ) : (
                                  <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-teal-50 text-teal-700 border border-teal-100">
                                    Optional
                                  </span>
                                )}
                              </div>
                              <h4 className="text-sm font-black text-slate-800 mt-1.5 leading-snug">{comp.name}</h4>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="text-base font-black text-slate-900 font-mono">
                                GH₵ {comp.defaultAmount.toFixed(2)}
                              </div>
                              <span className="text-[9.5px] text-slate-400 font-mono block">
                                {comp.frequency}
                              </span>
                            </div>
                          </div>

                          {comp.description && (
                            <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                              {comp.description}
                            </p>
                          )}

                          {/* Component-specific expenses summary badge */}
                          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                                <Receipt size={12} className="text-rose-500" />
                                <span>Dedicated Expenses:</span>
                              </span>
                              <span className="font-mono font-black text-rose-700 text-xs">
                                GH₵ {compExpensesTotal.toFixed(2)}
                              </span>
                            </div>

                            {comp.expenseBudgetCap ? (
                              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[10.5px]">
                                <span className="text-slate-500 font-mono">
                                  Budget Cap: <strong className="text-slate-700">GH₵ {comp.expenseBudgetCap.toFixed(2)}</strong>
                                </span>
                                {compExpensesTotal > comp.expenseBudgetCap ? (
                                  <span className="font-mono font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 flex items-center gap-0.5">
                                    <AlertCircle size={10} />
                                    <span>Over +GH₵ {(compExpensesTotal - comp.expenseBudgetCap).toFixed(2)}</span>
                                  </span>
                                ) : (
                                  <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    GH₵ {(comp.expenseBudgetCap - compExpensesTotal).toFixed(2)} left
                                  </span>
                                )}
                              </div>
                            ) : null}
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                            <span className="font-medium truncate max-w-[170px]" title={comp.applicableClasses.join(', ')}>
                              Target: <strong className="text-slate-700 font-semibold">{comp.applicableClasses.join(', ')}</strong>
                            </span>
                            <span className={`inline-flex items-center gap-1 font-bold text-[10.5px] ${
                              comp.isActive ? 'text-emerald-600' : 'text-slate-400'
                            }`}>
                              {comp.isActive ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                              {comp.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>

                        <div className="pt-3 mt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => openAddExpenseModal(comp.id)}
                            className="text-xs font-bold px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg transition cursor-pointer flex items-center gap-1 shrink-0 whitespace-nowrap"
                            title="Record expenditure against this component"
                          >
                            <Receipt size={11} />
                            <span>Log Expense</span>
                          </button>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(comp)}
                              className={`text-[11px] font-bold px-2 py-1 rounded-lg transition cursor-pointer shrink-0 whitespace-nowrap ${
                                comp.isActive 
                                  ? 'text-slate-500 hover:text-slate-700 hover:bg-slate-100' 
                                  : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                              }`}
                            >
                              {comp.isActive ? 'Disable' : 'Enable'}
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditModal(comp)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer shrink-0"
                              title="Edit component"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setComponentToDelete(comp)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer shrink-0"
                              title="Delete component"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Built-in System Core Components Reference */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <Lock size={15} className="text-slate-400" />
                  <span>Standard Built-in System Bill Components (8)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Core statutory and operational modules permanently integrated into the school management fees ledger.
                </p>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                System Core
              </span>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {STANDARD_CORE_COMPONENTS.map(core => (
                <div key={core.name} className="p-3 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                      {core.category}
                    </span>
                    <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-bold">
                      {core.frequency}
                    </span>
                  </div>
                  <h5 className="text-xs font-black text-slate-800 leading-snug">{core.name}</h5>
                  <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{core.description}</p>
                  <div className="text-[10px] text-slate-400 font-medium pt-1 border-t border-slate-200/60">
                    Applicable: <strong className="text-slate-600 font-semibold">{core.scope}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MAIN VIEW 2: DEDICATED COMPONENT EXPENSES */}
      {activeMainView === 'expenses' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <Receipt size={16} className="text-rose-600" />
                <span>Custom Bill Components Expenses Ledger</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Review and record dedicated expenditures against each custom bill component ({selectedAcademicYear} • {selectedTerm}).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openAddExpenseModal()}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus size={14} />
                <span>Record Expense Voucher</span>
              </button>
            </div>
          </div>

          {/* Filter by component */}
          <div className="p-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2 bg-white">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">Filter by Component:</span>
              <select
                value={selectedExpenseComponentFilter}
                onChange={(e) => setSelectedExpenseComponentFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="All">All Custom Bill Components</option>
                {components.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <span className="text-xs font-mono font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100">
              Total Expenses: GH₵ {totalCustomExpensesSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Expenses Table */}
          <div className="overflow-x-auto">
            {customComponentExpenses.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Receipt size={36} className="mx-auto text-slate-300 mb-2" />
                <h4 className="text-sm font-bold text-slate-700">No expenses recorded for custom bill components yet</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Click the button below to record the first payment voucher or expenditure item against any custom component.
                </p>
                <button
                  type="button"
                  onClick={() => openAddExpenseModal()}
                  className="mt-3.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Record First Expense</span>
                </button>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] uppercase tracking-wider font-mono">
                    <th className="py-3 px-4 font-bold">Voucher #</th>
                    <th className="py-3 px-4 font-bold">Bill Component</th>
                    <th className="py-3 px-4 font-bold">Purpose / Description</th>
                    <th className="py-3 px-4 font-bold">Payee</th>
                    <th className="py-3 px-4 font-bold">Method</th>
                    <th className="py-3 px-4 font-bold">Date</th>
                    <th className="py-3 px-4 font-bold text-right">Amount (GH₵)</th>
                    <th className="py-3 px-4 font-bold text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customComponentExpenses.map(exp => (
                    <tr key={exp.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                        {exp.voucherNumber}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-100 text-[10.5px]">
                          {exp.billComponentName || 'Custom Component'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">
                        {exp.title}
                        {exp.description && (
                          <span className="block text-[10.5px] text-slate-400 mt-0.5">{exp.description}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {exp.payee}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-[10.5px]">
                        {exp.paymentMethod}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[10.5px]">
                        {exp.paymentDate}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-rose-700 text-xs">
                        GH₵ {exp.amount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setExpenseToDelete(exp)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          title="Delete expense"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* RECORD COMPONENT EXPENSE MODAL */}
      <AnimatePresence>
        {isExpenseModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-rose-50/50 sticky top-0 bg-white z-10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                    <Receipt size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 leading-snug">
                      Record Component Expenditure
                    </h3>
                    <p className="text-xs text-slate-500">
                      Disburse and assign expenses to a dedicated bill component.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  <XCircle size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveExpense} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Select Target Bill Component <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={expenseFormCompId}
                    onChange={(e) => setExpenseFormCompId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {components.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.category}) — Default: GH₵{c.defaultAmount}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Payment Voucher #
                    </label>
                    <input
                      type="text"
                      value={expenseVoucherNumber}
                      onChange={(e) => setExpenseVoucherNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Payment Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Expense Purpose / Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={expenseTitle}
                    onChange={(e) => setExpenseTitle(e.target.value)}
                    placeholder="e.g. Printing of 250 BECE Mock booklets & marking sheets"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Disbursement Amount (GH₵) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.1"
                      required
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Payee / Vendor <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={expensePayee}
                      onChange={(e) => setExpensePayee(e.target.value)}
                      placeholder="e.g. Modern Press Kumasi"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Payment Mode <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={expenseMethod}
                      onChange={(e) => setExpenseMethod(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Mobile Money">Mobile Money</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Detailed Notes / Approval Remarks
                  </label>
                  <textarea
                    rows={2}
                    value={expenseDescription}
                    onChange={(e) => setExpenseDescription(e.target.value)}
                    placeholder="Authorized payment notes and breakdown..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsExpenseModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer shadow-md active:scale-95"
                  >
                    Save Expense Voucher
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD / EDIT COMPONENT MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 sticky top-0 bg-white z-10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <Sliders size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 leading-snug">
                      {editingComponent ? 'Edit Bill Component' : 'Add New Bill Component'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Configure custom fee item for official student billing invoices.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  <XCircle size={20} />
                </button>
              </div>

              {/* Presets Chips if adding new */}
              {!editingComponent && (
                <div className="p-4 bg-amber-50/50 border-b border-amber-100/70">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Tag size={13} className="text-amber-600" />
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800 font-mono">
                      Quick Preset Templates (Click to fill)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {PRESETS.map(p => (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => applyPreset(p)}
                        className="px-2.5 py-1 bg-white hover:bg-amber-100/80 border border-amber-200 text-amber-900 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs"
                      >
                        + {p.name} (GH₵{p.defaultAmount})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Form Content */}
              <form onSubmit={handleSave} className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Component Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. BECE Mock Examination Levy"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Short Code / Ref
                    </label>
                    <input
                      type="text"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                      placeholder="e.g. EXAM-MOCK"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Category <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {CATEGORIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Billing Fee (GH₵) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formAmount}
                      onChange={(e) => setFormAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Expense Budget Cap (GH₵)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Optional limit"
                      value={formBudgetCap || ''}
                      onChange={(e) => setFormBudgetCap(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-rose-700 focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Billing Frequency <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formFrequency}
                      onChange={(e) => setFormFrequency(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="Per Term">Per Term (Standard)</option>
                      <option value="Per Year">Per Academic Year</option>
                      <option value="One-Time">One-Time (e.g. Admission/Grad)</option>
                      <option value="Optional">Optional / Upon Request</option>
                    </select>
                  </div>
                </div>

                {/* Applicable Classes Selection */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Target Student Classes:</span>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-bold text-indigo-700">
                      <input
                        type="checkbox"
                        checked={isAllClasses}
                        onChange={(e) => {
                          setIsAllClasses(e.target.checked);
                          if (e.target.checked) setSelectedClasses([]);
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Apply to All Classes</span>
                    </label>
                  </div>

                  {!isAllClasses && (
                    <div className="pt-2 border-t border-slate-200/60 grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                      {CLASSES.map(cls => {
                        const checked = selectedClasses.includes(cls);
                        return (
                          <label
                            key={cls}
                            className={`p-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition select-none ${
                              checked 
                                ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold' 
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleClassSelection(cls)}
                              className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                            />
                            <span className="truncate">{cls}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Status and Requirement Flags */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 p-2.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsRequired}
                      onChange={(e) => setFormIsRequired(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Mandatory Requirement</span>
                      <span className="text-[10px] text-slate-400">Bill automatically generated on every terminal invoice</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Active Status</span>
                      <span className="text-[10px] text-slate-400">Available for fees calculation and ledger postings</span>
                    </div>
                  </label>
                </div>

                {/* Description input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Component Description / Invoice Note
                  </label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Provide details on what this levy covers for parent clarity on the bill..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                  />
                </div>

                {/* Modal Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer shadow-md active:scale-95"
                  >
                    {editingComponent ? 'Save Changes' : 'Create Component'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE COMPONENT CONFIRMATION MODAL */}
      <AnimatePresence>
        {componentToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-200 p-5 max-w-sm w-full shadow-2xl space-y-3"
            >
              <div className="flex items-center gap-2.5 text-rose-600">
                <AlertCircle size={22} />
                <h4 className="text-base font-black">Delete Bill Component?</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to remove <strong className="text-slate-900 font-bold">&ldquo;{componentToDelete.name}&rdquo;</strong>?
                This will remove the component from future bill calculations.
              </p>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setComponentToDelete(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer shadow-sm"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE EXPENSE CONFIRMATION MODAL */}
      <AnimatePresence>
        {expenseToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-200 p-5 max-w-sm w-full shadow-2xl space-y-3"
            >
              <div className="flex items-center gap-2.5 text-rose-600">
                <AlertCircle size={22} />
                <h4 className="text-base font-black">Delete Expense Record?</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to remove voucher <strong className="text-slate-900 font-bold">&ldquo;{expenseToDelete.voucherNumber}&rdquo;</strong> ({expenseToDelete.title}) for GH₵{expenseToDelete.amount.toFixed(2)}?
              </p>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setExpenseToDelete(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteExpenseConfirm}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer shadow-sm"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DEDICATED OFFICIAL PRINTABLE FEE STRUCTURE & BILL COMPONENTS SCHEDULE */}
      <div id="bill-components-schedule-print-area" className="hidden print:block font-sans text-slate-900 bg-white p-4">
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-4 text-center">
          <h1 className="text-xl font-black uppercase tracking-tight text-slate-950">
            {schoolInfo?.name || 'GeeTech Academy'}
          </h1>
          <p className="text-xs text-slate-600 font-medium mt-0.5">
            {schoolInfo?.gpsAddress || 'P.O. Box 1234, Accra, Ghana'} • Tel: {schoolInfo?.telephone || '+233 24 000 0000'}
          </p>
          <div className="inline-block mt-2 px-3 py-1 bg-slate-900 text-white font-mono text-xs font-bold uppercase tracking-widest rounded">
            OFFICIAL FEE STRUCTURE &amp; BILL COMPONENTS SCHEDULE
          </div>
          <p className="text-xs font-bold text-slate-700 mt-2">
            Academic Session: {selectedAcademicYear} • {selectedTerm} | Departmental Spend Limits &amp; Levies Schedule
          </p>
        </div>

        {/* Metrics Overview */}
        <div className="grid grid-cols-4 gap-3 mb-4 text-center">
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Total Components</span>
            <span className="text-sm font-black text-slate-900">{components.length} Custom Levies</span>
          </div>
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Active for Billing</span>
            <span className="text-sm font-black text-emerald-800">{components.filter(c => c.isActive).length} Items</span>
          </div>
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Total Dedicated Expenses</span>
            <span className="text-sm font-black text-rose-800 font-mono">GH₵ {totalCustomExpensesSum.toFixed(2)}</span>
          </div>
          <div className="border border-slate-300 p-2 rounded bg-slate-50">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Total Spend Budget Caps</span>
            <span className="text-sm font-black text-indigo-900 font-mono">
              GH₵ {components.reduce((sum, c) => sum + (c.expenseBudgetCap || 0), 0).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Components Schedule Table */}
        <table className="w-full border-collapse border border-slate-400 text-[11px] mb-4">
          <thead>
            <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-400">
              <th className="border border-slate-400 p-1.5 text-center w-8">#</th>
              <th className="border border-slate-400 p-1.5 text-left">Component Name</th>
              <th className="border border-slate-400 p-1.5 text-left">Code</th>
              <th className="border border-slate-400 p-1.5 text-center">Category</th>
              <th className="border border-slate-400 p-1.5 text-center">Frequency</th>
              <th className="border border-slate-400 p-1.5 text-left">Target Classes</th>
              <th className="border border-slate-400 p-1.5 text-right">Fee (GH₵)</th>
              <th className="border border-slate-400 p-1.5 text-right">Budget Cap (GH₵)</th>
              <th className="border border-slate-400 p-1.5 text-right">Expenses (GH₵)</th>
              <th className="border border-slate-400 p-1.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {components.length === 0 ? (
              <tr>
                <td colSpan={10} className="border border-slate-400 p-4 text-center text-slate-500">
                  No custom bill components configured.
                </td>
              </tr>
            ) : (
              components.map((comp, idx) => {
                const compExp = componentExpenseTotals[comp.id] || 0;
                return (
                  <tr key={comp.id} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                    <td className="border border-slate-400 p-1.5 text-center font-mono">{idx + 1}</td>
                    <td className="border border-slate-400 p-1.5 font-bold text-slate-900">{comp.name}</td>
                    <td className="border border-slate-400 p-1.5 font-mono text-[10px]">{comp.code || '—'}</td>
                    <td className="border border-slate-400 p-1.5 text-center font-semibold">{comp.category}</td>
                    <td className="border border-slate-400 p-1.5 text-center">{comp.frequency}</td>
                    <td className="border border-slate-400 p-1.5 text-[10px] truncate max-w-[140px]">{comp.applicableClasses?.join(', ') || 'All'}</td>
                    <td className="border border-slate-400 p-1.5 text-right font-mono font-bold text-slate-900">{comp.defaultAmount.toFixed(2)}</td>
                    <td className="border border-slate-400 p-1.5 text-right font-mono text-slate-700">
                      {comp.expenseBudgetCap && comp.expenseBudgetCap > 0 ? comp.expenseBudgetCap.toFixed(2) : '—'}
                    </td>
                    <td className="border border-slate-400 p-1.5 text-right font-mono font-bold text-slate-900">{compExp.toFixed(2)}</td>
                    <td className="border border-slate-400 p-1.5 text-center font-bold">
                      {comp.isActive ? 'Active' : 'Disabled'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-900">
              <td colSpan={6} className="border border-slate-400 p-1.5 text-right uppercase">Total Schedule Summary:</td>
              <td className="border border-slate-400 p-1.5 text-right font-mono">GH₵ {components.reduce((s, c) => s + c.defaultAmount, 0).toFixed(2)}</td>
              <td className="border border-slate-400 p-1.5 text-right font-mono">GH₵ {components.reduce((s, c) => s + (c.expenseBudgetCap || 0), 0).toFixed(2)}</td>
              <td className="border border-slate-400 p-1.5 text-right font-mono">GH₵ {totalCustomExpensesSum.toFixed(2)}</td>
              <td className="border border-slate-400 p-1.5 text-center">{components.length} Items</td>
            </tr>
          </tfoot>
        </table>

        {/* Signatures & Certification */}
        <div className="grid grid-cols-3 gap-8 pt-6 mt-4 border-t border-slate-400 text-center text-xs">
          <div>
            <div className="border-b border-slate-900 pb-8 mb-1"></div>
            <p className="font-bold text-slate-900 uppercase">Finance Committee Chairman</p>
            <p className="text-[10px] text-slate-500">Signature &amp; Date</p>
          </div>
          <div>
            <div className="border-b border-slate-900 pb-8 mb-1"></div>
            <p className="font-bold text-slate-900 uppercase">School Bursar / Accountant</p>
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
