import React, { useState, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { Modal } from '../components/ui';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../services/api';
import { Scale, Search, Edit3, History, Trash2, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { ConductTier, ConductLogEntry } from '../types';

const TIER_LABEL: Record<ConductTier, string> = { fault: 'Lỗi thường', downgrade: 'Hạ mức', critical: 'Nghiêm trọng', improve: 'Cải thiện' };
const TIER_BADGE: Record<ConductTier, string> = {
  fault: 'bg-stone-200 text-stone-800',
  downgrade: 'bg-amber-200 text-amber-900',
  critical: 'bg-red-200 text-red-900',
  improve: 'bg-emerald-200 text-emerald-900',
};
// 5 phẩm chất chủ yếu theo Thông tư 22 — dùng cho trường hợp CUSTOM (danh mục
// chuẩn từ ảnh chỉ xuất hiện 4/5 mã, "4-Trung thực" bổ sung cho đủ khung).
const TT22_CRITERIA = ['1-Yêu nước', '2-Nhân ái', '3-Chăm chỉ', '4-Trung thực', '5-Trách nhiệm'];

export default function Conduct() {
  const { appState, refreshData } = useData();
  const { session } = useAuth();
  const { showToast } = useToast();
  const isGvcn = session?.role === 'gvcn';

  const [search, setSearch] = useState('');
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [viewingLogStudent, setViewingLogStudent] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [violationCode, setViolationCode] = useState('');
  const [reason, setReason] = useState('');
  const [customText, setCustomText] = useState('');
  const [customCriteria, setCustomCriteria] = useState<string[]>([]);
  const [customTier, setCustomTier] = useState<ConductTier>('fault');
  const [customPoints, setCustomPoints] = useState(1);

  if (!isGvcn) {
    return <Layout><div className="p-10 text-center text-stone-500 font-bold">Khu vực Mật: Chỉ dành cho Giáo viên Chủ nhiệm & Hội đồng Kỷ luật.</div></Layout>;
  }

  const allStudents = appState?.roster.filter(u => u.role !== 'gvcn') || [];
  const catalog = appState?.conduct?.catalog;
  const logs = appState?.conduct?.logs || [];
  const summary = appState?.conduct?.summary || {};

  const flatCatalog = useMemo(() => {
    if (!catalog) return [];
    return [
      ...catalog.faults.map(i => ({ ...i, tier: 'fault' as ConductTier })),
      ...catalog.downgrades.map(i => ({ ...i, tier: 'downgrade' as ConductTier })),
      ...catalog.critical.map(i => ({ ...i, tier: 'critical' as ConductTier })),
      ...catalog.improve.map(i => ({ ...i, tier: 'improve' as ConductTier })),
    ];
  }, [catalog]);

  const selectedItem = violationCode === 'CUSTOM' ? null : flatCatalog.find(i => i.code === violationCode);
  const previewTier: ConductTier | null = violationCode === 'CUSTOM' ? customTier : (selectedItem?.tier ?? null);

  const handleOpenTransaction = (student: any) => {
    setEditingStudent(student);
    setViolationCode('');
    setReason('');
    setCustomText('');
    setCustomCriteria([]);
    setCustomTier('fault');
    setCustomPoints(1);
  };

  const handleExecuteTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent || !violationCode) return;
    if (!reason.trim()) { showToast('Bắt buộc nhập lý do / minh chứng.', 'error'); return; }
    if (violationCode === 'CUSTOM' && !customText.trim()) { showToast('Trường hợp CUSTOM bắt buộc nhập mô tả hành vi.', 'error'); return; }

    setIsProcessing(true);
    try {
      const payload: Record<string, any> = { studentId: editingStudent.id, violationCode, reason };
      if (violationCode === 'CUSTOM') {
        payload.customText = customText;
        payload.customCriteria = customCriteria;
        payload.customTier = customTier;
        payload.customPoints = customPoints;
      }
      await api.call('CONDUCT_LOG_ADD', payload);
      await refreshData();
      showToast('Đã ghi sổ hạnh kiểm thành công!', 'success');
      setEditingStudent(null);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!window.confirm('Xóa giao dịch này khỏi Sổ hạnh kiểm? Không thể hoàn tác.')) return;
    try {
      await api.call('CONDUCT_LOG_DELETE', { id: logId });
      await refreshData();
      showToast('Đã xóa giao dịch.', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const filteredStudents = allStudents.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Layout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="bg-stone-900 p-6 rounded-3xl border border-stone-800 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-white flex items-center gap-3"><Scale size={32} className="text-amber-400"/> Sổ Cái Kiểm Toán Hạnh Kiểm</h1>
            <p className="text-stone-400 mt-1">Ghi nhận theo danh mục chuẩn (Thông tư 22) — không nhập tay số lỗi.</p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 text-stone-500" size={18} />
            <input type="text" placeholder="Tìm kiếm học sinh..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-stone-800 border border-stone-700 text-white rounded-xl focus:border-amber-400 focus:outline-none" />
          </div>
        </div>

        {!catalog && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" /> Không nhận được danh mục hạnh kiểm từ máy chủ. Kiểm tra đã triển khai Code.gs v13.0 và đã tạo sheet <strong>ConductLog</strong> trong Google Sheet chưa.
          </div>
        )}

        {/* v15.0 — SỬA LỖI PHẢI CUỘN NGANG: bảng 7 cột với padding px-6 và
            whitespace-nowrap luôn tràn khỏi màn hình điện thoại. Nay tách 2
            dạng hiển thị: điện thoại dùng thẻ card xếp dọc (không cuộn ngang),
            máy tính dùng bảng nén padding còn px-3. */}

        {/* ĐIỆN THOẠI: danh sách thẻ */}
        <div className="grid gap-2.5 md:hidden">
          {filteredStudents.map(student => {
            const rec = summary[student.id] || { normalFaults: 0, downgradeFaults: 0, hasCritical: false, erasedFaults: 0, rank: 'TỐT' as const };
            const rankColor = rec.rank === 'TỐT' ? 'bg-emerald-500' : rec.rank === 'KHÁ' ? 'bg-blue-500' : rec.rank === 'ĐẠT' ? 'bg-amber-500' : 'bg-red-600';
            const studentLogs = logs.filter(l => l.studentId === student.id);
            return (
              <div key={student.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3.5">
                <div className="flex justify-between items-center gap-2">
                  <p className="font-bold text-stone-900 text-sm leading-tight">{student.name}</p>
                  <span className={`shrink-0 px-2.5 py-1 rounded-full font-bold text-[10px] tracking-wider text-white ${rankColor}`}>{rec.rank}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2 text-[11px] font-bold">
                  <span className="px-2 py-0.5 bg-stone-100 text-stone-700 rounded">Lỗi: {rec.normalFaults}</span>
                  {rec.erasedFaults > 0 && <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded">Đã xóa: {rec.erasedFaults}</span>}
                  {rec.downgradeFaults > 0 && <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded">Hạ bậc: {rec.downgradeFaults}</span>}
                  {rec.hasCritical && <span className="px-2 py-0.5 bg-red-50 text-red-700 rounded">Nghiêm trọng</span>}
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setViewingLogStudent({ student, logs: studentLogs })} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 bg-stone-100 text-stone-700 font-bold text-xs rounded-xl">
                    <History size={14} /> {studentLogs.length} giao dịch
                  </button>
                  <button onClick={() => handleOpenTransaction(student)} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 bg-red-900 text-white font-bold text-xs rounded-xl">
                    <Edit3 size={14}/> Ghi nhận
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* MÁY TÍNH: bảng nén */}
        <div className="hidden md:block bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm table-fixed">
            <thead className="bg-stone-100 text-stone-600 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-3 py-3">Học sinh</th>
                <th className="px-2 py-3 text-center w-16">Lỗi</th>
                <th className="px-2 py-3 text-center w-20">Đã xóa</th>
                <th className="px-2 py-3 text-center w-20">Hạ bậc</th>
                <th className="px-2 py-3 text-center w-24">Nghiêm trọng</th>
                <th className="px-2 py-3 text-center w-28 border-l border-stone-200">Xếp loại</th>
                <th className="px-2 py-3 text-center w-32">Nhật ký</th>
                <th className="px-3 py-3 text-right w-32">Hạch toán</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredStudents.map(student => {
                const rec = summary[student.id] || { normalFaults: 0, downgradeFaults: 0, hasCritical: false, erasedFaults: 0, rank: 'TỐT' as const };
                const rankColor = rec.rank === 'TỐT' ? 'bg-emerald-500 text-white' : rec.rank === 'KHÁ' ? 'bg-blue-500 text-white' : rec.rank === 'ĐẠT' ? 'bg-amber-500 text-white' : 'bg-red-600 text-white';
                const studentLogs = logs.filter(l => l.studentId === student.id);

                return (
                  <tr key={student.id} className="hover:bg-stone-50 transition">
                    <td className="px-3 py-2.5 font-bold text-stone-900 truncate">{student.name}</td>
                    <td className="px-2 py-2.5 text-center font-bold text-stone-700">{rec.normalFaults}</td>
                    <td className="px-2 py-2.5 text-center font-bold text-emerald-600">{rec.erasedFaults || '-'}</td>
                    <td className="px-2 py-2.5 text-center font-bold text-amber-600">{rec.downgradeFaults || '-'}</td>
                    <td className="px-2 py-2.5 text-center font-bold text-red-600">{rec.hasCritical ? 'CÓ' : '-'}</td>
                    <td className="px-2 py-2.5 text-center border-l border-stone-200">
                      <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] tracking-wider ${rankColor}`}>{rec.rank}</span>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <button onClick={() => setViewingLogStudent({ student, logs: studentLogs })} className="inline-flex items-center gap-1 px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-[11px] rounded-lg transition">
                        <History size={13} /> {studentLogs.length}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button onClick={() => handleOpenTransaction(student)} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-900 hover:bg-red-800 text-white font-bold text-[11px] rounded-lg shadow-sm transition">
                        <Edit3 size={13}/> Ghi nhận
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: HẠCH TOÁN GIAO DỊCH */}
      <Modal isOpen={!!editingStudent} onClose={() => setEditingStudent(null)} title="Ghi Sổ Hạnh Kiểm" maxWidth="max-w-lg">
        <form onSubmit={handleExecuteTransaction} className="space-y-4">
          <div className="text-center pb-3 border-b border-stone-100">
            <p className="text-xs text-stone-500">Đối tượng</p>
            <p className="text-lg font-bold text-stone-900">{editingStudent?.name}</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-700">Hành vi (theo danh mục chuẩn)</label>
            <select required value={violationCode} onChange={e => setViolationCode(e.target.value)} className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-medium">
              <option value="" disabled>-- Chọn hành vi --</option>
              <optgroup label="Vi phạm tính 1 lỗi">
                {catalog?.faults.map(f => <option key={f.code} value={f.code}>{f.text}</option>)}
              </optgroup>
              <optgroup label="Hạ 1 mức rèn luyện">
                {catalog?.downgrades.map(f => <option key={f.code} value={f.code}>{f.text}</option>)}
              </optgroup>
              <optgroup label="Vi phạm nghiêm trọng (Chưa đạt ngay)">
                {catalog?.critical.map(f => <option key={f.code} value={f.code}>{f.text}</option>)}
              </optgroup>
              <optgroup label="Cải thiện / Bù lỗi chuyên cần">
                {catalog?.improve.map(f => <option key={f.code} value={f.code}>{f.text}</option>)}
              </optgroup>
              <optgroup label="Khác">
                <option value="CUSTOM">✎ Trường hợp ngoại lệ (nhập tay)</option>
              </optgroup>
            </select>
          </div>

          {selectedItem && (
            <div className="flex flex-wrap items-center gap-1.5">
              {selectedItem.criteria.map(c => <span key={c} className="px-2 py-0.5 bg-stone-100 rounded-full text-[10px] font-bold text-stone-600">{c}</span>)}
            </div>
          )}

          {previewTier === 'critical' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-900">
              <ShieldAlert size={16} className="shrink-0 mt-0.5" /> Hành vi này sẽ đánh dấu học sinh <strong>CHƯA ĐẠT</strong> ngay lập tức.
            </div>
          )}
          {previewTier === 'downgrade' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-900">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" /> Hành vi này sẽ hạ 1 bậc xếp loại rèn luyện ngay lập tức.
            </div>
          )}
          {previewTier === 'improve' && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-xs text-emerald-900">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> Hành vi này sẽ trừ bớt 1 lỗi thường đã ghi nhận (cải thiện).
            </div>
          )}

          {violationCode === 'CUSTOM' && (
            <div className="space-y-3 p-3 bg-stone-50 border border-stone-200 rounded-xl">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Mô tả hành vi</label>
                <input type="text" required value={customText} onChange={e => setCustomText(e.target.value)} placeholder="Mô tả hành vi ngoại lệ..." className="w-full p-2 bg-white border border-stone-200 rounded-lg text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Tiêu chí Thông tư 22</label>
                <div className="flex flex-wrap gap-2">
                  {TT22_CRITERIA.map(c => (
                    <label key={c} className={`px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${customCriteria.includes(c) ? 'bg-red-900 text-white border-red-900' : 'bg-white text-stone-500 border-stone-200'}`}>
                      <input type="checkbox" className="hidden" checked={customCriteria.includes(c)}
                        onChange={() => setCustomCriteria(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])} />
                      {c}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700">Loại</label>
                  <select value={customTier} onChange={e => setCustomTier(e.target.value as ConductTier)} className="w-full p-2 bg-white border border-stone-200 rounded-lg text-sm">
                    <option value="fault">Lỗi thường</option>
                    <option value="downgrade">Hạ mức</option>
                    <option value="critical">Nghiêm trọng</option>
                    <option value="improve">Cải thiện</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700">Số điểm</label>
                  <input type="number" min={1} max={10} value={customPoints} onChange={e => setCustomPoints(Number(e.target.value))} className="w-full p-2 bg-white border border-stone-200 rounded-lg text-sm font-bold" />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-700">Lý do / Minh chứng chi tiết (bắt buộc)</label>
            <textarea rows={2} required value={reason} onChange={e => setReason(e.target.value)} placeholder="VD: Đi trễ tiết 1 ngày 07/09/2026 do xe hỏng..." className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm"></textarea>
          </div>

          <button type="submit" disabled={isProcessing || !violationCode} className="w-full py-3 bg-stone-900 text-white font-bold rounded-xl hover:bg-stone-800 transition disabled:opacity-50">
            {isProcessing ? 'Đang ghi sổ...' : 'Xác nhận Ghi Sổ'}
          </button>
        </form>
      </Modal>

      {/* MODAL 2: NHẬT KÝ GIAO DỊCH */}
      <Modal isOpen={!!viewingLogStudent} onClose={() => setViewingLogStudent(null)} title="Nhật Ký Kiểm Toán (Audit Trail Log)" maxWidth="max-w-2xl">
        {viewingLogStudent && (
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-stone-100">
              <div>
                <p className="text-xs text-stone-500">Học sinh</p>
                <h3 className="text-lg font-bold text-stone-900">{viewingLogStudent.student.name}</h3>
              </div>
              <div className="text-right">
                <p className="text-xs text-stone-500">Lỗi còn lại sau cải thiện</p>
                <p className="text-lg font-bold text-red-900">{(summary[viewingLogStudent.student.id]?.normalFaults) ?? 0} lỗi</p>
                {(summary[viewingLogStudent.student.id]?.improvePoints ?? 0) > 0 && (
                  <p className="text-[10px] text-emerald-700 font-bold">
                    {summary[viewingLogStudent.student.id]?.improvePoints} điểm HĐ → xóa {summary[viewingLogStudent.student.id]?.erasedFaults} lỗi (2 điểm = 1 lỗi)
                  </p>
                )}
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
              {viewingLogStudent.logs.length > 0 ? (
                viewingLogStudent.logs.map((log: ConductLogEntry) => (
                  <div key={log.id} className="p-3.5 rounded-xl border border-stone-200 bg-stone-50 flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${TIER_BADGE[log.tier]}`}>{TIER_LABEL[log.tier]}</span>
                        {log.criteria.map(c => <span key={c} className="px-2 py-0.5 bg-white border border-stone-200 rounded text-[10px] font-bold text-stone-500">{c}</span>)}
                        {log.violationCode === 'CUSTOM' && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-bold">CUSTOM</span>}
                      </div>
                      <p className="text-xs font-bold text-stone-800">{log.text}</p>
                      <p className="text-xs text-stone-600">{log.note}</p>
                      <p className="text-[10px] text-stone-400">Người hạch toán: <span className="font-bold">{log.author}</span> • {log.time}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="text-sm font-bold text-stone-700">{log.points} đ</div>
                      <button onClick={() => handleDeleteLog(log.id)} className="text-stone-300 hover:text-red-600 transition" title="Xóa giao dịch">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-stone-400 italic text-sm">Chưa có giao dịch nào được ghi sổ.</div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  );
}