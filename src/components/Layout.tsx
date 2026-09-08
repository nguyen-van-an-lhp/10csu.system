import React from 'react';
import { Navigation } from './Navigation';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <Navigation />
      {/* Khung chứa nội dung chính, giới hạn độ rộng cho đẹp */}
      <main className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-6 pb-10">
        {children}
      </main>

      {/* Footer dùng chung — hiển thị trên MỌI trang, ẩn khi in ấn */}
      <footer className="border-t border-stone-200 bg-white print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center space-y-1">
          <p className="text-xs sm:text-sm font-bold text-stone-800">
            Hệ Thống Quản Lý Lớp 10CSU — Trường THPT chuyên Lê Hồng Phong TP.HCM
          </p>
          <p className="text-[11px] sm:text-xs text-stone-500">
            Design by Nguyễn Văn An (GVCN 10CSU)
            <span className="mx-2 text-stone-300">|</span>
            Mobile: <a href="tel:0326830265" className="font-bold text-red-900 hover:underline">0326.830.265</a>
          </p>
        </div>
      </footer>
    </div>
  );
}