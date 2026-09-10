import React from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

// 1. MagicCard: Thẻ bài kính mờ đặc trưng của Hạc Quán
export function MagicCard({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={cn("glass-card overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary-700/[0.06] hover:border-primary-700/20 hover:-translate-y-0.5", className)}>
      {children}
    </div>
  );
}

// 2. Modal: Cửa sổ popup bật lên giữa màn hình
export function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-md' }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode, maxWidth?: string }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <div className={cn("bg-white rounded-2xl shadow-2xl shadow-gray-900/20 border border-gray-100 w-full flex flex-col max-h-[90vh] animate-rise", maxWidth)}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-primary-700 font-sans">{title}</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-primary-600 rounded-full hover:bg-primary-50 transition">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}

// 3. RoleBadge: Đóng mác vai trò (GVCN, Lớp trưởng, Học sinh...)
export function RoleBadge({ role }: { role: string }) {
  if (role === 'gvcn') return <span className="chip bg-primary-100 text-primary-700 border-primary-200">GVCN</span>;
  if (role === 'student') return <span className="chip bg-gray-100 text-gray-600 border-gray-200">Học sinh</span>;
  if (role.startsWith('to')) return <span className="chip bg-amber-100 text-amber-800 border-amber-200">Tổ trưởng</span>;
  // Đổi từ blue sang violet — sau khi màu chủ đạo hệ thống chuyển sang
  // xanh dương (primary), badge "Ban cán sự" dùng blue-100/blue-800 gần
  // như trùng hệt primary-100/primary-700, khiến 2 nhãn GVCN và Ban cán
  // sự khó phân biệt bằng mắt. Violet giữ đúng vai trò phân loại trực
  // quan rõ ràng của RoleBadge.
  return <span className="chip bg-violet-100 text-violet-800 border-violet-200">Ban cán sự</span>;
}

// 4. Loader: Vòng xoay chờ tải dữ liệu
export function Loader() {
  return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary-700" size={32} /></div>;
}

// 5. EmptyState: Khi không có dữ liệu thì hiện cái này
export function EmptyState({ text = 'Chưa có dữ liệu' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
      <AlertCircle size={40} className="mb-3 opacity-20" />
      <p className="font-medium">{text}</p>
    </div>
  );
}