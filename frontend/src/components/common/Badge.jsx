/**
 * Badge Component
 * Displays styled status tags (Healthy, Low Stock, Overstock, Urgency).
 */

import React from 'react';

export const Badge = ({ children, variant = 'default', className = '' }) => {
  const variantStyles = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    healthy: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    low: 'bg-orange-50 text-orange-700 border-orange-200',
    over: 'bg-rose-50 text-rose-700 border-rose-200',
    urgent: 'bg-red-100 text-red-800 border-red-300 font-semibold',
    warning: 'bg-amber-100 text-amber-800 border-amber-300 font-semibold',
    blue: 'bg-sky-50 text-sky-700 border-sky-200'
  };

  const style = variantStyles[variant] || variantStyles.default;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wider uppercase border ${style} ${className}`}>
      {children}
    </span>
  );
};

export default Badge;
