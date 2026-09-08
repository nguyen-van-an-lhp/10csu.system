import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Session } from '../types';

interface AuthContextType {
  session: Session | null;
  login: (sessionData: Session) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Lấy phiên đăng nhập cũ nếu f5 trang
  const [session, setSession] = useState<Session | null>(() => {
    const stored = localStorage.getItem('psq_session');
    return stored ? JSON.parse(stored) : null;
  });

  // Mỗi khi session đổi, cập nhật API và lưu lại
  useEffect(() => {
    api.setApiSession(session);
    if (session) {
      localStorage.setItem('psq_session', JSON.stringify(session));
    } else {
      localStorage.removeItem('psq_session');
    }
  }, [session]);

  const login = (data: Session) => setSession(data);
  const logout = () => setSession(null);

  return (
    <AuthContext.Provider value={{ session, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth phải được dùng trong AuthProvider');
  return context;
};