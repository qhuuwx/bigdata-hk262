/**
 * Card Container Component
 * High-craft institutional surface with 1px slate border, crisp header bar, and Light/Dark support.
 */

import React from 'react';

export const Card = ({ title, subtitle, action, children, className = '', noPadding = false }) => {
  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.03)] overflow-hidden flex flex-col transition-colors duration-150 ${className}`}
    >
      {(title || subtitle || action) && (
        <div className="px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4 bg-white dark:bg-slate-900">
          <div className="min-w-0">
            {title && (
              <h3 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight truncate">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5 font-normal truncate">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="flex items-center gap-2 flex-shrink-0">{action}</div>}
        </div>
      )}
      <div className={`${noPadding ? '' : 'p-5'} flex-1 flex flex-col`}>{children}</div>
    </div>
  );
};

export default Card;
