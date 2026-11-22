/**
 * Loading Spinner Component
 */

import React from 'react';

export const LoadingSpinner = ({ text = 'Đang tải dữ liệu...', size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-2'
  };

  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2.5 text-slate-500">
      <div
        className={`${sizeClasses[size] || sizeClasses.md} rounded-full border-slate-300 border-t-blue-600 animate-spin`}
      />
      {text && <span className="text-xs font-medium text-slate-500">{text}</span>}
    </div>
  );
};

export default LoadingSpinner;
