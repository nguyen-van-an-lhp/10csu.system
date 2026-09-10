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

// Kiểu 1 nhóm dữ liệu đã gom theo tháng, mới nhất đứng đầu.
export type MonthGroup<T> = { key: string; label: string; items: T[] };

// Parse 2 định dạng thời gian đang tồn tại song song trong hệ thống:
// "dd/MM/yyyy HH:mm" (nowStr_ hiện tại của backend) và ISO "...T...Z"
// (dữ liệu cũ). Trả về null nếu không parse được thay vì ném lỗi, để một
// bản ghi hỏng không làm sập cả danh sách đang gom nhóm.
export function parseVNDateTime(raw: string): Date | null {
  if (!raw) return null;
  if (raw.includes('T') && raw.includes('Z')) {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  const [datePart] = raw.split(' ');
  const [day, month, year] = (datePart || '').split('/').map(Number);
  if (!day || !month || !year) return null;
  const d = new Date(year, month - 1, day);
  return isNaN(d.getTime()) ? null : d;
}

// Gom một danh sách bất kỳ theo THÁNG của trường thời gian do hàm getTimeStr
// chỉ định, nhóm mới nhất lên đầu. Dùng cho các danh sách có thể phình to
// theo thời gian (báo cáo tuần, bài đăng lưu trữ...) để tránh render tràn
// hàng trăm mục cùng lúc.
export function groupByMonth<T>(items: T[], getTimeStr: (item: T) => string): MonthGroup<T>[] {
  const map = new Map<string, T[]>();
  items.forEach(item => {
    const d = parseVNDateTime(getTimeStr(item));
    const key = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : 'khac';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  });
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, groupItems]) => ({
      key,
      label: key === 'khac' ? 'Không rõ thời gian' : `Tháng ${Number(key.split('-')[1])}/${key.split('-')[0]}`,
      items: groupItems,
    }));
}