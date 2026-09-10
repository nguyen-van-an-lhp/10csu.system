import React, { useState, useMemo, useCallback } from 'react';
import { Layout } from '../components/Layout';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../services/api';
import {
  BarChart3, AlertTriangle, CheckCircle2, Users, TrendingDown, Download,
  ChevronDown, Filter, Eye, Trash2, Edit3, X, Clock, FileText, Printer
} from 'lucide-react';
import { Modal } from '../components/ui';
import { exportConductReport } from '../lib/conductExport';
import type { ConductLogEntry, ConductSummary, User } from '../types';

// ============================================================================
// PARSE THỜI GIAN — log ghi dạng "dd/MM/yyyy HH:mm" (VN, từ nowStr_() server)
// ============================================================================
function parseLogTime(timeStr: string): Date {
  if (!timeStr) return new Date(0);
  if (timeStr.includes('T')) return new Date(timeStr); // ISO fallback
  const [datePart, timePart = '00:00'] = timeStr.split(' ');
  const [d, m, y] = datePart.split('/').map(Number);
  const [h, min] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}

// ============================================================================
// HỆ ĐÁNH SỐ TUẦN THEO TRƯỜNG
// ============================================================================
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
function weekLabel(wid: string): string {
  const m = wid.match(/^(\d{4})-SW(-?\d+)$/);
  if (!m) return wid;
  const [, , w] = m;
  return `Tuần ${w}`;
}
function weekRangeLabel(wid: string, anchorStr: string): string {
  const m = wid.match(/^(\d{4})-SW(-?\d+)$/);
  if (!m) return wid;
  const w = Number(m[2]);
  const anchor = anchorStr ? new Date(anchorStr) : new Date(Number(m[1]), 8, 7);
  const anchorMonday = mondayOf(anchor);
  const mon = new Date(anchorMonday.getTime() + (w - 1) * 7 * 86400000);
  const sun = new Date(mon.getTime() + 6 * 86400000);
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
  return `Tuần ${w} (${fmt(mon)} – ${fmt(sun)}/${sun.getFullYear()})`;
}

const MONTHS_VI = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const RANK_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  'TỐT':      { color: 'text-emerald-700', bg: 'bg-emerald-100', border: 'border-emerald-200' },
  'KHÁ':      { color: 'text-blue-700',    bg: 'bg-blue-100',    border: 'border-blue-200'    },
  'ĐẠT':      { color: 'text-amber-700',   bg: 'bg-amber-100',   border: 'border-amber-200'   },
  'CHƯA ĐẠT': { color: 'text-red-700',     bg: 'bg-red-100',     border: 'border-red-200'     },
};

function calcRank(normalFaults: number, downgrade: number, critical: boolean): string {
  if (critical) return 'CHƯA ĐẠT';
  let base = 0;
  if (normalFaults >= 4 && normalFaults <= 7) base = 1;
  else if (normalFaults >= 8 && normalFaults <= 10) base = 2;
  else if (normalFaults > 10) base = 3;
  return ['TỐT','KHÁ','ĐẠT','CHƯA ĐẠT'][Math.min(3, base + downgrade)];
}

function summarizeFiltered(logs: ConductLogEntry[], roster: User[]) {
  const map: Record<string, { name: string; group: number | null; raw: number; improve: number; downgrade: number; critical: boolean }> = {};
  roster.forEach(u => { map[u.id] = { name: u.name, group: u.group ?? null, raw: 0, improve: 0, downgrade: 0, critical: false }; });
  logs.forEach(l => {
    if (!map[l.studentId]) map[l.studentId] = { name: l.studentId, group: null, raw: 0, improve: 0, downgrade: 0, critical: false };
    const s = map[l.studentId];
    if (l.tier === 'fault') s.raw += l.points;
    else if (l.tier === 'improve') s.improve += l.points;
    else if (l.tier === 'downgrade') s.downgrade++;
    else if (l.tier === 'critical') s.critical = true;
  });
  return Object.entries(map).map(([id, s]) => {
    const maxErasable = Math.floor(s.improve / 2);
    const erased = Math.min(s.raw, maxErasable);
    const normal = Math.max(0, s.raw - erased);
    return { id, name: s.name, group: s.group, raw: s.raw, improve: s.improve, erased, normal, downgrade: s.downgrade, critical: s.critical, rank: calcRank(normal, s.downgrade, s.critical) };
  });
}

type FilterMode = 'all' | 'week' | 'month' | 'semester';
type ViewMode = 'class' | 'group' | 'student';

