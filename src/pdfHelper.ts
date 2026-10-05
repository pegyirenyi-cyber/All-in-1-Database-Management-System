import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface PDFGenerationResult {
  blob: Blob;
  filename: string;
}

export function replaceOklchInString(str: string): string {
  if (!str || !str.includes('oklch')) return str;
  const oklchRegex = /oklch\(\s*([0-9.]+%?)(?:\s+|\s*,\s*)([0-9.]+%?)(?:\s+|\s*,\s*)([0-9.deg]+)(?:\s*(?:\/|,)\s*([0-9.%]+))?\s*\)/gi;
  return str.replace(oklchRegex, (match, lStr, cStr, hStr, aStr) => {
    try {
      let l = lStr.endsWith('%') ? parseFloat(lStr) / 100 : parseFloat(lStr);
      let c = cStr.endsWith('%') ? parseFloat(cStr) / 100 : parseFloat(cStr);
      let h = hStr.endsWith('deg') ? parseFloat(hStr) : parseFloat(hStr);
      let a = 1;
      if (aStr) {
        if (aStr.endsWith('%')) {
          a = parseFloat(aStr) / 100;
        } else {
          a = parseFloat(aStr);
        }
      }

      if (isNaN(l)) l = 0;
      if (isNaN(c)) c = 0;
      if (isNaN(h)) h = 0;

      // OKLab conversion
      const hRad = (h * Math.PI) / 180;
      const a_lab = c * Math.cos(hRad);
      const b_lab = c * Math.sin(hRad);

      const l_lms = l + 0.3963377774 * a_lab + 0.2158037573 * b_lab;
      const m_lms = l - 0.1055613458 * a_lab - 0.0638541728 * b_lab;
      const s_lms = l - 0.0894841775 * a_lab - 1.2914855480 * b_lab;

      const l3 = l_lms * l_lms * l_lms;
      const m3 = m_lms * m_lms * m_lms;
      const s3 = s_lms * s_lms * s_lms;

      const r_lin = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
      const g_lin = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
      const b_lin = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

      const f = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);

      const r = Math.round(Math.max(0, Math.min(1, f(r_lin))) * 255);
      const g = Math.round(Math.max(0, Math.min(1, f(g_lin))) * 255);
      const b = Math.round(Math.max(0, Math.min(1, f(b_lin))) * 255);

      return a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
    } catch (err) {
      console.warn("Failed to parse oklch color:", match, err);
      return match;
    }
  });
}

export function replaceOklabInString(str: string): string {
  if (!str || !str.includes('oklab')) return str;
  const oklabRegex = /oklab\(\s*([0-9.]+%?)(?:\s+|\s*,\s*)([0-9.-]+%?)(?:\s+|\s*,\s*)([0-9.-]+%?)(?:\s*(?:\/|,)\s*([0-9.%]+))?\s*\)/gi;
  return str.replace(oklabRegex, (match, lStr, aStrVal, bStrVal, aStr) => {
    try {
      let l = lStr.endsWith('%') ? parseFloat(lStr) / 100 : parseFloat(lStr);
      let a_lab = aStrVal.endsWith('%') ? parseFloat(aStrVal) / 100 : parseFloat(aStrVal);
      let b_lab = bStrVal.endsWith('%') ? parseFloat(bStrVal) / 100 : parseFloat(bStrVal);
      let alpha = 1;
      if (aStr) {
        if (aStr.endsWith('%')) {
          alpha = parseFloat(aStr) / 100;
        } else {
          alpha = parseFloat(aStr);
        }
      }

      if (isNaN(l)) l = 0;
      if (isNaN(a_lab)) a_lab = 0;
      if (isNaN(b_lab)) b_lab = 0;

      const l_lms = l + 0.3963377774 * a_lab + 0.2158037573 * b_lab;
      const m_lms = l - 0.1055613458 * a_lab - 0.0638541728 * b_lab;
      const s_lms = l - 0.0894841775 * a_lab - 1.2914855480 * b_lab;

      const l3 = l_lms * l_lms * l_lms;
      const m3 = m_lms * m_lms * m_lms;
      const s3 = s_lms * s_lms * s_lms;

      const r_lin = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
      const g_lin = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
      const b_lin = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

      const f = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);

      const r = Math.round(Math.max(0, Math.min(1, f(r_lin))) * 255);
      const g = Math.round(Math.max(0, Math.min(1, f(g_lin))) * 255);
      const b = Math.round(Math.max(0, Math.min(1, f(b_lin))) * 255);

      return alpha === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
    } catch (err) {
      console.warn("Failed to parse oklab color:", match, err);
      return match;
    }
  });
}

