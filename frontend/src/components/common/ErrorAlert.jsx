/**
 * Error Alert Component
 * Displays a friendly error banner with optional Retry button.
 */

import React from 'react';

export const ErrorAlert = ({ message, onRetry }) => {
  return (
    <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex items-center justify-between gap-4 text-rose-700">
      <div className="flex items-center gap-3">
        <div>
          <h4 className="text-sm font-semibold">Đã xảy ra lỗi</h4>
          <p className="text-xs text-rose-600 mt-0.5">{message || 'Không thể tải dữ liệu'}</p>
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-3 py-1.5 bg-white border border-rose-300 hover:bg-rose-100 text-rose-700 rounded text-xs font-medium transition-colors shadow-sm"
        >
          Thử lại
        </button>
      )}
    </div>
  );
};

export default ErrorAlert;
