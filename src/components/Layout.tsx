import React from 'react';
import { Navigation } from './Navigation';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    // bg-gray-100 (không phải gray-50) — đủ tối hơn card bg-white để tạo
    // ranh giới rõ ràng. Trước đây gray-50 gần như cùng độ sáng với card
    // trắng + viền gray-100 cực mảnh, khiến nội dung "chìm" vào nền — đúng
    // vấn đề đã phản ánh. MaterialCard tham chiếu giữ nền trang đơn giản
    // (bg-white phẳng) để dồn hết độ tương phản cho chính card; ở đây nền
    // đổi màu (gray-100) còn card giữ trắng, đạt cùng mục đích mà vẫn giữ
    // được chiều sâu thị giác đã có.
    // Nền viền ngoài đổi từ gray-100 (xám trung tính) sang gradient bạc pha
    // xanh dương rất nhạt (slate → primary-50) — vẫn đủ tối hơn card trắng
    // để giữ tương phản, nhưng giờ "ăn tông" với màu primary chủ đạo thay
    // vì xám lệch tông hoàn toàn với header/nút xanh dương.
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-primary-50/40 flex flex-col relative overflow-x-hidden">
      {/* Ambient glow — giảm mạnh so với trước: bán kính nhỏ hơn, độ mờ thấp
          hơn nhiều (/15 thay vì /40), chỉ còn là điểm nhấn cực nhẹ ở góc xa
          màn hình thay vì phủ sáng gần như toàn bộ nền. Glow quá mạnh trước
          đây chính là một phần nguyên nhân khiến nền và card cùng tông sáng,
          mất ranh giới. */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[420px] h-[420px] bg-gradient-to-bl from-primary-200/15 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-[360px] h-[360px] bg-gradient-to-tr from-amber-200/10 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navigation />
        {/* Khung chứa nội dung chính — trước đây max-w-6xl (1152px) để lại 2 dải
            trắng rất lớn trên màn hình ≥1920px, không tận dụng khoảng hiển thị.
            Nới lên 1600px: vẫn có giới hạn hợp lý (văn bản không kéo dài quá
            mức khó đọc) nhưng khai thác tốt màn hình desktop/laptop hiện đại. */}
        <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 md:p-6 pb-10">
          {children}
        </main>

        {/* Footer đổi từ trắng phẳng sang xanh đậm nổi bật — theo yêu cầu
            người dùng, đồng bộ với màu chủ đạo thay vì hòa lẫn vào nền. */}
        <footer className="bg-primary-900 print:hidden">
          <div className="max-w-[1600px] mx-auto px-4 py-6 text-center space-y-1">
            <p className="text-xs sm:text-sm font-bold text-white">
              Hệ Thống Quản Lý Lớp 10CSU — Trường THPT chuyên Lê Hồng Phong TP.HCM
            </p>
            <p className="text-[11px] sm:text-xs text-primary-200">
              Design by Nguyễn Văn An (GVCN 10CSU)
              <span className="mx-2 text-primary-700">|</span>
              Mobile: <a href="tel:0326830265" className="font-bold text-amber-300 hover:underline">0326.830.265</a>
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}