import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  Clock, 
  Save, 
  Check, 
  Lock, 
  AlertTriangle,
  Compass, 
  FileSpreadsheet, 
  Info,
  CalendarDays,
  Sparkles
} from 'lucide-react';
import { DbController } from '../db';
import { AcademicCalendarConfig, AcademicYearType, TermType, ACADEMIC_YEARS } from '../types';
import { evaluateSubscription } from '../subscription';

interface AcademicCalendarTabProps {
  themeStyles: any;
  onConfigChanged?: () => void;
}

export default function AcademicCalendarTab({ themeStyles, onConfigChanged }: AcademicCalendarTabProps) {
  const currentUser = DbController.getCurrentUser();
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.email.toLowerCase().trim() === 'pegyirenyi@gmail.com';

  const [calendar, setCalendar] = useState<AcademicCalendarConfig>(DbController.getAcademicCalendar());
  const [selectedYear, setSelectedYear] = useState<AcademicYearType>(calendar.activeAcademicYear);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Keep locals in sync if stored config changes
  useEffect(() => {
    const activeCal = DbController.getAcademicCalendar();
    setCalendar(activeCal);
    setSelectedYear(activeCal.activeAcademicYear);
  }, []);

  const yearsOptions: AcademicYearType[] = ACADEMIC_YEARS;
  const termsOptions: TermType[] = ['Term 1', 'Term 2', 'Term 3'];

  // Handle high-level fields update
  const handleActiveYearChange = (year: AcademicYearType) => {
    if (!isAdmin) return;
    setCalendar(prev => ({
      ...prev,
      activeAcademicYear: year
    }));
  };

  const handleActiveTermChange = (term: TermType) => {
    if (!isAdmin) return;
    setCalendar(prev => ({
      ...prev,
      activeTerm: term
    }));
  };

  // Handle dates update for the year config
  const handleYearDateChange = (field: 'startDate' | 'endDate', value: string) => {
    if (!isAdmin) return;
    setCalendar(prev => {
      const updatedYears = { ...prev.years };
      updatedYears[selectedYear] = {
        ...updatedYears[selectedYear],
        [field]: value
      };
      return {
        ...prev,
        years: updatedYears
      };
    });
  };

  // Handle term dates update for the year config
  const handleTermDateChange = (term: TermType, field: 'startDate' | 'endDate', value: string) => {
    if (!isAdmin) return;
    setCalendar(prev => {
      const updatedYears = { ...prev.years };
      const updatedTerms = { ...updatedYears[selectedYear].terms };
      updatedTerms[term] = {
        ...updatedTerms[term],
        [field]: value
      };
      updatedYears[selectedYear] = {
        ...updatedYears[selectedYear],
        terms: updatedTerms
      };
      return {
        ...prev,
        years: updatedYears
      };
    });
  };

  const handleSave = () => {
    if (!isAdmin) {
      setErrorMsg("Unauthorized: Only system administrators have permissions to modify Academic Calendar configurations.");
      return;
    }

    // Validation checks
    const targetYearCfg = calendar.years[selectedYear];
    if (!targetYearCfg.startDate || !targetYearCfg.endDate) {
      setErrorMsg("School Year start and end dates cannot be left blank.");
      return;
    }

    if (new Date(targetYearCfg.startDate) >= new Date(targetYearCfg.endDate)) {
      setErrorMsg("School Year End Date must fall after the Start Date.");
      return;
    }

    // Check term dates overlap or blank
    for (const term of termsOptions) {
      const tCfg = targetYearCfg.terms[term];
      if (!tCfg.startDate || !tCfg.endDate) {
        setErrorMsg(`Dates for ${term} cannot be left blank.`);
        return;
      }
      if (new Date(tCfg.startDate) >= new Date(tCfg.endDate)) {
        setErrorMsg(`${term} End Date must fall after its Start Date.`);
        return;
      }
    }

    setErrorMsg(null);
    DbController.saveAcademicCalendar(calendar);
    setSaveSuccess(true);
    
    // Notify main App configuration changed (refresh subscription evaluation status, etc.)
    if (onConfigChanged) {
      onConfigChanged();
    }

    setTimeout(() => {
      setSaveSuccess(false);
    }, 3000);
  };

  // Evaluate live subscription impact to display immediately on this dashboard
  const userSub = currentUser ? evaluateSubscription(currentUser) : null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Title Header Banner */}
      <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-6 relative overflow-hidden shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-56 h-56 bg-indigo-500/10 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl" />
        
        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Administrative Engine
            </span>
            <span className="flex items-center gap-1 text-amber-400 text-xs font-bold font-mono">
              <Sparkles size={13} /> GTM Systems
            </span>
          </div>
          <h2 className="text-2xl font-black font-display tracking-tight uppercase">
            Institutional <span className="text-amber-400">Academic Calendar</span>
          </h2>
          <p className="text-slate-400 text-xs max-w-2xl font-sans leading-relaxed">
            Configure default operational term boundaries, holiday timelines, and seasonal duration limits for student assessments. This module establishes core scheduling parameters that dynamically override license trial durations and activation lifecycles across the ecosystem.
          </p>
        </div>

        {userSub && (
          <div className="relative z-10 flex-shrink-0 bg-slate-800/80 rounded-xl p-4 border border-slate-700 max-w-sm">
            <span className="text-[10px] uppercase tracking-wider font-mono font-bold block text-slate-400 mb-1">
              Active Server Gateway & Trial Bounds
            </span>
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-lg ${userSub.isLocked ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                <Calendar size={18} />
              </div>
              <div>
                <p className="text-[11px] font-mono text-slate-300 leading-tight">
                  Subscription Status: 
                  <strong className={userSub.isLocked ? "text-rose-400" : "text-emerald-400"}>
                    {userSub.isLocked ? " LICENSING LOCKED" : " ACTIVE TRIAL / HEALTHY"}
                  </strong>
                </p>
                <p className="text-xs font-black text-white mt-1">
                  Expires: <span className="font-mono text-amber-400">{userSub.expiryDate.toLocaleDateString()}</span>
                </p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                  ({userSub.remainingDays} days remaining for active boundaries)
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-4 py-3 rounded-xl flex items-start gap-2.5 shadow-sm">
          <AlertTriangle size={16} className="text-rose-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Execution Error Blocked</p>
            <p className="text-rose-700/90 mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}

      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2.5 shadow-sm animate-pulse">
          <Check size={16} className="text-emerald-600 flex-shrink-0" />
          <p className="font-bold">Academic Calendar successfully saved and synchronized across active registers.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Admin configurations select handles */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${themeStyles.primaryBg} text-white`}>
                  <Compass size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase">System Active Sessions</h3>
                  <p className="text-[11px] text-slate-500 font-sans">Declare current school operations matching academic records</p>
                </div>
              </div>
              
              {!isAdmin && (
                <div className="flex items-center gap-1 bg-amber-50 text-amber-800 text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border border-amber-200">
                  <Lock size={12} /> READ-ONLY VIEWER
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                  Active Institutional Year
                </label>
                <select
                  disabled={!isAdmin}
                  value={calendar.activeAcademicYear}
                  onChange={(e) => handleActiveYearChange(e.target.value as AcademicYearType)}
                  className={`w-full text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white disabled:opacity-75 disabled:cursor-not-allowed`}
                >
                  {yearsOptions.map(y => (
                    <option key={y} value={y}>{y} Academic Year</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                  Controls the active class registers, print summaries, and broadsheet scoring logs.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                  Active Operational Term
                </label>
                <select
                  disabled={!isAdmin}
                  value={calendar.activeTerm}
                  onChange={(e) => handleActiveTermChange(e.target.value as TermType)}
                  className={`w-full text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white disabled:opacity-75 disabled:cursor-not-allowed`}
                >
                  {termsOptions.map(t => (
                    <option key={t} value={t}>{t} (Current Assessments)</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                  Defines default assessment terms. Trial licenses expire precisely at the end of this active term.
                </p>
              </div>
            </div>
          </div>

          {/* School Year Start / End Dates Configuration */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${themeStyles.primaryBg} text-white`}>
                  <CalendarDays size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase">
                    Configure Session Dates: <span className="text-amber-600 font-mono font-bold">{selectedYear}</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 font-sans">Set year duration bounds and individual term boundaries</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 font-mono">Select Year to Edit:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value as AcademicYearType)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-black text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {yearsOptions.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* School year overall bounds */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-1 text-xs font-black text-slate-800 uppercase tracking-wide">
                <Info size={14} className="text-indigo-500" /> Key Year Boundaries (Annual Activation Expiry Target)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    School Year Start Date
                  </label>
                  <input
                    type="date"
                    disabled={!isAdmin}
                    value={calendar.years[selectedYear]?.startDate || ''}
                    onChange={(e) => handleYearDateChange('startDate', e.target.value)}
                    className="w-full text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-75"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    School Year End Date (License Lock Limit)
                  </label>
                  <input
                    type="date"
                    disabled={!isAdmin}
                    value={calendar.years[selectedYear]?.endDate || ''}
                    onChange={(e) => handleYearDateChange('endDate', e.target.value)}
                    className="w-full text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-75"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">
                An active subscription account will expire immediately on the set **School Year End Date** above, completely replacing static 12-month durations.
              </p>
            </div>

            {/* Terms Bounds */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-2">
                Academic Terms Breakdown
              </h4>
              
              <div className="grid grid-cols-1 gap-4">
                {termsOptions.map(t => {
                  const termDates = calendar.years[selectedYear]?.terms?.[t] || { startDate: '', endDate: '' };
                  const isCurrentActive = calendar.activeAcademicYear === selectedYear && calendar.activeTerm === t;

                  return (
                    <div 
                      key={t} 
                      className={`border p-4 rounded-xl space-y-3 transition ${
                        isCurrentActive 
                          ? 'border-indigo-200 bg-indigo-50/20' 
                          : 'border-slate-100 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase">
                          <span className={`w-2 h-2 rounded-full ${isCurrentActive ? 'bg-indigo-500 animate-ping' : 'bg-slate-300'}`} />
                          {t} timeline
                        </span>
                        {isCurrentActive && (
                          <span className="bg-indigo-100 text-indigo-800 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full">
                            CURRENT OPERATIONAL TERM
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Term Opening Date
                          </label>
                          <input
                            type="date"
                            disabled={!isAdmin}
                            value={termDates.startDate}
                            onChange={(e) => handleTermDateChange(t, 'startDate', e.target.value)}
                            className="w-full text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-75"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Term Closing Date (Trial Expiry)
                          </label>
                          <input
                            type="date"
                            disabled={!isAdmin}
                            value={termDates.endDate}
                            onChange={(e) => handleTermDateChange(t, 'endDate', e.target.value)}
                            className="w-full text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-75"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {isAdmin && (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSave}
                  className={`${themeStyles.primaryBg} hover:opacity-95 transition text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-xs flex items-center gap-2 cursor-pointer active:translate-y-0.5`}
                >
                  <Save size={15} /> Save Academic Calendar Config
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Right column: Current Academic Calendar summary visualizer */}
        <div className="space-y-6">
          <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-md space-y-6">
            <h3 className="text-xs font-bold font-mono tracking-widest text-slate-400 uppercase flex items-center gap-2 border-b border-slate-800 pb-3">
              <Clock size={14} className="text-amber-400" /> Institutional Overview
            </h3>

            <div className="space-y-5">
              <div>
                <span className="text-[10px] uppercase font-mono font-bold text-slate-500 block">
                  Active Academic Session
                </span>
                <span className="text-xl font-black font-display text-amber-400 block tracking-tight">
                  {calendar.activeAcademicYear} YEAR
                </span>
                <span className="text-xs font-bold font-sans text-white block mt-0.5">
                  {calendar.activeTerm}
                </span>
              </div>

              <hr className="border-slate-800" />

              <div>
                <span className="text-[10px] uppercase font-mono font-bold text-slate-500 block mb-2">
                  Session Durations Summary
                </span>
                
                <div className="space-y-3 font-mono text-xs">
                  {yearsOptions.map(y => {
                    const yCfg = calendar.years[y];
                    const isYearActive = calendar.activeAcademicYear === y;
                    
                    if (!yCfg?.startDate) return null;

                    return (
                      <div 
                        key={y} 
                        className={`p-3 rounded-xl border ${
                          isYearActive 
                            ? 'border-indigo-500/40 bg-indigo-500/5 text-indigo-100' 
                            : 'border-slate-800 bg-slate-950/40 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`${isYearActive ? 'text-amber-400 font-bold' : 'text-slate-300'}`}>
                            {y} Year Duration
                          </span>
                          {isYearActive && (
                            <span className="text-[8px] tracking-wider uppercase font-sans font-extrabold text-amber-400 bg-amber-400/15 px-1.5 py-0.5 rounded border border-amber-400/20">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-[10px]">
                          {new Date(yCfg.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} to {new Date(yCfg.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        
                        <div className="mt-2 text-[9px] space-y-1 pl-2 border-l border-slate-700/60 font-sans">
                          {termsOptions.map(t => {
                            const isCurrentTermActive = isYearActive && calendar.activeTerm === t;
                            const tDates = yCfg.terms[t];
                            if (!tDates) return null;
                            return (
                              <div key={t} className="flex justify-between">
                                <span className={isCurrentTermActive ? 'text-indigo-300 font-sans font-bold' : 'text-slate-500'}>{t}:</span>
                                <span className={isCurrentTermActive ? 'text-white font-bold font-mono' : 'text-slate-400 font-mono'}>
                                  {new Date(tDates.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <hr className="border-slate-800" />

              {/* Sessions Duration Summary */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3 text-left">
                <span className="flex items-center gap-1.5 text-[10px] uppercase font-mono font-black text-indigo-400">
                  <CalendarDays size={13} /> Academic Session Duration Summary
                </span>
                <p className="text-[11px] text-slate-300 font-sans leading-normal">
                  Overview of the operational calendar timeline and term lengths for the current active academic year <strong className="text-amber-400 font-mono">{calendar.activeAcademicYear}</strong>:
                </p>
                <div className="space-y-2.5 text-[10px] font-sans">
                  {(() => {
                    const activeYCfg = calendar.years[calendar.activeAcademicYear];
                    if (!activeYCfg) return null;
                    
                    const getDaysDifference = (startStr: string, endStr: string) => {
                      const s = new Date(startStr);
                      const e = new Date(endStr);
                      const diffTime = Math.abs(e.getTime() - s.getTime());
                      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive
                    };

                    const totalYearDays = getDaysDifference(activeYCfg.startDate, activeYCfg.endDate);
                    
                    return (
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-2 gap-2 bg-slate-900/40 p-2.5 rounded-lg border border-slate-850">
                          <div>
                            <span className="text-slate-500 block text-[9px] uppercase font-mono">Session Start</span>
                            <span className="font-bold text-slate-200">{new Date(activeYCfg.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px] uppercase font-mono">Session End</span>
                            <span className="font-bold text-slate-200">{new Date(activeYCfg.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                          <div className="col-span-2 border-t border-slate-800 pt-1.5 mt-0.5 flex justify-between items-center text-slate-400 font-mono">
                            <span>Total Year Length:</span>
                            <strong className="text-indigo-300 font-bold text-[11px]">{totalYearDays} Days</strong>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider block font-mono">Active Terms Breakdown</span>
                          {termsOptions.map(t => {
                            const tDates = activeYCfg.terms[t];
                            if (!tDates) return null;
                            const termDays = getDaysDifference(tDates.startDate, tDates.endDate);
                            const isCurrent = calendar.activeTerm === t;
                            
                            return (
                              <div key={t} className={`flex items-center justify-between p-2 rounded-lg border ${isCurrent ? 'bg-indigo-950/20 border-indigo-900/40 text-indigo-200' : 'bg-slate-900/20 border-slate-850 text-slate-450'}`}>
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-1.5 h-1.5 rounded-full ${isCurrent ? 'bg-indigo-400' : 'bg-slate-600'}`} />
                                  <span className="font-bold text-slate-300">{t} Duration</span>
                                </div>
                                <div className="text-right">
                                  <span className="font-mono font-bold text-slate-200">{termDays} Days</span>
                                  <span className="block text-[8px] text-slate-500 font-mono">
                                    {new Date(tDates.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {new Date(tDates.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <hr className="border-slate-800" />

              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="flex items-center gap-1 text-[10px] uppercase font-mono font-bold text-amber-500">
                  <Info size={12} /> Expiry Bounds Impact
                </span>
                <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                  Your academic calendar settings are live on key processes. Subscriptions and trials verify this state:
                </p>
                <div className="text-[10px] font-mono text-slate-400 space-y-1 pl-2 border-l border-slate-800">
                  <p>• Trial: Expres end of <strong className="text-indigo-300">{calendar.activeTerm}</strong></p>
                  <p>• Licensed: Expires end of <strong className="text-amber-400">{calendar.activeAcademicYear}</strong></p>
                </div>
              </div>

              <div className="text-slate-500 text-[10px] leading-snug">
                For license code generations or offline verification keys matching these calendar limits, contact pegyirenyi@gmail.com, GEETECH MULTIMEDIA at 0544052717.
              </div>

            </div>

          </div>
        </div>

      </div>

    </motion.div>
  );
}
