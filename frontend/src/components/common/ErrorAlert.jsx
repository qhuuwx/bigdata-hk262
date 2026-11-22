/**
 * Error Alert Component
 */

import React from 'react';

export const ErrorAlert = ({ message, onRetry }) => {
  return (
    <div className="bg-rose-50/80 border border-rose-200 rounded-lg px-4 py-3 flex items-center justify-between gap-4 text-rose-800">
      <div className="flex items-center gap-2.5 min-w-0">
        <svg className="w-4 h-4 text-rose-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div className="min-w-0">
          <h4 className="text-xs font-semibold text-rose-900">Lỗi truy xuất dữ liệu</h4>
          <p className="text-xs text-rose-700 mt-0.5 truncate">{message || 'Không thể kết nối tới máy chủ phân tích'}</p>
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-2.5 py-1 bg-white border border-rose-300 hover:bg-rose-100 text-rose-800 rounded text-xs font-medium transition-colors flex-shrink-0"
        >
          Thử lại
        </button>
      )}
    </div>
  );
};

export default ErrorAlert;
