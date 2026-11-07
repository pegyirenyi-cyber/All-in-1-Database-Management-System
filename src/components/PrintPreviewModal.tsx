import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Printer, FileDown, Settings, Layout, Check, 
  HelpCircle, Eye, RefreshCw, FileText, Compass, Info,
  Smartphone, Monitor, Palette, Code, Sliders,
  Table, Paintbrush, ChevronDown, ChevronUp,
  Plus, Minus, ZoomIn, ZoomOut, Maximize, Minimize,
  PanelLeftClose, PanelLeftOpen, Maximize2, Minimize2, RotateCcw
} from 'lucide-react';
import { getWatermarkHtml } from '../utils';
import { DbController } from '../db';
import { generatePdfFromHtml, downloadBlobLocally } from '../pdfHelper';
import { PrintPreviewScrollWrapper } from './PrintPreviewScrollWrapper';

const GHANA_CREST_SVG = `
<svg viewBox="0 0 100 100" width="100%" height="100%" style="width: 420px; height: 420px; color: #0f172a;">
  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 1.5" />
  <circle cx="50" cy="50" r="41" fill="none" stroke="currentColor" stroke-width="0.6" />
  <path d="M 32,32 L 68,32 C 68,32 68,58 50,74 C 32,58 32,32 32,32 Z" fill="none" stroke="currentColor" stroke-width="1.2" />
  <path d="M 50,32 L 50,74" stroke="currentColor" stroke-width="0.6" />
  <path d="M 32,50 L 68,50" stroke="currentColor" stroke-width="0.6" />
  <!-- Star in Center -->
  <polygon points="50,45 52,49 57,49 53,52 55,56 50,54 45,56 47,52 43,49 48,49" fill="currentColor" opacity="0.6" />
  <!-- Book (Top Right) -->
  <path d="M 53,36 L 65,36 L 65,46 L 53,46 Z" fill="none" stroke="currentColor" stroke-width="0.6" />
  <path d="M 53,41 L 65,41" stroke="currentColor" stroke-width="0.4" />
  <!-- Torch (Top Left) -->
  <line x1="41" y1="36" x2="41" y2="46" stroke="currentColor" stroke-width="1.2" />
  <circle cx="41" cy="35" r="1.2" fill="currentColor" />
  <!-- Laurel Wreath (Sides) -->
  <path d="M 23,35 C 19,48 19,63 34,74" fill="none" stroke="currentColor" stroke-width="0.6" />
  <path d="M 77,35 C 81,48 81,63 66,74" fill="none" stroke="currentColor" stroke-width="0.6" />
  <!-- Ribbon banner -->
  <path d="M 25,79 L 75,79 C 75,79 65,85 50,85 C 35,85 25,79 25,79 Z" fill="none" stroke="currentColor" stroke-width="0.6" />
  <text x="50" y="83" font-size="2.6" font-family="'Inter', sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor" letter-spacing="0.3">KNOWLEDGE & CHARACTER</text>
  <text x="50" y="16" font-size="3.0" font-family="'Inter', sans-serif" font-weight="900" text-anchor="middle" fill="currentColor" letter-spacing="0.8">GHANA EDUCATION SERVICE</text>
</svg>
`;

