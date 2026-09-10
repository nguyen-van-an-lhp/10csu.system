import React, { createContext, useContext, useState, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';
import type { AppState } from '../types';

interface DataContextType {
  appState: AppState | null;
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { session, logout } = useAuth();
  const [appState, setAppState] = useState<AppState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.call<AppState>('BOOTSTRAP');
      setAppState(data);
    } catch (err: any) {
      if (err.message?.includes('Phiên không hợp lệ')) logout();
      setError(err.message || 'Không thể tải dữ liệu từ máy chủ.');
      console.error('Lỗi tải dữ liệu:', err);
    } finally {
      setIsLoading(false);
    }
  }, [session, logout]);

  return (
    <DataContext.Provider value={{ appState, isLoading, error, refreshData }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData phải được dùng trong DataProvider');
  return context;
};