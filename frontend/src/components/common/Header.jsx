/**
 * Top Application Header
 * Displays active analytical module context, Command Palette (Cmd+K) launcher,
 * Light/Dark institutional theme switcher, and real-time RAM engine telemetry.
 */

import React from 'react';
import { useApp } from '../../context/AppContext';

export const Header = () => {
  const {
    activeTab,
    theme,
    toggleTheme,
    openCommandPalette,
    backendStatus,
    backendMeta
  } = useApp();

  const tabMeta = {
    'tab-eda': {
      section: '01 / EDA & STREAMING',
      title: 'Khám phá Dữ liệu & Luồng Giao dịch',
      subtitle: 'Luồng sự kiện SSE thời gian thực (2s) và bộ lọc đa chiều trên 125.751 giao dịch'
    },
    'tab-forecast': {
      section: '02 / DEMAND FORECASTING',
      title: 'Dự báo Nhu cầu Bán lẻ',
      subtitle: 'Đối chiếu mô hình Trung bình trượt (SMA, N=4) và Trọng số kết hợp Mùa vụ (WMA)'
    },
    'tab-inventory': {
      section: '03 / INVENTORY INTELLIGENCE',
      title: 'Giám sát Tồn kho Thông minh',
      subtitle: 'Phân loại độ bao phủ tồn kho theo tốc độ tiêu thụ 30 ngày trên 284.755 bản ghi'
    }
  };

  const statusConfig = {
    ready: {
      label: 'ENGINE READY',
      dot: 'bg-emerald-500',
      badge: 'text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700'
    },
    loading: {
      label: 'INDEXING RAM',
      dot: 'bg-amber-500 animate-pulse',
      badge: 'text-amber-800 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800'
    },
    offline: {
      label: 'API OFFLINE',
      dot: 'bg-rose-500',
      badge: 'text-rose-800 dark:text-rose-300 bg-rose-50/70 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800'
    }
  };

  const curMeta = tabMeta[activeTab] || tabMeta['tab-eda'];
  const curStatus = statusConfig[backendStatus] || statusConfig.loading;
  const totalRecords =
    backendMeta && backendMeta.salesCount > 0
      ? (backendMeta.salesCount + backendMeta.inventoryCount).toLocaleString('en-US')
      : null;

  return (
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between sticky top-0 z-20 flex-shrink-0 transition-colors duration-150">
      <div className="flex items-center gap-3 min-w-0">
        <div className="truncate">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {curMeta.section}
            </span>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight truncate">
              {curMeta.title}
            </h2>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate hidden sm:block">
            {curMeta.subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 flex-shrink-0">
        {/* Command Palette Trigger (Cmd+K) */}
        <button
          type="button"
          onClick={openCommandPalette}
          className="h-8 px-2.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center gap-2.5 text-xs transition-colors"
          title="Mở bảng điều khiển nhanh (Cmd+K / Ctrl+K)"
        >
          <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className="hidden md:inline text-[11.5px] text-slate-500 dark:text-slate-400">
            Tìm nhanh danh mục, cửa hàng...
          </span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded">
            ⌘K
          </kbd>
        </button>

        {/* Institutional Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="h-8 w-8 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors"
          title={theme === 'dark' ? 'Chuyển sang giao diện Sáng (Light Mode)' : 'Chuyển sang giao diện Tối (Dark Mode)'}
        >
          {theme === 'dark' ? (
            <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        {/* Backend Readiness & Record Count Telemetry */}
        <div className={`h-8 px-2.5 rounded-md border flex items-center gap-2 ${curStatus.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${curStatus.dot}`} />
          <span className="font-mono font-medium text-[11px] tracking-tight">{curStatus.label}</span>
          {totalRecords && (
            <>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums hidden sm:inline">
                {totalRecords} rows
              </span>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
