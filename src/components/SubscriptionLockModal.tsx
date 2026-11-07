import { useState, useEffect, FormEvent } from 'react';
import { motion } from 'framer-motion';
import { DbController } from '../db';
import { UserAccount, PlatformPricing } from '../types';
import { 
  evaluateSubscription, 
  getContactAdminLinks, 
  generateActivationCode 
} from '../subscription';
import { 
  Lock, Mail, Phone, KeyRound, ArrowRightLeft, ShieldAlert, CheckCircle2, LogOut, CreditCard 
} from 'lucide-react';

interface SubscriptionLockModalProps {
  user: UserAccount;
  onUnlocked: (updatedUser: UserAccount) => void;
  onLogout: () => void;
  onShowBilling: () => void;
}

export default function SubscriptionLockModal({ user, onUnlocked, onLogout, onShowBilling }: SubscriptionLockModalProps) {
  const [activationInput, setActivationInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [platformPricing, setPlatformPricing] = useState<PlatformPricing>(() => DbController.getPlatformPricing());

  useEffect(() => {
    const handlePlatformPricingUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      const newPricing = customEvent.detail || DbController.getPlatformPricing();
      setPlatformPricing(newPricing);
    };
    window.addEventListener('platform-pricing-updated', handlePlatformPricingUpdated);
    window.addEventListener('school-updated', handlePlatformPricingUpdated);
    return () => {
      window.removeEventListener('platform-pricing-updated', handlePlatformPricingUpdated);
      window.removeEventListener('school-updated', handlePlatformPricingUpdated);
    };
  }, []);

  const status = evaluateSubscription(user);
  if (!status) return null;

  const { requestCode, isTrial } = status;
  const adminLinks = getContactAdminLinks(user.email, requestCode);

  const handleActivationSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsVerifying(true);

    try {
      const cleanInput = activationInput.trim().toUpperCase();

      if (DbController.isCodeUsed(cleanInput)) {
        setErrorMsg("This activation code has already been redeemed and cannot be reused. Each renewal code is strictly valid for ONE-TIME use. Please contact Admin for a new code.");
        setIsVerifying(false);
        return;
      }

      const expectedCodeByEmail = generateActivationCode(user.email, requestCode);
      const expectedCodeByUid = user.uid ? generateActivationCode(user.uid, requestCode) : '';

      if (cleanInput === expectedCodeByEmail || (expectedCodeByUid && cleanInput === expectedCodeByUid)) {
        // Correct key! Record code as used & generate fresh rotated request code
        DbController.recordUsedCode(cleanInput, user.email || user.uid);
        const emailPrefix = user.email ? user.email.split('@')[0].substring(0, 4).toUpperCase() : 'USER';
        const freshReqCode = `REQ-${emailPrefix}-${Math.floor(1000 + Math.random() * 9000)}`;

        const updated = await DbController.updateUserLicense(
          user.uid,
          'activated',
          new Date().toISOString(), // lastActivatedOn = now
          cleanInput,
          freshReqCode,
          1
        );
        
        setSuccess(true);
        setTimeout(() => {
          onUnlocked(updated);
        }, 1800);
      } else {
        setErrorMsg("Incorrect activation code. Please contact Admin at pegyirenyi@gmail.com or 0544052717 for a valid code.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Failed to verify code. Please check your network or try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 20 }}
        className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative space-y-6 text-slate-100 my-8"
      >
        {/* Lock header */}
        <div className="text-center space-y-2">
          {success ? (
            <motion.div 
              initial={{ scale: 0.5 }}
              animate={{ scale: [1, 1.2, 1] }}
              className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto"
            >
              <CheckCircle2 size={32} className="animate-bounce" />
            </motion.div>
          ) : (
            <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/25 text-amber-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
              <Lock size={26} />
            </div>
          )}
          
          <h2 className="text-xl font-black tracking-tight text-amber-400 uppercase font-sans">
            {success ? "License Unlocked!" : isTrial ? "7-Day Free Trial Ended" : user.licenseType === 'activated' ? "License Renewal Required" : "License Activation Required"}
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            {success 
              ? "Your license has been verified. Welcome back to GEETECH Multimedia!"
              : isTrial
                ? "Your 7-day free trial period has concluded. Please activate your school database license (1, 2, 3, or 5 years) to continue using the system."
                : user.licenseType === 'activated'
                  ? "Your school database license has completed its academic period. Please purchase a renewal license (1, 2, 3, or 5 years) to continue."
                  : "An active school database license (1, 2, 3, or 5 years) is required to access the system. Please activate your license to proceed."
            }
          </p>
        </div>

        {success ? (
          <div className="py-6 text-center space-y-3">
            <p className="text-sm text-emerald-400 font-bold font-mono">Initializing Academic Workspace...</p>
            <div className="text-xs text-slate-500 font-mono">Storing secure offline signature token</div>
          </div>
        ) : (
          <>
            {/* Account Metadata Detail Card */}
            <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4.5 space-y-3.5 text-xs font-sans">
              <div className="flex justify-between border-b border-slate-900 pb-2">
                <span className="text-slate-500">Active Account</span>
                <span className="font-mono font-bold text-slate-300 truncate max-w-[180px]">{user.email}</span>
              </div>
              <div className="flex justify-between border-b border-slate-900 pb-2">
                <span className="text-slate-500">System Request Code</span>
                <span className="font-mono font-extrabold text-amber-400 tracking-wider bg-amber-950/20 px-2 py-0.5 rounded border border-amber-900/20">{requestCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Status</span>
                <span className="text-rose-400 font-bold uppercase tracking-wider text-[10px]">{isTrial ? "Trial Ended / License Required" : "Expired / Locked"}</span>
              </div>
            </div>

            {/* Quick-action support links */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Renewal Pricing Tiers</span>
                <span className="text-[9px] text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40 font-mono">Live Rates</span>
              </div>

              {/* Official Admin Renewal Rates Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2">
                  <span className="block text-[9px] font-mono font-bold text-slate-400 uppercase">1 Year</span>
                  <strong className="block text-xs font-black font-mono text-slate-100">GHS {platformPricing.licensePrice1Year}</strong>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2">
                  <span className="block text-[9px] font-mono font-bold text-slate-400 uppercase">2 Years</span>
                  <strong className="block text-xs font-black font-mono text-emerald-400">GHS {platformPricing.licensePrice2Year}</strong>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2">
                  <span className="block text-[9px] font-mono font-bold text-slate-400 uppercase">3 Years</span>
                  <strong className="block text-xs font-black font-mono text-indigo-400">GHS {platformPricing.licensePrice3Year}</strong>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2">
                  <span className="block text-[9px] font-mono font-bold text-slate-400 uppercase">5 Years</span>
                  <strong className="block text-xs font-black font-mono text-amber-400">GHS {platformPricing.licensePrice5Year}</strong>
                </div>
              </div>
              
              <button 
                onClick={onShowBilling}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl transition shadow-lg shadow-emerald-900/20 active:scale-[0.98] cursor-pointer group"
              >
                <CreditCard size={18} className="group-hover:rotate-12 transition-transform" />
                Buy Subscription / Renew Online
              </button>

              <div className="relative py-2 flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Or</span>
                <div className="flex-1 h-px bg-slate-800" />
              </div>

              <span className="block text-[10px] text-slate-500 font-mono uppercase tracking-wider text-center">Contact GEETECH Admin</span>
              
              <div className="grid grid-cols-2 gap-3.5">
                <a 
                  href={adminLinks.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 py-2 px-3 bg-teal-600/10 hover:bg-teal-600/20 border border-teal-500/20 hover:border-teal-500/40 text-teal-400 font-bold text-xs rounded-xl transition text-center"
                >
                  <Phone size={14} className="text-teal-400" />
                  Chat on WhatsApp
                </a>
                <a 
                  href={adminLinks.mailtoUrl}
                  className="flex items-center justify-center gap-2 py-2 px-3 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 hover:border-indigo-500/40 text-indigo-400 font-bold text-xs rounded-xl transition text-center"
                >
                  <Mail size={14} className="text-indigo-400" />
                  Request via Email
                </a>
              </div>

              <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl space-y-1 text-center">
                <p className="text-[10px] text-slate-400 leading-normal">
                  Renewal Hotline: <strong className="text-slate-200">0544052717</strong> or email <strong className="text-slate-200">pegyirenyi@gmail.com</strong>
                </p>
              </div>
            </div>

            {/* Enter Activation Code Form */}
            <form onSubmit={handleActivationSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5 font-mono">
                  Enter License Activation Code
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-3 text-slate-500" size={15} />
                  <input 
                    type="text"
                    required
                    placeholder="e.g. SEC-XXX-XXXXXX"
                    value={activationInput}
                    onChange={(e) => setActivationInput(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 border border-slate-800 focus:border-amber-500 rounded-xl bg-slate-950 text-slate-100 placeholder-slate-700 uppercase tracking-widest text-center font-mono focus:outline-none transition"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-950/40 border border-rose-900/30 text-rose-400 rounded-xl text-xs flex gap-2">
                  <ShieldAlert size={16} className="text-rose-400 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isVerifying || !activationInput}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 hover:text-white font-extrabold rounded-xl transition duration-200 shadow-lg cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 text-xs tracking-wider uppercase font-sans"
              >
                {isVerifying ? "Validating License..." : "Activate App License"}
              </button>
            </form>
          </>
        )}

        {/* System escape hatches / logout backup */}
        <div className="border-t border-slate-850 pt-4 flex justify-between items-center text-[11px]">
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition duration-150 cursor-pointer"
          >
            <LogOut size={13} />
            Log Out Account
          </button>
          <span className="text-slate-600 font-mono">GEETECH OS v3.2</span>
        </div>
      </motion.div>
    </div>
  );
}
