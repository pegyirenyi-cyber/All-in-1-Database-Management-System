import React from 'react';

export function DefaultCrest({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M32 4L8 14V34C8 46.8 18.2 56.4 32 60C45.8 56.4 56 46.8 56 34V14L32 4Z" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M32 18V42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M22 26C22 26 26 23 32 23C38 23 42 26 42 26" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M22 34C22 34 26 31 32 31C38 31 42 34 42 34" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M32 12C32 12 30 15 32 17C34 19 32 21 32 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
