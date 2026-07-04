import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as d3 from 'd3';
import { 
  StudentAssessment, ClassType, CLASSES, AcademicYearType, ACADEMIC_YEARS, 
  TermType, TERMS, SubjectType, SUBJECTS, Student, UserRole 
} from '../types';
import { DbController, getStorageItem, setStorageItem } from '../db';
import { ThemeStyles } from './ThemeWrapper';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, Cell
} from 'recharts';
import { 
  Printer, Save, CheckSquare, RefreshCw, Layers, Award, FileText, LayoutGrid, BarChart3, HelpCircle, AlertCircle, Sparkles, FileDown,
  Eye, EyeOff, ShieldAlert, Trash2, RotateCcw, Eraser, FileSpreadsheet,
  Smartphone, MessageSquare, Send, CheckCircle, ExternalLink, Calendar,
  X, Sliders, Check, Plus, Info, TrendingUp, TrendingDown
} from 'lucide-react';
import { generateSecureToken, getWatermarkHtml } from '../utils';
import { generatePdfFromHtml, downloadBlobLocally } from '../pdfHelper';
import GoogleDriveExportControl from './GoogleDriveExportControl';

export const RankBreakdownTooltip = ({ 
  term, 
  year, 
  averageScore, 
  gradedCount 
}: { 
  term: string; 
  year: string; 
  averageScore: number; 
  gradedCount?: number;
}) => {
  return (
    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-80 bg-slate-900 text-slate-100 rounded-xl p-4 shadow-2xl border border-slate-800 text-left pointer-events-none font-sans normal-case print:hidden transition-all duration-200">
      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 mb-2">
        <Award size={14} className="text-indigo-400" />
        <span className="font-bold text-xs tracking-tight">Class Rank Calculation Formula</span>
      </div>
      <div className="space-y-2 text-[11px] leading-relaxed text-slate-300">
        <p>
          Calculated for <strong className="text-indigo-300">{term} ({year})</strong> using standard Competition Ranking (Ties are resolved by skipping subsequent positions).
        </p>
        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/60 space-y-2 font-mono text-[10px]">
          <div>
            <span className="text-slate-400 block font-sans text-[9px] uppercase font-semibold">1. Subject Score Calculation:</span>
            <span className="text-slate-200">Total Score (100) = Class Score (50) + Terminal Exam Score (50)</span>
          </div>
          <div>
            <span className="text-slate-400 block font-sans text-[9px] uppercase font-semibold">2. Terminal Average Score:</span>
            <span className="text-slate-200">Average = Sum(All Subject Totals) / Count of Graded Subjects</span>
          </div>
          <div>
            <span className="text-slate-400 block font-sans text-[9px] uppercase font-semibold">3. Final Standing/Rank Formula:</span>
            <span className="text-indigo-300 font-bold">Rank = 1 + Count of classmates with a strictly higher Terminal Average</span>
          </div>
        </div>
        <div className="flex justify-between border-t border-slate-800 pt-2 mt-2 font-sans">
          <div className="space-y-0.5">
            <span className="text-[9px] text-slate-400 block uppercase">Student Terminal Average</span>
            <strong className="text-indigo-300 text-xs font-mono">{averageScore}%</strong>
          </div>
          {gradedCount !== undefined && gradedCount > 0 && (
            <div className="space-y-0.5 text-right">
              <span className="text-[9px] text-slate-400 block uppercase">Graded Cohort Size</span>
              <strong className="text-emerald-400 text-xs font-mono">{gradedCount} Students</strong>
            </div>
          )}
        </div>
      </div>
      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-slate-900 rotate-45 border-r border-b border-slate-800" />
    </div>
  );
};


