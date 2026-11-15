/**
 * Card Container Component
 * Standardizes card layouts with title, subtitle, action buttons, and content area.
 */

import React from 'react';

export const Card = ({ title, subtitle, action, children, className = '' }) => {
  return (
    <div className={`bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col ${className}`}>
      {(title || subtitle || action) && (
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/50">
          <div>
            {title && <h3 className="text-base font-semibold text-slate-800 tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      <div className="p-6 flex-1 flex flex-col">{children}</div>
    </div>
  );
};

export default Card;
