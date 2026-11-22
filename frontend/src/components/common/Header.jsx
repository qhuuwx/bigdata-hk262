import React from 'react';
import { useApp } from '../../context/AppContext';

export const Header = () => {
  const { activeTab, backendStatus, backendMeta } = useApp();

  const tabMeta = {
    'tab-eda': {
      section: '01 / EDA & STREAMING',
      title: 'Khám phá Dữ liệu & Luồng Giao dịch',
      subtitle: 'Mô phỏng luồng bán hàng thời gian thực (2s) và tổng hợp 125.751 giao dịch lịch sử'
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
      badge: 'text-slate-700 bg-slate-50 border-slate-200'
    },
    loading: {
      label: 'INDEXING RAM',
      dot: 'bg-amber-500 animate-pulse',
      badge: 'text-amber-800 bg-amber-50/70 border-amber-200'
    },
    offline: {
      label: 'API OFFLINE',
      dot: 'bg-rose-500',
      badge: 'text-rose-800 bg-rose-50/70 border-rose-200'
    }
  };

  const curMeta = tabMeta[activeTab] || tabMeta['tab-eda'];
  const curStatus = statusConfig[backendStatus] || statusConfig.loading;
  const totalRecords =
    backendMeta && backendMeta.salesCount > 0
      ? (backendMeta.salesCount + backendMeta.inventoryCount).toLocaleString('en-US')
      : null;

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-20 flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="truncate">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-slate-400">
              {curMeta.section}
            </span>
            <span className="text-slate-300">/</span>
            <h2 className="text-sm font-semibold text-slate-900 tracking-tight truncate">
              {curMeta.title}
            </h2>
          </div>
          <p className="text-[11px] text-slate-500 truncate hidden sm:block">
            {curMeta.subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 flex-shrink-0">
        <div className={`px-2.5 py-1 rounded-md border flex items-center gap-2 ${curStatus.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${curStatus.dot}`} />
          <span className="font-mono font-medium text-[11px] tracking-tight">{curStatus.label}</span>
          {totalRecords && (
            <>
              <span className="text-slate-300">|</span>
              <span className="text-[11px] font-mono text-slate-500 tabular-nums">
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
