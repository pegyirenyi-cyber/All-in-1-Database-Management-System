import React, { useState, useEffect, useRef } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeStyles } from './ThemeWrapper';

export interface MultiTermSubjectData {
  subject: string;
  shortSubject: string;
  'Term 1'?: number | null;
  'Term 2'?: number | null;
  'Term 3'?: number | null;
  [key: string]: any;
}

interface Props {
  data: MultiTermSubjectData[];
  title?: string;
  subtitle?: string;
  theme?: ThemeStyles;
  selectedClass?: string;
  selectedStudentName?: string;
  onStudentChange?: (studentId: string) => void;
  studentsList?: { id: string; name: string }[];
  selectedStudentId?: string;
}

export const MultiTermPerformanceLineChart: React.FC<Props> = ({
  data,
  title = "Multi-Term Academic Performance Trends",
  subtitle = "Comparative subject performance across Term 1, Term 2, and Term 3",
  theme,
  selectedClass,
  selectedStudentName,
  onStudentChange,
  studentsList = [],
  selectedStudentId = 'all',
}) => {
  const [visibleTerms, setVisibleTerms] = useState({
    term1: true,
    term2: true,
    term3: true
  });

  const toggleTerm = (termKey: 'term1' | 'term2' | 'term3') => {
    setVisibleTerms(prev => ({ ...prev, [termKey]: !prev[termKey] }));
  };

  // Calculate term averages across all available subjects
  const computeTermAvg = (termKey: 'Term 1' | 'Term 2' | 'Term 3') => {
    const validScores = data
      .map(d => d[termKey])
      .filter((val): val is number => typeof val === 'number' && !isNaN(val));
    if (validScores.length === 0) return null;
    return parseFloat((validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1));
  };

  const term1Avg = computeTermAvg('Term 1');
  const term2Avg = computeTermAvg('Term 2');
  const term3Avg = computeTermAvg('Term 3');

  // Overall term progress delta from Term 1 to Term 3
  const overallDelta = (term1Avg !== null && term3Avg !== null) 
    ? parseFloat((term3Avg - term1Avg).toFixed(1))
    : (term1Avg !== null && term2Avg !== null)
    ? parseFloat((term2Avg - term1Avg).toFixed(1))
    : null;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const subjectFull = data.find(d => d.shortSubject === label || d.subject === label)?.subject || label;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs font-sans space-y-1.5 min-w-[170px] text-left">
          <p className="font-bold text-slate-200 border-b border-slate-800 pb-1 font-mono uppercase tracking-wider text-[11px]">
            {subjectFull}
          </p>
          <div className="space-y-1">
            {payload.map((entry: any) => (
              <div key={entry.name} className="flex justify-between items-center gap-3">
                <span className="flex items-center gap-1.5 font-medium text-[11px]" style={{ color: entry.color }}>
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
                  {entry.name}:
                </span>
                <span className="font-black font-mono text-slate-100">{entry.value}%</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const activeTermsKey = `${visibleTerms.term1 ? 't1' : ''}_${visibleTerms.term2 ? 't2' : ''}_${visibleTerms.term3 ? 't3' : ''}`;
  const transitionKey = `mtchart-${selectedStudentId}-${selectedClass || 'all'}-${activeTermsKey}`;

  return (
    <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 text-left font-sans">
      
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-150 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <TrendingUp size={18} />
            </div>
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wide font-display">
              {title}
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-sans">
            {subtitle} {selectedClass ? `(${selectedClass})` : ''} {selectedStudentName ? `— ${selectedStudentName}` : ''}
          </p>
        </div>

        {/* Controls: Student selector & Term visibility toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {onStudentChange && studentsList.length > 0 && (
            <select
              value={selectedStudentId}
              onChange={(e) => onStudentChange(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg cursor-pointer focus:ring-2 focus:ring-indigo-500 transition"
            >
              <option value="all">👥 Class Cohort Average</option>
              {studentsList.map(st => (
                <option key={st.id} value={st.id}>👤 {st.name}</option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-bold">
            <motion.button
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleTerm('term1')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                visibleTerms.term1 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-indigo-300" />
              Term 1
            </motion.button>
            <motion.button
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleTerm('term2')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                visibleTerms.term2 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-300" />
              Term 2
            </motion.button>
            <motion.button
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleTerm('term3')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                visibleTerms.term3 
                  ? 'bg-amber-600 text-white shadow-xs' 
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-300" />
              Term 3
            </motion.button>
          </div>
        </div>
      </div>

      {/* Animated Content Wrapper: KPI Cards + Line Graph */}
      <AnimatePresence>
        <motion.div
          key={transitionKey}
          initial={{ opacity: 0, y: 14, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.985 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-5"
        >
          {data.length === 0 ? (
            <div className="py-12 px-4 text-center bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-200/80 dark:border-slate-800 flex flex-col items-center justify-center gap-2">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl font-black">
                📊
              </div>
              <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">No Captured Subject Assessments Found</p>
              <p className="text-[10.5px] text-slate-400 max-w-sm">No recorded subject marks exist for {selectedStudentName || (selectedClass ? `class ${selectedClass}` : 'this selection')}. Input assessment marks in the Assessment Tab to view performance trend graphs across terms.</p>
            </div>
          ) : (
            <>
              {/* Summary KPI Cards */}
              <motion.div 
                initial="hidden"
                animate="show"
                variants={{
                  hidden: { opacity: 0 },
                  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
                }}
                className="grid grid-cols-2 sm:grid-cols-4 gap-3"
              >
            <motion.div 
              variants={{ hidden: { opacity: 0, y: 8, scale: 0.96 }, show: { opacity: 1, y: 0, scale: 1 } }}
              className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 p-3 rounded-xl"
            >
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block font-mono">Term 1 Line Avg</span>
              <strong className="text-base font-black text-indigo-950 dark:text-indigo-100 font-mono">
                {term1Avg !== null ? `${term1Avg}%` : 'N/A'}
              </strong>
            </motion.div>
            <motion.div 
              variants={{ hidden: { opacity: 0, y: 8, scale: 0.96 }, show: { opacity: 1, y: 0, scale: 1 } }}
              className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 p-3 rounded-xl"
            >
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block font-mono">Term 2 Line Avg</span>
              <strong className="text-base font-black text-emerald-950 dark:text-emerald-100 font-mono">
                {term2Avg !== null ? `${term2Avg}%` : 'N/A'}
              </strong>
            </motion.div>
            <motion.div 
              variants={{ hidden: { opacity: 0, y: 8, scale: 0.96 }, show: { opacity: 1, y: 0, scale: 1 } }}
              className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 p-3 rounded-xl"
            >
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block font-mono">Term 3 Line Avg</span>
              <strong className="text-base font-black text-amber-950 dark:text-amber-100 font-mono">
                {term3Avg !== null ? `${term3Avg}%` : 'N/A'}
              </strong>
            </motion.div>
            <motion.div 
              variants={{ hidden: { opacity: 0, y: 8, scale: 0.96 }, show: { opacity: 1, y: 0, scale: 1 } }}
              className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3 rounded-xl"
            >
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-mono font-bold">Term Progress Delta</span>
              <strong className={`text-base font-black font-mono ${
                overallDelta === null ? 'text-slate-400' : overallDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
                {overallDelta !== null ? `${overallDelta >= 0 ? '+' : ''}${overallDelta}%` : 'N/A'}
              </strong>
            </motion.div>
          </motion.div>

          {/* Multi-Term Line Graph Chart */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="pt-2"
          >
            <div className="h-72 sm:h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart key={transitionKey} data={data} margin={{ top: 15, right: 20, left: -15, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="shortSubject" 
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    iconType="circle" 
                    wrapperStyle={{ fontSize: '11px', fontWeight: 600 }}
                  />
                  {visibleTerms.term1 && (
                    <Line
                      key={`line-term1-${transitionKey}`}
                      type="monotone"
                      dataKey="Term 1"
                      name="Term 1 Line"
                      stroke="#4f46e5"
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 2, fill: '#ffffff' }}
                      activeDot={{ r: 7 }}
                      connectNulls={true}
                      isAnimationActive={true}
                      animationDuration={850}
                      animationEasing="ease-in-out"
                    />
                  )}
                  {visibleTerms.term2 && (
                    <Line
                      key={`line-term2-${transitionKey}`}
                      type="monotone"
                      dataKey="Term 2"
                      name="Term 2 Line"
                      stroke="#10b981"
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 2, fill: '#ffffff' }}
                      activeDot={{ r: 7 }}
                      connectNulls={true}
                      isAnimationActive={true}
                      animationDuration={850}
                      animationEasing="ease-in-out"
                    />
                  )}
                  {visibleTerms.term3 && (
                    <Line
                      key={`line-term3-${transitionKey}`}
                      type="monotone"
                      dataKey="Term 3"
                      name="Term 3 Line"
                      stroke="#f59e0b"
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 2, fill: '#ffffff' }}
                      activeDot={{ r: 7 }}
                      connectNulls={true}
                      isAnimationActive={true}
                      animationDuration={850}
                      animationEasing="ease-in-out"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

    </div>
  );
};
