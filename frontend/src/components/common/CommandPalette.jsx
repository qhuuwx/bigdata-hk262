/**
 * Power-User Global Command Palette (Cmd+K / Ctrl+K)
 * Provides instant keyboard navigation across analytical tabs, quick system actions,
 * and direct jump-to-forecast execution for all 27 product categories and 40 stores.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import forecastService from '../../services/forecastService';

export const CommandPalette = () => {
  const {
    isCommandPaletteOpen,
    closeCommandPalette,
    setActiveTab,
    toggleTheme,
    theme,
    backendStatus
  } = useApp();
  const { showToast } = useToast();

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [categories, setCategories] = useState([]);
  const [stores, setStores] = useState([]);
  const inputRef = useRef(null);

  // Preload 27 categories and 40 stores once backend is ready
  useEffect(() => {
    let mounted = true;
    async function fetchCatalog() {
      try {
        const [cats, sts] = await Promise.all([
          forecastService.getCategories(),
          forecastService.getStores()
        ]);
        if (!mounted) return;
        if (Array.isArray(cats)) setCategories(cats);
        if (Array.isArray(sts)) setStores(sts);
      } catch (e) {}
    }
    if (backendStatus === 'ready' && (categories.length === 0 || stores.length === 0)) {
      fetchCatalog();
    }
    return () => {
      mounted = false;
    };
  }, [backendStatus, categories.length, stores.length]);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 20);
    }
  }, [isCommandPaletteOpen]);

  const commandItems = useMemo(() => {
    const baseActions = [
      {
        id: 'nav-eda',
        group: 'Điều hướng phân hệ',
        title: '01 / EDA & Luồng Giao dịch Thời gian thực',
        badge: 'Tab 1',
        onSelect: () => setActiveTab('tab-eda')
      },
      {
        id: 'nav-forecast',
        group: 'Điều hướng phân hệ',
        title: '02 / Dự báo Nhu cầu (Normal SMA vs. Super WMA)',
        badge: 'Tab 2',
        onSelect: () => setActiveTab('tab-forecast')
      },
      {
        id: 'nav-inventory',
        group: 'Điều hướng phân hệ',
        title: '03 / Giám sát Tồn kho Thông minh & Top 10 Cảnh báo',
        badge: 'Tab 3',
        onSelect: () => setActiveTab('tab-inventory')
      },
      {
        id: 'act-toggle-stream',
        group: 'Thao tác nhanh',
        title: 'Tạm dừng / Tiếp tục Luồng Giao dịch Bán hàng (SSE)',
        badge: 'Stream',
        onSelect: () => {
          window.dispatchEvent(new CustomEvent('ri:toggle-sales-stream'));
          showToast('Đã chuyển trạng thái luồng giao dịch bán hàng');
        }
      },
      {
        id: 'act-reset-inv',
        group: 'Thao tác nhanh',
        title: 'Đặt lại Bộ đếm Tồn kho Tích lũy trên Máy chủ',
        badge: 'Inventory',
        onSelect: () => {
          window.dispatchEvent(new CustomEvent('ri:reset-inventory'));
          showToast('Đã đặt lại bộ đếm tồn kho tích lũy về 0');
        }
      },
      {
        id: 'act-reset-eda',
        group: 'Thao tác nhanh',
        title: 'Đặt lại Bộ lọc Phân tích EDA',
        badge: 'EDA Filter',
        onSelect: () => {
          window.dispatchEvent(new CustomEvent('ri:reset-eda-filters'));
          showToast('Đã xóa tất cả bộ lọc EDA');
        }
      },
      {
        id: 'act-theme',
        group: 'Thao tác nhanh',
        title: `Chuyển sang giao diện ${theme === 'dark' ? 'Sáng (Light Mode)' : 'Tối (Dark Mode)'}`,
        badge: 'Theme',
        onSelect: () => {
          toggleTheme();
          showToast(`Đã chuyển sang giao diện ${theme === 'dark' ? 'Sáng' : 'Tối'}`);
        }
      }
    ];

    const categoryItems = categories.map((cat) => ({
      id: `cat-${cat}`,
      group: 'Dự báo nhanh theo Danh mục (27)',
      title: `Chạy dự báo cho danh mục: ${cat}`,
      badge: 'Category',
      onSelect: () => {
        setActiveTab('tab-forecast');
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('ri:quick-forecast', { detail: { category: cat } }));
        }, 30);
        showToast(`Đang dự báo danh mục: ${cat}`);
      }
    }));

    const storeItems = stores.map((st) => ({
      id: `store-${st}`,
      group: 'Dự báo nhanh theo Cửa hàng (40)',
      title: `Chạy dự báo tại cửa hàng: ${st}`,
      badge: st,
      onSelect: () => {
        setActiveTab('tab-forecast');
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('ri:quick-forecast', { detail: { store: st } }));
        }, 30);
        showToast(`Đang dự báo cửa hàng: ${st}`);
      }
    }));

    return [...baseActions, ...categoryItems, ...storeItems];
  }, [categories, stores, setActiveTab, toggleTheme, theme, showToast]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commandItems.slice(0, 18);
    return commandItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q) ||
        (item.badge && item.badge.toLowerCase().includes(q))
    ).slice(0, 30);
  }, [commandItems, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!isCommandPaletteOpen) return null;

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeCommandPalette();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) =>
        filteredItems.length > 0 ? (prev - 1 + filteredItems.length) % filteredItems.length : 0
      );
    } else if (e.key === 'Enter' && filteredItems[activeIndex]) {
      e.preventDefault();
      filteredItems[activeIndex].onSelect();
      closeCommandPalette();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] flex items-start justify-center pt-[12vh] px-4"
      onClick={closeCommandPalette}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-tab-panel"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Header */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <svg className="w-4 h-4 text-slate-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nhập lệnh, tên danh mục sản phẩm (27), hoặc mã cửa hàng STR-xxxx (40)..."
            className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded border border-slate-200 dark:border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Filtered Results List */}
        <div className="max-h-[340px] overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Không tìm thấy lệnh hoặc danh mục/cửa hàng phù hợp với &ldquo;{query}&rdquo;
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => {
                    item.onSelect();
                    closeCommandPalette();
                  }}
                  className={`w-full px-3 py-2 rounded-lg flex items-center justify-between gap-3 text-left text-xs transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <div className="min-w-0">
                    <div className={`text-[10px] font-mono uppercase tracking-wider ${
                      isSelected ? 'text-blue-200' : 'text-slate-400 dark:text-slate-500'
                    }`}>
                      {item.group}
                    </div>
                    <div className="font-medium truncate mt-0.5">{item.title}</div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono flex-shrink-0 ${
                      isSelected
                        ? 'bg-blue-700 text-blue-100'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer Hints */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>↑↓ Di chuyển · ↵ Thực thi · ESC Đóng</span>
          <span>27 Categories · 40 Stores</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
