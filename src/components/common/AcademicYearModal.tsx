import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Check, X, Trash2, ArrowRight, Clock, Plus, AlertCircle } from 'lucide-react';
import { AcademicYearType } from '../../types';
import { DbController } from '../../db';

interface AcademicYearModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectYear?: (year: AcademicYearType) => void;
  currentYear?: string;
}

export const AcademicYearModal: React.FC<AcademicYearModalProps> = ({
  isOpen,
  onClose,
  onSelectYear,
  currentYear
}) => {
  const currentCalendarYear = new Date().getFullYear(); // e.g. 2026

  // Default start year: if currentYear is "2028/2029", extract 2028, else currentCalendarYear
  const initialStartYear = useMemo(() => {
    if (currentYear) {
      const match = currentYear.match(/^(\d{4})/);
      if (match) return parseInt(match[1], 10);
    }
    return currentCalendarYear;
  }, [currentYear, currentCalendarYear]);

  const [fromYear, setFromYear] = useState<number>(initialStartYear);
  const [toYear, setToYear] = useState<number>(initialStartYear + 1);
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');
  const [existingYears, setExistingYears] = useState<AcademicYearType[]>([]);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [confirmDeleteYear, setConfirmDeleteYear] = useState<AcademicYearType | null>(null);

  // Load existing years from DbController
  const refreshYears = () => {
    const list = DbController.getAcademicYears();
    setExistingYears(list);
  };

  useEffect(() => {
    if (isOpen) {
      refreshYears();
      setFromYear(initialStartYear);
      setToYear(initialStartYear + 1);
      setFeedbackMsg(null);
    }
  }, [isOpen, initialStartYear]);

  // The formatted academic year string: e.g. "2028/2029"
  const formattedAcademicYear = `${fromYear}/${toYear}`;
  const isValidRange = toYear > fromYear;
  const isDuplicate = existingYears.includes(formattedAcademicYear as AcademicYearType);

  // Quick years grid (e.g. 10 years centered around current start year)
  const availableYearsList = Array.from({ length: 21 }, (_, i) => currentCalendarYear - 4 + i);

  if (!isOpen) return null;

  const handleSelectFromYear = (yr: number) => {
    setFromYear(yr);
    // Automatically advance "To" to next year if not set or equal
    setToYear(yr + 1);
    setFeedbackMsg(null);
  };

  const handleSelectToYear = (yr: number) => {
    setToYear(yr);
    setFeedbackMsg(null);
  };

  const handleSaveAndSelect = () => {
    if (!isValidRange) {
      setFeedbackMsg({
        text: 'Ending year must be strictly greater than starting year (e.g. From 2028 to 2029).',
        type: 'error'
      });
      return;
    }

    // Save to persistent storage and cloud
    const updated = DbController.saveCustomAcademicYear(formattedAcademicYear);
    setExistingYears(updated);

    if (onSelectYear) {
      onSelectYear(formattedAcademicYear as AcademicYearType);
    }

    onClose();
  };

  const handleDeleteYear = (yr: AcademicYearType) => {
    const updated = DbController.deleteCustomAcademicYear(yr);
    setExistingYears(updated);
    setConfirmDeleteYear(null);
    setFeedbackMsg({ text: `Academic year ${yr} removed.`, type: 'success' });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden transform transition-all my-8"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-blue-700 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-xs shadow-inner">
              <Calendar className="w-6 h-6 text-indigo-100" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Add Academic Year</h3>
              <p className="text-xs text-indigo-100/90 font-medium">
                Select starting & ending calendar years (e.g. 2028 to 2029)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'create'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus size={14} />
            Year Calendar Picker
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manage')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'manage'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock size={14} />
            Manage Existing ({existingYears.length})
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-5">
          {feedbackMsg && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                feedbackMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              <AlertCircle size={15} className="shrink-0" />
              <span>{feedbackMsg.text}</span>
            </div>
          )}

          {activeTab === 'create' ? (
            <>
              {/* Live Preview Display Card */}
              <div className="p-4 bg-gradient-to-br from-indigo-50/90 via-blue-50/50 to-slate-50 border border-indigo-200/80 rounded-2xl shadow-xs text-center space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Resulting Academic Year Range
                </span>
                
                <div className="flex items-center justify-center gap-3 py-1">
                  <div className="bg-white px-3.5 py-1.5 rounded-xl border border-indigo-100 shadow-xs font-mono font-black text-indigo-900 text-lg">
                    {fromYear}
                  </div>
                  <ArrowRight className="w-5 h-5 text-indigo-400 shrink-0" />
                  <div className="bg-white px-3.5 py-1.5 rounded-xl border border-indigo-100 shadow-xs font-mono font-black text-indigo-900 text-lg">
                    {toYear}
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white rounded-full text-base font-black tracking-wide shadow-sm">
                  <Calendar size={16} className="text-indigo-200" />
                  <span>{formattedAcademicYear}</span>
                </div>

                {isDuplicate && (
                  <p className="text-[11px] font-semibold text-emerald-700 mt-1">
                    ✓ This academic year is already in your registered system list.
                  </p>
                )}

                {!isValidRange && (
                  <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center justify-center gap-1">
                    <AlertCircle size={13} /> Ending year must be greater than starting year.
                  </p>
                )}
              </div>

              {/* Calendar Year Range Picker Form */}
              <div className="space-y-4">
                {/* 1. STARTING YEAR (FROM) */}
                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      Starting Year (From)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSelectFromYear(fromYear - 1)}
                        className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 font-black text-xs cursor-pointer"
                        title="Previous Year"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="2000"
                        max="2100"
                        value={fromYear}
                        onChange={(e) => handleSelectFromYear(parseInt(e.target.value, 10) || currentCalendarYear)}
                        className="w-20 px-2 py-1 text-center font-bold text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleSelectFromYear(fromYear + 1)}
                        className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 font-black text-xs cursor-pointer"
                        title="Next Year"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Quick Year Badges Grid for Starting Year */}
                  <div className="flex flex-wrap gap-1.5 pt-1 max-h-24 overflow-y-auto p-1 bg-white rounded-lg border border-slate-100">
                    {availableYearsList.map((yr) => {
                      const isSelected = yr === fromYear;
                      return (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => handleSelectFromYear(yr)}
                          className={`text-xs px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-xs font-bold'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {yr}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. ENDING YEAR (TO) */}
                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      Ending Year (To)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSelectToYear(toYear - 1)}
                        className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 font-black text-xs cursor-pointer"
                        title="Previous Year"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="2000"
                        max="2100"
                        value={toYear}
                        onChange={(e) => handleSelectToYear(parseInt(e.target.value, 10) || (fromYear + 1))}
                        className="w-20 px-2 py-1 text-center font-bold text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleSelectToYear(toYear + 1)}
                        className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 font-black text-xs cursor-pointer"
                        title="Next Year"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Quick Year Badges Grid for Ending Year */}
                  <div className="flex flex-wrap gap-1.5 pt-1 max-h-24 overflow-y-auto p-1 bg-white rounded-lg border border-slate-100">
                    {availableYearsList.map((yr) => {
                      const isSelected = yr === toYear;
                      return (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => handleSelectToYear(yr)}
                          className={`text-xs px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-xs font-bold'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {yr}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Presets Shortcuts */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Quick Preset Cycles:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { from: 2026, to: 2027 },
                      { from: 2027, to: 2028 },
                      { from: 2028, to: 2029 },
                      { from: 2029, to: 2030 },
                      { from: 2030, to: 2031 },
                      { from: 2031, to: 2032 }
                    ].map((p) => {
                      const yrStr = `${p.from}/${p.to}`;
                      const isActive = fromYear === p.from && toYear === p.to;
                      return (
                        <button
                          key={yrStr}
                          type="button"
                          onClick={() => {
                            setFromYear(p.from);
                            setToYear(p.to);
                          }}
                          className={`text-[11px] px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer ${
                            isActive
                              ? 'bg-indigo-50 border-indigo-400 text-indigo-700'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {yrStr}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Tab 2: Manage Existing Custom Academic Years */
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                Below are all registered academic years configured in your system. Click to select or remove custom additions.
              </p>

              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100">
                {existingYears.map((yr) => {
                  const isCurrent = yr === currentYear;
                  return (
                    <div
                      key={yr}
                      className="pt-1.5 pb-1 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg transition"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-800">{yr}</span>
                        {isCurrent && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold uppercase">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {confirmDeleteYear === yr ? (
                          <div className="flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            <span className="text-[10px] text-rose-700 font-bold">Remove?</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteYear(yr)}
                              className="text-[10px] px-1.5 py-0.5 bg-rose-600 text-white font-bold rounded hover:bg-rose-700 transition cursor-pointer"
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteYear(null)}
                              className="text-[10px] px-1 py-0.5 text-slate-500 hover:text-slate-800 transition cursor-pointer"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                if (onSelectYear) onSelectYear(yr);
                                onClose();
                              }}
                              className="text-[10px] px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold transition cursor-pointer"
                            >
                              Select
                            </button>

                            <button
                              type="button"
                              onClick={() => setConfirmDeleteYear(yr)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                              title={`Delete ${yr}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            Cancel
          </button>

          {activeTab === 'create' ? (
            <button
              type="button"
              disabled={!isValidRange}
              onClick={handleSaveAndSelect}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check size={14} />
              <span>Save & Select {formattedAcademicYear}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} />
              <span>Add Another Year</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
