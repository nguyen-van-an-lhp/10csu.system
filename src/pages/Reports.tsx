import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { MagicCard, Modal } from '../components/ui';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../services/api';
import {
  ClipboardList, Wallet, Flag, Ghost, Plus, CheckCircle2, XCircle, EyeOff, Eye,
  Lock, Globe, Send, AlertTriangle
} from 'lucide-react';
import type { ReportCategory, Complaint, Confession, OfficerReport } from '../types';

const CATEGORY_COLOR: Record<string, string> = {
  'Học Tập': 'bg-blue-50 text-blue-800 border-blue-200',
  'Phong Trào': 'bg-emerald-50 text-emerald-800 border-emerald-200',
  'Kỷ Luật': 'bg-red-50 text-red-800 border-red-200',
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
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-stone-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-stone-900 uppercase">Sinh Hoạt Lớp</h1>
            <p className="text-stone-500 mt-1">Báo cáo tuần Ban cán sự · Quỹ lớp · Tố cáo · Confession</p>
          </div>
          <div className="flex flex-wrap bg-stone-100 p-1.5 rounded-2xl w-full md:w-auto gap-1">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${tab === t.id ? 'bg-white shadow-sm text-red-900' : 'text-stone-500 hover:text-stone-800'}`}>
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
        {tab === 'treasury' && <TreasurySection reports={reports} session={session} nameOf={nameOf} refreshData={refreshData} showToast={showToast} />}
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
  const others = roster.filter((u: any) => u.id !== session?.username && u.role !== 'gvcn');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-bold text-stone-600">
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
            <h3 className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${CATEGORY_COLOR[cat] || 'bg-stone-50 text-stone-700 border-stone-200'}`}>{cat}</h3>
            {items.length === 0 ? (
              <p className="text-xs text-stone-400 italic pl-1">Chưa có báo cáo.</p>
            ) : (
              <div className="grid gap-3">
                {items.map(r => (
                  <MagicCard key={r.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-bold text-stone-900">{nameOf(r.reporterId)}</p>
                        <p className="text-[10px] text-stone-500 uppercase font-bold">{r.reporterRole} {r.scope === 'group' && r.groupNo ? `· Tổ ${r.groupNo}` : ''}</p>
                      </div>
                      <span className="text-[10px] text-stone-400">{r.createdAt}</span>
                    </div>
                    <p className="text-sm text-stone-700 whitespace-pre-wrap">{r.content}</p>
                    {r.mentionedStudents?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {r.mentionedStudents.map(id => <span key={id} className="px-2 py-0.5 bg-stone-100 rounded-full text-[10px] font-bold text-stone-600">{nameOf(id)}</span>)}
                      </div>
                    )}
                  </MagicCard>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nộp báo cáo tuần">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-700">Hạng mục</label>
            <select required value={category} onChange={e => setCategory(e.target.value as ReportCategory)} className="field">
              <option value="" disabled>-- Chọn hạng mục --</option>
              {myRule?.categories?.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-700">Nội dung báo cáo</label>
            <textarea required rows={5} value={content} onChange={e => setContent(e.target.value)} placeholder="Nhận xét tình hình tuần này..." className="field" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-700">Nêu tên học sinh liên quan (tùy chọn)</label>
            <div className="max-h-32 overflow-y-auto border border-stone-200 rounded-xl p-2 flex flex-wrap gap-1.5">
              {others.map((u: any) => (
                <label key={u.id} className={`px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${mentioned.includes(u.id) ? 'bg-red-900 text-white border-red-900' : 'bg-white text-stone-500 border-stone-200'}`}>
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

// ---------------------------------------------------------------------------
// TAB 2: QUỸ LỚP
// ---------------------------------------------------------------------------
function TreasurySection({ reports, session, nameOf, refreshData, showToast }: any) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [balance, setBalance] = useState(0);
  const [purchases, setPurchases] = useState('');
  const [spendProposal, setSpendProposal] = useState('');
  const [collectProposal, setCollectProposal] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const isThuQuy = session?.role === 'thuquy';
  const items = reports?.treasuryReports || [];
  const latest = items[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsProcessing(true);
    try {
      await api.call('TREASURY_REPORT_CREATE', { balance, purchases, spendProposal, collectProposal });
      await refreshData(); showToast('Đã nộp báo cáo thu chi!', 'success'); setIsModalOpen(false);
      setBalance(0); setPurchases(''); setSpendProposal(''); setCollectProposal('');
    } catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="bg-stone-900 text-white px-6 py-4 rounded-2xl">
          <p className="text-xs text-stone-400">Số dư gần nhất</p>
          <p className="text-2xl font-bold">{latest ? latest.balance.toLocaleString('vi-VN') + ' đ' : '—'}</p>
        </div>
        {isThuQuy && <button onClick={() => setIsModalOpen(true)} className="btn-primary w-full md:w-auto"><Plus size={18} /> Nộp báo cáo thu chi</button>}
      </div>

      <div className="grid gap-3">
        {items.length === 0 && <p className="text-sm text-stone-400 italic">Chưa có báo cáo thu chi nào.</p>}
        {items.map((r: any) => (
          <MagicCard key={r.id} className="p-4">
            <div className="flex justify-between items-start mb-2">
              <p className="text-sm font-bold text-stone-900">{nameOf(r.reporterId)}</p>
              <span className="text-[10px] text-stone-400">{r.createdAt}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-stone-700">
              <div><span className="font-bold text-stone-500">Số dư: </span>{r.balance.toLocaleString('vi-VN')} đ</div>
              <div><span className="font-bold text-stone-500">Đã mua: </span>{r.purchases || '—'}</div>
              <div><span className="font-bold text-stone-500">Đề xuất chi: </span>{r.spendProposal || '—'}</div>
              <div><span className="font-bold text-stone-500">Đề xuất thu: </span>{r.collectProposal || '—'}</div>
            </div>
          </MagicCard>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Báo cáo Thu Chi Quỹ lớp">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1"><label className="text-xs font-bold text-stone-700">Số dư hiện tại (đ)</label><input type="number" required min={0} value={balance} onChange={e => setBalance(Number(e.target.value))} className="field" /></div>
          <div className="space-y-1"><label className="text-xs font-bold text-stone-700">Đã mua gì trong tuần</label><textarea rows={2} value={purchases} onChange={e => setPurchases(e.target.value)} className="field" /></div>
          <div className="space-y-1"><label className="text-xs font-bold text-stone-700">Đề xuất chi tiếp theo</label><textarea rows={2} value={spendProposal} onChange={e => setSpendProposal(e.target.value)} className="field" /></div>
          <div className="space-y-1"><label className="text-xs font-bold text-stone-700">Đề xuất thu</label><textarea rows={2} value={collectProposal} onChange={e => setCollectProposal(e.target.value)} className="field" /></div>
          <button type="submit" disabled={isProcessing} className="btn-primary w-full">{isProcessing ? 'Đang nộp...' : 'Nộp báo cáo'}</button>
        </form>
      </Modal>
    </div>
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
          {(reports?.complaints || []).length === 0 && <p className="text-sm text-stone-400 italic">Chưa có tố cáo nào.</p>}
          {(reports?.complaints || []).map((c: Complaint) => (
            <MagicCard key={c.id} className="p-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm"><span className="font-bold text-stone-900">{nameOf(c.accuserId)}</span> tố cáo <span className="font-bold text-red-900">{nameOf(c.accusedId)}</span></p>
                  <p className="text-[10px] text-stone-500 uppercase font-bold">{c.category || 'Không rõ hạng mục'} · {c.createdAt}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.status === 'open' ? 'bg-amber-100 text-amber-800' : c.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'}`}>{c.status}</span>
              </div>
              <p className="text-sm text-stone-700">{c.content}</p>
              {c.status === 'open' ? (
                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-stone-100">
                  <input type="text" placeholder="Kết luận xử lý..." value={verdictDraft[c.id] || ''} onChange={e => setVerdictDraft(p => ({ ...p, [c.id]: e.target.value }))} className="field flex-1 text-xs" />
                  <button onClick={() => handleResolve(c.id, 'resolved')} className="px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl">Xác nhận & xử lý</button>
                  <button onClick={() => handleResolve(c.id, 'dismissed')} className="px-3 py-2 bg-stone-200 text-stone-600 text-xs font-bold rounded-xl">Bỏ qua</button>
                </div>
              ) : c.gvcnVerdict && <p className="text-xs text-stone-500 italic pt-2 border-t border-stone-100">Kết luận: {c.gvcnVerdict}</p>}
            </MagicCard>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Tố cáo thành viên">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-700">Thành viên bị tố cáo</label>
            <select required value={accusedId} onChange={e => setAccusedId(e.target.value)} className="field">
              <option value="" disabled>-- Chọn --</option>
              {others.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-700">Hạng mục liên quan (tùy chọn)</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="field">
              <option value="">-- Không rõ --</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-700">Nội dung sự việc</label>
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
            <div className="flex bg-stone-100 p-1 rounded-xl">
              <button type="button" onClick={() => setVisibility('public')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${visibility === 'public' ? 'bg-white shadow-sm text-red-900' : 'text-stone-500'}`}><Globe size={14} /> Công khai cả lớp</button>
              <button type="button" onClick={() => setVisibility('gvcn')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${visibility === 'gvcn' ? 'bg-white shadow-sm text-red-900' : 'text-stone-500'}`}><Lock size={14} /> Chỉ GVCN</button>
            </div>
            <button type="submit" disabled={isProcessing} className="btn-primary"><Send size={16} /> {isProcessing ? 'Đang gửi...' : 'Gửi ẩn danh'}</button>
          </div>
        </form>
      </MagicCard>

      <div className="grid gap-3">
        {items.length === 0 && <p className="text-sm text-stone-400 italic">Chưa có confession nào.</p>}
        {items.map(c => (
          <MagicCard key={c.id} className={`p-4 ${c.hidden ? 'opacity-50' : ''}`}>
            <div className="flex justify-between items-start mb-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${c.visibility === 'public' ? 'bg-stone-100 text-stone-600' : 'bg-red-100 text-red-800'}`}>
                {c.visibility === 'public' ? <><Globe size={10} /> Công khai</> : <><Lock size={10} /> Riêng GVCN</>}
              </span>
              <span className="text-[10px] text-stone-400">{c.time}</span>
            </div>
            <p className="text-sm text-stone-700 whitespace-pre-wrap">{c.content}</p>
            {isGvcn && c.visibility === 'public' && (
              <button onClick={() => handleToggleHide(c.id, c.hidden)} className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-stone-400 hover:text-red-600">
                {c.hidden ? <><Eye size={12} /> Hiện lại</> : <><EyeOff size={12} /> Ẩn khỏi lớp</>}
              </button>
            )}
          </MagicCard>
        ))}
      </div>
    </div>
  );
}