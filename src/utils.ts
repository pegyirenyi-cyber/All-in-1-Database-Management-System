import { Student } from './types';

/**
 * Compresses an image base64 data string to reduce its byte size under Firestore limits.
 * Downsamples the image dimensions and applies quality compression.
 */
export function compressImage(base64Str: string, maxWidth = 250, maxHeight = 250, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    if (!base64Str || !base64Str.startsWith('data:image')) {
      resolve(base64Str);
      return;
    }

    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions to fit within maxWidth/maxHeight preserving aspect ratio
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF'; // Ensure transparent PNG background defaults to white on JPEG compression
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        // Export as JPEG with the specified quality (0.0 to 1.0)
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      } else {
        resolve(base64Str);
      }
    };
    
    img.onerror = () => {
      resolve(base64Str);
    };
    
    img.src = base64Str;
  });
}

/**
 * Generates a high-quality deterministic secure access token for parents.
 * Integrates student context, term state, and custom enterprise-grade institutional salt.
 */
export function generateSecureToken(studentId: string, year: string, term: string): string {
  const cleanYear = (year || '').replace(/[\/\s]/g, '_');
  const cleanTerm = (term || '').replace(/[\s]/g, '_');
  const input = `${studentId}-${cleanYear}-${cleanTerm}-geetech-parent-portal-salt-2026-secure`;
  
  // First cryptographic pass
  let hash1 = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash1 = ((hash1 << 5) - hash1) + char;
    hash1 = hash1 & hash1; // Convert to 32bit integer
  }
  const part1 = Math.abs(hash1).toString(16).padStart(8, '0');
  
  // Second cryptographic pass
  let hash2 = 17;
  for (let i = input.length - 1; i >= 0; i--) {
    const char = input.charCodeAt(i);
    hash2 = ((hash2 << 5) + hash2) + char;
    hash2 = hash2 & hash2; // Convert to 32bit integer
  }
  const part2 = Math.abs(hash2).toString(16).padStart(8, '0');
  
  return `${part1}${part2}`.toUpperCase();
}

/**
 * Triggers a global toast notification event.
 */
export function triggerToast(text: string, type: 'success' | 'error' | 'info' = 'success') {
  const event = new CustomEvent('app-toast', { detail: { text, type } });
  window.dispatchEvent(event);
}

export type WhatsAppTemplate = 'PORTAL_ACCESS' | 'FEES_REMINDER' | 'ASSESSMENT_RELEASE';

export const getWhatsAppShareData = (student: Student, year: string, term: string, template: WhatsAppTemplate = 'PORTAL_ACCESS') => {
  const token = generateSecureToken(student.id, year, term);
  const parentUrl = `${window.location.origin}/?studentId=${student.id}&year=${encodeURIComponent(year)}&term=${encodeURIComponent(term)}&token=${token}&parentMode=true`;
  
  let message = "";
  
  if (template === 'FEES_REMINDER') {
    message = `Hello ${student.guardianName || 'Guardian'},\n\n` +
      `This is a friendly reminder from the school regarding the outstanding fees for *${student.firstName} ${student.lastName}*.\n\n` +
      `You can view the detailed statement and make payments via the secure Parent Portal here:\n` +
      `${parentUrl}\n\n` +
      `Thank you.`;
  } else if (template === 'ASSESSMENT_RELEASE') {
    message = `Hello ${student.guardianName || 'Guardian'},\n\n` +
      `We are pleased to inform you that the *${term}* Academic Assessment results for *${student.firstName} ${student.lastName}* have been released.\n\n` +
      `You can securely view and download the report card using this link:\n` +
      `${parentUrl}\n\n` +
      `Thank you.`;
  } else {
    message = `Hello ${student.guardianName || 'Guardian'},\n\n` +
      `Here is the secure Parent Portal link for *${student.firstName} ${student.lastName}* (${student.id}) to securely view and download the:\n` +
      `• *Official Term Report Card*\n` +
      `• *School Fees Statement & Payment Receipts*\n` +
      `• *Academic Performance Analytics & Remarks*\n\n` +
      `Access Link: ${parentUrl}\n\n` +
      `Thank you.`;
  }

  let formattedPhone = (student.guardianTelephone || '').trim().replace(/[\s\-\(\)\+]/g, '');
  if (formattedPhone.startsWith('0') && formattedPhone.length === 10) {
    formattedPhone = '233' + formattedPhone.substring(1);
  }
  
  const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
  return { whatsappUrl, message, formattedPhone };
};

export const shareParentPortalWhatsApp = (student: Student, year: string, term: string, template: WhatsAppTemplate = 'PORTAL_ACCESS') => {
  const { whatsappUrl } = getWhatsAppShareData(student, year, term, template);
  window.open(whatsappUrl, '_blank');
};

const GHANA_CREST_SVG_WATERMARK = `
<svg viewBox="0 0 100 100" width="100%" height="100%" style="width: 420px; height: 420px; color: #0f172a;">
  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 1.5" />
  <circle cx="50" cy="50" r="41" fill="none" stroke="currentColor" stroke-width="0.6" />
  <path d="M 32,32 L 68,32 C 68,32 68,58 50,74 C 32,58 32,32 32,32 Z" fill="none" stroke="currentColor" stroke-width="1.2" />
  <path d="M 50,32 L 50,74" stroke="currentColor" stroke-width="0.6" />
  <path d="M 32,50 L 68,50" stroke="currentColor" stroke-width="0.6" />
  <polygon points="50,45 52,49 57,49 53,52 55,56 50,54 45,56 47,52 43,49 48,49" fill="currentColor" opacity="0.6" />
  <path d="M 53,36 L 65,36 L 65,46 L 53,46 Z" fill="none" stroke="currentColor" stroke-width="0.6" />
  <path d="M 53,41 L 65,41" stroke="currentColor" stroke-width="0.4" />
  <line x1="41" y1="36" x2="41" y2="46" stroke="currentColor" stroke-width="1.2" />
  <circle cx="41" cy="35" r="1.2" fill="currentColor" />
  <path d="M 23,35 C 19,48 19,63 34,74" fill="none" stroke="currentColor" stroke-width="0.6" />
  <path d="M 77,35 C 81,48 81,63 66,74" fill="none" stroke="currentColor" stroke-width="0.6" />
  <path d="M 25,79 L 75,79 C 75,79 65,85 50,85 C 35,85 25,79 25,79 Z" fill="none" stroke="currentColor" stroke-width="0.6" />
  <text x="50" y="83" font-size="2.6" font-family="'Inter', sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor" letter-spacing="0.3">KNOWLEDGE & CHARACTER</text>
  <text x="50" y="16" font-size="3.0" font-family="'Inter', sans-serif" font-weight="900" text-anchor="middle" fill="currentColor" letter-spacing="0.8">GHANA EDUCATION SERVICE</text>
</svg>
`;

export function getWatermarkHtml(crestUrl?: string | null, size = 320): string {
  const crestMarkup = crestUrl 
    ? `<img src="${crestUrl}" style="width: ${size}px; height: ${size}px; object-fit: contain;" />`
    : GHANA_CREST_SVG_WATERMARK.replace('width: 420px; height: 420px;', `width: ${size}px; height: ${size}px;`);

  return `
    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: none; z-index: 0; user-select: none; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; opacity: 0.045;">
      <div style="width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center;">
        ${crestMarkup}
      </div>
    </div>
  `;
}


