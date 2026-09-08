import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, LayoutDashboard, Grid3X3, ClipboardList, GraduationCap, BookOpen, Scale, Users } from 'lucide-react';
import { cn } from '../lib/utils';

export function Navigation() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!session) return null;

  const NavItem = ({ path, icon: Icon, label }: { path: string, icon: any, label: string }) => {
    const isActive = location.pathname === path;
    return (
      <button
        onClick={() => navigate(path)}
        className={cn(
          "flex items-center gap-2 px-3 lg:px-4 py-2 rounded-xl text-sm font-bold transition whitespace-nowrap",
          isActive ? "bg-red-50 text-red-900" : "text-stone-500 hover:bg-stone-100 hover:text-stone-900"
        )}
      >
        <Icon size={18} /> <span className="hidden md:inline">{label}</span>
      </button>
    );
  };

  return (
    <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-stone-200/50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center cursor-pointer flex-shrink-0" onClick={() => navigate('/dashboard')}>
          <span className="text-base lg:text-lg font-serif font-bold text-red-900 tracking-tight leading-none">10CSU<span className="hidden sm:inline"> MANAGEMENT SYSTEM</span></span>
        </div>

        {/* Đã gộp Tổng quan/Thông báo/Lịch trình → 1 mục "Tổng quan". Còn 6 mục,
            sắp theo tần suất sử dụng thực tế: vào thẳng, không cần cuộn ngang. */}
        <div className="flex items-center gap-1 flex-wrap justify-center border-x border-stone-200 px-4 lg:px-6">
          <NavItem path="/dashboard" icon={LayoutDashboard} label="Tổng quan" />
          <NavItem path="/reports" icon={ClipboardList} label="Báo cáo" />
          <NavItem path="/mentor" icon={GraduationCap} label="Cố vấn" />
          <NavItem path="/seating" icon={Grid3X3} label="Sơ đồ lớp" />
          <NavItem path="/rules" icon={BookOpen} label="Nội quy" />
          {session.role === 'gvcn' && (
            <NavItem path="/conduct" icon={Scale} label="Hạnh kiểm" />
          )}
          {session.role === 'gvcn' && (
            <NavItem path="/accounts" icon={Users} label="Tài khoản" />
          )}
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-stone-800">{session.name}</p>
            <p className="text-[11px] font-bold text-stone-500 uppercase">{session.role}</p>
          </div>
          <button onClick={() => { logout(); navigate('/'); }} className="p-2 text-stone-400 hover:text-red-900 hover:bg-red-50 rounded-xl transition">
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </nav>
  );
}