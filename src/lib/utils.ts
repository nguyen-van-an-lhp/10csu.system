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

// Tính ngày dương lịch thật (Thứ mấy → ngày/tháng nào) cho từng ngày trong
// 1 tuần trường học, từ weekId ("YYYY-SWn") + điểm neo Tuần 1 (yyyy-MM-dd).
const WEEKDAY_OFFSET: Record<string, number> = { T2: 0, T3: 1, T4: 2, T5: 3, T6: 4, T7: 5, CN: 6 };
function mondayOfDate(dt: Date): Date {
  const x = new Date(dt); x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
}
export function weekMonday(weekId: string, weekAnchorIso: string): Date {
  const anchor = weekAnchorIso ? new Date(weekAnchorIso) : new Date(new Date().getFullYear(), 8, 7);
  const anchorMonday = mondayOfDate(anchor);
  const n = Number(weekId?.match(/SW(-?\d+)$/)?.[1] ?? 1);
  const monday = new Date(anchorMonday);
  monday.setDate(monday.getDate() + (n - 1) * 7);
  return monday;
}
export function weekDayDate(weekId: string, weekAnchorIso: string, day: string): Date {
  const monday = weekMonday(weekId, weekAnchorIso);
  const d = new Date(monday);
  d.setDate(d.getDate() + (WEEKDAY_OFFSET[day] ?? 0));
  return d;
}
export function dateToWeekId(date: Date, weekAnchorIso: string): string {
  const anchor = weekAnchorIso ? new Date(weekAnchorIso) : new Date(new Date().getFullYear(), 8, 7);
  const anchorMonday = mondayOfDate(anchor);
  const dMonday = mondayOfDate(date);
  const weekNum = Math.round((dMonday.getTime() - anchorMonday.getTime()) / (7 * 86400000)) + 1;
  return `${anchor.getFullYear()}-SW${weekNum}`;
}
export function formatDmShort(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function formatDmy(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
export function formatIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// v26.2 — SẮP XẾP DANH SÁCH HỌC SINH THEO TỔ + VỊ TRÍ GHẾ THẬT. Dùng CHUNG
// cho mọi check-list chọn học sinh trong toàn hệ thống (Trực nhật, Phân
// công, Báo cáo tuần...), thay vì mỗi nơi tự sắp một kiểu. Sơ đồ lớp
// (SeatingChart.tsx) lưu ghế theo khóa "hàng-cột" — hàng 0 = bàn đầu, cột 0
// = bên trái — nên rank = hàng*100 + cột cho đúng thứ tự đọc tự nhiên
// (trái→phải hết 1 hàng rồi mới xuống hàng dưới). Tổ nào chưa xếp/chưa có
// ghế bị đẩy xuống cuối nhóm tương ứng, không làm vỡ thứ tự Tổ 1→8.
export function sortRosterBySeat<T extends { id: string; name: string; group?: number | null }>(roster: T[], seating: any): T[] {
  const seatRank = new Map<string, number>();
  if (seating && typeof seating === 'object') {
    Object.entries(seating).forEach(([seatId, seat]: [string, any]) => {
      const studentId = seat?.studentId;
      if (!studentId) return;
      const [r, c] = seatId.split('-').map(Number);
      if (Number.isNaN(r) || Number.isNaN(c)) return;
      seatRank.set(String(studentId), r * 100 + c);
    });
  }
  return [...roster].sort((a, b) => {
    const ga = a.group ?? 99, gb = b.group ?? 99;
    if (ga !== gb) return ga - gb;
    const sa = seatRank.has(a.id) ? seatRank.get(a.id)! : Infinity;
    const sb = seatRank.has(b.id) ? seatRank.get(b.id)! : Infinity;
    if (sa !== sb) return sa - sb;
    return a.name.localeCompare(b.name, 'vi');
  });
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