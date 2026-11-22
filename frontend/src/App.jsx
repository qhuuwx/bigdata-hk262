/**
 * Root Application Shell Component
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
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden">
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
