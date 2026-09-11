import React, { useState, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { MagicCard, Modal, StudentChecklist } from '../components/ui';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../services/api';
import { cn, weekDayDate, formatDmShort, formatDmy, dateToWeekId, sortRosterBySeat } from '../lib/utils';
import {
  ClipboardList, Users, Flag, BookOpen, Wallet, Plus,
  ThumbsUp, ThumbsDown, Send, AlertTriangle
} from 'lucide-react';
import type {
  Assignment, AssignmentType, AssignmentStatus, AssignmentTargetType, AssignmentScopeRule, AssignmentRating,
  User, FundCollectionPeriod, FundDebt, DutyDay, DutyRosterWeek,
} from '../types';

const TYPE_META: Record<AssignmentType, { label: string; icon: any; color: string }> = {
  hoat_dong_lop: { label: 'Hoạt động lớp', icon: Users, color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  hoat_dong_truong: { label: 'Hoạt động trường', icon: Flag, color: 'bg-blue-50 text-blue-800 border-blue-200' },
  hoc_tap: { label: 'Học tập', icon: BookOpen, color: 'bg-primary-50 text-primary-700 border-primary-200' },
};
const TYPE_ORDER: AssignmentType[] = ['hoat_dong_lop', 'hoat_dong_truong', 'hoc_tap'];

const STATUS_COLUMNS: { key: AssignmentStatus; label: string; headerClass: string }[] = [
  { key: 'assigned', label: 'Đang chờ thực hiện', headerClass: 'bg-gray-100 text-gray-600' },
  { key: 'reported', label: 'Đã báo hoàn thành', headerClass: 'bg-amber-50 text-amber-700' },
  { key: 'evaluated', label: 'Chờ GVCN quyết định', headerClass: 'bg-blue-50 text-blue-700' },
  { key: 'decided', label: 'Hoàn tất', headerClass: 'bg-emerald-50 text-emerald-700' },
];
const STATUS_META: Record<AssignmentStatus, { label: string; bg: string; text: string }> = {
  assigned: { label: 'Đang chờ', bg: 'bg-gray-100', text: 'text-gray-600' },
  reported: { label: 'Đã báo hoàn thành', bg: 'bg-amber-100', text: 'text-amber-700' },
  evaluated: { label: 'Chờ GVCN quyết định', bg: 'bg-blue-100', text: 'text-blue-700' },
  decided: { label: 'Hoàn tất', bg: 'bg-emerald-100', text: 'text-emerald-700' },
};
const RATING_META: Record<AssignmentRating, { label: string; bg: string; text: string }> = {
  xuat_sac: { label: 'Xuất sắc', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  dat: { label: 'Đạt yêu cầu', bg: 'bg-blue-100', text: 'text-blue-700' },
  chua_dat: { label: 'Chưa đạt', bg: 'bg-red-100', text: 'text-red-700' },
};
const DUTY_DAYS: DutyDay[] = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const DAY_LABEL: Record<string, string> = { T2: 'Thứ Hai', T3: 'Thứ Ba', T4: 'Thứ Tư', T5: 'Thứ Năm', T6: 'Thứ Sáu', T7: 'Thứ Bảy' };

function isTargetOfAssignment(a: Assignment, session: any): boolean {
  if (a.targetType === 'individual') return String(a.targetId) === session?.username;
  if (a.targetType === 'group') return Number(a.targetId) === Number(session?.groupNo);
  return false;
}
function targetLabelOf(a: Assignment, nameOf: (id: string) => string) {
  return a.targetType === 'group' ? `Tổ ${a.targetId}` : nameOf(String(a.targetId));
}

export default function BCSStats() {
  const { appState, refreshData } = useData();
  const { session } = useAuth();
  const { showToast } = useToast();

  const roster: User[] = appState?.roster || [];
  const seating = appState?.seating;
  const nameOf = (id: string) => roster.find(u => u.id === id)?.name || id;
  const assignmentsData = appState?.assignments;
  const list: Assignment[] = assignmentsData?.list || [];
  const scopeMap = assignmentsData?.scope || {};
  const ratings: AssignmentRating[] = assignmentsData?.ratings || ['xuat_sac', 'dat', 'chua_dat'];
  const fundDebt = appState?.fundDebt;

  const isGvcn = session?.role === 'gvcn';
  const myScope: AssignmentScopeRule | null = isGvcn
    ? { types: TYPE_ORDER, targetScope: 'class' }
    : (session?.role ? scopeMap[session.role] || null : null);
  const canAssignType = (t: AssignmentType) => !!myScope?.types.includes(t);

  const [createType, setCreateType] = useState<AssignmentType | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const viewingAssignment = list.find(x => x.id === viewingId) || null;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-primary-700 p-5 md:p-6 rounded-3xl border border-primary-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-sans font-bold text-white flex items-center gap-3"><ClipboardList size={28} className="text-amber-400" /> Phân công</h1>
            <p className="text-gray-400 mt-1 text-sm">Trực nhật, hoạt động lớp/trường, học tập và kế hoạch thu quỹ</p>
          </div>
          {myScope && (
            <button onClick={() => setCreateType(myScope.types[0])} className="btn-primary w-full md:w-auto"><Plus size={18} /> Phân công mới</button>
          )}
        </div>

        {!assignmentsData && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" /> Không nhận được dữ liệu phân công từ máy chủ. Kiểm tra đã triển khai Code.gs v26.1 chưa.
          </div>
        )}

        <DutyRosterSection />

        {TYPE_ORDER.map(type => {
          const meta = TYPE_META[type];
          const Icon = meta.icon;
          const items = list.filter(a => a.type === type);
          return (
            <MagicCard key={type} className="p-4 md:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold border ${meta.color}`}><Icon size={16} /> {meta.label}</h2>
                {canAssignType(type) && (
                  <button onClick={() => setCreateType(type)} className="p-1.5 text-gray-400 hover:text-primary-700 hover:bg-primary-50 rounded-lg" title={`Giao ${meta.label.toLowerCase()} mới`}><Plus size={16} /></button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {STATUS_COLUMNS.map(col => (
                  <StatusColumn key={col.key} col={col} items={items.filter(a => a.status === col.key)} nameOf={nameOf} onOpen={(a: Assignment) => setViewingId(a.id)} />
                ))}
              </div>
            </MagicCard>
          );
        })}

        <FundDebtSection fundDebt={fundDebt} roster={roster} seating={seating} nameOf={nameOf} session={session} isGvcn={isGvcn} refreshData={refreshData} showToast={showToast} />
      </div>

      {createType && myScope && (
        <CreateAssignmentModal
          myScope={myScope} initialType={createType} roster={roster} seating={seating} session={session}
          onClose={() => setCreateType(null)} refreshData={refreshData} showToast={showToast}
        />
      )}
      {viewingAssignment && (
        <AssignmentDetailModal
          a={viewingAssignment} nameOf={nameOf} session={session} isGvcn={isGvcn} ratings={ratings}
          onClose={() => setViewingId(null)} refreshData={refreshData} showToast={showToast}
        />
      )}
    </Layout>
  );
}

// ---------------------------------------------------------------------------
// PHÂN CÔNG TRỰC NHẬT TUẦN
// ---------------------------------------------------------------------------
function DutyRosterSection() {
  const { appState, refreshData } = useData();
  const { session } = useAuth();
  const { showToast } = useToast();
  const roster: User[] = appState?.roster || [];
  const seating = appState?.seating;
  const nameOf = (id: string) => roster.find(u => u.id === id)?.name || id;
  const weekAnchor = appState?.weekAnchor || '';
  const currentWeek = appState?.currentWeek || '';
  const dutyRoster = appState?.dutyRoster || {};
  const dutySuggestion = appState?.assignments?.dutySuggestion;

  const canManage = session?.role === 'gvcn' || session?.role === 'loptruong' || session?.role === 'kyluat' || !!session?.isLeader;

  const [selectedWeek, setSelectedWeek] = useState('');
  const [editingDay, setEditingDay] = useState<DutyDay | null>(null);

  const allWeeks = useMemo(() => {
    const anchor = weekAnchor ? new Date(weekAnchor) : new Date(new Date().getFullYear(), 8, 7);
    const endYear = anchor.getMonth() >= 5 ? anchor.getFullYear() + 1 : anchor.getFullYear();
    const schoolYearEnd = new Date(endYear, 4, 31);
    const ws = new Set<string>();
    for (let d = new Date(anchor); d.getTime() <= schoolYearEnd.getTime(); d.setDate(d.getDate() + 7)) {
      ws.add(dateToWeekId(d, weekAnchor));
    }
    Object.keys(dutyRoster).forEach(w => ws.add(w));
    if (currentWeek) ws.add(currentWeek);
    return [...ws].sort((a, b) => (Number(a.match(/SW(-?\d+)$/)?.[1]) || 0) - (Number(b.match(/SW(-?\d+)$/)?.[1]) || 0));
  }, [weekAnchor, dutyRoster, currentWeek]);

  const activeWeek = selectedWeek || currentWeek || allWeeks[0] || '';
  const weekRoster: DutyRosterWeek = dutyRoster[activeWeek] || {};

  const weekLabelOf = (w: string) => {
    const n = w.match(/SW(-?\d+)$/)?.[1];
    return `Tuần ${n} · ${formatDmShort(weekDayDate(w, weekAnchor, 'T2'))}–${formatDmShort(weekDayDate(w, weekAnchor, 'T7'))}`;
  };

  const handleSaveDay = async (day: DutyDay, studentIds: string[]) => {
    const nextWeekRoster = { ...weekRoster, [day]: studentIds };
    try {
      await api.call('DUTY_ROSTER_SAVE', { weekId: activeWeek, roster: nextWeekRoster });
      await refreshData(); showToast('Đã lưu lịch trực nhật!', 'success'); setEditingDay(null);
    } catch (err: any) { showToast(err.message, 'error'); }
  };

  return (
    <>
      <MagicCard className="p-4 md:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold border bg-amber-50 text-amber-800 border-amber-200"><ClipboardList size={16} /> Phân Công Trực Nhật Tuần</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {dutySuggestion?.suggestedGroupNo && <span className="text-[11px] font-bold text-gray-500">Gợi ý: ưu tiên Tổ {dutySuggestion.suggestedGroupNo} tuần này</span>}
            <select value={activeWeek} onChange={e => setSelectedWeek(e.target.value)} className="field text-xs py-1.5 max-w-[240px]">
              {allWeeks.map(w => <option key={w} value={w}>{weekLabelOf(w)}{w === currentWeek ? ' (hiện tại)' : ''}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[640px]">
            <thead className="bg-gray-100 text-gray-600 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                {DUTY_DAYS.map(d => (
                  <th key={d} className="p-2.5 text-center">
                    <div>{DAY_LABEL[d]}</div>
                    <div className="text-[10px] font-normal normal-case text-gray-400 mt-0.5">{formatDmShort(weekDayDate(activeWeek, weekAnchor, d))}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {DUTY_DAYS.map(d => {
                  const names = weekRoster[d] || [];
                  return (
                    <td key={d} className="p-2 align-top border-t border-gray-100">
                      <button
                        onClick={() => canManage && setEditingDay(d)}
                        disabled={!canManage}
                        className={cn('w-full min-h-[68px] p-2 rounded-xl border text-center transition', names.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-dashed border-gray-200', canManage && 'hover:border-primary-400 cursor-pointer')}
                      >
                        {names.length === 0 ? (
                          <span className="text-[11px] text-gray-300 font-bold">Chưa phân công</span>
                        ) : (
                          <div className="space-y-0.5">
                            {names.map(id => <div key={id} className="text-[11px] font-bold text-amber-800 truncate">{nameOf(id)}</div>)}
                          </div>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </MagicCard>

      {editingDay && (
        <DutyDayEditModal
          day={editingDay} dateLabel={formatDmy(weekDayDate(activeWeek, weekAnchor, editingDay))}
          roster={roster} seating={seating} current={weekRoster[editingDay] || []}
          onClose={() => setEditingDay(null)} onSave={(ids) => handleSaveDay(editingDay, ids)}
        />
      )}
    </>
  );
}

function DutyDayEditModal({ day, dateLabel, roster, seating, current, onClose, onSave }: { day: DutyDay; dateLabel: string; roster: User[]; seating: any; current: string[]; onClose: () => void; onSave: (ids: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>(current);
  const [isSaving, setIsSaving] = useState(false);
  const students = useMemo(() => sortRosterBySeat(roster.filter(u => u.role !== 'gvcn'), seating), [roster, seating]);

  const toggle = (id: string) => setSelected(p => {
    if (p.includes(id)) return p.filter(x => x !== id);
    if (p.length >= 2) return p;
    return [...p, id];
  });

  const handleSave = async () => { setIsSaving(true); await onSave(selected); setIsSaving(false); };

  return (
    <Modal isOpen onClose={onClose} title={`Trực nhật ${DAY_LABEL[day] || day} · ${dateLabel}`}>
      <div className="space-y-3">
        <p className="text-xs text-gray-500">Chọn tối đa 2 học sinh.</p>
        <StudentChecklist students={students} selected={selected} onToggle={toggle} max={2} className="max-h-80" />
        <button onClick={handleSave} disabled={isSaving} className="btn-primary w-full">{isSaving ? 'Đang lưu...' : 'Lưu phân công'}</button>
      </div>
    </Modal>
  );
}

function StatusColumn({ col, items, nameOf, onOpen }: { col: { key: AssignmentStatus; label: string; headerClass: string }; items: Assignment[]; nameOf: (id: string) => string; onOpen: (a: Assignment) => void }) {
  return (
    <div className="flex flex-col bg-gray-50/70 rounded-2xl border border-gray-200 overflow-hidden">
      <div className={cn('px-3 py-2 text-[11px] font-bold', col.headerClass)}>{col.label} ({items.length})</div>
      <div className="flex flex-col gap-2 p-2.5 max-h-[360px] overflow-y-auto custom-scrollbar">
        {items.length === 0 ? (
          <p className="text-[11px] text-gray-400 italic px-1 py-3 text-center">—</p>
        ) : items.map(a => (
          <AssignmentMiniCard key={a.id} a={a} targetLabel={targetLabelOf(a, nameOf)} onClick={() => onOpen(a)} />
        ))}
      </div>
    </div>
  );
}

function AssignmentMiniCard({ a, targetLabel, onClick }: { a: Assignment; targetLabel: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left p-3 bg-white border border-gray-200 rounded-xl hover:border-primary-300 hover:shadow-sm transition">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-[10px] font-bold uppercase shrink-0">{targetLabel.charAt(0)}</div>
        <p className="text-xs font-bold text-gray-800 truncate">{targetLabel}</p>
      </div>
      <p className="text-[11px] text-gray-600 line-clamp-2 leading-snug">{a.title}</p>
      <div className="flex items-center justify-between mt-1.5 min-h-[16px]">
        {a.deadline ? <span className="text-[10px] text-gray-400">Hạn: {a.deadline}</span> : <span />}
        {a.evaluationRating && <RatingBadge rating={a.evaluationRating as AssignmentRating} />}
      </div>
    </button>
  );
}

function RatingBadge({ rating }: { rating: AssignmentRating }) {
  const m = RATING_META[rating];
  if (!m) return null;
  return <span className={cn('chip text-[10px] border-transparent px-1.5 py-0', m.bg, m.text)}>{m.label}</span>;
}

function AssignmentDetailModal({ a, nameOf, session, isGvcn, ratings, onClose, refreshData, showToast }: { a: Assignment; nameOf: (id: string) => string; session: any; isGvcn: boolean; ratings: AssignmentRating[]; onClose: () => void; refreshData: () => Promise<void>; showToast: (msg: string, type: string) => void }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState(a.title);
  const [editContent, setEditContent] = useState(a.content);
  const [editDeadline, setEditDeadline] = useState(a.deadline || '');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [evalRating, setEvalRating] = useState('');
  const [evalNote, setEvalNote] = useState('');
  const [decideNote, setDecideNote] = useState('');
  const [commentDraft, setCommentDraft] = useState('');

  const mine = isTargetOfAssignment(a, session);
  const isAssigner = session?.username === a.assignerId;
  const isAssignerOrGvcn = isGvcn || isAssigner;
  const targetLabel = targetLabelOf(a, nameOf);
  const st = STATUS_META[a.status];

  const call = async (action: string, data: Record<string, any> = {}, successMsg = 'Đã cập nhật.') => {
    setIsProcessing(true);
    try { await api.call(action, { id: a.id, ...data }); await refreshData(); showToast(successMsg, 'success'); return true; }
    catch (err: any) { showToast(err.message, 'error'); return false; } finally { setIsProcessing(false); }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await call('ASSIGNMENT_EDIT', { title: editTitle, content: editContent, deadline: editDeadline }, 'Đã lưu chỉnh sửa.')) setEditMode(false);
  };
  const handleDelete = async () => {
    if (!confirm('Xóa phân công này?')) return;
    if (await call('ASSIGNMENT_DELETE', {}, 'Đã xóa.')) onClose();
  };
  const handleSelfReport = () => call('ASSIGNMENT_SELF_REPORT', {}, 'Đã báo hoàn thành, chờ đánh giá.');
  const handleReject = async () => {
    if (!rejectNote.trim()) { showToast('Nhập lý do trả lại.', 'error'); return; }
    if (await call('ASSIGNMENT_REJECT', { note: rejectNote }, 'Đã trả lại.')) { setShowRejectForm(false); setRejectNote(''); }
  };
  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalRating) { showToast('Chọn xếp loại.', 'error'); return; }
    if (await call('ASSIGNMENT_EVALUATE', { rating: evalRating, note: evalNote }, isGvcn ? 'Đã đánh giá — đây là quyết định cuối cùng.' : 'Đã đánh giá, chờ GVCN quyết định.')) { setEvalRating(''); setEvalNote(''); }
  };
  const handleDecide = async (isApproved: boolean) => {
    if (!isApproved && !decideNote.trim()) { showToast('Bắt buộc nêu lý do khi không đồng ý.', 'error'); return; }
    await call('ASSIGNMENT_DECIDE', { isApproved, note: decideNote }, isApproved ? 'Đã phê duyệt.' : 'Đã trả lại để làm lại.');
  };
  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentDraft.trim()) return;
    if (await call('ASSIGNMENT_COMMENT_ADD', { content: commentDraft }, 'Đã bình luận.')) setCommentDraft('');
  };

  return (
    <Modal isOpen onClose={onClose} title="Chi tiết phân công" maxWidth="max-w-xl">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-500 uppercase">{TYPE_META[a.type].label} · {targetLabel}</p>
            {!editMode && <h3 className="text-lg font-bold text-gray-900 mt-0.5">{a.title}</h3>}
          </div>
          <span className={cn('chip text-[10px] shrink-0', st.bg, st.text, 'border-transparent')}>{st.label}</span>
        </div>

        {editMode ? (
          <form onSubmit={handleSaveEdit} className="space-y-3">
            <div className="space-y-1"><label className="text-xs font-bold text-gray-700">Tiêu đề</label><input type="text" required value={editTitle} onChange={e => setEditTitle(e.target.value)} className="field" /></div>
            <div className="space-y-1"><label className="text-xs font-bold text-gray-700">Mô tả cụ thể</label><textarea required rows={4} value={editContent} onChange={e => setEditContent(e.target.value)} className="field" /></div>
            <div className="space-y-1"><label className="text-xs font-bold text-gray-700">Hạn chót</label><input type="date" value={editDeadline} onChange={e => setEditDeadline(e.target.value)} className="field" /></div>
            <div className="flex gap-2">
              <button type="submit" disabled={isProcessing} className="btn-primary flex-1">{isProcessing ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
              <button type="button" onClick={() => setEditMode(false)} className="btn-secondary">Hủy</button>
            </div>
          </form>
        ) : (
          <>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{a.content}</p>
            {a.deadline && <p className="text-xs text-gray-500">Hạn chót: <span className="font-bold">{a.deadline}</span></p>}
          </>
        )}

        <div className="space-y-1.5 pt-3 border-t border-gray-100">
          <p className="text-[11px] font-bold text-gray-400 uppercase">Tiến trình</p>
          <p className="text-xs text-gray-600">Giao bởi <span className="font-bold">{nameOf(a.assignerId)}</span> · {a.createdAt}</p>
          {a.selfReportedAt && <p className="text-xs text-gray-600">{targetLabel} báo hoàn thành · {a.selfReportedAt}</p>}
          {a.evaluationRating && (
            <div className="flex items-center gap-2 text-xs text-gray-600 flex-wrap">
              <span>{nameOf(a.evaluatorId)} đánh giá:</span> <RatingBadge rating={a.evaluationRating as AssignmentRating} /> <span className="text-gray-400">· {a.evaluatedAt}</span>
            </div>
          )}
          {a.evaluationNote && <p className="text-xs text-gray-500 italic pl-1">"{a.evaluationNote}"</p>}
          {a.status === 'decided' && a.decidedBy && (
            <p className="text-xs text-gray-600">
              {String(a.decidedBy) === String(a.evaluatorId) ? 'Đánh giá của GVCN chính là quyết định cuối cùng' : `GVCN quyết định bởi ${nameOf(a.decidedBy)}`} · {a.decidedAt}
            </p>
          )}
          {a.decisionNote && String(a.decidedBy) !== String(a.evaluatorId) && <p className="text-xs text-gray-500 italic pl-1">"{a.decisionNote}"</p>}
        </div>

        {!editMode && (
          <div className="space-y-2 pt-3 border-t border-gray-100">
            {a.status === 'assigned' && mine && (
              <button onClick={handleSelfReport} disabled={isProcessing} className="btn-primary w-full">Báo đã hoàn thành</button>
            )}

            {a.status === 'reported' && isAssignerOrGvcn && !showRejectForm && (
              <form onSubmit={handleEvaluate} className="space-y-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-xs font-bold text-gray-700">Đánh giá {targetLabel}</p>
                <select required value={evalRating} onChange={e => setEvalRating(e.target.value)} className="field text-sm">
                  <option value="" disabled>-- Chọn xếp loại --</option>
                  {ratings.map(r => <option key={r} value={r}>{RATING_META[r].label}</option>)}
                </select>
                <textarea rows={2} value={evalNote} onChange={e => setEvalNote(e.target.value)} placeholder="Nhận xét (tùy chọn)..." className="field text-sm" />
                <div className="flex gap-2">
                  <button type="submit" disabled={isProcessing} className="btn-primary flex-1 text-sm py-2">{isGvcn ? 'Đánh giá & quyết định' : 'Gửi đánh giá'}</button>
                  <button type="button" onClick={() => setShowRejectForm(true)} className="btn-secondary text-sm py-2">Trả lại</button>
                </div>
              </form>
            )}
            {a.status === 'reported' && isAssignerOrGvcn && showRejectForm && (
              <div className="space-y-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-xs font-bold text-gray-700">Lý do trả lại</p>
                <textarea rows={2} value={rejectNote} onChange={e => setRejectNote(e.target.value)} className="field text-sm" />
                <div className="flex gap-2">
                  <button onClick={handleReject} disabled={isProcessing} className="flex-1 py-2 bg-gray-700 text-white text-sm font-bold rounded-xl hover:bg-gray-800">Xác nhận trả lại</button>
                  <button onClick={() => setShowRejectForm(false)} className="btn-secondary text-sm py-2">Hủy</button>
                </div>
              </div>
            )}

            {a.status === 'evaluated' && isGvcn && (
              <div className="space-y-2 p-3 bg-blue-50 rounded-xl border border-blue-200">
                <p className="text-xs font-bold text-blue-800">Quyết định cuối cùng</p>
                <textarea rows={2} value={decideNote} onChange={e => setDecideNote(e.target.value)} placeholder="Lý do (bắt buộc nếu không đồng ý)..." className="field text-sm" />
                <div className="flex gap-2">
                  <button onClick={() => handleDecide(true)} disabled={isProcessing} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700"><ThumbsUp size={14} /> Phê duyệt</button>
                  <button onClick={() => handleDecide(false)} disabled={isProcessing} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 bg-gray-200 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-300"><ThumbsDown size={14} /> Trả lại làm lại</button>
                </div>
              </div>
            )}
            {a.status === 'evaluated' && !isGvcn && (
              <p className="text-xs text-gray-500 italic">Đã có đánh giá — đang chờ GVCN ra quyết định cuối cùng.</p>
            )}

            {isAssignerOrGvcn && (
              <div className="flex items-center gap-3 justify-end pt-1">
                <button onClick={() => setEditMode(true)} className="text-xs font-bold text-gray-500 hover:text-primary-700">Sửa</button>
                <button onClick={handleDelete} className="text-xs font-bold text-gray-500 hover:text-red-600">Xóa</button>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2 pt-3 border-t border-gray-100">
          <p className="text-[11px] font-bold text-gray-400 uppercase">Bình luận ({a.comments?.length || 0})</p>
          <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
            {(a.comments || []).map(c => (
              <div key={c.id} className="p-2.5 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-gray-800">{c.authorName}</span><span className="text-[10px] text-gray-400 shrink-0">{c.createdAt}</span></div>
                <p className="text-xs text-gray-600 mt-0.5 whitespace-pre-wrap">{c.content}</p>
              </div>
            ))}
            {(!a.comments || a.comments.length === 0) && <p className="text-xs text-gray-400 italic">Chưa có bình luận nào.</p>}
          </div>
          {(isGvcn || isAssigner || mine) && (
            <form onSubmit={handleComment} className="flex gap-2">
              <input type="text" value={commentDraft} onChange={e => setCommentDraft(e.target.value)} placeholder="Viết bình luận..." className="field text-xs flex-1" />
              <button type="submit" disabled={isProcessing} className="px-3 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700"><Send size={14} /></button>
            </form>
          )}
        </div>
      </div>
    </Modal>
  );
}

function CreateAssignmentModal({ myScope, initialType, roster, seating, session, onClose, refreshData, showToast }: { myScope: AssignmentScopeRule; initialType: AssignmentType; roster: User[]; seating: any; session: any; onClose: () => void; refreshData: () => Promise<void>; showToast: (msg: string, type: string) => void }) {
  const [type, setType] = useState<AssignmentType>(initialType);
  const [targetType, setTargetType] = useState<AssignmentTargetType>('individual');
  const [targetIds, setTargetIds] = useState<(string | number)[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const individualOptions = useMemo(() => sortRosterBySeat(
    roster.filter(u => u.role !== 'gvcn' && (myScope.targetScope === 'class' || u.group === session?.groupNo)),
    seating
  ), [roster, seating, myScope, session]);
  const groupOptions = useMemo(() => {
    const set = new Set<number>();
    roster.forEach(u => { if (u.group) set.add(u.group); });
    return [...set].sort((a, b) => a - b);
  }, [roster]);

  const toggleTarget = (id: string | number) =>
    setTargetIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (targetIds.length === 0) { showToast('Chọn ít nhất 1 đối tượng nhận.', 'error'); return; }
    setIsProcessing(true);
    try {
      await api.call('ASSIGNMENT_CREATE', { type, targetType, targetIds, title, content, deadline });
      await refreshData(); showToast('Đã tạo phân công!', 'success'); onClose();
    } catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title="Phân công mới" maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-700">Loại phân công</label>
          <select value={type} onChange={e => setType(e.target.value as AssignmentType)} className="field">
            {myScope.types.map(t => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
          </select>
        </div>

        {myScope.targetScope === 'class' && (
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700">Giao cho</label>
            <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
              <button type="button" onClick={() => { setTargetType('individual'); setTargetIds([]); }} className={cn('flex-1 py-1.5 rounded-lg text-xs font-bold transition', targetType === 'individual' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500')}>Cá nhân</button>
              <button type="button" onClick={() => { setTargetType('group'); setTargetIds([]); }} className={cn('flex-1 py-1.5 rounded-lg text-xs font-bold transition', targetType === 'group' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500')}>Cả Tổ</button>
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-700">Đối tượng nhận</label>
          {targetType === 'individual' ? (
            <StudentChecklist students={individualOptions} selected={targetIds.map(String)} onToggle={toggleTarget} />
          ) : (
            <div className="border border-gray-200 rounded-xl p-2 flex flex-wrap gap-1.5">
              {groupOptions.map(g => (
                <label key={g} className={cn('px-2.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer', targetIds.includes(g) ? 'bg-primary-700 text-white border-primary-700' : 'bg-white text-gray-500 border-gray-200')}>
                  <input type="checkbox" className="hidden" checked={targetIds.includes(g)} onChange={() => toggleTarget(g)} />
                  Tổ {g}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-700">Tiêu đề</label>
          <input type="text" required value={title} onChange={e => setTitle(e.target.value)} placeholder="VD: Trang trí báo tường 20/11" className="field" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-700">Mô tả cụ thể</label>
          <textarea required rows={3} value={content} onChange={e => setContent(e.target.value)} placeholder="Nêu rõ công việc cần làm, tiêu chuẩn hoàn thành..." className="field" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-700">Hạn chót (tùy chọn)</label>
          <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="field" />
        </div>
        <button type="submit" disabled={isProcessing} className="btn-primary w-full">{isProcessing ? 'Đang tạo...' : 'Tạo phân công'}</button>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// KẾ HOẠCH THU QUỸ
// ---------------------------------------------------------------------------
function FundDebtSection({ fundDebt, roster, seating, nameOf, session, isGvcn, refreshData, showToast }: any) {
  const canManage = session?.role === 'thuquy' || isGvcn;
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [openPeriodId, setOpenPeriodId] = useState<string | null>(null);

  const periods: FundCollectionPeriod[] = fundDebt?.periods || [];
  const debts: FundDebt[] = fundDebt?.debts || [];
  const vnd = (n: number) => n.toLocaleString('vi-VN') + ' đ';

  const handleClose = async (id: string) => {
    if (!confirm('Đóng đợt thu này? Sẽ không thể ghi nhận thêm khoản đóng mới.')) return;
    try { await api.call('FUND_DEBT_PERIOD_CLOSE', { id }); await refreshData(); showToast('Đã đóng đợt thu.', 'success'); }
    catch (err: any) { showToast(err.message, 'error'); }
  };

  return (
    <>
      <MagicCard className="p-4 md:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold border bg-violet-50 text-violet-800 border-violet-200"><Wallet size={16} /> Kế hoạch thu quỹ</h2>
          {canManage && <button onClick={() => setIsCreateOpen(true)} className="btn-primary text-xs py-2"><Plus size={14} /> Mở đợt thu mới</button>}
        </div>

        {periods.length === 0 ? (
          <p className="text-xs text-gray-400 italic">Chưa có đợt thu quỹ nào.</p>
        ) : (
          <div className="grid gap-3">
            {periods.map(p => {
              const periodDebts = debts.filter(d => d.periodId === p.id);
              const totalOwed = periodDebts.reduce((s, d) => s + d.amountOwed, 0);
              const totalPaid = periodDebts.reduce((s, d) => s + d.amountPaid, 0);
              const pct = totalOwed ? Math.round(totalPaid / totalOwed * 100) : 0;
              const isOpenPanel = openPeriodId === p.id;
              return (
                <div key={p.id} className="border border-gray-200 rounded-2xl overflow-hidden">
                  <button type="button" onClick={() => setOpenPeriodId(isOpenPanel ? null : p.id)} className="w-full p-3.5 flex items-center justify-between gap-3 hover:bg-gray-50 transition text-left">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900">{p.name}{p.deadline ? ` · Hạn ${p.deadline}` : ''}</p>
                      <p className="text-[11px] text-gray-500">{vnd(totalPaid)} / {vnd(totalOwed)} đã đóng ({pct}%)</p>
                    </div>
                    <span className={cn('chip text-[10px] shrink-0', p.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500', 'border-transparent')}>{p.status === 'open' ? 'Đang mở' : 'Đã đóng'}</span>
                  </button>
                  <div className="h-1.5 bg-gray-100"><div className="h-full bg-violet-500" style={{ width: `${pct}%` }} /></div>
                  {isOpenPanel && (
                    <div className="p-3 space-y-2 border-t border-gray-100 bg-gray-50/50">
                      {periodDebts.map(d => (
                        <DebtRow key={d.id} d={d} nameOf={nameOf} canManage={canManage} refreshData={refreshData} showToast={showToast} />
                      ))}
                      {canManage && p.status === 'open' && (
                        <button onClick={() => handleClose(p.id)} className="text-xs font-bold text-gray-500 hover:text-red-600 mt-1">Đóng đợt thu này</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </MagicCard>

      {isCreateOpen && (
        <FundDebtPeriodModal roster={roster} seating={seating} onClose={() => setIsCreateOpen(false)} refreshData={refreshData} showToast={showToast} />
      )}
    </>
  );
}

const DEBT_STATUS_META: Record<string, { label: string; bg: string; text: string }> = {
  unpaid: { label: 'Chưa đóng', bg: 'bg-red-50', text: 'text-red-700' },
  partial: { label: 'Đóng một phần', bg: 'bg-amber-50', text: 'text-amber-700' },
  paid: { label: 'Đã đóng đủ', bg: 'bg-emerald-50', text: 'text-emerald-700' },
};

function DebtRow({ d, nameOf, canManage, refreshData, showToast }: { d: FundDebt; nameOf: (id: string) => string; canManage: boolean; refreshData: () => Promise<void>; showToast: (msg: string, type: string) => void }) {
  const [amount, setAmount] = useState(String(d.amountPaid || ''));
  const [isSaving, setIsSaving] = useState(false);
  const st = DEBT_STATUS_META[d.status] || DEBT_STATUS_META.unpaid;
  const vnd = (n: number) => n.toLocaleString('vi-VN') + ' đ';
  const studentName = nameOf(d.studentId);

  const handleSave = async () => {
    setIsSaving(true);
    try { await api.call('FUND_DEBT_MARK_PAID', { id: d.id, amountPaid: Number(amount) || 0 }); await refreshData(); showToast('Đã ghi nhận.', 'success'); }
    catch (err: any) { showToast(err.message, 'error'); } finally { setIsSaving(false); }
  };

  return (
    <div className="flex items-center gap-3 p-2.5 bg-white border border-gray-200 rounded-xl">
      <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-[11px] font-bold uppercase shrink-0">{studentName.charAt(0)}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-gray-800 truncate" title={studentName}>{studentName}</p>
        <p className="text-[11px] text-gray-500">Cần đóng: {vnd(d.amountOwed)}</p>
      </div>
      <span className={cn('chip text-[10px] shrink-0', st.bg, st.text, 'border-transparent')}>{st.label}</span>
      {canManage ? (
        <>
          <div className="w-24 shrink-0">
            <input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} className="field text-xs py-1.5 px-2 text-right" placeholder="Đã đóng" />
          </div>
          <button onClick={handleSave} disabled={isSaving} className="p-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 shrink-0"><Send size={13} /></button>
        </>
      ) : (
        <span className="text-xs font-bold text-gray-700 shrink-0">{vnd(d.amountPaid)}</span>
      )}
    </div>
  );
}

function FundDebtPeriodModal({ roster, seating, onClose, refreshData, showToast }: { roster: User[]; seating: any; onClose: () => void; refreshData: () => Promise<void>; showToast: (msg: string, type: string) => void }) {
  const [name, setName] = useState('');
  const [amountPerPerson, setAmountPerPerson] = useState('');
  const [deadline, setDeadline] = useState('');
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const students = useMemo(() => sortRosterBySeat(roster.filter(u => u.role !== 'gvcn'), seating), [roster, seating]);
  const vnd = (n: number) => n.toLocaleString('vi-VN') + ' đ';

  const groups = useMemo(() => {
    const map = new Map<string, typeof students>();
    students.forEach(u => { const k = u.group ? String(u.group) : 'none'; if (!map.has(k)) map.set(k, []); map.get(k)!.push(u); });
    return [...map.entries()].sort((a, b) => a[0] === 'none' ? 1 : b[0] === 'none' ? -1 : Number(a[0]) - Number(b[0]));
  }, [students]);

  const totalPlanned = useMemo(() => {
    const def = Number(amountPerPerson) || 0;
    return students.reduce((sum, u) => {
      const custom = customAmounts[u.id];
      const val = custom !== undefined && custom.trim() !== '' ? Number(custom) : def;
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [students, customAmounts, amountPerPerson]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const overrides = Object.fromEntries(Object.entries(customAmounts).filter(([, v]) => v.trim() !== '').map(([k, v]) => [k, Number(v)]));
      await api.call('FUND_DEBT_PERIOD_CREATE', { name, amountPerPerson: Number(amountPerPerson) || 0, deadline, customAmounts: overrides });
      await refreshData(); showToast('Đã mở đợt thu quỹ mới!', 'success'); onClose();
    } catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title="Mở đợt thu quỹ mới" maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700">Tên đợt thu</label>
            <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="VD: Quỹ lớp Học kỳ I" className="field" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700">Mức thu mặc định/người (đ)</label>
            <input type="number" required min={0} value={amountPerPerson} onChange={e => setAmountPerPerson(e.target.value)} className="field" />
          </div>
        </div>
        <div className="space-y-1 sm:w-1/2 sm:pr-2">
          <label className="text-xs font-bold text-gray-700">Hạn nộp (tùy chọn)</label>
          <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="field" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <label className="text-xs font-bold text-gray-700">Điều chỉnh riêng theo cá nhân (tùy chọn — để trống dùng mức mặc định)</label>
            <span className="text-[11px] font-bold text-violet-700">Tổng dự kiến thu: {vnd(totalPlanned)}</span>
          </div>
          <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-xl custom-scrollbar">
            {groups.map(([key, list]) => (
              <div key={key}>
                <div className="sticky top-0 bg-gray-100 px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">{key === 'none' ? 'Chưa phân Tổ' : `Tổ ${key}`}</div>
                <div className="divide-y divide-gray-100">
                  {list.map(u => (
                    <div key={u.id} className="flex items-center gap-2.5 px-3 py-2">
                      <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-[10px] font-bold uppercase shrink-0">{u.name.charAt(0)}</div>
                      <span className="text-sm font-bold text-gray-800 flex-1 min-w-0 truncate" title={u.name}>{u.name}</span>
                      <div className="w-24 shrink-0">
                        <input type="number" min={0} placeholder={amountPerPerson || '0'} value={customAmounts[u.id] || ''} onChange={e => setCustomAmounts(p => ({ ...p, [u.id]: e.target.value }))} className="field text-xs py-1.5 px-2 text-right" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <button type="submit" disabled={isProcessing} className="btn-primary w-full">{isProcessing ? 'Đang tạo...' : 'Mở đợt thu'}</button>
      </form>
    </Modal>
  );
}