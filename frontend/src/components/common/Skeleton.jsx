/**
 * Institutional Layout-Matched Skeleton Loaders
 * Eliminates layout shift during asynchronous data fetches in both Light and Dark modes.
 */

import React from 'react';

export const SkeletonChart = ({ height = 250, variant = 'line' }) => {
  return (
    <div
      style={{ height: `${height}px` }}
      className="w-full flex flex-col justify-between p-2 animate-pulse select-none"
    >
      {/* Top Legend Bar Placeholder */}
      <div className="flex items-center justify-end gap-3">
        <div className="h-2.5 w-24 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-2.5 w-20 rounded bg-slate-200 dark:bg-slate-800" />
      </div>

      {/* Main Chart Body Placeholder */}
      {variant === 'doughnut' ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-36 h-36 rounded-full border-[14px] border-slate-200 dark:border-slate-800" />
        </div>
      ) : (
        <div className="flex-1 flex items-end gap-2.5 pt-4 pb-2 px-2 border-b border-l border-slate-200 dark:border-slate-800 my-2">
          {[48, 72, 58, 86, 65, 92, 74, 81, 60, 88].map((pct, i) => (
            <div
              key={i}
              style={{ height: `${pct}%` }}
              className="flex-1 rounded-t bg-slate-200/80 dark:bg-slate-800/90"
            />
          ))}
        </div>
      )}

      {/* X-Axis Labels Placeholder */}
      <div className="flex items-center justify-between px-2">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n} className="h-2 w-10 rounded bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
    </div>
  );
};

export const SkeletonTable = ({ rows = 6, cols = 6 }) => {
  return (
    <div className="w-full animate-pulse select-none">
      <div className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between gap-4">
        {Array.from({ length: cols }).map((_, idx) => (
          <div key={idx} className="h-2.5 flex-1 rounded bg-slate-200 dark:bg-slate-700" />
        ))}
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="px-4 py-3 flex items-center justify-between gap-4">
            {Array.from({ length: cols }).map((__, cIdx) => (
              <div
                key={cIdx}
                className={`h-2.5 flex-1 rounded bg-slate-200/75 dark:bg-slate-800 ${
                  cIdx === 0 ? 'max-w-[70px]' : ''
                }`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export const SkeletonCard = ({ title = true, height = 250, variant = 'line' }) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.03)] overflow-hidden flex flex-col">
      {title && (
        <div className="px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-800 animate-pulse space-y-2">
          <div className="h-3.5 w-48 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-2.5 w-72 rounded bg-slate-100 dark:bg-slate-800/70" />
        </div>
      )}
      <div className="p-5 flex-1">
        <SkeletonChart height={height} variant={variant} />
      </div>
    </div>
  );
};

export default {
  SkeletonChart,
  SkeletonTable,
  SkeletonCard
};
