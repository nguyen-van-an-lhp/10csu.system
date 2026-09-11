import React, { useRef, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, LayoutDashboard, Grid3X3, ClipboardList, GraduationCap, BookOpen, Scale, Users, BookMarked, BarChart3, Library } from 'lucide-react';
import { cn } from '../lib/utils';

export function Navigation() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Theo dõi vị trí cuộn để hiện/ẩn gradient hồng 2 đầu — báo cho người dùng
  // biết còn mục điều hướng ngoài tầm nhìn, thay vì để chữ "biến mất" đột
  // ngột không giải thích (hành vi cũ) hoặc thanh cuộn thô lồi ra giữa nav.
  const updateScrollShadows = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    updateScrollShadows();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollShadows, { passive: true });
    window.addEventListener('resize', updateScrollShadows);
    return () => {
      el.removeEventListener('scroll', updateScrollShadows);
      window.removeEventListener('resize', updateScrollShadows);
    };
  }, [session]);

  if (!session) return null;

  const NavItem = ({ path, icon: Icon, label }: { path: string, icon: any, label: string }) => {
    const isActive = location.pathname === path;
    return (
      <button
        onClick={() => navigate(path)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap transition-colors flex-shrink-0',
          isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
        )}
      >
        <Icon size={16} className="flex-shrink-0" />
        <span>{label}</span>
      </button>
    );
  };

  const isGvcn = session.role === 'gvcn';

  return (
    <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200/60 shadow-sm">
      <div className="max-w-screen-2xl mx-auto px-3 md:px-4 h-14 flex items-center gap-2 md:gap-3">
        {/* LOGO */}
        <div className="flex items-center cursor-pointer flex-shrink-0 gap-2" onClick={() => navigate('/dashboard')}>
          <div className="h-7 px-2 bg-primary-700 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-[11px] tracking-wide">10CSU</span>
          </div>
          <span className="text-sm font-sans font-bold text-primary-700 tracking-tight hidden lg:inline">
            Management System
          </span>
        </div>

        {/* NAV LINKS — dải cuộn ngang mượt, ẩn thanh cuộn thô của trình
            duyệt (no-scrollbar). Lớp nền hồng cực nhạt phủ xuyên suốt dải
            (rose-50/40) làm nền "ngầm chỉ đây là khu vực trượt được" ngay
            cả khi đang đứng yên; gradient hồng đậm hơn (rose-100 → trong
            suốt) chỉ nổi lên ở mép còn nội dung để cuộn tới — không che
            chữ (pointer-events-none, nhạt dần hết cỡ về cuối). */}
        <div className="relative flex-1 min-w-0 rounded-xl">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-rose-50/0 via-rose-50/50 to-rose-50/0 rounded-xl" />
          {canScrollLeft && (
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-rose-100/90 via-rose-50/50 to-transparent z-10 rounded-l-xl" />
          )}
          <div ref={scrollRef} className="relative flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth">
            <NavItem path="/dashboard"    icon={LayoutDashboard} label="Tổng quan" />
            <NavItem path="/learning"     icon={Library}         label="Học liệu" />
            <NavItem path="/reports"      icon={ClipboardList}   label="Báo Cáo Tuần" />
            <NavItem path="/bcs-stats"    icon={BarChart3}       label="Phân công" />
            <NavItem path="/mentor"       icon={GraduationCap}   label="Cố vấn" />
            <NavItem path="/seating"      icon={Grid3X3}         label="Sơ đồ" />
            <NavItem path="/rules"        icon={BookOpen}        label="Nội quy" />

            {/* Đã mở khóa cho mọi học sinh */}
            <NavItem path="/conduct"        icon={Scale}       label="Hạnh kiểm" />
            <NavItem path="/conduct-report" icon={BarChart3}   label="Báo cáo HK" />

            {/* Vẫn giữ nguyên khóa chỉ GVCN mới xem được */}
            {isGvcn && <NavItem path="/accounts"       icon={Users}       label="Tài khoản" />}
            {isGvcn && <NavItem path="/catalog"        icon={BookMarked}  label="Danh mục lỗi" />}
          </div>
          {canScrollRight && (
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-rose-100/90 via-rose-50/50 to-transparent z-10 rounded-r-xl" />
          )}
        </div>

        {/* USER INFO + LOGOUT */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right hidden md:block">
            <p className="text-xs font-bold text-gray-800 leading-tight">{session.name}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase">{session.role}</p>
          </div>
          <button onClick={() => { logout(); navigate('/'); }}
            className="p-2 text-gray-400 hover:text-primary-700 hover:bg-primary-50 rounded-xl transition flex-shrink-0" title="Đăng xuất">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </nav>
  );
}