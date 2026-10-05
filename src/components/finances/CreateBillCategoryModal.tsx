import React, { useState } from 'react';
import { 
  CustomBillComponent, 
  BillComponentCategory, 
  ClassType, 
  CLASSES 
} from '../../types';
import { DbController } from '../../db';
import { triggerToast } from '../../utils';
import { 
  X, Plus, Sparkles, AlertCircle, CheckCircle2, 
  Layers, DollarSign, Calendar, BookOpen, GraduationCap,
  Building, ShieldCheck, Tag, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newComponent: CustomBillComponent) => void;
}

const CATEGORY_GROUPS: { label: string; value: BillComponentCategory; icon: any; desc: string }[] = [
  { label: 'Academic', value: 'Academic', icon: GraduationCap, desc: 'Instruction, mock exams, STEM labs & assessments' },
  { label: 'Facilities & Utilities', value: 'Facilities & Utilities', icon: Building, desc: 'Electricity, sanitation, ICT labs & campus maintenance' },
  { label: 'Welfare & Feeding', value: 'Welfare & Feeding', icon: ShieldCheck, desc: 'Student welfare, sick bay, health & nutrition' },
  { label: 'Extra-Curricular', value: 'Extra-Curricular', icon: Sparkles, desc: 'Sports, clubs, arts, drama & cultural societies' },
  { label: 'Logistics & Transport', value: 'Logistics & Transport', icon: Layers, desc: 'Bus services, route commute & driver logistics' },
  { label: 'Materials & Books', value: 'Materials & Books', icon: BookOpen, desc: 'Textbooks, workbooks, stationery & library reading' },
  { label: 'Special Projects', value: 'Special Projects', icon: Tag, desc: 'Graduation, speech days, PTA projects & school development' }
];

const QUICK_PRESETS: {
  name: string;
  code: string;
  category: BillComponentCategory;
  defaultAmount: number;
  frequency: 'Per Term' | 'Per Year' | 'One-Time' | 'Optional';
  applicableClasses: ('All' | ClassType)[];
  isRequired: boolean;
  description: string;
}[] = [
  {
    name: 'BECE Mock Examination Levy',
    code: 'EXAM-MOCK',
    category: 'Academic',
    defaultAmount: 120,
    frequency: 'Per Term',
    applicableClasses: ['Basic 9'],
    isRequired: true,
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
    description: 'Graduation ceremonial attire, certificate printing, awards, and event organization.'
  },
  {
    name: 'Science Practicals & STEM Kits',
    code: 'SCI-PRACT',
    category: 'Academic',
    defaultAmount: 50,
    frequency: 'Per Term',
    applicableClasses: ['Basic 7', 'Basic 8', 'Basic 9'],
    isRequired: true,
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
    description: 'Acquisition of supplementary storybooks, reference encyclopedias, and digital tablets.'
  }
];

