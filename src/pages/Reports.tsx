import React, { useState, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { MagicCard, Modal, StudentChecklist } from '../components/ui';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../services/api';
import { fileToBase64 } from '../lib/file';
import { compressImage } from '../lib/image';
import { cn, groupByMonth, weekDayDate, formatDmy, formatIso, sortRosterBySeat } from '../lib/utils';
import {
  ClipboardList, Wallet, Flag, Ghost, Plus, CheckCircle2, EyeOff, Eye,
  Lock, Globe, Send, AlertTriangle, TrendingUp, TrendingDown, Image as ImageIcon,
  Ban, X, Paperclip, ThumbsUp, ThumbsDown, Filter, ChevronDown, ChevronUp, BookOpen,
  Edit3, Trash2, Search
} from 'lucide-react';
import type { ReportCategory, Complaint, Confession, OfficerReportSummary, OfficerReportDetail, ViolationSubtype, FundTransaction, FundPeriod, Assignment, TkbPeriod, BoardTkb } from '../types';

const CATEGORY_COLOR: Record<string, string> = {
  'Học Tập': 'bg-blue-50 text-blue-800 border-blue-200',
  'Phong Trào': 'bg-emerald-50 text-emerald-800 border-emerald-200',
  'Kỷ Luật': 'bg-primary-50 text-primary-700 border-primary-200',
  'Vệ Sinh': 'bg-amber-50 text-amber-800 border-amber-200',
  'Văn Hóa & Đạo Đức': 'bg-purple-50 text-purple-800 border-purple-200',
};
const VIOLATION_SUBTYPE_META: Record<string, string> = {
  nhac_nho: 'Bị thầy cô nhắc nhở',
  lam_viec_rieng: 'Làm việc riêng',
  khong_hop_tac: 'Không hợp tác trong tiết học',
};
const SUBTYPE_COLOR: Record<string, string> = {
  nhac_nho: 'bg-red-100 text-red-700',
  lam_viec_rieng: 'bg-amber-100 text-amber-700',
  khong_hop_tac: 'bg-violet-100 text-violet-700',
};
const DAY_LABEL_HT: Record<string, string> = { T2: 'Thứ Hai', T3: 'Thứ Ba', T4: 'Thứ Tư', T5: 'Thứ Năm', T6: 'Thứ Sáu', T7: 'Thứ Bảy' };

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
            <AlertTriangle size={16} className="shrink-0 mt-0.5" /> Không nhận được dữ liệu báo cáo từ máy chủ. Kiểm tra đã triển khai Code.gs v28.0 chưa.
          </div>
        )}

        {tab === 'weekly' && <WeeklySection appState={appState} session={session} nameOf={nameOf} refreshData={refreshData} showToast={showToast} />}
        {tab === 'treasury' && <TreasurySection fundData={appState?.fundData} currentWeek={appState?.currentWeek} session={session} nameOf={nameOf} refreshData={refreshData} showToast={showToast} />}
        {tab === 'complaint' && <ComplaintSection reports={reports} session={session} roster={roster} nameOf={nameOf} isGvcn={isGvcn} refreshData={refreshData} showToast={showToast} />}
        {tab === 'confession' && <ConfessionSection reports={reports} isGvcn={isGvcn} refreshData={refreshData} showToast={showToast} />}
      </div>
    </Layout>
  );
}

// ---------------------------------------------------------------------------
// TAB 1: BÁO CÁO TUẦN
// ---------------------------------------------------------------------------
type IncidentDraft = { content: string; incidentDate: string; mentionedStudents: string[] };
type EntryDraft = { status: 'tot' | 'co_van_de'; incidents: IncidentDraft[] };

function emptyIncident(): IncidentDraft {
  return { content: '', incidentDate: new Date().toISOString().slice(0, 10), mentionedStudents: [] };
}

