import React, { useState, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { Modal } from '../components/ui';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../services/api';
import { BookMarked, Plus, Edit3, Trash2, RotateCcw, AlertTriangle, GripVertical, Save } from 'lucide-react';
import type { ConductCatalogItem, ConductTier } from '../types';

const TIER_CONFIG: Record<ConductTier, { label: string; color: string; bg: string; desc: string }> = {
  fault:     { label: 'Lỗi thường', color: 'text-gray-800', bg: 'bg-gray-100 border-gray-200', desc: 'Cộng vào tổng lỗi, tính theo ngưỡng xếp loại.' },
  downgrade: { label: 'Hạ 1 mức ngay', color: 'text-amber-900', bg: 'bg-amber-50 border-amber-200', desc: 'Bất kể tổng lỗi, xếp loại hạ thêm 1 bậc.' },
  critical:  { label: 'Nghiêm trọng (Chưa đạt ngay)', color: 'text-red-900', bg: 'bg-red-50 border-red-200', desc: 'Xếp loại CHƯA ĐẠT ngay lập tức, không phụ thuộc số lỗi.' },
  improve:   { label: 'Cải thiện / Bù lỗi', color: 'text-emerald-900', bg: 'bg-emerald-50 border-emerald-200', desc: 'Mỗi 2 điểm hoạt động xóa được 1 lỗi thường.' },
};

const TIERS: ConductTier[] = ['fault', 'downgrade', 'critical', 'improve'];
const TT22 = ['1-Yêu nước', '2-Nhân ái', '3-Chăm chỉ', '4-Trung thực', '5-Trách nhiệm'];

function generateCode(tier: ConductTier, existingItems: ConductCatalogItem[]) {
  const prefixes: Record<ConductTier, string> = { fault: 'F', downgrade: 'D', critical: 'C', improve: 'IMP' };
  const p = prefixes[tier];
  const nums = existingItems.filter(i => i.code.startsWith(p)).map(i => parseInt(i.code.slice(p.length)) || 0);
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${p}${String(next).padStart(2, '0')}`;
}

export default function CatalogEditor() {
  const { appState, refreshData } = useData();
  const { session } = useAuth();
  const { showToast } = useToast();
  const isGvcn = session?.role === 'gvcn';

  const conduct = appState?.conduct;
  const [draft, setDraft] = useState<Record<ConductTier, ConductCatalogItem[]> | null>(null);
  const catalog = useMemo(() => {
    if (draft) return draft;
    if (!conduct?.catalog) return null;
    return {
      fault: conduct.catalog.faults || [],
      downgrade: conduct.catalog.downgrades || [],
      critical: conduct.catalog.critical || [],
      improve: conduct.catalog.improve || [],
    };
  }, [draft, conduct]);

  const [editModal, setEditModal] = useState<{ tier: ConductTier; item: ConductCatalogItem | null } | null>(null);
  const [fCode, setFCode] = useState('');
  const [fText, setFText] = useState('');
  const [fCriteria, setFCriteria] = useState<string[]>([]);
  const [fPoints, setFPoints] = useState(1);
  // Ngưỡng "tính từ lần thứ N" (vd F01 đi trễ = 3) — trước đây form này
  // không có ô nhập field này, nên mỗi lần GVCN sửa một mục có threshold
  // (kể cả chỉ sửa câu chữ), threshold bị ÂM THẦM XÓA khỏi mục đó, vô hiệu
  // hóa cơ chế xác nhận kép ở backend mà GVCN không hề biết.
  const [fThreshold, setFThreshold] = useState<number | ''>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  if (!isGvcn) {
    return <Layout><div className="p-10 text-center text-gray-500 font-bold">Chỉ GVCN được quản lý danh mục lỗi.</div></Layout>;
  }
  if (!catalog) {
    return <Layout><div className="p-10 text-center text-gray-400 italic">Đang tải danh mục...</div></Layout>;
  }

  const workingDraft = (): Record<ConductTier, ConductCatalogItem[]> => draft || { ...catalog };

  const openAdd = (tier: ConductTier) => {
    const allItems = [...catalog.fault, ...catalog.downgrade, ...catalog.critical, ...catalog.improve];
    setFCode(generateCode(tier, allItems));
    setFText(''); setFCriteria(['5-Trách nhiệm']); setFPoints(tier === 'improve' ? 1 : 1); setFThreshold('');
    setEditModal({ tier, item: null });
  };

  const openEdit = (tier: ConductTier, item: ConductCatalogItem) => {
    setFCode(item.code); setFText(item.text); setFCriteria([...(item.criteria || [])]);
    setFPoints((item as any).points || 1);
    setFThreshold(item.threshold ?? '');
    setEditModal({ tier, item });
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal || !fText.trim() || !fCode.trim()) return;
    const d = { ...workingDraft() };
    const items = [...d[editModal.tier]];
    const newItem: ConductCatalogItem = {
      code: fCode.trim(), text: fText.trim(), criteria: fCriteria,
      ...(editModal.tier !== 'downgrade' && editModal.tier !== 'critical' ? { points: fPoints } : {}),
      // Chỉ lỗi thường (fault) mới áp dụng ngưỡng "tính từ lần thứ N" — khớp
      // đúng phạm vi actConductLogAdd_ ở backend (chỉ đọc threshold khi
      // tier === 'fault'). Giữ nguyên giá trị GVCN đã nhập/kế thừa.
      ...(editModal.tier === 'fault' && fThreshold !== '' && Number(fThreshold) > 1 ? { threshold: Number(fThreshold) } : {}),
    };
    if (editModal.item) {
      const idx = items.findIndex(x => x.code === editModal.item!.code);
      if (idx >= 0) items[idx] = newItem; else items.push(newItem);
    } else {
      // Kiểm tra code trùng toàn catalog
      const allCodes = [...d.fault, ...d.downgrade, ...d.critical, ...d.improve].map(x => x.code);
      if (allCodes.includes(fCode.trim())) { showToast('Mã vi phạm đã tồn tại trong danh mục.', 'error'); return; }
      items.push(newItem);
    }
    d[editModal.tier] = items;
    setDraft(d); setIsDirty(true); setEditModal(null);
  };

  const handleDelete = (tier: ConductTier, code: string) => {
    if (!confirm('Xóa mục này khỏi danh mục? Lịch sử đã ghi vẫn giữ nguyên.')) return;
    const d = { ...workingDraft() };
    d[tier] = d[tier].filter(x => x.code !== code);
    setDraft(d); setIsDirty(true);
  };

  const handleSaveCatalog = async () => {
    if (!draft) return;
    setIsSaving(true);
    try {
      await api.call('CATALOG_SAVE', {
        catalog: { faults: draft.fault, downgrades: draft.downgrade, critical: draft.critical, improve: draft.improve }
      });
      await refreshData();
      setDraft(null); setIsDirty(false);
      showToast('Đã lưu danh mục hạnh kiểm!', 'success');
    } catch (err: any) { showToast(err.message, 'error'); } finally { setIsSaving(false); }
  };

  const handleReset = async () => {
    if (!confirm('Đặt lại về danh mục mặc định từ Sổ tay Nội quy? Mọi thay đổi tùy chỉnh sẽ mất.')) return;
    try {
      await api.call('CATALOG_RESET', {});
      await refreshData(); setDraft(null); setIsDirty(false);
      showToast('Đã đặt lại danh mục về mặc định.', 'success');
    } catch (err: any) { showToast(err.message, 'error'); }
  };

  const totalItems = TIERS.reduce((s, t) => s + catalog[t].length, 0);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-primary-700 p-6 rounded-3xl border border-primary-800 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-sans font-bold text-white flex items-center gap-3"><BookMarked size={28} className="text-amber-400" /> Danh mục Lỗi Hạnh kiểm</h1>
            <p className="text-gray-400 mt-1 text-sm">{totalItems} mục · Thêm, sửa, phân nhóm điểm trừ theo quy chế lớp.</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <button onClick={handleReset} className="px-3 py-2 bg-gray-800 text-gray-400 rounded-xl text-xs font-bold border border-gray-700 flex items-center gap-1.5 hover:text-white transition">
              <RotateCcw size={13} /> Đặt lại mặc định
            </button>
            {isDirty && (
              <button onClick={handleSaveCatalog} disabled={isSaving} className="btn-primary text-sm">
                <Save size={15} /> {isSaving ? 'Đang lưu...' : 'Lưu danh mục'}
              </button>
            )}
          </div>
        </div>

        {isDirty && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2 text-xs text-amber-800 font-bold">
            <AlertTriangle size={16} className="shrink-0" /> Có thay đổi chưa lưu — bấm <span className="underline">Lưu danh mục</span> để áp dụng vào toàn hệ thống.
          </div>
        )}

        <div className="space-y-5">
          {TIERS.map(tier => {
            const cfg = TIER_CONFIG[tier];
            const items = catalog[tier];
            return (
              <div key={tier} className={`rounded-2xl border ${cfg.bg} overflow-hidden shadow-sm`}>
                <div className="flex items-start justify-between gap-3 px-5 py-4">
                  <div>
                    <h2 className={`font-bold text-base ${cfg.color}`}>{cfg.label}</h2>
                    <p className="text-[11px] text-gray-500 mt-0.5">{cfg.desc}</p>
                  </div>
                  <button onClick={() => openAdd(tier)} className={`shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${cfg.bg} ${cfg.color} hover:brightness-95`}>
                    <Plus size={13} /> Thêm
                  </button>
                </div>

                <div className="bg-white border-t border-gray-100 divide-y divide-gray-100">
                  {items.length === 0 && (
                    <p className="text-xs text-gray-400 italic px-5 py-4">Chưa có mục nào trong nhóm này.</p>
                  )}
                  {items.map(item => (
                    <div key={item.code} className="flex items-start gap-3 px-5 py-3.5 group hover:bg-gray-50">
                      <GripVertical size={14} className="text-gray-300 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="font-mono text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{item.code}</span>
                          {(item as any).points && <span className="text-[10px] font-bold text-gray-500">{(item as any).points} lỗi</span>}
                          {(item.criteria || []).map(c => <span key={c} className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-bold text-gray-500">{c}</span>)}
                        </div>
                        <p className="text-sm text-gray-800 leading-snug">{item.text}</p>
                      </div>
                      <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => openEdit(tier, item)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Edit3 size={14} /></button>
                        <button onClick={() => handleDelete(tier, item.code)} className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL THÊM / SỬA MỤC */}
      <Modal isOpen={!!editModal} onClose={() => setEditModal(null)} title={editModal?.item ? 'Sửa mục vi phạm' : 'Thêm mục vi phạm mới'} maxWidth="max-w-lg">
        {editModal && (
          <form onSubmit={handleSaveItem} className="space-y-3">
            <div className={`px-3 py-2 rounded-xl text-xs font-bold ${TIER_CONFIG[editModal.tier].bg} ${TIER_CONFIG[editModal.tier].color}`}>
              Nhóm: {TIER_CONFIG[editModal.tier].label}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Mã vi phạm</label>
                <input type="text" required value={fCode} onChange={e => setFCode(e.target.value.toUpperCase())} className="field font-mono" placeholder="F16, D05..." />
              </div>
              {(editModal.tier === 'fault' || editModal.tier === 'improve') && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">{editModal.tier === 'improve' ? 'Điểm cải thiện' : 'Số lỗi'}</label>
                  <input type="number" min={1} max={10} value={fPoints} onChange={e => setFPoints(Number(e.target.value))} className="field" />
                </div>
              )}
            </div>
            {editModal.tier === 'fault' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Ngưỡng "tính từ lần thứ..." (tùy chọn)</label>
                <input type="number" min={2} max={10} value={fThreshold} onChange={e => setFThreshold(e.target.value === '' ? '' : Number(e.target.value))} className="field" placeholder="Bỏ trống = trừ điểm ngay từ lần đầu" />
                <p className="text-[10px] text-gray-500">Nếu nhập, ví dụ 3: hai lần vi phạm đầu chỉ ghi nhận (không trừ điểm), từ lần thứ 3 hệ thống sẽ hỏi GVCN xác nhận trước khi trừ.</p>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700">Mô tả hành vi vi phạm</label>
              <textarea required rows={3} value={fText} onChange={e => setFText(e.target.value)} className="field" placeholder="Mô tả rõ ràng, ngắn gọn theo ngôn ngữ quy chế..." />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700">Tiêu chí Thông tư 22 (chọn ít nhất 1)</label>
              <div className="flex flex-wrap gap-2 pt-1">
                {TT22.map(c => (
                  <label key={c} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer transition ${fCriteria.includes(c) ? 'bg-primary-700 text-white border-primary-700' : 'bg-white text-gray-500 border-gray-200 hover:border-primary-200'}`}>
                    <input type="checkbox" className="hidden" checked={fCriteria.includes(c)} onChange={() => setFCriteria(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c])} />
                    {c}
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" className="btn-primary w-full">{editModal.item ? 'Lưu chỉnh sửa' : 'Thêm vào danh mục'}</button>
          </form>
        )}
      </Modal>
    </Layout>
  );
}