export function replaceColorFunctions(str: string): string {
  let res = str;
  if (res && res.includes('oklch')) {
    res = replaceOklchInString(res);
  }
  if (res && res.includes('oklab')) {
    res = replaceOklabInString(res);
  }
  return res;
}

export const generatePdfFromHtml = async (
  elementId: string, 
  filename: string, 
  isLandscape: boolean = false
): Promise<PDFGenerationResult> => {
  const sourceElement = document.getElementById(elementId);
  if (!sourceElement) {
    throw new Error(`Element with id "${elementId}" not found for PDF generation.`);
  }

  // Backup original styles and functions to avoid leaking changes outside PDF export
  const originalGetComputedStyle = window.getComputedStyle;
  const originalGetPropertyValue = CSSStyleDeclaration.prototype.getPropertyValue;
  const originalGetAttribute = Element.prototype.getAttribute;

  const cssStyleDeclProto = CSSStyleDeclaration.prototype;
  const cssRuleProto = typeof CSSRule !== 'undefined' ? CSSRule.prototype : null;
  const cssStyleRuleProto = typeof CSSStyleRule !== 'undefined' ? CSSStyleRule.prototype : null;

  // Track modified descriptors so we can restore them perfectly
  const patchedDescriptors: { obj: any; prop: string; desc: PropertyDescriptor }[] = [];

  const patchProperty = (obj: any, prop: string, transform: (val: string) => string) => {
    if (!obj) return;
    try {
      const desc = Object.getOwnPropertyDescriptor(obj, prop);
      if (desc) {
        patchedDescriptors.push({ obj, prop, desc });
        const newDesc = { ...desc };
        if (desc.get) {
          newDesc.get = function() {
            const val = desc.get!.call(this);
            return typeof val === 'string' ? transform(val) : val;
          };
        } else if (typeof desc.value === 'string') {
          let currentVal = desc.value;
          newDesc.get = function() {
            return transform(currentVal);
          };
          if (desc.writable) {
            newDesc.set = function(v) {
              currentVal = v;
            };
          }
        }
        Object.defineProperty(obj, prop, newDesc);
      }
    } catch (e) {
      // Ignore
    }
  };

  // 1. Patch CSSStyleDeclaration.prototype.getPropertyValue
  CSSStyleDeclaration.prototype.getPropertyValue = function(property: string): string {
    const val = originalGetPropertyValue.call(this, property);
    if (typeof val === 'string' && (val.includes('oklch') || val.includes('oklab'))) {
      return replaceColorFunctions(val);
    }
    return val;
  };

  // 2. Patch Element.prototype.getAttribute
  Element.prototype.getAttribute = function(name: string): string | null {
    const val = originalGetAttribute.call(this, name);
    if (typeof val === 'string' && (val.includes('oklch') || val.includes('oklab'))) {
      return replaceColorFunctions(val);
    }
    return val;
  };

  // 3. Patch specific descriptors like cssText on prototype objects
  patchProperty(cssStyleDeclProto, 'cssText', replaceColorFunctions);
  if (cssRuleProto) patchProperty(cssRuleProto, 'cssText', replaceColorFunctions);
  if (cssStyleRuleProto) patchProperty(cssStyleRuleProto, 'cssText', replaceColorFunctions);

  // 4. Dynamic prototype getter patching for CSSStyleDeclaration.prototype properties
  try {
    const allDeclProps = [
      'color', 'backgroundColor', 'background', 'backgroundImage',
      'borderColor', 'borderLeftColor', 'borderRightColor', 'borderTopColor', 'borderBottomColor',
      'outlineColor', 'textDecorationColor', 'boxShadow', 'fill', 'stroke'
    ];
    for (const prop of allDeclProps) {
      if (prop !== 'getPropertyValue' && prop !== 'cssText') {
        const desc = Object.getOwnPropertyDescriptor(cssStyleDeclProto, prop);
        if (desc && desc.get) {
          patchProperty(cssStyleDeclProto, prop, replaceColorFunctions);
        }
      }
    }
  } catch (e) {
    // Ignore
  }

  // 5. Patch window.getComputedStyle using Proxy to intercept all properties dynamically
  window.getComputedStyle = function(el: Element, pseudoElt?: string | null): CSSStyleDeclaration {
    const style = originalGetComputedStyle(el, pseudoElt);
    return new Proxy(style, {
      get(target, prop) {
        const val = Reflect.get(target, prop);
        if (typeof prop === 'string') {
          if (typeof val === 'string' && (val.includes('oklch') || val.includes('oklab'))) {
            return replaceColorFunctions(val);
          }
        }
        if (typeof val === 'function') {
          return val.bind(target);
        }
        return val;
      }
    });
  };

  // Create an off-screen sandbox staging host to guarantee 100% visible, non-clipped geometry
  const isDL = ((elementId === 'fee-receipt-print-area' && !elementId.includes('ledger')) || 
               (sourceElement.querySelector('#fee-receipt-print-area') !== null && sourceElement.querySelector('#fee-ledger-print-area') === null)) &&
               elementId !== 'bulk-receipts-print-area' && 
               sourceElement.querySelector('#bulk-receipts-print-area') === null;

  const targetWidthPx = isDL ? 831 : (isLandscape ? 1123 : 794);
  const targetHeightPx = isDL ? 416 : (isLandscape ? 794 : 1123);

  const sandbox = document.createElement('div');
  sandbox.id = '__pdf_render_sandbox__';
  sandbox.style.cssText = `
    position: fixed !important;
    left: 0px !important;
    top: 0px !important;
    z-index: -999999 !important;
    width: ${targetWidthPx}px !important;
    min-width: ${targetWidthPx}px !important;
    max-width: ${targetWidthPx}px !important;
    background: #ffffff !important;
    color: #0f172a !important;
    margin: 0 !important;
    padding: 0 !important;
    box-sizing: border-box !important;
    overflow: visible !important;
    visibility: visible !important;
    opacity: 1 !important;
    pointer-events: none !important;
    transform: none !important;
  `;

  // Inject anti-scatter style reset sheet
  const antiScatterStyle = document.createElement('style');
  antiScatterStyle.textContent = `
    #__pdf_render_sandbox__ *, #__pdf_render_sandbox__ *::before, #__pdf_render_sandbox__ *::after {
      box-sizing: border-box !important;
      transform: none !important;
      animation: none !important;
      transition: none !important;
      filter: none !important;
    }
    #__pdf_render_sandbox__ .print-page, 
    #__pdf_render_sandbox__ .report-card-print-container, 
    #__pdf_render_sandbox__ .bulk-report-card-print-page,
    #__pdf_render_sandbox__ .fee-receipt-print-area {
      width: ${targetWidthPx}px !important;
      min-width: ${targetWidthPx}px !important;
      max-width: ${targetWidthPx}px !important;
      margin: 0 auto !important;
      box-shadow: none !important;
      border-radius: 0 !important;
      position: relative !important;
      left: auto !important;
      top: auto !important;
      right: auto !important;
      bottom: auto !important;
    }
  `;
  sandbox.appendChild(antiScatterStyle);

  // Deep clone the source element to sanitize any offscreen positioning or display:none
  const clone = sourceElement.cloneNode(true) as HTMLElement;
  clone.id = `${elementId}_pdf_clone`;
  
  // Strip hiding classes and coordinates
  clone.classList.remove(
    'hidden', 'invisible', 'opacity-0', 'fixed', 'absolute',
    '-top-[9999px]', '-left-[9999px]', 'top-[-9999px]', 'left-[-9999px]',
    'z-[-100]', 'no-print'
  );
  
  clone.style.display = 'block';
  clone.style.visibility = 'visible';
  clone.style.opacity = '1';
  clone.style.position = 'relative';
  clone.style.left = '0px';
  clone.style.top = '0px';
  clone.style.width = `${targetWidthPx}px`;
  clone.style.minWidth = `${targetWidthPx}px`;
  clone.style.maxWidth = `${targetWidthPx}px`;
  clone.style.height = 'auto';
  clone.style.maxHeight = 'none';
  clone.style.overflow = 'visible';
  clone.style.backgroundColor = '#ffffff';
  clone.style.transform = 'none';

  // Copy computed layout properties (flex, grid, dimensions) recursively to prevent layout collapse.
  // Performance optimization: Using original unpatched getComputedStyle directly bypasses slow proxy traps.
  // If elementCount is large, we selectively copy styles for major sections to prevent browser thread freeze.
  try {
    const srcAll = sourceElement.querySelectorAll('*');
    const clnAll = clone.querySelectorAll('*');
    const nodeCount = srcAll.length;
    
    if (nodeCount < 200) {
      for (let i = 0; i < srcAll.length && i < clnAll.length; i++) {
        const sNode = srcAll[i] as HTMLElement;
        const cNode = clnAll[i] as HTMLElement;
        if (sNode && cNode) {
          const comp = originalGetComputedStyle(sNode);
          if (comp.display === 'flex' || comp.display === 'inline-flex') {
            cNode.style.display = comp.display;
            cNode.style.flexDirection = comp.flexDirection;
            cNode.style.justifyContent = comp.justifyContent;
            cNode.style.alignItems = comp.alignItems;
            cNode.style.gap = comp.gap;
            cNode.style.flexWrap = comp.flexWrap;
          } else if (comp.display === 'grid' || comp.display === 'inline-grid') {
            cNode.style.display = comp.display;
            cNode.style.gridTemplateColumns = comp.gridTemplateColumns;
            cNode.style.gap = comp.gap;
          }
          if (comp.width && comp.width !== 'auto') {
            cNode.style.width = comp.width;
          }
        }
      }
    } else {
      // Large print items (e.g. multi-semester transcripts, lists, bulk sheets):
      // Only copy flex/grid for direct child structures of key layout wrappers
      const layoutSelectors = '.print-page, .report-card-print-container, .bulk-report-card-print-page, .id-cards-landscape-page, .fee-receipt-print-area, .bulk-receipts-print-page, .bulk-receipt-slip';
      const srcLayouts = sourceElement.querySelectorAll(layoutSelectors);
      const clnLayouts = clone.querySelectorAll(layoutSelectors);
      for (let i = 0; i < srcLayouts.length && i < clnLayouts.length; i++) {
        const sNode = srcLayouts[i] as HTMLElement;
        const cNode = clnLayouts[i] as HTMLElement;
        if (sNode && cNode) {
          const comp = originalGetComputedStyle(sNode);
          cNode.style.display = comp.display;
          cNode.style.width = comp.width || '100%';
        }
      }
    }
  } catch (e) {
    // Non-fatal styling copy fallback
  }

  // Make all inner print pages / items explicitly visible
  const allHiddenPrintElements = clone.querySelectorAll<HTMLElement>(
    '.hidden, .print\\:block, [class*="print:block"], .bulk-report-card-print-page, .bulk-receipts-print-page, .bulk-receipt-item, .bulk-id-card-item, .id-card-print-item, .report-card-print-container, .print-page'
  );
  allHiddenPrintElements.forEach(el => {
    el.classList.remove('hidden', 'invisible', 'opacity-0');
    el.style.display = 'block';
    el.style.visibility = 'visible';
    el.style.opacity = '1';
  });

  // Remove non-print UI elements (buttons, navigation controls, actions)
  const nonPrintElements = clone.querySelectorAll<HTMLElement>('.no-print, button, .btn, .actions-row, nav');
  nonPrintElements.forEach(el => {
    el.style.display = 'none';
  });

  sandbox.appendChild(clone);
  document.body.appendChild(sandbox);

  try {
    // Wait for all images inside the clone to load/decode
    const images = Array.from(sandbox.querySelectorAll<HTMLImageElement>('img'));
    if (images.length > 0) {
      await Promise.all(
        images.map(img => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
            setTimeout(resolve, 600);
          });
        })
      );
    }

    // Wait for fonts if available
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch (e) {
        // Ignore font load error
      }
    }

    // Short layout settle tick & ensure render pass
    await new Promise(r => setTimeout(r, 200));

    // Check if there are multiple dedicated pages
    const pages = Array.from(sandbox.querySelectorAll<HTMLElement>(
      '.bulk-report-card-print-page, .report-card-print-container, .print-page, .id-cards-landscape-page, .bulk-id-card-item, .id-card-print-item, .bulk-receipts-print-page, .bulk-receipt-item, .fee-receipt-print-area'
    ));

    const pdfOrientation = isLandscape ? 'l' : 'p';
    const pdfFormat = isDL ? [220, 110] : 'a4';
    const pdfWidth = isDL ? 220 : (isLandscape ? 297 : 210);
    const pdfHeight = isDL ? 110 : (isLandscape ? 210 : 297);

    const pdf = new jsPDF({
      orientation: pdfOrientation,
      unit: 'mm',
      format: pdfFormat,
    });

    if (pages.length > 1) {
      // High fidelity multi-page rendering
      for (let i = 0; i < pages.length; i++) {
        const pageEl = pages[i];
        pageEl.style.display = 'block';
        pageEl.style.visibility = 'visible';
        pageEl.style.opacity = '1';
        pageEl.style.overflow = 'visible';

        const pageCanvas = await html2canvas(pageEl, {
          scale: pages.length > 10 ? 1.25 : (pages.length > 4 ? 1.5 : 1.75),
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          scrollX: 0,
          scrollY: 0,
          x: 0,
          y: 0,
          onclone: (clonedDoc) => {
            const styleElements = clonedDoc.getElementsByTagName('style');
            for (let s = 0; s < styleElements.length; s++) {
              const style = styleElements[s];
              if (style.textContent && (style.textContent.includes('oklch') || style.textContent.includes('oklab'))) {
                style.textContent = replaceColorFunctions(style.textContent);
              }
            }
          }
        });

        if (i > 0) {
          pdf.addPage();
        }

        const imgData = pageCanvas.toDataURL('image/png', 1.0);
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      }

      const blob = pdf.output('blob');
      return {
        blob,
        filename: filename.endsWith('.pdf') ? filename : `${filename}.pdf`
      };
    }

    // Single document or continuous multi-page document
    // Adjust canvas rendering scale dynamically based on content height to avoid exceeding browser limits (causes blank output)
    const totalHeight = clone.offsetHeight || clone.scrollHeight || 1000;
    const canvasScale = totalHeight > 5000 ? 1.0 : (totalHeight > 2500 ? 1.25 : 1.75);

    const canvas = await html2canvas(clone, {
      scale: canvasScale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc) => {
        const styleElements = clonedDoc.getElementsByTagName('style');
        for (let s = 0; s < styleElements.length; s++) {
          const style = styleElements[s];
          if (style.textContent && (style.textContent.includes('oklch') || style.textContent.includes('oklab'))) {
            style.textContent = replaceColorFunctions(style.textContent);
          }
        }
      }
    });

    const imgData = canvas.toDataURL('image/png', 1.0);
    const margin = isDL ? 0 : 8;
    const imgWidth = pdfWidth - (margin * 2);
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const printableHeight = pdfHeight - (margin * 2);

    // If fits on 1 page (with tolerance), center and scale
    if (imgHeight <= printableHeight + 15) {
      const imageAspectRatio = canvas.width / canvas.height;
      const printableAspectRatio = imgWidth / printableHeight;

      let finalWidth = imgWidth;
      let finalHeight = imgHeight;

      if (imageAspectRatio > printableAspectRatio) {
        finalWidth = imgWidth;
        finalHeight = imgWidth / imageAspectRatio;
      } else {
        finalHeight = printableHeight;
        finalWidth = printableHeight * imageAspectRatio;
      }

      const posX = margin + (imgWidth - finalWidth) / 2;
      const posY = margin + (printableHeight - finalHeight) / 2;

      pdf.addImage(imgData, 'PNG', posX, posY, finalWidth, finalHeight);
    } else {
      // Clean multi-page continuous slicing
      const pageCanvas = document.createElement('canvas');
      const srcPageHeight = Math.floor((printableHeight * canvas.width) / imgWidth);
      pageCanvas.width = canvas.width;

      let srcY = 0;
      let remainingCanvasHeight = canvas.height;
      let pageIndex = 0;

      while (remainingCanvasHeight > 0) {
        if (pageIndex > 0) {
          pdf.addPage();
        }

        const currentSliceHeight = Math.min(srcPageHeight, remainingCanvasHeight);
        pageCanvas.height = currentSliceHeight;

        // Retrieving the context inside the loop is vital as changing the height resets the canvas state
        const pageCtx = pageCanvas.getContext('2d');
        if (pageCtx) {
          pageCtx.fillStyle = '#ffffff';
          pageCtx.fillRect(0, 0, pageCanvas.width, currentSliceHeight);
          pageCtx.drawImage(
            canvas,
            0, srcY, canvas.width, currentSliceHeight,
            0, 0, pageCanvas.width, currentSliceHeight
          );
        }

        const sliceImgData = pageCanvas.toDataURL('image/png', 1.0);
        const slicePdfHeight = (currentSliceHeight * imgWidth) / canvas.width;

        pdf.addImage(sliceImgData, 'PNG', margin, margin, imgWidth, slicePdfHeight);

        srcY += currentSliceHeight;
        remainingCanvasHeight -= currentSliceHeight;
        pageIndex++;
      }
    }

    const blob = pdf.output('blob');
    return {
      blob,
      filename: filename.endsWith('.pdf') ? filename : `${filename}.pdf`
    };
  } finally {
    // Clean up sandbox
    if (sandbox.parentNode) {
      sandbox.parentNode.removeChild(sandbox);
    }

    // Restore browser APIs immediately
    window.getComputedStyle = originalGetComputedStyle;
    CSSStyleDeclaration.prototype.getPropertyValue = originalGetPropertyValue;
    Element.prototype.getAttribute = originalGetAttribute;

    // Restore modified proto descriptors perfectly
    for (const { obj, prop, desc } of patchedDescriptors) {
      try {
        Object.defineProperty(obj, prop, desc);
      } catch (e) {
        // Ignore
      }
    }
  }
};

export const downloadBlobLocally = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
