/**
 * Left Sidebar Navigation Component
 * Deep slate institutional navigation rail with inline SVG iconography.
 */

import React from 'react';
import { useApp } from '../../context/AppContext';

const NavIcon = ({ id, active }) => {
  const stroke = active ? '#60a5fa' : 'currentColor';
  if (id === 'tab-eda') {
    return (
      <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 14l4-4 4 4 5-6" />
      </svg>
    );
  }
  if (id === 'tab-forecast') {
    return (
      <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12h4l3-9 4 18 3-9h6" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
};

export const Sidebar = ({ isCollapsed = false, onToggle }) => {
  const { activeTab, setActiveTab } = useApp();

  const navItems = [
    {
      id: 'tab-eda',
      code: '01',
      title: 'EDA & Streaming',
      desc: 'Luồng giao dịch & phân tích'
    },
    {
      id: 'tab-forecast',
      code: '02',
      title: 'Dự báo Nhu cầu',
      desc: 'Đối chiếu SMA vs. WMA'
    },
    {
      id: 'tab-inventory',
      code: '03',
      title: 'Tồn kho Thông minh',
      desc: 'Phân loại & cảnh báo 30d'
    }
  ];

  return (
    <aside
      className={`bg-[#0F172A] text-slate-300 border-r border-slate-800 flex flex-col transition-all duration-200 z-30 select-none ${
        isCollapsed ? 'w-16' : 'w-60'
      } h-screen flex-shrink-0`}
    >
      {/* Brand Header */}
      <div className="h-14 px-4 border-b border-slate-800/90 flex items-center justify-between">
        <div className={`flex items-center gap-2.5 ${isCollapsed ? 'justify-center w-full' : 'truncate'}`}>
          <div className="w-7 h-7 rounded-md bg-blue-600/15 border border-blue-500/40 flex items-center justify-center text-blue-400 font-mono text-xs font-semibold flex-shrink-0">
            RI
          </div>
          {!isCollapsed && (
            <div className="leading-tight truncate">
              <div className="font-semibold text-slate-100 text-[13px] tracking-tight truncate">
                Retail Intelligence
              </div>
              <div className="text-[10px] text-slate-400 font-mono tracking-wider uppercase truncate">
                CO4033 · HK262
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section Label */}
      {!isCollapsed && (
        <div className="px-4 pt-4 pb-1.5">
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            Phân hệ phân tích
          </span>
        </div>
      )}

      {/* Navigation Menu */}
      <nav className="flex-1 px-2.5 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={isCollapsed ? item.title : undefined}
              className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-md text-left transition-colors relative group ${
                isActive
                  ? 'bg-slate-800/90 text-white'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              } ${isCollapsed ? 'justify-center px-0' : ''}`}
            >
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-blue-500 rounded-r" />
              )}
              <NavIcon id={item.id} active={isActive} />
              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-[12.5px] truncate ${isActive ? 'font-semibold text-white' : 'font-medium'}`}>
                      {item.title}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">{item.code}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                    {item.desc}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Collapse Toggle */}
      <div className="p-2.5 border-t border-slate-800/90">
        <button
          type="button"
          onClick={onToggle}
          className="w-full h-9 px-2.5 rounded-md flex items-center justify-center gap-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors text-xs"
          title={isCollapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
        >
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18" />
            <path d="M15 9l-3 3 3 3" />
          </svg>
          {!isCollapsed && (
            <span className="text-[11px] font-medium text-slate-400 truncate">
              Thu gọn thanh bên
            </span>
          )}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
