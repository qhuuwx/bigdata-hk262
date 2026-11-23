/**
 * Root Application Shell Component
 * Integrates Sidebar navigation, Header telemetry bar, active Tab views, and global Cmd+K Command Palette.
 */

import React, { useState } from 'react';
import { useApp } from './context/AppContext';
import { ToastProvider } from './context/ToastContext';
import Sidebar from './components/common/Sidebar';
import Header from './components/common/Header';
import CommandPalette from './components/common/CommandPalette';
import EdaTab from './pages/EdaTab';
import ForecastTab from './pages/ForecastTab';
import InventoryTab from './pages/InventoryTab';

const AppContent = () => {
  const { activeTab } = useApp();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 font-sans overflow-hidden transition-colors duration-200">
      <Sidebar isCollapsed={isSidebarCollapsed} onToggle={toggleSidebar} />

      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        <Header onToggleSidebar={toggleSidebar} />

        <main className="flex-1 px-6 py-5 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto pb-10">
            {activeTab === 'tab-eda' && <EdaTab />}
            {activeTab === 'tab-forecast' && <ForecastTab />}
            {activeTab === 'tab-inventory' && <InventoryTab />}
          </div>
        </main>
      </div>

      <CommandPalette />
    </div>
  );
};

export const App = () => {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
};

export default App;
