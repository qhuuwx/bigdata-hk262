/**
 * Dedicated Toast Notification Context
 * Manages transient alert banners independently from core application state.
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState({ message: '', type: 'info', visible: false });
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const showToast = useCallback((message, type = 'info', durationMs = 3500) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setToast({ message, type, visible: true });
    timerRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
      timerRef.current = null;
    }, durationMs);
  }, []);

  const hideToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(prev => ({ ...prev, visible: false }));
  }, []);

  const value = {
    toast,
    showToast,
    hideToast
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast.visible && (
        <div className="fixed bottom-5 right-5 z-50 animate-bounce">
          <div className="bg-slate-900 text-white text-xs px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 border border-slate-700">
            <span>ℹ️</span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export default ToastContext;
