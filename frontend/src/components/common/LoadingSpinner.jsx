/**
 * Loading Spinner Component
 */

import React from 'react';

export const LoadingSpinner = ({ text = 'Đang tải dữ liệu...', size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4'
  };

  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-500">
      <div
        className={`${sizeClasses[size] || sizeClasses.md} rounded-full border-sky-500 border-t-transparent animate-spin`}
      />
      {text && <span className="text-xs font-medium text-slate-500">{text}</span>}
    </div>
  );
};

export default LoadingSpinner;
