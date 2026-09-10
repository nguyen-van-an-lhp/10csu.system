import React, { useState, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle2, XCircle, Clock, Users, ClipboardList, AlertTriangle } from 'lucide-react';

const ROLE_MAP: Record<string, string> = {
  loptruong: 'Lớp trưởng', hoctap: 'Lớp phó Học tập', kyluat: 'Lớp phó Kỷ luật',
  vannghe: 'Lớp phó Văn nghệ', bithu: 'Bí thư', thuquy: 'Thủ quỹ',
};
const CAT_SCOPE: Record<string, ReportCategory[]> = {
  loptruong: ['Học Tập', 'Phong Trào', 'Kỷ Luật', 'Vệ Sinh', 'Văn Hóa & Đạo Đức'],
  hoctap: ['Học Tập'],
  kyluat: ['Phong Trào', 'Kỷ Luật', 'Vệ Sinh', 'Văn Hóa & Đạo Đức'],
  vannghe: ['Phong Trào'],
  bithu: ['Phong Trào', 'Kỷ Luật', 'Văn Hóa & Đạo Đức'],
};
import type { ReportCategory } from '../types';

const ALL_CATS: ReportCategory[] = ['Học Tập', 'Phong Trào', 'Kỷ Luật', 'Vệ Sinh', 'Văn Hóa & Đạo Đức'];

// Tính weekId theo trường (YYYY-SW<n>) từ 1 ngày bất kỳ + điểm neo Tuần 1 —
// PHẢI khớp đúng logic schoolWeekId_() ở backend và getWeekId() ở
// ConductReport.tsx, nếu không 3 nơi sẽ tính ra 3 số khác nhau cho cùng
// 1 ngày thực tế.
function mondayOf(date: Date): Date {
  const x = new Date(date); x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
}
function getWeekId(date: Date, anchorStr: string): string {
  const anchor = anchorStr ? new Date(anchorStr) : new Date(new Date().getFullYear(), 8, 7);
  const anchorMonday = mondayOf(anchor);
  const dMonday = mondayOf(date);
  const weekNum = Math.round((dMonday.getTime() - anchorMonday.getTime()) / (7 * 86400000)) + 1;
  return `${anchor.getFullYear()}-SW${weekNum}`;
}

// createdAt từ backend luôn ở dạng "dd/MM/yyyy HH:mm" (nowStr_() server) —
// parse đúng thành Date để so sánh thời gian thật, không dùng string compare
// (sai thứ tự mỗi khi trải qua ranh giới tháng/năm khác nhau).
function parseCreatedAt(s: string): Date {
  if (!s) return new Date(0);
  const [datePart, timePart = '00:00'] = s.split(' ');
  const [d, m, y] = datePart.split('/').map(Number);
  const [h, min] = timePart.split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, h || 0, min || 0);
}

