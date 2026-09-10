import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from '../components/Layout';
import { Modal } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../services/api';
import {
  Users, UserPlus, Edit3, Trash2, KeyRound, Search, ShieldAlert, Copy, CheckCircle2, Lock, Power, CalendarClock
} from 'lucide-react';

interface AccountRow {
  username: string; name: string; role: string; groupNo: number | null;
  isLeader: boolean; active: boolean; hasPassword: boolean; createdAt: string;
}

const ROLE_OPTIONS = [
  { value: 'gvcn', label: 'GVCN' },
  { value: 'loptruong', label: 'Lớp trưởng' },
  { value: 'hoctap', label: 'Lớp phó Học tập' },
  { value: 'kyluat', label: 'Lớp phó Kỷ luật' },
  { value: 'vannghe', label: 'Lớp phó Văn nghệ' },
  { value: 'bithu', label: 'Bí thư' },
  { value: 'thuquy', label: 'Thủ quỹ' },
  { value: 'student', label: 'Học sinh' },
];
const roleLabel = (r: string) => {
  if (/^to\d+$/.test(r)) return `Tổ trưởng ${r.slice(2)}`;
  return ROLE_OPTIONS.find(o => o.value === r)?.label || r;
};

// Hiển thị trực quan khoảng ngày trọn vẹn của Tuần 1 (bắt đầu -> +6 ngày)
// khi GVCN chọn ngày bắt đầu trong form cấu hình — để xác nhận đúng ý trước
// khi lưu, thay vì chỉ thấy 1 ngày đơn lẻ không rõ ràng khoảng tuần.
function formatAnchorRange(startIso: string): string {
  const start = new Date(startIso + 'T00:00:00');
  const end = new Date(start.getTime() + 6 * 86400000);
  const f = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  return `${f(start)} – ${f(end)}`;
}

