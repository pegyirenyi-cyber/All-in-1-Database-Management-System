import { Phone, Mail, Award, CheckCircle2 } from 'lucide-react';
// @ts-ignore
import geetechLogo from '../assets/images/geetech_new_logo_1782900372763.jpg';

export default function DeveloperStatus({ isAutoSaveActive = true, hasUnsavedChanges = false, onSave }: { isAutoSaveActive?: boolean; hasUnsavedChanges?: boolean; onSave?: () => void }) {
  return (
    <footer id="developer-status-bar" className="w-full bg-slate-900 text-slate-100 border-t border-slate-800 text-xs py-2 px-4 shadow-inner no-print">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 font-mono">
        
        {/* Developer Profile Section */}
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <img 
              src={geetechLogo} 
              alt="GEETECH MULTIMEDIA" 
              className="w-8 h-8 rounded-full border border-slate-700 object-contain shadow-sm bg-white p-0.5"
              onError={(e) => {
                // If there's ever a fallback error, render an inline custom SVG to prevent a broken image
                const target = e.currentTarget;
                target.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><circle cx='20' cy='20' r='18' fill='%230f172a' stroke='%2338bdf8' stroke-width='2'/><text x='20' y='25' font-size='14' text-anchor='middle' fill='%2338bdf8' font-family='monospace'>GT</text></svg>";
              }}
            />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse"></span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-200 tracking-wide">EGYIRENYI PAUL</span>
              <span className="text-slate-500 font-sans">|</span>
              <span className="text-amber-400 font-sans uppercase font-semibold text-[10px] tracking-widest bg-amber-950/40 px-1 rounded">GEETECH MULTIMEDIA</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-slate-400 text-[10px]">
              <span className="flex items-center gap-1">
                <Phone size={10} className="text-cyan-400" /> 0544052717
              </span>
              <span className="flex items-center gap-1">
                <Mail size={10} className="text-cyan-400" /> pegyirenyi@gmail.com
              </span>
            </div>
          </div>
        </div>

        {/* Real-time Status Engines */}
        <div className="flex items-center flex-wrap gap-4 text-[11px] text-slate-300">


          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-emerald-400 font-sans text-[10px] uppercase tracking-wide bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/40">
              <CheckCircle2 size={11} className="text-emerald-400" /> All Data Synced Live
            </span>
          </div>

          <div id="status-copyright" className="text-slate-500 text-[10px]">
            &copy; {new Date().getFullYear()} GTM
          </div>
        </div>

      </div>
    </footer>
  );
}
