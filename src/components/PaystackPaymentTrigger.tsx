import React, { useState, useEffect, useRef } from 'react';
import { CreditCard, Loader2, ExternalLink, ShieldCheck, RefreshCw, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';

async function fetchJsonSafe(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  const text = await res.text();
  
  if (!text) {
    throw new Error(`Empty response received from server (Status: ${res.status})`);
  }
  
  try {
    const data = JSON.parse(text);
    return { res, data };
  } catch (err) {
    if (text.startsWith('<!doctype') || text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
      throw new Error(`Server returned HTML instead of JSON. The backend might still be starting up or experiencing configuration issues (Status: ${res.status} - ${res.statusText}).`);
    }
    throw new Error(`Invalid JSON response (Status: ${res.status}): ${text.substring(0, 100)}...`);
  }
}

interface PaystackPaymentTriggerProps {
  studentId: string;
  studentName: string;
  email: string;
  amount: number;
  academicYear: string;
  term: string;
  component: 'School Fees' | 'Utility Bill' | 'Sports Fees' | 'PTA dues' | 'Transportation Bill' | 'Other Fee' | 'License' | 'SMS' | (string & {});
  billId: string;
  onSuccess: (txData: any) => void;
  onCancel?: () => void;
  triggerLabel?: string;
  btnClassName?: string;
  paymentType: 'admin' | 'fees';
}

export default function PaystackPaymentTrigger({
  studentId,
  studentName,
  email,
  amount,
  academicYear,
  term,
  component,
  billId,
  onSuccess,
  onCancel,
  triggerLabel = "Pay via Paystack",
  btnClassName = "",
  paymentType
}: PaystackPaymentTriggerProps) {
  const [loading, setLoading] = useState(false);
  const [errorError, setErrorError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [txReference, setTxReference] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [manualReference, setManualReference] = useState('');
  const [manualVerifying, setManualVerifying] = useState(false);
  const [gatewayConfig, setGatewayConfig] = useState<{ mode: 'test' | 'live'; publicKey: string } | null>(null);

  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load gateway config on mount to verify environment mode (Sandbox vs Live)
  useEffect(() => {
    fetch('/api/payments/config')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setGatewayConfig({ mode: data.mode, publicKey: data.publicKey });
        }
      })
      .catch(err => console.error("[Checkout Config] Could not load active Paystack mode config.", err));
  }, []);

  // Clear any timers on unmount
  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, []);

  // Poll Paystack verification backend endpoint
  const checkPaymentStatus = async (refToCheck: string, quiet = true) => {
    if (!quiet) setCheckingStatus(true);
    try {
      const { res, data } = await fetchJsonSafe(`/api/payments/verify/${refToCheck}?paymentType=${paymentType}&studentId=${encodeURIComponent(studentId)}`);
      
      if (res.ok && data.success) {
        if (data.status === 'success') {
          // Success! Clear polling and credit payment
          if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
          setPaymentVerified(true);
          setCheckoutUrl(null);
          
          // Execute callback
          onSuccess(data.data);
        } else if (data.status === 'failed') {
          setErrorError("The transaction was marked as failed by Paystack.");
          if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
        }
      }
    } catch (err) {
      console.error("Error polling payment status:", err);
    } finally {
      if (!quiet) setCheckingStatus(false);
    }
  };

  const startPolling = (ref: string) => {
    // Clear any existing pollers
    if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    
    // Poll every 4 seconds to avoid hitting rate limits while being highly responsive
    pollingTimerRef.current = setInterval(() => {
      checkPaymentStatus(ref, true);
    }, 4000);
  };

  const handleInitPayment = async () => {
    setLoading(true);
    setErrorError(null);
    setCheckoutUrl(null);
    setTxReference(null);

    const safeEmail = email && email.trim() !== '' ? email : `${studentId.toLowerCase()}@school.edu`;

    try {
      const { res, data: result } = await fetchJsonSafe('/api/payments/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: safeEmail,
          amount,
          studentId,
          billId,
          component,
          academicYear,
          term,
          paymentType
        })
      });

      if (!res.ok || !result.success) {
        throw new Error(result.message || "Failed to initialize handshake with Paystack engine.");
      }

      const { authorization_url, reference } = result.data;
      setCheckoutUrl(authorization_url);
      setTxReference(reference);
      
      // Auto-attempt to open the window
      const newWin = window.open(authorization_url, '_blank');
      if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
        console.warn("Popup blocked. Instructing user to click manual checkout link.");
      }

      // Start watching the status
      startPolling(reference);

    } catch (err: any) {
      console.error("Initialization error:", err);
      setErrorError(err.message || "Could not spin up payment gateway transaction.");
    } finally {
      setLoading(false);
    }
  };

  const handleManualVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualReference.trim()) return;

    setManualVerifying(true);
    setErrorError(null);
    try {
      const { res, data } = await fetchJsonSafe(`/api/payments/verify/${manualReference.trim()}?paymentType=${paymentType}&studentId=${encodeURIComponent(studentId)}`);
      
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Verification endpoint rejected code format.");
      }

      if (data.status === 'success') {
        setPaymentVerified(true);
        onSuccess(data.data);
      } else {
        setErrorError(`Transaction state: ${data.status.toUpperCase()} (unsettled on Paystack ledger)`);
      }
    } catch (err: any) {
      setErrorError(err.message || "Reconciliation failed. Please confirm transaction reference ID.");
    } finally {
      setManualVerifying(false);
    }
  };

  return (
    <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 font-sans text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center">
            <CreditCard size={15} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">Paystack Checkout Gateway</h4>
            <p className="text-[10px] text-slate-400">Settle invoices instantly with card, mobile money (MoMo), or bank transfers</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-[9px] uppercase tracking-wider bg-emerald-50 border border-emerald-200/50 font-bold text-emerald-700 px-1.5 py-0.5 rounded-sm">
            Ghana / West Africa
          </span>
          <span className={`text-[8px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-sm border ${
            gatewayConfig?.mode === 'live'
              ? 'bg-emerald-50 border-emerald-250 text-emerald-700 font-black'
              : 'bg-amber-50 border-amber-250 text-amber-700 font-black'
          }`}>
            {gatewayConfig?.mode === 'live' ? '● Live' : '⌛ Sandbox'}
          </span>
        </div>
      </div>

      <div className="bg-white border border-slate-150 p-4 rounded-lg space-y-2.5">
        <div className="flex justify-between items-center text-slate-650">
          <span className="font-semibold text-[11px]">Fee Category Component:</span>
          <span className="font-bold font-mono text-slate-800">{component}</span>
        </div>
        <div className="flex justify-between items-center text-slate-650">
          <span className="font-semibold text-[11px]">Enrolled Student:</span>
          <span className="font-bold text-slate-800">{studentName} ({studentId})</span>
        </div>
        <div className="flex justify-between items-center text-slate-650">
          <span className="font-semibold text-[11px]">Billing Session:</span>
          <span className="font-bold text-slate-700">{term} ({academicYear})</span>
        </div>
        <div className="h-[1px] bg-slate-100 my-1"></div>
        <div className="flex justify-between items-center text-slate-650">
          <span className="font-bold text-slate-800 text-[12px]">Amount due for collection:</span>
          <span className="font-black text-emerald-700 text-sm">GHS {amount.toFixed(2)}</span>
        </div>
      </div>

      {errorError && (
        <div className="p-3 bg-rose-50 text-rose-800 border border-rose-100 rounded-lg flex items-start gap-2 max-w-full">
          <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="font-bold">Payment Error Occurred</p>
            <p className="text-[10px]/normal text-rose-700 font-medium">{errorError}</p>
          </div>
        </div>
      )}

      {paymentVerified ? (
        <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-xl text-center space-y-2">
          <CheckCircle2 size={32} className="mx-auto text-emerald-600 animate-bounce" />
          <h5 className="font-black text-sm text-emerald-950">Payment Settled Successfully</h5>
          <p className="text-[11px] text-emerald-700/90 leading-relaxed">
            The school account ledgers have been credited with <strong>GHS {amount.toFixed(2)}</strong>. You can print the formal receipt statement from the receipts ledger dashboard.
          </p>
        </div>
      ) : checkoutUrl ? (
        <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl space-y-4">
          <div className="flex items-center gap-3">
            <Loader2 size={20} className="text-indigo-650 animate-spin flex-shrink-0" />
            <div className="space-y-0.5">
              <h5 className="font-bold text-indigo-950 text-xs">Awaiting Paystack Checkout Confirmation...</h5>
              <p className="text-[10px] text-indigo-700">Reference Key: <strong className="font-mono">{txReference}</strong></p>
            </div>
          </div>
          
          <p className="text-[11px] text-slate-600 leading-relaxed">
            If the paystack checkout window was blocked by your browser settings, please click the secure button below to load Paystack's safe encryption gateway.
          </p>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <a 
              href={checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-center cursor-pointer transition shadow-sm"
              id="paystack-redirect-link"
            >
              <ExternalLink size={14} /> Open Secure Checkout
            </a>

            <button
              type="button"
              onClick={() => {
                if (txReference) checkPaymentStatus(txReference, false);
              }}
              disabled={checkingStatus}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-lg font-sans cursor-pointer transition"
            >
              <RefreshCw size={14} className={checkingStatus ? "animate-spin" : ""} />
              {checkingStatus ? 'Verifying...' : 'Verify Status'}
            </button>
          </div>

          <div className="text-[10px] text-slate-400 italic text-center">
            Do not reload or navigate away from this tab until the transaction verification finishes.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={loading || amount <= 0}
            onClick={handleInitPayment}
            className={`w-full py-2.5 px-4 font-black transition flex items-center justify-center gap-2 rounded-xl text-xs cursor-pointer shadow-md select-none ${
              amount <= 0 
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white active:translate-y-0.5 ' + btnClassName
            }`}
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Spawning Secure Paystack Handshake...
              </>
            ) : (
              <>
                <ShieldCheck size={15} />
                {triggerLabel}
              </>
            )}
          </button>
          
          <div className="border-t border-dashed border-slate-200 pt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setManualReference(manualReference ? '' : ' ')}
              className="text-[10px] hover:underline text-slate-400 font-semibold self-center flex items-center gap-1 cursor-pointer"
            >
              <HelpCircle size={11} /> Had payment issues? Manual reconciliation options here
            </button>
            
            {manualReference !== '' && (
              <form onSubmit={handleManualVerify} className="flex gap-2 animate-fadeIn">
                <input 
                  type="text"
                  required
                  placeholder="Enter Paystack Ref ID (e.g., PAYSTACK_1234)"
                  value={manualReference}
                  onChange={(e) => setManualReference(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-slate-300 rounded font-mono text-[10px] uppercase placeholder-slate-450 bg-white"
                />
                <button
                  type="submit"
                  disabled={manualVerifying}
                  className="px-3 py-1.5 bg-slate-700 text-white hover:bg-slate-800 rounded font-bold cursor-pointer transition flex items-center gap-1 text-[10px]"
                >
                  {manualVerifying ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                  Validate
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {onCancel && !checkoutUrl && !paymentVerified && (
        <div className="text-center pt-1 no-print">
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 font-semibold text-[10px] transition cursor-pointer underline hover:no-underline"
          >
            Back to payment choices
          </button>
        </div>
      )}
    </div>
  );
}
