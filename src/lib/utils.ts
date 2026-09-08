import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Hàm gộp các class giao diện tránh xung đột
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Hàm lấy thời gian hiện tại chuẩn giờ Việt Nam
export function stamp(): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh'
  }).format(new Date()).replace(',', '');
}

// Hàm tạo ID ngẫu nhiên cho bài đăng, bình luận
export function uid(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

// Hàm tính mã Tuần hiện tại (Ví dụ: 2026-W37)
export function isoWeek(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}