/**
 * Badge Component
 * Restrained semantic status pills with optional status dot and Dark Mode support.
 */

import React from 'react';

export const Badge = ({ children, variant = 'default', dot = false, className = '' }) => {
  const variantStyles = {
    default: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    healthy: 'bg-emerald-50/80 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200/90 dark:border-emerald-800/80',
    low: 'bg-amber-50/80 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200/90 dark:border-amber-800/80',
    over: 'bg-rose-50/80 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200/90 dark:border-rose-800/80',
    urgent: 'bg-rose-50 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800 font-semibold',
    warning: 'bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 font-semibold',
    blue: 'bg-blue-50/80 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200/90 dark:border-blue-800/80'
  };

  const dotColors = {
    default: 'bg-slate-400',
    healthy: 'bg-emerald-500',
    low: 'bg-amber-500',
    over: 'bg-rose-500',
    urgent: 'bg-rose-500',
    warning: 'bg-amber-500',
    blue: 'bg-blue-500'
  };

  const style = variantStyles[variant] || variantStyles.default;
  const dotColor = dotColors[variant] || dotColors.default;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium tracking-tight border whitespace-nowrap flex-shrink-0 ${style} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />}
      {children}
    </span>
  );
};

export default Badge;
