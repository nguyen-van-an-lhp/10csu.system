import React from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

// 1. MagicCard: Thẻ bài kính mờ đặc trưng của Hạc Quán
export function MagicCard({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={cn("glass-card overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-red-900/20 hover:-translate-y-1", className)}>
      {children}
    </div>
  );
}

// 2. Modal: Cửa sổ popup bật lên giữa màn hình
export function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-md' }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode, maxWidth?: string }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
      <div className={cn("bg-white rounded-2xl shadow-2xl w-full flex flex-col max-h-[90vh] animate-rise", maxWidth)}>
        <div className="flex items-center justify-between p-4 border-b border-stone-100">
          <h3 className="text-lg font-bold text-red-900 font-serif">{title}</h3>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-red-600 rounded-full hover:bg-red-50 transition">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

// 3. RoleBadge: Đóng mác vai trò (GVCN, Lớp trưởng, Học sinh...)
export function RoleBadge({ role }: { role: string }) {
  if (role === 'gvcn') return <span className="chip bg-red-100 text-red-800 border-red-200">GVCN</span>;
  if (role === 'student') return <span className="chip bg-stone-100 text-stone-600 border-stone-200">Học sinh</span>;
  if (role.startsWith('to')) return <span className="chip bg-amber-100 text-amber-800 border-amber-200">Tổ trưởng</span>;
  return <span className="chip bg-blue-100 text-blue-800 border-blue-200">Ban cán sự</span>;
}

// 4. Loader: Vòng xoay chờ tải dữ liệu
export function Loader() {
  return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-red-900" size={32} /></div>;
}

// 5. EmptyState: Khi không có dữ liệu thì hiện cái này
export function EmptyState({ text = 'Chưa có dữ liệu' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-10 text-stone-400 border-2 border-dashed border-stone-200 rounded-2xl bg-stone-50/50">
      <AlertCircle size={40} className="mb-3 opacity-20" />
      <p className="font-medium">{text}</p>
    </div>
  );
}