/**
 * Root Application Shell Component
 * Integrates Left Sidebar, Top Header, Tab Views, and ToastProvider.
 * Sidebar collapse state is locally managed with useState.
 */

import React, { useState } from 'react';
import { useApp } from './context/AppContext';
import { ToastProvider } from './context/ToastContext';
import Sidebar from './components/common/Sidebar';
import Header from './components/common/Header';
import EdaTab from './pages/EdaTab';
import ForecastTab from './pages/ForecastTab';
import InventoryTab from './pages/InventoryTab';

const AppContent = () => {
  const { activeTab } = useApp();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => !prev);
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-800 font-sans overflow-hidden">
      {/* 1. Left Sidebar Navigation */}
      <Sidebar isCollapsed={isSidebarCollapsed} onToggle={toggleSidebar} />

      {/* 2. Main Viewport */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <Header onToggleSidebar={toggleSidebar} />

        {/* Tab View Container */}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto pb-12">
            {activeTab === 'tab-eda' && <EdaTab />}
            {activeTab === 'tab-forecast' && <ForecastTab />}
            {activeTab === 'tab-inventory' && <InventoryTab />}
          </div>
        </main>
      </div>
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