function WeeklySection({ appState, session, nameOf, refreshData, showToast }: any) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [onlyThisWeek, setOnlyThisWeek] = useState(true);
  const [search, setSearch] = useState('');

  const reports = appState?.reports;
  const roster = appState?.roster || [];
  const board = appState?.board;
  const currentWeek = appState?.currentWeek;
  const weekAnchor = appState?.weekAnchor || '';
  const assignmentsList: Assignment[] = appState?.assignments?.list || [];
  const isGvcnUser = session?.role === 'gvcn';
  const canSeeDetail = isGvcnUser || !!(session?.role && reports?.roleScope?.[session.role]);
  // Quyền ghi bảng Học Tập do BACKEND quyết định (v28.0) — không hard-code
  // lại danh sách vai trò ở đây, tránh 2 nơi lệch nhau khi đổi quy định.
  const canReportHocTap = !!reports?.canReportHocTap;

  const myRule = session?.role ? reports?.roleScope?.[session.role] : null;
  const canReport = !!myRule && myRule.categories.filter((c: string) => c !== 'Học Tập').length > 0;

  const summary: OfficerReportSummary[] = reports?.officerReportsSummary || [];
  const detail: OfficerReportDetail[] = reports?.officerReportsDetail || [];
  const filteredSummary = onlyThisWeek ? summary.filter(r => r.weekId === currentWeek) : summary;
  const categories: ReportCategory[] = reports?.categories || [];

  const others = useMemo(() => sortRosterBySeat(
    roster.filter((u: any) => {
      if (u.id === session?.username || u.role === 'gvcn') return false;
      if (myRule?.scope === 'group' && session?.groupNo) return u.group === session.groupNo;
      return true;
    }),
    appState?.seating
  ), [roster, session, myRule, appState?.seating]);

  // Nhật ký chi tiết: lọc theo tuần + ô tìm kiếm (nội dung, người ghi nhận,
  // tên học sinh liên quan, môn học) — tìm trên cả 4 trường để người dùng
  // gõ gì cũng ra, không phải nhớ đúng cột nào.
  const detailFiltered = useMemo(() => {
    const base = (onlyThisWeek ? detail.filter(r => r.weekId === currentWeek) : detail).filter(r => r.status === 'co_van_de');
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(r =>
      String(r.content || '').toLowerCase().includes(q) ||
      nameOf(r.reporterId).toLowerCase().includes(q) ||
      String(r.subject || '').toLowerCase().includes(q) ||
      String(r.category || '').toLowerCase().includes(q) ||
      (r.mentionedStudents || []).some(id => nameOf(id).toLowerCase().includes(q))
    );
  }, [detail, onlyThisWeek, currentWeek, search, nameOf]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-bold text-gray-600">
          <input type="checkbox" checked={onlyThisWeek} onChange={e => setOnlyThisWeek(e.target.checked)} /> Chỉ tuần này
        </label>
        {canReport && (
          <button onClick={() => setIsModalOpen(true)} className="btn-primary w-full md:w-auto"><Plus size={18} /> Nộp báo cáo tuần</button>
        )}
      </div>

      {/* TỔNG QUAN — mọi người xem */}
      <div className="grid gap-3">
        {categories.map(cat => {
          const items = filteredSummary.filter(r => r.category === cat);
          const hasIssue = items.some(r => r.status === 'co_van_de');
          return (
            <MagicCard key={cat} className="p-4">
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <h3 className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${CATEGORY_COLOR[cat] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>{cat}</h3>
                {items.length > 0 && (
                  hasIssue
                    ? <span className="chip bg-amber-100 text-amber-800 border-transparent flex items-center gap-1"><AlertTriangle size={11} /> Có vấn đề</span>
                    : <span className="chip bg-emerald-100 text-emerald-700 border-transparent flex items-center gap-1"><CheckCircle2 size={11} /> Tốt</span>
                )}
              </div>
              {items.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Chưa có báo cáo.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {items.map(r => (
                    <span key={r.id} className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${r.status === 'co_van_de' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                      {nameOf(r.reporterId)}{r.scope === 'group' && r.groupNo ? ` · Tổ ${r.groupNo}` : ''}
                    </span>
                  ))}
                </div>
              )}
            </MagicCard>
          );
        })}
      </div>

      {/* HỌC TẬP CHƯA NGHIÊM TÚC — lưới TKB, mỗi tiết nhiều sự việc */}
      {canSeeDetail && (
        <HocTapTkbSection
          board={board} weekAnchor={weekAnchor} currentWeek={currentWeek}
          officerReportsDetail={detail} others={others} nameOf={nameOf} session={session}
          isGvcnUser={isGvcnUser} canReportHocTap={canReportHocTap}
          refreshData={refreshData} showToast={showToast}
        />
      )}

      {/* CHƯA HOÀN THÀNH NHIỆM VỤ */}
      {canSeeDetail && <IncompleteTasksSection assignmentsList={assignmentsList} nameOf={nameOf} />}

      {/* NHẬT KÝ CHI TIẾT — có tìm kiếm, sửa/xóa theo quyền */}
      {canSeeDetail && (
        <MagicCard className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-bold text-gray-800 flex items-center gap-2"><Lock size={14} className="text-primary-600" /> Nhật ký chi tiết</p>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2 text-gray-400" size={15} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm nội dung, tên, môn..." className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-primary-500" />
            </div>
          </div>
          {detailFiltered.length === 0 ? (
            <p className="text-xs text-gray-400 italic">{search ? 'Không tìm thấy bản ghi phù hợp.' : 'Không có sự việc nào được ghi nhận.'}</p>
          ) : onlyThisWeek ? (
            <div className="grid gap-3">
              {detailFiltered.map(r => <DetailReportCard key={r.id} r={r} nameOf={nameOf} session={session} isGvcnUser={isGvcnUser} refreshData={refreshData} showToast={showToast} />)}
            </div>
          ) : (
            <MonthAccordion items={detailFiltered} nameOf={nameOf} session={session} isGvcnUser={isGvcnUser} refreshData={refreshData} showToast={showToast} />
          )}
        </MagicCard>
      )}

      {isModalOpen && (
        <ReportFormModal
          myRule={myRule} others={others}
          onClose={() => setIsModalOpen(false)} refreshData={refreshData} showToast={showToast}
        />
      )}
    </div>
  );
}