// D3 Bar Chart Component
const SubjectPerformanceChart = ({ data, viewType }: { data: any[], viewType: 'Average' | 'Trend' }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 30, right: 30, bottom: 90, left: 50 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const x = d3.scaleBand()
      .domain(viewType === 'Average' ? data.map(d => d.subject) : data.map(d => d.term))
      .range([0, width])
      .padding(0.3);

    const y = d3.scaleLinear()
      .domain([0, 100])
      .range([height, 0]);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Tooltip
    const tooltip = d3.select("body").append("div")
      .attr("class", "d3-tooltip")
      .style("position", "absolute")
      .style("background", "rgba(15, 23, 42, 0.9)")
      .style("color", "#fff")
      .style("padding", "8px 12px")
      .style("border-radius", "6px")
      .style("font-size", "12px")
      .style("font-family", "sans-serif")
      .style("font-weight", "600")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("box-shadow", "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)");

    // X Axis
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).tickSizeOuter(0))
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')
      .attr('dx', '-0.8em')
      .attr('dy', '0.15em')
      .style('font-size', '11px')
      .style('font-family', 'sans-serif')
      .style('color', '#64748b');

    // Y Axis
    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${d}%`))
      .selectAll('text')
      .style('font-size', '11px')
      .style('font-family', 'sans-serif')
      .style('color', '#64748b');
      
    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .style('color', '#f1f5f9')
      .style('stroke-dasharray', '4,4')
      .call(d3.axisLeft(y).tickSize(-width).tickFormat(() => '').ticks(5));

    // Bars
    if (viewType === 'Average') {
      g.selectAll('.bar')
        .data(data)
        .enter().append('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d.subject)!)
        .attr('y', height)
        .attr('width', x.bandwidth())
        .attr('height', 0)
        .attr('fill', '#4f46e5')
        .attr('rx', 4)
        .attr('ry', 4)
        .on('mouseover', function (event, d) {
          d3.select(this).attr('fill', '#4338ca');
          tooltip.transition().duration(200).style('opacity', 1);
          tooltip.html(`${d.subject}<br/><span style="color: #818cf8; font-size: 14px;">${d.average !== null ? d.average + '%' : 'N/A'}</span>`)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 28) + 'px');
        })
        .on('mousemove', function (event) {
          tooltip.style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', function () {
          d3.select(this).attr('fill', '#4f46e5');
          tooltip.transition().duration(300).style('opacity', 0);
        })
        .transition()
        .duration(800)
        .ease(d3.easeCubicOut)
        .attr('y', d => y(d.average ?? 0))
        .attr('height', d => height - y(d.average ?? 0));
    } else {
        const xSub = d3.scaleBand()
            .domain(['highest', 'lowest'])
            .range([0, x.bandwidth()])
            .padding(0.05);

        data.forEach(d => {
            const barGroup = g.append('g')
                .attr('transform', `translate(${x(d.term)!}, 0)`);
            
            barGroup.append('rect')
                .attr('x', xSub('highest')!)
                .attr('y', y(d.highest))
                .attr('width', xSub.bandwidth())
                .attr('height', height - y(d.highest))
                .attr('fill', '#4f46e5')
                .attr('rx', 2);
            
            barGroup.append('rect')
                .attr('x', xSub('lowest')!)
                .attr('y', y(d.lowest))
                .attr('width', xSub.bandwidth())
                .attr('height', height - y(d.lowest))
                .attr('fill', '#f43f5e')
                .attr('rx', 2);
        });
    }

    return () => {
      d3.selectAll('.d3-tooltip').remove();
    };
  }, [data, viewType]);

  return <svg ref={svgRef} width="100%" height="400" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid meet" className="max-w-full" />;
};

interface Props {
  theme: ThemeStyles;
  students: Student[];
  isAutoSave: boolean;
  onManualSave: () => void;
  selectedYear?: AcademicYearType;
  setSelectedYear?: (yr: AcademicYearType) => void;
  selectedTerm?: TermType;
  setSelectedTerm?: (tm: TermType) => void;
  assignedClass?: ClassType | 'None';
  assignedClasses?: ClassType[];
  assignedSubjects?: SubjectType[];
  userRole?: UserRole;
  teacherPermissions?: {
    canEditGrades?: boolean;
    canApproveAttendance?: boolean;
    canExportReports?: boolean;
  } | null;
}

type AssessmentSubMode = 'Worksheet' | 'IndividualReport' | 'Broadsheet' | 'PerformanceAnalytics' | 'StudentStrengthsWeaknesses';

export default function AssessmentTab({ 
  theme, 
  students, 
  isAutoSave, 
  onManualSave,
  selectedYear: propYear,
  setSelectedYear: propSetYear,
  selectedTerm: propTerm,
  setSelectedTerm: propSetTerm,
  assignedClass,
  assignedClasses = [],
  assignedSubjects = [],
  userRole,
  teacherPermissions
}: Props) {
  // Top selector ribbon states
  const [selectedClass, setSelectedClass] = useState<ClassType>(() => {
    if (userRole === 'Teacher') {
      return assignedClasses.length > 0 ? assignedClasses[0] : (assignedClass || 'Basic 1');
    }
    return 'Basic 1';
  });

  useEffect(() => {
    if (userRole === 'Teacher') {
      const target = assignedClasses.length > 0 ? assignedClasses[0] : (assignedClass || 'None');
      if (target !== 'None') {
        setSelectedClass(target as ClassType);
      }
    }
  }, [assignedClass, assignedClasses, userRole]);

  const handlePrintElement = (elementId: string, title: string, isLandscape: boolean = false) => {
    try {
      const element = document.getElementById(elementId);
      if (!element) return;

      const cloned = element.cloneNode(true) as HTMLElement;
      
      const inputs = cloned.querySelectorAll('input');
      inputs.forEach(input => {
        const val = input.value;
        const span = document.createElement('span');
        span.className = 'printed-value';
        span.textContent = val || '0';
        input.parentNode?.replaceChild(span, input);
      });

      const existingFrame = document.getElementById('temp-print-iframe');
      if (existingFrame) {
        existingFrame.remove();
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'temp-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.style.visibility = 'hidden';

      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`
          <html>
            <head>
              <title>${title}</title>
              <style>
                @page {
                  size: A4 ${isLandscape ? 'landscape' : 'portrait'};
                  margin: 8mm;
                }
                body {
                  font-family: 'Inter', system-ui, -apple-system, sans-serif;
                  background-color: white !important;
                  color: black !important;
                  margin: 0;
                  padding: 2mm;
                }
                h2 {
                  margin: 0 0 4px 0;
                  font-size: 14px;
                  text-transform: uppercase;
                  color: #000;
                  font-weight: 800;
                }
                p {
                  margin: 0 0 10px 0;
                  font-size: 10px;
                  color: #334155;
                }
                table {
                  width: 100%;
                  border-collapse: collapse;
                  font-size: ${isLandscape ? '8.5px' : '9.5px'};
                  table-layout: auto;
                }
                th, td {
                  border: 1px solid #94a3b8;
                  padding: 3px 4px;
                  text-align: left;
                  word-break: break-word;
                }
                th {
                  background-color: #f8fafc !important;
                  font-weight: 800;
                  color: #000;
                }
                .text-center {
                  text-align: center;
                }
                .font-bold {
                  font-weight: bold;
                }
                .printed-value {
                  font-family: monospace;
                  font-weight: bold;
                  font-size: 10px;
                }
                /* Handle overflow for extremely wide broadsheets */
                #broadsheet-ledger-table-container, 
                #marks-input-sheet-table-container {
                   width: 100% !important;
                   overflow: visible !important;
                }
                /* Hide any interactive elements that might have been cloned */
                button, .no-print {
                  display: none !important;
                }
              </style>
            </head>
            <body>
              <h2>${title}</h2>
              <p>Class: ${selectedClass} | Term: ${selectedTerm} | Academic Year: ${selectedYear} ${selectedSubject ? `| Subject: ${selectedSubject}` : ''}</p>
              ${cloned.innerHTML}
            </body>
          </html>
        `);
        doc.close();

        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (e) {
            console.error("Iframe print error:", e);
          }
        }, 500);
      }
    } catch (err) {
      console.warn("Print error:", err);
    }
  };

  const handlePdfDownloadElement = async (elementId: string, filename: string, isLandscape: boolean = false) => {
    try {
      const result = await generatePdfFromHtml(elementId, filename, isLandscape);
      downloadBlobLocally(result.blob, result.filename);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Could not generate PDF. Please use the Print button instead.");
    }
  };
  
  const [localYear, setLocalYear] = useState<AcademicYearType>('2026/2027');
  const [localTerm, setLocalTerm] = useState<TermType>('Term 1');

  const selectedYear = propYear || localYear;
  const setSelectedYear = propSetYear || setLocalYear;

  const selectedTerm = propTerm || localTerm;
  const setSelectedTerm = propSetTerm || setLocalTerm;

  const [selectedSubject, setSelectedSubject] = useState<SubjectType>('English Language');
  
  // Navigation states
  const [subMode, setSubMode] = useState<AssessmentSubMode>('Worksheet');
  const [chartView, setChartView] = useState<'Average' | 'Trend'>('Average');
  const [activeWorksheet, setActiveWorksheet] = useState<StudentAssessment[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  
  // Student Trend Visualizer states
  const [trendStudentId, setTrendStudentId] = useState<string>('');
  const [trendSubject, setTrendSubject] = useState<string>('All');
  const [swSubjectFilter, setSwSubjectFilter] = useState<string>('All');
  
  // Heatmap Threshold Benchmark state
  const [heatmapThreshold, setHeatmapThreshold] = useState<number>(60);
  
  // Validation and Data Verification state
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  // Custom Template states
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateMode, setTemplateMode] = useState<'Default' | 'Custom'>('Default');
  const [customComponents, setCustomComponents] = useState<{name: string, maxScore: number}[]>([{name: 'Assignment', maxScore: 20}, {name: 'Midterm', maxScore: 30}]);
  
  // Save feedback states
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState('');
  const [reportCardPreviewMode, setReportCardPreviewMode] = useState(false);
  const [bulkReportMode, setBulkReportMode] = useState(false);
  const [worksheetPreviewMode, setWorksheetPreviewMode] = useState(false);
  const [broadsheetPreviewMode, setBroadsheetPreviewMode] = useState(false);
  const [performancePreviewMode, setPerformancePreviewMode] = useState(false);
  const [showPreviewPane, setShowPreviewPane] = useState(true);
  const [pdfFloatingMinimized, setPdfFloatingMinimized] = useState(false);

  // Parental SMS Integration states
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [smsGuardianName, setSmsGuardianName] = useState('');
  const [smsGuardianPhone, setSmsGuardianPhone] = useState('');
  const [smsCustomMessage, setSmsCustomMessage] = useState('');
  const [sendingSms, setSendingSms] = useState(false);
  const [smsSuccessMessage, setSmsSuccessMessage] = useState<string | null>(null);
  const [smsSentLogs, setSmsSentLogs] = useState<any[]>([]);

  // Bulk SMS Report Card states
  const [finalizedGradesMap, setFinalizedGradesMap] = useState<Record<string, boolean>>({});
  const [selectedStudentsToNotify, setSelectedStudentsToNotify] = useState<Record<string, boolean>>({});
  const [bulkSmsCustomMessage, setBulkSmsCustomMessage] = useState(
    "Hello [Parent], the official Term Report Card for [Student] ([ID]) is now finalized and ready. View the full secure digital report, grade metrics, and ledger statements here: [Link]"
  );
  const [isBroadcastingSms, setIsBroadcastingSms] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState(0);
  const [broadcastResults, setBroadcastResults] = useState<Record<string, { status: 'idle' | 'sending' | 'success' | 'error'; error?: string }>>({});

  // Custom Confirmation Dialog State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const [reopeningDate, setReopeningDate] = useState<string>('');

  // Hydrate local storage states on mount to ensure clean rendering sequence
  useEffect(() => {
    try {
      setSmsSentLogs(getStorageItem('sms_assessment_sent_logs', []));
      setFinalizedGradesMap(getStorageItem('geetech_finalized_grades_map', {}));
      setReopeningDate(DbController.getSchoolInfo().reopeningDate || '');
    } catch (e) {
      console.error("Failed to hydrate states in AssessmentTab:", e);
    }
  }, []);

  const handleReopeningDateChange = (newDate: string) => {
    setReopeningDate(newDate);
    const info = DbController.getSchoolInfo();
    const updated = { ...info, reopeningDate: newDate };
    DbController.saveSchoolInfo(updated);
    if (isAutoSave) {
      setSaveFeedback('Auto-saved next term reopening date.');
      setTimeout(() => setSaveFeedback(''), 1550);
    } else {
      onManualSave();
    }
  };

  const formatReopeningDate = (dateStr?: string): string => {
    if (!dateStr) return 'Not Configured';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      try {
        const date = new Date(dateStr + 'T00:00:00');
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        }
      } catch {
        // fallback
      }
    }
    return dateStr;
  };

  const compileSmsMessage = (templateText: string, studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return templateText;
    const token = generateSecureToken(student.id, selectedYear, selectedTerm);
    const parentUrl = `${window.location.origin}/?studentId=${student.id}&year=${encodeURIComponent(selectedYear)}&term=${encodeURIComponent(selectedTerm)}&token=${token}`;
    
    return templateText
      .replace(/{guardianName}/g, student.guardianName || 'Guardian')
      .replace(/{firstName}/g, student.firstName || '')
      .replace(/{lastName}/g, student.lastName || '')
      .replace(/{studentId}/g, student.id)
      .replace(/{reportLink}/g, parentUrl);
  };

  const compileRandomSmsMessage = (templateText: string) => {
    return templateText
      .replace(/{guardianName}/g, 'Abigail Owusu')
      .replace(/{firstName}/g, 'Emmanuel')
      .replace(/{lastName}/g, 'Mensah')
      .replace(/{studentId}/g, 'STU-8821-XP')
      .replace(/{reportLink}/g, 'https://geetech.edu/portal?id=demo&token=secure_example');
  };

  const compileRandomBulkSmsMessage = (templateText: string) => {
    return templateText
      .replace(/\[Parent\]/gi, 'Abigail Owusu')
      .replace(/\[Guardian\]/gi, 'Abigail Owusu')
      .replace(/\[Student\]/gi, 'Emmanuel Mensah')
      .replace(/\[ID\]/gi, 'STU-8821-XP')
      .replace(/\[Link\]/gi, 'https://geetech.edu/portal?id=demo&token=secure_example');
  };

  const triggerSmsModal = () => {
    const student = students.find(s => s.id === selectedStudentId);
    if (student) {
      setSmsGuardianName(student.guardianName || `${student.firstName} ${student.lastName} Parent`);
      setSmsGuardianPhone(student.guardianTelephone || '');
      setSmsCustomMessage(`Hello {guardianName}, the official Term Report Card for {firstName} {lastName} ({studentId}) is now ready. Click here to securely view/download the full report, grades, and fee statement anytime: {reportLink}`);
      setSmsSuccessMessage(null);
      setSmsModalOpen(true);
    }
  };

  const handleSendSMS = async () => {
    if (!smsGuardianPhone) return;
    setSendingSms(true);
    setSmsSuccessMessage(null);

    // Load Twilio config from database first, fallback to localStorage
    const school = DbController.getSchoolInfo();
    let twilioConfig = {
      accountSid: school.twilioAccountSid || '',
      authToken: school.twilioAuthToken || '',
      fromNumber: school.twilioFromNumber || '',
      enabled: school.twilioEnabled || false
    };
    if (!twilioConfig.accountSid) {
      const parsed = getStorageItem<any>('geetech_twilio_config', null);
      if (parsed) {
        twilioConfig.accountSid = parsed.accountSid || '';
        twilioConfig.authToken = parsed.authToken || '';
        twilioConfig.fromNumber = parsed.fromNumber || '';
        twilioConfig.enabled = parsed.enabled || false;
      }
    }

    let isRealSuccess = true;
    let errDetail = '';

    if (twilioConfig.enabled) {
      try {
        const res = await fetch('/api/communications/send-sms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: smsGuardianPhone.trim(),
            body: compileSmsMessage(smsCustomMessage, selectedStudentId)
          })
        });

        if (!res.ok) {
          const parsed = await res.json();
          isRealSuccess = false;
          errDetail = parsed.message || `HTTP ${res.status}`;
        }
      } catch (err: any) {
        isRealSuccess = false;
        errDetail = err.message || 'Server connection failed';
      }
    } else {
      // Simulate delivery success for mocking
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!isRealSuccess) {
      setSendingSms(false);
      alert(`Twilio API Gateway Error: ${errDetail}. Please verify credentials in Systems controls or dispatch via the 'Native SMS App' button.`);
      return;
    }

    const newLog = {
      id: `SMS_${Date.now()}`,
      studentId: selectedStudentId,
      studentName: students.find(s => s.id === selectedStudentId)?.firstName + " " + students.find(s => s.id === selectedStudentId)?.lastName,
      recipientName: smsGuardianName,
      phoneNumber: smsGuardianPhone,
      message: compileSmsMessage(smsCustomMessage, selectedStudentId),
      timestamp: new Date().toISOString(),
      status: 'Delivered'
    };

    const updatedLogs = [newLog, ...smsSentLogs];
    setSmsSentLogs(updatedLogs);
    setStorageItem('sms_assessment_sent_logs', updatedLogs);

    // Auto-update student telephone if it was blank or edited
    const studentIndex = students.findIndex(s => s.id === selectedStudentId);
    if (studentIndex !== -1 && students[studentIndex].guardianTelephone !== smsGuardianPhone) {
      try {
        const student = students[studentIndex];
        const updatedStudent = {
          ...student,
          guardianName: smsGuardianName,
          guardianTelephone: smsGuardianPhone
        };
        await DbController.saveStudent(updatedStudent);
        // Explicitly sync back to DB to ensure persistence
        if (navigator.onLine) {
          DbController.syncAllDataFromFirebase().catch(e => console.warn(e));
        }
      } catch (err) {
        console.warn("Failed to auto-save updated parent contact info:", err);
      }
    }

    setSendingSms(false);
    setSmsSuccessMessage(`Successfully dispatched automated secure portal SMS to ${smsGuardianName} (${smsGuardianPhone})!`);
  };

  const currentFinalizedKey = `${selectedClass}_${selectedYear}_${selectedTerm}`;
  const isCurrentGradesFinalized = !!finalizedGradesMap[currentFinalizedKey];

  const handleToggleFinalizeGrades = () => {
    const nextStatus = !isCurrentGradesFinalized;
    const updated = {
      ...finalizedGradesMap,
      [currentFinalizedKey]: nextStatus
    };
    setFinalizedGradesMap(updated);
    setStorageItem('geetech_finalized_grades_map', updated);

    // Add activity log
    const userName = DbController.getCurrentUser()?.name || 'Administrator';
    DbController.writeActivityLog(
      nextStatus ? 'Finalized Grades' : 'Unlocked Grades',
      `${userName} ${nextStatus ? 'finalized and locked' : 'unlocked and reverted to draft'} grades for ${selectedClass} | ${selectedTerm} (${selectedYear})`,
      'medium'
    );

    // Initialize all students of this class to checked by default when finalizing
    if (nextStatus) {
      const classStds = students.filter(s => s.class === selectedClass);
      const initialChecked: Record<string, boolean> = {};
      classStds.forEach(s => {
        if (s.guardianTelephone) {
          initialChecked[s.id] = true;
        }
      });
      setSelectedStudentsToNotify(initialChecked);
    }

    alert(
      nextStatus 
        ? `Successfully finalized and locked grades for ${selectedClass} (${selectedTerm}, ${selectedYear}). Parent notification broadcasting is now available!`
        : `Grades for ${selectedClass} (${selectedTerm}, ${selectedYear}) unlocked and reverted to draft.`
    );
  };

  const handleBroadcastReportCardSms = async () => {
    const studentIdsToNotify = Object.keys(selectedStudentsToNotify).filter(id => selectedStudentsToNotify[id]);
    
    if (studentIdsToNotify.length === 0) {
      alert("Please select at least one student's parent to notify.");
      return;
    }

    if (!window.confirm(`Are you sure you want to broadcast 'report card ready' SMS to ${studentIdsToNotify.length} registered parents?`)) {
      return;
    }

    setIsBroadcastingSms(true);
    setBroadcastProgress(0);

    const initialResults: Record<string, { status: 'idle' | 'sending' | 'success' | 'error'; error?: string }> = {};
    studentIdsToNotify.forEach(id => {
      initialResults[id] = { status: 'sending' };
    });
    setBroadcastResults(initialResults);

    const school = DbController.getSchoolInfo();
    let twilioConfig = {
      accountSid: school.twilioAccountSid || '',
      authToken: school.twilioAuthToken || '',
      fromNumber: school.twilioFromNumber || '',
      enabled: school.twilioEnabled || false
    };

    if (!twilioConfig.accountSid) {
      const parsed = getStorageItem<any>('geetech_twilio_config', null);
      if (parsed) {
        twilioConfig.accountSid = parsed.accountSid || '';
        twilioConfig.authToken = parsed.authToken || '';
        twilioConfig.fromNumber = parsed.fromNumber || '';
        twilioConfig.enabled = parsed.enabled || false;
      }
    }

    let successCount = 0;
    let failureCount = 0;
    const newLogs: any[] = [];

    for (let i = 0; i < studentIdsToNotify.length; i++) {
      const studentId = studentIdsToNotify[i];
      const student = students.find(s => s.id === studentId);
      if (!student) continue;

      const token = generateSecureToken(student.id, selectedYear, selectedTerm);
      const parentUrl = `${window.location.origin}/?studentId=${student.id}&year=${encodeURIComponent(selectedYear)}&term=${encodeURIComponent(selectedTerm)}&token=${token}`;
      
      const parentName = student.guardianName || `${student.firstName} ${student.lastName} Parent`;
      const phoneNumber = student.guardianTelephone || '';

      if (!phoneNumber) {
        setBroadcastResults(prev => ({
          ...prev,
          [studentId]: { status: 'error', error: 'Missing phone number' }
        }));
        failureCount++;
        setBroadcastProgress(Math.round(((i + 1) / studentIdsToNotify.length) * 100));
        continue;
      }

      let messageText = bulkSmsCustomMessage
        .replace(/\[Parent\]/gi, parentName)
        .replace(/\[Guardian\]/gi, parentName)
        .replace(/\[Student\]/gi, `${student.firstName} ${student.lastName}`)
        .replace(/\[ID\]/gi, student.id)
        .replace(/\[Link\]/gi, parentUrl);

      let isSuccess = true;
      let errorDetail = '';

      if (twilioConfig.enabled) {
        try {
          const res = await fetch('/api/communications/send-sms', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              to: phoneNumber.trim(),
              body: messageText
            })
          });

          if (!res.ok) {
            const parsed = await res.json();
            isSuccess = false;
            errorDetail = parsed.message || `HTTP ${res.status}`;
          }
        } catch (err: any) {
          isSuccess = false;
          errorDetail = err.message || 'Server connection failed';
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      if (isSuccess) {
        setBroadcastResults(prev => ({
          ...prev,
          [studentId]: { status: 'success' }
        }));
        successCount++;

        const logRecord = {
          id: `SMS_BULK_${Date.now()}_${studentId}`,
          studentId: studentId,
          studentName: `${student.firstName} ${student.lastName}`,
          recipientName: parentName,
          phoneNumber: phoneNumber,
          message: messageText,
          timestamp: new Date().toISOString(),
          status: 'Delivered'
        };
        newLogs.push(logRecord);
      } else {
        setBroadcastResults(prev => ({
          ...prev,
          [studentId]: { status: 'error', error: errorDetail }
        }));
        failureCount++;
      }

      setBroadcastProgress(Math.round(((i + 1) / studentIdsToNotify.length) * 100));
    }

    if (newLogs.length > 0) {
      const updatedLogs = [...newLogs, ...smsSentLogs];
      setSmsSentLogs(updatedLogs);
      setStorageItem('sms_assessment_sent_logs', updatedLogs);
    }

    setIsBroadcastingSms(false);
    
    const userName = DbController.getCurrentUser()?.name || 'Administrator';
    DbController.writeActivityLog(
      'Broadcast SMS Notifications',
      `${userName} broadcasted report cards via Twilio SMS for ${selectedClass}: ${successCount} successful, ${failureCount} failed.`,
      'medium'
    );

    alert(`Broadcast completed!\n\nSuccessful transmissions: ${successCount}\nFailed transmissions: ${failureCount}`);
  };

  // Fetch or construct worksheet records whenever filters update!
  useEffect(() => {
    const sheet = DbController.getAssessmentsSheet(selectedClass, selectedYear, selectedTerm, selectedSubject);
    setActiveWorksheet(sheet);
    setUnsavedChanges(false);
    
    // Set first student as default individual report target if none is active
    const classStd = students.filter(s => s.class === selectedClass);
    if (classStd.length > 0 && !selectedStudentId) {
      setSelectedStudentId(classStd[0].id);
    }
  }, [selectedClass, selectedYear, selectedTerm, selectedSubject, students]);

  // Set default student if search changes
  useEffect(() => {
    const classStd = students.filter(s => s.class === selectedClass);
    if (classStd.length > 0 && (!selectedStudentId || !classStd.some(s => s.id === selectedStudentId))) {
      setSelectedStudentId(classStd[0].id);
    }
  }, [selectedClass]);

  // Restricts data inputs precisely to required decimal bounds:
  // e.g. Exercises: 0-10, Tests: 0-20, Projects/Groups: 0-10, Exams: 0-100
  const handleScoreInput = (
    studentId: string, 
    field: 'exercises' | 'tests' | 'projectWork' | 'groupWork' | 'examScore100' | 'customAssessments', 
    index: number, 
    valueStr: string
  ) => {
    if (teacherPermissions?.canEditGrades === false) {
      alert("Permission to edit grades has been suspended by the Headteacher.");
      return;
    }
    const valueNum = valueStr === '' ? 0 : parseFloat(valueStr);
    
    // Define boundary checks according to prompt constraints:
    let maxLimit = 10;
    if (field === 'tests') maxLimit = 20;
    if (field === 'examScore100') maxLimit = 100;
    if (field === 'customAssessments') {
      const tmpl = DbController.getAssessmentTemplate(selectedClass, selectedYear, selectedTerm, selectedSubject);
      if (tmpl && tmpl.components[index]) {
        maxLimit = tmpl.components[index].maxScore;
      } else {
        maxLimit = 100;
      }
    }

    // Data Verification Logic: Flag if marks exceed defined subject limit
    const errorKey = `${studentId}-${field}-${index}`;
    if (valueNum > maxLimit) {
      setValidationErrors(prev => ({
        ...prev,
        [errorKey]: `Mark (${valueNum}) exceeds subject limit (${maxLimit})`
      }));
    } else {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[errorKey];
        return next;
      });
    }

    // Verification Logic: Check for duplicate entries for the same student in this term across the active worksheet
    // (Though worksheet is per subject, this hook can check for consistency)
    const studentRecords = activeWorksheet.filter(r => r.studentId === studentId);
    if (studentRecords.length > 1) {
       setValidationErrors(prev => ({
         ...prev,
         [`duplicate-${studentId}`]: `Warning: Duplicate entries detected for student ID ${studentId} in current worksheet.`
       }));
    }

    // Reject or clamp values outside boundaries
    const boundValue = Math.min(maxLimit, Math.max(0, valueNum));

    // Update state worksheet
    const updated = activeWorksheet.map(row => {
      if (row.studentId === studentId) {
        let updatedRow = { ...row };
        if (field === 'exercises') {
          const exps = [...row.exercises];
          exps[index] = boundValue;
          updatedRow.exercises = exps;
        } else if (field === 'tests') {
          const tsts = [...row.tests];
          tsts[index] = boundValue;
          updatedRow.tests = tsts;
        } else if (field === 'customAssessments') {
          const csts = [...(row.customAssessments || [])];
          csts[index] = boundValue;
          updatedRow.customAssessments = csts;
        } else if (field === 'projectWork') {
          updatedRow.projectWork = boundValue;
        } else if (field === 'groupWork') {
          updatedRow.groupWork = boundValue;
        } else if (field === 'examScore100') {
          updatedRow.examScore100 = boundValue;
        }

        // Dynamically compute class totals and 50% ratios on-the-fly!
        const tmpl = DbController.getAssessmentTemplate(selectedClass, selectedYear, selectedTerm, selectedSubject);
        return DbController.calculateScoreDetails(updatedRow, tmpl);
      }
      return row;
    });

    const ranked = DbController.calculatePositions(updated);
    setActiveWorksheet(ranked);
    setUnsavedChanges(true);

    if (isAutoSave) {
      DbController.saveAssessmentsSheet(ranked);
      setUnsavedChanges(false);
      setSaveFeedback('Auto-saved changes!');
      setTimeout(() => setSaveFeedback(''), 1500);
    }
  };

  const handleManualSave = () => {
    DbController.saveAssessmentsSheet(activeWorksheet);
    onManualSave();
    setUnsavedChanges(false);
    setSaveFeedback('Gradesheet successfully saved!');
    setTimeout(() => setSaveFeedback(''), 3500);
  };

  const handleClearInputs = () => {
    if (teacherPermissions?.canEditGrades === false) {
      alert("Permission to edit grades has been suspended by the Headteacher.");
      return;
    }
    const cleared = activeWorksheet.map(row => {
      const resetRow = {
        ...row,
        exercises: [0, 0, 0, 0],
        tests: [0, 0],
        projectWork: 0,
        groupWork: 0,
        examScore100: 0,
        classScoreTotal: 0,
        classScore50: 0,
        examScore50: 0,
        totalScore: 0,
        gradeLevel: 'L5' as const,
        remarks: 'Emerging',
        position: undefined
      };
      return DbController.calculateScoreDetails(resetRow);
    });
    
    const ranked = DbController.calculatePositions(cleared);
    setActiveWorksheet(ranked);
    setUnsavedChanges(true);
    if (isAutoSave) {
      DbController.saveAssessmentsSheet(ranked);
      setUnsavedChanges(false);
    }
    alert("Resetted active gradesheet assessment scores to zero values.");
  };

  const handleDeleteActiveSelection = () => {
    if (teacherPermissions?.canEditGrades === false) {
      alert("Permission to edit grades has been suspended by the Headteacher.");
      return;
    }
    if (selectedStudentId) {
      const targetStu = students.find(s => s.id === selectedStudentId);
      const studentName = targetStu ? `${targetStu.firstName} ${targetStu.lastName}` : "the currently selected student";
      setConfirmModal({
        isOpen: true,
        title: "Reset & Delete Student Grades?",
        message: `Are you sure you want to reset and delete grades for ${studentName}? This will reset all exercises, tests, project work, and exams to zero score values.`,
        confirmText: "Reset Grades",
        danger: true,
        onConfirm: () => {
          const cleared = activeWorksheet.map(row => {
            if (row.studentId === selectedStudentId) {
              const resetRow = {
                ...row,
                exercises: [0, 0, 0, 0],
                tests: [0, 0],
                projectWork: 0,
                groupWork: 0,
                examScore100: 0,
                classScoreTotal: 0,
                classScore50: 0,
                examScore50: 0,
                totalScore: 0,
                gradeLevel: 'L5' as const,
                remarks: 'Emerging',
                position: undefined
              };
              return DbController.calculateScoreDetails(resetRow);
            }
            return row;
          });

          const ranked = DbController.calculatePositions(cleared);
          setActiveWorksheet(ranked);
          setUnsavedChanges(true);
          if (isAutoSave) {
            DbController.saveAssessmentsSheet(ranked);
            setUnsavedChanges(false);
          }
          alert("Grades deleted and reset for the selected student.");
        }
      });
    } else {
      alert("Please select a student first in the worksheet or individual report view.");
    }
  };

  const handleDeleteAllAssessments = () => {
    setConfirmModal({
      isOpen: true,
      title: "CRITICAL: Purge All Assessments?",
      message: "Are you sure you want to completely delete all historical Class Assessments from the entire database? This action is permanent and cannot be undone.",
      confirmText: "Wipe Assessments",
      danger: true,
      onConfirm: () => {
        DbController.clearAllAssessments();
        setActiveWorksheet([]);
        onManualSave();
        alert("Successfully purged all recorded class assessments from database.");
      }
    });
  };

  const handleExportAllAssessmentsCSV = () => {
    const allAssessments = DbController.getAssessments();
    
    if (allAssessments.length === 0) {
      alert("No assessment records found in the database to export.");
      return;
    }

    const headers = [
      'Assessment ID', 'Student ID', 'Student Name', 'Class', 'Academic Year', 'Term', 'Subject',
      'Exercise 1', 'Exercise 2', 'Exercise 3', 'Exercise 4',
      'Test 1', 'Test 2', 'Project Work', 'Group Work',
      'Class Score Total', 'Class Score 50%', 'Exam Score 100', 'Exam Score 50%',
      'Total Score (0-100)', 'Grade Level', 'Remarks', 'Class Position', 'Teacher Remarks'
    ];
    
    const csvRows = [headers.join(',')];
    
    for (const record of allAssessments) {
      const ex1 = record.exercises && record.exercises[0] !== undefined ? record.exercises[0] : '';
      const ex2 = record.exercises && record.exercises[1] !== undefined ? record.exercises[1] : '';
      const ex3 = record.exercises && record.exercises[2] !== undefined ? record.exercises[2] : '';
      const ex4 = record.exercises && record.exercises[3] !== undefined ? record.exercises[3] : '';
      
      const t1 = record.tests && record.tests[0] !== undefined ? record.tests[0] : '';
      const t2 = record.tests && record.tests[1] !== undefined ? record.tests[1] : '';

      const values = [
        record.id,
        record.studentId,
        record.studentName,
        record.class,
        record.academicYear,
        record.term,
        record.subject,
        ex1,
        ex2,
        ex3,
        ex4,
        t1,
        t2,
        record.projectWork !== undefined ? record.projectWork : '',
        record.groupWork !== undefined ? record.groupWork : '',
        record.classScoreTotal !== undefined ? record.classScoreTotal : '',
        record.classScore50 !== undefined ? record.classScore50 : '',
        record.examScore100 !== undefined ? record.examScore100 : '',
        record.examScore50 !== undefined ? record.examScore50 : '',
        record.totalScore !== undefined ? record.totalScore : '',
        record.gradeLevel || '',
        record.remarks || '',
        record.position !== undefined ? record.position : '',
        record.teacherRemarks || ''
      ].map(val => {
        const escaped = ('' + (val ?? '')).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }
    
    const blob = new Blob([csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `all_student_assessments_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [printBlocked, setPrintBlocked] = useState(false);
  const [showPdfGuide, setShowPdfGuide] = useState(false);
  const [showPrintPreviewModal, setShowPrintPreviewModal] = useState(false);
  
  // Interactive Verification Checklist States
  const [checklistStudent, setChecklistStudent] = useState(false);
  const [checklistGrades, setChecklistGrades] = useState(false);
  const [checklistRemarks, setChecklistRemarks] = useState(false);
  const [checklistFinances, setChecklistFinances] = useState(false);

  // A4 Layout & Theme Preferences
  const [previewOrientation, setPreviewOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [previewThemePreset, setPreviewThemePreset] = useState<'vivid' | 'charcoal' | 'grayscale'>('vivid');
  const [previewMarginSize, setPreviewMarginSize] = useState<'normal' | 'narrow' | 'none'>('normal');

  const handlePrint = () => {
    // Reset checklists for the new verification run
    setChecklistStudent(false);
    setChecklistGrades(false);
    setChecklistRemarks(false);
    setChecklistFinances(false);
    setShowPrintPreviewModal(true);
  };

  const executeNativePrint = () => {
    setShowPrintPreviewModal(false);
    DbController.writeActivityLog('Print Report Generated', `Printed individual report card for student ID ${selectedStudentId} (Class: ${selectedClass}).`, 'low');
    setTimeout(() => {
      try {
        window.print();
      } catch (e) {
        console.warn("Direct print restricted inside sandbox iframe:", e);
        setPrintBlocked(true);
      }
    }, 200);
  };

  // Compute individual student report card metrics across all subjects
  const compiledReport = useMemo(() => {
    if (!selectedStudentId) return null;
    return DbController.getStudentTermReportCard(selectedStudentId, selectedYear, selectedTerm);
  }, [selectedStudentId, selectedYear, selectedTerm, activeWorksheet]);

  // Compute student financial outstanding balance and next term plan
  const studentFinancials = useMemo(() => {
    if (!selectedStudentId) return null;
    const bills = DbController.getStudentFeeBills();
    
    // Find current bill
    const currentBill = bills.find(b => b.studentId === selectedStudentId && b.academicYear === selectedYear && b.term === selectedTerm);
    const currentExpected = currentBill 
      ? (currentBill.schoolFees + currentBill.utilityBill + currentBill.sportsFees + currentBill.ptaDues + (currentBill.transportationBill || 0) + currentBill.otherFee)
      : 0;
    const currentPaid = currentBill
      ? currentBill.payments.reduce((sum, p) => sum + p.amount, 0)
      : 0;
    const currentOutstanding = currentExpected - currentPaid;

    // Find all previous bills to compute cumulative arrears
    const allPreviousBills = bills.filter(b => {
      if (b.studentId !== selectedStudentId) return false;
      
      const currentSortValue = parseInt(selectedYear.split('/')[0], 10) * 10 + parseInt(selectedTerm.replace(/\D/g, ''), 10);
      const bSortValue = parseInt(b.academicYear.split('/')[0], 10) * 10 + parseInt(b.term.replace(/\D/g, ''), 10);
      return bSortValue < currentSortValue;
    });
    
    let previousOutstanding = 0;
    allPreviousBills.forEach(pb => {
      const pExp = pb.schoolFees + pb.utilityBill + pb.sportsFees + pb.ptaDues + (pb.transportationBill || 0) + pb.otherFee;
      const pPaid = pb.payments.reduce((sum, p) => sum + p.amount, 0);
      previousOutstanding += Math.max(0, pExp - pPaid);
    });

    const totalOutstanding = currentOutstanding + previousOutstanding;

    // Determine next term term and year
    let nextTerm: TermType = 'Term 1';
    let nextYear = selectedYear;

    if (selectedTerm === 'Term 1') {
      nextTerm = 'Term 2';
    } else if (selectedTerm === 'Term 2') {
      nextTerm = 'Term 3';
    } else {
      nextTerm = 'Term 1';
      const parts = selectedYear.split('/');
      if (parts.length === 2) {
        const y1 = parseInt(parts[0], 10);
        const y2 = parseInt(parts[1], 10);
        if (!isNaN(y1) && !isNaN(y2)) {
          nextYear = `${y1 + 1}/${y2 + 1}`;
        }
      }
    }

    // Find next term bill
    const nextTermBillObj = bills.find(b => b.studentId === selectedStudentId && b.academicYear === nextYear && b.term === nextTerm);
    let nextTermBillSum = 0;
    let isEstimated = false;

    if (nextTermBillObj) {
      nextTermBillSum = nextTermBillObj.schoolFees + nextTermBillObj.utilityBill + nextTermBillObj.sportsFees + nextTermBillObj.ptaDues + (nextTermBillObj.transportationBill || 0) + nextTermBillObj.otherFee;
    } else {
      nextTermBillSum = currentExpected;
      isEstimated = true;
    }

    return {
      currentTermBill: currentExpected,
      currentTermPaid: currentPaid,
      currentOutstanding,
      previousOutstanding,
      totalOutstanding,
      nextTerm,
      nextYear,
      nextTermBillSum,
      isEstimated
    };
  }, [selectedStudentId, selectedYear, selectedTerm]);

  // Compute bulk class report cards for all students in selected class
  const bulkClassReports = useMemo(() => {
    const classStudents = students.filter(s => s.class === selectedClass);
    const bills = DbController.getStudentFeeBills();

    return classStudents.map(student => {
      const report = DbController.getStudentTermReportCard(student.id, selectedYear, selectedTerm);
      
      // Calculate financials for this student
      const currentBill = bills.find(b => b.studentId === student.id && b.academicYear === selectedYear && b.term === selectedTerm);
      const currentExpected = currentBill 
        ? (currentBill.schoolFees + currentBill.utilityBill + currentBill.sportsFees + currentBill.ptaDues + (currentBill.transportationBill || 0) + currentBill.otherFee)
        : 0;
      const currentPaid = currentBill
        ? currentBill.payments.reduce((sum, p) => sum + p.amount, 0)
        : 0;
      const currentOutstanding = currentExpected - currentPaid;

      const allPreviousBills = bills.filter(b => {
        if (b.studentId !== student.id) return false;
        const currentSortValue = parseInt(selectedYear.split('/')[0], 10) * 10 + parseInt(selectedTerm.replace(/\D/g, ''), 10);
        const bSortValue = parseInt(b.academicYear.split('/')[0], 10) * 10 + parseInt(b.term.replace(/\D/g, ''), 10);
        return bSortValue < currentSortValue;
      });
      
      let previousOutstanding = 0;
      allPreviousBills.forEach(pb => {
        const pExp = pb.schoolFees + pb.utilityBill + pb.sportsFees + pb.ptaDues + (pb.transportationBill || 0) + pb.otherFee;
        const pPaid = pb.payments.reduce((sum, p) => sum + p.amount, 0);
        previousOutstanding += Math.max(0, pExp - pPaid);
      });

      const totalOutstanding = currentOutstanding + previousOutstanding;

      let nextTerm: TermType = 'Term 1';
      let nextYear = selectedYear;

      if (selectedTerm === 'Term 1') {
        nextTerm = 'Term 2';
      } else if (selectedTerm === 'Term 2') {
        nextTerm = 'Term 3';
      } else {
        nextTerm = 'Term 1';
        const parts = selectedYear.split('/');
        if (parts.length === 2) {
          const y1 = parseInt(parts[0], 10);
          const y2 = parseInt(parts[1], 10);
          if (!isNaN(y1) && !isNaN(y2)) {
            nextYear = `${y1 + 1}/${y2 + 1}`;
          }
        }
      }

      const nextTermBillObj = bills.find(b => b.studentId === student.id && b.academicYear === nextYear && b.term === nextTerm);
      let nextTermBillSum = 0;
      let isEstimated = false;

      if (nextTermBillObj) {
        nextTermBillSum = nextTermBillObj.schoolFees + nextTermBillObj.utilityBill + nextTermBillObj.sportsFees + nextTermBillObj.ptaDues + (nextTermBillObj.transportationBill || 0) + nextTermBillObj.otherFee;
      } else {
        nextTermBillSum = currentExpected;
        isEstimated = true;
      }

      const financials = {
        currentTermBill: currentExpected,
        currentTermPaid: currentPaid,
        currentOutstanding,
        previousOutstanding,
        totalOutstanding,
        nextTerm,
        nextYear,
        nextTermBillSum,
        isEstimated
      };

      return {
        student,
        report,
        financials
      };
    });
  }, [students, selectedClass, selectedYear, selectedTerm, activeWorksheet]);

  // Compute broad sheet showing student ranks and score aggregates across key subjects
  const broadsheetData = useMemo(() => {
    const classStudents = students.filter(s => s.class === selectedClass);
    const allAssessments = DbController.getAssessments();
    
    // Index assessments by studentId for O(1) lookup during mapping
    const assessmentsByStudent = new Map<string, StudentAssessment[]>();
    allAssessments.forEach(a => {
      if (a.academicYear === selectedYear && a.term === selectedTerm) {
        if (!assessmentsByStudent.has(a.studentId)) {
          assessmentsByStudent.set(a.studentId, []);
        }
        assessmentsByStudent.get(a.studentId)!.push(a);
      }
    });

    return classStudents.map(st => {
      const studentGrades = assessmentsByStudent.get(st.id) || [];

      // Maps subjects into an easy dictionary lookup
      const subjectScores: Record<string, number> = {};
      studentGrades.forEach(g => {
        subjectScores[g.subject] = g.totalScore;
      });

      const totalOverallScore = studentGrades.reduce((sum, g) => sum + g.totalScore, 0);
      const subjectsCount = studentGrades.length;
      const averageOverallScore = subjectsCount > 0 
        ? parseFloat((totalOverallScore / subjectsCount).toFixed(2)) 
        : 0;

      return {
        student: st,
        subjectScores,
        subjectsCount,
        totalOverallScore,
        averageOverallScore
      };
    }).sort((a, b) => b.averageOverallScore - a.averageOverallScore); // Sort descending
  }, [students, selectedClass, selectedYear, selectedTerm, activeWorksheet]);

  // Helper to check if a student has any actual grades entered in this sheet
  const isAssessmentGraded = (w: StudentAssessment) => {
    return (
      (w.exercises && w.exercises.some(e => e > 0)) || 
      (w.tests && w.tests.some(t => t > 0)) || 
      w.projectWork > 0 || 
      w.groupWork > 0 || 
      w.examScore100 > 0
    );
  };

  // GES Class Remarks Breakdown stats for charts
  const gradeLevelsStats = useMemo(() => {
    const stats = { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0 };
    const gradedList = activeWorksheet.filter(isAssessmentGraded);
    
    gradedList.forEach(w => {
      const level = (w.gradeLevel || 'L5').toUpperCase();
      if (level === 'L1') stats.L1++;
      else if (level === 'L2') stats.L2++;
      else if (level === 'L3') stats.L3++;
      else if (level === 'L4') stats.L4++;
      else stats.L5++;
    });

    return [
      { name: 'Highly Proficient (L1)', value: stats.L1, fill: '#10b981' },
      { name: 'Proficient (L2)', value: stats.L2, fill: '#3b82f6' },
      { name: 'Approaching (L3)', value: stats.L3, fill: '#f59e0b' },
      { name: 'Developing (L4)', value: stats.L4, fill: '#6366f1' },
      { name: 'Emerging (L5)', value: stats.L5, fill: '#ef4444' }
    ];
  }, [activeWorksheet]);

  // Dynamic real-time performance KPI metrics calculated efficiently
  const classPerformanceDetails = useMemo(() => {
    const gradedList = activeWorksheet.filter(isAssessmentGraded);
    
    if (gradedList.length === 0) {
      return { avgScore: 0, passRate: 0, highestScore: 0, lowestScore: 0, gradedCount: 0 };
    }
    const scores = gradedList.map(w => w.totalScore);
    const sum = scores.reduce((a, b) => a + b, 0);
    const avgScore = parseFloat((sum / gradedList.length).toFixed(1));
    const passCount = gradedList.filter(w => w.totalScore >= 50).length;
    const passRate = parseFloat(((passCount / gradedList.length) * 100).toFixed(1));
    const highestScore = Math.max(...scores);
    const lowestScore = Math.min(...scores);

    return { avgScore, passRate, highestScore, lowestScore, gradedCount: gradedList.length };
  }, [activeWorksheet]);

  // Academic Remediation Tracker for fragile cognitive status (< 54%)
  const remediationAlerts = useMemo(() => {
    const gradedList = activeWorksheet.filter(isAssessmentGraded);
    return gradedList
      .filter(w => w.totalScore < 54)
      .map(w => {
        const student = students.find(s => s.id === w.studentId);
        let actionPlan = "Schedule core academic remediation sessions and structured peer tutoring.";
        if (w.gradeLevel === 'L5') {
          actionPlan = "Critical support warning: Guardians should be phoned. Mandatory 1-to-1 staff diagnostic remediation recommended.";
        } else if (w.gradeLevel === 'L4') {
          actionPlan = "Fragile outcome: Deploy custom student homework worksheet study guide and seat re-arrangement.";
        }
        return {
          student,
          score: w.totalScore,
          gradeLevel: w.gradeLevel,
          actionPlan
        };
      })
      .sort((a, b) => a.score - b.score);
  }, [activeWorksheet, students]);

  // Academic Honor Roll list celebrating high performers (>= 80%)
  const academicHonorsList = useMemo(() => {
    const gradedList = activeWorksheet.filter(isAssessmentGraded);
    return gradedList
      .filter(w => w.totalScore >= 80)
      .map(w => {
        const student = students.find(s => s.id === w.studentId);
        return {
          student,
          score: w.totalScore,
          gradeLevel: w.gradeLevel
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [activeWorksheet, students]);

  // Selected class student list for trend selectors
  const classStudentsForTrend = useMemo(() => {
    return students.filter(s => s.class === selectedClass);
  }, [students, selectedClass]);

  // Safeguard/Auto-resolve selected trend student
  const selectedTrendStudent = useMemo(() => {
    const found = classStudentsForTrend.find(s => s.id === trendStudentId);
    return found || classStudentsForTrend[0] || null;
  }, [classStudentsForTrend, trendStudentId]);

  // Set initial trend student ID
  useEffect(() => {
    if (classStudentsForTrend.length > 0 && (!trendStudentId || !classStudentsForTrend.some(s => s.id === trendStudentId))) {
      setTrendStudentId(classStudentsForTrend[0].id);
    }
  }, [classStudentsForTrend, trendStudentId]);

  // Compute Student Trend Data
  const studentTrendData = useMemo(() => {
    if (!selectedTrendStudent) return [];
    
    const allAssessments = DbController.getAssessments();
    const studentRecords = allAssessments.filter(a => a.studentId === selectedTrendStudent.id);
    
    // Filter by subject if specified
    const subjectRecords = trendSubject === 'All'
      ? studentRecords
      : studentRecords.filter(a => a.subject === trendSubject);
      
    // Group records by acad_year + term
    const groups: { [key: string]: {
      academicYear: string;
      term: string;
      totalScores: number[];
      classScores: number[];
      examScores: number[];
    } } = {};
    
    subjectRecords.forEach(a => {
      const key = `${a.academicYear} - ${a.term}`;
      if (!groups[key]) {
        groups[key] = {
          academicYear: a.academicYear,
          term: a.term,
          totalScores: [],
          classScores: [],
          examScores: []
        };
      }
      if (a.totalScore !== undefined) groups[key].totalScores.push(a.totalScore);
      if (a.classScoreTotal !== undefined) groups[key].classScores.push(a.classScoreTotal);
      if (a.examScore100 !== undefined) groups[key].examScores.push(a.examScore100);
    });
    
    const termOrderList: { [k: string]: number } = { 'Term 1': 1, 'Term 2': 2, 'Term 3': 3 };
    
    const formattedData = Object.values(groups).map(g => {
      const avgTotal = g.totalScores.length > 0
        ? Math.round(g.totalScores.reduce((sum, v) => sum + v, 0) / g.totalScores.length)
        : 0;
      const avgClass = g.classScores.length > 0
        ? Math.round(g.classScores.reduce((sum, v) => sum + v, 0) / g.classScores.length)
        : 0;
      const avgExam = g.examScores.length > 0
        ? Math.round(g.examScores.reduce((sum, v) => sum + v, 0) / g.examScores.length)
        : 0;
        
      return {
        period: `${g.academicYear} ${g.term}`,
        academicYear: g.academicYear,
        term: g.term,
        'Overall Grade': avgTotal,
        'Class Assessment': avgClass,
        'Exam Score': avgExam
      };
    });
    
    // Sort chronologically
    formattedData.sort((a, b) => {
      if (a.academicYear !== b.academicYear) {
        return a.academicYear.localeCompare(b.academicYear);
      }
      return (termOrderList[a.term] || 0) - (termOrderList[b.term] || 0);
    });
    
    return formattedData;
  }, [selectedTrendStudent, trendSubject]);

  // Detailed Analysis of Student Strengths and Weaknesses across subjects of the active academic year
  const studentStrengthsWeaknesses = useMemo(() => {
    if (!selectedStudentId) return null;
    
    const allAssessments = DbController.getAssessments();
    const studentYearAssessments = allAssessments.filter(
      a => a.studentId === selectedStudentId && a.academicYear === selectedYear
    );
    
    if (studentYearAssessments.length === 0) return null;

    // Group by subject
    const bySubject: Record<string, { termScores: Record<string, number>; termGrades: Record<string, string>; assessmentsList: StudentAssessment[] }> = {};

    studentYearAssessments.forEach(a => {
      const subjectKey = a.subject;
      if (!bySubject[subjectKey]) {
        bySubject[subjectKey] = { termScores: {}, termGrades: {}, assessmentsList: [] };
      }
      bySubject[subjectKey].termScores[a.term] = a.totalScore;
      bySubject[subjectKey].termGrades[a.term] = a.gradeLevel;
      bySubject[subjectKey].assessmentsList.push(a);
    });

    const terms: TermType[] = ['Term 1', 'Term 2', 'Term 3'];

    const analysis = Object.keys(bySubject).map(subject => {
      const data = bySubject[subject];
      const scores = Object.values(data.termScores);
      const avgScore = scores.length > 0 
        ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) 
        : 0;

      // Determine chronological trend
      let trend: 'up' | 'down' | 'stable' | 'unknown' = 'unknown';
      const activeTermsSorted = terms.filter(t => data.termScores[t] !== undefined);
      if (activeTermsSorted.length >= 2) {
        const latestTerm = activeTermsSorted[activeTermsSorted.length - 1];
        const prevTerm = activeTermsSorted[activeTermsSorted.length - 2];
        const diff = data.termScores[latestTerm] - data.termScores[prevTerm];
        if (diff > 1.5) trend = 'up';
        else if (diff < -1.5) trend = 'down';
        else trend = 'stable';
      }

      // Categorize subject based on average score:
      // Strength (Proficient/Highly Proficient) -> avgScore >= 70
      // Weakness (Needs Support/Emerging) -> avgScore < 55
      // Steady (Approaching/Stable) -> 55 <= avgScore < 70
      let category: 'strength' | 'weakness' | 'steady' = 'steady';
      if (avgScore >= 70) category = 'strength';
      else if (avgScore < 55) category = 'weakness';

      return {
        subject,
        termScores: data.termScores,
        termGrades: data.termGrades,
        avgScore,
        trend,
        category,
      };
    }).sort((a, b) => b.avgScore - a.avgScore);

    const strengths = analysis.filter(a => a.category === 'strength');
    const weaknesses = analysis.filter(a => a.category === 'weakness');
    const steady = analysis.filter(a => a.category === 'steady');

    const totalAvg = analysis.length > 0
      ? parseFloat((analysis.reduce((sum, a) => sum + a.avgScore, 0) / analysis.length).toFixed(1))
      : 0;

    return {
      allSubjectsAnalysis: analysis,
      strengths,
      weaknesses,
      steady,
      annualAverage: totalAvg
    };
  }, [selectedStudentId, selectedYear, activeWorksheet]);

  // Overall student average score trend across terms for the active academic year
  const overallTermTrendData = useMemo(() => {
    if (!studentStrengthsWeaknesses) return [];
    const terms: TermType[] = ['Term 1', 'Term 2', 'Term 3'];
    return terms.map(term => {
      const termScores = studentStrengthsWeaknesses.allSubjectsAnalysis
        .map(sa => sa.termScores[term])
        .filter((val): val is number => val !== undefined);
      const avg = termScores.length > 0
        ? parseFloat((termScores.reduce((a, b) => a + b, 0) / termScores.length).toFixed(1))
        : null;
      return {
        name: term,
        'Overall Average': avg
      };
    }).filter(d => d['Overall Average'] !== null);
  }, [studentStrengthsWeaknesses]);

  // Specific selected subject trend data across terms for the active academic year
  const specificSubjectTrendData = useMemo(() => {
    if (!studentStrengthsWeaknesses || swSubjectFilter === 'All') return [];
    const subjectData = studentStrengthsWeaknesses.allSubjectsAnalysis.find(sa => sa.subject === swSubjectFilter);
    if (!subjectData) return [];
    
    const terms: TermType[] = ['Term 1', 'Term 2', 'Term 3'];
    return terms.map(term => {
      const score = subjectData.termScores[term];
      return {
        name: term,
        'Subject Score': score !== undefined ? score : null
      };
    }).filter(d => d['Subject Score'] !== null);
  }, [studentStrengthsWeaknesses, swSubjectFilter]);

  // Subject Performance Heatmap calculation comparing subject averages with the threshold
  const subjectAveragesData = useMemo(() => {
    const allAssessments = DbController.getAssessments();
    const filtered = allAssessments.filter(
      a => a.class === selectedClass && 
           a.academicYear === selectedYear && 
           a.term === selectedTerm
    );

    return SUBJECTS.map(subj => {
      const subjAssessments = filtered.filter(a => a.subject === subj);
      const scoreSum = subjAssessments.reduce((sum, current) => sum + current.totalScore, 0);
      const avgScore = subjAssessments.length > 0 ? parseFloat((scoreSum / subjAssessments.length).toFixed(1)) : null;
      const gradedCount = subjAssessments.length;

      return {
        subject: subj,
        average: avgScore,
        gradedCount,
      };
    });
  }, [selectedClass, selectedYear, selectedTerm, students, activeWorksheet]);

  const teacherSubjectStats = useMemo(() => {
    const subjectsToTrack = userRole === 'Teacher' && assignedSubjects.length > 0 
      ? assignedSubjects 
      : SUBJECTS;

    const allAssessments = DbController.getAssessments();
    const filtered = allAssessments.filter(
      a => a.class === selectedClass && 
           a.academicYear === selectedYear && 
           a.term === selectedTerm
    );

    return subjectsToTrack.map(subj => {
      const subjAssessments = filtered.filter(a => a.subject === subj);
      const scores = subjAssessments.map(a => a.totalScore);
      
      const average = scores.length > 0 
        ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) 
        : 0;
      const highest = scores.length > 0 ? Math.max(...scores) : 0;
      const lowest = scores.length > 0 ? Math.min(...scores) : 0;
      
      return {
        subject: subj,
        average,
        highest,
        lowest,
        gradedCount: scores.length
      };
    });
  }, [selectedClass, selectedYear, selectedTerm, assignedSubjects, userRole, activeWorksheet]);

  const subjectTrendData = useMemo(() => {
      const allAssessments = DbController.getAssessments();
      const filtered = allAssessments.filter(a => a.class === selectedClass && a.academicYear === selectedYear);
      
      const terms = ['Term 1', 'Term 2', 'Term 3'];
      return terms.map(term => {
          const termAssessments = filtered.filter(a => a.term === term);
          const scores = termAssessments.map(a => a.totalScore);
          return {
              term,
              highest: scores.length > 0 ? Math.max(...scores) : 0,
              lowest: scores.length > 0 ? Math.min(...scores) : 0
          };
      });
  }, [selectedClass, selectedYear, students]);

  const inputtedSubjects = useMemo(() => {
    const subjectsSet = new Set<string>();
    broadsheetData.forEach(row => {
      Object.keys(row.subjectScores).forEach(sub => subjectsSet.add(sub));
    });
    return SUBJECTS.filter(sub => subjectsSet.has(sub));
  }, [broadsheetData]);

  const hasAnyAssignment = (assignedClasses.length > 0) || (assignedSubjects.length > 0) || (assignedClass && assignedClass !== 'None');

  if (userRole === 'Teacher' && !hasAnyAssignment) {
    return (
      <div className="bg-amber-50/50 border border-amber-200 text-amber-800 p-8 rounded-2xl text-center space-y-4 max-w-xl mx-auto my-12 shadow-sm">
        <ShieldAlert size={48} className="text-amber-500 mx-auto animate-bounce" />
        <h3 className="font-bold text-lg">No Class Level Assigned</h3>
        <p className="text-sm text-amber-700 leading-relaxed">
          You are authenticated as a school educator, but you have not yet been assigned to a specific class level by the Headteacher.
        </p>
        <p className="text-xs text-amber-600 font-mono">
          Please contact your Headteacher to assign you to a specific class level (e.g. Basic 2 or Basic 8) in the "Teacher Profiles" directory.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in text-xs">
      
      {/* PERMISSION BANNER */}
      {userRole === 'Teacher' && (teacherPermissions?.canEditGrades === false || teacherPermissions?.canExportReports === false) && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-900 space-y-1.5 text-left shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-rose-500 animate-pulse" />
            <span className="font-bold text-xs uppercase tracking-wider font-mono">Administrative Restriction Notice</span>
          </div>
          <p className="text-[11px] font-medium text-rose-800 leading-relaxed">
            Your Headteacher has applied granular restrictions on your educator account:
          </p>
          <ul className="list-disc pl-5 text-[11px] text-rose-700 space-y-0.5 font-semibold">
            {teacherPermissions?.canEditGrades === false && (
              <li><strong>Grading Privileges Suspended:</strong> You can view student grades but cannot modify, import, or clear them.</li>
            )}
            {teacherPermissions?.canExportReports === false && (
              <li><strong>Exporting Privileges Suspended:</strong> PDF downloading, bulk terminal printing, and badge printing features are disabled.</li>
            )}
          </ul>
        </div>
      )}
      
      {/* 1. FILTERING RIBBON CONTROL & NAVIGATION TABS */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 no-print">
        
        {/* Academic Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pb-4 border-b border-slate-100">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Academic Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value as AcademicYearType)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 font-semibold"
            >
              {ACADEMIC_YEARS.map(yr => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Academic Term</label>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value as TermType)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 font-semibold"
            >
              {TERMS.map(tm => (
                <option key={tm} value={tm}>{tm}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Active Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value as ClassType)}
              disabled={userRole === 'Teacher' && [...new Set([assignedClass, ...assignedClasses])].filter(c => c && c !== 'None').length <= 1}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 font-semibold disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {userRole === 'Teacher' ? (
                [...new Set([assignedClass, ...assignedClasses])].filter(c => c && c !== 'None').map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))
              ) : (
                CLASSES.map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Subject Curriculum</label>
            <select
              value={selectedSubject}
              disabled={subMode === 'Broadsheet' || subMode === 'IndividualReport' || (userRole === 'Teacher' && assignedSubjects.length <= 1)}
              onChange={(e) => setSelectedSubject(e.target.value as SubjectType)}
              className="w-full px-3 py-2 border border-slate-100 rounded-lg bg-slate-50 font-semibold disabled:opacity-40"
            >
              {userRole === 'Teacher' && assignedSubjects.length > 0 ? (
                assignedSubjects.map(sb => (
                  <option key={sb} value={sb}>{sb}</option>
                ))
              ) : (
                SUBJECTS.map(sb => (
                  <option key={sb} value={sb}>{sb}</option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-teal-700 uppercase tracking-wider mb-1 flex items-center gap-1 font-semibold">
              <Calendar size={13} className="text-teal-600" />
              Next Term Reopen
            </label>
            <input
              type="date"
              value={reopeningDate}
              onChange={(e) => handleReopeningDateChange(e.target.value)}
              className="w-full px-3 py-1.5 border border-teal-200 rounded-lg bg-teal-50/10 font-semibold focus:outline-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400 text-teal-900 text-xs cursor-pointer"
            />
          </div>
        </div>

        {/* Component Dashboard Sub-Navigation Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => setSubMode('Worksheet')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold transition text-[11px] cursor-pointer ${subMode === 'Worksheet' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <LayoutGrid size={14} /> Marks Input Sheet
            </button>
            <button
              onClick={() => setSubMode('IndividualReport')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold transition text-[11px] cursor-pointer ${subMode === 'IndividualReport' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <FileText size={14} /> Student Report Card
            </button>
            <button
              onClick={() => setSubMode('Broadsheet')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold transition text-[11px] cursor-pointer ${subMode === 'Broadsheet' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Layers size={14} /> Class Broadsheet
            </button>
            <button
              onClick={() => setSubMode('PerformanceAnalytics')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold transition text-[11px] cursor-pointer ${subMode === 'PerformanceAnalytics' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <BarChart3 size={14} /> Performance Charts
            </button>
            <button
              onClick={() => setSubMode('StudentStrengthsWeaknesses')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold transition text-[11px] cursor-pointer ${subMode === 'StudentStrengthsWeaknesses' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Sparkles size={14} className="text-amber-500 animate-pulse" /> Strengths & Weaknesses
            </button>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={handleExportAllAssessmentsCSV}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 border border-emerald-600 text-white hover:bg-emerald-700 transition font-bold rounded-lg cursor-pointer active:translate-y-0.5 whitespace-nowrap text-xs shadow-sm"
              title="Export all student performance records across subjects to CSV"
            >
              <FileSpreadsheet size={14} /> Export All to CSV
            </button>
            {subMode !== 'IndividualReport' && (
              <button
                onClick={() => {
                  if (subMode === 'Worksheet') {
                    setWorksheetPreviewMode(!worksheetPreviewMode);
                  } else if (subMode === 'Broadsheet') {
                    setBroadsheetPreviewMode(!broadsheetPreviewMode);
                  } else if (subMode === 'PerformanceAnalytics') {
                    setPerformancePreviewMode(!performancePreviewMode);
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 border border-slate-900 text-white hover:bg-slate-800 transition font-bold rounded-lg cursor-pointer active:translate-y-0.5 text-xs whitespace-nowrap"
              >
                <Eye size={14} /> Toggle Preview Mode
              </button>
            )}
            
            {subMode === 'Worksheet' && (
              <button
                onClick={handleManualSave}
                className={`flex items-center gap-1 px-4 py-1.5 rounded-lg font-black shadow-sm cursor-pointer active:translate-y-0.5 transition ${theme.btnColors} ${unsavedChanges ? 'animate-pulse ring-2 ring-indigo-400' : ''}`}
                title={unsavedChanges ? 'You have unsaved gradesheet changes' : 'Save current academic assessment data'}
              >
                <Save size={14} /> Save Data
              </button>
            )}
          </div>
        </div>

        {saveFeedback && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] py-2 px-3 rounded-md flex items-center gap-1.5 animate-pulse">
            <Sparkles size={14} className="text-emerald-500" />
            <span>{saveFeedback}</span>
          </div>
        )}
      </div>

      {/* 2. SUB-MODE SUB-SCREEN MODULES */}

      {/* SUBMODE A: INTERACTIVE SPREADSHEET (MARKS ENTRY WORKSHEET) */}
      {subMode === 'Worksheet' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden no-print">
          
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-slate-700 text-sm flex items-center gap-1.5">
                📊 Class Score-Sheets Input
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5 mb-2.5">Input parameters are constrained: Exercises (0-10), Class Tests (0-20), Project Work/Group Work (0-10), Examination Exams (0-100)</p>
              
              <div className="flex items-center gap-5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                  <input 
                    type="radio" 
                    name="templateSelect"
                    checked={!DbController.getAssessmentTemplate(selectedClass, selectedYear, selectedTerm, selectedSubject)}
                    onChange={() => {
                       const compoundId = `${selectedClass}_${selectedYear}_${selectedTerm}_${selectedSubject.replace(/\s+/g, '')}`.replace(/\//g, '-');
                       DbController.deleteAssessmentTemplate(compoundId);
                       setActiveWorksheet(DbController.getAssessmentsSheet(selectedClass, selectedYear, selectedTerm, selectedSubject));
                       setUnsavedChanges(false);
                    }}
                    className="accent-indigo-600 h-3.5 w-3.5"
                  />
                  Default Template
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                    <input 
                      type="radio" 
                      name="templateSelect"
                      checked={!!DbController.getAssessmentTemplate(selectedClass, selectedYear, selectedTerm, selectedSubject)}
                      onChange={() => {
                         const compoundId = `${selectedClass}_${selectedYear}_${selectedTerm}_${selectedSubject.replace(/\s+/g, '')}`.replace(/\//g, '-');
                         if (!DbController.getAssessmentTemplate(selectedClass, selectedYear, selectedTerm, selectedSubject)) {
                             DbController.saveAssessmentTemplate({
                                id: compoundId,
                                components: [{name: 'Assignment', maxScore: 20}, {name: 'Midterm', maxScore: 30}]
                             });
                             setActiveWorksheet(DbController.getAssessmentsSheet(selectedClass, selectedYear, selectedTerm, selectedSubject));
                             setUnsavedChanges(false);
                         }
                      }}
                      className="accent-indigo-600 h-3.5 w-3.5"
                    />
                    Custom Template
                  </label>
                  {!!DbController.getAssessmentTemplate(selectedClass, selectedYear, selectedTerm, selectedSubject) && (
                    <button
                      type="button"
                      onClick={() => {
                        const tmpl = DbController.getAssessmentTemplate(selectedClass, selectedYear, selectedTerm, selectedSubject);
                        if (tmpl) {
                          setCustomComponents(tmpl.components);
                        } else {
                          setCustomComponents([{name: 'Assignment', maxScore: 20}, {name: 'Midterm', maxScore: 30}]);
                        }
                        setShowTemplateModal(true);
                      }}
                      className="py-1 px-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-[10px] font-bold shadow-xs cursor-pointer transition flex items-center justify-center gap-1 active:translate-y-0.5 no-print"
                    >
                      <Sliders size={10} /> Configure
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
                Class: {selectedClass}
              </span>
              <span className="text-[10px] bg-teal-50 border border-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-semibold">
                Subject: {selectedSubject}
              </span>
              <button
                type="button"
                onClick={() => setWorksheetPreviewMode(!worksheetPreviewMode)}
                className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black shadow-xs cursor-pointer transition flex items-center justify-center gap-1 active:translate-y-0.5 no-print"
              >
                <Eye size={12} /> Toggle Preview Mode
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {activeWorksheet.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <AlertCircle size={32} className="text-slate-300 mx-auto" />
                <h4 className="font-bold text-slate-600">No Student Rolls Available</h4>
                <p className="text-[10px] max-w-sm mx-auto text-slate-400">Please enroll student profiles to {selectedClass} to enable automatic loading of names inside this grades sheet registry.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse table-fixed min-w-[900px] text-[11px]">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200">
                    <th className="py-2.5 px-2 font-black text-slate-500 w-12 text-center">No</th>
                    <th className="py-2.5 px-2 font-black text-slate-500 w-48 truncate">Student Full Name</th>
                    
                    {DbController.getAssessmentTemplate(selectedClass, selectedYear, selectedTerm, selectedSubject) ? (
                      DbController.getAssessmentTemplate(selectedClass, selectedYear, selectedTerm, selectedSubject)!.components.map((comp, idx) => (
                        <th key={`c-${idx}`} className={`py-2.5 px-1 font-bold text-slate-600 text-center bg-blue-50/40 ${idx === 0 ? 'border-l border-slate-200' : ''}`}>
                          {comp.name} ({comp.maxScore})
                        </th>
                      ))
                    ) : (
                      <>
                        {/* Exercises 4 Columns */}
                        <th className="py-2.5 px-1 font-bold text-slate-600 text-center bg-blue-50/40 border-l border-slate-200">Ex 1 (10)</th>
                        <th className="py-2.5 px-1 font-bold text-slate-600 text-center bg-blue-50/40">Ex 2 (10)</th>
                        <th className="py-2.5 px-1 font-bold text-slate-600 text-center bg-blue-50/40">Ex 3 (10)</th>
                        <th className="py-2.5 px-1 font-bold text-slate-600 text-center bg-blue-50/40">Ex 4 (10)</th>
                        {/* Class Test 2 Columns */}
                        <th className="py-2.5 px-1 font-bold text-slate-600 text-center bg-teal-50/40 border-l border-slate-200">Ts 1 (20)</th>
                        <th className="py-2.5 px-1 font-bold text-slate-600 text-center bg-teal-50/40">Ts 2 (20)</th>
                        {/* Project & Group */}
                        <th className="py-2.5 px-1 font-bold text-slate-600 text-center bg-amber-50/40 border-l border-slate-200">Proj (10)</th>
                        <th className="py-2.5 px-1 font-bold text-slate-600 text-center bg-amber-50/40">Grp (10)</th>
                      </>
                    )}
                    
                    {/* Total & 50% */}
                    <th className="py-2.5 px-1 font-bold text-slate-700 text-center bg-slate-100 border-l border-slate-200">Class 50%</th>
                    {/* Exams */}
                    <th className="py-2.5 px-1.5 font-bold text-slate-600 text-center bg-indigo-50 border-l border-slate-200">Exam (100)</th>
                    <th className="py-2.5 px-1 font-bold text-slate-700 text-center bg-indigo-50">Exam 50%</th>
                    {/* Combined Grade, Position */}
                    <th className="py-2.5 px-1 font-black text-slate-900 text-center border-l border-slate-200">Total (100)</th>
                    <th className="py-2.5 px-1 font-bold text-slate-700 text-center bg-emerald-50">Remark</th>
                    <th className="py-2.5 px-1 font-black text-indigo-700 text-center bg-purple-50">Pos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <AnimatePresence mode="popLayout">
                    {activeWorksheet.map((row, index) => (
                      <motion.tr 
                        key={row.studentId} 
                        className="hover:bg-slate-50/20 transition"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.4), ease: 'easeOut' }}
                      >
                        <td className="py-1 px-1.5 text-center font-mono text-slate-300 font-bold">{index + 1}</td>
                        <td className="py-1 px-2 font-semibold text-slate-800 truncate leading-tight font-sans">
                          <div>{row.studentName}</div>
                          <span className="text-[9px] text-slate-400 font-mono font-normal">ID: {row.studentId}</span>
                        </td>
                        
                        {DbController.getAssessmentTemplate(selectedClass, selectedYear, selectedTerm, selectedSubject) ? (
                          DbController.getAssessmentTemplate(selectedClass, selectedYear, selectedTerm, selectedSubject)!.components.map((comp, idx) => (
                            <td key={`c-${idx}`} className={`py-1 px-0.5 bg-blue-50/10 ${idx === 0 ? 'border-l border-slate-100' : ''}`}>
                              <input
                                type="number"
                                min="0"
                                max={comp.maxScore}
                                step="0.1"
                                value={row.customAssessments?.[idx] || 0}
                                onChange={(e) => handleScoreInput(row.studentId, 'customAssessments', idx, e.target.value)}
                                className="w-full text-center py-1 text-xs font-semibold bg-white border border-slate-200 rounded focus:bg-slate-50 focus:border-indigo-400 focus:outline-none"
                              />
                            </td>
                          ))
                        ) : (
                          <>
                            {/* Exercises 4 Columns input with constraints 0-10 */}
                            {[0, 1, 2, 3].map(exIdx => (
                              <td key={`ex-${exIdx}`} className="py-1 px-0.5 bg-blue-50/10 border-l border-slate-100">
                                <input
                                  type="number"
                                  min="0"
                                  max="10"
                                  step="0.1"
                                  value={row.exercises[exIdx] || 0}
                                  onChange={(e) => handleScoreInput(row.studentId, 'exercises', exIdx, e.target.value)}
                                  className="w-full text-center py-1 text-xs font-semibold bg-white border border-slate-200 rounded focus:bg-slate-50 focus:border-indigo-400 focus:outline-none"
                                />
                              </td>
                            ))}

                            {/* Class Test 2 Columns input with constraints 0-20 */}
                            {[0, 1].map(tsIdx => (
                              <td key={`ts-${tsIdx}`} className="py-1 px-0.5 bg-teal-50/10 border-l border-slate-100">
                                <input
                                  type="number"
                                  min="0"
                                  max="20"
                                  step="0.1"
                                  value={row.tests[tsIdx] || 0}
                                  onChange={(e) => handleScoreInput(row.studentId, 'tests', tsIdx, e.target.value)}
                                  className="w-full text-center py-1 text-xs font-semibold bg-white border border-slate-200 rounded focus:bg-slate-50"
                                />
                              </td>
                            ))}

                          {/* Project Work input constraint 0-10 */}
                          <td className="py-1 px-0.5 bg-amber-50/10 border-l border-slate-100">
                            <input
                              type="number"
                              min="0"
                              max="10"
                              step="0.1"
                              value={row.projectWork || 0}
                              onChange={(e) => handleScoreInput(row.studentId, 'projectWork', 0, e.target.value)}
                              className="w-full text-center py-1 text-xs font-semibold bg-white border border-slate-200 rounded focus:bg-slate-50"
                            />
                          </td>

                          {/* Group Work input constraint 0-10 */}
                          <td className="py-1 px-0.5 bg-amber-50/10">
                            <input
                              type="number"
                              min="0"
                              max="10"
                              step="0.1"
                              value={row.groupWork || 0}
                              onChange={(e) => handleScoreInput(row.studentId, 'groupWork', 0, e.target.value)}
                              className="w-full text-center py-1 text-xs font-semibold bg-white border border-slate-200 rounded"
                            />
                          </td>
                        </>
                      )}

                      {/* Class Score Total converted to 50% (Class Score 50%) */}
                      <td className="py-1 px-0.5 text-center font-bold text-slate-800 bg-slate-100 border-l border-slate-200 font-mono">
                        {row.classScore50} <span className="text-[9px] text-slate-400 block font-normal">/{row.classScoreTotal}</span>
                      </td>

                      {/* Exam Score input constraint 0-100 */}
                      <td className="py-1 px-0.5 bg-indigo-50/10 border-l border-slate-200">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={row.examScore100 || 0}
                          onChange={(e) => handleScoreInput(row.studentId, 'examScore100', 0, e.target.value)}
                          className="w-full text-center py-1 text-xs font-semibold bg-white border border-slate-200 rounded text-indigo-700 font-mono"
                        />
                      </td>

                      {/* Exam Score 50% */}
                      <td className="py-1 px-0.5 text-center font-bold text-slate-700 bg-indigo-50/30 font-mono">
                        {row.examScore50}
                      </td>

                      {/* Total Score 100% */}
                      <td className="py-1 px-0.5 text-center font-black text-rose-700 border-l border-slate-200 bg-slate-50 font-mono text-xs">
                        {row.totalScore}%
                      </td>

                      {/* GES Remark */}
                      <td className="py-1 px-0.5 text-center bg-emerald-50 text-[10px] truncate leading-none">
                        <strong className="text-emerald-800">{row.remarks}</strong>
                        <span className="text-[8px] text-slate-400 block font-mono mt-0.5">GES: {row.gradeLevel}</span>
                      </td>

                      {/* Position in Class */}
                      <td className="py-1 px-0.5 text-center bg-purple-50 text-indigo-800 font-black font-mono">
                        {row.position ? `${row.position}` : 'N/A'}
                      </td>
                    </motion.tr>
                  ))}
                  </AnimatePresence>
                </tbody>
              </table>
            )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-400 font-mono flex items-center justify-between no-print">
            <span className="flex items-center gap-1">
              <CheckSquare size={13} className="text-slate-400" />
              <span>Rows represent current live enrollment rosters synced from core registers.</span>
            </span>
            <span className="text-slate-500 font-semibold uppercase">GES CURRICULUM COMPLIANT</span>
          </div>

        </div>
      )}

      {/* SUBMODE B: INDIVIDUAL REPORT CARD VIEW */}
      {subMode === 'IndividualReport' && (
        <div className="space-y-6">
          
          {/* Individual report card selectors */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 font-medium font-sans">Select Target Student:</span>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 font-semibold focus:outline-none"
                >
                  {students.filter(s => s.class === selectedClass).map(s => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName} ({s.id})
                    </option>
                  ))}
                </select>
              </div>

              {compiledReport && compiledReport.grades.length > 0 && (
                <button
                  type="button"
                  onClick={() => setReportCardPreviewMode(!reportCardPreviewMode)}
                  className={`py-1.5 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black shadow-xs cursor-pointer transition flex items-center justify-center gap-1.5 active:translate-y-0.5`}
                >
                  <Eye size={14} /> Toggle Preview Mode
                </button>
              )}

              {students.filter(s => s.class === selectedClass).length > 0 && (
                <button
                  type="button"
                  disabled={teacherPermissions?.canExportReports === false}
                  onClick={() => {
                    if (teacherPermissions?.canExportReports === false) {
                      alert("Permission to export reports has been suspended by the Headteacher.");
                      return;
                    }
                    setBulkReportMode(true);
                  }}
                  className={`py-1.5 px-3.5 ${
                    teacherPermissions?.canExportReports === false 
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60' 
                      : 'bg-sky-600 hover:bg-sky-700 text-white cursor-pointer active:translate-y-0.5'
                  } rounded-lg text-xs font-black shadow-xs transition flex items-center justify-center gap-1.5`}
                >
                  <Printer size={14} /> Print Bulk (Class {selectedClass})
                </button>
              )}
            </div>
            
            <div id="print-guide" className="text-[11px] text-slate-400 flex items-center gap-1">
              <AlertCircle size={14} className="text-amber-500" />
              <span>Ready for Print. Clean layouts fit A4 dimensions seamlessly.</span>
            </div>
          </div>

          {!compiledReport || compiledReport.grades.length === 0 ? (
            <div className="bg-white p-12 border border-slate-200 text-center text-slate-400 rounded-xl space-y-2 no-print">
              <FileText size={36} className="text-slate-300 mx-auto" />
              <h4 className="font-bold text-slate-600">No Grades Marked Yet</h4>
              <p className="text-[10px] max-w-sm mx-auto text-slate-400">Please enter academic scores in the Primary Marks Worksheet across multiple subjects to generate this report card.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Report Card Page layout */}
              <div className="lg:col-span-2 bg-white p-6 border border-slate-200 rounded-xl shadow-xs print:m-0 print:border-none print:shadow-none print:p-0 col-span-full font-sans relative">
                <div className="absolute inset-0 z-0 pointer-events-none hidden print:block" dangerouslySetInnerHTML={{ __html: getWatermarkHtml(DbController.getSchoolInfo().crestUrl) }} />
                
                {/* Professional School Profile Header with Crest, Logo & Info */}
                <div className="flex flex-col sm:flex-row items-center justify-between border-b-2 border-slate-900 pb-4 mb-4 gap-4 font-sans text-left relative z-10">
                  {DbController.getSchoolInfo().logoUrl ? (
                    <img 
                      src={DbController.getSchoolInfo().logoUrl} 
                      alt="School Logo" 
                      className="w-16 h-16 object-contain flex-shrink-0" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center border border-slate-300 p-1 flex-shrink-0">
                      <div className="w-full h-full rounded-full border border-dashed border-slate-400 bg-white flex flex-col items-center justify-center text-[7px] text-slate-500 font-mono font-bold leading-normal">
                        <Award size={18} className="text-indigo-600 mb-0.5" />
                        <span className="scale-75 origin-center uppercase">CREST</span>
                      </div>
                    </div>
                  )}
                  <div className="flex-1 text-center space-y-0.5">
                    <h2 className="text-xl font-black text-slate-950 tracking-tight leading-tight uppercase font-display">
                      {DbController.getSchoolInfo().name}
                    </h2>
                    <p className="text-[10px] italic font-serif text-slate-600">
                      Motto: "{DbController.getSchoolInfo().motto}"
                    </p>
                    <div className="text-[9px] text-slate-500 font-sans flex flex-wrap justify-center gap-x-3 gap-y-0.5 mt-0.5">
                      {DbController.getSchoolInfo().gpsAddress && <span>📍 {DbController.getSchoolInfo().gpsAddress}</span>}
                      {DbController.getSchoolInfo().telephone && <span>☎️ {DbController.getSchoolInfo().telephone}</span>}
                      {DbController.getSchoolInfo().email && <span>📧 {DbController.getSchoolInfo().email}</span>}
                    </div>
                    <div className="text-[8px] font-mono text-slate-400 uppercase tracking-widest font-semibold flex justify-center gap-3 mt-0.5">
                      {DbController.getSchoolInfo().emisCode && <span>EMIS: {DbController.getSchoolInfo().emisCode}</span>}
                      {DbController.getSchoolInfo().schoolNumber && <span>CODE: {DbController.getSchoolInfo().schoolNumber}</span>}
                    </div>
                    <p className="text-[9px] font-mono text-slate-800 font-bold uppercase tracking-wider bg-slate-100 px-3 py-0.5 rounded-full inline-block mt-1">
                      Official Student Progress Statement Card
                    </p>
                  </div>
                  {compiledReport.student.photoUrl ? (
                    <img 
                      src={compiledReport.student.photoUrl} 
                      alt={`${compiledReport.student.firstName} ${compiledReport.student.lastName}`} 
                      className="w-14 h-14 rounded border border-slate-300 object-cover flex-shrink-0 student-report-photo" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded border border-dashed border-slate-300 flex flex-col items-center justify-center bg-slate-50 p-1 flex-shrink-0 text-[6.5px] text-slate-400 font-mono text-center leading-normal select-none student-report-photo-placeholder">
                      <div className="font-bold scale-90">PASSPORT</div>
                      <div className="scale-75">STAMP</div>
                    </div>
                  )}
                </div>

                {/* Student Personal Data metadata */}
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 bg-slate-50 p-4 rounded-lg text-xs leading-relaxed border border-slate-100 print:bg-white print:border-none">
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-mono font-medium block">Student ID</span>
                    <strong className="text-slate-800 font-mono">{compiledReport.student.id}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-mono font-medium block">Full Name</span>
                    <strong className="text-slate-800">{compiledReport.student.firstName} {compiledReport.student.lastName}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-mono font-medium block">Academic Class</span>
                    <strong className="text-slate-800">{compiledReport.student.class} ({compiledReport.student.section})</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-mono font-medium block">Report Term</span>
                    <strong className="text-slate-800 font-mono">{selectedTerm} ({selectedYear})</strong>
                  </div>
                  <div className="relative group cursor-help bg-indigo-50/30 p-1.5 rounded-lg border border-indigo-100/50 transition-all hover:bg-indigo-50/80">
                    <span className="text-[10px] uppercase text-indigo-700 font-mono font-bold flex items-center gap-1 select-none">
                      Class Rank Standings <HelpCircle size={10} className="text-indigo-400" />
                    </span>
                    <strong className="text-indigo-900 font-mono font-extrabold text-sm">{compiledReport.classRank || 'N/A'}</strong>
                    <RankBreakdownTooltip 
                      term={selectedTerm} 
                      year={selectedYear} 
                      averageScore={compiledReport.averageScore} 
                      gradedCount={compiledReport.gradedCount} 
                    />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-teal-700 font-mono font-bold block">Reopening Date</span>
                    <strong className="text-teal-900 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100">{formatReopeningDate(DbController.getSchoolInfo().reopeningDate)}</strong>
                  </div>
                </div>

                {/* Registered Subjects grades table */}
                <table className="w-full text-left border-collapse border border-slate-200 text-xs mt-4">
                  <thead>
                    <tr className="bg-slate-100 border-b-2 border-slate-800">
                      <th className="py-1.5 px-2 border border-slate-200 font-bold text-[11px]">Subject Course</th>
                      <th className="py-1.5 px-1 border border-slate-200 font-bold text-center text-[11px]">Class 50%</th>
                      <th className="py-1.5 px-1 border border-slate-200 font-bold text-center text-[11px]">Exams 50%</th>
                      <th className="py-1.5 px-1 border border-slate-200 font-bold text-center text-[11px]">Total 100%</th>
                      <th className="py-1.5 px-2 border border-slate-200 font-bold text-center text-[11px]">Remarks</th>
                      <th className="py-1.5 px-1 border border-slate-200 font-bold text-center text-[11px]">Rank</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {compiledReport.grades.map((item, index) => (
                      <motion.tr 
                        key={item.id} 
                        className={`hover:bg-slate-50/50 assessment-grade-row ${(!item.totalScore || item.totalScore === 0) ? 'assessment-grade-empty' : ''}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.4), ease: 'easeOut' }}
                      >
                        <td className="py-1.5 px-2 border border-slate-200 font-bold text-slate-900">{item.subject}</td>
                        <td className="py-1.5 px-1 border border-slate-200 text-center font-mono font-semibold">{item.classScore50}</td>
                        <td className="py-1.5 px-1 border border-slate-200 text-center font-mono font-semibold">{item.examScore50}</td>
                        <td className="py-1.5 px-1 border border-slate-200 text-center font-mono font-black text-rose-700 bg-rose-50/20">{item.totalScore}%</td>
                        <td className="py-1.5 px-2 border border-slate-200 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${item.gradeLevel === 'L1' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : item.gradeLevel === 'L2' ? 'bg-blue-50 text-blue-800' : item.gradeLevel === 'L3' ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-800'}`}>
                            {item.remarks} ({item.gradeLevel})
                          </span>
                        </td>
                        <td className="py-1.5 px-1 border border-slate-200 text-center font-mono font-black text-indigo-700">{item.position ? `${item.position}` : 'N/A'}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>

                {/* Report Card Aggregates Footer summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 border-t border-slate-200 pt-4 text-xs text-center font-mono leading-relaxed">
                  <div>
                    <span className="text-slate-400 font-sans block text-[10px] uppercase">Subjects Graded</span>
                    <strong className="text-slate-800 text-sm">{compiledReport.totalSubjects} courses</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-sans block text-[10px] uppercase">Term Average Score</span>
                    <strong className="text-slate-800 text-sm italic">{compiledReport.averageScore}%</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-sans block text-[10px] uppercase">Attendance / School Open</span>
                    <strong className="text-slate-800 text-sm">{compiledReport.attendancePresent} / {compiledReport.schoolOpenDays} Days Present</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-sans block text-[10px] uppercase">Grade Rating</span>
                    <strong className="text-slate-800 text-sm uppercase">GES Certified</strong>
                  </div>
                </div>

                {/* Financial Ledger Section */}
                {studentFinancials && (
                  <div className="mt-4 bg-slate-50 border border-slate-200/80 rounded-xl p-3 font-sans text-xs flex flex-col md:flex-row justify-between gap-4 leading-normal print:bg-white print:border-slate-300">
                    <div className="space-y-1">
                      <div className="text-slate-500 uppercase tracking-wider text-[9px] font-black">Current Balance Status</div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-base font-black ${studentFinancials.totalOutstanding > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                          GHS {studentFinancials.totalOutstanding.toFixed(2)}
                        </span>
                        {studentFinancials.totalOutstanding > 0 && studentFinancials.previousOutstanding > 0 && (
                          <span className="text-[10px] text-slate-400">
                            (Term: GHS {studentFinancials.currentOutstanding.toFixed(2)} | Arrears: GHS {studentFinancials.previousOutstanding.toFixed(2)})
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">Outstanding student balance of registered accounts ledger.</div>
                    </div>
                    <div className="border-t md:border-t-0 md:border-l border-slate-250 md:pl-6 pt-3 md:pt-0 space-y-1">
                      <div className="text-slate-500 uppercase tracking-wider text-[9px] font-black">Next Term Projected Bill ({studentFinancials.nextTerm}, {studentFinancials.nextYear})</div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-base font-bold text-slate-800">
                          GHS {studentFinancials.nextTermBillSum.toFixed(2)}
                        </span>
                        {studentFinancials.isEstimated && (
                          <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-black font-mono">Estimated Rate</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">Projected billing plan for the upcoming academic module term.</div>
                    </div>
                  </div>
                )}

                {/* Remarks & Signatures desk */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10 border-t border-slate-100 pt-4">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono text-slate-410 uppercase font-bold">Principal Headteacher Remarks</span>
                    <p className="text-[11px] italic text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200/50 leading-relaxed min-h-[60px] print:bg-white print:border-none">
                      {compiledReport.averageScore >= 80 
                        ? 'Excellent performance! The student reflects high mastery level standards on the GES curriculum benchmarks.' 
                        : compiledReport.averageScore >= 68 
                        ? 'Satisfactory progress. Proficient level achieved across most cognitive subject domains.' 
                        : compiledReport.averageScore >= 54 
                        ? 'An average term result. Needs more dedication and revision in quantitative sciences.' 
                        : 'Underperforming benchmarks. Urgent tutoring is recommended to foster remediation.'}
                    </p>
                  </div>

                  <div className="flex flex-col justify-end items-end space-y-1.5 pr-6 relative">
                    <div className="relative w-48 h-14 flex items-center justify-center">
                      {DbController.getSchoolInfo().stampUrl && (
                        <img 
                          src={DbController.getSchoolInfo().stampUrl} 
                          alt="School Stamp" 
                          className="absolute w-16 h-16 object-contain opacity-75 z-0 transform -rotate-12 translate-x-[-15%] translate-y-[-5%]" 
                          referrerPolicy="no-referrer"
                        />
                      )}
                      {DbController.getSchoolInfo().signatureUrl ? (
                        <img 
                          src={DbController.getSchoolInfo().signatureUrl} 
                          alt="Headteacher Signature" 
                          className="absolute w-32 h-10 object-contain z-10" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="h-[1px] w-40 bg-slate-400 self-end"></div>
                      )}
                    </div>
                    {DbController.getSchoolInfo().signatureUrl && <div className="h-[1px] w-40 bg-slate-300"></div>}
                    <div className="text-right">
                      {DbController.getSchoolInfo().headteacherName && (
                        <span className="font-bold text-[9px] text-slate-800 block leading-tight">{DbController.getSchoolInfo().headteacherName}</span>
                      )}
                      <span className="text-[10px] text-slate-500 font-serif">Signature of Headteacher</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Subject Comparison Chart on Right (no-print) */}
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl space-y-4 no-print sm:col-span-full md:col-span-1 lg:col-span-1">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <BarChart3 size={15} className={theme.accentText} />
                  Academic Profile Chart
                </h4>
                <p className="text-[10px] text-slate-400 leading-relaxed">Comparative distribution of subject totals out of 100%.</p>
                
                <div className="h-64 bg-white rounded-lg border border-slate-100 p-2">
                  <ResponsiveContainer width="100%" height="100%" aspect={1.5}>
                    <BarChart data={compiledReport.grades} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="subject" tick={{ fontSize: 8 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                      <Tooltip wrapperStyle={{ fontSize: '10px' }} />
                      <Bar dataKey="totalScore" name="Total 100%" fill="#6366f1" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          )}

          {/* Immersive Fullscreen Bulk Print Mode for ALL Report Cards of Class */}
          {bulkReportMode && (
            <div 
              onClick={(e) => {
                if (e.target === e.currentTarget) setBulkReportMode(false);
              }}
              className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-50 overflow-y-auto flex flex-col items-center py-6 px-4 no-scrollbar font-sans text-xs cursor-pointer"
            >
              <div onClick={(e) => e.stopPropagation()} className="w-full max-w-4xl flex flex-col items-center cursor-default">
                
                {/* Immersive Preview Header Controls Bar (no-print) */}
                <div className="w-full max-w-4xl bg-white border border-slate-200 p-4 rounded-xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 no-print">
                  <div className="flex flex-wrap items-center gap-4 text-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2.5 w-2.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500"></span>
                      </span>
                      <span className="font-bold text-slate-900 font-display">PRISTINE CLASS BATCH PRINT REPORT ENGINE</span>
                    </div>
                    <div className="border-l border-slate-200 pl-4 text-slate-500 font-medium font-sans">
                      Class: <strong className="text-slate-950 font-sans font-bold">{selectedClass}</strong> ({bulkClassReports.length} student files compiled)
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        DbController.writeActivityLog('Batch Print Report Generated', `Printed batch report cards for ${bulkClassReports.length} students in ${selectedClass}.`, 'medium');
                        try {
                          window.print();
                        } catch (err) {
                          console.warn("Direct window print error:", err);
                          setPrintBlocked(true);
                        }
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-650 hover:bg-indigo-750 text-white font-bold rounded-lg cursor-pointer active:translate-y-0.5 text-xs text-center transition shadow-md bg-indigo-600 hover:bg-indigo-700"
                    >
                      <Printer size={14} /> Batch Print Now
                    </button>

                    <button
                      type="button"
                      onClick={() => setBulkReportMode(false)}
                      className="flex items-center gap-1.5 px-4 py-2 border border-slate-250 hover:bg-slate-50 text-slate-755 font-bold rounded-lg cursor-pointer active:translate-y-0.5 text-xs text-center transition bg-white"
                    >
                      Exit Batch Mode
                    </button>
                  </div>
                </div>

                {/* Batch compiled student report list */}
                <div className="w-full space-y-8 no-scrollbar">
                  {bulkClassReports.length === 0 ? (
                    <div className="bg-white p-12 text-center text-slate-400 rounded-xl space-y-2 max-w-4xl w-full">
                      <FileText size={36} className="text-slate-300 mx-auto animate-bounce" />
                      <h4 className="font-bold text-slate-600">No Students Registered in class {selectedClass}</h4>
                    </div>
                  ) : (
                    bulkClassReports.map(({ student, report, financials }, batchIdx) => {
                      if (!report || report.grades.length === 0) {
                        return (
                          <div key={student.id} className="w-full bg-white/95 p-10 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 font-sans space-y-2 no-print shadow-xl">
                            <FileText size={28} className="mx-auto text-slate-300" />
                            <h5 className="font-bold text-slate-600 text-xs">No Graded Statements For: {student.firstName} {student.lastName} ({student.id})</h5>
                            <p className="text-[10px] text-slate-400 max-w-sm mx-auto">Please draft and lock terminal report cards inside the main grade worksheet view.</p>
                          </div>
                        );
                      }

                      return (
                        <div 
                          key={student.id} 
                          className="w-full bg-white p-12 md:p-16 print:p-0 shadow-2xl rounded-2xl border border-slate-200 font-sans leading-relaxed text-black/90 text-left bulk-report-card-print-page relative"
                        >
                          <div className="absolute inset-0 z-0 pointer-events-none hidden print:block" dangerouslySetInnerHTML={{ __html: getWatermarkHtml(DbController.getSchoolInfo().crestUrl) }} />
                          
                          {/* Professional Letterhead */}
                          <div className="flex flex-col sm:flex-row items-center justify-between border-b-2 border-slate-900 pb-4 mb-4 print:pb-2 print:mb-2 gap-4 font-sans text-left relative z-10">
                            {DbController.getSchoolInfo().logoUrl ? (
                              <img 
                                src={DbController.getSchoolInfo().logoUrl} 
                                alt="School Logo" 
                                className="w-20 h-20 object-contain flex-shrink-0" 
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center border border-slate-300 p-1 flex-shrink-0">
                                <div className="w-full h-full rounded-full border border-dashed border-slate-400 bg-white flex flex-col items-center justify-center text-[8px] text-slate-500 font-mono font-bold leading-normal">
                                  <Award size={24} className="text-indigo-600 mb-1" />
                                  <span className="scale-75 origin-center uppercase">CREST</span>
                                </div>
                              </div>
                            )}
                            <div className="flex-1 text-center space-y-0.5">
                              <h2 className="text-2xl font-black text-slate-950 tracking-tight leading-tight uppercase font-display text-center">
                                {DbController.getSchoolInfo().name}
                              </h2>
                              <p className="text-xs italic font-serif text-slate-600 text-center">
                                Motto: "{DbController.getSchoolInfo().motto}"
                              </p>
                              <div className="text-[10px] text-slate-500 font-sans flex flex-wrap justify-center gap-x-3 gap-y-0.5 mt-0.5 leading-normal">
                                {DbController.getSchoolInfo().gpsAddress && <span>📍 {DbController.getSchoolInfo().gpsAddress}</span>}
                                {DbController.getSchoolInfo().telephone && <span>☎️ {DbController.getSchoolInfo().telephone}</span>}
                                {DbController.getSchoolInfo().email && <span>📧 {DbController.getSchoolInfo().email}</span>}
                              </div>
                              <div className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-semibold flex justify-center gap-3 mt-0.5">
                                {DbController.getSchoolInfo().emisCode && <span>EMIS ID: {DbController.getSchoolInfo().emisCode}</span>}
                                {DbController.getSchoolInfo().schoolNumber && <span>SCHOOL ID: {DbController.getSchoolInfo().schoolNumber}</span>}
                              </div>
                              <p className="text-[10px] font-mono text-slate-800 font-bold uppercase tracking-wider bg-slate-100 px-3.5 py-0.5 rounded-full inline-block mt-2">
                                Official Student Progress Statement Card
                              </p>
                            </div>
                            
                            {student.photoUrl ? (
                              <img 
                                src={student.photoUrl} 
                                alt={`${student.firstName} ${student.lastName}`} 
                                className="w-16 h-16 rounded border border-slate-300 object-cover flex-shrink-0 student-report-photo" 
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-16 h-16 rounded border border-dashed border-slate-300 flex flex-col items-center justify-center bg-slate-50 p-1 flex-shrink-0 text-[7px] text-slate-400 font-mono text-center leading-normal select-none student-report-photo-placeholder">
                                <div className="font-bold scale-90">PASSPORT</div>
                                <div className="scale-75">STAMP</div>
                              </div>
                            )}
                          </div>

                          {/* Student Personal Data metadata */}
                          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 bg-slate-50 p-3 rounded-xl text-xs leading-relaxed border border-slate-100">
                            <div>
                              <span className="text-[10px] uppercase text-slate-400 font-mono font-medium block">Student ID</span>
                              <strong className="text-slate-800 font-mono text-sm">{student.id}</strong>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase text-slate-400 font-mono font-medium block">Full Name</span>
                              <strong className="text-slate-800 text-sm">{student.firstName} {student.lastName}</strong>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase text-slate-400 font-mono font-medium block">Academic Class</span>
                              <strong className="text-slate-800 text-sm">{student.class} ({student.section})</strong>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase text-slate-400 font-mono font-medium block">Report Term</span>
                              <strong className="text-slate-800 text-sm font-mono">{selectedTerm} ({selectedYear})</strong>
                            </div>
                            <div className="relative group cursor-help bg-indigo-50/30 p-1.5 rounded-lg border border-indigo-100/50 transition-all hover:bg-indigo-50/80">
                              <span className="text-[10px] uppercase text-indigo-700 font-mono font-bold flex items-center gap-1 select-none">
                                Class Rank Standing <HelpCircle size={10} className="text-indigo-400" />
                              </span>
                              <strong className="text-indigo-900 text-sm font-mono font-bold">{report.classRank || 'N/A'}</strong>
                              <RankBreakdownTooltip 
                                term={selectedTerm} 
                                year={selectedYear} 
                                averageScore={report.averageScore} 
                                gradedCount={report.gradedCount} 
                              />
                            </div>
                            <div>
                              <span className="text-[10px] uppercase text-teal-700 font-mono font-bold block">Reopening Date</span>
                              <strong className="text-teal-900 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100 text-sm">{formatReopeningDate(DbController.getSchoolInfo().reopeningDate)}</strong>
                            </div>
                          </div>

                          {/* Registered Subjects grades table */}
                          <table className="w-full text-left border-collapse border border-slate-200 text-xs mt-4">
                            <thead>
                              <tr className="bg-slate-100 border-b-2 border-slate-800">
                                <th className="py-1.5 px-3 border border-slate-200 font-bold uppercase tracking-wider">Subject Course</th>
                                <th className="py-1.5 px-2 border border-slate-200 font-bold text-center uppercase tracking-wider">Class 50%</th>
                                <th className="py-1.5 px-2 border border-slate-200 font-bold text-center uppercase tracking-wider">Exams 50%</th>
                                <th className="py-1.5 px-2 border border-slate-200 font-bold text-center uppercase tracking-wider">Total 100%</th>
                                <th className="py-1.5 px-3 border border-slate-200 font-bold text-center uppercase tracking-wider">Remarks</th>
                                <th className="py-1.5 px-2 border border-slate-200 font-bold text-center uppercase tracking-wider">Rank</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {report.grades.map((item) => (
                                <tr key={item.id} className={`hover:bg-slate-50/40 print:h-7 assessment-grade-row ${(!item.totalScore || item.totalScore === 0) ? 'assessment-grade-empty' : ''}`}>
                                  <td className="py-1.5 px-3 print:py-1 border border-slate-200 font-black text-slate-900 text-sm">{item.subject}</td>
                                  <td className="py-1.5 px-2 print:py-1 border border-slate-200 text-center font-mono font-bold text-slate-700 text-sm">{item.classScore50}</td>
                                  <td className="py-1.5 px-2 print:py-1 border border-slate-200 text-center font-mono font-bold text-slate-700 text-sm">{item.examScore50}</td>
                                  <td className="py-1.5 px-2 print:py-1 border border-slate-200 text-center font-mono font-black text-rose-700 bg-rose-50/10 text-sm">{item.totalScore}%</td>
                                  <td className="py-1.5 px-3 print:py-1 border border-slate-200 text-center">
                                    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black ${item.gradeLevel === 'L1' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : item.gradeLevel === 'L2' ? 'bg-blue-50 text-blue-800 border border-blue-100' : item.gradeLevel === 'L3' ? 'bg-amber-50 text-amber-800 border border-amber-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>
                                      {item.remarks} ({item.gradeLevel})
                                    </span>
                                  </td>
                                  <td className="py-1.5 px-2 print:py-1 border border-slate-200 text-center font-mono font-black text-indigo-700 text-sm">{item.position ? `${item.position}` : 'N/A'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          {/* Report Card Aggregates Footer summary */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 border-t border-slate-200 pt-4 text-xs text-center font-mono leading-relaxed">
                            <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                              <span className="text-slate-400 font-sans block text-[10px] uppercase font-semibold">Subjects Graded</span>
                              <strong className="text-slate-800 text-sm">{report.totalSubjects} courses</strong>
                            </div>
                            <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                              <span className="text-slate-400 font-sans block text-[10px] uppercase font-semibold">Term Average Score</span>
                              <strong className="text-slate-800 text-sm italic">{report.averageScore}%</strong>
                            </div>
                            <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                              <span className="text-slate-400 font-sans block text-[10px] uppercase font-semibold">Attendance / School Open</span>
                              <strong className="text-slate-800 text-sm font-sans">{report.attendancePresent} / {report.schoolOpenDays} Days Present</strong>
                            </div>
                            <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                              <span className="text-slate-400 font-sans block text-[10px] uppercase font-semibold">Grade Rating</span>
                              <strong className="text-slate-800 text-sm">GES Certified</strong>
                            </div>
                          </div>

                          {/* Financial Ledger Section */}
                          {financials && (
                            <div className="mt-4 bg-slate-50 border border-slate-200/80 rounded-xl p-3 font-sans text-xs flex flex-col md:flex-row justify-between gap-4 leading-normal print:bg-white print:border-slate-300">
                              <div className="space-y-1">
                                <div className="text-slate-500 uppercase tracking-wider text-[9px] font-black">Current Balance Status</div>
                                <div className="flex items-baseline gap-2">
                                  <span className={`text-base font-black ${financials.totalOutstanding > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                    GHS {financials.totalOutstanding.toFixed(2)}
                                  </span>
                                  {financials.totalOutstanding > 0 && financials.previousOutstanding > 0 && (
                                    <span className="text-[10px] text-slate-400">
                                      (Term: GHS {financials.currentOutstanding.toFixed(2)} | Arrears: GHS {financials.previousOutstanding.toFixed(2)})
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-sans">Outstanding student balance of registered accounts ledger.</div>
                              </div>
                              <div className="border-t md:border-t-0 md:border-l border-slate-250 md:pl-6 pt-3 md:pt-0 space-y-1">
                                <div className="text-slate-500 uppercase tracking-wider text-[9px] font-black">Next Term Projected Bill ({financials.nextTerm}, {financials.nextYear})</div>
                                <div className="flex items-baseline gap-1.5">
                                  <span className="text-base font-bold text-slate-800">
                                    GHS {financials.nextTermBillSum.toFixed(2)}
                                  </span>
                                  {financials.isEstimated && (
                                    <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-black font-mono">Estimated Rate</span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-sans">Projected billing plan for the upcoming academic module term.</div>
                              </div>
                            </div>
                          )}

                          {/* Remarks & Signatures desk */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10 border-t border-slate-100 pt-4 text-xs">
                            <div className="space-y-2 text-left">
                              <span className="text-[10px] font-mono text-slate-500 uppercase font-black">Principal Headteacher Remarks</span>
                              <p className="text-[11px] italic text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200/50 leading-relaxed min-h-[70px] print:bg-white print:border-none">
                                {report.averageScore >= 80 
                                  ? 'Excellent performance! The student reflects high mastery level standards on the GES curriculum benchmarks.' 
                                  : report.averageScore >= 68 
                                  ? 'Satisfactory progress. Proficient level achieved across most cognitive subject domains.' 
                                  : report.averageScore >= 54 
                                  ? 'An average term result. Needs more dedication and revision in quantitative sciences.' 
                                  : 'Underperforming benchmarks. Urgent tutoring is recommended to foster remediation.'}
                              </p>
                            </div>

                            <div className="flex flex-col justify-end items-end space-y-1.5 pr-6 relative">
                              <div className="relative w-52 h-16 flex items-center justify-center">
                                {DbController.getSchoolInfo().stampUrl && (
                                  <img 
                                    src={DbController.getSchoolInfo().stampUrl} 
                                    alt="School Stamp" 
                                    className="absolute w-20 h-20 object-contain opacity-75 z-0 transform -rotate-12 translate-x-[-15%] translate-y-[-5%]" 
                                    referrerPolicy="no-referrer"
                                  />
                                )}
                                {DbController.getSchoolInfo().signatureUrl ? (
                                  <img 
                                    src={DbController.getSchoolInfo().signatureUrl} 
                                    alt="Headteacher Signature" 
                                    className="absolute w-36 h-12 object-contain z-10" 
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="h-[1.5px] w-52 bg-slate-400 self-end"></div>
                                )}
                              </div>
                              {DbController.getSchoolInfo().signatureUrl && <div className="h-[1px] w-52 bg-slate-300"></div>}
                              <div className="text-right">
                                {DbController.getSchoolInfo().headteacherName && (
                                  <span className="font-bold text-[10px] text-slate-800 block leading-tight">{DbController.getSchoolInfo().headteacherName}</span>
                                )}
                                <span className="text-[10px] text-slate-500 font-serif font-semibold">Signature of Headteacher</span>
                              </div>
                            </div>
                          </div>

                          {/* visual card tag */}
                          <div className="absolute top-4 right-4 bg-slate-100 text-slate-500 font-mono text-[9px] font-bold px-2.5 py-1 rounded select-none no-print">
                            Batch Report Card Draft #{batchIdx + 1} of {bulkClassReports.length}
                          </div>

                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            </div>
          )}

        </div>
      )}

      {/* Immersive Fullscreen Preview Mode for Report Card */}
          {reportCardPreviewMode && compiledReport && (
            <div 
              onClick={(e) => {
                if (e.target === e.currentTarget) setReportCardPreviewMode(false);
              }}
              className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-50 overflow-y-auto flex flex-col items-center py-6 px-4 no-scrollbar font-sans text-xs cursor-pointer"
            >
              <div onClick={(e) => e.stopPropagation()} className="w-full max-w-4xl flex flex-col items-center cursor-default">
              
              {/* Immersive Preview Header Controls Bar (no-print) */}
              <div className="w-full max-w-4xl bg-white border border-slate-200 p-4 rounded-xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 no-print">
                <div className="flex flex-wrap items-center gap-4 text-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    <span className="font-bold text-slate-900 font-display">PRISTINE REPORT CARD PREVIEW</span>
                  </div>
                  
                  <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                    <span className="text-slate-500 font-medium">Target Student:</span>
                    <select
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 font-bold focus:outline-none text-slate-900"
                    >
                      {students.filter(s => s.class === selectedClass).map(s => (
                        <option key={s.id} value={s.id}>
                          {s.firstName} {s.lastName} ({s.id})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    disabled={teacherPermissions?.canExportReports === false}
                    onClick={() => {
                      if (teacherPermissions?.canExportReports === false) {
                        alert("Permission to export reports has been suspended by the Headteacher.");
                        return;
                      }
                      setShowPdfGuide(!showPdfGuide);
                    }}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 ${
                      teacherPermissions?.canExportReports === false
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-65'
                        : 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer active:translate-y-0.5'
                    } transition font-bold rounded-lg text-xs text-center`}
                  >
                    <Printer size={14} /> PDF & Cloud Export Options
                  </button>

                  <button
                    type="button"
                    onClick={triggerSmsModal}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white transition font-bold rounded-lg cursor-pointer active:translate-y-0.5 text-xs text-center shadow-md select-none"
                  >
                    <Smartphone size={14} /> Notify Parent via SMS
                  </button>

                  <button
                    type="button"
                    disabled={teacherPermissions?.canExportReports === false}
                    onClick={() => {
                      if (teacherPermissions?.canExportReports === false) {
                        alert("Permission to export reports has been suspended by the Headteacher.");
                        return;
                      }
                      handlePrint();
                    }}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 ${
                      teacherPermissions?.canExportReports === false
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-65'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer active:translate-y-0.5'
                    } transition font-bold rounded-lg text-xs text-center shadow-md`}
                  >
                    <Printer size={14} /> Direct Print
                  </button>

                  <button
                    type="button"
                    onClick={() => setReportCardPreviewMode(false)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 border border-slate-200 hover:bg-slate-100/90 text-slate-750 transition font-bold rounded-lg cursor-pointer active:translate-y-0.5 text-xs text-center bg-slate-50"
                  >
                    <EyeOff size={14} className="text-slate-500" /> Exit Preview
                  </button>
                </div>
              </div>

              {/* Full-Scale A4 Visual Report Card Sheet (Target of print template) */}
              <div className="w-full max-w-4xl bg-white p-12 md:p-16 shadow-2xl rounded-2xl border border-slate-200 font-sans leading-relaxed text-black/90 text-left report-card-print-container">
                
                {/* Professional School Profile Header with Crest, Logo & Info */}
                <div className="flex flex-col sm:flex-row items-center justify-between border-b-2 border-slate-900 pb-5 mb-8 gap-4 font-sans text-left">
                  {DbController.getSchoolInfo().logoUrl ? (
                    <img 
                      src={DbController.getSchoolInfo().logoUrl} 
                      alt="School Logo" 
                      className="w-20 h-20 object-contain flex-shrink-0" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center border border-slate-300 p-1 flex-shrink-0">
                      <div className="w-full h-full rounded-full border border-dashed border-slate-400 bg-white flex flex-col items-center justify-center text-[8px] text-slate-500 font-mono font-bold leading-normal">
                        <Award size={24} className="text-indigo-600 mb-1" />
                        <span className="scale-75 origin-center uppercase">CREST</span>
                      </div>
                    </div>
                  )}
                  <div className="flex-1 text-center space-y-0.5">
                    <h2 className="text-2xl font-black text-slate-950 tracking-tight leading-tight uppercase font-display">
                      {DbController.getSchoolInfo().name}
                    </h2>
                    <p className="text-xs italic font-serif text-slate-600">
                      Motto: "{DbController.getSchoolInfo().motto}"
                    </p>
                    <div className="text-[10px] text-slate-500 font-sans flex flex-wrap justify-center gap-x-3 gap-y-0.5 mt-0.5">
                      {DbController.getSchoolInfo().gpsAddress && <span>📍 {DbController.getSchoolInfo().gpsAddress}</span>}
                      {DbController.getSchoolInfo().telephone && <span>☎️ {DbController.getSchoolInfo().telephone}</span>}
                      {DbController.getSchoolInfo().email && <span>📧 {DbController.getSchoolInfo().email}</span>}
                    </div>
                    <div className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-semibold flex justify-center gap-3">
                      {DbController.getSchoolInfo().emisCode && <span>EMIS: {DbController.getSchoolInfo().emisCode}</span>}
                      {DbController.getSchoolInfo().schoolNumber && <span>CODE: {DbController.getSchoolInfo().schoolNumber}</span>}
                    </div>
                    <p className="text-[10px] font-mono text-slate-800 font-bold uppercase tracking-wider bg-slate-100 px-3.5 py-0.5 rounded-full inline-block mt-2">
                      Official Student Progress Statement Card
                    </p>
                  </div>
                  {compiledReport.student.photoUrl ? (
                    <img 
                      src={compiledReport.student.photoUrl} 
                      alt={`${compiledReport.student.firstName} ${compiledReport.student.lastName}`} 
                      className="w-16 h-16 rounded border border-slate-300 object-cover flex-shrink-0" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded border border-dashed border-slate-300 flex flex-col items-center justify-center bg-slate-50 p-1 flex-shrink-0 text-[7px] text-slate-400 font-mono text-center leading-normal select-none">
                      <div className="font-bold scale-90">PASSPORT</div>
                      <div className="scale-75">STAMP</div>
                    </div>
                  )}
                </div>

                {/* Student Personal Data metadata */}
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 bg-slate-50 p-5 rounded-xl text-xs leading-relaxed border border-slate-100">
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-mono font-medium block">Student ID</span>
                    <strong className="text-slate-800 font-mono text-sm">{compiledReport.student.id}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-mono font-medium block">Full Name</span>
                    <strong className="text-slate-800 text-sm">{compiledReport.student.firstName} {compiledReport.student.lastName}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-mono font-medium block">Academic Class</span>
                    <strong className="text-slate-800 text-sm">{compiledReport.student.class} ({compiledReport.student.section})</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-mono font-medium block">Report Term</span>
                    <strong className="text-slate-800 text-sm font-mono">{selectedTerm} ({selectedYear})</strong>
                  </div>
                  <div className="relative group cursor-help bg-indigo-50/30 p-1.5 rounded-lg border border-indigo-100/50 transition-all hover:bg-indigo-50/80">
                    <span className="text-[10px] uppercase text-indigo-700 font-mono font-bold flex items-center gap-1 select-none">
                      Class Rank Standing <HelpCircle size={10} className="text-indigo-400" />
                    </span>
                    <strong className="text-indigo-900 text-sm font-mono font-bold">{compiledReport.classRank || 'N/A'}</strong>
                    <RankBreakdownTooltip 
                      term={selectedTerm} 
                      year={selectedYear} 
                      averageScore={compiledReport.averageScore} 
                      gradedCount={compiledReport.gradedCount} 
                    />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-teal-700 font-mono font-bold block">Reopening Date</span>
                    <strong className="text-teal-900 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100 text-sm">{formatReopeningDate(DbController.getSchoolInfo().reopeningDate)}</strong>
                  </div>
                </div>

                {/* Registered Subjects grades table */}
                <table className="w-full text-left border-collapse border border-slate-200 text-xs mt-8">
                  <thead>
                    <tr className="bg-slate-100 border-b-2 border-slate-800">
                      <th className="py-3 px-3 border border-slate-200 font-bold uppercase tracking-wider">Subject Course</th>
                      <th className="py-3 px-2 border border-slate-200 font-bold text-center uppercase tracking-wider">Class 50%</th>
                      <th className="py-3 px-2 border border-slate-200 font-bold text-center uppercase tracking-wider">Exams 50%</th>
                      <th className="py-3 px-2 border border-slate-200 font-bold text-center uppercase tracking-wider">Total 100%</th>
                      <th className="py-3 px-3 border border-slate-200 font-bold text-center uppercase tracking-wider">Remarks</th>
                      <th className="py-3 px-2 border border-slate-200 font-bold text-center uppercase tracking-wider">Rank</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {compiledReport.grades.map((item, index) => (
                      <motion.tr 
                        key={item.id} 
                        className="hover:bg-slate-50/40"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.4), ease: 'easeOut' }}
                      >
                        <td className="py-3 px-3 border border-slate-200 font-black text-slate-900 text-sm">{item.subject}</td>
                        <td className="py-3 px-2 border border-slate-200 text-center font-mono font-bold text-slate-700 text-sm">{item.classScore50}</td>
                        <td className="py-3 px-2 border border-slate-200 text-center font-mono font-bold text-slate-700 text-sm">{item.examScore50}</td>
                        <td className="py-3 px-2 border border-slate-200 text-center font-mono font-black text-rose-700 bg-rose-50/10 text-sm">{item.totalScore}%</td>
                        <td className="py-3 px-3 border border-slate-200 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black ${item.gradeLevel === 'L1' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : item.gradeLevel === 'L2' ? 'bg-blue-50 text-blue-800 border border-blue-100' : item.gradeLevel === 'L3' ? 'bg-amber-50 text-amber-800 border border-amber-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>
                            {item.remarks} ({item.gradeLevel})
                          </span>
                        </td>
                        <td className="py-3 px-2 border border-slate-200 text-center font-mono font-black text-indigo-700 text-sm">{item.position ? `${item.position}` : 'N/A'}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>

                {/* Report Card Aggregates Footer summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 border-t border-slate-200 pt-6 text-xs text-center font-mono leading-relaxed">
                  <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                    <span className="text-slate-400 font-sans block text-[10px] uppercase font-semibold">Subjects Graded</span>
                    <strong className="text-slate-800 text-sm">{compiledReport.totalSubjects} courses</strong>
                  </div>
                  <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                    <span className="text-slate-400 font-sans block text-[10px] uppercase font-semibold">Term Average Score</span>
                    <strong className="text-slate-800 text-sm italic">{compiledReport.averageScore}%</strong>
                  </div>
                  <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                    <span className="text-slate-400 font-sans block text-[10px] uppercase font-semibold">Attendance / School Open</span>
                    <strong className="text-slate-800 text-sm font-sans">{compiledReport.attendancePresent} / {compiledReport.schoolOpenDays} Days Present</strong>
                  </div>
                  <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                    <span className="text-slate-400 font-sans block text-[10px] uppercase font-semibold">Grade Rating</span>
                    <strong className="text-slate-800 text-sm uppercase">GES Certified</strong>
                  </div>
                </div>

                {/* Financial Ledger Section */}
                {studentFinancials && (
                  <div className="mt-6 bg-slate-50 border border-slate-200/80 rounded-xl p-4 font-sans text-xs flex flex-col md:flex-row justify-between gap-4 leading-normal print:bg-white print:border-slate-300">
                    <div className="space-y-1">
                      <div className="text-slate-500 uppercase tracking-wider text-[9px] font-black">Current Balance Status</div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-base font-black ${studentFinancials.totalOutstanding > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                          GHS {studentFinancials.totalOutstanding.toFixed(2)}
                        </span>
                        {studentFinancials.totalOutstanding > 0 && studentFinancials.previousOutstanding > 0 && (
                          <span className="text-[10px] text-slate-400">
                            (Term: GHS {studentFinancials.currentOutstanding.toFixed(2)} | Arrears: GHS {studentFinancials.previousOutstanding.toFixed(2)})
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">Outstanding student balance of registered accounts ledger.</div>
                    </div>
                    <div className="border-t md:border-t-0 md:border-l border-slate-250 md:pl-6 pt-3 md:pt-0 space-y-1">
                      <div className="text-slate-500 uppercase tracking-wider text-[9px] font-black">Next Term Projected Bill ({studentFinancials.nextTerm}, {studentFinancials.nextYear})</div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-base font-bold text-slate-800">
                          GHS {studentFinancials.nextTermBillSum.toFixed(2)}
                        </span>
                        {studentFinancials.isEstimated && (
                          <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-black font-mono">Estimated Rate</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">Projected billing plan for the upcoming academic module term.</div>
                    </div>
                  </div>
                )}

                {/* Remarks & Signatures desk */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-16 border-t border-slate-100 pt-8 text-xs">
                  <div className="space-y-2 text-left">
                    <span className="text-[10px] font-mono text-slate-500 uppercase font-black">Principal Headteacher Remarks</span>
                    <p className="text-[11px] italic text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200/50 leading-relaxed min-h-[70px] print:bg-white print:border-none">
                      {compiledReport.averageScore >= 80 
                        ? 'Excellent performance! The student reflects high mastery level standards on the GES curriculum benchmarks.' 
                        : compiledReport.averageScore >= 68 
                        ? 'Satisfactory progress. Proficient level achieved across most cognitive subject domains.' 
                        : compiledReport.averageScore >= 54 
                        ? 'An average term result. Needs more dedication and revision in quantitative sciences.' 
                        : 'Underperforming benchmarks. Urgent tutoring is recommended to foster remediation.'}
                    </p>
                  </div>

                  <div className="flex flex-col justify-end items-end space-y-1.5 pr-6 relative">
                    <div className="relative w-52 h-16 flex items-center justify-center">
                      {DbController.getSchoolInfo().stampUrl && (
                        <img 
                          src={DbController.getSchoolInfo().stampUrl} 
                          alt="School Stamp" 
                          className="absolute w-20 h-20 object-contain opacity-75 z-0 transform -rotate-12 translate-x-[-15%] translate-y-[-5%]" 
                          referrerPolicy="no-referrer"
                        />
                      )}
                      {DbController.getSchoolInfo().signatureUrl ? (
                        <img 
                          src={DbController.getSchoolInfo().signatureUrl} 
                          alt="Headteacher Signature" 
                          className="absolute w-36 h-12 object-contain z-10" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="h-[1.5px] w-52 bg-slate-400 self-end"></div>
                      )}
                    </div>
                    {DbController.getSchoolInfo().signatureUrl && <div className="h-[1px] w-52 bg-slate-300"></div>}
                    <div className="text-right">
                      {DbController.getSchoolInfo().headteacherName && (
                        <span className="font-bold text-[10px] text-slate-800 block leading-tight">{DbController.getSchoolInfo().headteacherName}</span>
                      )}
                      <span className="text-[10px] text-slate-500 font-serif font-semibold">Signature of Headteacher</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Quick print guideline inside full preview */}
              <div className="w-full max-w-4xl text-center py-4 bg-slate-850 rounded-xl mt-6 text-[11px] text-slate-300 flex items-center justify-center gap-1.5 no-print border border-slate-800">
                <AlertCircle size={14} className="text-amber-400" />
                <span>Clean and pristine print layout environment.</span>
              </div>

            </div>
          </div>
        )}

        {worksheetPreviewMode && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) setWorksheetPreviewMode(false);
            }}
            className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-50 overflow-y-auto flex flex-col items-center py-6 px-4 no-scrollbar font-sans text-xs cursor-pointer"
          >
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-7xl flex flex-col items-center cursor-default bg-white p-6 rounded-xl shadow-xl mt-4">
              <div className="w-full flex items-center justify-between border-b pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm uppercase">Marks Input Sheet Immersive Widescreen Preview</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full font-semibold">Class: {selectedClass}</span>
                  <span className="text-[10px] bg-teal-50 border border-teal-100 text-teal-700 px-2.5 py-1 rounded-full font-semibold">Subject: {selectedSubject}</span>
                  {isAutoSave && <span className="text-[10px] bg-emerald-50 border border-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-semibold">Auto-Save Active</span>}
                  <button
                    type="button"
                    onClick={() => handlePrintElement('marks-input-sheet-table-container', 'Marks Input Sheet', true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg cursor-pointer text-xs transition"
                    title="Print Marks Input Sheet"
                  >
                    <Printer size={13} /> Print
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePdfDownloadElement('marks-input-sheet-table-container', `Marks_Input_Sheet_${selectedClass}_${selectedSubject}`, true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer text-xs transition shadow-sm"
                    title="Download Marks Input Sheet as PDF"
                  >
                    <FileDown size={13} /> Download PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorksheetPreviewMode(false)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 border border-slate-200 hover:bg-slate-100/90 text-slate-755 transition font-bold rounded-lg cursor-pointer text-xs bg-slate-50"
                  >
                    <EyeOff size={13} /> Exit Preview
                  </button>
                </div>
              </div>

              {/* Duplicate editable worksheet table */}
              <div id="marks-input-sheet-table-container" className="w-full overflow-x-auto border border-slate-200 rounded-lg bg-white">
                {activeWorksheet.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 space-y-2">
                    <AlertCircle size={32} className="text-slate-300 mx-auto" />
                    <h4 className="font-bold text-slate-600">No Student Rolls Available</h4>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse table-fixed min-w-[900px] text-[11px]">
                    <thead>
                      <tr className="bg-slate-50/85 border-b border-slate-200 text-slate-600">
                        <th className="py-2.5 px-2 font-black text-slate-500 w-12 text-center">No</th>
                        <th className="py-2.5 px-2 font-black text-slate-500 w-48 truncate">Student Full Name</th>
                        {DbController.getAssessmentTemplate(selectedClass, selectedYear, selectedTerm, selectedSubject) ? (
                          DbController.getAssessmentTemplate(selectedClass, selectedYear, selectedTerm, selectedSubject)!.components.map((comp, idx) => (
                            <th key={`c-${idx}`} className={`py-2.5 px-1 font-bold text-slate-600 text-center bg-blue-50/40 font-mono ${idx === 0 ? 'border-l border-slate-200' : ''}`}>
                              {comp.name} ({comp.maxScore})
                            </th>
                          ))
                        ) : (
                          <>
                            <th className="py-2.5 px-1 font-bold text-slate-600 text-center bg-blue-50/40 border-l border-slate-200 font-mono">Ex 1 (10)</th>
                            <th className="py-2.5 px-1 font-bold text-slate-600 text-center bg-blue-50/40 font-mono">Ex 2 (10)</th>
                            <th className="py-2.5 px-1 font-bold text-slate-600 text-center bg-blue-50/40 font-mono">Ex 3 (10)</th>
                            <th className="py-2.5 px-1 font-bold text-slate-600 text-center bg-blue-50/40 font-mono">Ex 4 (10)</th>
                            <th className="py-2.5 px-1 font-bold text-slate-600 text-center bg-teal-50/40 border-l border-slate-200 font-mono">Ts 1 (20)</th>
                            <th className="py-2.5 px-1 font-bold text-slate-600 text-center bg-teal-50/40 font-mono">Ts 2 (20)</th>
                            <th className="py-2.5 px-1 font-bold text-slate-600 text-center bg-amber-50/40 border-l border-slate-200 font-mono">Proj (10)</th>
                            <th className="py-2.5 px-1 font-bold text-slate-600 text-center bg-amber-50/40 font-mono">Grp (10)</th>
                          </>
                        )}
                        <th className="py-2.5 px-1 font-bold text-slate-700 text-center bg-slate-100 border-l border-slate-200 font-mono">Class 50%</th>
                        <th className="py-2.5 px-1.5 font-bold text-slate-600 text-center bg-indigo-50 border-l border-slate-200 font-mono">Exam (100)</th>
                        <th className="py-2.5 px-1 font-bold text-slate-700 text-center bg-indigo-50 font-mono">Exam 50%</th>
                        <th className="py-2.5 px-1 font-black text-slate-900 text-center border-l border-slate-200 font-mono">Total (100)</th>
                        <th className="py-2.5 px-1 font-bold text-slate-700 text-center bg-emerald-50">Remark</th>
                        <th className="py-2.5 px-1 font-black text-indigo-700 text-center bg-purple-50">Pos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeWorksheet.map((row, idx) => (
                        <motion.tr 
                          key={row.studentId} 
                          className="hover:bg-slate-50/20 transition"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.4), ease: 'easeOut' }}
                        >
                          <td className="py-1 px-1.5 text-center font-mono text-slate-300 font-bold">{idx + 1}</td>
                          <td className={`py-1 px-2 font-semibold text-slate-800 truncate leading-tight font-sans text-left ${validationErrors[`duplicate-${row.studentId}`] ? 'bg-rose-50 border-2 border-rose-500' : ''}`} title={validationErrors[`duplicate-${row.studentId}`]}>
                            <div>{row.studentName}</div>
                            <span className="text-[9px] text-slate-400 font-mono font-normal">ID: {row.studentId}</span>
                          </td>
                          {DbController.getAssessmentTemplate(selectedClass, selectedYear, selectedTerm, selectedSubject) ? (
                            DbController.getAssessmentTemplate(selectedClass, selectedYear, selectedTerm, selectedSubject)!.components.map((comp, exIdx) => (
                              <td key={`c-${exIdx}`} className={`py-1 px-0.5 bg-blue-50/10 ${exIdx === 0 ? 'border-l border-slate-100' : ''}`}>
                                <input
                                  type="number"
                                  min="0"
                                  max={comp.maxScore}
                                  step="0.1"
                                  value={row.customAssessments?.[exIdx] || 0}
                                  onChange={(e) => handleScoreInput(row.studentId, 'customAssessments', exIdx, e.target.value)}
                                  className={`w-full text-center py-1 text-xs font-semibold bg-white border rounded focus:bg-slate-50 focus:border-indigo-400 focus:outline-none font-mono ${validationErrors[`${row.studentId}-customAssessments-${exIdx}`] ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-200'}`}
                                  title={validationErrors[`${row.studentId}-customAssessments-${exIdx}`]}
                                />
                              </td>
                            ))
                          ) : (
                            <>
                              {[0, 1, 2, 3].map(exIdx => (
                                <td key={`ex-${exIdx}`} className="py-1 px-0.5 bg-blue-50/10 border-l border-slate-100">
                                  <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    step="0.1"
                                    value={row.exercises[exIdx] || 0}
                                    onChange={(e) => handleScoreInput(row.studentId, 'exercises', exIdx, e.target.value)}
                                    className={`w-full text-center py-1 text-xs font-semibold bg-white border rounded focus:bg-slate-50 focus:border-indigo-400 focus:outline-none font-mono ${validationErrors[`${row.studentId}-exercises-${exIdx}`] ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-200'}`}
                                    title={validationErrors[`${row.studentId}-exercises-${exIdx}`]}
                                  />
                                </td>
                              ))}
                              {[0, 1].map(tsIdx => (
                                <td key={`ts-${tsIdx}`} className="py-1 px-0.5 bg-teal-50/10 border-l border-slate-100">
                                  <input
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value={row.tests[tsIdx] || 0}
                                    onChange={(e) => handleScoreInput(row.studentId, 'tests', tsIdx, e.target.value)}
                                    className={`w-full text-center py-1 text-xs font-semibold bg-white border rounded focus:bg-slate-50 font-mono ${validationErrors[`${row.studentId}-tests-${tsIdx}`] ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-200'}`}
                                    title={validationErrors[`${row.studentId}-tests-${tsIdx}`]}
                                  />
                                </td>
                              ))}
                              <td className="py-1 px-0.5 bg-amber-50/10 border-l border-slate-100">
                                <input
                                  type="number"
                                  min="0"
                                  max="10"
                                  step="0.1"
                                  value={row.projectWork || 0}
                                  onChange={(e) => handleScoreInput(row.studentId, 'projectWork', 0, e.target.value)}
                                  className={`w-full text-center py-1 text-xs font-semibold bg-white border rounded focus:bg-slate-50 font-mono ${validationErrors[`${row.studentId}-projectWork-0`] ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-200'}`}
                                  title={validationErrors[`${row.studentId}-projectWork-0`]}
                                />
                              </td>
                              <td className="py-1 px-0.5 bg-amber-50/10">
                                <input
                                  type="number"
                                  min="0"
                                  max="10"
                                  step="0.1"
                                  value={row.groupWork || 0}
                                  onChange={(e) => handleScoreInput(row.studentId, 'groupWork', 0, e.target.value)}
                                  className={`w-full text-center py-1 text-xs font-semibold bg-white border rounded font-mono ${validationErrors[`${row.studentId}-groupWork-0`] ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-200'}`}
                                  title={validationErrors[`${row.studentId}-groupWork-0`]}
                                />
                              </td>
                            </>
                          )}
                          <td className="py-1 px-0.5 text-center font-bold text-slate-805 bg-slate-105 border-l border-slate-200 font-mono">
                            {row.classScore50} <span className="text-[9px] text-slate-400 block font-normal">/{row.classScoreTotal}</span>
                          </td>
                          <td className="py-1 px-0.5 bg-indigo-50/10 border-l border-slate-200">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={row.examScore100 || 0}
                              onChange={(e) => handleScoreInput(row.studentId, 'examScore100', 0, e.target.value)}
                              className={`w-full text-center py-1 text-xs font-semibold bg-white border rounded text-indigo-700 font-mono ${validationErrors[`${row.studentId}-examScore100-0`] ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-250'}`}
                              title={validationErrors[`${row.studentId}-examScore100-0`]}
                            />
                          </td>
                          <td className="py-1 px-0.5 text-center font-bold text-slate-700 bg-indigo-55 font-mono">
                            {row.examScore50}
                          </td>
                          <td className="py-1 px-0.5 text-center font-black text-rose-700 border-l border-slate-200 bg-slate-100 font-mono text-xs">
                            {row.totalScore}%
                          </td>
                          <td className="py-1 px-0.5 text-center bg-emerald-50 text-[10px] truncate leading-none">
                            <strong className="text-emerald-800">{row.remarks}</strong>
                            <span className="text-[8px] text-slate-400 block font-mono mt-0.5">GES: {row.gradeLevel}</span>
                          </td>
                          <td className="py-1 px-0.5 text-center bg-purple-50 text-indigo-800 font-black font-mono">
                            {row.position ? `${row.position}` : 'N/A'}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {!isAutoSave && (
                <div className="w-full mt-5 flex justify-end">
                  <button
                    onClick={() => {
                      handleManualSave();
                      setWorksheetPreviewMode(false);
                    }}
                    className={`flex items-center gap-1.5 px-6 py-2.5 rounded-xl font-black shadow-md cursor-pointer active:translate-y-0.5 transition ${theme.btnColors}`}
                  >
                    <Save size={14} /> Save Academic Marks & Exit
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {broadsheetPreviewMode && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) setBroadsheetPreviewMode(false);
            }}
            className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-50 overflow-y-auto flex flex-col items-center py-6 px-4 no-scrollbar font-sans text-xs cursor-pointer"
          >
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-7xl flex flex-col items-center cursor-default bg-white p-6 rounded-xl shadow-xl mt-4">
              <div className="w-full flex items-center justify-between border-b pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm uppercase">Class Cumulative Broadsheet Ledger Preview</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full font-semibold">Class: {selectedClass}</span>
                  <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full font-semibold">Term: {selectedTerm}</span>
                  <button
                    type="button"
                    onClick={() => handlePrintElement('broadsheet-ledger-table-container', 'Class Cumulative Broadsheet Ledger', true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg cursor-pointer text-xs transition"
                    title="Print Cumulative Broadsheet Ledger"
                  >
                    <Printer size={13} /> Print
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePdfDownloadElement('broadsheet-ledger-table-container', `Broadsheet_Ledger_${selectedClass}_${selectedTerm}`, true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer text-xs transition shadow-sm"
                    title="Download Cumulative Broadsheet Ledger as PDF"
                  >
                    <FileDown size={13} /> Download PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setBroadsheetPreviewMode(false)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 border border-slate-200 hover:bg-slate-100/90 text-slate-755 transition font-bold rounded-lg cursor-pointer text-xs bg-slate-50"
                  >
                    <EyeOff size={13} /> Exit Preview
                  </button>
                </div>
              </div>

              <div id="broadsheet-ledger-table-container" className="w-full overflow-x-auto border border-slate-200 rounded-lg bg-white">
                {broadsheetData.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    <AlertCircle size={32} className="text-slate-300 mx-auto mb-2" />
                    <span>No cumulative grades establishing broadsheet fields.</span>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-[11px] min-w-max">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <th className="py-2.5 px-3 text-center w-12 font-black">Rank</th>
                        <th className="py-2.5 px-2 w-48 font-black">Student Full Name</th>
                        {inputtedSubjects.map(sub => (
                          <th key={sub} className="py-2.5 px-1 text-center truncate font-bold">{sub.substring(0, 12)}...</th>
                        ))}
                        <th className="py-2.5 px-2 text-center bg-slate-100 font-bold">Subjects Graded</th>
                        <th className="py-2.5 px-2 text-center bg-indigo-50 font-black">Mean Term Avg</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {broadsheetData.map((row, index) => (
                        <motion.tr 
                          key={row.student.id} 
                          className="hover:bg-slate-50/20"
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.8), ease: 'easeOut' }}
                        >
                          <td className="py-2 px-3 text-center font-bold font-mono text-purple-700 bg-purple-50">{index + 1}</td>
                          <td className="py-2 px-2 font-semibold text-slate-800 font-sans">{row.student.firstName} {row.student.lastName}</td>
                          {inputtedSubjects.map(sub => {
                            const score = row.subjectScores[sub];
                            return (
                              <td key={sub} className="py-2 px-1 text-center font-mono font-semibold border-l border-slate-100">
                                {score !== undefined ? `${score}%` : <span className="text-slate-300">-</span>}
                              </td>
                            );
                          })}
                          <td className="py-2 px-2 text-center text-slate-550 font-mono bg-slate-50">{row.subjectsCount} registered</td>
                          <td className="py-2 px-2 text-center font-black bg-indigo-50 text-indigo-800 font-mono text-xs">{row.averageOverallScore}%</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {performancePreviewMode && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) setPerformancePreviewMode(false);
            }}
            className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-50 overflow-y-auto flex flex-col items-center py-6 px-4 no-scrollbar font-sans text-xs cursor-pointer"
          >
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-6xl flex flex-col items-center cursor-default bg-white p-6 rounded-xl shadow-xl mt-4">
              <div className="w-full flex items-center justify-between border-b pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm uppercase">Subject Performance Analytics Immersive Preview</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full font-semibold">Class: {selectedClass}</span>
                  <span className="text-[10px] bg-teal-50 border border-teal-100 text-teal-700 px-2.5 py-1 rounded-full font-semibold">Subject: {selectedSubject}</span>
                  <button
                    type="button"
                    onClick={() => setPerformancePreviewMode(false)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 border border-slate-200 hover:bg-slate-100/90 text-slate-755 transition font-bold rounded-lg cursor-pointer text-xs bg-slate-50"
                  >
                    <EyeOff size={13} /> Exit Preview
                  </button>
                </div>
              </div>

              {/* Main components in fullscreen */}
              <div className="w-full space-y-6 text-left">
                {/* Real-time KPI Statistics Ribbons */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Subject Class Average</span>
                      <strong className="text-xl font-black text-slate-900 tracking-tight font-mono">
                        {classPerformanceDetails.avgScore}%
                      </strong>
                    </div>
                    <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-sans text-sm">📊</div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Subject Pass Rate</span>
                      <strong className="text-xl font-black text-slate-900 tracking-tight font-mono">
                        {classPerformanceDetails.passRate}%
                      </strong>
                    </div>
                    <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center font-sans text-sm animate-pulse">🎯</div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Maximum / Minimum</span>
                      <strong className="text-xs font-black text-slate-900 tracking-tight font-mono block">
                        MAX {classPerformanceDetails.highestScore}% / MIN {classPerformanceDetails.lowestScore}%
                      </strong>
                    </div>
                    <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center font-sans text-sm">⭐</div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Graded Registry Pool</span>
                      <strong className="text-xl font-black text-slate-900 tracking-tight font-mono">
                        {classPerformanceDetails.gradedCount} Students
                      </strong>
                    </div>
                    <div className="w-9 h-9 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center font-sans text-sm">👥</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Chart Area */}
                  <div className="md:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Average Subject Scores (D3 Visualization)</h4>
                    <div className="flex gap-2 mb-2">
                        <button onClick={() => setChartView('Average')} className={`text-[10px] px-2 py-1 rounded ${chartView === 'Average' ? 'bg-indigo-600 text-white' : 'bg-slate-200'}`}>Average Grade</button>
                        <button onClick={() => setChartView('Trend')} className={`text-[10px] px-2 py-1 rounded ${chartView === 'Trend' ? 'bg-indigo-600 text-white' : 'bg-slate-200'}`}>Grade Trend</button>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-center">
                      <SubjectPerformanceChart data={chartView === 'Average' ? subjectAveragesData : subjectTrendData} viewType={chartView} />
                    </div>
                  </div>
                  <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-4">
                    <h3 className="font-bold text-slate-705 text-xs flex items-center gap-1.5 uppercase font-sans tracking-wide">
                      📊 Class Mastery Performance Distribution
                    </h3>
                    <div className="h-72 font-sans text-[10px]">
                      <ResponsiveContainer width="100%" height="100%" aspect={1.8}>
                        <BarChart data={gradeLevelsStats}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" interval={0} tick={{ fontSize: 9, fill: '#64748b' }} tickMargin={10} />
                          <YAxis />
                          <Tooltip wrapperStyle={{ fontSize: '10px' }} />
                          <Bar dataKey="value" name="Total Students" radius={[3, 3, 0, 0]}>
                            {gradeLevelsStats.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* GES Guidelines Map */}
                  <div className="bg-slate-100 border border-slate-200 rounded-xl p-5 space-y-4">
                    <h4 className="font-bold text-slate-700 flex items-center gap-1 uppercase text-xs tracking-wide">
                      <Sparkles className="text-amber-550" size={14} /> GES Framework Guidelines
                    </h4>
                    <div className="space-y-2.5 text-[11px] leading-relaxed">
                      <div className="flex items-start gap-2">
                        <span className="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded font-mono text-[10px]">L1</span>
                        <div>
                          <strong>Highly Proficient (80% - 100%)</strong>
                          <p className="text-[10px] text-slate-500 leading-normal">Student exceeds current expectations on learning units.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded font-mono text-[10px]">L2</span>
                        <div>
                          <strong>Proficient (68% - 79%)</strong>
                          <p className="text-[10px] text-slate-500 leading-normal">Student understands curriculum concepts well.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded font-mono text-[10px]">L3</span>
                        <div>
                          <strong>Approaching Proficiency (54% - 67%)</strong>
                          <p className="text-[10px] text-slate-500 leading-normal">Basic mastery benchmarks achieved.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded font-mono text-[10px]">L4</span>
                        <div>
                          <strong>Developing (40% - 53%)</strong>
                          <p className="text-[10px] text-slate-500 leading-normal">Fragile conceptual grasp. Guidance required.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded font-mono text-[10px]">L5</span>
                        <div>
                          <strong>Emerging (0% - 39%)</strong>
                          <p className="text-[10px] text-slate-500 leading-normal">Critical gaps in educational outcomes.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* SUBMODE C: CLASS BROADSHEET */}
      {subMode === 'Broadsheet' && (
        <div className="space-y-6">
          {/* Grades Finalization Status & SMS Desk */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 text-left no-print">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${isCurrentGradesFinalized ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
                  <span className="font-sans font-black text-slate-800 text-sm uppercase tracking-wide">
                    {isCurrentGradesFinalized ? 'Grades Status: Finalized & Locked' : 'Grades Status: In Progress (Draft)'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {isCurrentGradesFinalized 
                    ? `Grades are officially finalized for ${selectedClass} | ${selectedTerm} (${selectedYear}). Parent notification desk is now open.`
                    : `Compile and review cumulative class standings. Finalizing grades enables secure bulk parent SMS notifications.`}
                </p>
              </div>

              <button
                type="button"
                onClick={handleToggleFinalizeGrades}
                className={`py-2 px-4 rounded-xl text-xs font-black shadow-xs cursor-pointer transition flex items-center justify-center gap-1.5 active:translate-y-0.5 font-sans ${
                  isCurrentGradesFinalized 
                    ? 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {isCurrentGradesFinalized ? (
                  <>
                    <RotateCcw size={13} /> Unlock & Revert to Draft
                  </>
                ) : (
                  <>
                    <CheckCircle size={13} /> Finalize & Lock Term Grades
                  </>
                )}
              </button>
            </div>

            {/* Notification Portal Console - Open only when finalized */}
            {isCurrentGradesFinalized ? (
              <div className="pt-5 space-y-4 animate-fade-in">
                <div className="bg-indigo-50/40 border border-indigo-100/80 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-indigo-900 uppercase tracking-tight flex items-center gap-1.5">
                      <Smartphone size={14} className="text-indigo-600" />
                      Bulk Parent 'Report Card Ready' SMS Desk
                    </h4>
                    <p className="text-[11px] text-indigo-700/80 leading-normal max-w-2xl">
                      Transmit secure, private, one-click report card digital portal links directly to guardians via SMS using the Twilio API.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-250">
                      Twilio Status: {DbController.getSchoolInfo().twilioEnabled ? (
                        <span className="text-emerald-600 font-bold">Enabled</span>
                      ) : (
                        <span className="text-amber-600 font-semibold">Sandbox Preview (OFF)</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* SMS Template Customizer */}
                <div className="space-y-2">
                  <label className="block text-[10px] text-slate-500 uppercase font-black tracking-wide">
                    SMS Message Body Template
                  </label>
                  <p className="text-[9px] text-slate-400 italic">
                    Supported placeholder tags: <strong className="text-slate-600">[Parent]</strong>, <strong className="text-slate-600">[Student]</strong>, <strong className="text-slate-600">[ID]</strong>, <strong className="text-slate-600">[Link]</strong> (Auto-inserts cryptographic parent access portal url)
                  </p>
                  <textarea
                    rows={3}
                    value={bulkSmsCustomMessage}
                    onChange={(e) => setBulkSmsCustomMessage(e.target.value)}
                    className="w-full text-xs p-3 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none transition leading-relaxed text-slate-700"
                    placeholder="Enter customized notification body text..."
                  />

                  {/* Safe Live Preview (Fictional Example) to avoid Data breach / PII leaks on screen */}
                  <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-1">
                    <span className="text-[9.5px] font-black uppercase text-indigo-850 font-sans tracking-wide block">🛡 GDPR Shield: Safe Fictional Preview</span>
                    <p className="text-[10.5px] text-slate-650 font-medium leading-relaxed font-sans italic select-none">
                      "{compileRandomBulkSmsMessage(bulkSmsCustomMessage)}"
                    </p>
                  </div>
                </div>

                {/* Parent Roster Selection Grid */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-150 pb-2">
                    <span className="text-[10px] text-slate-500 uppercase font-black tracking-wide">
                      Select Parents to Notify
                    </span>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          const classStds = students.filter(s => s.class === selectedClass);
                          const allChecked: Record<string, boolean> = {};
                          classStds.forEach(s => {
                            if (s.guardianTelephone) {
                              allChecked[s.id] = true;
                            }
                          });
                          setSelectedStudentsToNotify(allChecked);
                        }}
                        className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedStudentsToNotify({})}
                        className="text-[10px] font-bold text-slate-500 hover:underline cursor-pointer"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  {/* Progressive Broadcast Loader */}
                  {isBroadcastingSms && (
                    <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 flex items-center gap-1.5 animate-pulse">
                          <RefreshCw size={12} className="animate-spin text-indigo-600" />
                          Broadcasting Parent SMS Notifications...
                        </span>
                        <strong className="font-mono text-slate-950 font-black">{broadcastProgress}% Completed</strong>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-600 to-teal-500 h-2 transition-all duration-300" style={{ width: `${broadcastProgress}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {students.filter(s => s.class === selectedClass).map(student => {
                      const isChecked = !!selectedStudentsToNotify[student.id];
                      const phone = student.guardianTelephone;
                      const hasPhone = !!phone;
                      const result = broadcastResults[student.id];

                      return (
                        <div key={student.id} className="p-3 flex items-center justify-between hover:bg-slate-50/50 transition">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              disabled={!hasPhone || isBroadcastingSms}
                              checked={isChecked}
                              onChange={(e) => {
                                setSelectedStudentsToNotify(prev => ({
                                  ...prev,
                                  [student.id]: e.target.checked
                                }));
                              }}
                              className="w-3.5 h-3.5 border border-slate-300 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed"
                            />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-800 text-xs">{student.firstName} {student.lastName}</span>
                                <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1 py-0.5 rounded">ID: {student.id}</span>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                Guardian: <strong className="text-slate-700">{student.guardianName || 'N/A'}</strong> | Phone: <strong className="text-slate-700 font-mono">{phone || 'Not Registered'}</strong>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {result ? (
                              result.status === 'sending' ? (
                                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200/50 px-2 py-0.5 rounded flex items-center gap-1 animate-pulse">
                                  <RefreshCw size={9} className="animate-spin" /> Sending...
                                </span>
                              ) : result.status === 'success' ? (
                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/50 px-2 py-0.5 rounded flex items-center gap-1">
                                  <Check size={9} /> Sent
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200/50 px-2 py-0.5 rounded flex items-center gap-1" title={result.error}>
                                  <AlertCircle size={9} /> Failed
                                </span>
                              )
                            ) : !hasPhone ? (
                              <span className="text-[9px] font-bold text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded font-sans">
                                No Number
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded font-sans">
                                Pending
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Dispatch Trigger Bar */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                  <p className="text-[10px] text-slate-400 leading-snug">
                    Total queued parents selected: <strong className="text-indigo-600 font-bold">{Object.values(selectedStudentsToNotify).filter(Boolean).length}</strong>
                  </p>

                  <button
                    type="button"
                    disabled={isBroadcastingSms || Object.values(selectedStudentsToNotify).filter(Boolean).length === 0}
                    onClick={handleBroadcastReportCardSms}
                    className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition flex items-center justify-center gap-1.5 active:translate-y-0.5 font-sans"
                  >
                    <Send size={12} /> Broadcast Notification Blast
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-4 border-t border-slate-100 text-slate-400 text-center py-6 text-xs bg-slate-50/50 rounded-xl mt-4 border-dashed border-slate-200">
                <AlertCircle size={20} className="mx-auto mb-1.5 text-slate-300" />
                <span>Grades for {selectedClass} are in <strong>Draft (In-Progress)</strong> status. Finalize grades above to authorize parental notifications.</span>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden no-print">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-700 text-sm">
                  📋 Horizontal Class Broad Sheet Summary
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Overview of cumulative scores across active subjects for {selectedClass} | term: {selectedTerm}</p>
              </div>
              
              <button
                type="button"
                onClick={() => setBroadsheetPreviewMode(!broadsheetPreviewMode)}
                className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black shadow-xs cursor-pointer transition flex items-center justify-center gap-1 active:translate-y-0.5 self-start sm:self-auto no-print"
              >
                <Eye size={12} /> Toggle Preview Mode
              </button>
            </div>

            <div className="overflow-x-auto">
              {broadsheetData.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <AlertCircle size={32} className="text-slate-300 mx-auto mb-2" />
                  <span>No grades found in class. Write curriculum scores to establish the roster broadsheet.</span>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-[11px] min-w-max">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600">
                      <th className="py-2 px-3 font-bold text-center w-12">Rank</th>
                      <th className="py-2 px-2 font-bold w-48">Student Name</th>
                      {/* List Subjects */}
                      {inputtedSubjects.map(sub => (
                        <th key={sub} className="py-2 px-2 font-semibold text-center truncate">{sub.substring(0, 12)}...</th>
                      ))}
                      <th className="py-2 px-2 font-bold text-center bg-slate-100">Subjects</th>
                      <th className="py-2 px-2 font-bold text-center bg-indigo-50">Avg Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {broadsheetData.map((row, index) => (
                      <motion.tr 
                        key={row.student.id} 
                        className="hover:bg-slate-50/20"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.8), ease: 'easeOut' }}
                      >
                        <td className="py-2 px-3 text-center font-bold font-mono text-purple-700 bg-purple-50">{index + 1}</td>
                        <td className="py-2 px-2 font-semibold text-slate-800 font-sans">{row.student.firstName} {row.student.lastName}</td>
                        {inputtedSubjects.map(sub => {
                          const score = row.subjectScores[sub];
                          return (
                            <td key={sub} className="py-2 px-1 text-center font-mono font-medium border-l border-slate-100">
                              {score !== undefined ? `${score}%` : <span className="text-slate-300">-</span>}
                            </td>
                          );
                        })}
                        <td className="py-2 px-2 text-center text-slate-500 font-mono bg-slate-50">{row.subjectsCount} graded</td>
                        <td className="py-2 px-2 text-center font-black bg-indigo-50 text-indigo-800 font-mono">{row.averageOverallScore}%</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBMODE D: ANALYTICS */}
      {subMode === 'PerformanceAnalytics' && (
        <div className="space-y-6 no-print">
          
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                📈 Subject Performance Analytics
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Statistical metrics, cognitive distribution curves, and intervention alert controls for {selectedClass}</p>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPerformancePreviewMode(!performancePreviewMode)}
                className="py-1.5 px-3 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-black shadow-xs cursor-pointer transition flex items-center justify-center gap-1 active:translate-y-0.5 self-start sm:self-auto"
              >
                <Eye size={12} /> {performancePreviewMode ? 'Hide' : 'Show'} Preview Mode
              </button>
              
              {userRole === 'Teacher' && (
                <button
                  type="button"
                  onClick={() => handlePrintElement('teacher-subject-performance-report', `Teacher Subject Performance - ${selectedClass}`, false)}
                  className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black shadow-xs cursor-pointer transition flex items-center justify-center gap-1 active:translate-y-0.5 self-start sm:self-auto"
                >
                  <FileDown size={12} /> Export Subject PDF
                </button>
              )}
            </div>
          </div>

          {/* Real-time KPI Statistics Ribbons */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Subject Class Average</span>
                <strong className="text-xl font-black text-slate-900 tracking-tight font-mono">
                  {classPerformanceDetails.avgScore}%
                </strong>
                <span className="text-[9px] text-slate-500 block mt-0.5">Updated on-the-fly</span>
              </div>
              <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-sans text-sm">
                📊
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Subject Pass Rate</span>
                <strong className="text-xl font-black text-slate-900 tracking-tight font-mono">
                  {classPerformanceDetails.passRate}%
                </strong>
                <span className="text-[9px] text-slate-500 block mt-0.5">Threshold Score ≥ 50%</span>
              </div>
              <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center font-sans text-sm animate-pulse">
                🎯
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Maximum / Minimum</span>
                <strong className="text-xs font-black text-slate-900 tracking-tight font-mono block">
                  MAX {classPerformanceDetails.highestScore}% / MIN {classPerformanceDetails.lowestScore}%
                </strong>
                <span className="text-[9px] text-slate-500 block mt-0.5">Student extreme outputs</span>
              </div>
              <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center font-sans text-sm">
                ⭐
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Graded Registry Pool</span>
                <strong className="text-xl font-black text-slate-900 tracking-tight font-mono">
                  {classPerformanceDetails.gradedCount} Students
                </strong>
                <span className="text-[9px] text-slate-500 block mt-0.5">Selected Class size</span>
              </div>
              <div className="w-9 h-9 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center font-sans text-sm">
                👥
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Chart Area */}
            <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
              <h3 className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                📊 Class Mastery Performance Distribution
              </h3>
              <p className="text-[10px] text-slate-400">Aggregated student counts grouped by GES cognitive performance levels (L1 - L5) for {selectedSubject}.</p>
              
              <div className="h-64 font-sans text-[10px]">
                <ResponsiveContainer width="100%" height="100%" aspect={1.8}>
                  <BarChart data={gradeLevelsStats}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" interval={0} tick={{ fontSize: 9, fill: '#64748b' }} tickMargin={10} />
                    <YAxis />
                    <Tooltip wrapperStyle={{ fontSize: '10px' }} />
                    <Bar dataKey="value" name="Total Students" radius={[3, 3, 0, 0]}>
                      {gradeLevelsStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* GES Guidelines Map */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 shadow-2xs">
              <h4 className="font-bold text-slate-700 flex items-center gap-1">
                <Sparkles className="text-amber-500" size={15} /> GES New Curriculum Guidelines
              </h4>
              <div className="space-y-2.5 text-[11px] leading-relaxed">
                <div className="flex items-start gap-2">
                  <span className="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded font-mono">L1</span>
                  <div>
                    <strong>Highly Proficient (80% - 100%)</strong>
                    <p className="text-[10px] text-slate-500">Student exceeds current expectations on all learning units.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded font-mono">L2</span>
                  <div>
                    <strong>Proficient (68% - 79%)</strong>
                    <p className="text-[10px] text-slate-500">Student understands curriculum concepts and performs well.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded font-mono">L3</span>
                  <div>
                    <strong>Approaching Proficiency (54% - 67%)</strong>
                    <p className="text-[10px] text-slate-500">Basic mastery levels achieved. Needs moderate remediation.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded font-mono">L4</span>
                  <div>
                    <strong>Developing (40% - 53%)</strong>
                    <p className="text-[10px] text-slate-500">Concept grasp is fragile. Progress and guidance required.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded font-mono">L5</span>
                  <div>
                    <strong>Emerging (0% - 39%)</strong>
                    <p className="text-[10px] text-slate-500">Critical struggle in outcomes. Strong tutoring required.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Subject Performance Heatmap Card */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 text-left">
                  📊 Subject Mastery & Standard Heatmap
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5 text-left">
                  Comparative performance landscape for {selectedClass} during {selectedYear} • {selectedTerm}.
                </p>
              </div>

              {/* Threshold Adjuster slider and inputs */}
              <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-150 self-start sm:self-auto">
                <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">
                  🎯 Expected Standard Benchmark:
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="40"
                    max="80"
                    step="5"
                    value={heatmapThreshold}
                    onChange={(e) => setHeatmapThreshold(parseInt(e.target.value))}
                    className="w-24 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <span className="font-mono text-xs font-black bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100 min-w-[40px] text-center">
                    {heatmapThreshold}%
                  </span>
                </div>
              </div>
            </div>

            {/* Grid display for heatmap */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {subjectAveragesData.map((item) => {
                const { subject, average, gradedCount } = item;
                const isNoData = average === null;
                const isBelowStandard = !isNoData && average < heatmapThreshold;

                let cellBgClass = 'bg-slate-50 border-slate-200 text-slate-400';
                let indicatorDot = 'bg-slate-300';
                let badgeText = 'No Records';

                if (!isNoData) {
                  if (average < 50) {
                    cellBgClass = 'bg-rose-50/70 border-rose-200 text-rose-700 hover:bg-rose-100/70';
                    indicatorDot = 'bg-rose-500 animate-pulse';
                    badgeText = 'Critical Struggle';
                  } else if (average < heatmapThreshold) {
                    cellBgClass = 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100/70';
                    indicatorDot = 'bg-amber-500';
                    badgeText = 'Below Target';
                  } else if (average < 80) {
                    cellBgClass = 'bg-indigo-50/50 border-indigo-150 text-indigo-700 hover:bg-indigo-100/50';
                    indicatorDot = 'bg-indigo-500';
                    badgeText = 'Proficient';
                  } else {
                    cellBgClass = 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100/75';
                    indicatorDot = 'bg-emerald-500';
                    badgeText = 'Outstanding';
                  }
                }

                return (
                  <div
                    key={subject}
                    onClick={() => {
                      if (!isNoData) {
                        setSelectedSubject(subject as SubjectType);
                        const sheet = DbController.getAssessmentsSheet(selectedClass, selectedYear, selectedTerm, subject as SubjectType);
                        setActiveWorksheet(sheet);
                        setSubMode('Worksheet');
                      }
                    }}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between min-h-[115px] transition group relative ${
                      isNoData ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:shadow-xs'
                    } ${cellBgClass}`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[8px] font-black uppercase font-mono px-1.5 py-0.5 rounded bg-white/90 border border-slate-100 shadow-3xs">
                          {badgeText}
                        </span>
                        {!isNoData && isBelowStandard && (
                          <span className="text-[10px]" title="Below expected standard!">⚠️</span>
                        )}
                      </div>
                      <h4 className="text-[10.5px] font-bold tracking-tight line-clamp-2 leading-snug text-left pt-1.5 group-hover:text-slate-900 transition">
                        {subject}
                      </h4>
                    </div>

                    <div className="pt-2 border-t border-slate-100/40 mt-2 flex items-baseline justify-between">
                      <div className="text-left">
                        <span className="text-[8px] uppercase text-slate-400 block font-bold leading-none">Average</span>
                        <strong className="text-sm font-black font-mono leading-none">
                          {!isNoData ? `${average}%` : 'N/A'}
                        </strong>
                      </div>
                      <div className="text-right">
                        <span className="text-[8px] uppercase text-slate-400 block font-bold leading-none font-mono">Size</span>
                        <strong className="text-[10px] font-bold font-mono leading-none">
                          {gradedCount}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Threshold analysis helper details block */}
            <div className="bg-slate-50/75 rounded-xl border border-slate-200/60 p-4 space-y-4 text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1 px-1.5 bg-rose-100 text-rose-700 rounded-lg text-xs">⚠️</div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-850">
                      Expected Benchmark Gap Analysis
                    </h4>
                    <p className="text-[9.5px] text-slate-405 leading-relaxed">
                      Color-mapped by student outcomes. Benchmark expectation currently set at <strong className="text-indigo-600 font-bold">{heatmapThreshold}%</strong>.
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 text-xs shrink-0 self-start sm:self-auto font-mono">
                  <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-md border border-slate-100">
                    <span className="w-2 h-2 rounded bg-rose-500 border border-rose-500/10" />
                    <span className="text-[9px] text-slate-500 font-bold">Unsatisfactory (&lt;50%)</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-md border border-slate-100">
                    <span className="w-2 h-2 rounded bg-amber-500 border border-amber-500/10" />
                    <span className="text-[9px] text-slate-500 font-bold">Fragile (&lt;{heatmapThreshold}%)</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-md border border-slate-100">
                    <span className="w-2 h-2 rounded bg-indigo-500 border border-indigo-500/10" />
                    <span className="text-[9px] text-slate-500 font-bold">Proficient (⋝{heatmapThreshold}%)</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-md border border-slate-100">
                    <span className="w-2 h-2 rounded bg-emerald-500 border border-emerald-500/10" />
                    <span className="text-[9px] text-slate-500 font-bold">High Achievers (⋝80%)</span>
                  </div>
                </div>
              </div>

              {/* Action priority recommendations */}
              {(() => {
                const flagged = subjectAveragesData.filter(item => item.average !== null && item.average < heatmapThreshold);
                if (flagged.length === 0) {
                  return (
                    <div className="flex items-center gap-2 py-1 text-[11px] text-emerald-700 bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100">
                      <span className="text-sm">🎉</span>
                      <span><strong>Outstanding Cohort Performance!</strong> All currently graded subject curriculums have fully satisfied or exceeded your expected target standard of <strong>{heatmapThreshold}%</strong>. No emergency interventions required.</span>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2.5">
                    <div className="text-[10.5px] font-bold text-rose-750 flex items-center gap-1.5">
                      🚨 Flagged Areas: <span className="bg-rose-100 text-rose-800 text-[10px] px-2 py-0.2 rounded font-mono font-black">{flagged.length} Subject{flagged.length > 1 ? 's' : ''} Falling Below Standard</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {flagged.map((item) => {
                        let recoveryFocus = '';
                        if (item.subject.toLowerCase().includes('math')) {
                          recoveryFocus = 'Increase lesson plan focus on physical math manipulatives, structural geometric models, and daily diagnostic mental drills.';
                        } else if (item.subject.toLowerCase().includes('science')) {
                          recoveryFocus = 'Organize supplementary group experiments, lab-based visual guides, and interactive curriculum inquiry projects.';
                        } else if (item.subject.toLowerCase().includes('english') || item.subject.toLowerCase().includes('language')) {
                          recoveryFocus = 'Establish mandatory silent spelling practices, shared grammar readings, and localized phonics games.';
                        } else {
                          recoveryFocus = 'Re-allocate class discussion segments, assign targeted weekend take-home exercises, and review term units.';
                        }

                        return (
                          <div key={item.subject} className="bg-white p-2.5 rounded-lg border border-slate-200 flex flex-col justify-between space-y-1.5 text-left shadow-3xs">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-extrabold text-slate-800">{item.subject}</span>
                              <span className="text-[10px] font-black font-mono text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-100">
                                {item.average}% average
                              </span>
                            </div>
                            <p className="text-[9.5px] text-slate-550 leading-normal italic">
                              👉 {recoveryFocus} [Curriculum pool: {item.gradedCount} graded]
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Student Performance Trend Visualizer (Line Chart Track) */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 animate-pulse">
                  📈 Student Performance Trend Tracker
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Analyze individual student learning trajectories and terminal grade improvements over multiple terms.
                </p>
              </div>

              {/* Selector fields */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider mb-1">🎯 Selected Student</span>
                  <select
                    value={trendStudentId}
                    onChange={(e) => setTrendStudentId(e.target.value)}
                    className="py-1 px-2 border border-slate-200 rounded-md text-[11px] focus:outline-hidden focus:ring-1 focus:ring-indigo-550 bg-slate-50 font-bold"
                  >
                    {classStudentsForTrend.length === 0 ? (
                      <option value="">No students in class</option>
                    ) : (
                      classStudentsForTrend.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.firstName} {s.lastName}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider mb-1">📚 Subject Track</span>
                  <select
                    value={trendSubject}
                    onChange={(e) => setTrendSubject(e.target.value)}
                    className="py-1 px-2 border border-slate-200 rounded-md text-[11px] focus:outline-hidden focus:ring-1 focus:ring-indigo-550 bg-slate-50 font-bold"
                  >
                    <option value="All">All Subjects (Average)</option>
                    {SUBJECTS.map(subj => (
                      <option key={subj} value={subj}>
                        {subj}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Line Chart Area */}
            {classStudentsForTrend.length === 0 ? (
              <div className="p-12 text-center text-slate-400 italic bg-slate-50/50 rounded-xl border border-slate-150">
                ⚠️ Register students in {selectedClass} first to begin performance charting.
              </div>
            ) : studentTrendData.length === 0 ? (
              <div className="p-12 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-slate-150 flex flex-col items-center justify-center gap-2">
                <span className="text-xl">📊</span>
                <p className="font-bold text-slate-600 text-xs">No historical term records found for {selectedTrendStudent ? `${selectedTrendStudent.firstName} ${selectedTrendStudent.lastName}` : "this student"}.</p>
                <p className="text-[10px] text-slate-400 max-w-sm">To generate a learning trajectory trend curve, navigate or switch to worksheets for other terms or academic years, record assessment items, and persist them.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-center">
                {/* Chart container */}
                <div className="lg:col-span-3 h-80 font-sans text-[10px]">
                  <ResponsiveContainer width="100%" height="100%" aspect={2.2}>
                    <LineChart data={studentTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="period" stroke="#94a3b8" />
                      <YAxis domain={[0, 100]} stroke="#94a3b8" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#ffffff', 
                          border: '1px solid #e2e8f0', 
                          borderRadius: '8px',
                          fontSize: '11px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }} 
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                      <Line 
                        type="monotone" 
                        dataKey="Overall Grade" 
                        stroke="#4f46e5" 
                        strokeWidth={3} 
                        activeDot={{ r: 6 }} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Class Assessment" 
                        stroke="#10b981" 
                        strokeWidth={2} 
                        strokeDasharray="4 4" 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Exam Score" 
                        stroke="#f59e0b" 
                        strokeWidth={2} 
                        strokeDasharray="4 4" 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Cognitive Summary Insights Panel */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 h-full flex flex-col justify-center">
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-black text-slate-400 block tracking-wider">Scholar Trajectory</span>
                    <h4 className="font-extrabold text-slate-800 text-xs text-indigo-700">
                      {selectedTrendStudent?.firstName} {selectedTrendStudent?.lastName}
                    </h4>
                  </div>

                  <div className="space-y-2 text-[11px] text-slate-600">
                    <div className="flex justify-between items-center py-1 pb-1.5 border-b border-slate-100">
                      <span>Periods Tracked</span>
                      <strong className="text-slate-800 font-mono font-extrabold">{studentTrendData.length} Terms</strong>
                    </div>

                    <div className="flex justify-between items-center py-1 pb-1.5 border-b border-slate-100">
                      <span>Latest Term Grade</span>
                      <strong className="text-indigo-600 font-mono font-extrabold">
                        {studentTrendData[studentTrendData.length - 1]?.['Overall Grade']}%
                      </strong>
                    </div>

                    <div className="flex justify-between items-center py-1 pb-1.5 border-b border-slate-100">
                      <span>Classwork Average</span>
                      <strong className="text-emerald-600 font-mono font-extrabold">
                        {Math.round(studentTrendData.reduce((acc, current) => acc + current['Class Assessment'], 0) / studentTrendData.length)}%
                      </strong>
                    </div>

                    <div className="flex justify-between items-center py-1">
                      <span>Exam Average</span>
                      <strong className="text-amber-600 font-mono font-extrabold">
                        {Math.round(studentTrendData.reduce((acc, current) => acc + current['Exam Score'], 0) / studentTrendData.length)}%
                      </strong>
                    </div>
                  </div>

                  <div className="mt-1 p-2 bg-indigo-50/55 rounded-lg border border-indigo-100/50 text-[10px] text-indigo-700 leading-relaxed italic">
                    ⭐ Learning curves plot 50% Continuous Assessment work coupled with 50% End of Term examination performance.
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Academic Remediation & Intervention Tracker */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <AlertCircle className="text-rose-500" size={15} /> Academic Intervention Alert Center
                </h3>
                <span className="font-mono bg-rose-55 rounded px-2 py-0.5 text-[10.5px] font-bold text-rose-700">
                  {remediationAlerts.length} Flagged
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Immediate custom cognitive recovery actions recommended for students currently scoring below 54% (GES L4/L5 levels).
              </p>

              {remediationAlerts.length === 0 ? (
                <div className="p-8 text-center text-slate-400 italic bg-slate-50 rounded-lg border border-slate-150">
                  🎉 Outstanding! Zero students require remediation in this subject cohort.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[280px] overflow-y-auto pr-1">
                  {remediationAlerts.map(({ student, score, gradeLevel, actionPlan }, idx) => (
                    <div key={idx} className="py-2.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-slate-700">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-900 font-bold text-xs">
                            {student ? `${student.firstName} ${student.lastName}` : "Unknown Student"}
                          </strong>
                          <span className={`px-1.5 py-0.2 rounded text-[8px] font-black uppercase ${gradeLevel === 'L5' ? 'bg-rose-100 text-rose-800' : 'bg-indigo-100 text-indigo-800'}`}>
                            {gradeLevel}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 italic bg-amber-50/50 p-1.5 rounded border border-amber-100/50 leading-relaxed">
                          {actionPlan}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 self-center">
                        <span className="text-xs font-black text-rose-605 block">{score}%</span>
                        <span className="text-[9px] text-slate-400 font-mono block">Score</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Performance Honour Roll */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Award className="text-amber-500" size={15} /> Academic Honors list (Honour Roll)
                </h3>
                <span className="font-mono bg-emerald-50 rounded px-2 py-0.5 text-[10.5px] font-bold text-emerald-700">
                  {academicHonorsList.length} High Achievers
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                These students have achieved outstanding cognitive outcome masteries (scores of 80% or greater / Level L1).
              </p>

              {academicHonorsList.length === 0 ? (
                <div className="p-8 text-center text-slate-400 italic bg-slate-50 rounded-lg border border-slate-150">
                  Keep working! No student achieves 80% score threshold in this worksheet yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[280px] overflow-y-auto pr-1">
                  {academicHonorsList.map(({ student, score }, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between text-slate-700 border-b border-dashed border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-amber-100 text-amber-805 font-black rounded-full text-[10px] flex items-center justify-center select-none font-mono">
                          {idx + 1}
                        </div>
                        <div>
                          <strong className="text-slate-950 font-bold block">
                            {student ? `${student.firstName} ${student.lastName}` : "Unknown Student"}
                          </strong>
                          <span className="text-[8px] text-slate-400 font-sans block uppercase">GES Cognitive Stars Guild</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-emerald-600 block">{score}%</span>
                        <span className="text-[9px] text-slate-400 block font-mono">Level L1</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* SUBMODE E: STUDENT STRENGTHS & WEAKNESSES DIAGNOSTIC REPORT */}
      {subMode === 'StudentStrengthsWeaknesses' && (
        <div className="space-y-6 no-print">
          
          {/* Top Selector Ribbon */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                🌟 Student Strengths & Weaknesses Diagnostic
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Comprehensive subject-by-subject cognitive profile, historic term tracking, and custom remediation guidelines for {selectedClass}
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium font-sans">Select Student:</span>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg bg-white font-semibold focus:outline-none cursor-pointer"
                >
                  {students.filter(s => s.class === selectedClass).map(s => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName} ({s.id})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => handlePrintElement('student-strengths-weaknesses-report-card', `Student Strengths & Weaknesses - ${students.find(s => s.id === selectedStudentId)?.firstName || 'Report'}`, false)}
                className="py-1.5 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black shadow-xs cursor-pointer transition flex items-center justify-center gap-1.5 active:translate-y-0.5"
              >
                <Printer size={12} /> Print Diagnostic Report
              </button>
            </div>
          </div>

          {!studentStrengthsWeaknesses ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto text-2xl">
                📝
              </div>
              <h4 className="font-bold text-slate-700 text-sm">No Active Assessment Data</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No recorded academic marks found for {students.find(s => s.id === selectedStudentId)?.firstName || 'this student'} in {selectedYear}. Please record assessment scores under the "Marks Input Sheet" tab to view this analysis.
              </p>
            </div>
          ) : (
            <div id="student-strengths-weaknesses-report-card" className="space-y-6 bg-slate-50/50 p-1 rounded-xl">
              
              {/* Dynamic KPI Ribbons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Student Profile Card */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-55 text-indigo-700 font-bold rounded-full flex items-center justify-center text-lg select-none">
                    👨‍🎓
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Active Student</span>
                    <strong className="text-xs font-bold text-slate-900 block truncate max-w-[150px]">
                      {(() => {
                        const s = students.find(st => st.id === selectedStudentId);
                        return s ? `${s.firstName} ${s.lastName}` : "Selected Student";
                      })()}
                    </strong>
                    <span className="text-[9px] text-slate-500 block font-mono">{selectedStudentId}</span>
                  </div>
                </div>

                {/* Annual Average Card */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Annual Subject Average</span>
                    <strong className={`text-lg font-black tracking-tight font-mono ${
                      studentStrengthsWeaknesses.annualAverage >= 70 ? 'text-emerald-600' :
                      studentStrengthsWeaknesses.annualAverage >= 55 ? 'text-indigo-600' : 'text-rose-600'
                    }`}>
                      {studentStrengthsWeaknesses.annualAverage}%
                    </strong>
                    <span className="text-[9px] text-slate-500 block mt-0.5 font-sans">Year to Date overall</span>
                  </div>
                  <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center text-sm">
                    📈
                  </div>
                </div>

                {/* Strengths Card */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Academic Strengths</span>
                    <strong className="text-lg font-black text-emerald-600 tracking-tight font-mono">
                      {studentStrengthsWeaknesses.strengths.length} Subjects
                    </strong>
                    <span className="text-[9px] text-slate-500 block mt-0.5 font-sans">Average Score ≥ 70%</span>
                  </div>
                  <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center text-sm">
                    🌟
                  </div>
                </div>

                {/* Weaknesses Card */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Areas for Growth</span>
                    <strong className="text-lg font-black text-rose-600 tracking-tight font-mono">
                      {studentStrengthsWeaknesses.weaknesses.length} Subjects
                    </strong>
                    <span className="text-[9px] text-slate-500 block mt-0.5 font-sans">Average Score &lt; 55%</span>
                  </div>
                  <div className="w-8 h-8 bg-rose-50 text-rose-600 rounded-lg flex items-center justify-center text-sm">
                    ⚠️
                  </div>
                </div>
              </div>

              {/* Strengths vs Weaknesses Lists (Bento Grid) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Left Column: Strengths */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Sparkles className="text-emerald-500" size={15} /> Academic Strengths & Mastery Areas
                    </h4>
                    <span className="font-mono bg-emerald-55 rounded px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      Top Performance
                    </span>
                  </div>
                  
                  {studentStrengthsWeaknesses.strengths.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 italic bg-slate-50 rounded-lg border border-slate-150">
                      No subjects are currently categorized as major strengths (≥ 70% average score). Encouraging focused revisions!
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                      {studentStrengthsWeaknesses.strengths.map((item, idx) => (
                        <div key={idx} className="p-3 bg-emerald-50/20 border border-emerald-100/50 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <strong className="text-slate-950 text-xs font-bold block">{item.subject}</strong>
                              <span className="text-[9px] text-slate-400 uppercase font-sans tracking-wide">
                                Yearly Average: {item.avgScore}%
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {item.trend === 'up' && <span className="text-xs text-emerald-600 font-bold flex items-center gap-0.5 font-mono"><TrendingUp size={12} /> Upward</span>}
                              {item.trend === 'down' && <span className="text-xs text-rose-500 font-bold flex items-center gap-0.5 font-mono"><TrendingDown size={12} /> Downward</span>}
                              {item.trend === 'stable' && <span className="text-[10px] text-slate-500 font-bold font-mono">Stable</span>}
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded-full">
                                Strength
                              </span>
                            </div>
                          </div>
                          
                          {/* Progress bar */}
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${item.avgScore}%` }}></div>
                          </div>
                          
                          <p className="text-[10px] text-slate-500 leading-relaxed italic bg-white/75 p-2 rounded-lg border border-slate-100">
                            "Exhibits deep cognitive engagement, active classroom contribution, and outstanding output. Recommended to represent class in academic quizzes or group mentoring."
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right Column: Weaknesses */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <AlertCircle className="text-rose-500" size={15} /> Support Areas & Growth Focus
                    </h4>
                    <span className="font-mono bg-rose-55 rounded px-2 py-0.5 text-[10px] font-bold text-rose-700">
                      Needs Attention
                    </span>
                  </div>
                  
                  {studentStrengthsWeaknesses.weaknesses.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 italic bg-slate-50 rounded-lg border border-slate-150">
                      🎉 Outstanding! No subjects require immediate remediation (average scores are all above 55%). Keep up the balanced efforts!
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                      {studentStrengthsWeaknesses.weaknesses.map((item, idx) => (
                        <div key={idx} className="p-3 bg-rose-50/10 border border-rose-100/50 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <strong className="text-slate-950 text-xs font-bold block">{item.subject}</strong>
                              <span className="text-[9px] text-slate-400 uppercase font-sans tracking-wide">
                                Yearly Average: {item.avgScore}%
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {item.trend === 'up' && <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5 font-mono"><TrendingUp size={11} /> Recovering</span>}
                              {item.trend === 'down' && <span className="text-[10px] text-rose-500 font-bold flex items-center gap-0.5 font-mono"><TrendingDown size={11} /> Dropping</span>}
                              {item.trend === 'stable' && <span className="text-[10px] text-slate-500 font-bold font-mono">Stable</span>}
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[9px] font-bold rounded-full font-sans">
                                Needs Help
                              </span>
                            </div>
                          </div>
                          
                          {/* Progress bar */}
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: `${item.avgScore}%` }}></div>
                          </div>
                          
                          <p className="text-[10px] text-slate-500 leading-relaxed bg-white/75 p-2 rounded-lg border border-slate-100">
                            <strong className="text-[9px] text-rose-700 block mb-0.5 uppercase tracking-wide font-black">Remediation Blueprint:</strong>
                            Provide structured diagnostic worksheets, 15-minute supplementary peer tutoring, and prioritize practical exercises over abstract concepts to rebuild learner confidence.
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* Mid-tier Layout: Steady Subjects & Historical Term Trend Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Steady Subjects Card */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4 lg:col-span-1">
                  <div className="pb-3 border-b border-slate-100">
                    <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      ⚖️ Steady & Stable Subjects
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Average scores ranging from 55% to 69% (steady academic footing)</p>
                  </div>

                  {studentStrengthsWeaknesses.steady.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 italic bg-slate-50 rounded-lg border border-slate-100">
                      All subjects are either distinct strengths or urgent areas of focus.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 font-sans">
                      {studentStrengthsWeaknesses.steady.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-150 rounded-lg text-xs">
                          <div>
                            <span className="font-bold text-slate-800 block truncate max-w-[150px]">{item.subject}</span>
                            <span className="text-[10px] text-slate-400 block font-mono">Average: {item.avgScore}%</span>
                          </div>
                          <div className="text-right">
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[9px] font-bold rounded-full block font-sans">
                              Steady
                            </span>
                            {item.trend === 'up' && <span className="text-[9px] text-emerald-600 font-bold block mt-1 font-mono">📈 Improving</span>}
                            {item.trend === 'down' && <span className="text-[9px] text-rose-500 font-bold block mt-1 font-mono">📉 Declining</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Trend Chart and Subject Explorer Card */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4 lg:col-span-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        📊 Historical Term-over-Term Trajectory
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Comparative progress mapping across Terms of the Selected Academic Year</p>
                    </div>
                    
                    <div>
                      <select
                        value={swSubjectFilter}
                        onChange={(e) => setSwSubjectFilter(e.target.value)}
                        className="text-[11px] px-2.5 py-1 border border-slate-200 rounded bg-slate-50 font-semibold focus:outline-none cursor-pointer"
                      >
                        <option value="All">Overall Term Average</option>
                        {studentStrengthsWeaknesses.allSubjectsAnalysis.map(sa => (
                          <option key={sa.subject} value={sa.subject}>
                            {sa.subject}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="h-56 font-sans text-[10px] pt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart 
                        data={swSubjectFilter === 'All' ? overallTermTrendData : specificSubjectTrendData}
                        margin={{ top: 15, right: 20, bottom: 5, left: -10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
                        <Tooltip wrapperStyle={{ fontSize: '10px' }} />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                        <Line 
                          type="monotone" 
                          dataKey={swSubjectFilter === 'All' ? "Overall Average" : "Subject Score"} 
                          stroke={swSubjectFilter === 'All' ? "#4f46e5" : "#10b981"} 
                          strokeWidth={3} 
                          activeDot={{ r: 6 }} 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

              {/* Complete Performance Ledger */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
                <div className="pb-3 border-b border-slate-100">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    🗃️ Complete Term-over-Term Performance Ledger
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Granular grades database record index across all subjects registered in this academic year.</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[9px] tracking-wider">
                        <th className="p-3">Subject Name</th>
                        <th className="p-3 text-center">Term 1</th>
                        <th className="p-3 text-center">Term 2</th>
                        <th className="p-3 text-center">Term 3</th>
                        <th className="p-3 text-center bg-slate-100/50">Yearly Avg</th>
                        <th className="p-3 text-center">Trend Indicator</th>
                        <th className="p-3 text-right">Status Badge</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {studentStrengthsWeaknesses.allSubjectsAnalysis.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition">
                          <td className="p-3 font-semibold text-slate-800">{row.subject}</td>
                          <td className="p-3 text-center font-mono text-slate-600">{row.termScores['Term 1'] !== undefined ? `${row.termScores['Term 1']}%` : '-'}</td>
                          <td className="p-3 text-center font-mono text-slate-600">{row.termScores['Term 2'] !== undefined ? `${row.termScores['Term 2']}%` : '-'}</td>
                          <td className="p-3 text-center font-mono text-slate-600">{row.termScores['Term 3'] !== undefined ? `${row.termScores['Term 3']}%` : '-'}</td>
                          <td className="p-3 text-center font-semibold font-mono bg-slate-50/50 text-slate-800">{row.avgScore}%</td>
                          <td className="p-3 text-center">
                            {row.trend === 'up' && <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-bold text-[9px] font-sans"><TrendingUp size={10} /> Improving</span>}
                            {row.trend === 'down' && <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-700 rounded-full font-bold text-[9px] font-sans"><TrendingDown size={10} /> Declining</span>}
                            {row.trend === 'stable' && <span className="inline-flex items-center justify-center px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[9px] font-sans">Steady</span>}
                            {row.trend === 'unknown' && <span className="text-slate-400 font-sans">-</span>}
                          </td>
                          <td className="p-3 text-right">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              row.category === 'strength' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' :
                              row.category === 'weakness' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                              'bg-indigo-50 text-indigo-800 border border-indigo-100'
                            }`}>
                              {row.category === 'strength' ? 'Strength' : row.category === 'weakness' ? 'Needs Help' : 'Steady'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* SANDBOX PRINT CAPTURE ALERT OVERLAY */}
      {printBlocked && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 no-print">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full text-center space-y-4 text-slate-800">
            <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 mx-auto">
              <Printer size={24} />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-sm font-bold text-slate-950 font-display">Print Dialog Intercepted</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Your browser blocks direct print triggers from inside the preview iframe. To print this report card, please click the <strong className="text-slate-800 font-bold">"Open in a new tab" ↗</strong> button at the top right of the application workspace first.
              </p>
            </div>
            <button
              onClick={() => setPrintBlocked(false)}
              className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer active:translate-y-0.5 transition"
            >
              Recognized, Dismiss
            </button>
          </div>
        </div>
      )}

      {/* COMPREHENSIVE FLOATING PRINT & EXPORT PORTAL */}
      <AnimatePresence>
        {showPdfGuide && (
          <>
          {/* Always Render Print/PDF Target templates in a stable offscreen environment for jsPDF canvas engine */}
          <div className="fixed left-[-9999px] top-[-9999px] pointer-events-none z-[-100] select-none opacity-0 bg-white no-print" aria-hidden="true">
            {/* Target A: Portrait Report Card Template */}
            <div id="assessment-report-preview-portrait" className="w-[800px] bg-white p-12 text-black border-[8px] border-double border-slate-900 space-y-6 font-sans report-card-print-container">
              {/* Professional Letterhead */}
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-5 gap-4">
                {DbController.getSchoolInfo().logoUrl ? (
                  <img 
                    src={DbController.getSchoolInfo().logoUrl} 
                    alt="School Logo" 
                    className="w-20 h-20 object-contain" 
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center border border-slate-300 p-1">
                    <div className="w-full h-full rounded-full border border-dashed border-slate-400 bg-white flex flex-col items-center justify-center text-[8px] text-slate-500 font-mono font-bold leading-none">
                      <Award size={24} className="text-indigo-600 mb-0.5" />
                      <span className="scale-75 origin-center uppercase">CREST</span>
                    </div>
                  </div>
                )}
                <div className="flex-1 text-center space-y-1">
                  <h2 className="text-xl font-black text-slate-950 tracking-tight leading-tight uppercase font-display">
                    {DbController.getSchoolInfo().name}
                  </h2>
                  <p className="text-xs italic font-serif text-slate-600">
                    Motto: "{DbController.getSchoolInfo().motto}"
                  </p>
                  <div className="text-[10px] text-slate-500 flex flex-wrap justify-center gap-x-3 gap-y-0.5">
                    {DbController.getSchoolInfo().gpsAddress && <span>📍 {DbController.getSchoolInfo().gpsAddress}</span>}
                    {DbController.getSchoolInfo().telephone && <span>☎️ {DbController.getSchoolInfo().telephone}</span>}
                    {DbController.getSchoolInfo().email && <span>📧 {DbController.getSchoolInfo().email}</span>}
                  </div>
                  <div className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-bold flex justify-center gap-3">
                    {DbController.getSchoolInfo().emisCode && <span>EMIS ID: {DbController.getSchoolInfo().emisCode}</span>}
                    {DbController.getSchoolInfo().schoolNumber && <span>SCHOOL NO: {DbController.getSchoolInfo().schoolNumber}</span>}
                  </div>
                </div>
                {compiledReport?.student.photoUrl ? (
                  <img 
                    src={compiledReport.student.photoUrl} 
                    alt={`${compiledReport.student.firstName} ${compiledReport.student.lastName}`} 
                    className="w-16 h-16 rounded border border-slate-300 object-cover flex-shrink-0 font-sans" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-16 h-16 rounded border border-dashed border-slate-300 flex flex-col items-center justify-center bg-slate-50 p-1 text-[7px] text-slate-400 font-mono text-center leading-normal">
                    <div className="font-bold scale-90">PASSPORT</div>
                    <div className="scale-75">STAMP</div>
                  </div>
                )}
              </div>

              {/* Student Personal Data block */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 grid grid-cols-2 gap-3 leading-relaxed">
                <div><span className="text-[9px] text-slate-400 uppercase font-sans font-medium block">Student ID Number</span><strong>{compiledReport?.student.id || 'N/A'}</strong></div>
                <div><span className="text-[9px] text-slate-400 uppercase font-sans font-medium block">Full Legal Name</span><strong>{compiledReport ? `${compiledReport.student.firstName} ${compiledReport.student.lastName}` : 'Not Selected'}</strong></div>
                <div><span className="text-[9px] text-slate-400 uppercase font-sans font-medium block">Academic Class</span><strong>{compiledReport?.student.class || selectedClass} ({compiledReport?.student.section || 'N/A'})</strong></div>
                <div><span className="text-[9px] text-slate-400 uppercase font-sans font-medium block">Report Term & Year</span><strong>{selectedTerm} ({selectedYear})</strong></div>
                <div className="col-span-2 grid grid-cols-2 gap-3 border-t border-slate-200 pt-2">
                  <div className="relative group cursor-help bg-indigo-50/30 p-1 rounded-lg border border-indigo-100/30 transition-all hover:bg-indigo-50/60">
                    <span className="text-[9px] text-indigo-700 uppercase font-sans font-bold flex items-center gap-1 select-none">
                      Class Rank Standing <HelpCircle size={10} className="text-indigo-400" />
                    </span>
                    <strong className="text-indigo-900 font-sans text-xs block mt-0.5">{compiledReport?.classRank || 'N/A'}</strong>
                    {compiledReport && (
                      <RankBreakdownTooltip 
                        term={selectedTerm} 
                        year={selectedYear} 
                        averageScore={compiledReport.averageScore} 
                        gradedCount={compiledReport.gradedCount} 
                      />
                    )}
                  </div>
                  <div><span className="text-[9px] text-teal-800 uppercase font-sans font-bold block">Next Reopening Date</span><strong className="text-teal-900 font-sans text-xs">{formatReopeningDate(DbController.getSchoolInfo().reopeningDate)}</strong></div>
                </div>
              </div>

              <h3 className="text-sm font-black uppercase text-center tracking-wide py-1.5 bg-slate-100 text-slate-900 border-y border-slate-200">
                Official Student Progress Terminal Statement Card
              </h3>

              {/* Registered Subjects grades table */}
              <table className="w-full text-left text-xs border-collapse border border-slate-300 leading-normal font-sans">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b-2 border-slate-900 text-slate-900 uppercase">
                    <th className="p-2 border border-slate-300">Subject Course Courseware</th>
                    <th className="p-2 border border-slate-300 text-center">Class Score (50%)</th>
                    <th className="p-2 border border-slate-300 text-center">Exam Score (50%)</th>
                    <th className="p-2 border border-slate-300 text-center">Total Cumulative (100)</th>
                    <th className="p-2 border border-slate-300 text-center">NTC Remarks & Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {!compiledReport || compiledReport.grades.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-400 italic font-medium">No assessment summaries found to render.</td>
                    </tr>
                  ) : (
                    compiledReport.grades.map(g => (
                      <tr key={g.subject} className="border-b border-slate-200">
                        <td className="p-2.5 border border-slate-200 font-bold text-slate-950">{g.subject}</td>
                        <td className="p-2.5 border border-slate-200 text-center font-mono font-medium text-slate-700">{g.classScore50.toFixed(1)}</td>
                        <td className="p-2.5 border border-slate-200 text-center font-mono font-medium text-slate-700">{g.examScore50.toFixed(1)}</td>
                        <td className="p-2.5 border border-slate-200 text-center font-mono font-black text-rose-700 bg-rose-50/10">{g.totalScore.toFixed(1)}%</td>
                        <td className="p-2.5 border border-slate-200 text-center font-semibold text-slate-800">
                          {g.remarks} ({g.gradeLevel})
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Summary blocks */}
              {compiledReport && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-50 p-3 border border-slate-200 rounded-lg text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Courses</span>
                    <strong className="text-sm text-slate-800">{compiledReport.totalSubjects} graded</strong>
                  </div>
                  <div className="bg-slate-50 p-3 border border-slate-200 rounded-lg text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Average Score</span>
                    <strong className="text-sm text-indigo-700">{compiledReport.averageScore.toFixed(1)}%</strong>
                  </div>
                  <div className="bg-slate-50 p-3 border border-slate-200 rounded-lg text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Grade Rating</span>
                    <strong className="text-sm text-emerald-800 uppercase">GES Standard</strong>
                  </div>
                </div>
              )}

              {/* Financial Ledger Section */}
              {studentFinancials && (
                <div className="mt-6 bg-slate-50 border border-slate-200/80 rounded-xl p-4 font-sans text-xs grid grid-cols-2 gap-4 leading-normal print:bg-white print:border-slate-300">
                  <div className="space-y-1">
                    <div className="text-slate-500 uppercase tracking-wider text-[9px] font-black">Current Balance Status</div>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-base font-black ${studentFinancials.totalOutstanding > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                        GHS {studentFinancials.totalOutstanding.toFixed(2)}
                      </span>
                      {studentFinancials.totalOutstanding > 0 && studentFinancials.previousOutstanding > 0 && (
                        <span className="text-[10px] text-slate-400">
                          (Term: GHS {studentFinancials.currentOutstanding.toFixed(2)} | Arrears: GHS {studentFinancials.previousOutstanding.toFixed(2)})
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400">Outstanding student balance of registered accounts ledger.</div>
                  </div>
                  <div className="border-l border-slate-250 pl-6 space-y-1">
                    <div className="text-slate-500 uppercase tracking-wider text-[9px] font-black">Next Term Projected Bill ({studentFinancials.nextTerm}, {studentFinancials.nextYear})</div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-bold text-slate-800">
                        GHS {studentFinancials.nextTermBillSum.toFixed(2)}
                      </span>
                      {studentFinancials.isEstimated && (
                        <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-black font-mono">Estimated Rate</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400">Projected billing plan for the upcoming academic module term.</div>
                  </div>
                </div>
              )}

              {/* Signature block */}
              <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-200 mt-6 font-sans">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase font-mono">Headteacher Remarks</span>
                  <p className="text-xs italic text-slate-700 bg-slate-50 p-3 rounded-lg leading-relaxed border border-slate-150">
                    {compiledReport && compiledReport.averageScore >= 80 
                      ? 'Excellent performance! Reflected mastery on GES curriculum.' 
                      : compiledReport && compiledReport.averageScore >= 68 
                      ? 'Satisfactory progress. Proficient level achieved.' 
                      : 'Satisfactory performance. Continual tutoring encouraged.'}
                  </p>
                </div>
                <div className="flex flex-col justify-end items-end space-y-1 pr-4 relative">
                  <div className="relative w-40 h-12 flex items-center justify-center">
                    {DbController.getSchoolInfo().stampUrl && (
                      <img 
                        src={DbController.getSchoolInfo().stampUrl} 
                        alt="School Stamp" 
                        className="absolute w-14 h-14 object-contain opacity-75 z-0 transform -rotate-12 translate-x-[-15%] translate-y-[-5%]" 
                        referrerPolicy="no-referrer"
                      />
                    )}
                    {DbController.getSchoolInfo().signatureUrl ? (
                      <img 
                        src={DbController.getSchoolInfo().signatureUrl} 
                        alt="Headteacher Signature" 
                        className="absolute w-28 h-9 object-contain z-10" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="h-[1px] w-36 bg-slate-400 self-end"></div>
                    )}
                  </div>
                  {DbController.getSchoolInfo().signatureUrl && <div className="h-[1px] w-36 bg-slate-200"></div>}
                  <div className="text-right">
                    {DbController.getSchoolInfo().headteacherName && (
                      <span className="font-bold text-[8.5px] text-slate-800 block leading-tight">{DbController.getSchoolInfo().headteacherName}</span>
                    )}
                    <span className="text-[9px] text-slate-400 uppercase block font-semibold">Headteacher Signature</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Target B: Landscape Cumulative Broadsheet / Ledger Template */}
            <div id="assessment-roster-preview-landscape" className="w-[1100px] bg-white p-12 text-black border-[8px] border-double border-slate-900 space-y-6 font-sans">
              {/* Professional Letterhead */}
              <div className="flex items-center justify-between border-b pb-4 gap-4 leading-normal">
                {DbController.getSchoolInfo().logoUrl ? (
                  <img 
                    src={DbController.getSchoolInfo().logoUrl} 
                    alt="School Logo" 
                    className="w-20 h-20 object-contain" 
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center border border-slate-300 p-1 flex-shrink-0">
                    <div className="w-full h-full rounded-full border border-dashed border-slate-400 bg-white flex flex-col items-center justify-center text-[7px] text-slate-500 font-mono font-bold leading-none">
                      <Award size={22} className="text-indigo-600 mb-0.5" />
                      <span className="scale-75 origin-center uppercase">CREST</span>
                    </div>
                  </div>
                )}
                <div className="flex-1 text-center space-y-1">
                  <h2 className="text-xl font-black text-slate-950 tracking-tight leading-tight uppercase font-display">
                    {DbController.getSchoolInfo().name}
                  </h2>
                  <p className="text-xs italic font-serif text-slate-600">
                    Motto: "{DbController.getSchoolInfo().motto}"
                  </p>
                  <div className="text-[10px] text-slate-500 flex flex-wrap justify-center gap-x-3 gap-y-0.5">
                    {DbController.getSchoolInfo().gpsAddress && <span>📍 {DbController.getSchoolInfo().gpsAddress}</span>}
                    {DbController.getSchoolInfo().telephone && <span>☎️ {DbController.getSchoolInfo().telephone}</span>}
                    {DbController.getSchoolInfo().email && <span>📧 {DbController.getSchoolInfo().email}</span>}
                  </div>
                </div>
                <div className="w-24 h-12 text-[8px] text-slate-400 border border-slate-300 bg-slate-50 rounded flex flex-col items-center justify-center font-mono font-bold select-none text-center leading-normal">
                  OFFICIAL
                  <span>REGISTRY RECORD</span>
                </div>
              </div>

              {/* parameters */}
              <div className="flex justify-between items-center text-xs bg-slate-50 px-4 py-2.5 rounded border border-slate-200 font-mono text-slate-800">
                <div><strong>OFFICIAL REGISTRY LEDGER:</strong> {subMode === 'Broadsheet' ? 'Official Academic Broadsheet Ledger' : `Subject Marks Ledger Worksheet - ${selectedSubject}`}</div>
                <div><strong>CLASS:</strong> {selectedClass} | <strong>ACADEMIC TERM:</strong> {selectedTerm} ({selectedYear})</div>
              </div>

              <table className="w-full text-left border-collapse text-xs font-sans">
                <thead>
                  <tr className="bg-slate-100 border-b-2 border-slate-900 text-slate-900 uppercase font-black">
                    {subMode === 'Broadsheet' ? (
                      <>
                        <th className="py-2.5 px-3 border border-slate-300">Registered Student Full Name</th>
                        <th className="py-2.5 px-3 border border-slate-300 text-center">Courses Graded</th>
                        <th className="py-2.5 px-3 border border-slate-300 text-center font-bold">Terminal Score Average Mean %</th>
                        <th className="py-2.5 px-3 border border-slate-300 text-center">Official Standings Rank</th>
                      </>
                    ) : (
                      <>
                        <th className="py-2.5 px-3 border border-slate-300">Registered Student Full Name</th>
                        <th className="py-2.5 px-3 border border-slate-300 text-center">Class score marks (50%)</th>
                        <th className="py-2.5 px-3 border border-slate-350 text-center">Exam score marks (50%)</th>
                        <th className="py-2.5 px-3 border border-slate-300 text-center font-bold">Overall total score (100)</th>
                        <th className="py-2.5 px-3 border border-slate-350 text-center">Qualified Letter Grade Remarks</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {subMode === 'Broadsheet' ? (
                    broadsheetData.map((row, idx) => (
                      <tr key={row.student.id} className="border-b border-slate-200 hover:bg-slate-50/40">
                        <td className="py-2 px-3 border border-slate-200 font-bold text-slate-950">{row.student.firstName} {row.student.lastName} ({row.student.id})</td>
                        <td className="py-2 px-3 border border-slate-200 text-center font-medium">{row.subjectsCount} registered courses</td>
                        <td className="py-2 px-3 border border-slate-200 text-center font-mono font-black text-indigo-700">{row.averageOverallScore.toFixed(1)}%</td>
                        <td className="py-2 px-3 border border-slate-200 text-center font-mono font-semibold">Rank Standings #{idx + 1}</td>
                      </tr>
                    ))
                  ) : (
                    activeWorksheet.map(row => (
                      <tr key={row.studentId} className="border-b border-slate-200 hover:bg-slate-50/40">
                        <td className="py-2 px-3 border border-slate-200 font-bold text-slate-950">{row.studentName} ({row.studentId})</td>
                        <td className="py-2 px-3 border border-slate-200 text-center font-mono text-slate-705">{row.classScore50.toFixed(1)}</td>
                        <td className="py-2 px-3 border border-slate-200 text-center font-mono text-slate-705">{row.examScore50.toFixed(1)}</td>
                        <td className="py-2 px-3 border border-slate-200 text-center font-mono font-black text-rose-700 bg-rose-50/10">{row.totalScore.toFixed(1)}%</td>
                        <td className="py-2 px-3 border border-slate-200 text-center font-semibold text-slate-800">{row.remarks} ({row.gradeLevel})</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div className="flex justify-between items-end pt-5 border-t border-slate-200 mt-5 text-[10px]">
                <div className="text-slate-400 font-mono uppercase tracking-wide">
                  SYSTEM STATUS: DATA PERSISTED & BACKED UP ON CLOUD FIRESTORE | DATE GENERATED: {new Date().toLocaleDateString()}
                </div>
                <div className="flex flex-col items-center space-y-2 pr-4">
                  <div className="w-44 border-b-2 border-slate-900 h-10"></div>
                  <span className="text-slate-400 uppercase font-mono tracking-wider font-semibold">Registry Certified seal / stamp line</span>
                </div>
              </div>
            </div>

            {/* Target C: Teacher Assigned Subjects Performance Report */}
            <div id="teacher-subject-performance-report" className="w-[800px] bg-white p-12 text-black border-[8px] border-double border-slate-900 space-y-6 font-sans">
               {/* Professional Letterhead */}
               <div className="flex items-center justify-between border-b-2 border-slate-900 pb-5 gap-4">
                {DbController.getSchoolInfo().logoUrl ? (
                  <img 
                    src={DbController.getSchoolInfo().logoUrl} 
                    alt="School Logo" 
                    className="w-20 h-20 object-contain" 
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center border border-slate-300 p-1">
                    <div className="w-full h-full rounded-full border border-dashed border-slate-400 bg-white flex flex-col items-center justify-center text-[8px] text-slate-500 font-mono font-bold leading-none">
                      <Award size={24} className="text-indigo-600 mb-0.5" />
                      <span className="scale-75 origin-center uppercase">CREST</span>
                    </div>
                  </div>
                )}
                <div className="flex-1 text-center space-y-1">
                  <h2 className="text-xl font-black text-slate-950 tracking-tight leading-tight uppercase font-display">
                    {DbController.getSchoolInfo().name}
                  </h2>
                  <p className="text-xs italic font-serif text-slate-600">
                    Motto: "{DbController.getSchoolInfo().motto}"
                  </p>
                  <div className="text-[10px] text-slate-500 flex flex-wrap justify-center gap-x-3 gap-y-0.5">
                    {DbController.getSchoolInfo().gpsAddress && <span>📍 {DbController.getSchoolInfo().gpsAddress}</span>}
                    {DbController.getSchoolInfo().telephone && <span>☎️ {DbController.getSchoolInfo().telephone}</span>}
                  </div>
                </div>
              </div>

              <div className="text-center space-y-2">
                <h3 className="text-lg font-black uppercase tracking-widest text-slate-900">Assigned Subject Performance Report</h3>
                <div className="flex justify-center gap-4 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50 py-2 rounded-lg border border-slate-200">
                  <span>Teacher: {DbController.getCurrentUser()?.name || 'Assigned Educator'}</span>
                  <span>Class: {selectedClass}</span>
                  <span>Period: {selectedTerm} ({selectedYear})</span>
                </div>
              </div>

              <table className="w-full text-left border-collapse border border-slate-900 font-sans mt-6">
                <thead>
                  <tr className="bg-slate-900 text-white uppercase font-black text-[11px] tracking-widest">
                    <th className="p-3 border border-slate-900">Assigned Subject Title</th>
                    <th className="p-3 border border-slate-900 text-center">Student Count</th>
                    <th className="p-3 border border-slate-900 text-center">Class Average</th>
                    <th className="p-3 border border-slate-900 text-center">Highest Score</th>
                    <th className="p-3 border border-slate-900 text-center text-rose-200">Lowest Score</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherSubjectStats.map(stat => (
                    <tr key={stat.subject} className="border-b border-slate-300 font-bold text-xs text-slate-800">
                      <td className="p-3 border border-slate-300">{stat.subject}</td>
                      <td className="p-3 border border-slate-300 text-center font-mono">{stat.gradedCount}</td>
                      <td className="p-3 border border-slate-300 text-center font-mono text-indigo-700">{stat.average.toFixed(1)}%</td>
                      <td className="p-3 border border-slate-300 text-center font-mono text-emerald-700">{stat.highest.toFixed(1)}%</td>
                      <td className="p-3 border border-slate-300 text-center font-mono text-rose-700">{stat.lowest.toFixed(1)}%</td>
                    </tr>
                  ))}
                  {teacherSubjectStats.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 italic">No assigned subject assessment data found for the current selection.</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="grid grid-cols-2 gap-10 mt-12 pt-8 border-t border-slate-200">
                <div className="space-y-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Statistical Summary & Observations</p>
                  <div className="h-20 bg-slate-50 border border-slate-200 rounded-lg"></div>
                </div>
                <div className="flex flex-col justify-end items-center space-y-2">
                  <div className="w-48 border-b-2 border-slate-900 h-10"></div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Teacher's Signature / Endorsement</span>
                </div>
              </div>

              <div className="mt-10 text-[9px] text-slate-400 text-center italic font-mono">
                This document is an official academic performance summary generated via the GEETECH SMS registry.
              </div>
            </div>
          </div>

          {/* Floating UI Controller Window */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 50, x: 0 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 50, x: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={`fixed bottom-6 right-6 z-40 no-print flex flex-col bg-white rounded-[24px] border border-slate-150 shadow-2xl transition-all duration-300 ${pdfFloatingMinimized ? 'w-80 h-14' : showPreviewPane ? 'w-full max-w-5xl h-[80vh] md:h-[620px]' : 'w-96 md:w-[440px] h-auto max-h-[85vh]'} overflow-hidden`}
          >
            
            {/* Header / Window Manager controls */}
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between cursor-move select-none flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
                <span className="font-bold text-xs font-display tracking-widest uppercase">Print & Export Center</span>
              </div>
              
              <div className="flex items-center gap-3">
                {!pdfFloatingMinimized && (
                  <button
                    onClick={() => setShowPreviewPane(!showPreviewPane)}
                    className="text-[10px] bg-slate-800 hover:bg-slate-700 font-bold px-2 py-1 rounded transition text-indigo-300 active:scale-95"
                    title={showPreviewPane ? "Collapse visual preview pane" : "Expand visual preview pane side-by-side"}
                  >
                    {showPreviewPane ? "Collapse Prev" : "Expand Preview 👁️"}
                  </button>
                )}

                <button
                  onClick={() => setPdfFloatingMinimized(!pdfFloatingMinimized)}
                  className="hover:text-slate-300 font-bold font-mono text-xs transition px-1.5 py-0.5 bg-slate-800 rounded text-indigo-300"
                  title={pdfFloatingMinimized ? "Restore to window" : "Minimize panel to corner pill"}
                >
                  {pdfFloatingMinimized ? "⬜ Expand" : "— Min"}
                </button>

                <button
                  onClick={() => {
                    setShowPdfGuide(false);
                    setPdfFloatingMinimized(false);
                  }}
                  className="hover:text-rose-400 font-bold font-mono text-sm leading-none transition"
                  title="Close Export Hub"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Core Window Contents (Dual Pane if previewPane is active, otherwise Single Pane) */}
            {pdfFloatingMinimized ? (
              // Empty minified pill layout handled in main wrapper styles, just keep it clean
              <div className="hidden"></div>
            ) : (
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-200">
                
                {/* Dual Pane Option -> Left Pane: Document Live Preview Mini clone */}
                {showPreviewPane && (
                  <div className="flex-1 p-6 overflow-y-auto bg-slate-700 flex flex-col justify-center items-center space-y-4">
                    <span className="text-white text-xs font-mono tracking-widest uppercase opacity-75">Document Layout Preview (A4 Scaled Draft)</span>
                    
                    {subMode === 'IndividualReport' ? (
                      /* Individual Portrait Student Report Card Visual Preview Clone */
                      <div className="w-[310px] aspect-[1/1.414] bg-white p-4 text-black border-2 border-double border-slate-800 shadow-2xl text-[6px] space-y-2 font-sans select-none overflow-y-auto rounded-none">
                        <div className="text-center border-b pb-1 mb-1 leading-normal">
                          <h3 className="text-[8px] font-black uppercase text-stone-900">{DbController.getSchoolInfo().name}</h3>
                          <p className="text-[6px] italic text-stone-600">"{DbController.getSchoolInfo().motto}"</p>
                          <p className="text-[6.5px] font-mono text-slate-800 font-black tracking-wider uppercase bg-slate-100 px-2 rounded-full inline-block mt-0.5">PROGRESS REPORT CARD</p>
                        </div>

                        <div className="bg-slate-50 p-1.5 rounded border border-slate-200 text-[6px] font-mono text-stone-800 grid grid-cols-2 gap-1 leading-normal">
                          <div><strong>ID:</strong> {compiledReport?.student.id || 'N/A'}</div>
                          <div><strong>STUDENT:</strong> {compiledReport ? `${compiledReport.student.firstName} ${compiledReport.student.lastName}` : 'Not Selected'}</div>
                          <div><strong>CLASS:</strong> {compiledReport?.student.class || selectedClass}</div>
                          <div><strong>TERM:</strong> {selectedTerm}</div>
                        </div>

                        <table className="w-full text-left text-[5.5px] border-collapse border border-slate-300 leading-normal">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-800 font-bold uppercase">
                              <th className="p-0.5 border border-slate-300">Course info</th>
                              <th className="p-0.5 border border-slate-300 text-center">Class (50)</th>
                              <th className="p-0.5 border border-slate-300 text-center">Exams (50)</th>
                              <th className="p-0.5 border border-slate-300 text-center font-bold">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {!compiledReport || compiledReport.grades.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="p-2 text-center text-slate-400 italic">No grade items to display.</td>
                              </tr>
                            ) : (
                              compiledReport.grades.slice(0, 5).map(g => (
                                <tr key={g.subject} className="border-b border-slate-150">
                                  <td className="p-0.5 border border-slate-150 font-bold">{g.subject}</td>
                                  <td className="p-0.5 border border-slate-150 text-center font-mono">{g.classScore50.toFixed(1)}</td>
                                  <td className="p-0.5 border border-slate-150 text-center font-mono">{g.examScore50.toFixed(1)}</td>
                                  <td className="p-0.5 border border-slate-150 text-center font-mono font-bold text-slate-900">{g.totalScore.toFixed(1)}%</td>
                                </tr>
                              ))
                            )}
                            {compiledReport && compiledReport.grades.length > 5 && (
                              <tr>
                                <td colSpan={4} className="p-0.5 text-center bg-slate-50 text-[5px] text-slate-400 italic">... of total {compiledReport.grades.length} courses compiled and printed inside high-res PDF output ...</td>
                              </tr>
                            )}
                          </tbody>
                        </table>

                        {compiledReport && (
                          <div className="bg-indigo-50/50 p-1 rounded border border-indigo-100 text-center text-[5.5px] font-mono leading-relaxed text-indigo-950 font-bold flex justify-around">
                            <span>Courses Graded: {compiledReport.totalSubjects}</span>
                            <span>Average Term Grade: {compiledReport.averageScore.toFixed(1)}%</span>
                          </div>
                        )}

                        {studentFinancials && (
                          <div className="bg-slate-50 p-1 rounded border border-slate-200 text-left text-[4.5px] font-mono leading-relaxed space-y-0.5">
                            <div className="flex justify-between border-b border-slate-100 pb-0.5">
                              <span>BAL DUE: <strong>GHS {studentFinancials.totalOutstanding.toFixed(2)}</strong></span>
                              <span>NEXT BILL: <strong>GHS {studentFinancials.nextTermBillSum.toFixed(2)}</strong></span>
                            </div>
                            <div className="text-slate-400 text-[4px] text-center">Includes term outstanding & incoming {studentFinancials.nextTerm} plan.</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Broadsheet Roster Landscape Visual Preview Clone */
                      <div className="w-[370px] aspect-[1.414/1] bg-white p-4 text-black border-2 border-double border-slate-800 shadow-2xl text-[5.5px] space-y-2 font-sans select-none overflow-y-auto rounded-none">
                        <div className="text-center border-b pb-1 mb-1 leading-normal">
                          <h3 className="text-[7.5px] font-black uppercase text-stone-900">{DbController.getSchoolInfo().name}</h3>
                          <p className="text-[5.5px] font-mono mt-0.5 italic text-slate-600 bg-slate-100 rounded px-2 inline-block">
                            {subMode === 'Broadsheet' ? 'Cumulative Academy Broadsheet' : `Subject Marks Spreadsheet - ${selectedSubject}`}
                          </p>
                        </div>

                        <div className="text-[5px] font-mono bg-slate-50 p-1 rounded border border-slate-200 leading-normal flex justify-between">
                          <span>CLASS: {selectedClass}</span>
                          <span>TERM: {selectedTerm} ({selectedYear})</span>
                        </div>

                        <table className="w-full text-left border-collapse text-[5px] leading-normal font-sans">
                          <thead>
                            <tr className="bg-slate-105 border-b border-slate-800 font-bold uppercase cursor-default">
                              <th className="py-0.5 px-1 border border-slate-300">Student Name</th>
                              <th className="py-0.5 px-1 border border-slate-300 text-center">{subMode === 'Broadsheet' ? 'Term Average' : 'Overall Mark'}</th>
                              <th className="py-0.5 px-1 border border-slate-300 text-center">Standings</th>
                            </tr>
                          </thead>
                          <tbody>
                            {subMode === 'Broadsheet' ? (
                              broadsheetData.slice(0, 4).map((row, idx) => (
                                <tr key={row.student.id} className="border-b border-slate-150">
                                  <td className="py-0.5 px-1 border border-slate-150 font-bold">{row.student.firstName} {row.student.lastName}</td>
                                  <td className="py-0.5 px-1 border border-slate-150 text-center font-mono text-indigo-700 font-bold">{row.averageOverallScore.toFixed(1)}%</td>
                                  <td className="py-0.5 px-1 border border-slate-150 text-center font-mono">Rank #{idx + 1}</td>
                                </tr>
                              ))
                            ) : (
                              activeWorksheet.slice(0, 4).map(row => (
                                <tr key={row.studentId} className="border-b border-slate-150">
                                  <td className="py-0.5 px-1 border border-slate-150 font-bold">{row.studentName}</td>
                                  <td className="py-0.5 px-1 border border-slate-150 text-center font-mono font-bold">{row.totalScore.toFixed(1)}</td>
                                  <td className="py-0.5 px-1 border border-slate-150 text-center font-mono">{row.remarks}</td>
                                </tr>
                              ))
                            )}
                            <tr>
                              <td colSpan={3} className="text-center py-0.5 bg-slate-50 text-[4.5px] text-indigo-600 font-mono italic">
                                ... continuous class register printed inside high-fidelity PDF output ...
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                    
                    <span className="text-[9px] text-slate-300 font-mono tracking-wide">
                      Miniature Draft Preview (Changes update instantly)
                    </span>
                  </div>
                )}

                {/* Right Pane: Controls and manual configurations */}
                <div className="w-full md:w-[400px] p-5 bg-white flex flex-col justify-between overflow-y-auto max-h-[80vh] md:max-h-[560px]">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                      <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 flex-shrink-0 animate-pulse">
                        <Eye size={20} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-950">Toggle Preview Mode & Print Controller</h4>
                        <p className="text-[10px] text-slate-400">Review assessment sheet print parameters</p>
                      </div>
                    </div>

                    {/* Student Select dropdown right inside print dialogue for better inputs! */}
                    {subMode === 'IndividualReport' && (
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 space-y-1.5 no-print">
                        <label className="text-[10px] text-slate-550 uppercase font-black block font-sans">Switch Target Student inside controller:</label>
                        <select
                          value={selectedStudentId}
                          onChange={(e) => setSelectedStudentId(e.target.value)}
                          className="w-full text-xs px-3 py-1.5 border border-slate-300 bg-white rounded-lg font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {students.filter(s => s.class === selectedClass).map(s => (
                            <option key={s.id} value={s.id}>
                              {s.firstName} {s.lastName} ({s.id})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <GoogleDriveExportControl 
                      elementId={subMode === 'IndividualReport' ? 'assessment-report-preview-portrait' : 'assessment-roster-preview-landscape'} 
                      defaultFilename={
                        subMode === 'IndividualReport' 
                          ? `${compiledReport ? `${compiledReport.student.firstName}_${compiledReport.student.lastName}` : 'Student'}_Report_Card.pdf`
                          : subMode === 'Broadsheet' 
                          ? `${selectedClass.replace(/\s+/g, '_')}_Broadsheet_Term_${selectedTerm}.pdf`
                          : `${selectedClass.replace(/\s+/g, '_')}_${selectedSubject.replace(/\s+/g, '_')}_Gradesheet_Term_${selectedTerm}.pdf`
                      }
                      isLandscape={subMode !== 'IndividualReport'} 
                    />

                    <div className="p-3 bg-teal-50 border border-teal-100 rounded-xl space-y-1 text-teal-800 text-[10px] leading-relaxed">
                      <span className="font-bold">💡 Recommended Orientation Checklist:</span>
                      <p className="text-[9.5px] text-teal-705">
                        {subMode === 'IndividualReport' 
                          ? 'Vertical Report Cards are optimized for Portrait layout options.' 
                          : 'Large broadsheets are best formatted with Landscape layout options to fit columns elegantly.'}
                      </p>
                    </div>

                    <div className="space-y-2 text-[10px] text-slate-700 font-sans font-semibold border-t border-slate-100 pt-3">
                      <span className="font-bold text-slate-900 border-b border-slate-100 pb-1 block">How to Export to PDF Checklist:</span>
                      
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <div className="font-bold text-[9px] text-slate-600 bg-slate-100 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">1</div>
                          <p className="leading-relaxed text-slate-500">
                            Click <strong className="text-indigo-600 font-bold">Trigger Print Engine</strong> below to load browser settings.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <div className="font-bold text-[9px] text-slate-600 bg-slate-100 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">2</div>
                          <p className="leading-relaxed text-slate-500">
                            Under Destination setting, choose <strong className="text-slate-900 font-bold">Save as PDF</strong> as your target.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <div className="font-bold text-[9px] text-slate-600 bg-slate-100 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">3</div>
                          <p className="leading-relaxed text-slate-500 font-sans">
                            Ensure Layout is optioned as <strong className="text-indigo-600 font-bold">{subMode === 'IndividualReport' ? 'Portrait' : 'Landscape'}</strong>, format A4, select <strong>Background graphics</strong>, and disable headers/footers in options.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-150/60 text-[9px] text-amber-800 leading-normal">
                      <strong>💡 Sandbox Hint:</strong> If direct print is blocked by Chrome sandbox, click <strong className="font-bold">"Open in a new tab" ↗</strong> key at top, then trigger print safely.
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-6 border-t border-slate-100 mt-6 font-sans bg-white">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPdfGuide(false);
                        setPdfFloatingMinimized(false);
                      }}
                      className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 font-semibold rounded-xl transition cursor-pointer text-[12px] flex-shrink-0"
                    >
                      Close Window
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handlePrint();
                      }}
                      className="flex-1 px-5 py-2.5 bg-[#059669] hover:bg-[#047857] text-white font-semibold rounded-xl shadow-xs transition cursor-pointer text-[12px] text-center flex items-center justify-center gap-1.5 active:translate-y-0.5"
                    >
                      <Printer size={13} /> Trigger Print Engine
                    </button>
                  </div>
                </div>

              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>

    {/* SECTION DATA CONTROLS */}
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3 no-print mt-6">
      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
        <ShieldAlert className="text-indigo-500" size={14} /> Section Assessment Controls
      </h4>
      <p className="text-[10px] text-slate-500 leading-relaxed">
        Manage local score parameters, clear sheet entries of active gradesheets, and erase historical academic indices database entries associated with this module.
      </p>
      <div className="flex flex-wrap gap-2.5 pt-1">
        <button
          type="button"
          onClick={handleClearInputs}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-850 hover:bg-slate-100 rounded-xl font-bold font-sans transition text-xs cursor-pointer shadow-xs"
        >
          <Eraser size={13} /> Clear All Inputs (Zero Out sheet)
        </button>
        <button
          type="button"
          onClick={handleDeleteActiveSelection}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 hover:text-amber-850 hover:bg-amber-100 rounded-xl font-bold font-sans transition text-xs cursor-pointer shadow-xs"
        >
          <RotateCcw size={13} /> Delete Selected Student Grade
        </button>
        <button
          type="button"
          onClick={handleDeleteAllAssessments}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 hover:text-rose-850 hover:bg-rose-100 rounded-xl font-bold font-sans transition text-xs cursor-pointer shadow-xs sm:ml-auto"
        >
          <Trash2 size={13} /> Delete All Section Data
        </button>
      </div>
    </div>

    {/* PARENTAL SMS NOTIFICATION HANDSHAKE MODAL OVERLAY */}
    <AnimatePresence>
      {smsModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto no-print">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSmsModalOpen(false)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs cursor-pointer"
          />

          {/* Modal Container */}
          <div className="flex min-h-full items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="relative w-full max-w-xl bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 md:p-8 space-y-6 text-slate-850 text-left font-sans"
            >
              
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-2xl flex items-center justify-center">
                    <Smartphone size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Parent SMS Notification Desk</h3>
                    <p className="text-[11px] text-slate-400">Bridge parent-school communication with secure digital portal tokens.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSmsModalOpen(false)}
                  className="p-1 px-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 transition font-black text-slate-400 text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Status indicator Success */}
              {smsSuccessMessage && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-start gap-2.5 leading-relaxed">
                  <CheckCircle size={16} className="text-emerald-600 flex-shrink-0 mt-0.5 animate-bounce" />
                  <div>
                    <strong className="font-bold block uppercase text-[10px] tracking-wide">Transmission Success</strong>
                    {smsSuccessMessage}
                  </div>
                </div>
              )}

              {/* Form Input fields */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Guardian Name */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">Guardian Name:</label>
                    <input 
                      type="text"
                      value={smsGuardianName}
                      onChange={(e) => {
                        setSmsGuardianName(e.target.value);
                        setSmsSuccessMessage(null);
                      }}
                      placeholder="e.g. Peg Yirenyi"
                      className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900 shadow-6xs"
                    />
                  </div>

                  {/* Guardian Telephone */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider flex justify-between">
                      <span>Guardian Telephone:</span>
                      {!smsGuardianPhone && <span className="text-amber-600 lowercase font-black text-[9px] animate-pulse">Required *</span>}
                    </label>
                    <input 
                      type="tel"
                      value={smsGuardianPhone}
                      onChange={(e) => {
                        setSmsGuardianPhone(e.target.value);
                        setSmsSuccessMessage(null);
                      }}
                      placeholder="e.g. +233240000000"
                      className={`w-full text-xs px-3.5 py-2.5 border rounded-xl font-bold font-mono focus:outline-none focus:ring-2 text-slate-900 shadow-6xs ${!smsGuardianPhone ? 'border-amber-300 bg-amber-50/50 focus:ring-amber-500' : 'border-slate-200 bg-slate-50 focus:ring-emerald-500'}`}
                    />
                  </div>
                </div>

                {/* Editable Message Textarea */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">Sms SMS Message Template Content:</label>
                    <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      Chars: {smsCustomMessage.length} ({(Math.ceil(smsCustomMessage.length / 160))} SMS)
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={smsCustomMessage}
                    onChange={(e) => {
                      setSmsCustomMessage(e.target.value);
                      setSmsSuccessMessage(null);
                    }}
                    className="w-full text-xs p-4 border border-slate-200 rounded-2xl bg-slate-50 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-700 leading-relaxed max-h-[140px]"
                  />
                  
                  {/* Safe Live Preview (Fictional Example) to avoid Data breach / PII leaks on screen */}
                  <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-1">
                    <span className="text-[9.5px] font-black uppercase text-emerald-850 font-sans tracking-wide block">🛡 GDPR Shield: Safe Fictional Preview</span>
                    <p className="text-[10.5px] text-slate-650 font-medium leading-relaxed font-sans italic select-none">
                      "{compileRandomSmsMessage(smsCustomMessage)}"
                    </p>
                  </div>

                  <div className="text-[9.5px] italic text-slate-400 flex items-center gap-1">
                    <MessageSquare size={12} className="text-slate-400" />
                    <span>The template supports <code className="bg-slate-150 text-slate-700 px-0.5 rounded font-mono font-bold">{"{guardianName}"}</code>, <code className="bg-slate-150 text-slate-700 px-0.5 rounded font-mono font-bold">{"{firstName}"}</code>, <code className="bg-slate-150 text-slate-700 px-0.5 rounded font-mono font-bold">{"{lastName}"}</code>, <code className="bg-slate-150 text-slate-700 px-0.5 rounded font-mono font-bold">{"{studentId}"}</code>, and <code className="bg-slate-150 text-slate-700 px-0.5 rounded font-mono font-bold">{"{reportLink}"}</code>.</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <button
                    type="button"
                    disabled={sendingSms || !smsGuardianPhone}
                    onClick={handleSendSMS}
                    className={`w-full sm:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black shadow-md cursor-pointer transition active:translate-y-0.5 text-center ${!smsGuardianPhone ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                  >
                    {sendingSms ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" /> Handshake...
                      </>
                    ) : (
                      <>
                        <Send size={13} /> Send via Twilio
                      </>
                    )}
                  </button>

                  {/* WhatsApp Direct */}
                  <a
                    href={(() => {
                      let formattedPhone = (smsGuardianPhone || '').trim().replace(/[\s\-\(\)\+]/g, '');
                      if (formattedPhone.startsWith('0') && formattedPhone.length === 10) {
                        formattedPhone = '233' + formattedPhone.substring(1);
                      }
                      const compiled = compileSmsMessage(smsCustomMessage, selectedStudentId);
                      const encodedMsg = encodeURIComponent(compiled || '');
                      return `https://wa.me/${formattedPhone}?text=${encodedMsg}`;
                    })()}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      const currentStudent = students.find(s => s.id === selectedStudentId);
                      const compiled = compileSmsMessage(smsCustomMessage, selectedStudentId);
                      const newLog = {
                        id: `WA_${Date.now()}`,
                        studentId: selectedStudentId,
                        studentName: currentStudent ? `${currentStudent.firstName} ${currentStudent.lastName}` : 'Student',
                        recipientName: smsGuardianName,
                        phoneNumber: smsGuardianPhone,
                        message: compiled,
                        timestamp: new Date().toISOString(),
                        status: 'Delivered'
                      };
                      const updatedLogs = [newLog, ...smsSentLogs];
                      setSmsSentLogs(updatedLogs);
                      setStorageItem('sms_assessment_sent_logs', updatedLogs);

                      if (currentStudent && currentStudent.guardianTelephone !== smsGuardianPhone) {
                        try {
                          const updatedStudent = {
                            ...currentStudent,
                            guardianTelephone: smsGuardianPhone
                          };
                          DbController.saveStudent(updatedStudent);
                        } catch (err) {
                          console.warn("Failed to sync guardian telephone updates:", err);
                        }
                      }
                    }}
                    className={`w-full sm:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-950 hover:bg-emerald-100 rounded-xl text-xs font-black transition cursor-pointer text-center ${!smsGuardianPhone ? 'pointer-events-none opacity-50 bg-slate-50 border-slate-100' : ''}`}
                    title="Dispatch compiled report portal link via WhatsApp"
                  >
                    💬 WhatsApp Link
                  </a>
                  
                  {/* Direct Native Cellular link protocol */}
                  <a
                    href={(() => {
                      const formattedPhone = (smsGuardianPhone || '').trim().replace(/[\s\-\(\)]/g, '');
                      const compiled = compileSmsMessage(smsCustomMessage, selectedStudentId);
                      const encodedMsg = encodeURIComponent(compiled || '');
                      const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
                      return isIOS ? `sms:${formattedPhone}&body=${encodedMsg}` : `sms:${formattedPhone}?body=${encodedMsg}`;
                    })()}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      // Log standard manual mobile carrier transfer
                      const compiled = compileSmsMessage(smsCustomMessage, selectedStudentId);
                      const newLog = {
                        id: `SMS_${Date.now()}_local`,
                        studentId: selectedStudentId,
                        studentName: students.find(s => s.id === selectedStudentId)?.firstName + " " + students.find(s => s.id === selectedStudentId)?.lastName,
                        recipientName: smsGuardianName,
                        phoneNumber: smsGuardianPhone,
                        message: compiled,
                        timestamp: new Date().toISOString(),
                        status: 'Delivered'
                      };
                      const updatedLogs = [newLog, ...smsSentLogs];
                      setSmsSentLogs(updatedLogs);
                      setStorageItem('sms_assessment_sent_logs', updatedLogs);
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 border border-indigo-200 text-indigo-950 hover:bg-indigo-100 rounded-xl text-xs font-black transition cursor-pointer text-center ${!smsGuardianPhone ? 'pointer-events-none opacity-50 bg-slate-50 border-slate-100' : ''}`}
                    title="Dispatch instantly through user device cellular network"
                  >
                    📱 Native SMS App
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => setSmsModalOpen(false)}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-650 transition rounded-xl font-bold text-xs cursor-pointer text-center"
                >
                  Cancel
                </button>
              </div>

              {/* SMS Audit Trail Logs Section */}
              <div className="border-t border-slate-100 pt-5 space-y-3">
                <h4 className="text-[10px] font-black uppercase text-slate-400 font-mono tracking-wider">SMS Dispatch History Log ({smsSentLogs.filter(l => l.studentId === selectedStudentId).length})</h4>
                {smsSentLogs.filter(l => l.studentId === selectedStudentId).length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic">No historical notifications triggered for this student report card yet.</p>
                ) : (
                  <div className="max-h-[110px] overflow-y-auto divide-y divide-slate-100 space-y-1.5 pr-2">
                    {smsSentLogs.filter(l => l.studentId === selectedStudentId).map((log, idx) => (
                      <div key={log.id} className="text-[10.5px] py-2 flex flex-col space-y-1 font-sans">
                        <div className="flex justify-between font-mono text-[9px]">
                          <span className="text-slate-500 font-semibold">{log.recipientName} ({log.phoneNumber})</span>
                          <span className="text-emerald-600 font-black flex items-center gap-0.5">
                            <CheckCircle size={9} /> DELIVERED
                          </span>
                        </div>
                        <p className="text-slate-500 text-[10px] leading-relaxed line-clamp-1">{log.message}</p>
                        <span className="text-[8.5px] font-mono text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>

    {/* ⎯⎯⎯⎯⎯⎯⎯⎯ HIGH-FIDELITY SIMULATED A4 PRINT PREVIEW MODAL ⎯⎯⎯⎯⎯⎯⎯⎯ */}
    <AnimatePresence>
      {showPrintPreviewModal && compiledReport && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 overflow-y-auto flex items-center justify-center p-4 font-sans select-none no-print">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            className="bg-slate-900 border border-slate-800 w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[90vh]"
          >
            {/* Modal Top Header Control Ribbon */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg">
                  <Printer size={18} />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-black tracking-tight text-white uppercase font-display">Simulated A4 Page Print Preview</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Verify visual layout margins and dynamic progress reports before physical print output</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowPrintPreviewModal(false)}
                className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Split layout: Sidebar controls & Interactive A4 Sheet View */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
              {/* Left Sidebar Section */}
              <div className="w-full md:w-[350px] bg-slate-950/40 p-5 border-b md:border-b-0 md:border-r border-slate-800 overflow-y-auto space-y-5 text-left flex-shrink-0">
                
                {/* Print Verification Checklist */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">Verification Checklist</span>
                    <span className="text-[9px] font-mono bg-indigo-600/20 text-indigo-300 px-2 py-0.5 rounded-full font-bold">
                      {Math.round(((checklistStudent ? 1 : 0) + (checklistGrades ? 1 : 0) + (checklistRemarks ? 1 : 0) + (checklistFinances ? 1 : 0)) / 4 * 100)}% Verified
                    </span>
                  </div>
                  
                  <div className="space-y-2.5 bg-slate-950/65 p-3.5 rounded-xl border border-slate-800">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={checklistStudent} 
                        onChange={(e) => setChecklistStudent(e.target.checked)}
                        className="mt-1 rounded border-slate-700 text-indigo-600 focus:ring-indigo-550 h-3.5 w-3.5 bg-slate-900"
                      />
                      <div className="text-[11px] leading-normal">
                        <span className="font-bold text-slate-200">Student Metadata & Identity</span>
                        <p className="text-[9.5px] text-slate-400 mt-0.5">Verify ID ({compiledReport.student.id}), spelling, class: {compiledReport.student.class}, and academic year indicators.</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer select-none border-t border-slate-800 pt-2.5 mt-2.5">
                      <input 
                        type="checkbox" 
                        checked={checklistGrades} 
                        onChange={(e) => setChecklistGrades(e.target.checked)}
                        className="mt-1 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 bg-slate-900"
                      />
                      <div className="text-[11px] leading-normal">
                        <span className="font-bold text-slate-200">Grades & Course Averages</span>
                        <p className="text-[9.5px] text-slate-400 mt-0.5">Validate class marks, exam totals (50%), rankings, and weighted terminal average score ({compiledReport.averageScore}%).</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer select-none border-t border-slate-800 pt-2.5 mt-2.5">
                      <input 
                        type="checkbox" 
                        checked={checklistRemarks} 
                        onChange={(e) => setChecklistRemarks(e.target.checked)}
                        className="mt-1 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 bg-slate-900"
                      />
                      <div className="text-[11px] leading-normal">
                        <span className="font-bold text-slate-200">Remarks, Signatures & Stamps</span>
                        <p className="text-[9.5px] text-slate-400 mt-0.5">Verify teacher remarks logic, school stamp logo URL, and authority signatures rendering.</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer select-none border-t border-slate-800 pt-2.5 mt-2.5">
                      <input 
                        type="checkbox" 
                        checked={checklistFinances} 
                        onChange={(e) => setChecklistFinances(e.target.checked)}
                        className="mt-1 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 bg-slate-900"
                      />
                      <div className="text-[11px] leading-normal">
                        <span className="font-bold text-slate-200">Ledger Balances & Reopenings</span>
                        <p className="text-[9.5px] text-slate-400 mt-0.5">Validate future billing projections (GHS {studentFinancials?.nextTermBillSum.toFixed(2) || '0.00'}) and reopening date schedule.</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Print Layout Options */}
                <div className="space-y-3 pt-1 border-t border-slate-800/80">
                  <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1.5">
                    <Sliders size={12} /> Paper & Layout Settings
                  </span>
                  
                  <div className="space-y-3">
                    {/* Orientation Selector */}
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-400 uppercase font-mono tracking-wider">Orientation Mode</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button 
                          type="button"
                          onClick={() => setPreviewOrientation('portrait')}
                          className={`py-1.5 text-[10.5px] rounded-lg border transition font-semibold cursor-pointer text-center ${previewOrientation === 'portrait' ? 'bg-indigo-600 border-indigo-500 text-white animate-pulse' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'}`}
                        >
                          Portrait A4
                        </button>
                        <button 
                          type="button"
                          onClick={() => setPreviewOrientation('landscape')}
                          className={`py-1.5 text-[10.5px] rounded-lg border transition font-semibold cursor-pointer text-center ${previewOrientation === 'landscape' ? 'bg-indigo-600 border-indigo-500 text-white animate-pulse' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'}`}
                        >
                          Landscape A4
                        </button>
                      </div>
                    </div>

                    {/* Palette preset */}
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-400 uppercase font-mono tracking-wider">Color Style Preset</label>
                      <div className="grid grid-cols-3 gap-1">
                        <button 
                          type="button"
                          onClick={() => setPreviewThemePreset('vivid')}
                          className={`py-1 text-[9.5px] rounded-lg border transition font-semibold cursor-pointer text-center ${previewThemePreset === 'vivid' ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300 font-bold' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'}`}
                        >
                          Vivid Accent
                        </button>
                        <button 
                          type="button"
                          onClick={() => setPreviewThemePreset('charcoal')}
                          className={`py-1 text-[9.5px] rounded-lg border transition font-semibold cursor-pointer text-center ${previewThemePreset === 'charcoal' ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300 font-bold' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'}`}
                        >
                          Charcoal
                        </button>
                        <button 
                          type="button"
                          onClick={() => setPreviewThemePreset('grayscale')}
                          className={`py-1 text-[9.5px] rounded-lg border transition font-semibold cursor-pointer text-center ${previewThemePreset === 'grayscale' ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300 font-bold' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'}`}
                        >
                          Grayscale
                        </button>
                      </div>
                    </div>

                    {/* Margins */}
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-400 uppercase font-mono tracking-wider">Simulated Margin Width</label>
                      <div className="grid grid-cols-3 gap-1">
                        <button 
                          type="button"
                          onClick={() => setPreviewMarginSize('normal')}
                          className={`py-1 text-[9.5px] rounded-lg border transition font-semibold cursor-pointer text-center ${previewMarginSize === 'normal' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'}`}
                        >
                          Normal (32px)
                        </button>
                        <button 
                          type="button"
                          onClick={() => setPreviewMarginSize('narrow')}
                          className={`py-1 text-[9.5px] rounded-lg border transition font-semibold cursor-pointer text-center ${previewMarginSize === 'narrow' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'}`}
                        >
                          Narrow (16px)
                        </button>
                        <button 
                          type="button"
                          onClick={() => setPreviewMarginSize('none')}
                          className={`py-1 text-[9.5px] rounded-lg border transition font-semibold cursor-pointer text-center ${previewMarginSize === 'none' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'}`}
                        >
                          Compact
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Print Guidance Alert */}
                <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 leading-normal space-y-1">
                  <span className="text-[9.5px] font-black uppercase text-amber-500 tracking-wider flex items-center gap-1 font-sans">
                    <HelpCircle size={11} className="text-amber-500" /> System Printer Guidelines
                  </span>
                  <div className="text-[8.5px] text-slate-450 space-y-1 font-sans">
                    <p>• Check <strong>Background graphics</strong> to preserve the custom colors, headers, and seals correctly.</p>
                    <p>• Avoid custom margins; select <strong>Default/None</strong> to respect the chosen digital margin styling layout.</p>
                    <p>• Set paper size option to <strong>A4</strong> and disable header/footers to remove automated URL strings.</p>
                  </div>
                </div>

              </div>

              {/* Right Canvas: Professional simulated A4 view */}
              <div className="flex-1 bg-slate-950 p-6 md:p-10 flex items-start justify-center overflow-y-auto h-full">
                <div 
                  className={`bg-white text-slate-900 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-slate-100/10 transition-all duration-300 transform rounded-sm relative origin-top ${
                    previewOrientation === 'portrait' ? 'w-full max-w-[760px] aspect-[1/1.414]' : 'w-full max-w-[1000px] aspect-[1.414/1]'
                  } ${
                    previewThemePreset === 'charcoal' ? 'ring-1 ring-slate-400' : previewThemePreset === 'grayscale' ? 'filter grayscale contrast-125' : ''
                  }`}
                  style={{
                    padding: previewMarginSize === 'normal' ? '40px' : previewMarginSize === 'narrow' ? '24px' : '12px'
                  }}
                >
                  {/* Top-Right Simulated Paper Dimensions Tag */}
                  <div className="absolute top-2.5 right-3 px-2 py-0.5 bg-slate-100 text-slate-500 rounded font-mono text-[8px] font-bold select-none tracking-wider pointer-events-none uppercase">
                    A4 Sheet • {previewOrientation === 'portrait' ? '210 x 297mm (Portrait)' : '297 x 210mm (Landscape)'}
                  </div>

                  {/* High fidelity simulation contents */}
                  <div className="h-full flex flex-col justify-between font-sans relative text-left">
                    
                    {/* Header Structure */}
                    <div>
                      <div className="flex items-center justify-between border-b pb-4 mb-5 gap-3">
                        <div className="flex items-center gap-2.5">
                          {DbController.getSchoolInfo().logoUrl ? (
                            <img 
                              src={DbController.getSchoolInfo().logoUrl} 
                              alt="Logo" 
                              className="w-11 h-11 object-contain flex-shrink-0"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-11 h-11 bg-slate-100 rounded-full flex items-center justify-center border p-1 border-slate-200">
                              <Award size={16} className="text-indigo-600" />
                            </div>
                          )}
                          <div>
                            <h2 className="text-[13px] font-black uppercase tracking-tight text-slate-950 font-display">
                              {DbController.getSchoolInfo().name}
                            </h2>
                            <p className="text-[9px] italic text-slate-500">Motto: "{DbController.getSchoolInfo().motto}"</p>
                            <span className="text-[8px] text-slate-400 block mt-0.5 font-sans">📍 {DbController.getSchoolInfo().gpsAddress || 'GPS Info N/A'} • ☎️ {DbController.getSchoolInfo().telephone || 'N/A'}</span>
                          </div>
                        </div>

                        {compiledReport.student.photoUrl ? (
                          <img 
                            src={compiledReport.student.photoUrl} 
                            alt="Student" 
                            className="w-10 h-10 rounded object-cover border border-slate-200 flex-shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-10 h-10 border border-dashed border-slate-300 flex flex-col items-center justify-center bg-slate-50 text-[6px] text-slate-400 font-mono flex-shrink-0 text-center leading-tight">
                            <span>PASSPORT</span>
                          </div>
                        )}
                      </div>

                      {/* Title Banners */}
                      <div className="bg-slate-100 px-3 py-1.5 rounded-lg flex items-center justify-between text-[9px] font-medium text-slate-705 select-none">
                        <span>OFFICIAL STUDENT PROGRESS STATEMENT</span>
                        <span className="font-mono bg-slate-300 text-slate-950 px-2 py-0.5 rounded font-black text-slate-900">{selectedTerm} ({selectedYear})</span>
                      </div>

                      {/* Metadata Cards */}
                      <div className="grid grid-cols-4 gap-2.5 mt-3 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100 text-[10px]">
                        <div>
                          <span className="text-[8px] uppercase text-slate-400 font-mono font-medium block">STUDENT ID</span>
                          <span className="font-mono font-black text-slate-900">{compiledReport.student.id}</span>
                        </div>
                        <div>
                          <span className="text-[8px] uppercase text-slate-400 font-mono font-medium block">FULL NAME</span>
                          <strong className="text-slate-800">{compiledReport.student.firstName} {compiledReport.student.lastName}</strong>
                        </div>
                        <div>
                          <span className="text-[8px] uppercase text-slate-400 font-mono font-medium block">CLASS</span>
                          <span className="text-slate-800 font-bold">{compiledReport.student.class} ({compiledReport.student.section})</span>
                        </div>
                        <div className="relative group cursor-help bg-indigo-50/30 p-1 rounded-lg border border-indigo-100/30 transition-all hover:bg-indigo-50/60">
                          <span className="text-[8px] uppercase text-indigo-700 font-mono font-bold flex items-center gap-1 select-none">
                            CLASS RANK <HelpCircle size={9} className="text-indigo-400" />
                          </span>
                          <strong className="text-indigo-900 font-bold font-mono block mt-0.5">{compiledReport.classRank || 'N/A'}</strong>
                          <RankBreakdownTooltip 
                            term={selectedTerm} 
                            year={selectedYear} 
                            averageScore={compiledReport.averageScore} 
                            gradedCount={compiledReport.gradedCount} 
                          />
                        </div>
                      </div>

                      {/* Grades Table */}
                      <div className="mt-4">
                        <table className="w-full text-left border-collapse border border-slate-200 text-[9px]">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-300 font-mono text-[8px] font-black text-slate-500 uppercase tracking-wider animate-pulse">
                              <th className="py-1 px-2 border border-slate-200 font-black">Course Subject</th>
                              <th className="py-1 px-1.5 border border-slate-200 text-center font-black">Class (50%)</th>
                              <th className="py-1 px-1.5 border border-slate-200 text-center font-black">Exams (50%)</th>
                              <th className="py-1 px-1.5 border border-slate-200 text-center font-black">Total (100)</th>
                              <th className="py-1 px-2 border border-slate-200 text-center font-black">Grade Descriptor</th>
                              <th className="py-1 px-1.5 border border-slate-200 text-center font-black">Rank</th>
                            </tr>
                          </thead>
                          <tbody>
                            {compiledReport.grades.slice(0, 7).map((item) => (
                              <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/10">
                                <td className="py-1 px-2 font-bold text-slate-800">{item.subject}</td>
                                <td className="py-1 px-1.5 text-center font-mono text-slate-600">{item.classScore50}</td>
                                <td className="py-1 px-1.5 text-center font-mono text-slate-600">{item.examScore50}</td>
                                <td className="py-1 px-1.5 text-center font-mono font-black text-indigo-700">{item.totalScore}%</td>
                                <td className="py-1 px-2 text-center">
                                  <span className={`inline-block px-1.5 py-0.5 rounded text-[7.5px] font-black uppercase font-mono ${
                                    item.totalScore >= 80 ? 'bg-emerald-50 text-emerald-800 border border-emerald-110' : item.totalScore >= 60 ? 'bg-blue-50 text-blue-800 border border-blue-110' : 'bg-rose-50 text-rose-800 border border-rose-110'
                                  }`}>
                                    {item.remarks} ({item.gradeLevel})
                                  </span>
                                </td>
                                <td className="py-1 px-1.5 text-center font-mono font-bold text-slate-700">{item.position || 'N/A'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {compiledReport.grades.length > 7 && (
                          <div className="text-[8px] italic text-slate-400 mt-1 select-none font-mono text-center">
                            (+ {compiledReport.grades.length - 7} remaining subjects in compilation roster)
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Aggregates, Fees ledger and Principal Sign-off Columns */}
                    <div className="mt-4 pt-3 border-t space-y-3">
                      {/* Course statistics card */}
                      <div className="grid grid-cols-4 gap-2 text-center text-[9px]">
                        <div className="bg-slate-50 p-1 rounded border border-slate-100 text-slate-600 leading-normal">
                          <span className="text-[7.5px] uppercase text-slate-400 block font-mono">Total Courses</span>
                          <strong className="text-slate-800 text-[10px] font-mono leading-tight">{compiledReport.totalSubjects}</strong>
                        </div>
                        <div className="bg-slate-50 p-1 rounded border border-slate-100 text-slate-600 leading-normal">
                          <span className="text-[7.5px] uppercase text-slate-400 block font-mono">Weighted Average</span>
                          <strong className="text-slate-800 text-[10px] font-mono leading-tight">{compiledReport.averageScore}%</strong>
                        </div>
                        <div className="bg-slate-50 p-1 rounded border border-slate-100 text-slate-600 leading-normal">
                          <span className="text-[7.5px] uppercase text-slate-400 block font-mono">Total Attendance</span>
                          <strong className="text-slate-800 text-[9px] leading-tight">{compiledReport.attendancePresent} / {compiledReport.schoolOpenDays} days</strong>
                        </div>
                        <div className="bg-slate-50 p-1 rounded border border-slate-100 text-indigo-750 leading-normal">
                          <span className="text-[7.5px] uppercase text-indigo-400 block font-mono">Academic Status</span>
                          <strong className="text-indigo-805 text-[9px] uppercase leading-tight font-bold">GES Certified</strong>
                        </div>
                      </div>

                      {/* Direct Ledger Integration */}
                      {studentFinancials && (
                        <div className="grid grid-cols-2 gap-3.5 bg-slate-100/40 p-2.5 rounded text-[8.5px] leading-normal border border-slate-200">
                          <div>
                            <span className="text-[7.5px] uppercase text-slate-500 font-mono block">Current Balance status</span>
                            <strong className={`${studentFinancials.totalOutstanding > 0 ? 'text-rose-700' : 'text-emerald-700'} font-bold text-[9.5px]`}>
                              GHS {studentFinancials.totalOutstanding.toFixed(2)}
                            </strong>
                            <div className="text-[7px] text-slate-400 leading-none mt-0.5">Includes outstanding system invoice history.</div>
                          </div>
                          <div>
                            <span className="text-[7.5px] uppercase text-slate-500 font-mono block">Estimated Next Term Projected</span>
                            <strong className="text-slate-800 font-bold text-[9.5px]">GHS {studentFinancials.nextTermBillSum.toFixed(2)}</strong>
                            <div className="text-[7px] text-slate-400 leading-none mt-0.5 font-sans">Next reopens: {formatReopeningDate(DbController.getSchoolInfo().reopeningDate)}</div>
                          </div>
                        </div>
                      )}

                      {/* Headteacher Endorsements desk */}
                      <div className="grid grid-cols-2 gap-4 text-[9px] leading-relaxed">
                        <div className="space-y-1">
                          <span className="text-[7.5px] font-mono text-slate-400 uppercase font-black">Principal Headteacher Remarks</span>
                          <p className="p-2 bg-slate-50 rounded border border-slate-100 italic text-slate-650 min-h-[40px] text-[8px] leading-relaxed">
                            {compiledReport.averageScore >= 80 
                              ? 'Excellent performance! The student reflects high mastery level standards on the GES curriculum benchmarks.' 
                              : compiledReport.averageScore >= 68 
                              ? 'Satisfactory progress. Proficient level achieved across most cognitive subject domains.' 
                              : compiledReport.averageScore >= 54 
                              ? 'An average term result. Needs more dedication and revision in quantitative sciences.' 
                              : 'Underperforming benchmarks. Urgent tutoring is recommended to foster remediation.'}
                          </p>
                        </div>
                        <div className="flex flex-col items-center justify-end text-center relative mt-2">
                          <div className="relative w-full h-8 flex items-center justify-center">
                            {DbController.getSchoolInfo().stampUrl && (
                              <img 
                                src={DbController.getSchoolInfo().stampUrl} 
                                alt="Stamp" 
                                className="absolute w-10 h-10 object-contain opacity-40 transform -rotate-12 translate-x-[-15%]" 
                                referrerPolicy="no-referrer"
                              />
                            )}
                            {DbController.getSchoolInfo().signatureUrl ? (
                              <img 
                                src={DbController.getSchoolInfo().signatureUrl} 
                                alt="Signature" 
                                className="absolute w-20 h-6 object-contain" 
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="border-b border-dashed border-slate-300 w-28 mb-1"></div>
                            )}
                          </div>
                          <span className="text-[7.5px] uppercase tracking-wider text-slate-400 font-mono mt-1 font-bold">Authorized Seal Sign-off</span>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Bottom control panel bar */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-t border-slate-800 flex-shrink-0">
              <span className="hidden sm:inline text-[10px] text-slate-400 text-left">
                Ensure all verification checkboxes on the left are reviewed for safety compliance
              </span>
              <div className="flex items-center gap-3 ml-auto">
                <button
                  type="button"
                  onClick={() => setShowPrintPreviewModal(false)}
                  className="px-4 py-2 hover:bg-slate-800 text-slate-300 hover:text-white font-bold transition rounded-xl text-xs cursor-pointer select-none"
                >
                  Cancel & Adjust
                </button>
                <button
                  type="button"
                  onClick={executeNativePrint}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 hover:scale-[1.01] active:scale-[0.99] text-white font-black transition rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-950/20 select-none animate-bounce"
                >
                  <Printer size={13} /> Confirm & Proceed to Print
                </button>
              </div>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* Assessment Template Modal */}
    <AnimatePresence>
      {showTemplateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col font-sans"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Sliders size={18} className="text-indigo-600" />
                Configure Class Assessment Template
              </h3>
              <button 
                onClick={() => setShowTemplateModal(false)}
                className="text-slate-400 hover:text-slate-700 transition"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700">Custom Components (Scaled to 50%)</label>
                    <button
                      onClick={() => setCustomComponents([...customComponents, {name: 'New Component', maxScore: 20}])}
                      className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-2 py-1 rounded font-semibold flex items-center gap-1 transition"
                    >
                      <Plus size={12} /> Add
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {customComponents.map((comp, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div className="flex-1 space-y-1">
                          <label className="text-[10px] uppercase font-bold text-slate-500">Component Name</label>
                          <input 
                            type="text" 
                            value={comp.name}
                            onChange={(e) => {
                              const newComps = [...customComponents];
                              newComps[idx].name = e.target.value;
                              setCustomComponents(newComps);
                            }}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs font-medium focus:outline-none focus:border-indigo-400"
                          />
                        </div>
                        <div className="w-24 space-y-1">
                          <label className="text-[10px] uppercase font-bold text-slate-500">Max Score</label>
                          <input 
                            type="number" 
                            value={comp.maxScore}
                            min="1"
                            onChange={(e) => {
                              const newComps = [...customComponents];
                              newComps[idx].maxScore = parseInt(e.target.value) || 0;
                              setCustomComponents(newComps);
                            }}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs font-medium focus:outline-none focus:border-indigo-400"
                          />
                        </div>
                        <button
                          onClick={() => {
                            const newComps = customComponents.filter((_, i) => i !== idx);
                            setCustomComponents(newComps);
                          }}
                          className="text-rose-500 hover:bg-rose-50 p-1.5 rounded mt-4"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    {customComponents.length === 0 && (
                      <div className="text-center p-4 border border-dashed border-slate-300 rounded-lg text-slate-400 text-xs">
                        No components defined. Click "Add" to create a custom assessment part.
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 bg-slate-50 p-3 rounded-lg flex items-start gap-2 border border-slate-100">
                    <Info size={14} className="shrink-0 mt-0.5" />
                    <p>Custom component scores will be summed and automatically scaled to calculate the 50% Class Assessment portion of the student's final grade.</p>
                  </div>
                </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (customComponents.length === 0) {
                    alert('Please add at least one custom component.');
                    return;
                  }
                  
                  const compoundId = `${selectedClass}_${selectedYear}_${selectedTerm}_${selectedSubject.replace(/\s+/g, '')}`.replace(/\//g, '-');
                  
                  DbController.saveAssessmentTemplate({
                    id: compoundId,
                    components: customComponents
                  });
                  
                  // Reload worksheet
                  const sheet = DbController.getAssessmentsSheet(selectedClass, selectedYear, selectedTerm, selectedSubject);
                  setActiveWorksheet(sheet);
                  setUnsavedChanges(false);
                  setShowTemplateModal(false);
                }}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition active:scale-95"
              >
                Save & Apply Template
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {confirmModal && confirmModal.isOpen && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 no-print animate-fade-in">
        <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden text-left p-6 space-y-4 animate-scale-up">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-xl shrink-0 ${confirmModal.danger ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
              <AlertCircle size={24} className="animate-bounce-slow" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 font-sans tracking-tight">
                {confirmModal.title}
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {confirmModal.message}
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setConfirmModal(null)}
              className="flex-1 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer select-none text-center"
            >
              {confirmModal.cancelText || 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => {
                confirmModal.onConfirm();
                setConfirmModal(null);
              }}
              className={`flex-1 py-2 px-4 text-white font-bold text-xs rounded-xl transition cursor-pointer select-none text-center ${
                confirmModal.danger 
                  ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800' 
                  : 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800'
              }`}
            >
              {confirmModal.confirmText || 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    )}

    </div>
  );
}
