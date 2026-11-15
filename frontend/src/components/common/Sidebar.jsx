/**
 * Left Sidebar Navigation Component
 * Adheres to bigdata1604 design (#E0F2FE background, left sidebar tab navigation).
 * Sidebar collapse state is managed via props from App shell.
 */

import React from 'react';
import { useApp } from '../../context/AppContext';
import SidebarToggleIcon from './SidebarToggleIcon';

export const Sidebar = ({ isCollapsed = false, onToggle }) => {
  const { activeTab, setActiveTab } = useApp();

  const navItems = [
    {
      id: 'tab-eda',
      title: 'EDA & Streaming',
      icon: "/icons/iconEda.png",
    },
    {
      id: 'tab-forecast',
      title: 'Dự báo Nhu cầu',
      icon: "/icons/iconForecast.png",
    },
    {
      id: 'tab-inventory',
      title: 'Tồn kho Thông minh',
      icon: "/icons/iconInventory.png",
    }
  ];

  return (
    <aside
      className={`bg-[#E0F2FE] border-r border-sky-300 flex flex-col transition-all duration-300 z-30 select-none
        ${isCollapsed ? 'w-16' : 'w-64'} h-screen flex-shrink-0`}
    >
      {/* Brand Header */}
      <div className="p-5 border-b border-sky-200/80 flex items-center justify-between">
        <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center w-full' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-sky-500 flex items-center justify-center text-white shadow-md shadow-sky-400/30 flex-shrink-0">
            <img src="icons/logo.png" alt="Logo" className="w-8 h-8" />
          </div>
          {!isCollapsed && (
            <div className="leading-tight truncate">
              <h1 className="font-bold text-slate-800 text-sm tracking-tight truncate">Big Data</h1>
              <p className="text-[11px] text-sky-700 font-medium truncate">BTL HK262</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-left transition-all duration-200 group relative
                ${isActive
                  ? 'bg-gradient-to-r from-red-100 to-sky-600 text-white shadow-lg shadow-sky-500/25 font-semibold'
                  : 'text-slate-700 hover:bg-sky-200/60 hover:text-slate-900 font-medium'
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
              title={isCollapsed ? item.title : undefined}
            >
              <img src={item.icon} alt={item.title} className="w-9 h-9 flex-shrink-0" />
              {!isCollapsed && (
                <div className="truncate">
                  <div className="text-sm leading-snug truncate">{item.title}</div>
                  <div className={`text-[10px] truncate ${isActive ? 'text-sky-100' : 'text-slate-500'}`}>
                    {item.desc}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Toggle */}
      <div className="p-3 border-t border-sky-200/80">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center justify-center
               w-50 h-50 min-w-10
               mx-auto p-0
               rounded-lg
               hover:bg-sky-200/50
               text-slate-600
               transition-colors"
        >
          <SidebarToggleIcon />
          {!isCollapsed && (
            <span className="text-xs font-medium whitespace-nowrap ml-2 text-slate-700">
              Thu gọn
            </span>
          )}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
