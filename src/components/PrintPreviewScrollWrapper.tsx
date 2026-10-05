import React from 'react';

interface PrintPreviewScrollWrapperProps {
  children: React.ReactNode;
  onWheel?: (e: React.WheelEvent<HTMLDivElement>) => void;
  className?: string;
}

export const PrintPreviewScrollWrapper = React.forwardRef<HTMLDivElement, PrintPreviewScrollWrapperProps>(
  ({ children, onWheel, className = '' }, ref) => {
    return (
      <div
        ref={ref}
        onWheel={onWheel}
        className={`flex-1 p-4 sm:p-8 overflow-y-auto overflow-x-auto flex justify-center items-start w-full min-h-0 bg-slate-950/95 custom-scrollbar-visible ${className}`}
      >
        {children}
      </div>
    );
  }
);

PrintPreviewScrollWrapper.displayName = 'PrintPreviewScrollWrapper';
