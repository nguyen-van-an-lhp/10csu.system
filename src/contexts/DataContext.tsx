import React, { createContext, useContext, useState, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';
import type { AppState } from '../types';

interface DataContextType {
  appState: AppState | null;
  isLoading: boolean;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { session, logout } = useAuth();
  const [appState, setAppState] = useState<AppState | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Hàm kéo toàn bộ dữ liệu từ Google Sheet (Hành động BOOTSTRAP)
  const refreshData = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);
    try {
      const data = await api.call<AppState>('BOOTSTRAP');
      setAppState(data);
    } catch (error: any) {
      // Nếu token hết hạn, báo lỗi và ép đăng xuất
      if (error.message.includes('Phiên không hợp lệ')) {
        logout();
      }
      console.error("Lỗi tải dữ liệu:", error);
    } finally {
      setIsLoading(false);
    }
  }, [session, logout]);

  return (
    <DataContext.Provider value={{ appState, isLoading, refreshData }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData phải được dùng trong DataProvider');
  return context;
};