export default function CreateBillCategoryModal({ isOpen, onClose, onSuccess }: Props) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState<BillComponentCategory>('Academic');
  const [isCustomCategoryMode, setIsCustomCategoryMode] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [availableCategories, setAvailableCategories] = useState<string[]>(() => {
    return DbController.getCustomBillCategories();
  });

  const [defaultAmount, setDefaultAmount] = useState<number>(50);
  const [expenseBudgetCap, setExpenseBudgetCap] = useState<number>(0);
  const [frequency, setFrequency] = useState<'Per Term' | 'Per Year' | 'One-Time' | 'Optional'>('Per Term');
  const [isAllClasses, setIsAllClasses] = useState(true);
  const [selectedClasses, setSelectedClasses] = useState<ClassType[]>([]);
  const [isRequired, setIsRequired] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync available categories whenever modal opens
  React.useEffect(() => {
    if (isOpen) {
      setAvailableCategories(DbController.getCustomBillCategories());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: typeof QUICK_PRESETS[0]) => {
    setName(preset.name);
    setCode(preset.code);
    setIsCustomCategoryMode(false);
    setCategory(preset.category);
    setDefaultAmount(preset.defaultAmount);
    setFrequency(preset.frequency);
    if (preset.applicableClasses.includes('All')) {
      setIsAllClasses(true);
      setSelectedClasses([]);
    } else {
      setIsAllClasses(false);
      setSelectedClasses(preset.applicableClasses as ClassType[]);
    }
    setIsRequired(preset.isRequired);
    setDescription(preset.description);
    triggerToast(`Applied preset: ${preset.name}`, 'info');
  };

  const toggleClass = (cls: ClassType) => {
    if (selectedClasses.includes(cls)) {
      setSelectedClasses(selectedClasses.filter(c => c !== cls));
    } else {
      setSelectedClasses([...selectedClasses, cls]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      triggerToast('Please provide a name for the bill category.', 'error');
      return;
    }
    if (defaultAmount < 0) {
      triggerToast('Default amount cannot be negative.', 'error');
      return;
    }
    if (!isAllClasses && selectedClasses.length === 0) {
      triggerToast('Please select at least one class or choose "All Classes".', 'error');
      return;
    }

    let finalCategory = category;
    if (isCustomCategoryMode) {
      const trimmedCustom = customCategoryInput.trim();
      if (!trimmedCustom) {
        triggerToast('Please type the name of the new bill category / classification group.', 'error');
        return;
      }
      finalCategory = trimmedCustom;
      DbController.saveCustomBillCategory(trimmedCustom);
    }

    setIsSubmitting(true);
    try {
      const existingComponents = DbController.getCustomBillComponents();
      const existingCategories = DbController.getCustomBillCategories();

      // Server-Side Duplicate Validation
      try {
        const validateRes = await fetch('/api/finances/bill-categories/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            code: code.trim(),
            category: finalCategory,
            defaultAmount: Number(defaultAmount) || 0,
            existingComponents,
            existingCategories
          })
        });

        const validationData = await validateRes.json();
        if (!validateRes.ok || !validationData.valid) {
          triggerToast(validationData.message || 'Validation error: A bill category with this name already exists.', 'error');
          setIsSubmitting(false);
          return;
        }
      } catch (netErr) {
        // Client-side fallback duplicate check if server is unreachable
        const norm = name.trim().toLowerCase();
        const exists = existingComponents.some(c => c.name.trim().toLowerCase() === norm);
        if (exists) {
          triggerToast(`A bill category with the name "${name.trim()}" already exists in the system.`, 'error');
          setIsSubmitting(false);
          return;
        }
      }

      const generatedCode = code.trim().toUpperCase() || 
        name.trim().split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 8) || 
        'CAT-' + Math.floor(100 + Math.random() * 900);

      const newComponent: CustomBillComponent = {
        id: 'comp_' + Date.now(),
        name: name.trim(),
        code: generatedCode,
        category: finalCategory,
        defaultAmount: Number(defaultAmount) || 0,
        expenseBudgetCap: expenseBudgetCap > 0 ? Number(expenseBudgetCap) : undefined,
        frequency,
        applicableClasses: isAllClasses ? ['All'] : selectedClasses,
        isRequired,
        isActive,
        description: description.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      DbController.saveCustomBillComponent(newComponent);
      triggerToast(`Bill category "${newComponent.name}" added successfully!`, 'success');

      if (onSuccess) {
        onSuccess(newComponent);
      }
      onClose();
    } catch (err: any) {
      console.error('Error saving custom bill component:', err);
      triggerToast(err.message || 'Failed to save bill category.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[500] p-3 sm:p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/60 via-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
              <Plus size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                Create New Bill Category
              </h2>
              <p className="text-xs text-slate-500">
                Add an additional fee component or custom charge to the finances system
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar text-left">
          {/* Quick Presets Carousel */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-500" />
                <span>Popular School Category Presets</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Click to auto-fill</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
              {QUICK_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:text-indigo-700 whitespace-nowrap transition cursor-pointer shrink-0 flex items-center gap-1.5 shadow-2xs"
                >
                  <span>{p.name.split(' ')[0]} {p.name.split(' ')[1]}</span>
                  <span className="text-[10px] font-mono text-indigo-600 bg-indigo-100/60 px-1 py-0.2 rounded font-black">
                    GH₵{p.defaultAmount}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Core Information Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                Bill Category Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. BECE Mock Exam Levy, Boarding & Laundry, ICT Lab Dues"
                className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-2xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                Short Category Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. MOCK-EXAM, ICT-LAB"
                className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition uppercase shadow-2xs"
              />
              <span className="text-[10px] text-slate-400 block">Short alphanumeric tag for receipts & schedules</span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                  Classification Group <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomCategoryMode(!isCustomCategoryMode)}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer select-none"
                >
                  {isCustomCategoryMode ? 'Select from list' : '+ New category if not listed'}
                </button>
              </div>

              {isCustomCategoryMode ? (
                <div className="space-y-1">
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={customCategoryInput}
                      onChange={(e) => setCustomCategoryInput(e.target.value)}
                      placeholder="e.g. Boarding & Laundry, ICT Innovation, PTA Levy"
                      className="w-full px-3.5 py-2.5 bg-indigo-50/50 focus:bg-white border-2 border-indigo-500 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition shadow-2xs"
                    />
                  </div>
                  <span className="text-[10px] text-indigo-600 font-semibold block">
                    This new category will be saved and available across all finance ledgers and charts.
                  </span>
                </div>
              ) : (
                <select
                  value={category}
                  onChange={(e) => {
                    if (e.target.value === '__CUSTOM__') {
                      setIsCustomCategoryMode(true);
                    } else {
                      setCategory(e.target.value as BillComponentCategory);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-2xs cursor-pointer"
                >
                  {availableCategories.map((cat) => {
                    const presetMatch = CATEGORY_GROUPS.find(g => g.value === cat);
                    return (
                      <option key={cat} value={cat}>
                        {cat} {presetMatch ? `(${presetMatch.desc.split(',')[0]})` : '(Custom Category)'}
                      </option>
                    );
                  })}
                  <option value="__CUSTOM__" className="font-bold text-indigo-600">
                    + Other / Not Listed (Type Custom Category...)
                  </option>
                </select>
              )}
            </div>
          </div>

          {/* Pricing & Billing Parameters */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 font-mono flex items-center gap-1.5">
              <DollarSign size={14} className="text-indigo-600" />
              <span>Financial & Billing Parameters</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-600">
                  Default Rate / Fee (GH₵) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-mono font-bold text-slate-400">GH₵</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    required
                    value={defaultAmount}
                    onChange={(e) => setDefaultAmount(parseFloat(e.target.value) || 0)}
                    className="w-full pl-11 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-black text-slate-900 focus:outline-none focus:border-indigo-500 transition shadow-2xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-600">
                  Billing Frequency
                </label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500 transition shadow-2xs cursor-pointer"
                >
                  <option value="Per Term">Per Term (Standard)</option>
                  <option value="Per Year">Per Academic Year</option>
                  <option value="One-Time">One-Time (e.g. Admission/Grad)</option>
                  <option value="Optional">Optional / Upon Request</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-600">
                  Expense Budget Cap (Optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-mono font-bold text-slate-400">GH₵</span>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={expenseBudgetCap}
                    onChange={(e) => setExpenseBudgetCap(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full pl-11 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-500 transition shadow-2xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Class Applicability */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                Target Applicable Classes
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-bold text-indigo-600 select-none">
                <input
                  type="checkbox"
                  checked={isAllClasses}
                  onChange={(e) => {
                    setIsAllClasses(e.target.checked);
                    if (e.target.checked) setSelectedClasses([]);
                  }}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                />
                <span>Apply to All Classes</span>
              </label>
            </div>

            {!isAllClasses && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {CLASSES.map((cls) => {
                  const isChecked = selectedClasses.includes(cls);
                  return (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => toggleClass(cls)}
                      className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-between border cursor-pointer ${
                        isChecked 
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate">{cls}</span>
                      {isChecked && <CheckCircle2 size={12} className="shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Policy Flags & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-start gap-3 p-3.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-2xl cursor-pointer transition select-none">
              <input
                type="checkbox"
                checked={isRequired}
                onChange={(e) => setIsRequired(e.target.checked)}
                className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 block">Compulsory Billing</span>
                <span className="text-[10px] text-slate-500 block leading-snug">
                  Automatically applied as a mandatory charge to all enrolled students in the target classes.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-2xl cursor-pointer transition select-none">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 block">Active Status</span>
                <span className="text-[10px] text-slate-500 block leading-snug">
                  Immediately enabled and ready for term bill generation and payments.
                </span>
              </div>
            </label>

            <div className="sm:col-span-2 space-y-1">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                Description & Accounting Purpose
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this bill component finances, approved vendors, and school policy terms..."
                className="w-full px-3.5 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-500 transition shadow-2xs"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md shadow-indigo-500/20 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Plus size={15} className="stroke-[2.5]" />
              <span>{isSubmitting ? 'Saving Category...' : 'Save & Add Category'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
