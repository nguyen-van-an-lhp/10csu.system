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

// 6. StudentChecklist (v26.2) — check-list dọc DÙNG CHUNG cho mọi nơi chọn
// nhiều học sinh (Trực nhật, Phân công, Báo cáo tuần...). Nhóm theo Tổ 1→8
// (Tổ nào chưa phân đẩy xuống cuối), giữ nguyên thứ tự học sinh đã truyền
// vào trong mỗi Tổ — gọi sortRosterBySeat() từ lib/utils.ts TRƯỚC khi
// truyền vào đây để có đúng thứ tự ghế ngồi thật. Checkbox thật (không còn
// kiểu "chip ẩn checkbox" khó nhìn trước đây), có avatar tròn + tên đầy đủ,
// dòng đang chọn tô nền rõ ràng.
export function StudentChecklist({
  students, selected, onToggle, max, className,
}: {
  students: { id: string; name: string; group?: number | null }[];
  selected: string[];
  onToggle: (id: string) => void;
  max?: number;
  className?: string;
}) {
  const byGroup = new Map<string, typeof students>();
  students.forEach(s => {
    const key = s.group ? String(s.group) : 'none';
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key)!.push(s);
  });
  const groups = [...byGroup.entries()].sort((a, b) => {
    if (a[0] === 'none') return 1;
    if (b[0] === 'none') return -1;
    return Number(a[0]) - Number(b[0]);
  });

  return (
    <div className={cn('border border-gray-200 rounded-xl overflow-y-auto max-h-72 custom-scrollbar', className)}>
      {groups.map(([key, list]) => (
        <div key={key}>
          <div className="sticky top-0 bg-gray-100 px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">
            {key === 'none' ? 'Chưa phân Tổ' : `Tổ ${key}`}
          </div>
          <div className="divide-y divide-gray-100">
            {list.map(s => {
              const isChecked = selected.includes(s.id);
              const disabled = !isChecked && !!max && selected.length >= max;
              return (
                <label key={s.id} className={cn('flex items-center gap-2.5 px-3 py-2 cursor-pointer transition', isChecked ? 'bg-primary-50' : 'hover:bg-gray-50', disabled && 'opacity-40 cursor-not-allowed')}>
                  <input type="checkbox" className="w-4 h-4 accent-primary-600 shrink-0" checked={isChecked} onChange={() => onToggle(s.id)} disabled={disabled} />
                  <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-[10px] font-bold uppercase shrink-0">{s.name.charAt(0)}</div>
                  <span className={cn('text-sm truncate', isChecked ? 'font-bold text-primary-800' : 'font-medium text-gray-700')}>{s.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
      {students.length === 0 && <p className="text-xs text-gray-400 italic p-3">Không có học sinh nào.</p>}
    </div>
  );
}