import { useApp } from '../../context/AppContext';

export const Header = ({ onToggleSidebar }) => {
  const { activeTab, backendStatus, backendMeta } = useApp();

  const tabTitles = {
    'tab-eda': 'Dữ liệu & Streaming Bán hàng',
    'tab-forecast': 'Dự báo Nhu cầu',
    'tab-inventory': 'Phân tích Tồn kho Thông minh'
  };

  const statusConfig = {
    ready: { label: 'Backend Ready', color: 'bg-emerald-500', text: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    loading: { label: 'Nạp CSV vào RAM...', color: 'bg-amber-500 animate-pulse', text: 'text-amber-700 bg-amber-50 border-amber-200' },
    offline: { label: 'Backend Offline', color: 'bg-rose-500', text: 'text-rose-700 bg-rose-50 border-rose-200' }
  };

  const curStatus = statusConfig[backendStatus] || statusConfig.loading;

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800 tracking-wider uppercase">
            {tabTitles[activeTab] || 'Retail Analytics Dashboard'}
          </h2>
          <p className="text-[11px] text-slate-500 font-semibold tracking-wider uppercase mt-0.5">
            {activeTab === 'tab-forecast' ? 'Normal vs Super Forecast' : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className={`px-3 py-1 rounded-full text-xs border flex items-center gap-2 ${curStatus.text}`}>
          <span className={`w-2 h-2 rounded-full ${curStatus.color}`} />
          <span className="font-semibold uppercase tracking-wider text-[11px]">{curStatus.label}</span>
          {backendMeta && backendMeta.salesCount > 0 && (
            <span className="text-[11px] opacity-75 font-mono">
              ({(backendMeta.salesCount + backendMeta.inventoryCount).toLocaleString()} rows)
            </span>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