// ============================================================================
// COMPONENT CHÍNH
// ============================================================================
export default function ConductReport() {
  const { appState, refreshData } = useData();
  const { session } = useAuth();
  const { showToast } = useToast();
  
  const isGvcn = session?.role === 'gvcn';
  const currentUsername = session?.username; // Lấy ID tài khoản đang đăng nhập

  // --- BỘ LỌC ---
  const [filterMode, setFilterMode] = useState<FilterMode>('week');
  const [selectedWeek, setSelectedWeek] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedSemester, setSelectedSemester] = useState<1 | 2>(1);
  const [semMonths, setSemMonths] = useState<number[]>([9, 10, 11, 12]);
  const [viewMode, setViewMode] = useState<ViewMode>('class');
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [searchStudent, setSearchStudent] = useState('');

  // --- CHỈNH SỬA / XÓA LOG ---
  const [editingLog, setEditingLog] = useState<ConductLogEntry | null>(null);
  const [editNote, setEditNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // --- EXPORT ---
  const [exporting, setExporting] = useState(false);

  const conduct = appState?.conduct;
  const allLogs: ConductLogEntry[] = conduct?.logs || [];
  const roster: User[] = appState?.roster?.filter(u => u.role !== 'gvcn') || [];
  const catalog = conduct?.catalog;
  const weekAnchor = appState?.weekAnchor || '';

  const allWeeks = useMemo(() => {
    const anchor = weekAnchor ? new Date(weekAnchor) : new Date(new Date().getFullYear(), 8, 7);
    const endYear = anchor.getMonth() >= 5 ? anchor.getFullYear() + 1 : anchor.getFullYear();
    const schoolYearEnd = new Date(endYear, 4, 31);

    const ws = new Set<string>();
    for (let d = new Date(anchor); d.getTime() <= schoolYearEnd.getTime(); d.setDate(d.getDate() + 7)) {
      ws.add(getWeekId(d, weekAnchor));
    }
    allLogs.forEach(l => ws.add(getWeekId(parseLogTime(l.time), weekAnchor)));
    return [...ws].sort((a, b) => {
      const na = Number(a.match(/SW(-?\d+)$/)?.[1] || 0);
      const nb = Number(b.match(/SW(-?\d+)$/)?.[1] || 0);
      return nb - na;
    });
  }, [allLogs, weekAnchor]);

  const allMonths = useMemo(() => {
    const anchor = weekAnchor ? new Date(weekAnchor) : new Date(new Date().getFullYear(), 8, 7);
    const endYear = anchor.getMonth() >= 5 ? anchor.getFullYear() + 1 : anchor.getFullYear();
    const ms = new Set<string>();
    let y = anchor.getFullYear(), m = anchor.getMonth();
    while (y < endYear || (y === endYear && m <= 4)) {
      ms.add(`${y}-${m + 1}`);
      m++; if (m > 11) { m = 0; y++; }
    }
    allLogs.forEach(l => { const d = parseLogTime(l.time); ms.add(`${d.getFullYear()}-${d.getMonth() + 1}`); });
    return [...ms].sort((a, b) => {
      const [ya, ma] = a.split('-').map(Number);
      const [yb, mb] = b.split('-').map(Number);
      return yb - ya || mb - ma;
    });
  }, [allLogs, weekAnchor]);

  const activeWeek = selectedWeek || allWeeks[0] || '';
  const activeMonth = selectedMonth || allMonths[0] || '';

  const filteredLogs = useMemo(() => {
    if (filterMode === 'all') return allLogs;
    if (filterMode === 'week') return allLogs.filter(l => getWeekId(parseLogTime(l.time), weekAnchor) === activeWeek);
    if (filterMode === 'month') {
      const [y, m] = activeMonth.split('-').map(Number);
      return allLogs.filter(l => { const d = parseLogTime(l.time); return d.getFullYear() === y && d.getMonth() + 1 === m; });
    }
    return allLogs.filter(l => {
      const d = parseLogTime(l.time);
      return semMonths.includes(d.getMonth() + 1);
    });
  }, [allLogs, filterMode, activeWeek, activeMonth, semMonths, weekAnchor]);

  const studentStats = useMemo(() => summarizeFiltered(filteredLogs, roster), [filteredLogs, roster]);

  const classStats = useMemo(() => {
    const total = studentStats.length;
    const byCond: Record<string, number> = { 'TỐT': 0, 'KHÁ': 0, 'ĐẠT': 0, 'CHƯA ĐẠT': 0 };
    studentStats.forEach(s => { byCond[s.rank] = (byCond[s.rank] || 0) + 1; });
    const warned = studentStats.filter(s => s.normal >= 3 && s.rank !== 'CHƯA ĐẠT');
    const critical = studentStats.filter(s => s.rank === 'CHƯA ĐẠT' || s.critical);
    return { total, byCond, warned, critical, avgFaults: total ? +(filteredLogs.filter(l => l.tier === 'fault').reduce((a, l) => a + l.points, 0) / total).toFixed(1) : 0 };
  }, [studentStats, filteredLogs]);

  const groupStats = useMemo(() => {
    const groups: Record<number, typeof studentStats> = {};
    studentStats.forEach(s => {
      const g = s.group ?? 0;
      if (!groups[g]) groups[g] = [];
      groups[g].push(s);
    });
    return Object.entries(groups).sort((a, b) => Number(a[0]) - Number(b[0])).map(([gn, members]) => {
      const byCond: Record<string, number> = { 'TỐT': 0, 'KHÁ': 0, 'ĐẠT': 0, 'CHƯA ĐẠT': 0 };
      members.forEach(m => { byCond[m.rank]++; });
      const avgF = members.length ? +(members.reduce((a, m) => a + m.normal, 0) / members.length).toFixed(1) : 0;
      const warned = members.filter(m => m.normal >= 3 && m.rank !== 'CHƯA ĐẠT').length;
      return { groupNo: Number(gn), members, byCond, avgF, warned };
    });
  }, [studentStats]);

  const displayStudents = useMemo(() => {
    let list = studentStats;
    if (viewMode === 'group' && selectedGroup !== null) list = list.filter(s => s.group === selectedGroup);
    if (searchStudent) list = list.filter(s => s.name.toLowerCase().includes(searchStudent.toLowerCase()));
    return list.sort((a, b) => b.normal - a.normal);
  }, [studentStats, viewMode, selectedGroup, searchStudent]);

  const handleEditLog = async () => {
    if (!editingLog) return;
    setIsProcessing(true);
    try {
      await api.call('CONDUCT_LOG_EDIT_NOTE', { id: editingLog.id, note: editNote });
      await refreshData(); showToast('Đã cập nhật ghi chú.', 'success'); setEditingLog(null);
    } catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  const handleDeleteLog = async (id: string) => {
    if (!confirm('Xóa giao dịch hạnh kiểm này? Không thể hoàn tác.')) return;
    try {
      await api.call('CONDUCT_LOG_DELETE', { id }); await refreshData();
      showToast('Đã xóa giao dịch.', 'success');
    } catch (err: any) { showToast(err.message, 'error'); }
  };

  const filterLabel = () => {
    if (filterMode === 'all') return 'Toàn bộ năm học';
    if (filterMode === 'week') return activeWeek ? weekRangeLabel(activeWeek, weekAnchor) : '';
    if (filterMode === 'month') {
      const [y, m] = activeMonth.split('-').map(Number);
      return `${MONTHS_VI[m - 1]} ${y}`;
    }
    return `Học kỳ ${selectedSemester} (${semMonths.map(m => `Tháng ${m}`).join(', ')})`;
  };

  // --- XUẤT WORD TOÀN LỚP ---
  const handleExportWord = async () => {
    setExporting(true);
    try {
      const rows = displayStudents.map((s, i) => ({
        stt: i + 1, name: s.name, group: s.group, raw: s.raw, erased: s.erased,
        normal: s.normal, downgrade: s.downgrade, critical: s.critical, rank: s.rank,
      }));
      await exportConductReport(rows, {
        filterLabel: filterLabel(),
        semester: filterMode === 'semester' ? `Học kỳ ${selectedSemester}` : undefined,
        schoolYear: '2026–2027',
        printDate: new Date().toLocaleDateString('vi-VN'),
        gvcn: 'Nguyễn Văn An',
      }, `BaoCaoHanhKiem_10CSU_${filterLabel().replace(/[^a-zA-Z0-9]/g, '_')}.docx`);
      showToast('Đã xuất file Word thành công!', 'success');
    } catch (err: any) {
      showToast('Lỗi xuất Word: ' + err.message + ' — Dùng chức năng In thay thế.', 'error');
      handlePrintReport();
    } finally { setExporting(false); }
  };

  const handlePrintReport = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const rankBadge = (r: string) => `<span style="padding:2px 6px;border-radius:4px;font-size:11px;font-weight:bold;background:${r==='TỐT'?'#d1fae5':r==='KHÁ'?'#dbeafe':r==='ĐẠT'?'#fef3c7':'#fee2e2'};color:${r==='TỐT'?'#065f46':r==='KHÁ'?'#1e40af':r==='ĐẠT'?'#92400e':'#991b1b'}">${r}</span>`;
    const tableRows = displayStudents.map((s, i) => `<tr style="border-bottom:1px solid #e5e7eb"><td style="padding:6px 8px;text-align:center">${i+1}</td><td style="padding:6px 8px;font-weight:bold">${s.name}</td><td style="padding:6px 8px;text-align:center">${s.group || '-'}</td><td style="padding:6px 8px;text-align:center">${s.raw}</td><td style="padding:6px 8px;text-align:center">${s.erased}</td><td style="padding:6px 8px;text-align:center;font-weight:bold;color:${s.normal>=8?'#dc2626':s.normal>=4?'#d97706':'#374151'}">${s.normal}</td><td style="padding:6px 8px;text-align:center">${s.downgrade||'-'}</td><td style="padding:6px 8px;text-align:center">${rankBadge(s.rank)}</td></tr>`).join('');
    w.document.write(`<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>Báo cáo Hạnh kiểm Tổng hợp</title><style>body{font-family:'Times New Roman',serif;font-size:13px;margin:40px;color:#111}h1{font-size:18px;text-align:center;margin:8px 0}h2{font-size:14px;text-align:center;margin:4px 0;font-weight:normal}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#f3f4f6;padding:7px 8px;border-bottom:2px solid #d1d5db;font-size:11px;text-align:center}@media print{@page{size:A4;margin:20mm}button{display:none}}</style></head><body>
    <div style="text-align:center;margin-bottom:16px"><p style="margin:2px 0;font-size:12px">SỞ GIÁO DỤC VÀ ĐÀO TẠO THÀNH PHỐ HỒ CHÍ MINH</p><p style="margin:2px 0;font-size:12px;font-weight:bold">TRƯỜNG THPT CHUYÊN LÊ HỒNG PHONG</p></div>
    <h1>BẢNG ĐÁNH GIÁ KẾT QUẢ RÈN LUYỆN TỔNG HỢP</h1>
    <h2>Lớp 10CSU — ${filterLabel()}</h2>
    <h2>GVCN: Nguyễn Văn An &nbsp;&nbsp; Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}</h2>
    <div style="display:flex;gap:32px;margin:16px 0;padding:12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px">
      <div><span style="font-size:11px;color:#6b7280">Tổng HS</span><br><b style="font-size:20px">${classStats.total}</b></div>
      <div><span style="font-size:11px;color:#6b7280">Tốt</span><br><b style="font-size:20px;color:#065f46">${classStats.byCond['TỐT']||0}</b></div>
      <div><span style="font-size:11px;color:#6b7280">Khá</span><br><b style="font-size:20px;color:#1e40af">${classStats.byCond['KHÁ']||0}</b></div>
      <div><span style="font-size:11px;color:#6b7280">Đạt</span><br><b style="font-size:20px;color:#92400e">${classStats.byCond['ĐẠT']||0}</b></div>
      <div><span style="font-size:11px;color:#6b7280">Chưa đạt</span><br><b style="font-size:20px;color:#991b1b">${classStats.byCond['CHƯA ĐẠT']||0}</b></div>
    </div>
    <table><thead><tr><th>STT</th><th>Họ và tên</th><th>Tổ</th><th>Lỗi thô</th><th>Đã xóa</th><th>Lỗi còn lại</th><th>Hạ bậc</th><th>Xếp loại</th></tr></thead><tbody>${tableRows}</tbody></table>
    ${classStats.warned.length ? `<div style="margin-top:16px;padding:10px;background:#fffbeb;border:1px solid #fcd34d;border-radius:6px"><b>⚠ Cảnh báo (${classStats.warned.length} học sinh có từ 3 lỗi, chưa rơi vào Chưa đạt):</b><br>${classStats.warned.map(s=>`${s.name} (Tổ ${s.group||'?'}) — ${s.normal} lỗi`).join(', ')}</div>` : ''}
    <div style="margin-top:40px;text-align:right"><p>TP. Hồ Chí Minh, ngày ${new Date().getDate()} tháng ${new Date().getMonth()+1} năm ${new Date().getFullYear()}</p><p style="margin-top:4px"><b>Giáo viên chủ nhiệm</b></p><p style="margin-top:40px"><b>Nguyễn Văn An</b></p></div>
    <script>window.print();</script></body></html>`);
    w.document.close();
  };

  // --- XUẤT HTML/PDF BÁO CÁO CHI TIẾT CÁ NHÂN HỌC SINH ---
  const handlePrintStudent = (s: any) => {
    const studentLogs = filteredLogs.filter(l => l.studentId === s.id);
    const w = window.open('', '_blank');
    if (!w) return;
    
    const rankBadge = (r: string) => `<span style="padding:4px 8px;border-radius:6px;font-size:13px;font-weight:bold;background:${r==='TỐT'?'#d1fae5':r==='KHÁ'?'#dbeafe':r==='ĐẠT'?'#fef3c7':'#fee2e2'};color:${r==='TỐT'?'#065f46':r==='KHÁ'?'#1e40af':r==='ĐẠT'?'#92400e':'#991b1b'}">${r}</span>`;
    
    let logRows = '';
    if (studentLogs.length === 0) {
      logRows = `<tr><td colSpan="5" style="padding:16px;text-align:center;color:#6b7280;font-style:italic">Không ghi nhận vi phạm nào trong thời gian này.</td></tr>`;
    } else {
      logRows = studentLogs.map((l, i) => `
        <tr style="border-bottom:1px solid #f3f4f6">
          <td style="padding:8px;text-align:center">${i+1}</td>
          <td style="padding:8px;text-align:center;white-space:nowrap">${l.time}</td>
          <td style="padding:8px;font-weight:bold;color:#374151">${l.text}</td>
          <td style="padding:8px;text-align:center;font-weight:bold;color:${l.tier === 'improve' ? '#059669' : '#dc2626'}">${l.tier === 'improve' ? '+' : ''}${l.points}</td>
          <td style="padding:8px;color:#6b7280;font-style:italic;font-size:12px">${l.note || '-'}</td>
        </tr>
      `).join('');
    }

    w.document.write(`<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>Báo cáo Cá nhân - ${s.name}</title><style>body{font-family:'Times New Roman',serif;font-size:14px;margin:40px;color:#111}h1{font-size:20px;text-align:center;margin:12px 0}h2{font-size:15px;text-align:center;margin:4px 0;font-weight:normal}table{width:100%;border-collapse:collapse;margin-top:24px}th{background:#f3f4f6;padding:10px 8px;border-bottom:2px solid #d1d5db;font-size:13px;text-align:center}td{vertical-align:top}@media print{@page{size:A4;margin:20mm}button{display:none}}</style></head><body>
    <div style="text-align:center;margin-bottom:20px"><p style="margin:2px 0;font-size:13px">SỞ GIÁO DỤC VÀ ĐÀO TẠO THÀNH PHỐ HỒ CHÍ MINH</p><p style="margin:2px 0;font-size:13px;font-weight:bold">TRƯỜNG THPT CHUYÊN LÊ HỒNG PHONG</p></div>
    
    <h1>BÁO CÁO KẾT QUẢ RÈN LUYỆN CÁ NHÂN</h1>
    <h2>Học sinh: <b>${s.name}</b> &nbsp;|&nbsp; Tổ: <b>${s.group || 'Chưa phân'}</b> &nbsp;|&nbsp; Lớp: <b>10CSU</b></h2>
    <h2 style="color:#4b5563">Giai đoạn: ${filterLabel()}</h2>
    
    <div style="display:flex;justify-content:space-around;margin:24px 0;padding:16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;text-align:center">
      <div><span style="font-size:12px;color:#6b7280;display:block;margin-bottom:4px">Lỗi thô</span><b style="font-size:22px">${s.raw}</b></div>
      <div><span style="font-size:12px;color:#6b7280;display:block;margin-bottom:4px">Đã bù điểm</span><b style="font-size:22px;color:#059669">${s.erased}</b></div>
      <div><span style="font-size:12px;color:#6b7280;display:block;margin-bottom:4px">Lỗi còn lại</span><b style="font-size:22px;color:${s.normal>=8?'#dc2626':s.normal>=4?'#d97706':'#111'}">${s.normal}</b></div>
      <div><span style="font-size:12px;color:#6b7280;display:block;margin-bottom:4px">Hạ bậc vi phạm</span><b style="font-size:22px;color:#d97706">${s.downgrade}</b></div>
      <div><span style="font-size:12px;color:#6b7280;display:block;margin-bottom:8px">Xếp loại</span>${rankBadge(s.rank)}</div>
    </div>

    <h3 style="font-size:15px;margin-bottom:8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px">Chi tiết nhật ký vi phạm & hoạt động</h3>
    <table>
      <thead><tr>
        <th style="width:5%">STT</th>
        <th style="width:15%">Thời gian</th>
        <th style="width:40%;text-align:left">Nội dung</th>
        <th style="width:10%">Điểm</th>
        <th style="width:30%;text-align:left">Ghi chú / Minh chứng</th>
      </tr></thead>
      <tbody>${logRows}</tbody>
    </table>
    
    <div style="margin-top:40px;text-align:right">
      <p>TP. Hồ Chí Minh, ngày ${new Date().getDate()} tháng ${new Date().getMonth()+1} năm ${new Date().getFullYear()}</p>
      <p style="margin-top:4px"><b>Giáo viên chủ nhiệm</b></p>
      <p style="margin-top:60px"><b>Nguyễn Văn An</b></p>
    </div>
    <script>window.print();</script></body></html>`);
    w.document.close();
  };

  if (!conduct) return <Layout><div className="p-10 text-center text-gray-400 italic">Đang tải dữ liệu hạnh kiểm...</div></Layout>;

  const TABS: { id: FilterMode; label: string }[] = [
    { id: 'week', label: 'Tuần' }, { id: 'month', label: 'Tháng' },
    { id: 'semester', label: 'Học kỳ' }, { id: 'all', label: 'Toàn năm' },
  ];

  return (
    <Layout>
      <div className="space-y-5">

        {/* ── HEADER ─────────────────────────────────────────────── */}
        <div className="bg-primary-700 p-5 md:p-6 rounded-3xl border border-primary-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-sans font-bold text-white flex items-center gap-3"><BarChart3 size={28} className="text-amber-400" /> Báo cáo Hạnh kiểm 10CSU</h1>
            <p className="text-gray-400 mt-1 text-sm">{filterLabel()} · {classStats.total} học sinh · {filteredLogs.length} giao dịch</p>
          </div>
          {isGvcn && (
            <button onClick={handleExportWord} disabled={exporting} className="btn-primary shrink-0">
              <Download size={16} /> {exporting ? 'Đang tạo file...' : 'Xuất Word Tổng hợp (.docx)'}
            </button>
          )}
        </div>

        {/* ── BỘ LỌC ─────────────────────────────────────────────── */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Filter size={15} className="text-gray-400" />
            <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
              {TABS.map(t => (
                <button key={t.id} onClick={() => setFilterMode(t.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${filterMode === t.id ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500 hover:text-gray-800'}`}>{t.label}</button>
              ))}
            </div>

            {filterMode === 'week' && (
              <select value={activeWeek} onChange={e => setSelectedWeek(e.target.value)} className="field flex-1 max-w-xs text-xs">
                {allWeeks.map(w => <option key={w} value={w}>{weekRangeLabel(w, weekAnchor)}</option>)}
                {allWeeks.length === 0 && <option value="">Chưa có dữ liệu</option>}
              </select>
            )}
            {filterMode === 'month' && (
              <select value={activeMonth} onChange={e => setSelectedMonth(e.target.value)} className="field flex-1 max-w-xs text-xs">
                {allMonths.map(m => { const [y, mo] = m.split('-').map(Number); return <option key={m} value={m}>{MONTHS_VI[mo-1]} {y}</option>; })}
                {allMonths.length === 0 && <option value="">Chưa có dữ liệu</option>}
              </select>
            )}
            {filterMode === 'semester' && (
              <div className="flex items-center gap-2 flex-wrap">
                <select value={selectedSemester} onChange={e => { const v = Number(e.target.value) as 1|2; setSelectedSemester(v); setSemMonths(v === 1 ? [9,10,11,12] : [1,2,3,4,5]); }} className="field text-xs w-auto">
                  <option value={1}>Học kỳ 1</option><option value={2}>Học kỳ 2</option>
                </select>
                <span className="text-xs text-gray-500">Tháng gộp:</span>
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                  <label key={m} className={`px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${semMonths.includes(m) ? 'bg-primary-700 text-white border-primary-700' : 'bg-white text-gray-400 border-gray-200'}`}>
                    <input type="checkbox" className="hidden" checked={semMonths.includes(m)} onChange={() => setSemMonths(p => p.includes(m) ? p.filter(x => x !== m) : [...p, m].sort((a,b)=>a-b))} /> T{m}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100">
            <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
              {([['class','Toàn lớp'],['group','Theo tổ'],['student','Cá nhân']] as [ViewMode, string][]).map(([v, l]) => (
                <button key={v} onClick={() => setViewMode(v)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${viewMode === v ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500 hover:text-gray-800'}`}><Eye size={12} className="inline mr-1" />{l}</button>
              ))}
            </div>
            {viewMode === 'group' && (
              <select value={selectedGroup ?? ''} onChange={e => setSelectedGroup(e.target.value ? Number(e.target.value) : null)} className="field text-xs w-auto">
                <option value="">Tất cả tổ</option>
                {[1,2,3,4,5,6,7,8].map(g => <option key={g} value={g}>Tổ {g}</option>)}
              </select>
            )}
            <input type="text" placeholder="Tìm học sinh..." value={searchStudent} onChange={e => setSearchStudent(e.target.value)} className="field text-xs flex-1 max-w-xs" />
          </div>
        </div>

        {/* ── DASHBOARD CARDS ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: 'Tổng HS', value: classStats.total, color: 'text-gray-900', sub: '' },
            { label: 'Xếp loại Tốt', value: classStats.byCond['TỐT'] || 0, color: 'text-emerald-700', sub: `${Math.round(((classStats.byCond['TỐT']||0)/Math.max(1,classStats.total))*100)}%` },
            { label: 'Xếp loại Khá', value: classStats.byCond['KHÁ'] || 0, color: 'text-blue-700', sub: `${Math.round(((classStats.byCond['KHÁ']||0)/Math.max(1,classStats.total))*100)}%` },
            { label: 'Xếp loại Đạt', value: classStats.byCond['ĐẠT'] || 0, color: 'text-amber-700', sub: `${Math.round(((classStats.byCond['ĐẠT']||0)/Math.max(1,classStats.total))*100)}%` },
            { label: 'Chưa đạt', value: classStats.byCond['CHƯA ĐẠT'] || 0, color: 'text-red-700', sub: `${Math.round(((classStats.byCond['CHƯA ĐẠT']||0)/Math.max(1,classStats.total))*100)}%` },
            { label: 'Trung bình lỗi/HS', value: classStats.avgFaults, color: classStats.avgFaults >= 4 ? 'text-amber-700' : 'text-gray-700', sub: '' },
          ].map((c, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 text-center">
              <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wide">{c.label}</p>
              <p className={`text-3xl font-bold mt-1 ${c.color}`}>{c.value}</p>
              {c.sub && <p className="text-xs text-gray-400 font-bold">{c.sub}</p>}
            </div>
          ))}
        </div>

        {/* ── CẢNH BÁO ─────────────────────────────────────────────── */}
        {(classStats.critical.length > 0 || classStats.warned.length > 0) && (
          <div className="space-y-2">
            {classStats.critical.length > 0 && (
              <div className="p-4 bg-primary-50 border border-primary-200 rounded-2xl flex items-start gap-3">
                <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-red-900 text-sm">🚨 CHƯA ĐẠT ({classStats.critical.length} học sinh)</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {classStats.critical.map(s => <span key={s.id} className="px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-[11px] font-bold">{s.name} — Tổ {s.group || '?'} ({s.normal} lỗi)</span>)}
                  </div>
                </div>
              </div>
            )}
            {classStats.warned.length > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-900 text-sm">⚠ Cảnh báo — Sắp mất hạng ({classStats.warned.length} học sinh)</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {classStats.warned.map(s => <span key={s.id} className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[11px] font-bold">{s.name} — Tổ {s.group || '?'} ({s.normal} lỗi)</span>)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── BẢNG THEO TỔ (khi viewMode = group) ─────────────────── */}
        {viewMode === 'group' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {groupStats.filter(g => selectedGroup === null || g.groupNo === selectedGroup).map(g => (
              <div key={g.groupNo} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${g.byCond['CHƯA ĐẠT'] ? 'border-red-200' : g.warned ? 'border-amber-200' : 'border-gray-200'}`}>
                <div className={`px-4 py-3 font-bold text-sm flex justify-between items-center ${g.byCond['CHƯA ĐẠT'] ? 'bg-red-50' : g.warned ? 'bg-amber-50' : 'bg-gray-50'}`}>
                  <span>Tổ {g.groupNo === 0 ? 'Chưa phân' : g.groupNo}</span>
                  <span className="text-xs font-normal text-gray-500">{g.members.length} HS · TB {g.avgF} lỗi</span>
                </div>
                <div className="px-4 py-3 flex gap-4 text-xs border-b border-gray-100">
                  {(['TỐT','KHÁ','ĐẠT','CHƯA ĐẠT'] as string[]).map(r => (
                    <div key={r} className="text-center">
                      <span className={`block font-bold text-lg ${RANK_CONFIG[r]?.color}`}>{g.byCond[r] || 0}</span>
                      <span className="text-gray-400">{r === 'CHƯA ĐẠT' ? 'C.ĐẠT' : r}</span>
                    </div>
                  ))}
                </div>
                <div className="divide-y divide-gray-50">
                  {g.members.sort((a,b)=>b.normal-a.normal).slice(0, 5).map(m => (
                    <div key={m.id} className="px-4 py-2 flex justify-between items-center">
                      <span className="text-xs text-gray-700 truncate">{m.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${RANK_CONFIG[m.rank]?.bg} ${RANK_CONFIG[m.rank]?.color}`}>{m.normal}L · {m.rank}</span>
                    </div>
                  ))}
                  {g.members.length > 5 && <p className="text-center text-[10px] text-gray-400 py-2">+{g.members.length - 5} học sinh nữa</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── BẢNG CHI TIẾT HỌC SINH ───────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2"><Users size={16} className="text-primary-700" /> Bảng chi tiết học sinh ({displayStudents.length})</h2>
          </div>

          {/* Mobile: card */}
          <div className="grid gap-2 p-3 md:hidden">
            {displayStudents.map((s, i) => {
              const cfg = RANK_CONFIG[s.rank];
              const studentLogs = filteredLogs.filter(l => l.studentId === s.id);
              // Kiểm tra xem user hiện tại có phải là GVCN hoặc chính là HS của record này hay không
              const canViewDetail = isGvcn || s.id === currentUsername;
              
              return (
                <div key={s.id} className={`rounded-xl border p-3 ${s.rank === 'CHƯA ĐẠT' ? 'border-red-200 bg-red-50/30' : s.normal >= 3 ? 'border-amber-200 bg-amber-50/20' : 'border-gray-200'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-sm text-gray-900 flex items-center gap-2">
                        {i+1}. {s.name} 
                        {canViewDetail && (
                           <button onClick={() => handlePrintStudent(s)} className="text-primary-600 hover:bg-primary-50 p-1 rounded-full"><Printer size={13}/></button>
                        )}
                      </p>
                      <p className="text-[11px] text-gray-500">Tổ {s.group || '?'}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg?.bg} ${cfg?.color}`}>{s.rank}</span>
                  </div>
                  <div className="flex gap-3 mt-2 text-[11px] font-bold text-gray-600">
                    <span>Lỗi: {s.normal}</span>
                    {s.erased > 0 && <span className="text-emerald-600">Đã xóa: {s.erased}</span>}
                    {s.downgrade > 0 && <span className="text-amber-600">Hạ bậc: {s.downgrade}</span>}
                  </div>
                  
                  {studentLogs.length > 0 && canViewDetail && (
                    <details className="mt-2">
                      <summary className="text-[11px] text-primary-600 font-medium cursor-pointer">Xem chi tiết {studentLogs.length} vi phạm</summary>
                      <div className="space-y-1 mt-1">
                        {studentLogs.map(l => (
                          <div key={l.id} className="flex justify-between items-start text-[10px] bg-gray-50 rounded p-1.5">
                            <span className="text-gray-600 flex-1 mr-2"><b className="font-medium">{l.time}</b>: {l.text}</span>
                            
                            {isGvcn && (
                              <div className="flex gap-1">
                                <button onClick={() => { setEditingLog(l); setEditNote(l.note); }} className="text-gray-400 hover:text-blue-500"><Edit3 size={12} /></button>
                                <button onClick={() => handleDeleteLog(l.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-3 w-8">#</th>
                  <th className="px-4 py-3">Họ và tên</th>
                  <th className="px-3 py-3 text-center w-12">Tổ</th>
                  <th className="px-3 py-3 text-center w-20">Lỗi thô</th>
                  <th className="px-3 py-3 text-center w-20">Đã xóa</th>
                  <th className="px-3 py-3 text-center w-24 border-l border-gray-100">Lỗi còn</th>
                  <th className="px-3 py-3 text-center w-20">Hạ bậc</th>
                  <th className="px-3 py-3 text-center w-28 border-l border-gray-100">Xếp loại</th>
                  <th className="px-4 py-3 w-32 text-right">Lịch sử cá nhân</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayStudents.map((s, i) => {
                  const cfg = RANK_CONFIG[s.rank];
                  const studentLogs = filteredLogs.filter(l => l.studentId === s.id);
                  const canViewDetail = isGvcn || s.id === currentUsername;

                  return (
                    <React.Fragment key={s.id}>
                      <tr className={`hover:bg-gray-50 ${s.rank === 'CHƯA ĐẠT' ? 'bg-red-50/30' : s.normal >= 3 ? 'bg-amber-50/20' : ''}`}>
                        <td className="px-4 py-2.5 text-gray-400 text-xs">{i+1}</td>
                        <td className="px-4 py-2.5 font-bold text-gray-900">{s.name}</td>
                        <td className="px-3 py-2.5 text-center text-gray-600">{s.group || '-'}</td>
                        <td className="px-3 py-2.5 text-center text-gray-600">{s.raw}</td>
                        <td className="px-3 py-2.5 text-center text-emerald-600 font-bold">{s.erased || '-'}</td>
                        <td className={`px-3 py-2.5 text-center border-l border-gray-100 font-bold text-lg ${s.normal >= 8 ? 'text-primary-600' : s.normal >= 4 ? 'text-amber-600' : 'text-gray-700'}`}>{s.normal}</td>
                        <td className="px-3 py-2.5 text-center text-amber-600 font-bold">{s.downgrade || '-'}</td>
                        <td className="px-3 py-2.5 text-center border-l border-gray-100">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide ${cfg?.bg} ${cfg?.color}`}>{s.rank}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-gray-400">
                           {canViewDetail ? (
                             <div className="flex items-center justify-end gap-2">
                               <span>{studentLogs.length} vi phạm</span>
                               <button onClick={() => handlePrintStudent(s)} className="text-primary-600 hover:text-primary-800 p-1 bg-primary-50 rounded transition" title="Xuất báo cáo chi tiết cá nhân">
                                 <FileText size={15} />
                               </button>
                             </div>
                           ) : (
                             <span>-</span>
                           )}
                        </td>
                      </tr>
                      {/* Inline log rows - GVCN hoặc chính HS đó mới thấy */}
                      {canViewDetail && studentLogs.length > 0 && (
                        <tr>
                          <td colSpan={9} className="px-4 pb-3">
                            <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                              {studentLogs.map(l => (
                                <div key={l.id} className="flex items-start gap-3 px-3 py-2 border-b border-gray-100 last:border-none hover:bg-white">
                                  <Clock size={12} className="text-gray-300 mt-0.5 shrink-0" />
                                  <span className="text-[10px] text-gray-500 w-24 shrink-0">{l.time}</span>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${l.tier === 'fault' ? 'bg-gray-200 text-gray-700' : l.tier === 'downgrade' ? 'bg-amber-100 text-amber-800' : l.tier === 'critical' ? 'bg-primary-100 text-primary-700' : 'bg-emerald-100 text-emerald-800'}`}>{l.points}đ</span>
                                  <span className="text-[11px] text-gray-700 flex-1">{l.text}</span>
                                  <span className="text-[10px] text-gray-400 italic flex-1 truncate">{l.note}</span>
                                  
                                  {isGvcn && (
                                    <div className="flex gap-1 shrink-0">
                                      <button onClick={() => { setEditingLog(l); setEditNote(l.note); }} className="p-1 text-gray-400 hover:text-blue-500"><Edit3 size={12} /></button>
                                      <button onClick={() => handleDeleteLog(l.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL SỬA GHI CHÚ */}
      <Modal isOpen={!!editingLog} onClose={() => setEditingLog(null)} title="Sửa ghi chú giao dịch">
        {editingLog && (
          <div className="space-y-3">
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-600">
              <p className="font-bold text-gray-800">{editingLog.text}</p>
              <p className="mt-0.5">{editingLog.time} · {editingLog.points} điểm</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700">Ghi chú / Minh chứng</label>
              <textarea rows={3} value={editNote} onChange={e => setEditNote(e.target.value)} className="field" />
            </div>
            <button onClick={handleEditLog} disabled={isProcessing} className="btn-primary w-full">{isProcessing ? 'Đang lưu...' : 'Lưu ghi chú'}</button>
          </div>
        )}
      </Modal>
    </Layout>
  );
}