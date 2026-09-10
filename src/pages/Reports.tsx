import React, { useState, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { MagicCard, Modal } from '../components/ui';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../services/api';
import { fileToBase64 } from '../lib/file';
import { compressImage } from '../lib/image';
import { cn, groupByMonth } from '../lib/utils';
import {
  ClipboardList, Wallet, Flag, Ghost, Plus, CheckCircle2, XCircle, EyeOff, Eye,
  Lock, Globe, Send, AlertTriangle, TrendingUp, TrendingDown, Image as ImageIcon,
  Ban, X, Paperclip, ThumbsUp, ThumbsDown, Filter, ChevronDown, ChevronUp
} from 'lucide-react';
import type { ReportCategory, Complaint, Confession, OfficerReport, FundTransaction, FundPeriod } from '../types';

const CATEGORY_COLOR: Record<string, string> = {
  'Học Tập': 'bg-blue-50 text-blue-800 border-blue-200',
  'Phong Trào': 'bg-emerald-50 text-emerald-800 border-emerald-200',
  'Kỷ Luật': 'bg-primary-50 text-primary-700 border-primary-200',
  'Vệ Sinh': 'bg-amber-50 text-amber-800 border-amber-200',
  'Văn Hóa & Đạo Đức': 'bg-purple-50 text-purple-800 border-purple-200',
};

export default function Reports() {
  const { appState, refreshData } = useData();
  const { session } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<'weekly' | 'treasury' | 'complaint' | 'confession'>('weekly');

  const isGvcn = session?.role === 'gvcn';
  const reports = appState?.reports;
  const roster = appState?.roster || [];
  const nameOf = (id: string) => roster.find(u => u.id === id)?.name || id;

  const tabs = [
    { id: 'weekly', label: 'Báo cáo tuần', icon: ClipboardList },
    { id: 'treasury', label: 'Quỹ lớp', icon: Wallet },
    { id: 'complaint', label: 'Tố cáo', icon: Flag },
    { id: 'confession', label: 'Confession', icon: Ghost },
  ] as const;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-primary-700 p-5 md:p-6 rounded-3xl border border-primary-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-sans font-bold text-white flex items-center gap-3"><ClipboardList size={28} className="text-amber-400" /> Sinh hoạt lớp</h1>
            <p className="text-gray-400 mt-1 text-sm">Báo cáo tuần Ban cán sự, quỹ lớp, tố cáo, confession</p>
          </div>
          <div className="flex flex-wrap bg-black/20 p-1.5 rounded-2xl w-full md:w-auto gap-1">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${tab === t.id ? 'bg-white shadow-sm text-primary-700' : 'text-gray-400 hover:text-white'}`}>
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>
        </div>

        {!reports && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" /> Không nhận được dữ liệu báo cáo từ máy chủ. Kiểm tra đã tạo 4 sheet mới (OfficerReports, TreasuryReports, Complaints, Confessions) và triển khai Code.gs v14.0 chưa.
          </div>
        )}

        {tab === 'weekly' && <WeeklySection reports={reports} currentWeek={appState?.currentWeek} session={session} roster={roster} nameOf={nameOf} refreshData={refreshData} showToast={showToast} />}
        {tab === 'treasury' && <TreasurySection fundData={appState?.fundData} currentWeek={appState?.currentWeek} weekAnchor={appState?.weekAnchor} session={session} nameOf={nameOf} refreshData={refreshData} showToast={showToast} />}
        {tab === 'complaint' && <ComplaintSection reports={reports} session={session} roster={roster} nameOf={nameOf} isGvcn={isGvcn} refreshData={refreshData} showToast={showToast} />}
        {tab === 'confession' && <ConfessionSection reports={reports} isGvcn={isGvcn} refreshData={refreshData} showToast={showToast} />}
      </div>
    </Layout>
  );
}

// ---------------------------------------------------------------------------
// TAB 1: BÁO CÁO TUẦN THEO HẠNG MỤC
// ---------------------------------------------------------------------------
function WeeklySection({ reports, currentWeek, session, roster, nameOf, refreshData, showToast }: any) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [category, setCategory] = useState<ReportCategory | ''>('');
  const [content, setContent] = useState('');
  const [mentioned, setMentioned] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [onlyThisWeek, setOnlyThisWeek] = useState(true);

  const myRule = session?.role ? reports?.roleScope?.[session.role] : null;
  const canReport = !!myRule;

  const openModal = () => {
    setCategory(myRule?.categories?.length === 1 ? myRule.categories[0] : '');
    setContent(''); setMentioned([]); setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !content.trim()) return;
    setIsProcessing(true);
    try {
      await api.call('OFFICER_REPORT_CREATE', { category, content, mentionedStudents: mentioned });
      await refreshData(); showToast('Đã nộp báo cáo tuần!', 'success'); setIsModalOpen(false);
    } catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  const allReports: OfficerReport[] = reports?.officerReports || [];
  const filtered = onlyThisWeek ? allReports.filter(r => r.weekId === currentWeek) : allReports;
  const categories: ReportCategory[] = reports?.categories || [];
  // Sửa bug: Tổ trưởng có scope 'group' (chỉ báo cáo Tổ mình — theo
  // ROLE_REPORT_SCOPE ở backend) nhưng trước đây danh sách "nêu tên học sinh
  // liên quan" hiện TOÀN BỘ roster, cho phép Tổ trưởng nêu tên học sinh
  // không thuộc Tổ mình — không khớp phạm vi báo cáo. Nếu là Tổ trưởng, giới
  // hạn theo đúng group; các chức vụ scope 'class' vẫn thấy toàn lớp.
  const others = roster.filter((u: any) => {
    if (u.id === session?.username || u.role === 'gvcn') return false;
    if (myRule?.scope === 'group' && session?.groupNo) return u.group === session.groupNo;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-bold text-gray-600">
          <input type="checkbox" checked={onlyThisWeek} onChange={e => setOnlyThisWeek(e.target.checked)} /> Chỉ tuần này
        </label>
        {canReport && (
          <button onClick={openModal} className="btn-primary w-full md:w-auto"><Plus size={18} /> Nộp báo cáo tuần</button>
        )}
      </div>

      {categories.map(cat => {
        const items = filtered.filter(r => r.category === cat);
        return (
          <div key={cat} className="space-y-2">
            <h3 className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${CATEGORY_COLOR[cat] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>{cat}</h3>
            {items.length === 0 ? (
              <p className="text-xs text-gray-400 italic pl-1">Chưa có báo cáo.</p>
            ) : onlyThisWeek ? (
              <div className="grid gap-3">
                {items.map(r => <WeeklyReportCard key={r.id} r={r} nameOf={nameOf} />)}
              </div>
            ) : (
              <MonthAccordion items={items} nameOf={nameOf} />
            )}
          </div>
        );
      })}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nộp báo cáo tuần">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700">Hạng mục</label>
            <select required value={category} onChange={e => setCategory(e.target.value as ReportCategory)} className="field">
              <option value="" disabled>-- Chọn hạng mục --</option>
              {myRule?.categories?.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700">Nội dung báo cáo</label>
            <textarea required rows={5} value={content} onChange={e => setContent(e.target.value)} placeholder="Nhận xét tình hình tuần này..." className="field" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700">Nêu tên học sinh liên quan (tùy chọn)</label>
            <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-xl p-2 flex flex-wrap gap-1.5">
              {others.map((u: any) => (
                <label key={u.id} className={`px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${mentioned.includes(u.id) ? 'bg-primary-700 text-white border-primary-700' : 'bg-white text-gray-500 border-gray-200'}`}>
                  <input type="checkbox" className="hidden" checked={mentioned.includes(u.id)} onChange={() => setMentioned(p => p.includes(u.id) ? p.filter(x => x !== u.id) : [...p, u.id])} />
                  {u.name}
                </label>
              ))}
            </div>
          </div>
          <button type="submit" disabled={isProcessing} className="btn-primary w-full">{isProcessing ? 'Đang nộp...' : 'Nộp báo cáo'}</button>
        </form>
      </Modal>
    </div>
  );
}

// Thẻ 1 báo cáo tuần — tách riêng để dùng chung cho cả chế độ xem phẳng
// (Chỉ tuần này) lẫn chế độ gom theo tháng (Xem tất cả).
function WeeklyReportCard({ r, nameOf }: { r: OfficerReport; nameOf: (id: string) => string }) {
  return (
    <MagicCard className="p-4">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-sm font-bold text-gray-900">{nameOf(r.reporterId)}</p>
          <p className="text-[10px] text-gray-500 uppercase font-bold">{r.reporterRole} {r.scope === 'group' && r.groupNo ? `· Tổ ${r.groupNo}` : ''}</p>
        </div>
        <span className="text-[10px] text-gray-400">{r.createdAt}</span>
      </div>
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.content}</p>
      {r.mentionedStudents?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {r.mentionedStudents.map(id => <span key={id} className="px-2 py-0.5 bg-gray-100 rounded-full text-[10px] font-bold text-gray-600">{nameOf(id)}</span>)}
        </div>
      )}
    </MagicCard>
  );
}

// Cây thu gọn theo tháng — nhóm mới nhất tự mở sẵn, các nhóm cũ hơn gập
// lại, tránh render hàng trăm báo cáo cùng lúc khi xem toàn bộ lịch sử.
function MonthAccordion({ items, nameOf }: { items: OfficerReport[]; nameOf: (id: string) => string }) {
  const groups = useMemo(() => groupByMonth(items, r => r.createdAt), [items]);
  const [openKey, setOpenKey] = useState<string | null>(groups[0]?.key ?? null);

  return (
    <div className="space-y-2">
      {groups.map(g => {
        const isOpen = openKey === g.key;
        return (
          <div key={g.key} className="border border-gray-200 rounded-xl bg-gray-50/60 overflow-hidden">
            <button type="button" onClick={() => setOpenKey(isOpen ? null : g.key)}
              className="w-full px-3 py-2 flex justify-between items-center text-xs font-bold text-gray-600 hover:bg-gray-100 transition">
              <span>{g.label} ({g.items.length})</span>
              {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {isOpen && (
              <div className="p-3 pt-1 grid gap-3 border-t border-gray-200">
                {g.items.map(r => <WeeklyReportCard key={r.id} r={r} nameOf={nameOf} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TAB 2: QUỸ LỚP — SỔ CÁI KẾ TOÁN KÉP (thay thế TreasurySection cũ)
// ---------------------------------------------------------------------------
const FUND_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  draft:     { label: 'Chưa nộp', bg: 'bg-gray-100', text: 'text-gray-600' },
  submitted: { label: 'Chờ GVCN duyệt', bg: 'bg-amber-100', text: 'text-amber-700' },
  approved:  { label: 'Đã khóa sổ', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  rejected:  { label: 'Bị từ chối', bg: 'bg-red-100', text: 'text-red-700' },
};
const PIE_COLORS = ['#0284c7', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

function extractDriveIdFund(url: string) { const m = url.match(/id=([a-zA-Z0-9_-]+)/); return m ? m[1] : null; }

// Bar chart Thu/Chi theo tuần — HTML/CSS thuần (cột là div, chiều cao theo
// %), không phụ thuộc thư viện biểu đồ ngoài.
function SimpleBarChart({ data, vnd }: { data: { week: string; thu: number; chi: number }[], vnd: (n: number) => string }) {
  const max = Math.max(1, ...data.map(d => Math.max(d.thu, d.chi)));
  return (
    <MagicCard className="p-4">
      <p className="text-sm font-bold text-gray-800 mb-4">Thu — Chi theo tuần</p>
      <div className="flex items-end justify-between gap-2 h-[180px]">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
            <div className="flex items-end gap-0.5 h-full w-full justify-center">
              <div className="w-1/3 bg-emerald-500 rounded-t transition-all hover:bg-emerald-600" style={{ height: `${(d.thu / max) * 100}%`, minHeight: d.thu > 0 ? '2px' : '0' }} title={`Thu: ${vnd(d.thu)}`} />
              <div className="w-1/3 bg-red-500 rounded-t transition-all hover:bg-red-600" style={{ height: `${(d.chi / max) * 100}%`, minHeight: d.chi > 0 ? '2px' : '0' }} title={`Chi: ${vnd(d.chi)}`} />
            </div>
            <span className="text-[9px] text-gray-400 font-bold whitespace-nowrap">{d.week}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3 justify-center text-[11px] font-bold">
        <span className="flex items-center gap-1.5 text-gray-600"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Thu</span>
        <span className="flex items-center gap-1.5 text-gray-600"><span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> Chi</span>
      </div>
    </MagicCard>
  );
}

// Donut chart cơ cấu chi tiêu — SVG thuần, mỗi lát cắt là 1 <circle> xoay
// bằng stroke-dasharray/stroke-dashoffset, không phụ thuộc thư viện ngoài.
function SimpleDonutChart({ data, vnd }: { data: { name: string; value: number }[], vnd: (n: number) => string }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const radius = 60, circumference = 2 * Math.PI * radius;
  let offsetAcc = 0;
  return (
    <MagicCard className="p-4">
      <p className="text-sm font-bold text-gray-800 mb-4">Cơ cấu chi tiêu theo hạng mục</p>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 160 160" className="w-36 h-36 shrink-0 -rotate-90">
          {data.map((d, i) => {
            const frac = d.value / total;
            const dash = frac * circumference;
            const offset = offsetAcc;
            offsetAcc += dash;
            return (
              <circle
                key={i} cx="80" cy="80" r={radius} fill="none"
                stroke={PIE_COLORS[i % PIE_COLORS.length]} strokeWidth="22"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              >
                <title>{`${d.name}: ${vnd(d.value)}`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="flex-1 space-y-1.5 min-w-0">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[11px]">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
              <span className="text-gray-600 truncate flex-1">{d.name}</span>
              <span className="font-bold text-gray-800 shrink-0">{Math.round(d.value / total * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </MagicCard>
  );
}

function TreasurySection({ fundData, currentWeek, weekAnchor, session, nameOf, refreshData, showToast }: any) {
  const isGvcn = session?.role === 'gvcn';
  const canManage = session?.role === 'thuquy' || isGvcn; // đúng RBAC FSD: GVCN kế thừa quyền Thủ quỹ
  const isThuQuy = session?.role === 'thuquy';

  const [selectedWeek, setSelectedWeek] = useState('');
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<{ url: string; name: string }[] | null>(null);
  const [filterType, setFilterType] = useState<'ALL' | 'IN' | 'OUT'>('ALL');

  const allTx: FundTransaction[] = fundData?.transactions || [];
  const allPeriods: FundPeriod[] = fundData?.periods || [];
  const categories = fundData?.categories || { IN: [], OUT: [] };

  const weekOf = (wid: string) => wid ? wid.match(/SW(-?\d+)$/)?.[1] : '';
  const weekLabelShort = (wid: string) => wid ? `Tuần ${weekOf(wid)}` : '—';

  // Tuần đang xem — mặc định tuần hiện tại (đúng FSD "Week Context").
  const activeWeek = selectedWeek || currentWeek || '';
  const activePeriod = allPeriods.find(p => p.weekId === activeWeek) || null;
  const periodStatus: string = activePeriod?.status || 'draft';
  const isPastWeek = activeWeek !== currentWeek; // xem tuần cũ -> ẩn nút Thêm/Sửa

  // Danh sách tuần để chọn — mọi tuần ĐÃ có giao dịch hoặc chốt sổ, cộng tuần
  // hiện tại (luôn có mặt dù chưa phát sinh gì).
  const weekOptions = useMemo(() => {
    const ws = new Set<string>();
    if (currentWeek) ws.add(currentWeek);
    allTx.forEach(t => ws.add(t.weekId));
    allPeriods.forEach(p => ws.add(p.weekId));
    return [...ws].sort((a, b) => Number(weekOf(b)) - Number(weekOf(a)));
  }, [allTx, allPeriods, currentWeek]);

  const weekTx = useMemo(() => allTx.filter(t => t.weekId === activeWeek), [allTx, activeWeek]);
  const filteredTx = useMemo(() => filterType === 'ALL' ? weekTx : weekTx.filter(t => t.type === filterType), [weekTx, filterType]);

  // Tồn quỹ hiện tại = tồn đầu kỳ (đã approved gần nhất trước tuần đang xem)
  // + Thu - Chi thực tế của tuần đang xem (chỉ tính bút toán active).
  const openingBalance = activePeriod?.openingBalance ?? (() => {
    const approved = allPeriods.filter(p => p.status === 'approved' && Number(weekOf(p.weekId)) < Number(weekOf(activeWeek)));
    if (approved.length === 0) return 0;
    approved.sort((a, b) => Number(weekOf(b.weekId)) - Number(weekOf(a.weekId)));
    return approved[0].closingBalance;
  })();
  const totalIn = weekTx.filter(t => t.type === 'IN' && t.status !== 'cancelled').reduce((s, t) => s + t.amount, 0);
  const totalOut = weekTx.filter(t => t.type === 'OUT' && t.status !== 'cancelled').reduce((s, t) => s + t.amount, 0);
  const currentBalance = openingBalance + totalIn - totalOut;

  // Dữ liệu biểu đồ cột Thu/Chi qua các tuần gần nhất.
  const cashFlowData = useMemo(() => {
    const byWeek: Record<string, { week: string; thu: number; chi: number }> = {};
    allTx.forEach(t => {
      if (t.status === 'cancelled') return;
      if (!byWeek[t.weekId]) byWeek[t.weekId] = { week: weekLabelShort(t.weekId), thu: 0, chi: 0 };
      if (t.type === 'IN') byWeek[t.weekId].thu += t.amount; else byWeek[t.weekId].chi += t.amount;
    });
    return Object.entries(byWeek)
      .sort((a, b) => Number(weekOf(a[0])) - Number(weekOf(b[0])))
      .slice(-8) // 8 tuần gần nhất — đủ đọc, không rối biểu đồ
      .map(([, v]) => v);
  }, [allTx]);

  // Dữ liệu biểu đồ tròn — cơ cấu Chi tiêu theo hạng mục, TOÀN BỘ lịch sử
  // (không giới hạn theo tuần đang xem) để phản ánh đúng xu hướng chi tiêu.
  const expenseByCategory = useMemo(() => {
    const byCategory: Record<string, number> = {};
    allTx.filter(t => t.type === 'OUT' && t.status !== 'cancelled').forEach(t => {
      byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
    });
    return Object.entries(byCategory).map(([name, value]) => ({ name, value }));
  }, [allTx]);

  const vnd = (n: number) => n.toLocaleString('vi-VN') + ' đ';

  return (
    <div className="space-y-6">
      {/* BANNER DUYỆT — chỉ GVCN, chỉ hiện khi có báo cáo đang chờ */}
      {isGvcn && allPeriods.some(p => p.status === 'submitted') && (
        <FundApprovalBanner periods={allPeriods.filter(p => p.status === 'submitted')} nameOf={nameOf} refreshData={refreshData} showToast={showToast} />
      )}

      {/* THANH CHỌN TUẦN */}
      <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap items-center gap-2">
        <Filter size={15} className="text-gray-400 shrink-0" />
        <select value={activeWeek} onChange={e => setSelectedWeek(e.target.value)} className="field text-xs flex-1 max-w-[220px]">
          {weekOptions.map(w => <option key={w} value={w}>{weekLabelShort(w)}{w === currentWeek ? ' (hiện tại)' : ''}</option>)}
        </select>
        <span className={cn('chip text-[10px]', FUND_STATUS_CONFIG[periodStatus].bg, FUND_STATUS_CONFIG[periodStatus].text, 'border-transparent')}>
          {FUND_STATUS_CONFIG[periodStatus].label}
        </span>
      </div>

      {/* SECTION 1: DASHBOARD & KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-primary-700 text-white p-4 rounded-2xl">
          <p className="text-[11px] text-primary-200 font-bold uppercase">Tồn quỹ hiện tại</p>
          <p className="text-2xl font-bold mt-1">{vnd(currentBalance)}</p>
        </div>
        <MagicCard className="p-4">
          <p className="text-[11px] text-gray-500 font-bold uppercase flex items-center gap-1"><TrendingUp size={12} className="text-emerald-600" /> Tổng thu tuần</p>
          <p className="text-xl font-bold mt-1 text-emerald-700">{vnd(totalIn)}</p>
        </MagicCard>
        <MagicCard className="p-4">
          <p className="text-[11px] text-gray-500 font-bold uppercase flex items-center gap-1"><TrendingDown size={12} className="text-red-600" /> Tổng chi tuần</p>
          <p className="text-xl font-bold mt-1 text-red-700">{vnd(totalOut)}</p>
        </MagicCard>
        <MagicCard className="p-4">
          <p className="text-[11px] text-gray-500 font-bold uppercase">Tồn đầu kỳ</p>
          <p className="text-xl font-bold mt-1 text-gray-800">{vnd(openingBalance)}</p>
        </MagicCard>
      </div>

      {/* BIỂU ĐỒ — SVG/HTML thuần, không phụ thuộc thư viện ngoài */}
      {(cashFlowData.length > 0 || expenseByCategory.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {cashFlowData.length > 0 && <SimpleBarChart data={cashFlowData} vnd={vnd} />}
          {expenseByCategory.length > 0 && <SimpleDonutChart data={expenseByCategory} vnd={vnd} />}
        </div>
      )}

      {/* SECTION 2: SỔ NHẬT KÝ GIAO DỊCH */}
      <MagicCard className="p-0 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-gray-800">Sổ nhật ký giao dịch</p>
            <div className="flex bg-gray-100 p-0.5 rounded-lg gap-0.5">
              {(['ALL', 'IN', 'OUT'] as const).map(t => (
                <button key={t} onClick={() => setFilterType(t)} className={cn('px-2.5 py-1 rounded-md text-[10px] font-bold transition', filterType === t ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500')}>
                  {t === 'ALL' ? 'Tất cả' : t === 'IN' ? 'Thu' : 'Chi'}
                </button>
              ))}
            </div>
          </div>
          {canManage && !isPastWeek && periodStatus !== 'submitted' && periodStatus !== 'approved' && (
            <button onClick={() => setIsTxModalOpen(true)} className="btn-primary text-xs py-2"><Plus size={14} /> Giao dịch mới</button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[640px]">
            <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3">Ngày</th><th className="p-3">Loại</th><th className="p-3">Số tiền</th>
                <th className="p-3">Hạng mục</th><th className="p-3">Nội dung</th><th className="p-3">Người tạo</th>
                <th className="p-3">Minh chứng</th><th className="p-3">Trạng thái</th>
                {canManage && <th className="p-3 text-right">Thao tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTx.length === 0 && (
                <tr><td colSpan={canManage ? 9 : 8} className="p-8 text-center text-gray-400 italic">Chưa có giao dịch nào trong tuần này.</td></tr>
              )}
              {filteredTx.map(tx => (
                <FundTxRow key={tx.id} tx={tx} nameOf={nameOf} canManage={canManage} onViewProof={setLightboxImages} refreshData={refreshData} showToast={showToast} />
              ))}
            </tbody>
          </table>
        </div>
      </MagicCard>

      {/* SECTION 3: KHÓA SỔ & KẾ HOẠCH */}
      <MagicCard className="p-4">
        <p className="text-sm font-bold text-gray-800 mb-3">Khóa sổ tuần {weekOf(activeWeek)}</p>
        {activePeriod ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div><span className="text-gray-500 block">Tồn đầu tuần</span><span className="font-bold text-gray-900">{vnd(activePeriod.openingBalance)}</span></div>
              <div><span className="text-gray-500 block">Tổng thu</span><span className="font-bold text-emerald-700">{vnd(activePeriod.totalIn)}</span></div>
              <div><span className="text-gray-500 block">Tổng chi</span><span className="font-bold text-red-700">{vnd(activePeriod.totalOut)}</span></div>
              <div><span className="text-gray-500 block">Tồn cuối tuần</span><span className="font-bold text-primary-700">{vnd(activePeriod.closingBalance)}</span></div>
            </div>
            {activePeriod.proposals && (
              <div className="p-3 bg-gray-50 rounded-xl text-xs"><span className="font-bold text-gray-600">Kế hoạch tuần tới: </span>{activePeriod.proposals}</div>
            )}
            {activePeriod.gvcnVerdict && (
              <div className={cn('p-3 rounded-xl text-xs', activePeriod.status === 'approved' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800')}>
                <span className="font-bold">Phản hồi GVCN: </span>{activePeriod.gvcnVerdict}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">Tuần này chưa nộp chốt sổ.</p>
        )}
        {isThuQuy && activeWeek === currentWeek && (!activePeriod || activePeriod.status === 'rejected') && (
          <button onClick={() => setIsSubmitModalOpen(true)} className="btn-primary text-xs py-2 mt-3"><Send size={14} /> Chốt sổ tuần này</button>
        )}
      </MagicCard>

      {isTxModalOpen && (
        <FundTxModal
          categories={categories} onClose={() => setIsTxModalOpen(false)}
          refreshData={refreshData} showToast={showToast}
        />
      )}
      {isSubmitModalOpen && (
        <FundSubmitModal
          openingBalance={openingBalance} totalIn={totalIn} totalOut={totalOut}
          onClose={() => setIsSubmitModalOpen(false)} refreshData={refreshData} showToast={showToast}
        />
      )}

      {/* LIGHTBOX XEM ẢNH MINH CHỨNG */}
      {lightboxImages && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxImages(null)}>
          <button onClick={() => setLightboxImages(null)} className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full"><X size={24} /></button>
          <div className="max-w-3xl w-full grid gap-3" onClick={e => e.stopPropagation()}>
            {lightboxImages.map((img, i) => {
              const id = extractDriveIdFund(img.url);
              return id ? <img key={i} src={`https://drive.google.com/thumbnail?id=${id}&sz=w1200`} alt={img.name} className="w-full rounded-xl" /> : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Dòng bảng 1 giao dịch — gạch ngang + mờ nếu đã hủy, đúng FSD "vết kiểm toán".
function FundTxRow({ tx, nameOf, canManage, onViewProof, refreshData, showToast }: { tx: FundTransaction, nameOf: (id: string) => string, canManage: boolean, onViewProof: (imgs: { url: string; name: string }[]) => void, refreshData: () => Promise<void>, showToast: (msg: string, type: string) => void }) {
  const [isCancelling, setIsCancelling] = useState(false);
  const isCancelled = tx.status === 'cancelled';

  const handleCancel = async () => {
    if (!confirm('Hủy bút toán này? Giao dịch sẽ được đánh dấu hủy, vẫn lưu trong sổ để kiểm toán.')) return;
    setIsCancelling(true);
    try { await api.call('FUND_TX_CANCEL', { id: tx.id }); await refreshData(); showToast('Đã hủy bút toán.', 'success'); }
    catch (err: any) { showToast(err.message, 'error'); } finally { setIsCancelling(false); }
  };

  return (
    <tr className={cn(isCancelled && 'opacity-50 line-through')}>
      <td className="p-3 text-gray-500 whitespace-nowrap">{tx.createdAt.split(' ')[0]}</td>
      <td className="p-3">
        <span className={cn('font-bold', tx.type === 'IN' ? 'text-emerald-700' : 'text-red-700')}>{tx.type === 'IN' ? 'Thu' : 'Chi'}</span>
      </td>
      <td className={cn('p-3 font-bold whitespace-nowrap', tx.type === 'IN' ? 'text-emerald-700' : 'text-red-700')}>
        {tx.type === 'IN' ? '+' : '-'}{tx.amount.toLocaleString('vi-VN')} đ
      </td>
      <td className="p-3 text-gray-700">{tx.category}</td>
      <td className="p-3 text-gray-700 max-w-[200px] truncate" title={tx.description}>{tx.description}</td>
      <td className="p-3 text-gray-500">{nameOf(tx.createdBy)}</td>
      <td className="p-3">
        {tx.proofImages.length > 0 ? (
          <button onClick={() => onViewProof(tx.proofImages)} className="text-primary-600 hover:text-primary-800"><ImageIcon size={16} /></button>
        ) : <span className="text-gray-300">—</span>}
      </td>
      <td className="p-3">
        {isCancelled ? <span className="chip bg-gray-100 text-gray-500 border-transparent text-[10px]">Đã hủy</span> : <span className="chip bg-emerald-50 text-emerald-700 border-transparent text-[10px]">Hợp lệ</span>}
      </td>
      {canManage && (
        <td className="p-3 text-right">
          {!isCancelled && (
            <button onClick={handleCancel} disabled={isCancelling} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Hủy bút toán"><Ban size={14} /></button>
          )}
        </td>
      )}
    </tr>
  );
}

// Use Case 1: Modal thêm bút toán mới.
function FundTxModal({ categories, onClose, refreshData, showToast }: any) {
  const [type, setType] = useState<'IN' | 'OUT'>('IN');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [proofError, setProofError] = useState('');

  const catList: string[] = categories[type] || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProofError('');
    // Validate quan trọng theo FSD: Chi bắt buộc có ảnh minh chứng.
    if (type === 'OUT' && files.length === 0) {
      setProofError('Khoản chi bắt buộc phải có ít nhất 1 ảnh hóa đơn/minh chứng.');
      return;
    }
    setIsProcessing(true);
    try {
      const filesData = await Promise.all(files.map(async f => ({
        name: f.name,
        type: f.type.startsWith('image/') ? 'image/jpeg' : (f.type || 'application/octet-stream'),
        base64: f.type.startsWith('image/') ? await compressImage(f) : await fileToBase64(f),
      })));
      await api.call('FUND_TX_CREATE', { type, amount: Number(amount), category, description, files: filesData });
      await refreshData();
      showToast('Đã ghi bút toán mới!', 'success');
      onClose();
    } catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title="Giao dịch mới">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
          <button type="button" onClick={() => { setType('IN'); setCategory(''); }} className={cn('flex-1 py-2 rounded-lg text-sm font-bold transition', type === 'IN' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500')}>Khoản Thu</button>
          <button type="button" onClick={() => { setType('OUT'); setCategory(''); }} className={cn('flex-1 py-2 rounded-lg text-sm font-bold transition', type === 'OUT' ? 'bg-white shadow-sm text-red-700' : 'text-gray-500')}>Khoản Chi</button>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-700">Số tiền (đ)</label>
          <input type="number" required min={1} value={amount} onChange={e => setAmount(e.target.value)} placeholder="VD: 100000" className="field" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-700">Hạng mục</label>
          <select required value={category} onChange={e => setCategory(e.target.value)} className="field">
            <option value="" disabled>-- Chọn hạng mục --</option>
            {catList.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-700">Nội dung</label>
          <textarea required rows={2} value={description} onChange={e => setDescription(e.target.value)} className="field" placeholder="VD: Mua giấy A4 cho lớp" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-700">
            Ảnh hóa đơn / minh chứng {type === 'OUT' && <span className="text-red-600">(bắt buộc với khoản chi)</span>}
          </label>
          <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition">
            <Paperclip className="text-gray-400" size={18} /><span className="text-xs text-gray-600 font-medium">Bấm để chọn ảnh (có thể chọn nhiều)</span>
            <input type="file" multiple accept="image/*" className="hidden" onChange={e => { if (e.target.files) { setFiles(Array.from(e.target.files)); setProofError(''); } }} />
          </label>
          {files.length > 0 && <p className="text-[11px] text-gray-500">Đã chọn {files.length} ảnh.</p>}
          {proofError && <p className="text-[11px] text-red-600 font-bold flex items-center gap-1"><AlertTriangle size={12} /> {proofError}</p>}
        </div>
        <button type="submit" disabled={isProcessing} className="btn-primary w-full">{isProcessing ? 'Đang xử lý...' : 'Ghi bút toán'}</button>
      </form>
    </Modal>
  );
}

// Use Case 2: Modal Thủ quỹ nộp chốt sổ tuần — đối soát trước khi nộp.
function FundSubmitModal({ openingBalance, totalIn, totalOut, onClose, refreshData, showToast }: any) {
  const [proposals, setProposals] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const closingBalance = openingBalance + totalIn - totalOut;
  const vnd = (n: number) => n.toLocaleString('vi-VN') + ' đ';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsProcessing(true);
    try {
      await api.call('FUND_PERIOD_SUBMIT', { proposals });
      await refreshData();
      showToast('Đã nộp chốt sổ tuần, chờ GVCN duyệt!', 'success');
      onClose();
    } catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title="Chốt sổ tuần này">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Tồn đầu tuần</span><span className="font-bold">{vnd(openingBalance)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Tổng thu</span><span className="font-bold text-emerald-700">+{vnd(totalIn)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Tổng chi</span><span className="font-bold text-red-700">-{vnd(totalOut)}</span></div>
          <div className="flex justify-between border-t border-gray-200 pt-2"><span className="font-bold text-gray-800">Tồn cuối tuần dự kiến</span><span className={cn('font-bold', closingBalance < 0 ? 'text-red-600' : 'text-primary-700')}>{vnd(closingBalance)}</span></div>
        </div>
        {closingBalance < 0 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-bold flex items-start gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" /> Tồn quỹ âm — vui lòng rà soát lại các bút toán trước khi nộp chốt sổ.
          </div>
        )}
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-700">Kế hoạch thu/chi tuần sau</label>
          <textarea rows={3} value={proposals} onChange={e => setProposals(e.target.value)} className="field" placeholder="VD: Dự kiến mua giấy in A4, chuẩn bị quà 20/11..." />
        </div>
        <button type="submit" disabled={isProcessing} className="btn-primary w-full">{isProcessing ? 'Đang nộp...' : 'Nộp chốt sổ'}</button>
      </form>
    </Modal>
  );
}

// Use Case 3: Banner + panel duyệt của GVCN — hiện khi có báo cáo chờ duyệt.
function FundApprovalBanner({ periods, nameOf, refreshData, showToast }: { periods: FundPeriod[], nameOf: (id: string) => string, refreshData: () => Promise<void>, showToast: (msg: string, type: string) => void }) {
  const [reviewing, setReviewing] = useState<FundPeriod | null>(null);
  return (
    <>
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-amber-800 text-sm font-bold">
          <AlertTriangle size={18} /> Có {periods.length} báo cáo tuần cần duyệt
        </div>
        <div className="flex gap-2">
          {periods.map(p => (
            <button key={p.id} onClick={() => setReviewing(p)} className="px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-amber-800 hover:bg-amber-100">
              Tuần {p.weekId.match(/SW(-?\d+)$/)?.[1]}
            </button>
          ))}
        </div>
      </div>
      {reviewing && <FundApprovalModal period={reviewing} nameOf={nameOf} onClose={() => setReviewing(null)} refreshData={refreshData} showToast={showToast} />}
    </>
  );
}

function FundApprovalModal({ period, nameOf, onClose, refreshData, showToast }: { period: FundPeriod, nameOf: (id: string) => string, onClose: () => void, refreshData: () => Promise<void>, showToast: (msg: string, type: string) => void }) {
  const [verdict, setVerdict] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const vnd = (n: number) => n.toLocaleString('vi-VN') + ' đ';

  const handleDecision = async (isApproved: boolean) => {
    if (!isApproved && !verdict.trim()) { showToast('Bắt buộc nhập lời phê khi từ chối.', 'error'); return; }
    setIsProcessing(true);
    try {
      await api.call('FUND_PERIOD_APPROVE', { weekId: period.weekId, isApproved, verdict });
      await refreshData();
      showToast(isApproved ? 'Đã duyệt chốt sổ!' : 'Đã từ chối, yêu cầu Thủ quỹ sửa lại.', 'success');
      onClose();
    } catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Duyệt chốt sổ Tuần ${period.weekId.match(/SW(-?\d+)$/)?.[1]}`}>
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Nộp bởi</span><span className="font-bold">{nameOf(period.submittedBy)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Tồn đầu tuần</span><span className="font-bold">{vnd(period.openingBalance)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Tổng thu</span><span className="font-bold text-emerald-700">+{vnd(period.totalIn)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Tổng chi</span><span className="font-bold text-red-700">-{vnd(period.totalOut)}</span></div>
          <div className="flex justify-between border-t border-gray-200 pt-2"><span className="font-bold text-gray-800">Tồn cuối tuần</span><span className="font-bold text-primary-700">{vnd(period.closingBalance)}</span></div>
        </div>
        {period.proposals && <div className="p-3 bg-primary-50 rounded-xl text-xs"><span className="font-bold text-primary-800">Kế hoạch tuần sau: </span>{period.proposals}</div>}
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-700">Lời phê của GVCN (bắt buộc nếu từ chối)</label>
          <textarea rows={3} value={verdict} onChange={e => setVerdict(e.target.value)} className="field" placeholder="Nhận xét, yêu cầu điều chỉnh (nếu có)..." />
        </div>
        <div className="flex gap-3">
          <button onClick={() => handleDecision(false)} disabled={isProcessing} className="flex-1 py-2.5 rounded-xl bg-red-50 text-red-700 font-bold text-sm border border-red-200 hover:bg-red-100 flex items-center justify-center gap-2"><ThumbsDown size={16} /> Từ chối</button>
          <button onClick={() => handleDecision(true)} disabled={isProcessing} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 flex items-center justify-center gap-2"><ThumbsUp size={16} /> Phê duyệt</button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// TAB 3: TỐ CÁO — chỉ GVCN thấy danh sách, người bị tố không biết.
// ---------------------------------------------------------------------------
function ComplaintSection({ reports, session, roster, nameOf, isGvcn, refreshData, showToast }: any) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [accusedId, setAccusedId] = useState('');
  const [category, setCategory] = useState('');
  const [content, setContent] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [verdictDraft, setVerdictDraft] = useState<Record<string, string>>({});

  const others = roster.filter((u: any) => u.id !== session?.username && u.role !== 'gvcn');
  const categories: string[] = reports?.categories || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsProcessing(true);
    try {
      await api.call('COMPLAINT_CREATE', { accusedId, category, content });
      showToast('Đã gửi tố cáo đến GVCN.', 'success'); setIsModalOpen(false);
      setAccusedId(''); setCategory(''); setContent('');
    } catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  const handleResolve = async (id: string, status: 'resolved' | 'dismissed') => {
    try {
      await api.call('COMPLAINT_RESOLVE', { id, status, verdict: verdictDraft[id] || '' });
      await refreshData(); showToast('Đã cập nhật xử lý.', 'success');
    } catch (err: any) { showToast(err.message, 'error'); }
  };

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 flex items-start gap-2">
        <Lock size={16} className="shrink-0 mt-0.5" /> Tố cáo chỉ GVCN nhìn thấy. Người bị tố không được thông báo và không có quyền phản hồi trực tiếp lên tố cáo này.
      </div>

      <button onClick={() => setIsModalOpen(true)} className="btn-primary w-full md:w-auto"><Flag size={18} /> Gửi tố cáo</button>

      {isGvcn && (
        <div className="grid gap-3">
          {(reports?.complaints || []).length === 0 && <p className="text-sm text-gray-400 italic">Chưa có tố cáo nào.</p>}
          {(reports?.complaints || []).map((c: Complaint) => (
            <MagicCard key={c.id} className="p-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm"><span className="font-bold text-gray-900">{nameOf(c.accuserId)}</span> tố cáo <span className="font-bold text-primary-700">{nameOf(c.accusedId)}</span></p>
                  <p className="text-[10px] text-gray-500 uppercase font-bold">{c.category || 'Không rõ hạng mục'} · {c.createdAt}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.status === 'open' ? 'bg-amber-100 text-amber-800' : c.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'}`}>{c.status}</span>
              </div>
              <p className="text-sm text-gray-700">{c.content}</p>
              {c.status === 'open' ? (
                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-gray-100">
                  <input type="text" placeholder="Kết luận xử lý..." value={verdictDraft[c.id] || ''} onChange={e => setVerdictDraft(p => ({ ...p, [c.id]: e.target.value }))} className="field flex-1 text-xs" />
                  <button onClick={() => handleResolve(c.id, 'resolved')} className="px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl">Xác nhận & xử lý</button>
                  <button onClick={() => handleResolve(c.id, 'dismissed')} className="px-3 py-2 bg-gray-200 text-gray-600 text-xs font-bold rounded-xl">Bỏ qua</button>
                </div>
              ) : c.gvcnVerdict && <p className="text-xs text-gray-500 italic pt-2 border-t border-gray-100">Kết luận: {c.gvcnVerdict}</p>}
            </MagicCard>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Tố cáo thành viên">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700">Thành viên bị tố cáo</label>
            <select required value={accusedId} onChange={e => setAccusedId(e.target.value)} className="field">
              <option value="" disabled>-- Chọn --</option>
              {others.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700">Hạng mục liên quan (tùy chọn)</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="field">
              <option value="">-- Không rõ --</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700">Nội dung sự việc</label>
            <textarea required rows={5} value={content} onChange={e => setContent(e.target.value)} className="field" />
          </div>
          <button type="submit" disabled={isProcessing} className="btn-primary w-full">{isProcessing ? 'Đang gửi...' : 'Gửi tố cáo đến GVCN'}</button>
        </form>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TAB 4: CONFESSION
// ---------------------------------------------------------------------------
function ConfessionSection({ reports, isGvcn, refreshData, showToast }: any) {
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'gvcn'>('public');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!content.trim()) return; setIsProcessing(true);
    try {
      await api.call('CONFESSION_CREATE', { content, visibility });
      await refreshData(); showToast('Đã gửi ẩn danh.', 'success'); setContent('');
    } catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  const handleToggleHide = async (id: string, hidden: boolean) => {
    try { await api.call('CONFESSION_HIDE', { id, hidden: !hidden }); await refreshData(); showToast('Đã cập nhật.', 'success'); }
    catch (err: any) { showToast(err.message, 'error'); }
  };

  const items: Confession[] = reports?.confessions || [];

  return (
    <div className="space-y-6">
      <MagicCard className="p-5">
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea required rows={3} value={content} onChange={e => setContent(e.target.value)} placeholder="Chia sẻ điều gì đó ẩn danh..." className="field" />
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button type="button" onClick={() => setVisibility('public')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${visibility === 'public' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500'}`}><Globe size={14} /> Công khai cả lớp</button>
              <button type="button" onClick={() => setVisibility('gvcn')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${visibility === 'gvcn' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500'}`}><Lock size={14} /> Chỉ GVCN</button>
            </div>
            <button type="submit" disabled={isProcessing} className="btn-primary"><Send size={16} /> {isProcessing ? 'Đang gửi...' : 'Gửi ẩn danh'}</button>
          </div>
        </form>
      </MagicCard>

      <div className="grid gap-3">
        {items.length === 0 && <p className="text-sm text-gray-400 italic">Chưa có confession nào.</p>}
        {items.map(c => (
          <MagicCard key={c.id} className={`p-4 ${c.hidden ? 'opacity-50' : ''}`}>
            <div className="flex justify-between items-start mb-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${c.visibility === 'public' ? 'bg-gray-100 text-gray-600' : 'bg-primary-100 text-primary-700'}`}>
                {c.visibility === 'public' ? <><Globe size={10} /> Công khai</> : <><Lock size={10} /> Riêng GVCN</>}
              </span>
              <span className="text-[10px] text-gray-400">{c.time}</span>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
            {isGvcn && c.visibility === 'public' && (
              <button onClick={() => handleToggleHide(c.id, c.hidden)} className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-gray-400 hover:text-primary-600">
                {c.hidden ? <><Eye size={12} /> Hiện lại</> : <><EyeOff size={12} /> Ẩn khỏi lớp</>}
              </button>
            )}
          </MagicCard>
        ))}
      </div>
    </div>
  );
}