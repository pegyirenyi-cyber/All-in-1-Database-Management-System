import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Keyboard, 
  X, 
  Search, 
  Command, 
  ArrowRight, 
  ArrowLeft, 
  Save, 
  Printer, 
  HelpCircle, 
  Layers, 
  Check, 
  Info 
} from 'lucide-react';

interface KeyboardShortcutItem {
  id: string;
  category: 'navigation' | 'actions' | 'system';
  title: string;
  description: string;
  keys: string[];
}

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSearch?: () => void;
  onSaveData?: () => void;
  activeTabLabel?: string;
}

const SHORTCUT_ITEMS: KeyboardShortcutItem[] = [
  {
    id: 'tab-jump',
    category: 'navigation',
    title: 'Switch to Specific Tab',
    description: 'Jump directly to workspace tab 1 through 9',
    keys: ['Alt', '1 - 9']
  },
  {
    id: 'next-tab',
    category: 'navigation',
    title: 'Next Workspace Tab',
    description: 'Cycle forward to the next visible tab',
    keys: ['Alt', '→']
  },
  {
    id: 'prev-tab',
    category: 'navigation',
    title: 'Previous Workspace Tab',
    description: 'Cycle backward to the previous tab',
    keys: ['Alt', '←']
  },
  {
    id: 'toggle-sidebar',
    category: 'navigation',
    title: 'Toggle Desktop Sidebar',
    description: 'Show or hide the desktop menu sidebar',
    keys: ['Ctrl', 'B']
  },
  {
    id: 'quick-search',
    category: 'actions',
    title: 'Global Quick Search',
    description: 'Search students, staff, modules, and administrative tools',
    keys: ['Ctrl', 'K']
  },
  {
    id: 'save-data',
    category: 'actions',
    title: 'Save Progress & Sync',
    description: 'Instantly save database updates and trigger sync check',
    keys: ['Ctrl', 'S']
  },
  {
    id: 'print-preview',
    category: 'actions',
    title: 'Print / Document Preview',
    description: 'Open high-fidelity print preview for active report or sheet',
    keys: ['Ctrl', 'P']
  },
  {
    id: 'shortcuts-help',
    category: 'system',
    title: 'Toggle Shortcuts Help',
    description: 'Open or close this keyboard shortcuts guide',
    keys: ['?']
  },
  {
    id: 'shortcuts-cmd-slash',
    category: 'system',
    title: 'Help Guide Alternative',
    description: 'Alternative trigger for shortcuts overlay',
    keys: ['Ctrl', '/']
  },
  {
    id: 'close-modal',
    category: 'system',
    title: 'Close Modal / Dialog',
    description: 'Dismiss any active modal or search box',
    keys: ['Esc']
  }
];

export default function KeyboardShortcutsModal({
  isOpen,
  onClose,
  onOpenSearch,
  onSaveData,
  activeTabLabel
}: KeyboardShortcutsModalProps) {
  const [activeCategory, setActiveCategory] = useState<'all' | 'navigation' | 'actions' | 'system'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredShortcuts = SHORTCUT_ITEMS.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch = !searchQuery.trim() || 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.keys.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-10 flex flex-col max-h-[90vh]"
        >
          {/* Top Decorative Accent Header */}
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 p-6 text-white relative overflow-hidden shrink-0">
            <div className="absolute -right-10 -bottom-10 opacity-15 pointer-events-none">
              <Keyboard size={180} />
            </div>

            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
                  <Keyboard size={24} className="text-amber-300" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                    Keyboard Shortcuts & Quick Controls
                    <span className="px-2 py-0.5 text-[10px] font-mono bg-amber-400 text-slate-950 rounded-full font-black uppercase">
                      Pro Productivity
                    </span>
                  </h3>
                  <p className="text-xs text-indigo-100 font-medium">
                    Navigate tabs, search data, and execute tasks without leaving your keyboard.
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                title="Close overlay"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Controls Ribbon: Search & Category Filter */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-3 shrink-0">
            {/* Search Input */}
            <div className="relative w-full sm:w-1/2">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter shortcuts..."
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')} 
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'All Shortcuts' },
                { id: 'navigation', label: 'Navigation' },
                { id: 'actions', label: 'Actions' },
                { id: 'system', label: 'System' }
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    activeCategory === cat.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Shortcut Items List */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-3 divide-y divide-slate-100 dark:divide-slate-800/60 grow">
            {filteredShortcuts.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <HelpCircle size={36} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No matching shortcuts found</p>
                <p className="text-[11px] text-slate-400 mt-1">Try adjusting your search filter or category</p>
              </div>
            ) : (
              filteredShortcuts.map((item) => (
                <div 
                  key={item.id} 
                  className="pt-3 first:pt-0 flex items-center justify-between gap-4 group"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {item.title}
                      </h4>
                      <span className="px-2 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[9px] font-mono uppercase font-bold">
                        {item.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  {/* KBD Badges */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.keys.map((key, kIdx) => (
                      <React.Fragment key={kIdx}>
                        {kIdx > 0 && <span className="text-xs text-slate-300 dark:text-slate-600 font-mono font-bold">+</span>}
                        <kbd className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border-b-2 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-mono font-black shadow-2xs min-w-[28px] text-center inline-block">
                          {key}
                        </kbd>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Quick Action Buttons & Tip */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px] font-medium">
              <Info size={14} className="text-indigo-500 shrink-0" />
              <span>Press <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded font-mono font-bold text-[10px] text-slate-800 dark:text-slate-200">?</kbd> anytime to open this helper overlay.</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {onOpenSearch && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenSearch();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold text-xs hover:bg-indigo-100 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Search size={13} /> Open Quick Search
                </button>
              )}

              {onSaveData && (
                <button
                  onClick={() => {
                    onClose();
                    onSaveData();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Save size={13} /> Save Data Now
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