export default function BCSStats() {
  const { appState } = useData();
  const { session } = useAuth();
  const reports = appState?.reports;
  const roster = appState?.roster || [];

  const [selectedWeek, setSelectedWeek] = useState('');

  const officerReports = reports?.officerReports || [];
  const treasuryReports = reports?.treasuryReports || [];

  // Điểm neo "Tuần 1" — cấu hình ở trang Tài khoản, dùng chung cho mọi tính
  // toán tuần trong file này. Khai báo trước allWeeks vì allWeeks cần dùng.
  const weekAnchor = appState?.weekAnchor || '';

  // Sinh SẴN toàn bộ tuần từ điểm neo đến hết tháng 5 năm học — trước đây
  // chỉ liệt kê tuần ĐÃ CÓ báo cáo thực tế, nên nếu Ban cán sự chưa nộp báo
  // cáo nào, dropdown trống hoàn toàn, GVCN không xem trước được cấu trúc
  // tuần để chuẩn bị. Đồng bộ cùng nguyên tắc với ConductReport.tsx.
  const allWeeks = useMemo(() => {
    const anchor = weekAnchor ? new Date(weekAnchor) : new Date(new Date().getFullYear(), 8, 7);
    const endYear = anchor.getMonth() >= 5 ? anchor.getFullYear() + 1 : anchor.getFullYear();
    const schoolYearEnd = new Date(endYear, 4, 31); // 31/05

    const ws = new Set<string>();
    for (let d = new Date(anchor); d.getTime() <= schoolYearEnd.getTime(); d.setDate(d.getDate() + 7)) {
      ws.add(getWeekId(d, weekAnchor));
    }
    // Đảm bảo mọi tuần ĐÃ CÓ báo cáo thực tế (kể cả ngoài khoảng năm học
    // chuẩn) vẫn luôn xuất hiện được.
    officerReports.forEach(r => ws.add(r.weekId));
    treasuryReports.forEach(r => ws.add(r.weekId));
    // Sort theo GIÁ TRỊ SỐ của tuần, không phải chuỗi — "SW10" < "SW2" theo
    // string sort nhưng 10 > 2 theo số thực.
    return [...ws].sort((a, b) => {
      const na = Number(a.match(/SW(-?\d+)$/)?.[1] ?? a);
      const nb = Number(b.match(/SW(-?\d+)$/)?.[1] ?? b);
      if (isNaN(na) || isNaN(nb)) return b.localeCompare(a); // fallback cho dữ liệu ISO week cũ
      return nb - na;
    });
  }, [officerReports, treasuryReports, weekAnchor]);

  const currentWeek = selectedWeek || appState?.currentWeek || allWeeks[0] || '';

  const weekOfficer = useMemo(() => officerReports.filter(r => r.weekId === currentWeek), [officerReports, currentWeek]);
  const weekTreasury = useMemo(() => treasuryReports.filter(r => r.weekId === currentWeek), [treasuryReports, currentWeek]);

  // Tổ trưởng từ roster
  const toTruongs = useMemo(() => roster.filter(u => /^to\d+$/.test(u.role)), [roster]);
  const nameOf = (id: string) => roster.find(u => u.id === id)?.name || id;
  const roleOf = (id: string) => roster.find(u => u.id === id)?.role || '';

  // Kiểm tra từng chức vụ ban cán sự đã nộp chưa
  const bcsOfficers = useMemo(() => roster.filter(u => ROLE_MAP[u.role]), [roster]);

  const officerStatus = useMemo(() => {
    return bcsOfficers.map(officer => {
      const requiredCats = CAT_SCOPE[officer.role] || [];
      const submitted = weekOfficer.filter(r => r.reporterId === officer.id);
      const submittedCats = submitted.map(r => r.category);
      const missingCats = requiredCats.filter(c => !submittedCats.includes(c));
      return { officer, requiredCats, submittedCats, missingCats, done: missingCats.length === 0 && requiredCats.length > 0 };
    });
  }, [bcsOfficers, weekOfficer]);

  // Tổ trưởng status
  const toTruongStatus = useMemo(() => {
    return toTruongs.map(tt => {
      const groupNo = Number(tt.role.slice(2));
      const submitted = weekOfficer.filter(r => r.reporterId === tt.id);
      const submittedCats = submitted.map(r => r.category);
      const missingCats = ALL_CATS.filter(c => !submittedCats.includes(c));
      return { tt, groupNo, submittedCats, missingCats, done: missingCats.length === 0 };
    }).sort((a, b) => a.groupNo - b.groupNo);
  }, [toTruongs, weekOfficer]);

  // Thủ quỹ
  const thuQuy = roster.find(u => u.role === 'thuquy');
  const thuQuyDone = thuQuy ? weekTreasury.some(r => r.reporterId === thuQuy.id) : false;

  // Hạng mục tổng hợp (ai đã nộp mỗi hạng mục)
  const catSummary = useMemo(() => {
    return ALL_CATS.map(cat => {
      const reps = weekOfficer.filter(r => r.category === cat);
      return { cat, count: reps.length, reporters: reps.map(r => ({ name: nameOf(r.reporterId), role: roleOf(r.reporterId), time: r.createdAt })) };
    });
  }, [weekOfficer, roster]);

  const totalRequired = officerStatus.length + toTruongStatus.length + (thuQuy ? 1 : 0);
  const totalDone = officerStatus.filter(s => s.done).length + toTruongStatus.filter(s => s.done).length + (thuQuyDone ? 1 : 0);
  const pct = totalRequired ? Math.round(totalDone / totalRequired * 100) : 0;

  const weekLabel = (wid: string) => {
    if (!wid) return '—';
    const m = wid.match(/^(\d{4})-SW(-?\d+)$/);
    if (!m) return wid; // dữ liệu tuần cũ (định dạng ISO week trước đây) — hiện nguyên văn thay vì crash
    const w = Number(m[2]);
    const anchor = weekAnchor ? new Date(weekAnchor) : new Date(Number(m[1]), 8, 7);
    const anchorMonday = new Date(anchor); anchorMonday.setHours(0,0,0,0);
    anchorMonday.setDate(anchorMonday.getDate() - ((anchorMonday.getDay() + 6) % 7));
    const mon = new Date(anchorMonday.getTime() + (w - 1) * 7 * 86400000);
    const sun = new Date(mon.getTime() + 6 * 86400000);
    const f = (d: Date) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
    return `Tuần ${w} · ${f(mon)}–${f(sun)}/${sun.getFullYear()}`;
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-5">
        {/* HEADER */}
        <div className="bg-primary-700 p-5 md:p-6 rounded-3xl border border-primary-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-sans font-bold text-white flex items-center gap-3"><ClipboardList size={28} className="text-amber-400" /> Tiến độ Báo cáo Tuần</h1>
            <p className="text-gray-400 mt-1 text-sm">Ban cán sự lớp · {weekLabel(currentWeek)}</p>
          </div>
          <select value={currentWeek} onChange={e => setSelectedWeek(e.target.value)} className="field bg-black/20 border-white/10 text-gray-100 text-sm w-full md:w-64">
            {allWeeks.length === 0 && <option value="">Chưa có dữ liệu</option>}
            {allWeeks.map(w => <option key={w} value={w}>{weekLabel(w)}</option>)}
          </select>
        </div>

        {/* PROGRESS TỔNG */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex justify-between items-center mb-3">
            <p className="font-bold text-gray-800">Tiến độ tổng thể</p>
            <p className="text-2xl font-bold text-primary-700">{totalDone}/{totalRequired} <span className="text-sm font-normal text-gray-400">đã hoàn thành</span></p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-primary-700 to-amber-600 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-right text-xs font-bold text-gray-400 mt-1">{pct}% hoàn thành</p>
        </div>

        {/* CẢNH BÁO CHƯA NỘP */}
        {(officerStatus.some(s => !s.done) || toTruongStatus.some(s => !s.done) || (thuQuy && !thuQuyDone)) && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-900 text-sm">Chưa hoàn thành báo cáo tuần</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {officerStatus.filter(s => !s.done).map(s => (
                  <span key={s.officer.id} className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[11px] font-bold rounded-full">
                    {s.officer.name} ({ROLE_MAP[s.officer.role]}) — còn {s.missingCats.length} hạng mục
                  </span>
                ))}
                {toTruongStatus.filter(s => !s.done).map(s => (
                  <span key={s.tt.id} className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[11px] font-bold rounded-full">
                    {s.tt.name} (Tổ {s.groupNo}) — còn {s.missingCats.length} hạng mục
                  </span>
                ))}
                {thuQuy && !thuQuyDone && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[11px] font-bold rounded-full">{thuQuy.name} (Thủ quỹ) — chưa nộp thu chi</span>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* BAN CÁN SỰ LỚP */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 font-bold text-gray-800 text-sm flex items-center gap-2"><Users size={16} className="text-primary-700" /> Ban cán sự lớp</div>
            <div className="divide-y divide-gray-50">
              {officerStatus.length === 0 && <p className="text-xs text-gray-400 italic px-5 py-4">Chưa phân chức vụ ban cán sự.</p>}
              {officerStatus.map(s => (
                <div key={s.officer.id} className="px-5 py-3">
                  <div className="flex justify-between items-start mb-1.5">
                    <div>
                      <p className="font-bold text-sm text-gray-900">{s.officer.name}</p>
                      <p className="text-[11px] text-gray-400">{ROLE_MAP[s.officer.role]}</p>
                    </div>
                    {s.done ? <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full"><CheckCircle2 size={12} /> Hoàn thành</span>
                    : <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full"><Clock size={12} /> Còn {s.missingCats.length}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {s.requiredCats.map(cat => (
                      <span key={cat} className={`px-2 py-0.5 text-[10px] font-bold rounded ${s.submittedCats.includes(cat) ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-400'}`}>
                        {s.submittedCats.includes(cat) ? '✓' : '○'} {cat}
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              {/* THỦ QUỸ */}
              {thuQuy && (
                <div className="px-5 py-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-sm text-gray-900">{thuQuy.name}</p>
                      <p className="text-[11px] text-gray-400">Thủ quỹ</p>
                    </div>
                    {thuQuyDone
                      ? <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full"><CheckCircle2 size={12} /> Đã nộp thu chi</span>
                      : <span className="flex items-center gap-1 text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full"><XCircle size={12} /> Chưa nộp</span>}
                  </div>
                  {thuQuyDone && weekTreasury.filter(r => r.reporterId === thuQuy.id).map(r => (
                    <div key={r.id} className="mt-2 text-[11px] text-gray-500 bg-gray-50 rounded p-2">
                      Số dư: <b className="text-gray-700">{r.balance.toLocaleString('vi-VN')}đ</b> · {r.createdAt}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* TỔ TRƯỞNG */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 font-bold text-gray-800 text-sm flex items-center gap-2"><Users size={16} className="text-blue-600" /> Tổ trưởng</div>
            <div className="divide-y divide-gray-50">
              {toTruongStatus.length === 0 && <p className="text-xs text-gray-400 italic px-5 py-4">Chưa có tổ trưởng trong hệ thống.</p>}
              {toTruongStatus.map(s => (
                <div key={s.tt.id} className="px-5 py-3">
                  <div className="flex justify-between items-start mb-1.5">
                    <div>
                      <p className="font-bold text-sm text-gray-900">{s.tt.name}</p>
                      <p className="text-[11px] text-gray-400">Tổ {s.groupNo}</p>
                    </div>
                    {s.done ? <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full"><CheckCircle2 size={12} /> Hoàn thành</span>
                    : <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full"><Clock size={12} /> Còn {s.missingCats.length}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {ALL_CATS.map(cat => (
                      <span key={cat} className={`px-2 py-0.5 text-[10px] font-bold rounded ${s.submittedCats.includes(cat) ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-400'}`}>
                        {s.submittedCats.includes(cat) ? '✓' : '○'} {cat.split(' ')[0]}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* TỔNG HỢP THEO HẠNG MỤC */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 font-bold text-gray-800 text-sm">Tổng hợp theo hạng mục</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-5 py-3 text-left">Hạng mục</th>
                  <th className="px-4 py-3 text-center w-24">Số báo cáo</th>
                  <th className="px-5 py-3 text-left">Người đã nộp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {catSummary.map(c => (
                  <tr key={c.cat} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-bold text-gray-800">{c.cat}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${c.count > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-400'}`}>{c.count}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {c.reporters.map((r, i) => (
                          <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-800 text-[10px] font-bold rounded-full">{r.name} · {r.time}</span>
                        ))}
                        {c.reporters.length === 0 && <span className="text-gray-300 text-xs italic">Chưa có</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* TIMELINE NỘP BÀI */}
        {weekOfficer.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 font-bold text-gray-800 text-sm flex items-center gap-2"><Clock size={15} className="text-gray-500" /> Thứ tự nộp báo cáo</div>
            <div className="divide-y divide-gray-50">
              {/* Sửa bug: createdAt lưu dạng "dd/MM/yyyy HH:mm" — so sánh
                  string trực tiếp (localeCompare cũ) cho thứ tự SAI mỗi khi
                  hai báo cáo trải qua ranh giới tháng/năm khác nhau (ví dụ
                  "03/01/2027" bị xếp trước "28/12/2026" vì "0" < "2" ở vị
                  trí đầu chuỗi). Parse đúng thành Date rồi so sánh timestamp. */}
              {[...weekOfficer].sort((a, b) => parseCreatedAt(a.createdAt).getTime() - parseCreatedAt(b.createdAt).getTime()).map((r, i) => (
                <div key={r.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="text-xs font-bold text-gray-400 w-5">{i+1}</span>
                  <span className="text-xs text-gray-500 w-32 shrink-0">{r.createdAt}</span>
                  <span className="font-bold text-sm text-gray-800">{nameOf(r.reporterId)}</span>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded-full">{r.category}</span>
                  {r.scope === 'group' && <span className="text-[10px] text-blue-600 font-bold">Tổ {r.groupNo}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}