const GHANA_CREST_HEADER_SVG = `
<svg viewBox="0 0 100 100" class="text-slate-800" style="width: 55px; height: 55px; margin-right: 15px; flex-shrink: 0; color: #1e293b;">
  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 1" />
  <circle cx="50" cy="50" r="41" fill="none" stroke="currentColor" stroke-width="0.75" />
  <path d="M 32,32 L 68,32 C 68,32 68,58 50,74 C 32,58 32,32 32,32 Z" fill="none" stroke="currentColor" stroke-width="1.5" />
  <path d="M 50,32 L 50,74" stroke="currentColor" stroke-width="0.75" />
  <path d="M 32,50 L 68,50" stroke="currentColor" stroke-width="0.75" />
  <polygon points="50,45 52,49 57,49 53,52 55,56 50,54 45,56 47,52 43,49 48,49" fill="currentColor" />
  <path d="M 53,36 L 65,36 L 65,46 L 53,46 Z" fill="none" stroke="currentColor" stroke-width="0.75" />
  <path d="M 53,41 L 65,41" stroke="currentColor" stroke-width="0.5" />
  <line x1="41" y1="36" x2="41" y2="46" stroke="currentColor" stroke-width="1.5" />
  <circle cx="41" cy="35" r="1.5" fill="currentColor" />
  <path d="M 23,35 C 19,48 19,63 34,74" fill="none" stroke="currentColor" stroke-width="0.75" />
  <path d="M 77,35 C 81,48 81,63 66,74" fill="none" stroke="currentColor" stroke-width="0.75" />
  <path d="M 25,79 L 75,79 C 75,79 65,85 50,85 C 35,85 25,79 25,79 Z" fill="none" stroke="currentColor" stroke-width="0.75" />
  <text x="50" y="83" font-size="2.8" font-family="'Inter', sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor" letter-spacing="0.5">KNOWLEDGE & CHARACTER</text>
  <text x="50" y="16" font-size="3.2" font-family="'Inter', sans-serif" font-weight="900" text-anchor="middle" fill="currentColor" letter-spacing="1">GHANA EDUCATION SERVICE</text>
</svg>
`;

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  elementId?: string; // Target element to print
  customHtml?: string; // Alternatively direct HTML content
  documentTitle: string; // Title for the printed page / document
  isLandscapeDefault?: boolean;
  onLanguageChange?: (lang: 'en' | 'twi') => void;
  currentLanguage?: 'en' | 'twi';
  studentId?: string;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  elementId,
  customHtml,
  documentTitle,
  isLandscapeDefault = false,
  onLanguageChange,
  currentLanguage = 'en',
  studentId
}) => {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(isLandscapeDefault ? 'landscape' : 'portrait');
  const [paperSize, setPaperSize] = useState<'a4' | 'letter' | 'receipt'>('a4');
  const [margins, setMargins] = useState<'normal' | 'narrow' | 'none'>('normal');
  const [customMargin, setCustomMargin] = useState<number>(48);
  const [includeOfficialHeader, setIncludeOfficialHeader] = useState<boolean>(true);
  const [includeSignatureLine, setIncludeSignatureLine] = useState<boolean>(true);
  const [includeWatermark, setIncludeWatermark] = useState<boolean>(true);
  const [hideStudentPhotos, setHideStudentPhotos] = useState<boolean>(false);
  const [includeBlankGrades, setIncludeBlankGrades] = useState<boolean>(true);
  const [includePageNumbers, setIncludePageNumbers] = useState<boolean>(true);
  const [forcePrintBackgrounds, setForcePrintBackgrounds] = useState<boolean>(true);
  const [fontSizeScale, setFontSizeScale] = useState<'small' | 'normal' | 'large'>('normal');
  const [printLayout, setPrintLayout] = useState<'compact' | 'full'>('full');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [sourceClassName, setSourceClassName] = useState<string>('');
  const [showAuditLog, setShowAuditLog] = useState<boolean>(false);
  const [mobileActiveTab, setMobileActiveTab] = useState<'settings' | 'preview'>('preview');
  const [scaleMode, setScaleMode] = useState<'fit-width' | 'fit-page' | 'manual'>('fit-width');
  const [layoutExpanded, setLayoutExpanded] = useState<boolean>(true);
  const [brandingExpanded, setBrandingExpanded] = useState<boolean>(false);
  const [advancedExpanded, setAdvancedExpanded] = useState<boolean>(false);

  // Advanced Print & CSS Style Format state
  const [cssTheme, setCssTheme] = useState<'classic-academic' | 'modern-minimal' | 'executive-formal' | 'high-contrast-mono'>('executive-formal');
  const [cssTableFormat, setCssTableFormat] = useState<'bordered' | 'striped' | 'minimal'>('bordered');
  const [cssAccentColor, setCssAccentColor] = useState<string>('#0f172a');
  const [customCssCode, setCustomCssCode] = useState<string>('');
  const [showAdvancedCssPanel, setShowAdvancedCssPanel] = useState<boolean>(false);

  const getAdvancedCssStyles = () => {
    let themeCss = '';
    if (cssTheme === 'classic-academic') {
      themeCss = `
        .document-body-content, .print-page {
          font-family: 'Times New Roman', Georgia, serif !important;
        }
        .document-body-content h1, .document-body-content h2, .document-body-content h3 {
          font-family: 'Space Grotesk', Georgia, serif !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
        }
        .official-header-box {
          border-bottom: 3px double ${cssAccentColor} !important;
        }
        th {
          border-top: 2px solid ${cssAccentColor} !important;
          border-bottom: 2px solid ${cssAccentColor} !important;
          background-color: #f8fafc !important;
          color: ${cssAccentColor} !important;
        }
      `;
    } else if (cssTheme === 'modern-minimal') {
      themeCss = `
        .document-body-content, .print-page {
          font-family: 'Inter', system-ui, sans-serif !important;
        }
        .official-header-box {
          border-bottom: 1px solid #e2e8f0 !important;
        }
        th {
          background-color: transparent !important;
          border-bottom: 2px solid #e2e8f0 !important;
          color: ${cssAccentColor} !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          font-size: 0.85em !important;
        }
        td {
          border-color: #f1f5f9 !important;
        }
      `;
    } else if (cssTheme === 'executive-formal') {
      themeCss = `
        .document-body-content, .print-page {
          font-family: 'Inter', system-ui, sans-serif !important;
        }
        .official-header-box {
          border-bottom: 3px solid ${cssAccentColor} !important;
        }
        th {
          background-color: ${cssAccentColor} !important;
          color: #ffffff !important;
          font-weight: 800 !important;
          letter-spacing: 0.03em !important;
          text-transform: uppercase !important;
        }
        td, th {
          border: 1px solid #cbd5e1 !important;
        }
      `;
    } else if (cssTheme === 'high-contrast-mono') {
      themeCss = `
        * {
          color: #000000 !important;
        }
        .official-header-box, table, th, td, div, section {
          border-color: #000000 !important;
        }
        th {
          background-color: #ffffff !important;
          color: #000000 !important;
          border: 2px solid #000000 !important;
          font-weight: 900 !important;
          text-transform: uppercase !important;
        }
        td {
          border: 1px solid #000000 !important;
        }
      `;
    }

    let tableCss = '';
    if (cssTableFormat === 'bordered') {
      tableCss = `
        table, th, td {
          border: 1px solid ${cssTheme === 'high-contrast-mono' ? '#000000' : '#cbd5e1'} !important;
        }
      `;
    } else if (cssTableFormat === 'striped') {
      tableCss = `
        table, th, td {
          border: 1px solid #e2e8f0 !important;
        }
        tbody tr:nth-child(even) {
          background-color: #f8fafc !important;
        }
      `;
    } else if (cssTableFormat === 'minimal') {
      tableCss = `
        table {
          border: none !important;
        }
        th, td {
          border-left: none !important;
          border-right: none !important;
          border-top: none !important;
          border-bottom: 1px solid #e2e8f0 !important;
        }
      `;
    }

    const customAccentCss = `
      .text-accent-custom { color: ${cssAccentColor} !important; }
      .bg-accent-custom { background-color: ${cssAccentColor} !important; }
      .border-accent-custom { border-color: ${cssAccentColor} !important; }
    `;

    return `
      ${themeCss}
      ${tableCss}
      ${customAccentCss}
      ${customCssCode || ''}
    `;
  };

  const [previewScale, setPreviewScale] = useState<number>(1);
  const isEmisReport = 
    documentTitle?.toLowerCase().includes('emis') || 
    elementId === 'emis-census-print-area';

  const isReportCard = 
    documentTitle?.toLowerCase().includes('report card') || 
    elementId === 'pristine-report-card-preview' ||
    elementId === 'pristine-transcript-preview' ||
    elementId === 'bulk-transcripts-print-page' ||
    elementId === 'report-center-preview-content' || 
    elementId === 'assessment-report-preview-portrait' ||
    isEmisReport ||
    !!(customHtml && (customHtml.includes('report-card-print-container') || customHtml.includes('bulk-report-card-print-page') || customHtml.includes('transcript-print-page') || customHtml.includes('emis-census-print-area')));

  const isTranscript = 
    documentTitle?.toLowerCase().includes('transcript') ||
    elementId === 'pristine-transcript-preview' ||
    elementId === 'bulk-transcripts-print-page';

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<HTMLDivElement>(null);
  const [docRealHeight, setDocRealHeight] = useState<number>(1123);

  // Monitor the paper document's actual height changes (e.g. as dynamic content loads, font scale changes, etc.)
  useEffect(() => {
    if (!documentRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        // Retrieve clientHeight or scrollHeight, fallback to standard dimension based on paperSize
        const h = documentRef.current?.offsetHeight || documentRef.current?.scrollHeight || entry.contentRect.height || 1123;
        if (h > 100) {
          setDocRealHeight(h);
        }
      }
    });
    observer.observe(documentRef.current);
    return () => observer.disconnect();
  }, [previewContent, paperSize, orientation, fontSizeScale, customMargin, printLayout]);

  useEffect(() => {
    if (!previewContainerRef.current || scaleMode === 'manual') return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const isMobileScreen = window.innerWidth < 768;
        const containerWidth = entry.contentRect.width - (isSidebarOpen && !isMobileScreen ? 48 : 24);
        const containerHeight = entry.contentRect.height - 48;
        const targetWidth = paperSize === 'receipt' ? 831 : (orientation === 'landscape' ? 1123 : 794);
        const targetHeight = paperSize === 'receipt' ? 416 : (orientation === 'landscape' ? 794 : 1123);

        if (scaleMode === 'fit-page') {
          const scaleX = (containerWidth - 16) / targetWidth;
          const scaleY = (containerHeight - 16) / targetHeight;
          setPreviewScale(parseFloat(Math.max(0.15, Math.min(scaleX, scaleY, 1.5)).toFixed(2)));
        } else {
          // fit-width: scale preview canvas cleanly end-to-end
          if (containerWidth > 0) {
            const calculatedScale = (containerWidth - 16) / targetWidth;
            setPreviewScale(parseFloat(Math.max(0.15, Math.min(calculatedScale, 1.6)).toFixed(2)));
          }
        }
      }
    });
    resizeObserver.observe(previewContainerRef.current);
    return () => resizeObserver.disconnect();
  }, [paperSize, orientation, isOpen, scaleMode, isSidebarOpen, isFullscreen]);

  // Zoom keyboard shortcuts handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setPreviewScale(prev => {
          setScaleMode('manual');
          return Math.min(2.0, parseFloat((prev + 0.1).toFixed(2)));
        });
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        setPreviewScale(prev => {
          setScaleMode('manual');
          return Math.max(0.25, parseFloat((prev - 0.1).toFixed(2)));
        });
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        setPreviewScale(1.0);
        setScaleMode('manual');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const previewFrameRef = useRef<HTMLDivElement>(null);
  const schoolInfo = DbController.getSchoolInfo();

  // Load and sanitize content
  useEffect(() => {
    if (!isOpen) return;

    const isLandscapeDoc = 
      isLandscapeDefault || 
      elementId === 'teacher-id-card-print-area' ||
      elementId === 'student-id-card-print-area' ||
      elementId === 'bulk-student-id-cards-print-area' ||
      elementId === 'bulk-teacher-qr-print-area' ||
      elementId === 'teachers-roster-preview-card' ||
      elementId === 'teacher-registry-print-area' ||
      elementId === 'assessment-roster-preview-landscape' ||
      elementId === 'student-monthly-roster-printable' ||
      elementId === 'transportation-manifest-print-area' ||
      elementId === 'excursion-manifest-print-area' ||
      elementId === 'textbooks-ledger-print-area' ||
      elementId === 'expenses-register-print-area' ||
      elementId === 'accounting-overview-print-area';

    if (elementId === 'fee-receipt-print-area' || elementId === 'canteen-receipt-print-area' || elementId === 'sports-receipt-print-area') {
      setPaperSize('receipt');
      setOrientation('landscape');
      setMargins('none');
      setCustomMargin(0);
      setIncludeOfficialHeader(false);
      setIncludeSignatureLine(false);
    } else if (elementId === 'expense-pv-slip-print-area') {
      setPaperSize('a4');
      setOrientation('portrait');
      setMargins('none');
      setCustomMargin(8);
      setIncludeOfficialHeader(false);
      setIncludeSignatureLine(false);
    } else if (elementId === 'fee-ledger-print-area' || elementId === 'report-center-preview-content') {
      setPaperSize('a4');
      setOrientation('portrait');
      setMargins('none');
      setCustomMargin(8);
      setIncludeOfficialHeader(false);
      setIncludeSignatureLine(false);
    } else if (elementId === 'bulk-receipts-print-area') {
      setPaperSize('a4');
      setOrientation('portrait');
      setMargins('none');
      setCustomMargin(0);
      setIncludeOfficialHeader(false);
      setIncludeSignatureLine(false);
    } else if (elementId === 'fees-reminder-notice-canvas' || elementId === 'fees-invoice-notice-canvas') {
      setPaperSize('a4');
      setOrientation('portrait');
      setMargins('none');
      setCustomMargin(8);
      setIncludeOfficialHeader(false);
      setIncludeSignatureLine(false);
    } else if (isReportCard || isTranscript) {
      setPaperSize('a4');
      setOrientation(isLandscapeDoc ? 'landscape' : 'portrait');
      setIncludeOfficialHeader(false);
      setIncludeSignatureLine(false); // Report cards & transcripts have their own professional signatures/seals
      setMargins('none');
      setCustomMargin(0); // Set to 0 so the A4 template fits the entire printable A4 area with zero shifts
    } else {
      setPaperSize('a4');
      setOrientation(isLandscapeDoc ? 'landscape' : 'portrait');
      setIncludeOfficialHeader(true);
      setIncludeSignatureLine(true);
      setMargins('normal');
      setCustomMargin(32);
    }

    let content = '';
    if (customHtml) {
      content = customHtml;
      setPreviewContent(content);
      setSourceClassName('');
    } else if (elementId) {
      // Small timeout to ensure DOM is ready if triggered by a tab change
      const timer = setTimeout(() => {
        const el = document.getElementById(elementId);
        if (el) {
          setPreviewContent(el.innerHTML);
          // Strip out classes that hide the element or push it off-screen during preview
          const cleanClassName = el.className.replace(/\b(hidden|invisible|fixed|left-\[-9999px\]|top-\[-9999px\]|opacity-0|pointer-events-none|z-\[-100\])\b/g, '').trim();
          setSourceClassName(cleanClassName);
        } else {
          setPreviewContent(`<div class="p-8 text-center text-rose-600 font-medium">Error: Source element "${elementId}" not found for Print Preview.</div>`);
          setSourceClassName('');
        }
      }, 150);
      return () => clearTimeout(timer);
    } else {
      setPreviewContent('');
      setSourceClassName('');
    }
  }, [isOpen, elementId, customHtml, documentTitle]);

  if (!isOpen) return null;

  // Render official header HTML
  const renderOfficialHeader = () => {
    if (!includeOfficialHeader) return '';
    const logoHtml = schoolInfo.logoUrl 
      ? `<img src="${schoolInfo.logoUrl}" style="height: 65px; max-width: 180px; object-fit: contain; margin-bottom: 10px;" />`
      : GHANA_CREST_HEADER_SVG.replace('margin-right: 15px;', 'margin-bottom: 10px;');

    return `
      <div class="border-b-2 border-slate-900 pb-5 mb-8 flex flex-col items-center text-center font-sans text-slate-900" style="font-family: 'Inter', sans-serif; display: flex; flex-direction: column; align-items: center; text-align: center;">
        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
          ${logoHtml}
          <div>
            <h1 class="text-2xl font-black uppercase tracking-tight text-slate-900 m-0" style="font-weight: 900; letter-spacing: -0.5px; line-height: 1.1; margin: 0;">${schoolInfo.name || 'SCHOOL MANAGEMENT SYSTEM'}</h1>
            <p class="text-xs text-slate-700 m-0 mt-1.5" style="font-weight: 600; margin: 6px 0 0 0;">${schoolInfo.gpsAddress || 'Accra, Ghana'} | Tel: ${schoolInfo.telephone || 'N/A'}</p>
            <p class="text-xs text-slate-600 m-0" style="font-weight: 500; margin: 0;">${schoolInfo.email || ''}</p>
          </div>
        </div>
        <div class="mt-4 flex flex-col items-center" style="margin-top: 16px; display: flex; flex-direction: column; align-items: center;">
          <span class="inline-block bg-slate-900 text-white text-[11px] font-extrabold px-3 py-1 rounded uppercase tracking-widest" style="letter-spacing: 1px; background-color: #0f172a; color: #ffffff; padding: 4px 12px; border-radius: 4px; font-weight: 800;">${documentTitle}</span>
          <p class="text-[10px] text-slate-500 m-0 mt-2 font-medium" style="margin-top: 8px; color: #64748b;">Official Document • Date: ${new Date().toLocaleDateString()}</p>
        </div>
      </div>
    `;
  };

  // Render official footer / signature lines
  const renderOfficialFooter = () => {
    if (!includeSignatureLine) return '';
    return `
      <div class="mt-12 pt-8 border-t border-dashed border-slate-300 flex justify-between text-xs text-slate-800" style="margin-top: 3rem; display: flex; justify-between: space-between; font-family: 'Inter', sans-serif;">
        <div style="flex: 1; text-align: left;">
          <p class="font-semibold text-slate-500 m-0">PREPARED BY:</p>
          <div class="w-40 border-b border-slate-900 mt-8 mb-1"></div>
          <p class="text-[10px] text-slate-600 m-0">Registrar / Academic Office</p>
        </div>
        <div style="flex: 1; text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
          <p class="font-semibold text-slate-500 m-0">APPROVED BY (PRINCIPAL):</p>
          <div class="w-40 border-b border-slate-900 mt-8 mb-1" style="border-bottom: 1px solid #000; width: 160px; margin-top: 32px; margin-bottom: 4px;"></div>
          <p class="text-[10px] text-slate-600 m-0">Signature & Official Stamp</p>
        </div>
      </div>
    `;
  };

  // Compile full document HTML for preview and printing
  const getCompiledHtml = (forIframe = false) => {
    const orientationStyle = paperSize === 'receipt' 
        ? '@page { size: 220mm 110mm; margin: 0; }' 
        : (orientation === 'landscape' ? '@page { size: landscape; margin: 0; }' : '@page { size: portrait; margin: 0; }');
    
    // Watermark styles - Elegant transparent school crest / logo background
    const watermarkHtml = includeWatermark 
      ? `
      ${getWatermarkHtml(schoolInfo?.crestUrl)}
      `
      : '';

    // Font size scaling
    const fontSizeBase = fontSizeScale === 'small' ? '12px' : fontSizeScale === 'large' ? '16px' : '14px';
    const fontSizeTable = fontSizeScale === 'small' ? '10px' : fontSizeScale === 'large' ? '13px' : '11.5px';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${documentTitle}</title>
          <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap');
            
            ${orientationStyle}
            ${getAdvancedCssStyles()}
            
            ${forcePrintBackgrounds ? `
            * {
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            ` : `
            * {
              -webkit-print-color-adjust: economy !important;
              color-adjust: economy !important;
              print-color-adjust: economy !important;
            }
            `}
            
            body {
              font-family: 'Inter', -apple-system, sans-serif;
              background-color: #ffffff !important;
              color: #0f172a !important;
              margin: 0 !important;
              padding: 0 !important;
              font-size: ${fontSizeBase};
            }

            .print-page {
              position: relative;
              background-color: #ffffff;
              box-sizing: border-box;
              min-height: 100vh;
              overflow: visible;
              padding: ${isReportCard ? '0' : `${customMargin}px`} !important;
            }

            .page-number-footer {
              display: none;
            }

            @media print {
              .page-number-footer {
                display: ${includePageNumbers ? 'block' : 'none'};
                position: fixed;
                bottom: 8mm;
                right: 12mm;
                font-size: 9px;
                font-family: 'JetBrains Mono', monospace;
                color: #94a3b8;
                z-index: 999;
              }
              .page-number-footer:after {
                content: "Page " counter(page);
              }
            }

            /* Hide elements based on toggles */
            ${hideStudentPhotos ? '.student-report-photo, .student-report-photo-placeholder, img[src*="photo"], .student-photo { display: none !important; }' : ''}
            ${!includeBlankGrades ? '.assessment-grade-empty { display: none !important; }' : ''}

            /* Strip out any typical navigation / action elements if copied over */
            .no-print, button, .btn, .nav, .sidebar, .actions-row, [data-html2canvas-ignore] {
              display: none !important;
            }

            /* Better table styling for prints */
            table {
              width: 100% !important;
              border-collapse: collapse !important;
              page-break-inside: auto !important;
              font-size: ${fontSizeTable};
            }
            tr {
              page-break-inside: avoid !important;
              page-break-after: auto !important;
            }
            thead {
              display: table-header-group !important;
            }
            tfoot {
              display: table-footer-group !important;
            }
            
            /* High contrast headers */
            th {
              background-color: #f1f5f9 !important;
              color: #0f172a !important;
              border-bottom: 2px solid #cbd5e1 !important;
              font-weight: 700 !important;
            }
            td, th {
              padding: 8px 12px !important;
              border: 1px solid #e2e8f0 !important;
            }

            /* Ensure SVGs and QR codes render with proper size and color */
            svg {
              max-width: 100%;
              height: auto;
              display: inline-block;
            }
            
            #student-qr-print-area svg, #bulk-qr-print-area svg, #bulk-teacher-qr-print-area svg {
              width: 180px !important;
              height: 180px !important;
            }

            .id-cards-landscape-page {
              display: grid !important;
              grid-template-columns: repeat(4, 1fr) !important;
              grid-template-rows: repeat(2, 1fr) !important;
              gap: 4mm !important;
              width: 297mm !important;
              height: 210mm !important;
              padding: 8mm !important;
              box-sizing: border-box !important;
              background: #ffffff !important;
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              overflow: hidden !important;
              position: relative !important;
            }
            .id-card-print-item,
            .bulk-id-card-item {
              box-sizing: border-box !important;
              border: 1px solid #1e293b !important;
              border-radius: 8px !important;
              background: #ffffff !important;
              overflow: hidden !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              page-break-inside: avoid !important;
              width: 100% !important;
              height: 100% !important;
              max-height: 92mm !important;
            }

            @media print {
              html, body {
                width: 100%;
                height: auto;
                background-color: #ffffff !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              .print-page {
                border: none !important;
                box-shadow: none !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                height: auto !important;
              }
              .watermark-overlay {
                position: fixed !important;
                inset: 0 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                z-index: -1 !important;
                opacity: 0.06 !important;
                pointer-events: none !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="print-page">
            ${includePageNumbers ? '<div class="page-number-footer"></div>' : ''}
            ${watermarkHtml}
            ${renderOfficialHeader()}
            <div id="${elementId || ''}" class="document-body-content relative z-10 ${sourceClassName}" style="width: 100% !important; max-width: none !important;">
              ${previewContent}
            </div>
            ${renderOfficialFooter()}
          </div>
        </body>
      </html>
    `;
  };

  const handlePrint = () => {
    setIsLoading(true);
    try {
      // Clean up any existing print section
      const existingSection = document.getElementById('sms-print-section');
      if (existingSection) {
        existingSection.remove();
      }

      // Create a temporary print section container
      const printSection = document.createElement('div');
      printSection.id = 'sms-print-section';
      printSection.className = printLayout === 'compact' ? 'print-layout-compact' : 'print-layout-full';
      
      const marginInMm = isReportCard ? 0 : Number((customMargin / 3.2).toFixed(1));

      // We will copy the compiled HTML into it
      printSection.innerHTML = `
        <style>
          .page-number-footer {
            display: none;
          }
          @media print {
            .page-number-footer {
              display: ${includePageNumbers ? 'block' : 'none'};
              position: fixed;
              bottom: 8mm;
              right: 12mm;
              font-size: 9px;
              font-family: 'JetBrains Mono', monospace;
              color: #94a3b8;
              z-index: 999;
            }
            .page-number-footer:after {
              content: "Page " counter(page);
            }
          }
        </style>
        <div class="print-page bg-white text-slate-900" style="padding: ${marginInMm}mm !important; min-height: 100vh; position: relative; font-family: 'Inter', sans-serif;">
          ${includePageNumbers ? '<div class="page-number-footer"></div>' : ''}
          ${includeWatermark ? getWatermarkHtml(schoolInfo?.crestUrl) : ''}
          ${renderOfficialHeader()}
          <div id="${elementId || ''}" class="document-body-content relative z-10 font-sans ${sourceClassName}" style="font-size: ${fontSizeScale === 'small' ? '12px' : fontSizeScale === 'large' ? '16px' : '14px'}; width: 100% !important; max-width: none !important;">
            ${previewContent}
          </div>
          ${renderOfficialFooter()}
        </div>
      `;

      // Append to body
      document.body.appendChild(printSection);

      // Create and inject print style sheet to hide everything else during print
      const styleId = 'sms-print-style-override';
      let styleEl = document.getElementById(styleId) as HTMLStyleElement;
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      
      const orientationStyle = paperSize === 'receipt' 
          ? '@page { size: 220mm 110mm; margin: 0; }' 
          : (orientation === 'landscape' ? '@page { size: landscape; margin: 0; }' : '@page { size: portrait; margin: 0; }');

      styleEl.innerHTML = `
        @media print {
          ${forcePrintBackgrounds ? `
          * {
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          ` : `
          * {
            -webkit-print-color-adjust: economy !important;
            color-adjust: economy !important;
            print-color-adjust: economy !important;
          }
          `}

          ${hideStudentPhotos ? '.student-report-photo, .student-report-photo-placeholder, img[src*="photo"], .student-photo { display: none !important; }' : ''}
          ${!includeBlankGrades ? '.assessment-grade-empty { display: none !important; }' : ''}
          ${getAdvancedCssStyles()}

          /* Hide all elements on the body except our print section */
          body > :not(#sms-print-section) {
            display: none !important;
          }
          #sms-print-section, #sms-print-section * {
            visibility: visible !important;
          }
          #sms-print-section {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background-color: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #sms-print-section, #sms-print-section p, #sms-print-section div {
            font-size: ${fontSizeScale === 'small' ? '12px' : fontSizeScale === 'large' ? '16px' : '14px'} !important;
          }
          #sms-print-section table, #sms-print-section th, #sms-print-section td {
            font-size: ${fontSizeScale === 'small' ? '10px' : fontSizeScale === 'large' ? '13px' : '11.5px'} !important;
          }
          #sms-print-section .no-print,
          #sms-print-section button,
          #sms-print-section .btn,
          #sms-print-section [data-html2canvas-ignore] {
            display: none !important;
          }
          html, body {
            background-color: #ffffff !important;
            color: #000000 !important;
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-page {
            padding: ${isReportCard ? 0 : `${marginInMm}mm`} !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            width: 100% !important;
            height: auto !important;
          }
          ${orientationStyle}
          ${getAdvancedCssStyles()}
          
          .id-cards-landscape-page {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            grid-template-rows: repeat(2, 1fr) !important;
            gap: 4mm !important;
            width: 297mm !important;
            height: 210mm !important;
            padding: 8mm !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            overflow: hidden !important;
            position: relative !important;
          }
          .id-card-print-item,
          .bulk-id-card-item {
            box-sizing: border-box !important;
            border: 1px solid #1e293b !important;
            border-radius: 8px !important;
            background: #ffffff !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            page-break-inside: avoid !important;
            width: 100% !important;
            height: 100% !important;
            max-height: 92mm !important;
          }

          /* Bulk Receipts: 3 receipts per A4 Portrait Sheet */
          .bulk-receipts-print-page {
            width: 210mm !important;
            min-height: 297mm !important;
            height: auto !important;
            max-height: none !important;
            box-sizing: border-box !important;
            position: relative !important;
            margin: 0 auto !important;
            padding: 6mm 8mm !important;
            overflow: visible !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            background: #ffffff !important;
            page-break-inside: avoid !important;
            page-break-after: always !important;
            break-after: page !important;
          }

          .bulk-receipts-print-page:first-of-type {
            page-break-before: avoid !important;
          }

          .bulk-receipt-slip {
            box-sizing: border-box !important;
            height: 88mm !important;
            max-height: 90mm !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            background: #ffffff !important;
            overflow: hidden !important;
          }

          .perforated-cut-line {
            margin: 2mm 0 !important;
            user-select: none !important;
          }

          /* Single Receipt: DL Envelope Format (220mm x 110mm) */
          #fee-receipt-print-area {
            width: 220mm !important;
            max-width: 220mm !important;
            min-height: 110mm !important;
            box-sizing: border-box !important;
            margin: 0 auto !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            background: #ffffff !important;
          }

          /* Better table styling for prints */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto !important;
          }
          tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }
          thead {
            display: table-header-group !important;
          }
          tfoot {
            display: table-footer-group !important;
          }
          td, th {
            padding: 8px 12px !important;
            border: 1px solid #cbd5e1 !important;
          }

          /* Enforce exact A4 Portrait layout and fit for Student Report Cards */
          .report-card-print-container,
          .bulk-report-card-print-page {
            width: 210mm !important;
            min-height: 297mm !important;
            height: auto !important;
            max-height: none !important;
            box-sizing: border-box !important;
            position: relative !important;
            margin: 0 !important;
            padding: 6mm 10mm 6mm 10mm !important;
            overflow: visible !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            background: #ffffff !important;
            page-break-inside: avoid !important;
            page-break-after: always !important;
            break-after: page !important;
          }

          .report-card-print-container,
          .report-card-print-container *,
          .bulk-report-card-print-page,
          .bulk-report-card-print-page * {
            font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif !important;
          }

          .report-card-print-container:first-of-type,
          .bulk-report-card-print-page:first-of-type {
            page-break-before: avoid !important;
          }

          /* Compact styling for print elements */
          .report-card-print-container .border-[8px],
          .report-card-print-container .border-[10px],
          .bulk-report-card-print-page .border-[8px] {
            border-width: 4px !important;
          }

          .report-card-print-container h2,
          .bulk-report-card-print-page h2 {
            font-family: 'Space Grotesk', 'Inter', sans-serif !important;
            font-size: 12pt !important;
            margin-bottom: 1px !important;
            line-height: 1.1 !important;
          }

          .report-card-print-container p,
          .bulk-report-card-print-page p {
            font-size: 7.5pt !important;
            margin-top: 0.5px !important;
            margin-bottom: 0.5px !important;
          }

          .report-card-print-container .border-b-2,
          .bulk-report-card-print-page .border-b-2 {
            padding-bottom: 1.5mm !important;
            margin-bottom: 2mm !important;
          }

          .report-card-print-container img[alt="School Logo"],
          .bulk-report-card-print-page img[alt="School Logo"],
          .report-card-print-container img[alt="Logo"],
          .bulk-report-card-print-page img[alt="Logo"] {
            max-height: 12mm !important;
            width: auto !important;
          }

          .report-card-print-container img.student-report-photo,
          .bulk-report-card-print-page img.student-report-photo,
          .report-card-print-container .student-report-photo-placeholder,
          .bulk-report-card-print-page .student-report-photo-placeholder {
            width: 12mm !important;
            height: 12mm !important;
          }

          .report-card-print-container .grid,
          .bulk-report-card-print-page .grid {
            gap: 1.5mm !important;
            margin-top: 1.5mm !important;
            margin-bottom: 1.5mm !important;
          }

          .report-card-print-container .bg-slate-50.p-5,
          .bulk-report-card-print-page .bg-slate-50.p-5,
          .report-card-print-container .bg-slate-50.p-4,
          .bulk-report-card-print-page .bg-slate-50.p-4,
          .report-card-print-container .grid-cols-2.gap-3,
          .bulk-report-card-print-page .grid-cols-2.gap-3 {
            padding: 2mm !important;
            gap: 1.5mm !important;
            margin-bottom: 2mm !important;
          }

          .report-card-print-container table,
          .bulk-report-card-print-page table {
            margin-top: 1.5mm !important;
            margin-bottom: 1.5mm !important;
            font-size: 7.5pt !important;
          }

          .report-card-print-container th,
          .report-card-print-container td,
          .bulk-report-card-print-page th,
          .bulk-report-card-print-page td {
            padding: 0.5mm 1.5mm !important;
            font-size: 7.5pt !important;
            line-height: 1.05 !important;
          }

          .report-card-print-container .grid-cols-2.md\:grid-cols-4,
          .bulk-report-card-print-page .grid-cols-2.md\:grid-cols-4,
          .report-card-print-container .grid-cols-4,
          .bulk-report-card-print-page .grid-cols-4 {
            margin-top: 1.5mm !important;
            margin-bottom: 1.5mm !important;
            gap: 1.5mm !important;
          }

          .report-card-print-container .bg-slate-50\/50.p-3,
          .bulk-report-card-print-page .bg-slate-50\/50.p-3,
          .report-card-print-container .bg-slate-50.p-3,
          .bulk-report-card-print-page .bg-slate-50.p-3 {
            padding: 1mm !important;
            margin-top: 1.5mm !important;
          }

          .report-card-print-container p.italic,
          .bulk-report-card-print-page p.italic {
            font-size: 7.5pt !important;
            min-height: 10mm !important;
            padding: 1.5mm !important;
            margin-top: 0.5mm !important;
          }

          /* Prevent page-breaks splitting report card sub-sections (remarks & signatures, financial ledger, tables, rows, student info blocks) */
          .report-card-remarks-signatures,
          .report-card-financial-ledger,
          .report-card-student-info,
          .report-card-aggregates,
          .report-card-print-container table,
          .bulk-report-card-print-page table,
          .report-card-print-container tr,
          .bulk-report-card-print-page tr,
          .report-card-print-container .grid-cols-2,
          .bulk-report-card-print-page .grid-cols-2 {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .report-card-print-container .relative.w-full.h-8,
          .bulk-report-card-print-page .relative.w-full.h-8,
          .report-card-print-container .relative.w-52.h-16,
          .bulk-report-card-print-page .relative.w-52.h-16 {
            height: 8mm !important;
          }

          .report-card-print-container img[alt="School Stamp"],
          .bulk-report-card-print-page img[alt="School Stamp"],
          .report-card-print-container img[alt="Stamp"],
          .bulk-report-card-print-page img[alt="Stamp"] {
            max-height: 8mm !important;
            width: auto !important;
          }

          .report-card-print-container img[alt="Headteacher Signature"],
          .bulk-report-card-print-page img[alt="Headteacher Signature"],
          .report-card-print-container img[alt="Signature"],
          .bulk-report-card-print-page img[alt="Signature"] {
            max-height: 5mm !important;
            width: auto !important;
          }

          .report-card-print-container .shadow-2xl,
          .bulk-report-card-print-page .shadow-2xl {
            box-shadow: none !important;
          }

          /* Dynamic CSS-Based Autofit Scaling based on subject counts */
          
          /* Moderate (9-12 subjects) */
          .subject-count-moderate {
            padding: 5mm 8mm 5mm 8mm !important;
          }
          .subject-count-moderate h2 {
            font-size: 11pt !important;
          }
          .subject-count-moderate p {
            font-size: 7pt !important;
          }
          .subject-count-moderate .border-b-2 {
            padding-bottom: 1.2mm !important;
            margin-bottom: 1.5mm !important;
          }
          .subject-count-moderate table {
            margin-top: 1.2mm !important;
            margin-bottom: 1.2mm !important;
            font-size: 7.2pt !important;
          }
          .subject-count-moderate th,
          .subject-count-moderate td {
            padding: 0.4mm 1.2mm !important;
            font-size: 7.2pt !important;
          }
          .subject-count-moderate .grid {
            gap: 1.2mm !important;
            margin-top: 1.2mm !important;
            margin-bottom: 1.2mm !important;
          }
          .subject-count-moderate .bg-slate-50.p-5,
          .subject-count-moderate .bg-slate-50.p-4 {
            padding: 1.5mm !important;
            margin-bottom: 1.5mm !important;
          }
          .subject-count-moderate p.italic {
            font-size: 7.2pt !important;
            min-height: 8mm !important;
            padding: 1.2mm !important;
          }
          .subject-count-moderate .relative.w-full.h-8,
          .subject-count-moderate .relative.w-52.h-16 {
            height: 6mm !important;
          }

          /* High (13-16 subjects) */
          .subject-count-high {
            padding: 4mm 7mm 4mm 7mm !important;
          }
          .subject-count-high h2 {
            font-size: 10pt !important;
          }
          .subject-count-high p {
            font-size: 6.8pt !important;
          }
          .subject-count-high .border-b-2 {
            padding-bottom: 1mm !important;
            margin-bottom: 1.2mm !important;
          }
          .subject-count-high img[alt="School Logo"],
          .subject-count-high img[alt="Logo"] {
            max-height: 10mm !important;
          }
          .subject-count-high img.student-report-photo,
          .subject-count-high .student-report-photo-placeholder {
            width: 10mm !important;
            height: 10mm !important;
          }
          .subject-count-high table {
            margin-top: 1mm !important;
            margin-bottom: 1mm !important;
            font-size: 6.8pt !important;
          }
          .subject-count-high th,
          .subject-count-high td {
            padding: 0.3mm 1mm !important;
            font-size: 6.8pt !important;
          }
          .subject-count-high .grid {
            gap: 1mm !important;
            margin-top: 1mm !important;
            margin-bottom: 1mm !important;
          }
          .subject-count-high .bg-slate-50.p-5,
          .subject-count-high .bg-slate-50.p-4 {
            padding: 1.2mm !important;
            margin-bottom: 1.2mm !important;
          }
          .subject-count-high p.italic {
            font-size: 6.8pt !important;
            min-height: 6mm !important;
            padding: 1mm !important;
          }
          .subject-count-high .relative.w-full.h-8,
          .subject-count-high .relative.w-52.h-16 {
            height: 5mm !important;
          }
          .subject-count-high img[alt="School Stamp"],
          .subject-count-high img[alt="Stamp"] {
            max-height: 6mm !important;
          }
          .subject-count-high img[alt="Headteacher Signature"],
          .subject-count-high img[alt="Signature"] {
            max-height: 4mm !important;
          }

          /* Extra High (17-20 subjects) */
          .subject-count-extra-high {
            padding: 3mm 6mm 3mm 6mm !important;
          }
          .subject-count-extra-high h2 {
            font-size: 9pt !important;
          }
          .subject-count-extra-high p {
            font-size: 6.5pt !important;
          }
          .subject-count-extra-high .border-b-2 {
            padding-bottom: 0.8mm !important;
            margin-bottom: 1mm !important;
          }
          .subject-count-extra-high img[alt="School Logo"],
          .subject-count-extra-high img[alt="Logo"] {
            max-height: 8mm !important;
          }
          .subject-count-extra-high img.student-report-photo,
          .subject-count-extra-high .student-report-photo-placeholder {
            width: 8mm !important;
            height: 8mm !important;
          }
          .subject-count-extra-high table {
            margin-top: 0.8mm !important;
            margin-bottom: 0.8mm !important;
            font-size: 6.2pt !important;
          }
          .subject-count-extra-high th,
          .subject-count-extra-high td {
            padding: 0.2mm 0.8mm !important;
            font-size: 6.2pt !important;
          }
          .subject-count-extra-high .grid {
            gap: 0.8mm !important;
            margin-top: 0.8mm !important;
            margin-bottom: 0.8mm !important;
          }
          .subject-count-extra-high .bg-slate-50.p-5,
          .subject-count-extra-high .bg-slate-50.p-4 {
            padding: 1mm !important;
            margin-bottom: 1mm !important;
          }
          .subject-count-extra-high p.italic {
            font-size: 6.2pt !important;
            min-height: 5mm !important;
            padding: 0.8mm !important;
          }
          .subject-count-extra-high .relative.w-full.h-8,
          .subject-count-extra-high .relative.w-52.h-16 {
            height: 4mm !important;
          }
          .subject-count-extra-high img[alt="School Stamp"],
          .subject-count-extra-high img[alt="Stamp"] {
            max-height: 5mm !important;
          }
          .subject-count-extra-high img[alt="Headteacher Signature"],
          .subject-count-extra-high img[alt="Signature"] {
            max-height: 3mm !important;
          }

          /* Extreme (21-24 subjects) */
          .subject-count-extreme {
            padding: 2.2mm 5mm 2.2mm 5mm !important;
          }
          .subject-count-extreme h2 {
            font-size: 8pt !important;
          }
          .subject-count-extreme p {
            font-size: 6pt !important;
          }
          .subject-count-extreme .border-b-2 {
            padding-bottom: 0.6mm !important;
            margin-bottom: 0.8mm !important;
          }
          .subject-count-extreme img[alt="School Logo"],
          .subject-count-extreme img[alt="Logo"] {
            max-height: 7mm !important;
          }
          .subject-count-extreme img.student-report-photo,
          .subject-count-extreme .student-report-photo-placeholder {
            width: 7mm !important;
            height: 7mm !important;
          }
          .subject-count-extreme table {
            margin-top: 0.6mm !important;
            margin-bottom: 0.6mm !important;
            font-size: 5.6pt !important;
          }
          .subject-count-extreme th,
          .subject-count-extreme td {
            padding: 0.15mm 0.6mm !important;
            font-size: 5.6pt !important;
          }
          .subject-count-extreme .grid {
            gap: 0.6mm !important;
            margin-top: 0.6mm !important;
            margin-bottom: 0.6mm !important;
          }
          .subject-count-extreme .bg-slate-50.p-5,
          .subject-count-extreme .bg-slate-50.p-4 {
            padding: 0.8mm !important;
            margin-bottom: 0.8mm !important;
          }
          .subject-count-extreme p.italic {
            font-size: 5.6pt !important;
            min-height: 4mm !important;
            padding: 0.6mm !important;
          }
          .subject-count-extreme .relative.w-full.h-8,
          .subject-count-extreme .relative.w-52.h-16 {
            height: 3.5mm !important;
          }
          .subject-count-extreme img[alt="School Stamp"],
          .subject-count-extreme img[alt="Stamp"] {
            max-height: 4mm !important;
          }
          .subject-count-extreme img[alt="Headteacher Signature"],
          .subject-count-extreme img[alt="Signature"] {
            max-height: 2.5mm !important;
          }

          /* Critical (> 24 subjects) */
          .subject-count-critical {
            padding: 1.5mm 4mm 1.5mm 4mm !important;
          }
          .subject-count-critical h2 {
            font-size: 7.5pt !important;
          }
          .subject-count-critical p {
            font-size: 5.5pt !important;
          }
          .subject-count-critical .border-b-2 {
            padding-bottom: 0.4mm !important;
            margin-bottom: 0.6mm !important;
          }
          .subject-count-critical img[alt="School Logo"],
          .subject-count-critical img[alt="Logo"] {
            max-height: 6mm !important;
          }
          .subject-count-critical img.student-report-photo,
          .subject-count-critical .student-report-photo-placeholder {
            width: 6mm !important;
            height: 6mm !important;
          }
          .subject-count-critical table {
            margin-top: 0.4mm !important;
            margin-bottom: 0.4mm !important;
            font-size: 5pt !important;
          }
          .subject-count-critical th,
          .subject-count-critical td {
            padding: 0.1mm 0.4mm !important;
            font-size: 5pt !important;
          }
          .subject-count-critical .grid {
            gap: 0.4mm !important;
            margin-top: 0.4mm !important;
            margin-bottom: 0.4mm !important;
          }
          .subject-count-critical .bg-slate-50.p-5,
          .subject-count-critical .bg-slate-50.p-4 {
            padding: 0.5mm !important;
            margin-bottom: 0.5mm !important;
          }
          .subject-count-critical p.italic {
            font-size: 5pt !important;
            min-height: 3mm !important;
            padding: 0.4mm !important;
          }
          .subject-count-critical .relative.w-full.h-8,
          .subject-count-critical .relative.w-52.h-16 {
            height: 3mm !important;
          }
          .subject-count-critical img[alt="School Stamp"],
          .subject-count-critical img[alt="Stamp"] {
            max-height: 3mm !important;
          }
          .subject-count-critical img[alt="Headteacher Signature"],
          .subject-count-critical img[alt="Signature"] {
            max-height: 2mm !important;
          }
        }
      `;

      // Add active print class to body
      document.body.classList.add('sms-printing-active');

      // Trigger print after a short render layout tick
      setTimeout(() => {
        try {
          window.focus();
          window.print();
        } catch (e) {
          console.error("Window print exception:", e);
        } finally {
          // Clean up
          document.body.classList.remove('sms-printing-active');
          printSection.remove();
          styleEl.remove();
          setIsLoading(false);
        }
      }, 250);

    } catch (err) {
      console.warn("Direct print system failed:", err);
      setIsLoading(false);
    }
  };

  const handlePdfDownload = async () => {
    setIsLoading(true);
    try {
      const targetWidth = paperSize === 'receipt' ? '831px' : (orientation === 'landscape' ? '1123px' : '794px');
      const targetMinHeight = paperSize === 'receipt' ? '416px' : (orientation === 'landscape' ? '794px' : '1123px');
      const fontSizeValue = fontSizeScale === 'small' ? '10px' : fontSizeScale === 'large' ? '13px' : '11px';

      // Create a temporary element in the body to render the compiled content for html2canvas
      const tempDiv = document.createElement('div');
      tempDiv.id = 'temp-pdf-render-area';
      tempDiv.style.position = 'fixed';
      tempDiv.style.left = '0px';
      tempDiv.style.top = '0px';
      tempDiv.style.zIndex = '-999999';
      tempDiv.style.opacity = '1';
      tempDiv.style.visibility = 'visible';
      tempDiv.style.pointerEvents = 'none';
      tempDiv.style.backgroundColor = '#ffffff';
      tempDiv.style.width = targetWidth;

      // Build watermark HTML if active
      const watermarkHtml = includeWatermark 
        ? `<div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; user-select: none; z-index: 0; opacity: 0.08;">${getWatermarkHtml(schoolInfo?.crestUrl)}</div>`
        : '';

      tempDiv.innerHTML = `
        <style>
          .id-cards-landscape-page {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            grid-template-rows: repeat(2, 1fr) !important;
            gap: 4mm !important;
            width: 297mm !important;
            height: 210mm !important;
            padding: 8mm !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            position: relative !important;
          }
          .id-card-print-item,
          .bulk-id-card-item {
            box-sizing: border-box !important;
            border: 1px solid #1e293b !important;
            border-radius: 8px !important;
            background: #ffffff !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            width: 100% !important;
            height: 100% !important;
            max-height: 92mm !important;
          }
          
          /* Custom overrides for the print layouts */
          ${hideStudentPhotos ? '.student-report-photo, .student-report-photo-placeholder, img[src*="photo"], .student-photo { display: none !important; }' : ''}
          ${!includeBlankGrades ? '.assessment-grade-empty { display: none !important; }' : ''}
          ${getAdvancedCssStyles()}
        </style>
        <div class="bg-white text-slate-900 relative ${printLayout === 'compact' ? 'print-layout-compact' : 'print-layout-full'}" 
             style="width: 100%; min-height: ${targetMinHeight}; font-family: 'Inter', -apple-system, sans-serif; font-size: ${fontSizeValue}; line-height: 1.5; padding: ${isReportCard ? '0' : `${customMargin}px`} !important; box-sizing: border-box; position: relative;">
          ${watermarkHtml}
          ${includePageNumbers ? '<div style="position: absolute; bottom: 10px; right: 10px; font-size: 8px; color: #94a3b8; font-family: monospace; z-index: 10;">Page 1 of 1</div>' : ''}
          <div style="position: relative; z-index: 10;">
            ${renderOfficialHeader()}
            <div id="${elementId || ''}" class="document-live-preview-box ${sourceClassName}" style="width: 100%; max-width: none; min-width: 100%;">${previewContent}</div>
            ${renderOfficialFooter()}
          </div>
        </div>
      `;
      document.body.appendChild(tempDiv);

      const result = await generatePdfFromHtml(
        'temp-pdf-render-area',
        `${documentTitle.replace(/\s+/g, '_')}_Layout`,
        orientation === 'landscape'
      );
      
      downloadBlobLocally(result.blob, result.filename);
      document.body.removeChild(tempDiv);
    } catch (err) {
      console.error("PDF generator failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      setPreviewScale(prev => {
        const next = Math.max(0.25, Math.min(2.0, prev + delta));
        setScaleMode('manual');
        return parseFloat(next.toFixed(2));
      });
    }
  };

  return (
    <div className={`fixed inset-0 z-[99999] overflow-hidden flex items-center justify-center ${isFullscreen ? 'p-0' : 'p-2 sm:p-4'}`}>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-md transition-opacity"
      />

      <motion.div 
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className={`relative bg-slate-950 border border-slate-800 shadow-2xl flex flex-col z-10 transition-all duration-200 overflow-hidden ${
          isFullscreen 
            ? 'w-full h-full rounded-none border-none' 
            : 'w-full max-w-[1650px] h-[95vh] rounded-2xl'
        }`}
      >
        {/* Header Ribbon */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 backdrop-blur-md rounded-t-2xl no-print select-none">
          {/* Left Title & Sidebar Toggle */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20 shrink-0">
              <Printer size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">Print Preview</h2>
                <span className="hidden sm:inline-block px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-[9px] font-mono font-bold">
                  {paperSize.toUpperCase()} • {orientation}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden md:block">
                Document layout & alignment preview
              </p>
            </div>

            <div className="hidden md:block h-6 w-px bg-slate-800 ml-1" />

            {/* Sidebar Toggle Button */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                isSidebarOpen
                  ? 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                  : 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border-indigo-500/40 shadow-xs'
              }`}
              title={isSidebarOpen ? 'Hide settings sidebar to maximize document preview space' : 'Show settings sidebar'}
            >
              {isSidebarOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
              <span>{isSidebarOpen ? 'Hide Options' : 'Show Options'}</span>
            </button>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2">
            {isTranscript && studentId && (
              <button 
                onClick={() => setShowAuditLog(!showAuditLog)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border shadow-xs transition cursor-pointer text-xs font-bold font-sans select-none shrink-0 ${
                  showAuditLog 
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' 
                    : 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 border-indigo-500/20 hover:border-indigo-500/35'
                }`}
              >
                <FileText size={13} className="stroke-[2.5]" />
                <span className="hidden sm:inline">{showAuditLog ? 'Preview Document' : 'Audit Log'}</span>
              </button>
            )}

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl border border-slate-700/80 transition cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Preview'}
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>

            <button 
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-xl border border-rose-500/20 hover:border-rose-500/35 shadow-xs transition cursor-pointer text-xs font-bold font-sans select-none shrink-0"
            >
              <X size={13} className="stroke-[2.5]" />
              <span>Close</span>
            </button>
          </div>
        </div>

        {/* Mobile Tabs */}
        <div className="flex md:hidden bg-slate-950/90 border-b border-slate-800 p-1.5 gap-1.5 z-20 no-print">
          <button
            type="button"
            onClick={() => setMobileActiveTab('preview')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg border text-center transition cursor-pointer ${
              mobileActiveTab === 'preview'
                ? 'bg-indigo-600/20 border-indigo-500/55 text-indigo-300 shadow-inner'
                : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:text-slate-300'
            }`}
          >
            Live Preview
          </button>
          <button
            type="button"
            onClick={() => setMobileActiveTab('settings')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg border text-center transition cursor-pointer ${
              mobileActiveTab === 'settings'
                ? 'bg-indigo-600/20 border-indigo-500/55 text-indigo-300 shadow-inner'
                : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:text-slate-300'
            }`}
          >
            Page Options
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 relative">
          
          {/* Settings Sidebar */}
          {(isSidebarOpen || mobileActiveTab === 'settings') && (
            <div className={`w-full md:w-80 bg-slate-950/60 border-b md:border-b-0 md:border-r border-slate-800 p-5 space-y-5 overflow-y-auto custom-scrollbar-visible shrink-0 md:shrink-0 flex-1 md:flex-initial h-full md:h-auto no-print transition-all duration-200 ${
              isSidebarOpen 
                ? (mobileActiveTab === 'settings' ? 'block' : 'hidden md:block')
                : (mobileActiveTab === 'settings' ? 'block md:hidden' : 'hidden')
            }`}>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500/30 to-purple-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shadow-inner">
                    <Sliders size={14} />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-100 uppercase tracking-wide block">Print &amp; Theme Studio</span>
                    <span className="text-[9.5px] text-slate-400 font-sans">Executive document styling</span>
                  </div>
                </div>
                <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30 shadow-xs">
                  Pro Theme
                </span>
              </div>
            {/* Accordion 1: Page & Paper Layout */}
            <div className="border border-slate-800/80 bg-slate-900/25 rounded-xl overflow-hidden transition-all duration-200">
              <button
                type="button"
                onClick={() => setLayoutExpanded(!layoutExpanded)}
                className="w-full flex items-center justify-between p-3 bg-slate-950/45 text-left font-bold text-slate-200 text-[11px] uppercase tracking-wider transition hover:bg-slate-950/65"
              >
                <span className="flex items-center gap-1.5">
                  <Layout size={13} className="text-indigo-400" /> Page & Paper Layout
                </span>
                <ChevronDown size={14} className={`text-slate-400 transform transition-transform duration-200 ${layoutExpanded ? 'rotate-180' : ''}`} />
              </button>
              
              {layoutExpanded && (
                <div className="p-4 space-y-4 border-t border-slate-800/50 bg-slate-950/10">
                  {/* Orientation */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Page Orientation</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        type="button"
                        onClick={() => setOrientation('portrait')}
                        className={`py-2 px-3 flex flex-col items-center gap-1.5 text-[10px] font-bold rounded-xl border transition ${
                          orientation === 'portrait' 
                            ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 shadow-inner' 
                            : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        <div className={`w-4 h-5 border-2 rounded-sm ${orientation === 'portrait' ? 'border-indigo-400/60 bg-indigo-400/20' : 'border-slate-700 bg-slate-800'}`} />
                        Portrait
                      </button>
                      <button 
                        type="button"
                        onClick={() => setOrientation('landscape')}
                        className={`py-2 px-3 flex flex-col items-center gap-1.5 text-[10px] font-bold rounded-xl border transition ${
                          orientation === 'landscape' 
                            ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 shadow-inner' 
                            : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        <div className={`w-6 h-4 border-2 rounded-sm ${orientation === 'landscape' ? 'border-indigo-400/60 bg-indigo-400/20' : 'border-slate-700 bg-slate-800'}`} />
                        Landscape
                      </button>
                    </div>
                  </div>

                  {/* Print Layout Density (Compact vs Standard) */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-400">Print Layout Density</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        type="button"
                        onClick={() => {
                          setPrintLayout('compact');
                          setMargins('narrow');
                          setCustomMargin(24);
                          setFontSizeScale('small');
                        }}
                        className={`py-1.5 text-xs font-semibold rounded-lg border transition ${
                          printLayout === 'compact' 
                            ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' 
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        Compact
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          setPrintLayout('full');
                          setMargins('normal');
                          setCustomMargin(48);
                          setFontSizeScale('normal');
                        }}
                        className={`py-1.5 text-xs font-semibold rounded-lg border transition ${
                          printLayout === 'full' 
                            ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' 
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        Standard
                      </button>
                    </div>
                  </div>

                  {/* Paper Size */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-400">Paper Size</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['a4', 'letter', 'receipt'] as const).map(size => (
                        <button 
                          key={size}
                          type="button"
                          onClick={() => setPaperSize(size)}
                          className={`py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition ${
                            paperSize === size 
                              ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' 
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-300'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Margins */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-400">Page Margins Preset</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['normal', 'narrow', 'none'] as const).map(margin => (
                        <button 
                          key={margin}
                          type="button"
                          onClick={() => {
                            setMargins(margin);
                            setCustomMargin(margin === 'none' ? 0 : margin === 'narrow' ? 24 : 48);
                          }}
                          className={`py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition ${
                            margins === margin 
                              ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' 
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-300'
                          }`}
                        >
                          {margin}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Margin Slider */}
                  <div className="space-y-1.5 p-2.5 bg-slate-900/40 rounded-xl border border-slate-800/80">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-semibold text-slate-300">Custom Margin (Padding)</span>
                      <span className="font-mono font-bold text-emerald-400">{customMargin}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="120"
                      step="2"
                      value={customMargin}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setCustomMargin(val);
                        // Reset preset selected state if it doesn't match standard sizes
                        if (val === 0) setMargins('none');
                        else if (val === 24) setMargins('narrow');
                        else if (val === 48) setMargins('normal');
                        else setMargins('' as any); // clear preset selection
                      }}
                      className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                      <span>0px (None)</span>
                      <span>48px (Normal)</span>
                      <span>120px (Wide)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 2: Document & Branding Settings */}
            <div className="border border-slate-800/80 bg-slate-900/25 rounded-xl overflow-hidden transition-all duration-200">
              <button
                type="button"
                onClick={() => setBrandingExpanded(!brandingExpanded)}
                className="w-full flex items-center justify-between p-3 bg-slate-950/45 text-left font-bold text-slate-200 text-[11px] uppercase tracking-wider transition hover:bg-slate-950/65"
              >
                <span className="flex items-center gap-1.5">
                  <Settings size={13} className="text-emerald-400" /> Branding & Visibilities
                </span>
                <ChevronDown size={14} className={`text-slate-400 transform transition-transform duration-200 ${brandingExpanded ? 'rotate-180' : ''}`} />
              </button>
              
              {brandingExpanded && (
                <div className="p-4 space-y-3.5 border-t border-slate-800/50 bg-slate-950/10">
                  {/* Official Header */}
                  <label className="flex items-center justify-between p-2.5 bg-slate-900/40 rounded-xl border border-slate-800/80 cursor-pointer select-none">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-semibold text-slate-300">Official Header</span>
                      <span className="text-[9px] text-slate-500">Inject School Crest & Address</span>
                    </div>
                    <input 
                      type="checkbox"
                      checked={includeOfficialHeader}
                      onChange={(e) => setIncludeOfficialHeader(e.target.checked)}
                      className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 bg-slate-950 cursor-pointer"
                    />
                  </label>

                  {/* Signature Line */}
                  <label className="flex items-center justify-between p-2.5 bg-slate-900/40 rounded-xl border border-slate-800/80 cursor-pointer select-none">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-semibold text-slate-300">Signature Line</span>
                      <span className="text-[9px] text-slate-500">Add Principal & Registrar lines</span>
                    </div>
                    <input 
                      type="checkbox"
                      checked={includeSignatureLine}
                      onChange={(e) => setIncludeSignatureLine(e.target.checked)}
                      className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 bg-slate-950 cursor-pointer"
                    />
                  </label>

                  {/* Watermark */}
                  <label className="flex items-center justify-between p-2.5 bg-slate-900/40 rounded-xl border border-slate-800/80 cursor-pointer select-none">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-semibold text-slate-300">Watermark</span>
                      <span className="text-[9px] text-slate-500">Add faint "OFFICIAL" background</span>
                    </div>
                    <input 
                      type="checkbox"
                      checked={includeWatermark}
                      onChange={(e) => setIncludeWatermark(e.target.checked)}
                      className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 bg-slate-950 cursor-pointer"
                    />
                  </label>

                  {/* Hide Student Photos */}
                  <label className="flex items-center justify-between p-2.5 bg-slate-900/40 rounded-xl border border-slate-800/80 cursor-pointer select-none">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-semibold text-slate-300">Hide Student Photos</span>
                      <span className="text-[9px] text-slate-500">Remove portrait images</span>
                    </div>
                    <input 
                      type="checkbox"
                      checked={hideStudentPhotos}
                      onChange={(e) => setHideStudentPhotos(e.target.checked)}
                      className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 bg-slate-950 cursor-pointer"
                    />
                  </label>

                  {/* Include Blank Grades */}
                  <label className="flex items-center justify-between p-2.5 bg-slate-900/40 rounded-xl border border-slate-800/80 cursor-pointer select-none">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-semibold text-slate-300">Include Blank Grades</span>
                      <span className="text-[9px] text-slate-500">Show rows without scores</span>
                    </div>
                    <input 
                      type="checkbox"
                      checked={includeBlankGrades}
                      onChange={(e) => setIncludeBlankGrades(e.target.checked)}
                      className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 bg-slate-950 cursor-pointer"
                    />
                  </label>

                  {/* Include Page Numbers */}
                  <label className="flex items-center justify-between p-2.5 bg-slate-900/40 rounded-xl border border-slate-800/80 cursor-pointer select-none">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-semibold text-slate-300">Include Page Numbers</span>
                      <span className="text-[9px] text-slate-500">Add page count at bottom</span>
                    </div>
                    <input 
                      type="checkbox"
                      checked={includePageNumbers}
                      onChange={(e) => setIncludePageNumbers(e.target.checked)}
                      className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 bg-slate-950 cursor-pointer"
                    />
                  </label>

                  {/* Print Backgrounds */}
                  <label className="flex items-center justify-between p-2.5 bg-slate-900/40 rounded-xl border border-slate-800/80 cursor-pointer select-none">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-semibold text-slate-300">Print Backgrounds</span>
                      <span className="text-[9px] text-slate-500">Force colors and patterns</span>
                    </div>
                    <input 
                      type="checkbox"
                      checked={forcePrintBackgrounds}
                      onChange={(e) => setForcePrintBackgrounds(e.target.checked)}
                      className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 bg-slate-950 cursor-pointer"
                    />
                  </label>

                  {/* Font Size Selector */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-400">Document Font Size</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['small', 'normal', 'large'] as const).map(size => (
                        <button 
                          key={size}
                          type="button"
                          onClick={() => setFontSizeScale(size)}
                          className={`py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition ${
                            fontSizeScale === size 
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' 
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-300'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 3: Print Advance CSS Style */}
            <div className="border border-slate-800/80 bg-slate-900/25 rounded-xl overflow-hidden transition-all duration-200">
              <button
                type="button"
                onClick={() => setAdvancedExpanded(!advancedExpanded)}
                className="w-full flex items-center justify-between p-3 bg-slate-950/45 text-left font-bold text-slate-200 text-[11px] uppercase tracking-wider transition hover:bg-slate-950/65"
              >
                <span className="flex items-center gap-1.5">
                  <Sliders size={13} className="text-indigo-400" /> Advanced CSS Styles
                </span>
                <ChevronDown size={14} className={`text-slate-400 transform transition-transform duration-200 ${advancedExpanded ? 'rotate-180' : ''}`} />
              </button>
              
              {advancedExpanded && (
                <div className="p-4 space-y-4 border-t border-slate-800/50 bg-slate-950/10">
                  {/* CSS Print Theme Preset */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1">
                      <Paintbrush size={11} className="text-indigo-400" /> CSS Document Theme
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'executive-formal', label: 'Executive Formal', desc: 'Solid accent headers & grid' },
                        { id: 'classic-academic', label: 'Classic Academic', desc: 'Serif fonts & double borders' },
                        { id: 'modern-minimal', label: 'Modern Minimal', desc: 'Clean sans-serif & minimal rules' },
                        { id: 'high-contrast-mono', label: 'High-Contrast B&W', desc: 'Pure monochrome for copy' },
                      ].map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setCssTheme(t.id as any)}
                          className={`p-2 text-left rounded-xl border transition cursor-pointer select-none ${
                            cssTheme === t.id
                              ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 shadow-sm'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <div className="text-[10.5px] font-bold">{t.label}</div>
                          <div className="text-[8.5px] text-slate-500 font-sans leading-tight mt-0.5">{t.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Table Formatting Style */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1">
                      <Table size={11} className="text-indigo-400" /> Table Grid Format
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'bordered', label: 'Full Grid' },
                        { id: 'striped', label: 'Zebra Striped' },
                        { id: 'minimal', label: 'Clean Lines' },
                      ].map(tf => (
                        <button
                          key={tf.id}
                          type="button"
                          onClick={() => setCssTableFormat(tf.id as any)}
                          className={`py-1.5 px-2 text-[10px] font-bold text-center rounded-lg border transition cursor-pointer select-none ${
                            cssTableFormat === tf.id
                              ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {tf.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* CSS Accent Palette */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1">
                      <Palette size={11} className="text-indigo-400" /> Accent Color Theme
                    </label>
                    <div className="flex items-center gap-2 pt-1">
                      {[
                        { hex: '#0f172a', name: 'Slate Dark' },
                        { hex: '#1e3a8a', name: 'Royal Navy' },
                        { hex: '#064e3b', name: 'Forest Emerald' },
                        { hex: '#312e81', name: 'Deep Indigo' },
                        { hex: '#701a75', name: 'Burgundy Plum' },
                      ].map(c => (
                        <button
                          key={c.hex}
                          type="button"
                          title={c.name}
                          onClick={() => setCssAccentColor(c.hex)}
                          className={`w-7 h-7 rounded-full transition transform hover:scale-110 flex items-center justify-center border-2 cursor-pointer ${
                            cssAccentColor === c.hex ? 'border-indigo-400 ring-2 ring-indigo-500/40 scale-105' : 'border-slate-800'
                          }`}
                          style={{ backgroundColor: c.hex }}
                        >
                          {cssAccentColor === c.hex && <Check size={12} className="text-white" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom CSS Overrides Editor Drawer */}
                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedCssPanel(!showAdvancedCssPanel)}
                      className="w-full flex items-center justify-between p-2.5 bg-slate-900/60 hover:bg-slate-900 rounded-xl border border-slate-800/80 text-xs font-bold text-slate-300 transition cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Code size={13} className="text-amber-400" /> Advanced Custom CSS Overrides
                      </span>
                      {showAdvancedCssPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    <AnimatePresence>
                      {showAdvancedCssPanel && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-2 overflow-hidden pt-1"
                        >
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span>Write custom CSS rules</span>
                            {customCssCode && (
                              <button
                                type="button"
                                onClick={() => setCustomCssCode('')}
                                className="text-rose-400 hover:underline cursor-pointer"
                              >
                                Clear CSS
                              </button>
                            )}
                          </div>
                          <textarea
                            value={customCssCode}
                            onChange={(e) => setCustomCssCode(e.target.value)}
                            placeholder={`/* Custom CSS format overrides */\ntable { font-size: 8.5pt !important; }\n.official-header-box { padding-bottom: 2mm !important; }`}
                            className="w-full h-28 p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-mono text-emerald-300 focus:outline-none focus:border-indigo-500 placeholder:text-slate-600 resize-none"
                          />

                          {/* Snippet shortcuts */}
                          <div className="space-y-1">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Quick CSS Format Snippets:</span>
                            <div className="flex flex-wrap gap-1">
                              {[
                                { label: '+ Compact Cells', css: 'td, th { padding: 2px 4px !important; }\n' },
                                { label: '+ Pure B&W Print', css: '* { color: black !important; background: white !important; }\n' },
                                { label: '+ Hide Crest Logo', css: 'img[alt="School Logo"], svg { display: none !important; }\n' },
                                { label: '+ Large Headings', css: 'h1, h2 { font-size: 18pt !important; }\n' },
                              ].map((snippet, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setCustomCssCode(prev => prev + snippet.css)}
                                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded text-[9.5px] font-mono border border-slate-700 transition cursor-pointer"
                                >
                                  {snippet.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-xl space-y-2">
              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-wider">
                <Info size={10} className="text-indigo-400" /> Print Alignment Rule
              </span>
              <p className="text-[10px] leading-relaxed text-slate-500">
                To guarantee zero empty pages, we isolate document rendering in a separate headless element, discarding sidebar panels and dashboard background themes automatically.
              </p>
            </div>
            </div>
          )}

          {/* Paper Canvas Preview Area */}
          <div className={`flex-1 relative overflow-hidden flex flex-col bg-slate-950 ${
            mobileActiveTab === 'preview' ? 'flex' : 'hidden md:flex'
          }`}>
            


            {/* Scrollable Canvas Container with Custom Visible Scrollbar */}
            <PrintPreviewScrollWrapper 
              ref={previewContainerRef} 
              onWheel={handleWheel}
            >
              {/* Outer Wrapper with exact scaled dimensions to prevent layout overflow/clipping */}
              <div 
                className="relative flex-shrink-0 transition-all duration-200"
                style={{
                  width: `${(paperSize === 'receipt' ? 831 : (orientation === 'landscape' ? 1123 : 794)) * previewScale}px`,
                  height: `${docRealHeight * previewScale}px`,
                }}
              >
                <div 
                  ref={documentRef}
                  className={`bg-white text-slate-900 shadow-2xl transition-all duration-200 absolute left-0 top-0 origin-top-left ${printLayout === 'compact' ? 'print-layout-compact' : 'print-layout-full'}`}
                  style={{
                    width: paperSize === 'receipt' ? '831px' : (orientation === 'landscape' ? '1123px' : '794px'),
                    minHeight: paperSize === 'receipt' ? '416px' : (orientation === 'landscape' ? '794px' : '1123px'),
                    fontFamily: "'Inter', sans-serif",
                    fontSize: fontSizeScale === 'small' ? '10px' : fontSizeScale === 'large' ? '13px' : '11px',
                    lineHeight: '1.5',
                    padding: `${isReportCard ? 0 : customMargin}px`,
                    transform: `scale(${previewScale})`,
                  }}
                >
                {/* Preview watermarks */}
                {includeWatermark && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0" dangerouslySetInnerHTML={{ __html: getWatermarkHtml(schoolInfo?.crestUrl) }} />
                )}

                <style dangerouslySetInnerHTML={{ __html: `
                  ${hideStudentPhotos ? '.student-report-photo, .student-report-photo-placeholder, img[src*="photo"], .student-photo { display: none !important; }' : ''}
                  ${!includeBlankGrades ? '.assessment-grade-empty { display: none !important; }' : ''}
                  ${getAdvancedCssStyles()}
                  /* Force print utility classes to be active in the live preview */
                  .document-live-preview-box .print\\:block { display: block !important; }
                  .document-live-preview-box .print\\:flex { display: flex !important; }
                  .document-live-preview-box .print\\:grid { display: grid !important; }
                  .document-live-preview-box .print\\:hidden { display: none !important; }
                  .document-live-preview-box .hidden.print\\:block, 
                  .document-live-preview-box .hidden.print\\:flex,
                  .document-live-preview-box .hidden.print\\:grid {
                     display: block !important;
                  }
                `}} />

                {/* Dynamic Header */}
                {includeOfficialHeader && (
                  <div className="border-b-2 border-slate-900 pb-5 mb-8 flex flex-col items-center text-center relative z-10">
                    <div className="flex flex-col items-center gap-2">
                      {schoolInfo.logoUrl ? (
                        <img src={schoolInfo.logoUrl} className="h-16 w-auto object-contain mb-2" alt="School Logo" />
                      ) : (
                        <div className="h-16 w-16 flex-shrink-0 mb-2" dangerouslySetInnerHTML={{ __html: GHANA_CREST_HEADER_SVG.replace('width: 55px; height: 55px;', 'width: 60px; height: 60px;').replace('margin-right: 15px;', '') }} />
                      )}
                      <div>
                        <h1 className="text-2xl font-black uppercase text-slate-900 leading-none tracking-tight">
                          {schoolInfo.name || 'SCHOOL MANAGEMENT SYSTEM'}
                        </h1>
                        <p className="text-[10px] font-semibold text-slate-700 mt-2">
                          {schoolInfo.gpsAddress || 'Accra, Ghana'} | Tel: {schoolInfo.telephone || 'N/A'}
                        </p>
                        <p className="text-[10px] font-medium text-slate-500">
                          {schoolInfo.email || ''}
                        </p>
                      </div>
                    </div>
                    <div className="mt-6 flex flex-col items-center">
                      <span className="inline-block bg-slate-900 text-white text-[11px] font-extrabold px-3 py-1 rounded uppercase tracking-widest">
                        {documentTitle}
                      </span>
                      <p className="text-[10px] text-slate-500 mt-2 font-medium">
                        Official Document • Date: {new Date().toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}

                {/* Actual Content Wrapper */}
                <div 
                  id={elementId}
                  className={`document-live-preview-box relative z-10 ${sourceClassName}`}
                  style={{ width: '100%', maxWidth: 'none', minWidth: '100%' }}
                  dangerouslySetInnerHTML={{ __html: previewContent }}
                />
                
                {/* Audit Log Overlay */}
                {showAuditLog && (
                  <div className="absolute inset-0 bg-white p-10 z-20 overflow-y-auto">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2">Audit Log: Transcript Generation History</h3>
                    <div className="space-y-2 mt-4">
                      {DbController.getActivityLogs()
                        .filter(l => l.action.includes('Print Transcript Generated') && l.details.includes(studentId!))
                        .map((log, i) => (
                          <div key={i} className="flex justify-between items-center text-[11px] font-mono text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                            <span>{log.action}: {log.details}</span>
                            <span className="font-bold text-slate-900">{new Date(log.timestamp).toLocaleString()}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Dynamic Footer */}
                {includeSignatureLine && (
                  <div className="mt-12 pt-6 border-t border-dashed border-slate-300 flex justify-between relative z-10 text-[9px]">
                    <div>
                      <p className="font-bold text-slate-500 uppercase tracking-wider">Prepared By:</p>
                      <div className="w-32 border-b border-slate-900 mt-6 mb-1"></div>
                      <p className="text-[8px] text-slate-400">Registrar / Academic Office</p>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <p className="font-bold text-slate-500 uppercase tracking-wider">Approved By (Principal):</p>
                      <div className="w-32 border-b border-slate-900 mt-6 mb-1"></div>
                      <p className="text-[8px] text-slate-400">Signature & Official Stamp</p>
                    </div>
                  </div>
                )}
                </div>
              </div>
            </PrintPreviewScrollWrapper>
          </div>

        </div>

        {/* Footer Action Ribbon */}
        <div className="px-4 sm:px-6 py-4 bg-slate-950/60 border-t border-slate-800 flex flex-wrap gap-2 items-center justify-between no-print">
          <button 
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 px-3 sm:px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:border-rose-500/35 text-xs font-bold rounded-xl shadow-xs transition cursor-pointer select-none"
          >
            <X size={13} className="stroke-[2.5]" />
            <span className="hidden sm:inline">Cancel & Exit</span>
            <span className="sm:hidden">Cancel</span>
          </button>
          
          <div className="flex items-center gap-1.5 sm:gap-2">
            {isTranscript && onLanguageChange && (
              <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-lg border border-slate-700">
                <button
                  type="button"
                  onClick={() => onLanguageChange('en')}
                  className={`px-2 py-1 sm:px-3 rounded-md text-[10px] font-bold transition ${currentLanguage === 'en' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => onLanguageChange('twi')}
                  className={`px-2 py-1 sm:px-3 rounded-md text-[10px] font-bold transition ${currentLanguage === 'twi' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  TWI
                </button>
              </div>
            )}
            {isTranscript ? (
              <button 
                type="button"
                onClick={handlePdfDownload}
                disabled={isLoading}
                className="flex items-center gap-1 px-3 sm:px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/10 transition disabled:opacity-50"
              >
                <FileDown size={14} />
                <span>{isLoading ? 'Generating...' : 'PDF'}</span>
              </button>
            ) : (
              <button 
                type="button"
                onClick={handlePdfDownload}
                disabled={isLoading}
                className="flex items-center gap-1 px-3 sm:px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition disabled:opacity-50"
              >
                <FileDown size={14} />
                <span className="hidden sm:inline">Save PDF Document</span>
                <span className="sm:hidden">PDF</span>
              </button>
            )}
            <button 
              type="button"
              onClick={handlePrint}
              disabled={isLoading}
              className="flex items-center gap-1 px-3 sm:px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/10 transition disabled:opacity-50"
            >
              <Printer size={14} />
              <span>{isLoading ? 'Preparing...' : 'Print'}</span>
            </button>
          </div>
        </div>

      </motion.div>
    </div>
  );
};
