/**
 * Badge Component
 * Restrained semantic status pills with optional status dot.
 */

import React from 'react';

export const Badge = ({ children, variant = 'default', dot = false, className = '' }) => {
  const variantStyles = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    healthy: 'bg-emerald-50/80 text-emerald-800 border-emerald-200/90',
    low: 'bg-amber-50/80 text-amber-800 border-amber-200/90',
    over: 'bg-rose-50/80 text-rose-800 border-rose-200/90',
    urgent: 'bg-rose-50 text-rose-800 border-rose-200 font-semibold',
    warning: 'bg-amber-50 text-amber-800 border-amber-200 font-semibold',
    blue: 'bg-blue-50/80 text-blue-800 border-blue-200/90'
  };

  const dotColors = {
    default: 'bg-slate-400',
    healthy: 'bg-emerald-600',
    low: 'bg-amber-600',
    over: 'bg-rose-600',
    urgent: 'bg-rose-600',
    warning: 'bg-amber-500',
    blue: 'bg-blue-600'
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