function IncompleteTasksSection({ assignmentsList, nameOf }: { assignmentsList: Assignment[]; nameOf: (id: string) => string }) {
  const poorlyDone = assignmentsList.filter(a => a.evaluationRating === 'chua_dat');
  const byWho = useMemo(() => {
    const map: Record<string, Assignment[]> = {};
    poorlyDone.forEach(a => {
      const key = a.targetType === 'group' ? `Tổ ${a.targetId}` : nameOf(String(a.targetId));
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return map;
  }, [poorlyDone]);

  return (
    <MagicCard className="p-4 space-y-3">
      <p className="text-sm font-bold text-gray-800 flex items-center gap-2"><AlertTriangle size={15} className="text-red-600" /> Chưa hoàn thành nhiệm vụ tốt</p>
      {Object.keys(byWho).length === 0 ? (
        <p className="text-xs text-gray-400 italic">Không có phân công nào bị đánh giá "Chưa đạt".</p>
      ) : (
        <div className="grid gap-2">
          {Object.entries(byWho).map(([who, items]) => (
            <div key={who} className="p-3 bg-red-50/50 border border-red-100 rounded-xl">
              <p className="text-sm font-bold text-red-800">{who}</p>
              <ul className="mt-1 space-y-0.5">
                {items.map(a => <li key={a.id} className="text-xs text-gray-600">• {a.title}{a.evaluationNote ? ` — "${a.evaluationNote}"` : ''}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </MagicCard>
  );
}

// v28.0 — MỖI TIẾT NHIỀU SỰ VIỆC: ô hiển thị số vấn đề + tên các bạn liên
// quan (gộp, không trùng); bấm vào ô mở bảng chi tiết liệt kê TẤT CẢ sự
// việc của tiết đó, mỗi sự việc sửa/xóa riêng (theo quyền), và thêm sự việc
// mới ngay trong cùng ô.
function HocTapTkbSection({ board, weekAnchor, currentWeek, officerReportsDetail, others, nameOf, session, isGvcnUser, canReportHocTap, refreshData, showToast }: {
  board: any; weekAnchor: string; currentWeek: string; officerReportsDetail: OfficerReportDetail[]; others: any[]; nameOf: (id: string) => string;
  session: any; isGvcnUser: boolean; canReportHocTap: boolean; refreshData: () => Promise<void>; showToast: (msg: string, type: string) => void;
}) {
  const days: string[] = board?.tkbDays || [];
  const periods: TkbPeriod[] = board?.tkbPeriods || [];
  const tkb: BoardTkb = board?.tkb || {};
  const [openCell, setOpenCell] = useState<{ day: string; period: TkbPeriod } | null>(null);

  const incidentsAt = (day: string, periodKey: string) =>
    officerReportsDetail.filter(r =>
      r.weekId === currentWeek && r.category === 'Học Tập' && r.status === 'co_van_de' &&
      r.day === day && r.period === periodKey
    );

  const sangPeriods = periods.filter(p => p.session === 'sang');
  const chieuPeriods = periods.filter(p => p.session === 'chieu');

  const renderRows = (list: TkbPeriod[], label: string, isMorning: boolean) => list.map((p, idx) => (
    <tr key={p.key}>
      {idx === 0 && (
        <td rowSpan={list.length} className={cn('p-1 w-8 text-center align-middle sticky left-0 z-10 border-r-2', isMorning ? 'bg-amber-50 border-amber-200' : 'bg-primary-50 border-primary-200')}>
          <span className={cn('text-[10px] font-bold uppercase tracking-wide [writing-mode:vertical-rl] rotate-180 inline-block', isMorning ? 'text-amber-700' : 'text-primary-700')}>{label}</span>
        </td>
      )}
      <td className="p-2 w-20 sticky left-[32px] bg-white z-10 border-r border-gray-100">
        <span className="font-bold text-gray-700 block leading-tight text-[11px]">{p.label.split(' - ')[1]}</span>
      </td>
      {days.map(d => {
        const slot = tkb[`${d}-${p.key}`];
        const list2 = incidentsAt(d, p.key);
        const allStudents = [...new Set(list2.flatMap(r => r.mentionedStudents || []))];
        return (
          <td key={d} className="p-1 align-top">
            <button
              onClick={() => setOpenCell({ day: d, period: p })}
              className={cn('w-full min-h-[48px] px-1.5 py-1 rounded-lg text-center border transition', list2.length > 0 ? 'bg-red-50 border-red-200 hover:border-red-400' : 'bg-gray-50 border-dashed border-gray-200 hover:border-primary-400')}
            >
              {list2.length > 0 ? (
                <>
                  <span className="block text-[10px] font-bold text-red-600">{list2.length} vấn đề</span>
                  <span className="block text-[10px] text-red-700 leading-tight line-clamp-2">{allStudents.map(id => nameOf(id)).join(', ')}</span>
                </>
              ) : (
                <span className="block text-[10px] text-gray-300 truncate">{slot?.subject || '—'}</span>
              )}
            </button>
          </td>
        );
      })}
    </tr>
  ));

  return (
    <>
      <MagicCard className="p-4 space-y-3">
        <p className="text-sm font-bold text-gray-800 flex items-center gap-2"><BookOpen size={15} className="text-red-600" /> Học Tập Chưa Nghiêm Túc</p>
        <p className="text-[11px] text-gray-500">Bấm vào ô bất kỳ để xem tất cả vấn đề của tiết đó{canReportHocTap ? ' và ghi nhận thêm.' : '.'} Một tiết có thể có nhiều vấn đề, mỗi vấn đề nhiều bạn liên quan.</p>
        {days.length === 0 || periods.length === 0 ? (
          <p className="text-xs text-gray-400 italic">Chưa có Thời khóa biểu để đối chiếu — thiết lập ở trang Tổng quan trước.</p>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[640px]">
              <thead className="bg-gray-100 text-gray-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-2 w-8 sticky left-0 bg-gray-100 z-20"></th>
                  <th className="p-2.5 w-20 sticky left-[32px] bg-gray-100 z-20 border-r border-gray-200">Tiết</th>
                  {days.map(d => (
                    <th key={d} className="p-2.5 text-center">
                      <div>{DAY_LABEL_HT[d] || d}</div>
                      <div className="text-[9px] font-normal normal-case text-gray-400">{currentWeek ? formatDmy(weekDayDate(currentWeek, weekAnchor, d)).slice(0, 5) : ''}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {renderRows(sangPeriods, 'Sáng', true)}
                {renderRows(chieuPeriods, 'Chiều', false)}
              </tbody>
            </table>
          </div>
        )}
      </MagicCard>

      {openCell && (
        <CellIncidentsModal
          day={openCell.day} period={openCell.period}
          subject={tkb[`${openCell.day}-${openCell.period.key}`]?.subject || ''}
          incidents={incidentsAt(openCell.day, openCell.period.key)}
          weekAnchor={weekAnchor} currentWeek={currentWeek} others={others} nameOf={nameOf}
          session={session} isGvcnUser={isGvcnUser} canReportHocTap={canReportHocTap}
          onClose={() => setOpenCell(null)} refreshData={refreshData} showToast={showToast}
        />
      )}
    </>
  );
}

// Bảng chi tiết 1 ô Thời khóa biểu — liệt kê MỌI sự việc của tiết đó, kèm
// nút thêm mới; mỗi sự việc có nút sửa/xóa riêng, chỉ hiện với người đăng
// hoặc GVCN (backend vẫn kiểm tra lại, đây chỉ là lớp hiển thị).
function CellIncidentsModal({ day, period, subject, incidents, weekAnchor, currentWeek, others, nameOf, session, isGvcnUser, canReportHocTap, onClose, refreshData, showToast }: {
  day: string; period: TkbPeriod; subject: string; incidents: OfficerReportDetail[];
  weekAnchor: string; currentWeek: string; others: any[]; nameOf: (id: string) => string;
  session: any; isGvcnUser: boolean; canReportHocTap: boolean;
  onClose: () => void; refreshData: () => Promise<void>; showToast: (msg: string, type: string) => void;
}) {
  const [mode, setMode] = useState<'list' | 'add'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);

  const dateObj = weekDayDate(currentWeek, weekAnchor, day);
  const dmyDate = formatDmy(dateObj);
  const editing = incidents.find(r => r.id === editingId) || null;

  const canEdit = (r: OfficerReportDetail) => isGvcnUser || String(r.reporterId) === String(session?.username);

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa vấn đề này khỏi tiết học?')) return;
    try { await api.call('OFFICER_REPORT_DELETE', { id }); await refreshData(); showToast('Đã xóa.', 'success'); }
    catch (err: any) { showToast(err.message, 'error'); }
  };

  return (
    <Modal isOpen onClose={onClose} title={`${period.label} · ${DAY_LABEL_HT[day] || day} ${dmyDate}`} maxWidth="max-w-2xl">
      <div className="space-y-4">
        <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-600 flex justify-between flex-wrap gap-1">
          <span>Môn: <b className="text-gray-900">{subject || 'Chưa xếp môn'}</b></span>
          <span>{incidents.length} vấn đề đã ghi nhận</span>
        </div>

        {mode === 'list' && !editing && (
          <>
            {incidents.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Chưa ghi nhận vấn đề nào trong tiết này.</p>
            ) : (
              <div className="space-y-2">
                {incidents.map(r => (
                  <div key={r.id} className="p-3 bg-white border border-gray-200 rounded-xl space-y-1.5">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <span className={cn('chip text-[10px] border-transparent', SUBTYPE_COLOR[r.violationSubtype || ''] || 'bg-gray-100 text-gray-600')}>
                        {VIOLATION_SUBTYPE_META[r.violationSubtype || ''] || 'Khác'}
                      </span>
                      {canEdit(r) && (
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => setEditingId(r.id)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Sửa"><Edit3 size={13} /></button>
                          <button onClick={() => handleDelete(r.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Xóa"><Trash2 size={13} /></button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(r.mentionedStudents || []).map(id => <span key={id} className="px-2 py-0.5 bg-red-50 text-red-700 rounded-full text-[10px] font-bold">{nameOf(id)}</span>)}
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.content}</p>
                    {r.violationSubtype === 'nhac_nho' && r.reminderBy && <p className="text-[11px] text-gray-500">Người nhắc: <b>{r.reminderBy}</b></p>}
                    <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-100">Ghi nhận bởi {nameOf(r.reporterId)} · {r.createdAt}</p>
                  </div>
                ))}
              </div>
            )}
            {canReportHocTap && (
              <button onClick={() => setMode('add')} className="btn-primary w-full"><Plus size={16} /> Thêm vấn đề cho tiết này</button>
            )}
          </>
        )}

        {mode === 'add' && (
          <ViolationForm
            mode="add" day={day} period={period} subject={subject} isoDate={formatIso(dateObj)}
            others={others} onDone={() => setMode('list')} onCancel={() => setMode('list')}
            refreshData={refreshData} showToast={showToast}
          />
        )}

        {editing && (
          <ViolationForm
            mode="edit" existing={editing} day={day} period={period} subject={subject} isoDate={formatIso(dateObj)}
            others={others} onDone={() => setEditingId(null)} onCancel={() => setEditingId(null)}
            refreshData={refreshData} showToast={showToast}
          />
        )}
      </div>
    </Modal>
  );
}

// Form dùng chung cho cả THÊM MỚI và SỬA — cùng bộ trường, cùng bộ kiểm
// tra, chỉ khác action gọi lên server; tránh 2 form lệch nhau về quy tắc.
function ViolationForm({ mode, existing, day, period, subject, isoDate, others, onDone, onCancel, refreshData, showToast }: {
  mode: 'add' | 'edit'; existing?: OfficerReportDetail; day: string; period: TkbPeriod; subject: string; isoDate: string;
  others: any[]; onDone: () => void; onCancel: () => void; refreshData: () => Promise<void>; showToast: (msg: string, type: string) => void;
}) {
  const [subtype, setSubtype] = useState<ViolationSubtype>((existing?.violationSubtype as ViolationSubtype) || 'nhac_nho');
  const [students, setStudents] = useState<string[]>(existing?.mentionedStudents || []);
  const [content, setContent] = useState(existing?.content || '');
  const [reminderBy, setReminderBy] = useState(existing?.reminderBy || '');
  const [incidentDate, setIncidentDate] = useState(existing?.incidentDate || isoDate);
  const [isProcessing, setIsProcessing] = useState(false);

  const toggleStudent = (id: string) => setStudents(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (students.length === 0) { showToast('Chọn ít nhất 1 học sinh.', 'error'); return; }
    if (!content.trim()) { showToast('Nhập mô tả cụ thể.', 'error'); return; }
    if (subtype === 'nhac_nho' && !reminderBy.trim()) { showToast('Nhập tên người nhắc.', 'error'); return; }
    setIsProcessing(true);
    try {
      if (mode === 'edit' && existing) {
        await api.call('OFFICER_REPORT_EDIT', {
          id: existing.id, content, incidentDate, mentionedStudents: students,
          violationSubtype: subtype, reminderBy: subtype === 'nhac_nho' ? reminderBy : '',
        });
        showToast('Đã lưu chỉnh sửa.', 'success');
      } else {
        await api.call('OFFICER_REPORT_CREATE', {
          entries: [{
            category: 'Học Tập', status: 'co_van_de',
            incidents: [{ content, incidentDate, mentionedStudents: students, period: period.key, day, subject, violationSubtype: subtype, reminderBy: subtype === 'nhac_nho' ? reminderBy : '' }],
          }],
        });
        showToast('Đã ghi nhận vấn đề.', 'success');
      }
      await refreshData();
      onDone();
    } catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
      <p className="text-xs font-bold text-gray-700">{mode === 'edit' ? 'Sửa vấn đề' : 'Vấn đề mới trong tiết này'}</p>
      <div className="space-y-1">
        <label className="text-[11px] font-bold text-gray-600">Loại vi phạm</label>
        <div className="grid grid-cols-1 gap-1.5">
          {(['nhac_nho', 'lam_viec_rieng', 'khong_hop_tac'] as const).map(s => (
            <label key={s} className={cn('px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer', subtype === s ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-200')}>
              <input type="radio" className="hidden" checked={subtype === s} onChange={() => setSubtype(s)} />
              {VIOLATION_SUBTYPE_META[s]}
            </label>
          ))}
        </div>
      </div>
      {subtype === 'nhac_nho' && (
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-gray-600">Ai nhắc (giáo viên)</label>
          <input type="text" required value={reminderBy} onChange={e => setReminderBy(e.target.value)} placeholder="VD: Cô Lan (GV Toán)" className="field text-sm" />
        </div>
      )}
      <div className="space-y-1">
        <label className="text-[11px] font-bold text-gray-600">Học sinh vi phạm (chọn nhiều)</label>
        <StudentChecklist students={others} selected={students} onToggle={toggleStudent} className="max-h-56" />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-bold text-gray-600">Ngày diễn ra</label>
        <input type="date" required value={incidentDate} onChange={e => setIncidentDate(e.target.value)} className="field text-sm" />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-bold text-gray-600">{subtype === 'nhac_nho' ? 'Nhắc vụ gì' : 'Mô tả cụ thể'}</label>
        <textarea required rows={3} value={content} onChange={e => setContent(e.target.value)} className="field text-sm" />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={isProcessing} className="btn-primary flex-1">{isProcessing ? 'Đang lưu...' : (mode === 'edit' ? 'Lưu chỉnh sửa' : 'Ghi nhận')}</button>
        <button type="button" onClick={onCancel} className="btn-secondary">Hủy</button>
      </div>
    </form>
  );
}

function ReportFormModal({ myRule, others, onClose, refreshData, showToast }: any) {
  const cats: ReportCategory[] = (myRule?.categories || []).filter((c: string) => c !== 'Học Tập');
  const [drafts, setDrafts] = useState<Record<string, EntryDraft>>(() =>
    Object.fromEntries(cats.map((c: string) => [c, { status: 'tot', incidents: [emptyIncident()] }]))
  );
  const [isProcessing, setIsProcessing] = useState(false);

  const setStatus = (cat: string, status: 'tot' | 'co_van_de') =>
    setDrafts(p => ({ ...p, [cat]: { ...p[cat], status } }));
  const updateIncident = (cat: string, idx: number, patch: Partial<IncidentDraft>) =>
    setDrafts(p => ({ ...p, [cat]: { ...p[cat], incidents: p[cat].incidents.map((inc, i) => i === idx ? { ...inc, ...patch } : inc) } }));
  const addIncident = (cat: string) =>
    setDrafts(p => ({ ...p, [cat]: { ...p[cat], incidents: [...p[cat].incidents, emptyIncident()] } }));
  const removeIncident = (cat: string, idx: number) =>
    setDrafts(p => ({ ...p, [cat]: { ...p[cat], incidents: p[cat].incidents.filter((_, i) => i !== idx) } }));
  const toggleMentioned = (cat: string, idx: number, uid: string) =>
    setDrafts(p => {
      const cur = p[cat].incidents[idx].mentionedStudents;
      const next = cur.includes(uid) ? cur.filter(x => x !== uid) : [...cur, uid];
      return { ...p, [cat]: { ...p[cat], incidents: p[cat].incidents.map((inc, i) => i === idx ? { ...inc, mentionedStudents: next } : inc) } };
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const entries = cats.map((cat: string) => {
        const d = drafts[cat];
        if (d.status === 'tot') return { category: cat, status: 'tot' };
        return {
          category: cat, status: 'co_van_de',
          incidents: d.incidents.map(inc => ({ content: inc.content, incidentDate: inc.incidentDate, mentionedStudents: inc.mentionedStudents })),
        };
      });
      await api.call('OFFICER_REPORT_CREATE', { entries });
      await refreshData(); showToast('Đã nộp báo cáo tuần!', 'success'); onClose();
    } catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title="Nộp báo cáo tuần" maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        <p className="text-[11px] text-gray-400 -mt-2">Riêng "Học Tập" ghi nhận trực tiếp qua lưới Thời khóa biểu ở trang chính, không nằm trong form này.</p>
        {cats.map((cat: string) => {
          const d = drafts[cat];
          return (
            <div key={cat} className="border border-gray-200 rounded-2xl p-4 space-y-3 bg-gray-50/40">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h4 className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${CATEGORY_COLOR[cat] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>{cat}</h4>
                <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
                  <button type="button" onClick={() => setStatus(cat, 'tot')} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition', d.status === 'tot' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500')}><CheckCircle2 size={13} /> Tốt</button>
                  <button type="button" onClick={() => setStatus(cat, 'co_van_de')} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition', d.status === 'co_van_de' ? 'bg-white shadow-sm text-amber-700' : 'text-gray-500')}><AlertTriangle size={13} /> Có vấn đề</button>
                </div>
              </div>

              {d.status === 'co_van_de' && (
                <div className="space-y-3 animate-in fade-in duration-200">
                  {d.incidents.map((inc, idx) => (
                    <div key={idx} className="p-3 bg-white border border-gray-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-gray-500 uppercase">Sự việc {idx + 1}</span>
                        {d.incidents.length > 1 && (
                          <button type="button" onClick={() => removeIncident(cat, idx)} className="text-gray-400 hover:text-red-600"><X size={14} /></button>
                        )}
                      </div>
                      <div className="grid sm:grid-cols-[1fr_auto] gap-2">
                        <textarea required rows={2} value={inc.content} onChange={e => updateIncident(cat, idx, { content: e.target.value })} placeholder="Mô tả cụ thể sự việc..." className="field text-sm" />
                        <input type="date" required value={inc.incidentDate} onChange={e => updateIncident(cat, idx, { incidentDate: e.target.value })} className="field text-sm sm:w-[150px]" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-500">Đối tượng liên quan (chọn nhiều)</label>
                        <StudentChecklist students={others} selected={inc.mentionedStudents} onToggle={(uid) => toggleMentioned(cat, idx, uid)} />
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => addIncident(cat)} className="text-xs font-bold text-primary-700 flex items-center gap-1 hover:text-primary-800"><Plus size={14} /> Thêm sự việc khác trong hạng mục này</button>
                </div>
              )}
            </div>
          );
        })}
        <button type="submit" disabled={isProcessing} className="btn-primary w-full">{isProcessing ? 'Đang nộp...' : 'Nộp báo cáo tuần'}</button>
      </form>
    </Modal>
  );
}

// Thẻ 1 sự việc trong nhật ký chi tiết — có nút sửa nội dung/xóa cho người
// đăng và GVCN. Sửa nhanh tại chỗ (inline) thay vì mở thêm 1 modal chồng
// lên modal, vốn dễ rối trên màn hình nhỏ.
function DetailReportCard({ r, nameOf, session, isGvcnUser, refreshData, showToast }: {
  r: OfficerReportDetail; nameOf: (id: string) => string; session: any; isGvcnUser: boolean;
  refreshData: () => Promise<void>; showToast: (msg: string, type: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(r.content);
  const [incidentDate, setIncidentDate] = useState(r.incidentDate);
  const [isSaving, setIsSaving] = useState(false);
  const canEdit = isGvcnUser || String(r.reporterId) === String(session?.username);

  const handleSave = async () => {
    if (!content.trim()) { showToast('Mô tả không được để trống.', 'error'); return; }
    setIsSaving(true);
    try { await api.call('OFFICER_REPORT_EDIT', { id: r.id, content, incidentDate }); await refreshData(); showToast('Đã lưu.', 'success'); setEditing(false); }
    catch (err: any) { showToast(err.message, 'error'); } finally { setIsSaving(false); }
  };
  const handleDelete = async () => {
    if (!confirm('Xóa bản ghi này?')) return;
    try { await api.call('OFFICER_REPORT_DELETE', { id: r.id }); await refreshData(); showToast('Đã xóa.', 'success'); }
    catch (err: any) { showToast(err.message, 'error'); }
  };

  return (
    <MagicCard className="p-4">
      <div className="flex justify-between items-start mb-2 gap-2 flex-wrap">
        <div>
          <p className="text-sm font-bold text-gray-900">{nameOf(r.reporterId)}</p>
          <p className="text-[10px] text-gray-500 uppercase font-bold">{r.reporterRole} {r.scope === 'group' && r.groupNo ? `· Tổ ${r.groupNo}` : ''} · {r.category}{r.subject ? ` · ${r.subject}` : ''}</p>
        </div>
        <div className="text-right flex items-start gap-2">
          <div>
            <p className="text-[10px] text-gray-400">Nộp: {r.createdAt}</p>
            {r.incidentDate && <p className="text-[10px] font-bold text-primary-700">Sự việc: {r.incidentDate}</p>}
          </div>
          {canEdit && !editing && (
            <div className="flex gap-0.5 shrink-0">
              <button onClick={() => setEditing(true)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Sửa"><Edit3 size={13} /></button>
              <button onClick={handleDelete} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Xóa"><Trash2 size={13} /></button>
            </div>
          )}
        </div>
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea rows={3} value={content} onChange={e => setContent(e.target.value)} className="field text-sm" />
          <input type="date" value={incidentDate} onChange={e => setIncidentDate(e.target.value)} className="field text-sm" />
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={isSaving} className="btn-primary flex-1 text-sm py-2">{isSaving ? 'Đang lưu...' : 'Lưu'}</button>
            <button onClick={() => { setEditing(false); setContent(r.content); setIncidentDate(r.incidentDate); }} className="btn-secondary text-sm py-2">Hủy</button>
          </div>
        </div>
      ) : (
        <>
          {r.violationSubtype && (
            <span className={cn('chip text-[10px] border-transparent mb-1.5 inline-block', SUBTYPE_COLOR[r.violationSubtype] || 'bg-gray-100 text-gray-600')}>
              {VIOLATION_SUBTYPE_META[r.violationSubtype]}{r.reminderBy ? ` · ${r.reminderBy}` : ''}
            </span>
          )}
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.content}</p>
          {r.mentionedStudents?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {r.mentionedStudents.map(id => <span key={id} className="px-2 py-0.5 bg-gray-100 rounded-full text-[10px] font-bold text-gray-600">{nameOf(id)}</span>)}
            </div>
          )}
        </>
      )}
    </MagicCard>
  );
}

function MonthAccordion({ items, nameOf, session, isGvcnUser, refreshData, showToast }: any) {
  const groups = useMemo(() => groupByMonth(items, (r: OfficerReportDetail) => r.createdAt), [items]);
  const [openKey, setOpenKey] = useState<string | null>(groups[0]?.key ?? null);

  return (
    <div className="space-y-2">
      {groups.map((g: any) => {
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
                {g.items.map((r: OfficerReportDetail) => <DetailReportCard key={r.id} r={r} nameOf={nameOf} session={session} isGvcnUser={isGvcnUser} refreshData={refreshData} showToast={showToast} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TAB 2: QUỸ LỚP — SỔ CÁI KẾ TOÁN KÉP
// ---------------------------------------------------------------------------
const FUND_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  draft:     { label: 'Chưa nộp', bg: 'bg-gray-100', text: 'text-gray-600' },
  submitted: { label: 'Chờ GVCN duyệt', bg: 'bg-amber-100', text: 'text-amber-700' },
  approved:  { label: 'Đã khóa sổ', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  rejected:  { label: 'Bị từ chối', bg: 'bg-red-100', text: 'text-red-700' },
};
const PIE_COLORS = ['#0284c7', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

function extractDriveIdFund(url: string) { const m = url.match(/id=([a-zA-Z0-9_-]+)/); return m ? m[1] : null; }

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
              <circle key={i} cx="80" cy="80" r={radius} fill="none"
                stroke={PIE_COLORS[i % PIE_COLORS.length]} strokeWidth="22"
                strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offset}>
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

function TreasurySection({ fundData, currentWeek, session, nameOf, refreshData, showToast }: any) {
  const isGvcn = session?.role === 'gvcn';
  const canManage = session?.role === 'thuquy' || isGvcn;
  const isThuQuy = session?.role === 'thuquy';

  const [selectedWeek, setSelectedWeek] = useState('');
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<{ url: string; name: string }[] | null>(null);
  const [filterType, setFilterType] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [txSearch, setTxSearch] = useState('');

  const allTx: FundTransaction[] = fundData?.transactions || [];
  const allPeriods: FundPeriod[] = fundData?.periods || [];
  const categories = fundData?.categories || { IN: [], OUT: [] };

  const weekOf = (wid: string) => wid ? wid.match(/SW(-?\d+)$/)?.[1] : '';
  const weekLabelShort = (wid: string) => wid ? `Tuần ${weekOf(wid)}` : '—';

  const activeWeek = selectedWeek || currentWeek || '';
  const activePeriod = allPeriods.find(p => p.weekId === activeWeek) || null;
  const periodStatus: string = activePeriod?.status || 'draft';
  const isPastWeek = activeWeek !== currentWeek;

  const weekOptions = useMemo(() => {
    const ws = new Set<string>();
    if (currentWeek) ws.add(currentWeek);
    allTx.forEach(t => ws.add(t.weekId));
    allPeriods.forEach(p => ws.add(p.weekId));
    return [...ws].sort((a, b) => Number(weekOf(b)) - Number(weekOf(a)));
  }, [allTx, allPeriods, currentWeek]);

  const weekTx = useMemo(() => allTx.filter(t => t.weekId === activeWeek), [allTx, activeWeek]);
  const filteredTx = useMemo(() => {
    let list = filterType === 'ALL' ? weekTx : weekTx.filter(t => t.type === filterType);
    const q = txSearch.trim().toLowerCase();
    if (q) list = list.filter(t => String(t.description || '').toLowerCase().includes(q) || String(t.category || '').toLowerCase().includes(q) || nameOf(t.createdBy).toLowerCase().includes(q));
    return list;
  }, [weekTx, filterType, txSearch, nameOf]);

  const openingBalance = activePeriod?.openingBalance ?? (() => {
    const approved = allPeriods.filter(p => p.status === 'approved' && Number(weekOf(p.weekId)) < Number(weekOf(activeWeek)));
    if (approved.length === 0) return 0;
    approved.sort((a, b) => Number(weekOf(b.weekId)) - Number(weekOf(a.weekId)));
    return approved[0].closingBalance;
  })();
  const totalIn = weekTx.filter(t => t.type === 'IN' && t.status !== 'cancelled').reduce((s, t) => s + t.amount, 0);
  const totalOut = weekTx.filter(t => t.type === 'OUT' && t.status !== 'cancelled').reduce((s, t) => s + t.amount, 0);
  const currentBalance = openingBalance + totalIn - totalOut;

  const cashFlowData = useMemo(() => {
    const byWeek: Record<string, { week: string; thu: number; chi: number }> = {};
    allTx.forEach(t => {
      if (t.status === 'cancelled') return;
      if (!byWeek[t.weekId]) byWeek[t.weekId] = { week: weekLabelShort(t.weekId), thu: 0, chi: 0 };
      if (t.type === 'IN') byWeek[t.weekId].thu += t.amount; else byWeek[t.weekId].chi += t.amount;
    });
    return Object.entries(byWeek).sort((a, b) => Number(weekOf(a[0])) - Number(weekOf(b[0]))).slice(-8).map(([, v]) => v);
  }, [allTx]);

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
      {isGvcn && allPeriods.some(p => p.status === 'submitted') && (
        <FundApprovalBanner periods={allPeriods.filter(p => p.status === 'submitted')} nameOf={nameOf} refreshData={refreshData} showToast={showToast} />
      )}

      <div className="p-3 bg-violet-50 border border-violet-200 rounded-2xl text-xs text-violet-800 flex items-start gap-2">
        <Wallet size={15} className="shrink-0 mt-0.5" /> Mọi khoản đóng quỹ ghi nhận ở trang <b>Phân công → Kế hoạch thu quỹ</b> tự động tạo giao dịch Thu trong sổ dưới đây — không cần nhập tay hai lần.
      </div>

      <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap items-center gap-2">
        <Filter size={15} className="text-gray-400 shrink-0" />
        <select value={activeWeek} onChange={e => setSelectedWeek(e.target.value)} className="field text-xs flex-1 max-w-[220px]">
          {weekOptions.map(w => <option key={w} value={w}>{weekLabelShort(w)}{w === currentWeek ? ' (hiện tại)' : ''}</option>)}
        </select>
        <span className={cn('chip text-[10px]', FUND_STATUS_CONFIG[periodStatus].bg, FUND_STATUS_CONFIG[periodStatus].text, 'border-transparent')}>
          {FUND_STATUS_CONFIG[periodStatus].label}
        </span>
      </div>

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

      {(cashFlowData.length > 0 || expenseByCategory.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {cashFlowData.length > 0 && <SimpleBarChart data={cashFlowData} vnd={vnd} />}
          {expenseByCategory.length > 0 && <SimpleDonutChart data={expenseByCategory} vnd={vnd} />}
        </div>
      )}

      <MagicCard className="p-0 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-gray-800">Sổ nhật ký giao dịch</p>
            <div className="flex bg-gray-100 p-0.5 rounded-lg gap-0.5">
              {(['ALL', 'IN', 'OUT'] as const).map(t => (
                <button key={t} onClick={() => setFilterType(t)} className={cn('px-2.5 py-1 rounded-md text-[10px] font-bold transition', filterType === t ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500')}>
                  {t === 'ALL' ? 'Tất cả' : t === 'IN' ? 'Thu' : 'Chi'}
                </button>
              ))}
            </div>
            <div className="relative w-44">
              <Search className="absolute left-2.5 top-1.5 text-gray-400" size={14} />
              <input type="text" value={txSearch} onChange={e => setTxSearch(e.target.value)} placeholder="Tìm giao dịch..." className="w-full pl-8 pr-2 py-1 bg-white border border-gray-200 rounded-lg text-[11px] focus:outline-none focus:border-primary-500" />
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
                <tr><td colSpan={canManage ? 9 : 8} className="p-8 text-center text-gray-400 italic">{txSearch ? 'Không tìm thấy giao dịch phù hợp.' : 'Chưa có giao dịch nào trong tuần này.'}</td></tr>
              )}
              {filteredTx.map(tx => (
                <FundTxRow key={tx.id} tx={tx} nameOf={nameOf} canManage={canManage} onViewProof={setLightboxImages} refreshData={refreshData} showToast={showToast} />
              ))}
            </tbody>
          </table>
        </div>
      </MagicCard>

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
        <FundTxModal categories={categories} onClose={() => setIsTxModalOpen(false)} refreshData={refreshData} showToast={showToast} />
      )}
      {isSubmitModalOpen && (
        <FundSubmitModal openingBalance={openingBalance} totalIn={totalIn} totalOut={totalOut} onClose={() => setIsSubmitModalOpen(false)} refreshData={refreshData} showToast={showToast} />
      )}

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
      <td className="p-3"><span className={cn('font-bold', tx.type === 'IN' ? 'text-emerald-700' : 'text-red-700')}>{tx.type === 'IN' ? 'Thu' : 'Chi'}</span></td>
      <td className={cn('p-3 font-bold whitespace-nowrap', tx.type === 'IN' ? 'text-emerald-700' : 'text-red-700')}>
        {tx.type === 'IN' ? '+' : '-'}{tx.amount.toLocaleString('vi-VN')} đ
      </td>
      <td className="p-3 text-gray-700">{tx.category}</td>
      <td className="p-3 text-gray-700 max-w-[220px] truncate" title={tx.description}>{tx.description}</td>
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
// TAB 3: TỐ CÁO
// ---------------------------------------------------------------------------
function ComplaintSection({ reports, session, roster, nameOf, isGvcn, refreshData, showToast }: any) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [accusedId, setAccusedId] = useState('');
  const [category, setCategory] = useState('');
  const [content, setContent] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [verdictDraft, setVerdictDraft] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');

  const others = roster.filter((u: any) => u.id !== session?.username && u.role !== 'gvcn');
  const categories: string[] = reports?.categories || [];

  const list: Complaint[] = useMemo(() => {
    const base: Complaint[] = reports?.complaints || [];
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(c => nameOf(c.accuserId).toLowerCase().includes(q) || nameOf(c.accusedId).toLowerCase().includes(q) || String(c.content || '').toLowerCase().includes(q));
  }, [reports, search, nameOf]);

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

      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
        <button onClick={() => setIsModalOpen(true)} className="btn-primary"><Flag size={18} /> Gửi tố cáo</button>
        {isGvcn && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={15} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm theo tên hoặc nội dung..." className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-primary-500" />
          </div>
        )}
      </div>

      {isGvcn && (
        <div className="grid gap-3">
          {list.length === 0 && <p className="text-sm text-gray-400 italic">{search ? 'Không tìm thấy tố cáo phù hợp.' : 'Chưa có tố cáo nào.'}</p>}
          {list.map((c: Complaint) => (
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