export default function Accounts() {
  const { session } = useAuth();
  const { appState, refreshData } = useData();
  const { showToast } = useToast();
  const isGvcn = session?.role === 'gvcn';

  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Cấu hình "Tuần 1" — thay hệ ISO week bằng hệ đánh số theo trường. Chỉ
  // GVCN chỉnh được, tránh bị đổi tùy tiện gây lệch số tuần đang dùng dở.
  const [anchorOpen, setAnchorOpen] = useState(false);
  const [anchorDate, setAnchorDate] = useState('');
  const [savingAnchor, setSavingAnchor] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AccountRow | null>(null);
  const [fUsername, setFUsername] = useState('');
  const [fName, setFName] = useState('');
  const [fRole, setFRole] = useState('student');
  const [fGroup, setFGroup] = useState('');
  const [fLeader, setFLeader] = useState(false);
  const [fActive, setFActive] = useState(true);

  const [pwModal, setPwModal] = useState<{ username: string; password: string } | null>(null);
  const [ownPwOpen, setOwnPwOpen] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await api.call<AccountRow[]>('USERS_LIST')); }
    catch (err: any) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { if (isGvcn) load(); else setLoading(false); }, [isGvcn, load]);

  const openAnchorForm = () => { setAnchorDate(appState?.weekAnchor || ''); setAnchorOpen(true); };
  const handleSaveAnchor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anchorDate) return;
    setSavingAnchor(true);
    try {
      await api.call('WEEK_ANCHOR_SAVE', { date: anchorDate });
      await refreshData();
      showToast('Đã cập nhật điểm bắt đầu Tuần 1!', 'success');
      setAnchorOpen(false);
    } catch (err: any) { showToast(err.message, 'error'); } finally { setSavingAnchor(false); }
  };

  if (!isGvcn) {
    return (
      <Layout>
        <div className="max-w-md mx-auto mt-10 space-y-4">
          <div className="p-6 bg-white rounded-2xl border border-gray-200 text-center space-y-2">
            <Lock size={32} className="mx-auto text-gray-400" />
            <p className="font-bold text-gray-800">Khu vực dành riêng cho GVCN</p>
            <p className="text-sm text-gray-500">Bạn vẫn có thể tự đổi mật khẩu của mình bên dưới.</p>
            <button onClick={() => setOwnPwOpen(true)} className="btn-primary mx-auto"><KeyRound size={16} /> Đổi mật khẩu của tôi</button>
          </div>
        </div>
        <OwnPwModal open={ownPwOpen} setOpen={setOwnPwOpen} oldPw={oldPw} setOldPw={setOldPw} newPw={newPw} setNewPw={setNewPw} isProcessing={isProcessing} setIsProcessing={setIsProcessing} showToast={showToast} />
      </Layout>
    );
  }

  const openCreate = () => {
    setEditing(null); setFUsername(''); setFName(''); setFRole('student'); setFGroup(''); setFLeader(false); setFActive(true); setFormOpen(true);
  };
  const openEdit = (r: AccountRow) => {
    setEditing(r); setFUsername(r.username); setFName(r.name); setFRole(r.role); setFGroup(r.groupNo ? String(r.groupNo) : ''); setFLeader(r.isLeader); setFActive(r.active); setFormOpen(true);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault(); setIsProcessing(true);
    try {
      if (editing) {
        await api.call('USER_UPDATE', { username: fUsername, name: fName, role: fRole, groupNo: fGroup ? Number(fGroup) : '', isLeader: fLeader, active: fActive });
        showToast('Đã cập nhật tài khoản.', 'success'); setFormOpen(false); await load();
      } else {
        const res = await api.call<{ username: string; generatedPassword: string }>('USER_CREATE', { username: fUsername, name: fName, role: fRole, groupNo: fGroup ? Number(fGroup) : '', isLeader: fLeader, active: fActive });
        setFormOpen(false); await load();
        setPwModal({ username: res.username, password: res.generatedPassword });
      }
    } catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };

  const handleReset = async (username: string) => {
    if (!confirm(`Đặt lại mật khẩu cho "${username}"? Mật khẩu cũ sẽ mất hiệu lực ngay.`)) return;
    try {
      const res = await api.call<{ username: string; newPassword: string }>('USER_RESET_PASSWORD', { username });
      setPwModal({ username: res.username, password: res.newPassword });
    } catch (err: any) { showToast(err.message, 'error'); }
  };

  const handleDelete = async (username: string) => {
    if (!confirm(`XÓA VĨNH VIỄN tài khoản "${username}"? Không thể hoàn tác.`)) return;
    try { await api.call('USER_DELETE', { username }); showToast('Đã xóa tài khoản.', 'success'); await load(); }
    catch (err: any) { showToast(err.message, 'error'); }
  };

  const handleToggleActive = async (r: AccountRow) => {
    try { await api.call('USER_UPDATE', { username: r.username, active: !r.active }); await load(); }
    catch (err: any) { showToast(err.message, 'error'); }
  };

  const copyPw = () => {
    if (!pwModal) return;
    navigator.clipboard?.writeText(pwModal.password);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  const filtered = rows.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.username.toLowerCase().includes(search.toLowerCase()));

  const RoleTag = ({ role }: { role: string }) => (
    // Đồng bộ với RoleBadge (ui.tsx): "Ban cán sự" dùng violet thay vì blue
    // — blue giờ trùng gần hệt primary-100/primary-700 (màu chủ đạo mới),
    // khiến badge GVCN và Ban cán sự khó phân biệt trong bảng tài khoản.
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${role === 'gvcn' ? 'bg-primary-100 text-primary-700' : role === 'student' ? 'bg-gray-100 text-gray-600' : 'bg-violet-100 text-violet-800'}`}>{roleLabel(role)}</span>
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="bg-primary-700 p-6 rounded-3xl border border-primary-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-sans font-bold text-white flex items-center gap-3"><Users size={30} className="text-amber-400" /> Quản trị Tài khoản</h1>
            <p className="text-gray-400 mt-1 text-sm">{rows.length} tài khoản · Thêm, sửa, phân quyền và đặt lại mật khẩu.</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button onClick={() => setOwnPwOpen(true)} className="px-3 py-2 bg-black/20 text-gray-100 rounded-xl text-xs font-bold border border-white/10 flex items-center gap-1.5"><KeyRound size={14} /> Mật khẩu của tôi</button>
            <button onClick={openCreate} className="btn-primary flex-1 md:flex-none"><UserPlus size={16} /> Thêm tài khoản</button>
          </div>
        </div>

        {/* CẤU HÌNH ĐIỂM NEO "TUẦN 1" — ảnh hưởng số tuần hiển thị toàn hệ
            thống (Báo cáo tuần BCS, Báo cáo Hạnh kiểm). Đặt ở đây vì đây là
            trang cấu hình/quản trị chung, không thuộc riêng 1 nghiệp vụ. */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center shrink-0"><CalendarClock size={20} /></div>
            <div>
              <p className="text-sm font-bold text-gray-800">Điểm bắt đầu "Tuần 1"</p>
              <p className="text-xs text-gray-500">
                {appState?.weekAnchor
                  ? `Tuần 1 là ${formatAnchorRange(appState.weekAnchor)} — các tuần sau tính tuần tự từ đó, đến hết năm học.`
                  : 'Mặc định: Tuần 1 bắt đầu từ 07/09.'}
              </p>
            </div>
          </div>
          <button onClick={openAnchorForm} className="text-xs font-bold text-primary-700 hover:underline shrink-0">Chỉnh sửa</button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          <input type="text" placeholder="Tìm theo tên hoặc tên đăng nhập..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-700" />
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 italic py-10 text-center">Đang tải danh sách...</p>
        ) : (
          <>
            {/* MOBILE: card */}
            <div className="grid gap-2.5 md:hidden">
              {filtered.map(r => (
                <div key={r.username} className={`bg-white rounded-2xl border shadow-sm p-3.5 ${r.active ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-bold text-gray-900 text-sm leading-tight">{r.name}</p>
                      <p className="text-[11px] text-gray-400 font-mono">@{r.username}</p>
                    </div>
                    <RoleTag role={r.role} />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2 text-[10px] font-bold text-gray-500">
                    {r.groupNo && <span className="px-1.5 py-0.5 bg-gray-100 rounded">Tổ {r.groupNo}</span>}
                    {r.isLeader && <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded">Tổ trưởng</span>}
                    {!r.active && <span className="px-1.5 py-0.5 bg-primary-50 text-primary-700 rounded">Đã khóa</span>}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 mt-3">
                    <button onClick={() => openEdit(r)} className="py-2 bg-gray-100 text-gray-700 rounded-lg flex justify-center" title="Sửa"><Edit3 size={14} /></button>
                    <button onClick={() => handleReset(r.username)} className="py-2 bg-amber-50 text-amber-700 rounded-lg flex justify-center" title="Đặt lại mật khẩu"><KeyRound size={14} /></button>
                    <button onClick={() => handleToggleActive(r)} className="py-2 bg-gray-100 text-gray-700 rounded-lg flex justify-center" title={r.active ? 'Khóa' : 'Mở khóa'}><Power size={14} /></button>
                    <button onClick={() => handleDelete(r.username)} className="py-2 bg-red-50 text-red-600 rounded-lg flex justify-center" title="Xóa"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>

            {/* DESKTOP: table */}
            <div className="hidden md:block bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-100 text-gray-600 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Họ tên</th>
                    <th className="px-3 py-3">Đăng nhập</th>
                    <th className="px-3 py-3">Vai trò</th>
                    <th className="px-2 py-3 text-center w-16">Tổ</th>
                    <th className="px-2 py-3 text-center w-20">Trạng thái</th>
                    <th className="px-3 py-3 text-right w-44">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(r => (
                    <tr key={r.username} className={`hover:bg-gray-50 transition ${!r.active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-2.5 font-bold text-gray-900">{r.name}{r.isLeader && <span className="ml-1.5 text-[9px] uppercase font-bold text-amber-600">TT</span>}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-500">@{r.username}</td>
                      <td className="px-3 py-2.5"><RoleTag role={r.role} /></td>
                      <td className="px-2 py-2.5 text-center text-gray-600 font-bold">{r.groupNo || '-'}</td>
                      <td className="px-2 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.active ? 'bg-emerald-100 text-emerald-700' : 'bg-primary-100 text-primary-700'}`}>{r.active ? 'Hoạt động' : 'Đã khóa'}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="inline-flex gap-1">
                          <button onClick={() => openEdit(r)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Sửa"><Edit3 size={15} /></button>
                          <button onClick={() => handleReset(r.username)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded" title="Đặt lại mật khẩu"><KeyRound size={15} /></button>
                          <button onClick={() => handleToggleActive(r)} className="p-1.5 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded" title={r.active ? 'Khóa' : 'Mở khóa'}><Power size={15} /></button>
                          <button onClick={() => handleDelete(r.username)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Xóa"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* FORM THÊM/SỬA */}
      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Sửa tài khoản' : 'Thêm tài khoản mới'}>
        <form onSubmit={submitForm} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700">Tên đăng nhập</label>
            <input type="text" required disabled={!!editing} value={fUsername} onChange={e => setFUsername(e.target.value.trim())} className="field disabled:bg-gray-100 disabled:text-gray-400" placeholder="vd: hs001" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700">Họ và tên</label>
            <input type="text" required value={fName} onChange={e => setFName(e.target.value)} className="field" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700">Vai trò</label>
              <select value={fRole} onChange={e => setFRole(e.target.value)} className="field">
                {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                <optgroup label="Tổ trưởng">{[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={`to${n}`} value={`to${n}`}>Tổ trưởng {n}</option>)}</optgroup>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700">Tổ</label>
              <select value={fGroup} onChange={e => setFGroup(e.target.value)} className="field">
                <option value="">-- Chưa phân --</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>Tổ {n}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-4 pt-1">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-700"><input type="checkbox" checked={fLeader} onChange={e => setFLeader(e.target.checked)} /> Là tổ trưởng</label>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-700"><input type="checkbox" checked={fActive} onChange={e => setFActive(e.target.checked)} /> Kích hoạt</label>
          </div>
          {!editing && (
            <p className="text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-2.5">Hệ thống sẽ tự tạo mật khẩu ngẫu nhiên và hiển thị một lần sau khi tạo xong.</p>
          )}
          <button type="submit" disabled={isProcessing} className="btn-primary w-full">{isProcessing ? 'Đang lưu...' : (editing ? 'Cập nhật' : 'Tạo tài khoản')}</button>
        </form>
      </Modal>

      {/* HIỆN MẬT KHẨU MỚI 1 LẦN */}
      <Modal isOpen={!!pwModal} onClose={() => setPwModal(null)} title="Mật khẩu mới">
        {pwModal && (
          <div className="space-y-4 text-center">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-900 text-left">
              <ShieldAlert size={16} className="shrink-0 mt-0.5" /> Ghi lại ngay và đưa cho học sinh. Mật khẩu này <strong>không thể xem lại</strong> sau khi đóng cửa sổ — nếu quên, phải đặt lại lần nữa.
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Tài khoản <span className="font-mono font-bold">@{pwModal.username}</span></p>
              <div className="flex items-center justify-center gap-2">
                <code className="text-2xl font-bold tracking-widest text-gray-900 bg-gray-100 px-4 py-2 rounded-xl">{pwModal.password}</code>
                <button onClick={copyPw} className="p-2.5 bg-gray-900 text-white rounded-xl" title="Sao chép">{copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}</button>
              </div>
            </div>
            <button onClick={() => setPwModal(null)} className="btn-primary w-full">Tôi đã ghi lại</button>
          </div>
        )}
      </Modal>

      {/* CẤU HÌNH ĐIỂM NEO "TUẦN 1" — hiển thị trực quan cả khoảng ngày (từ
          ngày chọn đến +6 ngày) để GVCN xác nhận đúng ý trước khi lưu, thay
          vì chỉ nhập 1 ngày rồi tự suy luận không rõ ràng khoảng tuần. */}
      <Modal isOpen={anchorOpen} onClose={() => setAnchorOpen(false)} title="Điểm bắt đầu Tuần 1">
        <form onSubmit={handleSaveAnchor} className="space-y-4">
          <div className="p-3 bg-primary-50 border border-primary-200 rounded-xl text-xs text-primary-800">
            Chọn ngày bắt đầu (thường là Thứ Hai) của tuần muốn đặt làm "Tuần 1". Các tuần sau sẽ tự động tính tuần tự từ đó, đến hết năm học — không cần chỉnh lại mỗi tuần.
          </div>
          <div className="space-y-1">
            <label className="text-sm font-bold text-gray-700">Ngày bắt đầu Tuần 1</label>
            <input type="date" required value={anchorDate} onChange={e => setAnchorDate(e.target.value)} className="field" />
          </div>
          {anchorDate && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-2 text-sm">
              <CalendarClock size={16} className="text-primary-700 shrink-0" />
              <span className="text-gray-700">
                <strong className="text-gray-900">Tuần 1</strong> sẽ là: {formatAnchorRange(anchorDate)}
              </span>
            </div>
          )}
          <button type="submit" disabled={savingAnchor} className="btn-primary w-full">{savingAnchor ? 'Đang lưu...' : 'Lưu cấu hình'}</button>
        </form>
      </Modal>

      <OwnPwModal open={ownPwOpen} setOpen={setOwnPwOpen} oldPw={oldPw} setOldPw={setOldPw} newPw={newPw} setNewPw={setNewPw} isProcessing={isProcessing} setIsProcessing={setIsProcessing} showToast={showToast} />
    </Layout>
  );
}

// Modal đổi mật khẩu của chính mình — tách riêng để cả GVCN lẫn user thường dùng chung.
function OwnPwModal({ open, setOpen, oldPw, setOldPw, newPw, setNewPw, isProcessing, setIsProcessing, showToast }: any) {
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsProcessing(true);
    try {
      await api.call('USER_CHANGE_OWN_PASSWORD', { oldPassword: oldPw, newPassword: newPw });
      showToast('Đã đổi mật khẩu thành công.', 'success'); setOpen(false); setOldPw(''); setNewPw('');
    } catch (err: any) { showToast(err.message, 'error'); } finally { setIsProcessing(false); }
  };
  return (
    <Modal isOpen={open} onClose={() => setOpen(false)} title="Đổi mật khẩu của tôi">
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-700">Mật khẩu hiện tại</label>
          <input type="password" required value={oldPw} onChange={e => setOldPw(e.target.value)} className="field" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-700">Mật khẩu mới (tối thiểu 4 ký tự)</label>
          <input type="password" required minLength={4} value={newPw} onChange={e => setNewPw(e.target.value)} className="field" />
        </div>
        <button type="submit" disabled={isProcessing} className="btn-primary w-full">{isProcessing ? 'Đang đổi...' : 'Đổi mật khẩu'}</button>
      </form>
    </Modal>
  );
}