import React, { useState, useEffect, useRef } from 'react';

type SmartTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  value: string;
  onChange: (e: any) => void;
  onValueChange?: (value: string) => void;
};

export default function SmartTextarea({ value, onChange, onValueChange, className, ...props }: SmartTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [spellCheckResults, setSpellCheckResults] = useState<{
    errors: Array<{ word: string; suggestions: string[] }>;
    correctedText: string;
  } | null>(null);
  const [hasChecked, setHasChecked] = useState(false);
  const [autoCheck, setAutoCheck] = useState(true);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e);
    if (onValueChange) {
      onValueChange(e.target.value);
    }
  };

  const updateValue = (newValue: string) => {
    if (onValueChange) {
      onValueChange(newValue);
    } else {
      // Simulate event if only onChange is provided
      const event = {
        target: { value: newValue }
      } as React.ChangeEvent<HTMLTextAreaElement>;
      onChange(event);
    }
  };

  const handleSpellCheck = async () => {
    if (!value.trim()) {
      setSpellCheckResults(null);
      setHasChecked(false);
      return;
    }
    setIsChecking(true);
    try {
      const res = await fetch('/api/spellcheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: value })
      });
      if (res.ok) {
        const data = await res.json();
        setSpellCheckResults(data);
        setHasChecked(true);
      } else {
        console.error("Failed to fetch spelling check");
      }
    } catch (e) {
      console.error("Spelling check error", e);
    } finally {
      setIsChecking(false);
    }
  };

  const applyCorrection = (word: string, replacement: string) => {
    // Basic replacement for the grammar/spelling error
    // Uses regex to find the exact word/phrase boundary
    // Escape special regex characters in word
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedWord}\\b`, 'g');
    
    // If word has no word boundaries (e.g. punctuation), just string replace
    const newValue = /\w/.test(word) ? value.replace(regex, replacement) : value.replace(word, replacement);
    
    updateValue(newValue);
    
    if (spellCheckResults) {
      setSpellCheckResults({
        ...spellCheckResults,
        errors: spellCheckResults.errors.filter(err => err.word !== word)
      });
    }
  };

  const applyAllCorrections = () => {
    if (spellCheckResults?.correctedText) {
      updateValue(spellCheckResults.correctedText);
      setSpellCheckResults({
        errors: [],
        correctedText: spellCheckResults.correctedText
      });
    }
  };

  useEffect(() => {
    if (!autoCheck) {
      setSpellCheckResults(null);
      setHasChecked(false);
      return;
    }
    
    if (!value.trim()) {
      setSpellCheckResults(null);
      setHasChecked(false);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      handleSpellCheck();
    }, 1500);

    return () => clearTimeout(delayDebounceFn);
  }, [value, autoCheck]);

  return (
    <div className="relative flex flex-col w-full">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleTextChange}
        spellCheck="true"
        className={className}
        {...props}
      />
      
      {/* Grammar & Spelling Feedback Inline Panel */}
      {(isChecking || (hasChecked && spellCheckResults)) && (
        <div className="mt-1 bg-white border border-indigo-100 rounded-lg p-2.5 text-xs shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${isChecking ? 'bg-indigo-500 animate-pulse' : 'bg-emerald-500'}`} />
                AI Grammar & Spelling
              </span>
              <label className="flex items-center gap-1 cursor-pointer select-none ml-2 border-l border-slate-200 pl-2">
                <input
                  type="checkbox"
                  checked={autoCheck}
                  onChange={(e) => setAutoCheck(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3 h-3 cursor-pointer"
                />
                <span className="text-[9px] font-semibold text-slate-500">Auto-check</span>
              </label>
            </div>
            
            <div className="flex items-center gap-2">
              {!isChecking && (
                <button
                  type="button"
                  onClick={handleSpellCheck}
                  className="text-[9px] text-indigo-600 hover:text-indigo-800 font-semibold transition"
                >
                  Re-check
                </button>
              )}
              {spellCheckResults && spellCheckResults.errors && spellCheckResults.errors.length > 0 && (
                <button
                  type="button"
                  onClick={applyAllCorrections}
                  className="text-[9px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-1 rounded font-bold transition flex items-center gap-1"
                >
                  ✨ Fix All
                </button>
              )}
            </div>
          </div>

          {isChecking && !spellCheckResults && (
            <div className="text-slate-500 italic text-[11px] flex items-center gap-1.5 py-1">
              Analyzing grammar and spelling...
            </div>
          )}

          {spellCheckResults && !isChecking && (
            <div>
              {spellCheckResults.errors && spellCheckResults.errors.length > 0 ? (
                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-1">
                  {spellCheckResults.errors.map((err, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-[11px] text-slate-700 bg-slate-50 p-1 rounded border border-slate-200">
                      <span className="text-red-600 font-medium line-through px-1">{err.word}</span>
                      <span className="text-slate-400">→</span>
                      <div className="flex items-center gap-1">
                        {err.suggestions.map((sug, sIdx) => (
                          <button
                            key={sIdx}
                            type="button"
                            onClick={() => applyCorrection(err.word, sug)}
                            className="bg-white hover:bg-indigo-50 text-indigo-700 border border-slate-200 hover:border-indigo-300 px-1.5 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer shadow-sm"
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-emerald-600 font-medium text-[10px] flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  Text looks good!
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
